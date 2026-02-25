// File: app/src/main/java/com/flowork/os/FloatingControlService.kt
package com.flowork.os

import android.Manifest
import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.widget.Toast
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.flowork.gui.MainActivity
import com.flowork.os.module.CameraOverlayManager
import com.flowork.os.module.DrawOverlayManager
import com.flowork.os.module.FloatingMenuManager
import com.flowork.os.module.ScreenRecorderEngine

class FloatingControlService : Service(), FloatingMenuManager.MenuCallbacks {

    private lateinit var recorderEngine: ScreenRecorderEngine
    private lateinit var cameraManager: CameraOverlayManager
    private lateinit var menuManager: FloatingMenuManager
    private lateinit var drawManager: DrawOverlayManager

    private var resultCode: Int = 0
    private var resultData: Intent? = null
    private var selectedQuality = "720p"

    private var currentThemeIndex = 0
    private val themes = listOf(
        "NORMAL", "HACKER", "REACTOR", "MATRIX", "ILLUMINATI",
        "PARTY", "GHOST", "NEON_PULSE", "HEXAGON", "FIRESTORM",
        "WAVE", "STARBURST", "RADAR", "EQUALIZER", "GLITCH",
        "SONIC_RING", "PORTAL", "HEARTBEAT", "SNOW", "BARCODE",
        "RGB_SPLIT", "SUN", "VOID", "TARGET", "ELECTRIC",
        "RAINBOW_ROAD", "CYBER_GRID", "BINARY_STREAM", "PLASMA_GLOBE", "RETRO_SYNTH"
    )

    companion object {
        private const val NOTIFICATION_CHANNEL_ID = "flowork_rec"
        private const val NOTIFICATION_ID = 101
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        try {
            createNotificationChannel()
            startSafeForeground(isRecording = false, forceMic = false)

            recorderEngine = ScreenRecorderEngine(this)
            cameraManager = CameraOverlayManager(this)
            menuManager = FloatingMenuManager(this, this)
            drawManager = DrawOverlayManager(this) { menuManager.setDrawingState(false) }

            menuManager.toggleVisibility()

            if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                cameraManager.show(null) {
                    onCamToggle(false)
                    menuManager.updateIcons()
                }
            } else {
                cameraManager.show(null) {
                    onCamToggle(false)
                    menuManager.updateIcons()
                }
                // [FIX] Gunakan setter fungsi, bukan assignment langsung
                menuManager.setMicState(false)
            }
        } catch (e: Exception) {
            e.printStackTrace()
            stopSelf()
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent == null) return START_STICKY

