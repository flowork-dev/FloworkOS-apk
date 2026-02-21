// File: app/src/main/java/com/flowork/os/module/FloatingMenuManager.kt
package com.flowork.os.module

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.CountDownTimer
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import com.flowork.gui.MainActivity
import com.flowork.os.R

class FloatingMenuManager(
    private val context: Context,
    private val callbacks: MenuCallbacks
) {
    interface MenuCallbacks {
        fun onMicToggle(isOn: Boolean)
        fun onCamToggle(isOn: Boolean)
        fun onRecordToggle()
        fun onStartRecording()
        fun onThemeChange()
        fun onSwitchCamera()
        fun onMaximizeToggle()
        fun onDrawToggle()
    }

    data class UiState(
        val isMicOn: Boolean = true,
        val isCamOn: Boolean = true,
        val isRecording: Boolean = false,
        val isAvatarMode: Boolean = false,
        val isFullscreen: Boolean = false,
        val isDrawingMode: Boolean = false,
        val isPanelExpanded: Boolean = true
    )

    private val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private var menuView: View? = null
    private var countdownView: TextView? = null
    private var menuParams: WindowManager.LayoutParams? = null

    // UI Refs
    private var btnMic: ImageView? = null
    private var btnCam: ImageView? = null
    private var imgRecordIcon: ImageView? = null
    private var btnToggleHeader: View? = null
    private var imgToggleArrow: ImageView? = null
    private var panelControls: View? = null
    private var btnSwitchCam: ImageView? = null
    private var btnMaximizeCam: ImageView? = null
    private var btnDraw: ImageView? = null

    // State
    private var currentState = UiState()

    // Public Getters
    val isMicOn: Boolean get() = currentState.isMicOn
    val isCamOn: Boolean get() = currentState.isCamOn
    var isAvatarMode: Boolean
        get() = currentState.isAvatarMode
        set(value) { updateState { it.copy(isAvatarMode = value) } }

    // [FIX] Helper function untuk handle deprecated TYPE_PHONE dengan bersih
    @Suppress("DEPRECATION")
    private fun getLayoutType(): Int {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            WindowManager.LayoutParams.TYPE_PHONE
        }
    }

    // Helper: Update State & Render
    private fun updateState(reducer: (UiState) -> UiState) {
        val newState = reducer(currentState)
        if (newState != currentState) {
            currentState = newState
            render(currentState)
        }
    }

    fun setMicState(isOn: Boolean) {
        updateState { it.copy(isMicOn = isOn) }
    }

    fun setRecordingState(recording: Boolean) {
        updateState {
            val expand = if (!recording) true else it.isPanelExpanded
            it.copy(isRecording = recording, isPanelExpanded = expand)
        }
        if (!recording) {
            if (menuView == null) setupLayout()
            menuView?.visibility = View.VISIBLE
            render(currentState)
        }
    }

    fun setDrawingState(isDrawing: Boolean) {
        updateState {
            val expand = if (isDrawing) false else it.isPanelExpanded
            it.copy(isDrawingMode = isDrawing, isPanelExpanded = expand)
        }
    }

    fun setFullscreenState(full: Boolean) {
        updateState { it.copy(isFullscreen = full) }
    }

    fun updateIcons() {
        render(currentState)
    }

    private fun render(state: UiState) {
        if (menuView == null) return

        // Panel Expansion
        if (state.isPanelExpanded) {
            panelControls?.visibility = View.VISIBLE
            imgToggleArrow?.rotation = 90f
        } else {
            panelControls?.visibility = View.GONE
            imgToggleArrow?.rotation = 270f
        }

        try { windowManager.updateViewLayout(menuView, menuParams) } catch (e: Exception) {}

        // Icons
        btnMic?.setImageResource(if (state.isMicOn) android.R.drawable.ic_btn_speak_now else android.R.drawable.ic_lock_silent_mode_off)
        btnMic?.alpha = if (state.isMicOn) 1.0f else 0.5f

        if (state.isAvatarMode) {
            btnCam?.setImageResource(android.R.drawable.ic_menu_camera)
            btnCam?.setColorFilter(Color.CYAN)
            btnCam?.alpha = 1.0f
        } else {
            btnCam?.setImageResource(if (state.isCamOn) android.R.drawable.ic_menu_camera else android.R.drawable.ic_menu_close_clear_cancel)
            btnCam?.clearColorFilter()
            btnCam?.alpha = if (state.isCamOn) 1.0f else 0.5f
        }

        imgRecordIcon?.setImageResource(if (state.isRecording) android.R.drawable.ic_media_pause else R.drawable.ic_record)

        val showExtra = state.isCamOn && !state.isAvatarMode
        btnSwitchCam?.visibility = if (showExtra) View.VISIBLE else View.GONE
        btnMaximizeCam?.visibility = if (showExtra) View.VISIBLE else View.GONE

        btnMaximizeCam?.setImageResource(if (state.isFullscreen) android.R.drawable.ic_menu_revert else android.R.drawable.ic_menu_crop)

        btnDraw?.setColorFilter(if (state.isDrawingMode) Color.YELLOW else Color.WHITE)
        btnDraw?.alpha = if (state.isDrawingMode) 1.0f else 0.7f
    }

    fun toggleVisibility() {
        if (menuView == null) setupLayout()
        if (menuView?.visibility == View.VISIBLE) {
            menuView?.visibility = View.GONE
        } else {
            menuView?.visibility = View.VISIBLE
            render(currentState)
        }
    }

    fun initiateRecordingSequence() { startCountdown() }

    private fun setupLayout() {
        if (menuView != null) return
        menuView = LayoutInflater.from(context).inflate(R.layout.layout_floating_widget, null)

        panelControls = menuView?.findViewById(R.id.panelControls)
        btnToggleHeader = menuView?.findViewById(R.id.btnToggleHeader)
        imgToggleArrow = menuView?.findViewById(R.id.imgToggleArrow)
        btnMic = menuView?.findViewById(R.id.btnToggleMic)
        btnCam = menuView?.findViewById(R.id.btnToggleCam)
        imgRecordIcon = menuView?.findViewById(R.id.btnFloatingRecord)
        btnSwitchCam = menuView?.findViewById(R.id.btnSwitchCam)
        btnMaximizeCam = menuView?.findViewById(R.id.btnMaximizeCam)

        // Inject Draw Button
        val innerContainer = (panelControls as? ViewGroup)?.getChildAt(0) as? ViewGroup
        if (innerContainer != null) {
            btnDraw = ImageView(context).apply {
                layoutParams = LinearLayout.LayoutParams(70, 70).apply { setMargins(0, 0, 0, 15); gravity = Gravity.CENTER_HORIZONTAL }
                setImageResource(android.R.drawable.ic_menu_edit)
                setPadding(15, 15, 15, 15)
                setColorFilter(Color.WHITE)
                background = android.graphics.drawable.ShapeDrawable(android.graphics.drawable.shapes.OvalShape()).apply { paint.color = Color.parseColor("#33FFFFFF") }
                setOnClickListener { callbacks.onDrawToggle() }
            }
            innerContainer.addView(btnDraw, 0)
        }

        // Listeners
        btnMic?.setOnClickListener {
            val newState = !currentState.isMicOn
            updateState { it.copy(isMicOn = newState) }
            callbacks.onMicToggle(newState)
        }

        btnCam?.setOnClickListener {
            if (currentState.isAvatarMode) {
                updateState { it.copy(isAvatarMode = false, isCamOn = true) }
                callbacks.onCamToggle(true)
            } else {
                val newState = !currentState.isCamOn
                updateState { it.copy(isCamOn = newState) }
                callbacks.onCamToggle(newState)
            }
        }

        menuView?.findViewById<View>(R.id.btnRecordContainer)?.setOnClickListener { callbacks.onRecordToggle() }
        btnSwitchCam?.setOnClickListener { callbacks.onSwitchCamera() }
        btnMaximizeCam?.setOnClickListener { callbacks.onMaximizeToggle() }
        menuView?.findViewById<View>(R.id.btnTheme)?.setOnClickListener { callbacks.onThemeChange() }
        menuView?.findViewById<View>(R.id.btnAvatar)?.setOnClickListener {
             context.startActivity(Intent(context, MainActivity::class.java).apply { flags = Intent.FLAG_ACTIVITY_NEW_TASK; action = "ACTION_PICK_AVATAR" })
        }
        btnToggleHeader?.setOnClickListener { updateState { it.copy(isPanelExpanded = !it.isPanelExpanded) } }

        render(currentState)

        // [FIX] Gunakan getLayoutType() untuk menghindari warning
        menuParams = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            getLayoutType(),
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = 0
            y = 150
        }

        windowManager.addView(menuView, menuParams)
        com.flowork.os.module.DragHelper.setup(menuView!!, menuParams!!, windowManager)
    }

    private fun startCountdown() {
        menuView?.visibility = View.GONE
        countdownView = TextView(context).apply {
            textSize = 100f; setTextColor(Color.RED); gravity = Gravity.CENTER; text = "3"
            setBackgroundColor(Color.parseColor("#40000000"))
        }

        // [FIX] Gunakan getLayoutType() di sini juga
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            getLayoutType(),
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        )

        windowManager.addView(countdownView, params)

        object : CountDownTimer(3000, 1000) {
            override fun onTick(m: Long) { countdownView?.text = "${(m / 1000) + 1}" }
            override fun onFinish() {
                try { windowManager.removeView(countdownView); countdownView = null } catch(e:Exception){}
                callbacks.onStartRecording()
                updateState { it.copy(isPanelExpanded = false) } // Auto collapse pas record
                menuView?.visibility = View.VISIBLE
            }
        }.start()
    }

    fun destroy() {
        try { if (menuView != null) windowManager.removeView(menuView) } catch(e:Exception){}
        try { if (countdownView != null) windowManager.removeView(countdownView) } catch(e:Exception){}
        menuView = null
    }
}