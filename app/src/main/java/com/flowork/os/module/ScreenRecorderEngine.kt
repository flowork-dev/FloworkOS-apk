// File: app/src/main/java/com/flowork/os/module/ScreenRecorderEngine.kt
package com.flowork.os.module

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.MediaRecorder
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.util.DisplayMetrics
import android.view.WindowManager
import android.widget.Toast
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Modul khusus untuk menangani logika perekaman layar (Low Level Logic).
 * Optimized: Error Handling yang lebih kuat, Audio Fallback, & Support Pause/Resume.
 */
class ScreenRecorderEngine(private val context: Context) {

    private var mediaProjectionManager: MediaProjectionManager = context.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    private var mediaProjection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var mediaRecorder: MediaRecorder? = null
    private var windowManager: WindowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager

    // Callback untuk Android 14+ (Wajib ada)
    private var projectionCallback: MediaProjection.Callback? = null

    // State Perekaman
    var isRecording = false
        private set
    var startTime: Long = 0
        private set

    // [BARU] State Pause
    var isPaused = false
        private set

    // Config & Resource
    private var finalWidth = 720
    private var finalHeight = 1280
    private var screenDensity = 0
    private var videoBitrate = 4000000
    private var currentVideoUri: Uri? = null

    // [OPTIMASI] Handler Main Thread untuk feedback UI yang aman
    private val mainHandler = Handler(Looper.getMainLooper())

    fun start(resultCode: Int, resultData: Intent, quality: String, isMicOn: Boolean, onStopCallback: () -> Unit) {
        try {
            calculateDynamicResolution(quality)

            // [OPTIMASI] Coba setup recorder. Jika Mic sibuk/error, fallback ke video only.
            try {
                setupMediaRecorder(isMicOn)
            } catch (e: Exception) {
                if (isMicOn) {
                    mainHandler.post {
                        Toast.makeText(context, "Mic busy/error, recording Video Only...", Toast.LENGTH_LONG).show()
                    }
                    // Coba lagi tanpa Audio
                    setupMediaRecorder(false)
                } else {
                    // Kalau tanpa audio masih error, berarti masalah di Video Encoder
                    throw e
                }
            }

            // Setup Projection
            mediaProjection = mediaProjectionManager.getMediaProjection(resultCode, resultData)

            // [OPTIMASI] Mencegah callback crash di Android 14
            projectionCallback = object : MediaProjection.Callback() {
                override fun onStop() {
                    super.onStop()
                    if (isRecording) stop()
                    onStopCallback()
                }
            }
            mediaProjection?.registerCallback(projectionCallback!!, mainHandler)

            // Create Virtual Display
            virtualDisplay = mediaProjection?.createVirtualDisplay(
                "FloworkScreen",
                finalWidth,
                finalHeight,
                screenDensity,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                mediaRecorder?.surface,
                null,
                null
            )

            // Mulai Merekam
            mediaRecorder?.start()

            isRecording = true
            isPaused = false
            startTime = System.currentTimeMillis()
            mainHandler.post { Toast.makeText(context, "REC STARTED", Toast.LENGTH_SHORT).show() }

        } catch (e: Exception) {
            // Jika gagal start, pastikan semua resource dilepas
            stop()
            e.printStackTrace()
            mainHandler.post { Toast.makeText(context, "Start Failed: ${e.message}", Toast.LENGTH_LONG).show() }
            onStopCallback()
        }
    }

