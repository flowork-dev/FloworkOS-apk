// File: app/src/main/java/com/flowork/gui/EngineActivity.kt
package com.flowork.gui

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.DownloadManager
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.provider.Settings
import android.util.Base64
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.flowork.os.FloatingControlService
import com.flowork.os.R
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileOutputStream

class EngineActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var mediaProjectionManager: MediaProjectionManager

    // --- VARIABEL UPLOAD ---
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var isMenuActionPending = false

    // --- VARIABEL DOWNLOAD CHUNK (Optimized) ---
    private var tempDownloadFile: File? = null
    private var tempDownloadStream: BufferedOutputStream? = null
    private var currentDownloadMime = "application/octet-stream"
    private var currentDownloadName = "downloaded_file"

    // --- PERMISSION HANDLERS ---
    private var pendingPermissionRequest: PermissionRequest? = null
    private var pendingGeolocationCallback: GeolocationPermissions.Callback? = null
    private var pendingGeolocationOrigin: String? = null

    // [DITAMBAHKAN] Variabel untuk menampung View Fullscreen Video/Iframe
    private var customView: android.view.View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null

    private val webViewPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val granted = permissions.entries.all { it.value }
        if (granted) {
            pendingPermissionRequest?.grant(pendingPermissionRequest?.resources)
        } else {
            pendingPermissionRequest?.deny()
            Toast.makeText(this, "Izin WebView ditolak.", Toast.LENGTH_SHORT).show()
        }
        pendingPermissionRequest = null
    }

    private val webViewLocationLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val granted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        pendingGeolocationCallback?.invoke(pendingGeolocationOrigin, granted, false)
        pendingGeolocationCallback = null
    }

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val data = result.data
            var results: Array<Uri>? = null

            if (data != null) {
                if (data.clipData != null) {
                    val count = data.clipData!!.itemCount
                    results = Array(count) { i ->
                        data.clipData!!.getItemAt(i).uri
                    }
                } else if (data.data != null) {
                    results = arrayOf(data.data!!)
                }
            }

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
            if (isMenuActionPending) checkRuntimePermissions(false) else startRecordingFlow()
        } else {
            Toast.makeText(this, "Izin Overlay Wajib Diberikan!", Toast.LENGTH_SHORT).show()
            isMenuActionPending = false
        }
    }

    private val runtimePermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val camera = permissions[Manifest.permission.CAMERA] ?: false
        val audio = permissions[Manifest.permission.RECORD_AUDIO] ?: false

        if (camera && audio) {
            if (isMenuActionPending) {
                startFloatingMenuService()
                isMenuActionPending = false
            } else {
                requestScreenCapturePermission()
            }
        } else {
            Toast.makeText(this, "Wajib izinkan Kamera & Mic!", Toast.LENGTH_LONG).show()
            isMenuActionPending = false
        }
    }

    private val screenCaptureLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK && result.data != null) {
            startFloatingService(result.resultCode, result.data!!)
        } else {
            Toast.makeText(this, "Izin Rekam Layar Ditolak", Toast.LENGTH_SHORT).show()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        WindowCompat.setDecorFitsSystemWindows(window, false)
        hideSystemUI()

        setContentView(R.layout.activity_engine)

        mediaProjectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        val logicUrl = intent.getStringExtra("LOGIC_URL") ?: ""
        val appName = intent.getStringExtra("APP_NAME") ?: "Flowork App"

        webView = findViewById(R.id.webViewEngine)

        // [ADDED - FIX SCROLL] Menerapkan Padding agar tidak nabrak dan bisa di-scroll mentok bawah
        ViewCompat.setOnApplyWindowInsetsListener(webView) { view, windowInsets ->
            val insets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(0, insets.top, 0, insets.bottom)
            WindowInsetsCompat.CONSUMED
        }

        setupWebViewSettings()
        setupDownloadListener()

        webView.webChromeClient = getCustomWebChromeClient()
        webView.webViewClient = getCustomWebViewClient()

        webView.addJavascriptInterface(WebAppInterface(this), "Android")

        val encodedUrl = Uri.encode(logicUrl)
        val encodedName = Uri.encode(appName)
        val localEngineUrl = "file:///android_asset/engine.html?src=$encodedUrl&name=$encodedName"
        webView.loadUrl(localEngineUrl)
    }

    private fun hideSystemUI() {
        val windowInsetsController = WindowCompat.getInsetsController(window, window.decorView)
        windowInsetsController.hide(WindowInsetsCompat.Type.systemBars())
        windowInsetsController.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            hideSystemUI()
        }
    }

    private fun setupWebViewSettings() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            allowContentAccess = true

            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

            useWideViewPort = true
            loadWithOverviewMode = true
            setGeolocationEnabled(true)

            // [ADDED - FIX ZOOM] Mengizinkan Cubit untuk Zoom in/out
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false

            // [DITAMBAHKAN] Autoplay Video tanpa perlu interaksi (klik) dari user
            mediaPlaybackRequiresUserGesture = false

            @Suppress("DEPRECATION")
            allowUniversalAccessFromFileURLs = true
            @Suppress("DEPRECATION")
            allowFileAccessFromFileURLs = true
            @Suppress("DEPRECATION")
            databaseEnabled = true

            javaScriptCanOpenWindowsAutomatically = true

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                safeBrowsingEnabled = true
            }
            // [DIUBAH] Gunakan LOAD_DEFAULT (Kode Lama)
            // cacheMode = WebSettings.LOAD_DEFAULT
            // [DITAMBAHKAN] Eksekusi Ide: Cache Forever sampai di-clear manual
            cacheMode = WebSettings.LOAD_CACHE_ELSE_NETWORK
        }
        webView.setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null)

        // [DITAMBAHKAN] Izinkan Cookie lintas sumber untuk memperlancar iframe, video streaming, dan API
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)
    }

    private fun getCustomWebViewClient() = object : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
            val url = request?.url.toString()
            if (url.contains("flowork.cloud") || url.contains("flowork.ai")) {
                return false
            }
            if (url.startsWith("http") || url.startsWith("https")) {
                try {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                    startActivity(intent)
                    return true
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
            return false
        }

        override fun onPageFinished(view: WebView?, url: String?) {
            super.onPageFinished(view, url)
            if (url != null && !url.contains("engine.html")) {
                if (Settings.canDrawOverlays(this@EngineActivity)) {
                    startFloatingMenuService()
                }
            }
        }
    }

    private fun setupDownloadListener() {
        webView.setDownloadListener { url, userAgent, contentDisposition, mimetype, _ ->
            try {
                when {
                    url.startsWith("blob:") -> {
                        val js = """
                            var xhr = new XMLHttpRequest();
                            xhr.open('GET', '$url', true);
                            xhr.responseType = 'blob';
                            xhr.onload = function(e) {
                                if (this.status == 200) {
                                    var reader = new FileReader();
                                    reader.onload = function(e) {
                                        Android.appendChunk(reader.result.split(',')[1]);
                                        Android.finishChunkDownload();
                                    };
                                    reader.readAsDataURL(this.response);
                                }
                            };
                            xhr.send();
                        """.trimIndent()
                        webView.evaluateJavascript("Android.startChunkDownload('blob_download', '$mimetype'); $js", null)
                        Toast.makeText(this, "Processing Blob Download...", Toast.LENGTH_SHORT).show()
                    }
                    url.startsWith("data:") -> {
                        handleDataUriDownload(url, mimetype)
                    }
                    else -> {
                        val request = DownloadManager.Request(Uri.parse(url))
                        request.setMimeType(mimetype)
                        val cookies = CookieManager.getInstance().getCookie(url)
                        request.addRequestHeader("cookie", cookies)
                        request.addRequestHeader("User-Agent", userAgent)
                        request.setDescription("Downloading file...")
                        val filename = URLUtil.guessFileName(url, contentDisposition, mimetype)
                        request.setTitle(filename)
                        request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                        request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename)
                        val dm = getSystemService(DOWNLOAD_SERVICE) as DownloadManager
                        dm.enqueue(request)
                        Toast.makeText(this, "Downloading $filename...", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                Toast.makeText(this, "Download Error: ${e.message}", Toast.LENGTH_SHORT).show()
                e.printStackTrace()
            }
        }
    }

    private fun getCustomWebChromeClient() = object : WebChromeClient() {

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
            webView.visibility = android.view.View.GONE
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

        override fun onPermissionRequest(request: PermissionRequest?) {
            if (request == null) return
            val resources = request.resources
            val permissionsNeeded = mutableListOf<String>()

            resources.forEach { r ->
                if (r == PermissionRequest.RESOURCE_VIDEO_CAPTURE) permissionsNeeded.add(Manifest.permission.CAMERA)
                if (r == PermissionRequest.RESOURCE_AUDIO_CAPTURE) permissionsNeeded.add(Manifest.permission.RECORD_AUDIO)
            }

            if (permissionsNeeded.isNotEmpty()) {
                val missing = permissionsNeeded.filter {
                    ContextCompat.checkSelfPermission(this@EngineActivity, it) != PackageManager.PERMISSION_GRANTED
                }

                if (missing.isEmpty()) {
                    request.grant(resources)
                } else {
                    pendingPermissionRequest = request
                    webViewPermissionLauncher.launch(missing.toTypedArray())
                }
            } else {
                request.grant(resources)
            }
        }

        override fun onGeolocationPermissionsShowPrompt(origin: String?, callback: GeolocationPermissions.Callback?) {
            val hasFine = ContextCompat.checkSelfPermission(this@EngineActivity, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            val hasCoarse = ContextCompat.checkSelfPermission(this@EngineActivity, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

            if (hasFine || hasCoarse) {
                callback?.invoke(origin, true, false)
            } else {
                pendingGeolocationCallback = callback
                pendingGeolocationOrigin = origin
                webViewLocationLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
            }
        }

        override fun onShowFileChooser(webView: WebView?, filePathCallback: ValueCallback<Array<Uri>>?, fileChooserParams: FileChooserParams?): Boolean {
            this@EngineActivity.filePathCallback = filePathCallback
            val intent = fileChooserParams?.createIntent()
            if (intent != null) fileChooserLauncher.launch(intent) else return false
            return true
        }
    }

    private fun handleDataUriDownload(dataUrl: String, mimeType: String) {
        val delimiter = "base64,"
        val imageIdx = dataUrl.indexOf(delimiter)
        if (imageIdx != -1) {
            val base64Data = dataUrl.substring(imageIdx + delimiter.length)
            val finalMime = if (mimeType.isEmpty() || mimeType == "null") {
                dataUrl.substring(0, imageIdx).substringAfter("data:").substringBefore(";")
            } else mimeType

            val extension = when {
                finalMime.contains("png") -> ".png"
                finalMime.contains("jpeg") -> ".jpg"
                finalMime.contains("pdf") -> ".pdf"
                finalMime.contains("html") -> ".html"
                finalMime.contains("json") -> ".json"
                else -> ".bin"
            }

            val filename = "download_${System.currentTimeMillis()}$extension"
            val tempFile = File(cacheDir, filename)

            try {
                val bytes = Base64.decode(base64Data, Base64.DEFAULT)
                tempFile.writeBytes(bytes)
                saveToMediaStore(tempFile, filename, finalMime)
                Toast.makeText(this, "Download Selesai: $filename", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Toast.makeText(this, "Gagal Data URI: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun saveToMediaStore(file: File, filename: String, mimeType: String) {
        if (!file.exists()) return
        val resolver = contentResolver
        val contentValues = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, filename)
            put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
            put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
        }

        try {
            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
            if (uri != null) {
                resolver.openOutputStream(uri).use { output ->
                    file.inputStream().use { input -> input.copyTo(output!!) }
                }
                file.delete()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(this, "Gagal simpan ke Galeri: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    inner class WebAppInterface(private val context: Context) {
        @JavascriptInterface
        fun goHome() { finish() }

        @JavascriptInterface
        fun toggleRecording() { runOnUiThread { startRecordingFlow() } }

        @JavascriptInterface
        fun toggleMenu() { runOnUiThread { startMenuFlow() } }

        @JavascriptInterface
        fun openInBrowser(url: String) {
            try {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent)
            } catch (e: Exception) {
                e.printStackTrace()
                Toast.makeText(context, "Gagal membuka browser: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }

        @JavascriptInterface
        fun startChunkDownload(filename: String, mimeType: String) {
            try {
                val sanitizedName = File(filename).name
                currentDownloadName = if (sanitizedName.isNotEmpty()) sanitizedName else "downloaded_file"
                currentDownloadMime = mimeType
                tempDownloadFile = File(cacheDir, "temp_${System.currentTimeMillis()}")
                tempDownloadStream = BufferedOutputStream(FileOutputStream(tempDownloadFile))
            } catch (e: Exception) { e.printStackTrace() }
        }

        @JavascriptInterface
        fun appendChunk(base64Chunk: String) {
            try {
                if (tempDownloadStream != null) {
                    val decodedBytes = Base64.decode(base64Chunk, Base64.NO_WRAP)
                    tempDownloadStream?.write(decodedBytes)
                }
            } catch (e: Exception) { e.printStackTrace() }
        }

        @JavascriptInterface
        fun finishChunkDownload() {
            try {
                tempDownloadStream?.flush()
                tempDownloadStream?.close()
                tempDownloadStream = null

                if (tempDownloadFile != null && tempDownloadFile!!.exists()) {
                    runOnUiThread {
                        saveToMediaStore(tempDownloadFile!!, currentDownloadName, currentDownloadMime)
                        Toast.makeText(context, "Download Selesai: $currentDownloadName", Toast.LENGTH_LONG).show()
                    }
                }
            } catch (e: Exception) {
                runOnUiThread {
                    Toast.makeText(context, "Gagal Simpan: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
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

    fun startRecordingFlow() {
        isMenuActionPending = false
        if (!Settings.canDrawOverlays(this)) { requestOverlayPermission(); return }
        checkRuntimePermissions(true)
    }

    fun startMenuFlow() {
        isMenuActionPending = true
        if (!Settings.canDrawOverlays(this)) { requestOverlayPermission(); return }
        checkRuntimePermissions(false)
    }

    private fun requestOverlayPermission() {
        val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))
        overlayPermissionLauncher.launch(intent)
    }

    private fun checkRuntimePermissions(forRecording: Boolean) {
        val permissionsToRequest = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED)
            permissionsToRequest.add(Manifest.permission.ACCESS_FINE_LOCATION)
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED)
            permissionsToRequest.add(Manifest.permission.ACCESS_COARSE_LOCATION)

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED)
            permissionsToRequest.add(Manifest.permission.CAMERA)
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED)
            permissionsToRequest.add(Manifest.permission.RECORD_AUDIO)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
                permissionsToRequest.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        if (permissionsToRequest.isNotEmpty()) {
            runtimePermissionLauncher.launch(permissionsToRequest.toTypedArray())
        } else {
            if (forRecording) requestScreenCapturePermission() else startFloatingMenuService()
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
        startService(intent)
    }

    private fun startFloatingService(resultCode: Int, data: Intent) {
        val intent = Intent(this, FloatingControlService::class.java).apply {
            action = "ACTION_START_WITH_PERMISSION"
            putExtra("KEY_RESULT_CODE", resultCode)
            putExtra("KEY_DATA", data)
            putExtra("KEY_QUALITY", "720p")
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(intent) else startService(intent)
    }
}