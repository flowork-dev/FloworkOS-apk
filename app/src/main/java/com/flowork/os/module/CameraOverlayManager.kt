// File: app/src/main/java/com/flowork/os/module/CameraOverlayManager.kt
package com.flowork.os.module

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.PixelFormat
import android.graphics.RectF
import android.graphics.SurfaceTexture
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.params.OutputConfiguration
import android.hardware.camera2.params.SessionConfiguration
import android.media.MediaRecorder
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Size
import android.view.GestureDetector
import android.view.Gravity
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.Surface
import android.view.TextureView
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.Toast
import androidx.cardview.widget.CardView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.flowork.os.AudioVisualizerView
import com.flowork.os.R
import java.io.File
import java.util.Collections
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

class CameraOverlayManager(private val context: Context) {

    private data class DragState(val viewX: Int, val viewY: Int, val touchX: Float, val touchY: Float)

    private val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private val cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager

    private var cameraBubbleView: FrameLayout? = null
    private var cameraParams: WindowManager.LayoutParams? = null
    private var visualizerView: AudioVisualizerView? = null
    private var cameraCardView: CardView? = null
    private var cameraContentFrame: FrameLayout? = null
    private var textureView: TextureView? = null
    private var avatarView: ImageView? = null
    private var btnMinimizeFs: ImageView? = null

    private var currentBubbleSize = 400 // Default size agak kecil biar gak kaget
    private var scaleGestureDetector: ScaleGestureDetector? = null
    private var gestureDetector: GestureDetector? = null
    private var onCloseCallback: (() -> Unit)? = null

    // Camera State
    private var cameraDevice: CameraDevice? = null
    private var cameraCaptureSession: CameraCaptureSession? = null
    private var isFrontCamera = true

    // Config Camera
    private var bestPreviewSize: Size = Size(640, 480)
    private var sensorOrientation = 90

    // Fullscreen State
    private var isFullscreen = false
    private var savedX = 0
    private var savedY = 0

    // Visualizer
    private var previewRecorder: MediaRecorder? = null
    private var visualizerRunnable: Runnable? = null
    private val audioHandler = Handler(Looper.getMainLooper())
    private val uiHandler = Handler(Looper.getMainLooper())

    var isCamOn = true
    var isAvatarMode = false
    var isMicOn = true

    init {
        setupGestures()
    }

    private fun setupGestures() {
        scaleGestureDetector = ScaleGestureDetector(context, object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
            override fun onScale(detector: ScaleGestureDetector): Boolean {
                if (cameraBubbleView == null || cameraParams == null || isFullscreen) return false
                val scaleFactor = detector.scaleFactor
                currentBubbleSize = (currentBubbleSize * scaleFactor).toInt()
                // Batasi ukuran bubble biar ga kegedean/kekecilan
                currentBubbleSize = max(250, min(currentBubbleSize, 800))

                cameraParams!!.width = currentBubbleSize
                cameraParams!!.height = currentBubbleSize
                try {
                    windowManager.updateViewLayout(cameraBubbleView, cameraParams)
                } catch (e: Exception) { /* Ignore if view detached */ }

                updateCardViewSize()
                visualizerView?.updateBaseRadius(currentBubbleSize)
                return true
            }
        })

