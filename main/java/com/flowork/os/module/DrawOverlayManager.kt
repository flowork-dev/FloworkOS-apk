// File: app/src/main/java/com/flowork/os/module/DrawOverlayManager.kt
package com.flowork.os.module

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.Toast

class DrawOverlayManager(private val context: Context, private val onClose: () -> Unit) {

    private val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private var overlayView: FrameLayout? = null
    private var brushView: BrushView? = null
    var isDrawing = false

    private inner class BrushView(context: Context) : View(context) {
        private val paint = Paint().apply {
            color = Color.YELLOW
            isAntiAlias = true
            strokeWidth = 8f // Lebih tipis dikit biar rapi
            style = Paint.Style.STROKE
            strokeJoin = Paint.Join.ROUND
            strokeCap = Paint.Cap.ROUND
        }
        private val path = Path()

        override fun onDraw(canvas: Canvas) {
            canvas.drawPath(path, paint)
        }

        override fun onTouchEvent(event: MotionEvent): Boolean {
            val x = event.x
            val y = event.y
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    path.moveTo(x, y)
                    invalidate()
                }
                MotionEvent.ACTION_MOVE -> {
                    path.lineTo(x, y)
                    invalidate()
                }
            }
            return true
        }

        fun clear() {
            path.reset()
            invalidate()
        }
    }

    fun startDrawing() {
        if (isDrawing) return
        setupLayout()
        isDrawing = true
    }

    fun stopDrawing() {
        if (!isDrawing) return
        try {
            if (overlayView != null) windowManager.removeView(overlayView)
        } catch (e: Exception) { e.printStackTrace() }
        overlayView = null
        brushView = null
        isDrawing = false
        onClose()
    }

    private fun setupLayout() {
        overlayView = FrameLayout(context)

        // 1. Layer Kanvas
        brushView = BrushView(context)
        overlayView?.addView(brushView, FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)

        // 2. Toolbar Samping (VERTIKAL)
        val toolbar = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL // Vertikal biar di samping

            // Background capsule shape semi-transparan
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#99000000"))
                cornerRadius = 30f
            }
            setPadding(10, 20, 10, 20) // Padding kecil
            gravity = Gravity.CENTER
        }

        // Ukuran Icon Kecil (35dp)
        val iconSize = 35 * context.resources.displayMetrics.density.toInt()

        // Tombol Clear (Sampah)
        val btnClear = ImageView(context).apply {
            setImageResource(android.R.drawable.ic_menu_delete)
            setColorFilter(Color.WHITE)
            setPadding(15, 15, 15, 15)
            layoutParams = LinearLayout.LayoutParams(iconSize, iconSize).apply {
                bottomMargin = 20 // Jarak antar tombol
            }
            setOnClickListener {
                brushView?.clear()
                Toast.makeText(context, "Cleared", Toast.LENGTH_SHORT).show()
            }
        }

        // Tombol Close (Silang)
        val btnClose = ImageView(context).apply {
            setImageResource(android.R.drawable.ic_menu_close_clear_cancel)
            setColorFilter(Color.parseColor("#FF5252")) // Merah soft
            setPadding(15, 15, 15, 15)
            layoutParams = LinearLayout.LayoutParams(iconSize, iconSize)
            setOnClickListener { stopDrawing() }
        }

        toolbar.addView(btnClear)
        toolbar.addView(btnClose)

        // Posisi Toolbar: KANAN TENGAH (Right Center)
        val toolbarParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT).apply {
            gravity = Gravity.END or Gravity.CENTER_VERTICAL
            rightMargin = 20 // Jarak dari pinggir layar kanan
        }
        overlayView?.addView(toolbar, toolbarParams)

        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE
        }

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            layoutType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        )

        windowManager.addView(overlayView, params)
    }
}