        when (intent.action) {
            "ACTION_START_WITH_PERMISSION" -> {
                resultCode = intent.getIntExtra("KEY_RESULT_CODE", Activity.RESULT_CANCELED)
                selectedQuality = intent.getStringExtra("KEY_QUALITY") ?: "720p"
                resultData = if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra("KEY_DATA", Intent::class.java) else @Suppress("DEPRECATION") intent.getParcelableExtra("KEY_DATA")

                if (resultData != null && !recorderEngine.isRecording) {
                    menuManager.initiateRecordingSequence()
                }
            }
            "ACTION_TOGGLE_MENU_VISIBILITY" -> {
                menuManager.toggleVisibility()
                val hasMic = ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
                if (hasMic && menuManager.isMicOn) cameraManager.startVisualizerLoop() else cameraManager.stopVisualizerLoop()
            }
            "ACTION_SET_AVATAR" -> {
                val uri = intent.data ?: (if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra("data", Uri::class.java) else @Suppress("DEPRECATION") intent.getParcelableExtra("data") as? Uri)
                if (uri != null) {
                    menuManager.isAvatarMode = true
                    menuManager.updateIcons()
                    cameraManager.show(uri) {}
                }
            }
            "ACTION_STOP_SERVICE" -> stopSelf()
        }
        return START_STICKY
    }

    override fun onMicToggle(isOn: Boolean) {
        val hasPermission = ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

        if (isOn && !hasPermission) {
            Toast.makeText(this, "Izin Mic belum diberikan!", Toast.LENGTH_SHORT).show()
            // [FIX] Gunakan setter fungsi
            menuManager.setMicState(false)
            menuManager.updateIcons()
            return
        }

        cameraManager.updateState(menuManager.isCamOn, menuManager.isAvatarMode, isOn)
        startSafeForeground(recorderEngine.isRecording, isOn)
    }

    override fun onCamToggle(isOn: Boolean) {
        menuManager.isAvatarMode = false
        cameraManager.updateState(isOn, false, menuManager.isMicOn)
        startSafeForeground(recorderEngine.isRecording, menuManager.isMicOn)
    }

    override fun onSwitchCamera() { cameraManager.switchCamera() }
    override fun onMaximizeToggle() { val isFull = cameraManager.toggleFullscreen(); menuManager.setFullscreenState(isFull) }
    override fun onThemeChange() {
        currentThemeIndex = (currentThemeIndex + 1) % themes.size
        cameraManager.setTheme(themes[currentThemeIndex])
    }

    override fun onDrawToggle() {
        if (drawManager.isDrawing) {
            drawManager.stopDrawing(); menuManager.setDrawingState(false)
        } else {
            drawManager.startDrawing(); menuManager.setDrawingState(true)
        }
    }

    override fun onRecordToggle() {
        if (recorderEngine.isRecording) {
            recorderEngine.stop()
            resultData = null; resultCode = 0
            menuManager.setRecordingState(false)
            startSafeForeground(isRecording = false, forceMic = menuManager.isMicOn)
            cameraManager.startVisualizerLoop()
        } else {
            if (resultData == null) {
                val i = Intent(this, MainActivity::class.java).apply { flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP; action = "ACTION_REQUEST_SCREEN_CAPTURE" }
                startActivity(i)
            } else {
                menuManager.initiateRecordingSequence()
            }
        }
    }

    override fun onStartRecording() {
        if (resultData != null) {
            cameraManager.stopVisualizerLoop()
            startSafeForeground(isRecording = true, forceMic = menuManager.isMicOn)
            recorderEngine.start(resultCode, resultData!!, selectedQuality, menuManager.isMicOn) {
                menuManager.setRecordingState(false)
                startSafeForeground(isRecording = false, forceMic = menuManager.isMicOn)
                resultData = null; resultCode = 0
            }
            menuManager.setRecordingState(true)
            cameraManager.startVisualizerLoop()
        }
    }

    private fun startSafeForeground(isRecording: Boolean, forceMic: Boolean) {
        val notif = buildNotification(isRecording)
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                var type = 0
                if (isRecording) {
                    type = ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
                    if (Build.VERSION.SDK_INT >= 30) {
                        if (forceMic && ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                            type = type or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
                        }
                        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                            type = type or ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
                        }
                    }
                } else {
                    if (Build.VERSION.SDK_INT >= 30 && forceMic && ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                        type = ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
                    } else if (Build.VERSION.SDK_INT >= 34) {
                        type = ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
                    }
                }
                startForeground(NOTIFICATION_ID, notif, type)
            } else {
                startForeground(NOTIFICATION_ID, notif)
            }
        } catch (e: Exception) {
            try { startForeground(NOTIFICATION_ID, notif) } catch (e2: Exception) { stopSelf() }
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(NOTIFICATION_CHANNEL_ID, "Flowork Overlay", NotificationManager.IMPORTANCE_LOW)
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun buildNotification(isRecording: Boolean): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE)
        return NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle(if (isRecording) "Recording Screen..." else "Flowork Ready")
            .setContentText("Tap to open controls")
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }

    override fun onDestroy() {
        super.onDestroy()
        try { recorderEngine.stop(); cameraManager.hide(); drawManager.stopDrawing(); menuManager.destroy() } catch (e: Exception) {}
    }
}