        gestureDetector = GestureDetector(context, object : GestureDetector.SimpleOnGestureListener() {
            override fun onDoubleTap(e: MotionEvent): Boolean {
                toggleFullscreen()
                return true
            }
        })
    }

    fun show(forceAvatarUri: Uri? = null, onCloseClicked: (() -> Unit)? = null) {
        if (onCloseClicked != null) { this.onCloseCallback = onCloseClicked }

        try {
            if (cameraBubbleView == null) { createLayout() }
            cameraBubbleView?.visibility = View.VISIBLE
            cameraContentFrame?.removeAllViews()

            if (isAvatarMode || forceAvatarUri != null) {
                closeCameraHardware()
                setupAvatarView(forceAvatarUri)
            } else if (isCamOn) {
                // Delay dikit biar layout ready dulu baru buka kamera
                uiHandler.postDelayed({ setupCameraView() }, 100)
            }

            // [FIX] Cek Mic On/Off sebelum start loop biar ga crash conflict mic
            if (isMicOn) startVisualizerLoop()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun hide() {
        try {
            closeCameraHardware()
            stopVisualizerLoop()
            if (cameraBubbleView != null) {
                windowManager.removeView(cameraBubbleView)
                cameraBubbleView = null
                visualizerView = null
                cameraCardView = null
                textureView = null // Bersihkan ref
            }
        } catch (e: Exception) { e.printStackTrace() }
    }

    fun updateState(camOn: Boolean, avatarMode: Boolean, micOn: Boolean) {
        // Cek perubahan state biar ga redraw kalau sama
        if (isCamOn == camOn && isAvatarMode == avatarMode && isMicOn == micOn && cameraBubbleView != null) return

        isCamOn = camOn
        isAvatarMode = avatarMode
        isMicOn = micOn

        if (!isCamOn && !isAvatarMode) hide() else show()

        // Handle visualizer mic conflict
        if (isMicOn) startVisualizerLoop() else stopVisualizerLoop()
    }

    fun toggleFullscreen(): Boolean {
        if (cameraBubbleView == null || cameraParams == null || cameraCardView == null) return false

        try {
            if (isFullscreen) {
                // === JADI KECIL (BUBBLE) ===
                isFullscreen = false
                cameraParams?.width = currentBubbleSize
                cameraParams?.height = currentBubbleSize
                cameraParams?.x = savedX
                cameraParams?.y = savedY

                val faceSize = (currentBubbleSize * 0.5f).toInt()
                val cardParams = cameraCardView!!.layoutParams as FrameLayout.LayoutParams
                cardParams.width = faceSize
                cardParams.height = faceSize
                cardParams.gravity = Gravity.CENTER
                cameraCardView!!.layoutParams = cardParams

                cameraCardView?.radius = currentBubbleSize / 2f
                visualizerView?.visibility = View.VISIBLE
                btnMinimizeFs?.visibility = View.GONE

            } else {
                // === JADI FULL SCREEN ===
                isFullscreen = true
                savedX = cameraParams?.x ?: 0
                savedY = cameraParams?.y ?: 0

                cameraParams?.width = WindowManager.LayoutParams.MATCH_PARENT
                cameraParams?.height = WindowManager.LayoutParams.MATCH_PARENT
                cameraParams?.x = 0
                cameraParams?.y = 0

                val cardParams = cameraCardView!!.layoutParams as FrameLayout.LayoutParams
                cardParams.width = ViewGroup.LayoutParams.MATCH_PARENT
                cardParams.height = ViewGroup.LayoutParams.MATCH_PARENT
                cameraCardView!!.layoutParams = cardParams

                cameraCardView?.radius = 0f
                visualizerView?.visibility = View.GONE
                btnMinimizeFs?.visibility = View.VISIBLE
            }

            windowManager.updateViewLayout(cameraBubbleView, cameraParams)

            // Update texture transform
            textureView?.post {
                textureView?.let { transformTexture(it.width, it.height) }
            }
        } catch (e: Exception) { e.printStackTrace() }

        return isFullscreen
    }

    fun switchCamera() {
        if (!isCamOn || isAvatarMode) return
        closeCameraHardware()
        isFrontCamera = !isFrontCamera
        cameraContentFrame?.removeAllViews()
        uiHandler.postDelayed({ setupCameraView() }, 300) // Kasih napas dikit buat hardware switch
    }

    fun setTheme(themeName: String) { visualizerView?.setTheme(themeName) }

    private fun createLayout() {
        cameraBubbleView = FrameLayout(context).apply { clipChildren = false; clipToPadding = false }
        visualizerView = AudioVisualizerView(context)
        cameraBubbleView?.addView(visualizerView, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))

        cameraCardView = CardView(context).apply { radius = 1000f; cardElevation = 0f; setCardBackgroundColor(Color.BLACK) }
        val faceSize = (currentBubbleSize * 0.5f).toInt()
        val cardParams = FrameLayout.LayoutParams(faceSize, faceSize).apply { gravity = Gravity.CENTER }
        cameraContentFrame = FrameLayout(context)
        cameraCardView?.addView(cameraContentFrame)
        cameraBubbleView?.addView(cameraCardView, cardParams)

        val btnClose = ImageView(context).apply {
            setImageResource(android.R.drawable.ic_menu_close_clear_cancel)
            setColorFilter(Color.WHITE); setBackgroundColor(Color.TRANSPARENT); alpha = 0.3f; setPadding(20, 20, 20, 20)
            setOnClickListener { onCloseCallback?.invoke() }
        }
        val closeParams = FrameLayout.LayoutParams(80, 80).apply { gravity = Gravity.TOP or Gravity.END; setMargins(0, 20, 20, 0) }
        cameraBubbleView?.addView(btnClose, closeParams)

        btnMinimizeFs = ImageView(context).apply {
            setImageResource(android.R.drawable.ic_menu_revert)
            setColorFilter(Color.WHITE)
            setBackgroundColor(Color.parseColor("#40000000"))
            setPadding(20, 20, 20, 20)
            visibility = View.GONE
            setOnClickListener { toggleFullscreen() }
        }
        val minParams = FrameLayout.LayoutParams(100, 100).apply {
            gravity = Gravity.BOTTOM or Gravity.END
            setMargins(0, 0, 50, 150)
        }
        cameraBubbleView?.addView(btnMinimizeFs, minParams)

        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY else { @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE }
        cameraParams = WindowManager.LayoutParams(currentBubbleSize, currentBubbleSize, layoutType, WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT).apply { gravity = Gravity.TOP or Gravity.START; x = 50; y = 400 }

        setupDragListener()
        windowManager.addView(cameraBubbleView, cameraParams)
        visualizerView?.updateBaseRadius(currentBubbleSize)
    }

    private fun setupAvatarView(uri: Uri?) {
        avatarView = ImageView(context).apply { scaleType = ImageView.ScaleType.CENTER_CROP }
        cameraContentFrame?.addView(avatarView)
        val defaultUri = Uri.parse("android.resource://${context.packageName}/${R.drawable.ic_logo_flowork}")
        val targetUri = uri ?: defaultUri
        try {
            val stream = context.contentResolver.openInputStream(targetUri)
            val bmp = BitmapFactory.decodeStream(stream); avatarView?.setImageBitmap(bmp)
        } catch(e: Exception) { avatarView?.setImageResource(R.drawable.ic_logo_flowork) }
    }

    private fun setupCameraView() {
        textureView = TextureView(context)
        cameraContentFrame?.addView(textureView)
        textureView?.surfaceTextureListener = object : TextureView.SurfaceTextureListener {
            override fun onSurfaceTextureAvailable(surface: SurfaceTexture, width: Int, height: Int) {
                // [FIX] Cek permission lagi sebelum open hardware
                if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                    openCameraHardware()
                    transformTexture(width, height)
                }
            }
            override fun onSurfaceTextureSizeChanged(surface: SurfaceTexture, w: Int, h: Int) { transformTexture(w, h) }
            override fun onSurfaceTextureDestroyed(surface: SurfaceTexture): Boolean { closeCameraHardware(); return true }
            override fun onSurfaceTextureUpdated(surface: SurfaceTexture) {}
        }
    }

    @SuppressLint("MissingPermission")
    private fun openCameraHardware() {
        if (cameraDevice != null) return // Jangan open kalau udah open

        try {
            val targetLens = if (isFrontCamera) CameraCharacteristics.LENS_FACING_FRONT else CameraCharacteristics.LENS_FACING_BACK
            val cid = cameraManager.cameraIdList.firstOrNull {
                cameraManager.getCameraCharacteristics(it).get(CameraCharacteristics.LENS_FACING) == targetLens
            }
            if (cid == null) {
                uiHandler.post { Toast.makeText(context, "Kamera tidak ditemukan!", Toast.LENGTH_SHORT).show() }
                return
            }

            val characteristics = cameraManager.getCameraCharacteristics(cid)
            val map = characteristics.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
            sensorOrientation = characteristics.get(CameraCharacteristics.SENSOR_ORIENTATION) ?: 90

            val sizes = map?.getOutputSizes(SurfaceTexture::class.java)
            bestPreviewSize = sizes?.maxByOrNull { it.width * it.height } ?: Size(1280, 720)

            // [FIX] Tambahkan Try-Catch di dalam callback untuk menangkap error fatal dari Camera2 API
            cameraManager.openCamera(cid, object : CameraDevice.StateCallback() {
                override fun onOpened(c: CameraDevice) {
                    cameraDevice = c
                    try { startCameraPreview() } catch (e: Exception) {
                        e.printStackTrace()
                        closeCameraHardware()
                    }
                }
                override fun onDisconnected(c: CameraDevice) {
                    c.close()
                    cameraDevice = null
                }
                override fun onError(c: CameraDevice, i: Int) {
                    c.close()
                    cameraDevice = null
                }
            }, uiHandler)
        } catch (e: Exception) { e.printStackTrace() }
    }

    private fun startCameraPreview() {
        try {
            if (cameraDevice == null || textureView == null || !textureView!!.isAvailable) return

            val texture = textureView!!.surfaceTexture ?: return
            texture.setDefaultBufferSize(bestPreviewSize.width, bestPreviewSize.height)

            val surface = Surface(texture)
            val builder = cameraDevice?.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW)
            builder?.addTarget(surface)

            val sessionCallback = object : CameraCaptureSession.StateCallback() {
                override fun onConfigured(session: CameraCaptureSession) {
                    if (cameraDevice == null) return
                    cameraCaptureSession = session
                    try {
                        builder?.let { session.setRepeatingRequest(it.build(), null, null) }
                        uiHandler.post { textureView?.let { tv -> transformTexture(tv.width, tv.height) } }
                    } catch (e: Exception) { e.printStackTrace() }
                }
                override fun onConfigureFailed(session: CameraCaptureSession) {}
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                cameraDevice?.createCaptureSession(SessionConfiguration(SessionConfiguration.SESSION_REGULAR, listOf(OutputConfiguration(surface)), context.mainExecutor, sessionCallback))
            } else {
                @Suppress("DEPRECATION")
                cameraDevice?.createCaptureSession(Collections.singletonList(surface), sessionCallback, null)
            }
        } catch (e: Exception) { e.printStackTrace() }
    }

    private fun closeCameraHardware() {
        try {
            cameraCaptureSession?.stopRepeating()
            cameraCaptureSession?.abortCaptures()
        } catch (e: Exception) {}

        try { cameraCaptureSession?.close() } catch (e: Exception) {}
        cameraCaptureSession = null

        try { cameraDevice?.close() } catch (e: Exception) {}
        cameraDevice = null
    }

    private fun transformTexture(viewWidth: Int, viewHeight: Int) {
        if (textureView == null || viewWidth == 0 || viewHeight == 0) return
        val matrix = Matrix()
        val viewRect = RectF(0f, 0f, viewWidth.toFloat(), viewHeight.toFloat())
        val bufferRect = RectF(0f, 0f, bestPreviewSize.width.toFloat(), bestPreviewSize.height.toFloat())
        val centerX = viewRect.centerX()
        val centerY = viewRect.centerY()

        bufferRect.offset(centerX - bufferRect.centerX(), centerY - bufferRect.centerY())
        matrix.setRectToRect(viewRect, bufferRect, Matrix.ScaleToFit.FILL)

        val bufferW = bestPreviewSize.width.toFloat()
        val bufferH = bestPreviewSize.height.toFloat()
        val scale = max(viewWidth / bufferW, viewHeight / bufferH)

        matrix.postScale(scale, scale, centerX, centerY)
        matrix.postRotate(0f, centerX, centerY)

        if (isFrontCamera) {
            matrix.postScale(-1f, 1f, centerX, centerY)
        }

        textureView?.setTransform(matrix)
    }

    private fun updateCardViewSize() {
        if (cameraCardView != null && !isFullscreen) {
             val faceSize = (currentBubbleSize * 0.5f).toInt()
             val params = cameraCardView!!.layoutParams as FrameLayout.LayoutParams
             params.width = faceSize; params.height = faceSize
             cameraCardView!!.layoutParams = params; cameraCardView!!.radius = faceSize / 2f
        }
    }

    private fun setupDragListener() {
        cameraBubbleView?.setOnTouchListener { v, event ->
            gestureDetector?.onTouchEvent(event)
            scaleGestureDetector?.onTouchEvent(event)
            if (isFullscreen || scaleGestureDetector?.isInProgress == true) return@setOnTouchListener true
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> { v.tag = DragState(cameraParams!!.x, cameraParams!!.y, event.rawX, event.rawY); return@setOnTouchListener true }
                MotionEvent.ACTION_MOVE -> {
                    val state = v.tag as? DragState
                    if (state != null) {
                        cameraParams!!.x = state.viewX + (event.rawX - state.touchX).toInt()
                        cameraParams!!.y = state.viewY + (event.rawY - state.touchY).toInt()
                        try { windowManager.updateViewLayout(cameraBubbleView, cameraParams) } catch(e:Exception){}
                    }
                    return@setOnTouchListener true
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> { v.tag = null; return@setOnTouchListener true }
            }
            false
        }
    }

    fun startVisualizerLoop() {
        if (visualizerRunnable != null) return // Already running

        // [FIX] Cek permission Audio sebelum akses Mic
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) return

        if (previewRecorder == null) {
            try {
                previewRecorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) MediaRecorder(context) else { @Suppress("DEPRECATION") MediaRecorder() }
                previewRecorder?.apply {
                    setAudioSource(MediaRecorder.AudioSource.MIC)
                    setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                    setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                    // Pake /dev/null kalau bisa, atau temp file kecil
                    setOutputFile(File(context.cacheDir, "vis_tmp.mp4"))
                    prepare()
                    start()
                }
            } catch (e: Exception) {
                // [PENTING] Kalau Mic sibuk (dipake screen recorder), JANGAN CRASH.
                // Matikan fitur visualizer diam-diam.
                previewRecorder?.release()
                previewRecorder = null
                return
            }
        }

        visualizerRunnable = object : Runnable {
            override fun run() {
                try {
                    // Kalau recorder null (gagal init), skip update
                    val amp = previewRecorder?.maxAmplitude ?: 0
                    visualizerView?.updateAmplitude(amp)
                    if (cameraCardView != null && !isFullscreen) {
                        val maxAmp = 32767f; val boost = (amp / maxAmp).pow(3) * 0.8f; val scale = 1.0f + boost
                        val curr = cameraCardView!!.scaleX; val smooth = curr + (scale - curr) * 0.4f
                        cameraCardView!!.scaleX = smooth; cameraCardView!!.scaleY = smooth
                    }
                } catch(e:Exception){}
                audioHandler.postDelayed(this, 30) // 30ms lebih ringan daripada 25ms
            }
        }
        audioHandler.post(visualizerRunnable!!)
    }

    fun stopVisualizerLoop() {
        if (visualizerRunnable != null) { audioHandler.removeCallbacks(visualizerRunnable!!); visualizerRunnable = null }
        try {
            previewRecorder?.stop()
            previewRecorder?.reset()
        } catch(e:Exception){} // Ignore stop failed

        try { previewRecorder?.release() } catch(e:Exception){}
        previewRecorder = null

        visualizerView?.updateAmplitude(0)
        cameraCardView?.scaleX = 1.0f; cameraCardView?.scaleY = 1.0f
    }
}