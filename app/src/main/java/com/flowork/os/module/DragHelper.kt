// File: app/src/main/java/com/flowork/os/module/DragHelper.kt
package com.flowork.os.module

import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import kotlin.math.abs

/**
 * Helper sederhana untuk handle Drag & Drop Floating Window
 */
object DragHelper {
    private var initialX = 0
    private var initialY = 0
    private var initialTouchX = 0f
    private var initialTouchY = 0f

    fun setup(view: View, params: WindowManager.LayoutParams, windowManager: WindowManager) {
        view.setOnTouchListener { v, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = params.x
                    initialY = params.y
                    initialTouchX = event.rawX
                    initialTouchY = event.rawY
                    return@setOnTouchListener true
                }
                MotionEvent.ACTION_MOVE -> {
                    params.x = initialX + (event.rawX - initialTouchX).toInt()
                    params.y = initialY + (event.rawY - initialTouchY).toInt()
                    try {
                        windowManager.updateViewLayout(view, params)
                    } catch (e: Exception) {
                        // Ignore jika view sudah detach
                    }
                    return@setOnTouchListener true
                }
                MotionEvent.ACTION_UP -> {
                    // Deteksi klik (jika geser sedikit dianggap klik)
                    if (abs(event.rawX - initialTouchX) < 10 && abs(event.rawY - initialTouchY) < 10) {
                        v.performClick()
                    }
                    return@setOnTouchListener true
                }
            }
            false
        }
    }
}