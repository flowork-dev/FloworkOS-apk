package com.flowork.os

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.appcompat.app.AppCompatActivity
import com.flowork.gui.MainActivity // Pastikan import MainActivity sesuai package
import java.net.HttpURLConnection
import java.net.URL
import java.io.BufferedReader
import java.io.InputStreamReader
import kotlin.concurrent.thread

@SuppressLint("CustomSplashScreen")
class SplashActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_splash)

        // 1. Jalankan Pre-Fetch Data di Background Thread (Biar UI gak macet)
        thread {
            try {
                // URL Target
                val url = URL("https://flowork.cloud/mobile/registry.json?v=${System.currentTimeMillis()}")

                // Buka Koneksi
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "GET"
                conn.connectTimeout = 3000 // Max 3 detik
                conn.readTimeout = 3000

                if (conn.responseCode == 200) {
                    // Baca Data
                    val reader = BufferedReader(InputStreamReader(conn.inputStream))
                    val response = StringBuilder()
                    var line: String?
                    while (reader.readLine().also { line = it } != null) {
                        response.append(line)
                    }
                    reader.close()

                    // SIMPAN DATA KE PREFERENCES (Memori Sementara)
                    val sharedPref = getSharedPreferences("FLOWORK_CACHE", Context.MODE_PRIVATE)
                    with(sharedPref.edit()) {
                        putString("PRELOADED_REGISTRY", response.toString())
                        putLong("PRELOADED_TIME", System.currentTimeMillis())
                        apply()
                    }
                    // android.util.Log.d("FloworkSplash", "Data pre-fetched successfully!")
                }
            } catch (e: Exception) {
                e.printStackTrace()
                // Kalau gagal (offline), gak masalah. Nanti EngineActivity yang handle.
            }
        }

        // 2. Timer Splash Screen (Tetap jalan normal)
        Handler(Looper.getMainLooper()).postDelayed({
            // Pindah ke MainActivity (Launcher)
            val intent = Intent(this, MainActivity::class.java)
            startActivity(intent)
            finish() // Matikan Splash agar tidak bisa di-back
        }, 2500) // Durasi 2.5 detik (Cukup buat fetch JSON)
    }
}