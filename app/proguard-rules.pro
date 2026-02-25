# Pertahankan atribut untuk debugging jika perlu
-keepattributes SourceFile,LineNumberTable

# PENTING: Jangan ubah nama class/method yang dipanggil dari JavaScript (WebView)
# Ganti 'com.flowork.gui.EngineActivity' atau class tempat lo taruh @JavascriptInterface
-keepclassmembers class com.flowork.gui.EngineActivity$* {
    @android.webkit.JavascriptInterface <methods>;
}
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}