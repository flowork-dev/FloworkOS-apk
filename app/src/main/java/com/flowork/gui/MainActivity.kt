// File: app/src/main/java/com/flowork/gui/MainActivity.kt
package com.flowork.gui

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.flowork.os.FloatingControlService
import com.flowork.os.R

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var mediaProjectionManager: MediaProjectionManager

    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    // Flag untuk mengetahui apakah user menekan tombol Menu atau Record
    private var isMenuActionPending = false

    // [BARU] VARIABEL PENAHAN IZIN WEBVIEW
    private var pendingPermissionRequest: PermissionRequest? = null
    private var pendingGeolocationCallback: GeolocationPermissions.Callback? = null
    private var pendingGeolocationOrigin: String? = null

    // [DITAMBAHKAN] Variabel untuk menampung View Fullscreen Video/Iframe
    private var customView: android.view.View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null

    // [BARU] LAUNCHER KHUSUS IZIN KAMERA/MIC DARI WEBVIEW
    private val webViewPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        var allGranted = true
        for (granted in permissions.values) {
            if (!granted) allGranted = false
        }

        if (allGranted && pendingPermissionRequest != null) {
            pendingPermissionRequest?.grant(pendingPermissionRequest?.resources)
        } else {
            pendingPermissionRequest?.deny()
            Toast.makeText(this, "Izin WebView ditolak, fitur (Kamera/Mic) tidak dapat digunakan.", Toast.LENGTH_SHORT).show()
        }
        pendingPermissionRequest = null
    }

    // [BARU] LAUNCHER KHUSUS IZIN LOKASI DARI WEBVIEW
    private val webViewLocationLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val granted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                      permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true

        if (granted && pendingGeolocationCallback != null) {
            pendingGeolocationCallback?.invoke(pendingGeolocationOrigin, true, false)
        } else {
            pendingGeolocationCallback?.invoke(pendingGeolocationOrigin, false, false)
            Toast.makeText(this, "Izin lokasi WebView ditolak.", Toast.LENGTH_SHORT).show()
        }
        pendingGeolocationCallback = null
    }


    // [BARU] Launcher untuk mengambil gambar avatar dari galeri
    private val avatarPickerLauncher = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            // Kirim URI gambar ke Floating Service
            val intent = Intent(this, FloatingControlService::class.java).apply {
                action = "ACTION_SET_AVATAR"
                data = uri
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            startService(intent)
            Toast.makeText(this, "Avatar Updated!", Toast.LENGTH_SHORT).show()
        }
    }

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            val data = result.data
            val results = if (data?.data != null) arrayOf(data.data!!) else null
            filePathCallback?.onReceiveValue(results)
        } else {
            filePathCallback?.onReceiveValue(null)
        }
        filePathCallback = null
    }

    private val overlayPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) {
        if (Settings.canDrawOverlays(this)) {
            if (isMenuActionPending) {
                checkRuntimePermissions(false)
            } else {
                startRecordingFlow()
            }
        } else {
            Toast.makeText(this, "Izin Overlay Wajib!", Toast.LENGTH_SHORT).show()
            isMenuActionPending = false
        }
    }

    private val runtimePermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val cameraGranted = permissions[Manifest.permission.CAMERA] ?: false
        val audioGranted = permissions[Manifest.permission.RECORD_AUDIO] ?: false

        if (cameraGranted && audioGranted) {
            if (isMenuActionPending) {
                startFloatingMenuService()
                isMenuActionPending = false
            } else {
                requestScreenCapturePermission()
            }
        } else {
            Toast.makeText(this, "Izin Kamera & Mic Ditolak!", Toast.LENGTH_LONG).show()
            isMenuActionPending = false
        }
    }

    private val screenCaptureLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK && result.data != null) {
            startFloatingService(result.resultCode, result.data!!)
        } else {
            Toast.makeText(this, "Izin Screen Record Ditolak", Toast.LENGTH_SHORT).show()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        mediaProjectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        webView = findViewById(R.id.webViewHome)

        // [FIX UTAMA + EXTRA PADDING]
        ViewCompat.setOnApplyWindowInsetsListener(webView) { view, windowInsets ->
            val insets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars())

            // Konversi 40dp ke Pixel agar proporsional di semua layar
            val density = resources.displayMetrics.density
            val extraPadding = (40 * density).toInt()

            // Total Padding = Tinggi Navigasi Bawaan HP + 40dp Tambahan
            view.setPadding(0, 0, 0, insets.bottom + extraPadding)
            WindowInsetsCompat.CONSUMED
        }

        setupWebView()
        handleIncomingIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIncomingIntent(intent)
    }

    private fun handleIncomingIntent(intent: Intent?) {
        if (intent?.action == "ACTION_REQUEST_SCREEN_CAPTURE") {
            startRecordingFlow()
        }
        // [BARU] Handle request buka galeri dari Floating Button
        else if (intent?.action == "ACTION_PICK_AVATAR") {
             avatarPickerLauncher.launch("image/*")
        }
    }

    private fun setupWebView() {
        // [DITAMBAHKAN] Akselerasi Hardware secara eksplisit agar render ngacir
        webView.setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            // databaseEnabled = true // [DIHAPUS] Deprecated
            allowFileAccess = true
            allowContentAccess = true
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            useWideViewPort = true
            loadWithOverviewMode = true

            // [DIUBAH] Gunakan LOAD_DEFAULT agar WebView menyimpan cache gambar/assets (Kode Lama)
            // cacheMode = WebSettings.LOAD_DEFAULT
            // [DITAMBAHKAN] Eksekusi Ide: Cache Forever sampai di-clear manual
            cacheMode = WebSettings.LOAD_CACHE_ELSE_NETWORK

            setGeolocationEnabled(true)

            // [DITAMBAHKAN] Autoplay Video tanpa perlu interaksi (klik) dari user
            mediaPlaybackRequiresUserGesture = false
        }

        // [DITAMBAHKAN] Izinkan Cookie lintas sumber untuk memperlancar iframe, video streaming, dan API
        android.webkit.CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        webView.webViewClient = WebViewClient()
        webView.webChromeClient = object : WebChromeClient() {

            // [DITAMBAHKAN] Logic untuk render HTML5 Video Player / Iframe dalam mode Fullscreen
            override fun onShowCustomView(view: android.view.View?, callback: CustomViewCallback?) {
                if (customView != null) {
                    callback?.onCustomViewHidden()
                    return
                }
                customView = view
                customViewCallback = callback
                val decorView = window.decorView as android.widget.FrameLayout
                decorView.addView(customView, android.widget.FrameLayout.LayoutParams(
                    android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                    android.view.ViewGroup.LayoutParams.MATCH_PARENT
                ))
                webView.visibility = android.view.View.GONE // Sembunyikan webview sementara agar fokus ke video
            }

            // [DITAMBAHKAN] Logic untuk kembali dari mode Fullscreen
            override fun onHideCustomView() {
                if (customView == null) return
                val decorView = window.decorView as android.widget.FrameLayout
                decorView.removeView(customView)
                customView = null
                customViewCallback?.onCustomViewHidden()
                webView.visibility = android.view.View.VISIBLE
            }

            // [FIX MAJOR] CEGAT REQUEST PERMISSION CAMERA/MIC DARI WEBVIEW
            override fun onPermissionRequest(request: PermissionRequest?) {
                if (request == null) return
                val requestedResources = request.resources
                val androidPermissions = mutableListOf<String>()

                for (r in requestedResources) {
                    if (r == PermissionRequest.RESOURCE_VIDEO_CAPTURE) {
                        androidPermissions.add(Manifest.permission.CAMERA)
                    }
                    if (r == PermissionRequest.RESOURCE_AUDIO_CAPTURE) {
                        androidPermissions.add(Manifest.permission.RECORD_AUDIO)
                    }
                }

                if (androidPermissions.isNotEmpty()) {
                    val needToRequest = androidPermissions.filter {
                        ContextCompat.checkSelfPermission(this@MainActivity, it) != PackageManager.PERMISSION_GRANTED
                    }

                    if (needToRequest.isEmpty()) {
                        // Jika OS sudah punya izin, langsung jalankan
                        runOnUiThread { request.grant(requestedResources) }
                    } else {
                        // Minta izin ke OS Android dulu
                        pendingPermissionRequest = request
                        webViewPermissionLauncher.launch(needToRequest.toTypedArray())
                    }
                } else {
                    runOnUiThread { request.grant(requestedResources) }
                }
            }

            // [FIX MAJOR] CEGAT REQUEST LOKASI DARI WEBVIEW
            override fun onGeolocationPermissionsShowPrompt(origin: String?, callback: GeolocationPermissions.Callback?) {
                val hasFine = ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                val hasCoarse = ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

                if (hasFine || hasCoarse) {
                    callback?.invoke(origin, true, false)
                } else {
                    pendingGeolocationCallback = callback
                    pendingGeolocationOrigin = origin
                    webViewLocationLauncher.launch(arrayOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                    ))
                }
            }

            override fun onShowFileChooser(webView: WebView?, filePathCallback: ValueCallback<Array<Uri>>?, fileChooserParams: FileChooserParams?): Boolean {
                this@MainActivity.filePathCallback = filePathCallback
                val intent = fileChooserParams?.createIntent()
                if (intent != null) fileChooserLauncher.launch(intent) else return false
                return true
            }
        }
        webView.addJavascriptInterface(HomeInterface(this), "Android")
        webView.loadUrl("file:///android_asset/engine.html")
    }

    fun startRecordingFlow() {
        isMenuActionPending = false
        if (!Settings.canDrawOverlays(this)) {
            requestOverlayPermission()
            return
        }
        checkRuntimePermissions(true)
    }

    fun startMenuFlow() {
        isMenuActionPending = true
        if (!Settings.canDrawOverlays(this)) {
            requestOverlayPermission()
            return
        }
        checkRuntimePermissions(false)
    }

    private fun requestOverlayPermission() {
        val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))
        overlayPermissionLauncher.launch(intent)
    }

    private fun checkRuntimePermissions(forRecording: Boolean) {
        val permissions = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) permissions.add(Manifest.permission.CAMERA)
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) permissions.add(Manifest.permission.RECORD_AUDIO)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) permissions.add(Manifest.permission.POST_NOTIFICATIONS)

        if (permissions.isNotEmpty()) {
            runtimePermissionLauncher.launch(permissions.toTypedArray())
        } else {
            if (forRecording) {
                requestScreenCapturePermission()
            } else {
                startFloatingMenuService()
            }
        }
    }

    private fun requestScreenCapturePermission() {
        val captureIntent = mediaProjectionManager.createScreenCaptureIntent()
        screenCaptureLauncher.launch(captureIntent)
    }

    private fun startFloatingMenuService() {
        val intent = Intent(this, FloatingControlService::class.java).apply {
            action = "ACTION_TOGGLE_MENU_VISIBILITY"
        }
        // FIX: Menggunakan startForegroundService untuk konsistensi dengan service recording
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(intent) else startService(intent)
    }

    private fun startFloatingService(code: Int, data: Intent) {
        val intent = Intent(this, FloatingControlService::class.java).apply {
            action = "ACTION_START_WITH_PERMISSION"
            putExtra("KEY_RESULT_CODE", code)
            putExtra("KEY_DATA", data)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(intent) else startService(intent)
    }

    inner class HomeInterface(private val context: Context) {
        @JavascriptInterface
        fun toggleMenu() {
            runOnUiThread {
                startMenuFlow()
            }
        }

        // [BARU] Interface JS jika mau panggil picker dari web
        @JavascriptInterface
        fun pickAvatarImage() {
            runOnUiThread {
                avatarPickerLauncher.launch("image/*")
            }
        }

        @JavascriptInterface
        fun goHome() {
            runOnUiThread {
                webView.clearHistory()
                webView.reload()
            }
        }

        @JavascriptInterface fun launchApp(url: String, name: String) {
            val intent = Intent(context, EngineActivity::class.java)
            intent.putExtra("LOGIC_URL", url); intent.putExtra("APP_NAME", name)
            startActivity(intent)
        }
        @JavascriptInterface fun downloadBlobBase64(base64Data: String, mimeType: String) {
        }

        // [DITAMBAHKAN] Fungsi Clear Cache OS via JS
        @JavascriptInterface
        fun clearAndroidCache() {
            runOnUiThread {
                webView.clearCache(true)
                android.webkit.CookieManager.getInstance().removeAllCookies(null)
                android.webkit.WebStorage.getInstance().deleteAllData()
                Toast.makeText(context, "Sistem Cache Dibersihkan!", Toast.LENGTH_SHORT).show()
            }
        }
    }
}