    // [BARU] Fungsi Pause (Android N+)
    fun pause() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && isRecording && !isPaused) {
            try {
                mediaRecorder?.pause()
                isPaused = true
                Toast.makeText(context, "Paused", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    // [BARU] Fungsi Resume (Android N+)
    fun resume() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && isRecording && isPaused) {
            try {
                mediaRecorder?.resume()
                isPaused = false
                Toast.makeText(context, "Resumed", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun stop() {
        try {
            // [OPTIMASI] Stop VirtualDisplay DULUAN sebelum Recorder
            // Ini mencegah 'ghost frame' atau error BufferQueue di akhir video
            virtualDisplay?.release()
            virtualDisplay = null

            if (projectionCallback != null && mediaProjection != null) {
                mediaProjection?.unregisterCallback(projectionCallback!!)
                projectionCallback = null
            }

            // Stop Recorder dengan aman
            try {
                // Best Practice: Resume dulu kalau statusnya Paused sebelum stop
                if (isPaused && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    mediaRecorder?.resume()
                }
                mediaRecorder?.stop()
            } catch (e: RuntimeException) {
                // Suppress error jika stop dipanggil terlalu cepat (sebelum ada data terekam)
                // File video korup biasanya otomatis dibuang oleh OS
            }

            mediaRecorder?.reset()
            mediaRecorder?.release()
            mediaRecorder = null

            mediaProjection?.stop()
            mediaProjection = null

            // [OPTIMASI] Update status file jadi "Ready" (Android Q+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && currentVideoUri != null) {
                val cv = ContentValues().apply {
                    put(MediaStore.Video.Media.IS_PENDING, 0)
                }
                context.contentResolver.update(currentVideoUri!!, cv, null, null)
            }

        } catch (e: Exception) {
            e.printStackTrace()
        }

        isRecording = false
        isPaused = false

        if (currentVideoUri != null) {
            // Hanya jalankan Broadcast Scan manual untuk Android 9 (Pie) ke bawah.
            // Android 10+ sudah otomatis ter-scan saat IS_PENDING diset ke 0 di blok try-catch sebelumnya.
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                @Suppress("DEPRECATION")
                context.sendBroadcast(Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE, currentVideoUri))
            }

            mainHandler.post { Toast.makeText(context, "Saved to Gallery!", Toast.LENGTH_SHORT).show() }
        }
    }

    private fun setupMediaRecorder(isMicOn: Boolean) {
        // [OPTIMASI] Gunakan context constructor untuk Android S+ (Permission Attribution lebih akurat)
        mediaRecorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) MediaRecorder(context) else { @Suppress("DEPRECATION") MediaRecorder() }

        val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        val cv = ContentValues().apply {
            put(MediaStore.Video.Media.DISPLAY_NAME, "Flowork_$timestamp.mp4")
            put(MediaStore.Video.Media.MIME_TYPE, "video/mp4")
            put(MediaStore.Video.Media.RELATIVE_PATH, Environment.DIRECTORY_MOVIES)
            // [OPTIMASI] Set Pending = 1. File tidak akan discan galeri sampai kita set ke 0.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                put(MediaStore.Video.Media.IS_PENDING, 1)
            }
        }

        currentVideoUri = context.contentResolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, cv)

        // Buka FileDescriptor
        val pfd = currentVideoUri?.let { context.contentResolver.openFileDescriptor(it, "w") }
            ?: throw IOException("Gagal membuat FileDescriptor")
        val fd = pfd.fileDescriptor

        mediaRecorder?.apply {
            // URUTAN CALL METHOD SANGAT KRUSIAL DI SINI:

            // 1. Set Source
            if (isMicOn) setAudioSource(MediaRecorder.AudioSource.MIC)
            setVideoSource(MediaRecorder.VideoSource.SURFACE)

            // 2. Set Format
            setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)

            // 3. Set Output File
            setOutputFile(fd)

            // 4. Set Encoders & Config
            setVideoSize(finalWidth, finalHeight)
            setVideoEncoder(MediaRecorder.VideoEncoder.H264)

            if (isMicOn) {
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioEncodingBitRate(192000) // 192kbps (Standar High Quality)
                setAudioSamplingRate(44100)
            }

            // [OPTIMASI] Konfigurasi Video
            setVideoEncodingBitRate(videoBitrate)
            setVideoFrameRate(30)

            // Coba set Profile High jika didukung (Oreo+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                try {
                    setVideoEncodingProfileLevel(
                        android.media.MediaCodecInfo.CodecProfileLevel.AVCProfileHigh,
                        android.media.MediaCodecInfo.CodecProfileLevel.AVCLevel31
                    )
                } catch (e: Exception) {
                    // Ignore, fallback ke default profile
                }
            }

            prepare()
        }
    }

    private fun calculateDynamicResolution(quality: String) {
        val metrics = DisplayMetrics()
        val isLandscape = context.resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE

        // [OPTIMASI] Gunakan WindowMetrics untuk Android R+ (Lebih akurat handle notch/cutout)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val bounds = windowManager.currentWindowMetrics.bounds
            finalWidth = bounds.width()
            finalHeight = bounds.height()
            screenDensity = context.resources.configuration.densityDpi
        } else {
            @Suppress("DEPRECATION")
            windowManager.defaultDisplay.getRealMetrics(metrics)
            finalWidth = metrics.widthPixels
            finalHeight = metrics.heightPixels
            screenDensity = metrics.densityDpi
        }

        // Tentukan sisi pendek target
        val targetShortSide = when (quality) {
            "1080p" -> 1080
            "480p" -> 480
            else -> 720
        }

        // Tuning Bitrate
        videoBitrate = when (quality) {
            "1080p" -> 8_000_000 // 8 Mbps
            "480p" -> 2_500_000  // 2.5 Mbps
            else -> 5_000_000    // 5 Mbps
        }

        // Hitung Rasio Layar
        val width = finalWidth.toFloat()
        val height = finalHeight.toFloat()
        val ratio = if (isLandscape) width / height else height / width

        if (isLandscape) {
            finalHeight = targetShortSide
            finalWidth = (targetShortSide * ratio).toInt()
        } else {
            finalWidth = targetShortSide
            finalHeight = (targetShortSide * ratio).toInt()
        }

        // [OPTIMASI] Align ke 16 pixel.
        // Encoder video (H264) bekerja dalam blok macro 16x16.
        // Jika resolusi ganjil, seringkali muncul garis hijau atau crash.
        finalWidth = (finalWidth / 16) * 16
        finalHeight = (finalHeight / 16) * 16

        // Safety Fallback
        if (finalWidth <= 0) finalWidth = 720
        if (finalHeight <= 0) finalHeight = 1280
    }
}