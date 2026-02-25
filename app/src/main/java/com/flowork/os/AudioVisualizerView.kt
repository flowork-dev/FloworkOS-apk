// File: app/src/main/java/com/flowork/os/AudioVisualizerView.kt
package com.flowork.os

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Shader
import android.view.View
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin
import kotlin.random.Random

/**
 * ENGINE VISUALIZER 30 EFEK
 * Optimized for Android Canvas
 */
class AudioVisualizerView(context: Context) : View(context) {

    // Core State
    private var currentAmplitude = 0f
    private var smoothedAmplitude = 0f
    private var currentTheme = "NORMAL"

    // Paints
    private val mainPaint = Paint().apply { isAntiAlias = true; strokeCap = Paint.Cap.ROUND }
    private val secondaryPaint = Paint().apply { isAntiAlias = true; style = Paint.Style.STROKE }
    private val textPaint = Paint().apply { isAntiAlias = true; textSize = 40f; textAlign = Paint.Align.CENTER }

    // Geometry
    private var cx = 0f
    private var cy = 0f
    private var baseRadius = 0f
    private val path = Path()
    private val random = Random(System.currentTimeMillis())

    // Particle System (Untuk Snow, Matrix, Fire, dll)
    private data class Particle(var x: Float, var y: Float, var speed: Float, var size: Float, var life: Float, var color: Int)
    private val particles = ArrayList<Particle>()
    private val MAX_PARTICLES = 100

    // History Buffer (Untuk Wave, Heartbeat)
    private val historyBuffer = FloatArray(50) { 0f }
    private var historyIndex = 0
    private var rotationAngle = 0f
    private var frameCounter = 0L

    fun updateAmplitude(amp: Int) {
        // Normalisasi amplitude (0.0 - 1.0)
        val maxAmp = 32767f
        val normalized = (amp / maxAmp).coerceIn(0f, 1f)

        // Smoothing biar gerakannya enak dilihat (Interpolasi)
        currentAmplitude = normalized
        invalidate()
    }

    fun updateBaseRadius(size: Int) {
        baseRadius = size / 2f
    }

    fun setTheme(theme: String) {
        currentTheme = theme
        particles.clear() // Reset partikel pas ganti tema
        rotationAngle = 0f
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        cx = width / 2f
        cy = height / 2f
        if (baseRadius == 0f) baseRadius = min(cx, cy)

        // Smooth Animation Logic
        smoothedAmplitude += (currentAmplitude - smoothedAmplitude) * 0.2f
        val boost = 1f + (smoothedAmplitude * 0.5f) // Skala pembesaran

        rotationAngle += 1f + (smoothedAmplitude * 5f)
        frameCounter++

        // Update History
        historyBuffer[historyIndex] = smoothedAmplitude
        historyIndex = (historyIndex + 1) % historyBuffer.size

        when (currentTheme) {
            "NORMAL" -> drawSimpleRing(canvas, Color.CYAN, 10f, boost)
            "HACKER" -> drawHackerEffect(canvas, boost)
            "REACTOR" -> drawReactor(canvas, boost)
            "MATRIX" -> drawMatrixRain(canvas)
            "ILLUMINATI" -> drawIlluminati(canvas, boost)
            "PARTY" -> drawSimpleRing(canvas, randomColor(), 20f, boost * 1.2f)
            "GHOST" -> drawGhostTrails(canvas, boost)
            "NEON_PULSE" -> drawNeonPulse(canvas, boost)
            "HEXAGON" -> drawHexagonGrid(canvas, boost)
            "FIRESTORM" -> drawFireParticles(canvas, boost)
            "WAVE" -> drawOscilloscope(canvas)
            "STARBURST" -> drawStarburst(canvas, boost)
            "RADAR" -> drawRadarScan(canvas)
            "EQUALIZER" -> drawCircleEqualizer(canvas, boost)
            "GLITCH" -> drawGlitchEffect(canvas, boost)
            "SONIC_RING" -> drawSonicRing(canvas, boost)
            "PORTAL" -> drawPortal(canvas, boost)
            "HEARTBEAT" -> drawECG(canvas)
            "SNOW" -> drawSnow(canvas)
            "BARCODE" -> drawBarcode(canvas, boost)
            "RGB_SPLIT" -> drawRGBSplit(canvas, boost)
            "SUN" -> drawSun(canvas, boost)
            "VOID" -> drawVoid(canvas, boost)
            "TARGET" -> drawTarget(canvas, boost)
            "ELECTRIC" -> drawElectric(canvas, boost)
            "RAINBOW_ROAD" -> drawRainbow(canvas, boost)
            "CYBER_GRID" -> drawCyberGrid(canvas, boost)
            "BINARY_STREAM" -> drawBinaryStream(canvas)
            "PLASMA_GLOBE" -> drawPlasma(canvas, boost)
            "RETRO_SYNTH" -> drawRetroSynth(canvas, boost)
            else -> drawSimpleRing(canvas, Color.WHITE, 5f, boost)
        }
    }

    // --- EFFECT IMPLEMENTATIONS ---

    private fun drawSimpleRing(c: Canvas, color: Int, width: Float, scale: Float) {
        mainPaint.style = Paint.Style.STROKE
        mainPaint.color = color
        mainPaint.strokeWidth = width * scale
        mainPaint.setShadowLayer(20f, 0f, 0f, color)

        val r = baseRadius * 0.8f * scale
        c.drawCircle(cx, cy, r, mainPaint)
        mainPaint.clearShadowLayer()
    }

    private fun drawHackerEffect(c: Canvas, scale: Float) {
        mainPaint.style = Paint.Style.STROKE
        mainPaint.color = Color.GREEN
        mainPaint.strokeWidth = 3f

        val r = baseRadius * 0.9f
        c.drawCircle(cx, cy, r, mainPaint)

        // Random binary lines
        for (i in 0 until 10) {
            if (random.nextFloat() > 0.5) {
                val lineH = random.nextFloat() * height
                c.drawLine(0f, lineH, width.toFloat(), lineH, mainPaint)
            }
        }
        textPaint.color = Color.GREEN
        textPaint.textSize = 30f * scale
        c.drawText("ACCESS GRANTED", cx, cy, textPaint)
    }

    private fun drawMatrixRain(c: Canvas) {
        textPaint.color = Color.GREEN
        textPaint.textSize = 30f

        if (particles.size < 40) {
            particles.add(Particle(random.nextFloat() * width, 0f, 10f + random.nextFloat() * 10f, 30f, 255f, Color.GREEN))
        }

        val iterator = particles.iterator()
        while (iterator.hasNext()) {
            val p = iterator.next()
            p.y += p.speed
            p.color = Color.argb(p.life.toInt(), 0, 255, 0)
            textPaint.color = p.color

            val char = if (random.nextBoolean()) "1" else "0"
            c.drawText(char, p.x, p.y, textPaint)

            p.life -= 2f
            if (p.y > height || p.life <= 0) iterator.remove()
        }
    }

    private fun drawReactor(c: Canvas, scale: Float) {
        mainPaint.style = Paint.Style.FILL
        mainPaint.color = Color.argb(100, 0, 255, 255) // Cyan core
        c.drawCircle(cx, cy, baseRadius * 0.4f * scale, mainPaint)

        secondaryPaint.color = Color.YELLOW
        secondaryPaint.strokeWidth = 8f

        for (i in 0 until 3) {
            val r = baseRadius * (0.6f + i * 0.15f)
            val start = (rotationAngle + i * 120) % 360
            c.drawArc(RectF(cx-r, cy-r, cx+r, cy+r), start, 90f, false, secondaryPaint)
        }
    }

    private fun drawIlluminati(c: Canvas, scale: Float) {
        mainPaint.style = Paint.Style.STROKE
        mainPaint.color = Color.YELLOW
        mainPaint.strokeWidth = 5f

        val size = baseRadius * scale
        path.reset()
        path.moveTo(cx, cy - size)
        path.lineTo(cx + size * 0.866f, cy + size * 0.5f)
        path.lineTo(cx - size * 0.866f, cy + size * 0.5f)
        path.close()
        c.drawPath(path, mainPaint)

        // Eye
        c.drawCircle(cx, cy, size * 0.2f, mainPaint)
        c.drawCircle(cx, cy, size * 0.05f * scale, mainPaint)
    }

    private fun drawNeonPulse(c: Canvas, scale: Float) {
        for (i in 3 downTo 1) {
            val color = if (i % 2 == 0) Color.MAGENTA else Color.CYAN
            mainPaint.color = color
            mainPaint.style = Paint.Style.STROKE
            mainPaint.strokeWidth = 4f * i
            mainPaint.alpha = (255 / i)
            val r = baseRadius * scale * (0.2f * i + 0.3f)
            c.drawCircle(cx, cy, r, mainPaint)
        }
    }

    private fun drawHexagonGrid(c: Canvas, scale: Float) {
        secondaryPaint.color = Color.parseColor("#FFA500") // Orange
        secondaryPaint.strokeWidth = 5f

        val size = baseRadius * 0.8f * scale
        path.reset()
        for (i in 0 until 6) {
            val angle = Math.toRadians((60 * i + rotationAngle).toDouble())
            val x = cx + size * cos(angle).toFloat()
            val y = cy + size * sin(angle).toFloat()
            if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        path.close()
        c.drawPath(path, secondaryPaint)
        // Inner Hex
        c.drawCircle(cx, cy, size * 0.5f, secondaryPaint)
    }

    private fun drawFireParticles(c: Canvas, scale: Float) {
        if (particles.size < 50) {
            particles.add(Particle(cx + (random.nextFloat()-0.5f)*baseRadius, cy + baseRadius,
                -(5f + random.nextFloat()*5f), 10f + smoothedAmplitude*20f, 255f, Color.RED))
        }

        val iterator = particles.iterator()
        while (iterator.hasNext()) {
            val p = iterator.next()
            p.y += p.speed
            p.x += (random.nextFloat() - 0.5f) * 5f

            // Fade from Yellow to Red to Transparent
            val ratio = p.life / 255f
            val red = 255
            val green = (255 * ratio).toInt()
            mainPaint.color = Color.argb(p.life.toInt(), red, green, 0)

            c.drawCircle(p.x, p.y, p.size * scale, mainPaint)
            p.life -= 10f
            if (p.life <= 0) iterator.remove()
        }
    }

    private fun drawOscilloscope(c: Canvas) {
        mainPaint.color = Color.CYAN
        mainPaint.strokeWidth = 5f

        val pts = FloatArray(historyBuffer.size * 4)
        for (i in 0 until historyBuffer.size - 1) {
            val x1 = (i.toFloat() / historyBuffer.size) * width
            val y1 = cy + historyBuffer[i] * 200f * (if (i%2==0) 1 else -1)
            val x2 = ((i + 1).toFloat() / historyBuffer.size) * width
            val y2 = cy + historyBuffer[i + 1] * 200f * (if (i%2==0) -1 else 1)

            pts[i*4] = x1; pts[i*4+1] = y1; pts[i*4+2] = x2; pts[i*4+3] = y2
        }
        c.drawLines(pts, mainPaint)
    }

    private fun drawStarburst(c: Canvas, scale: Float) {
        mainPaint.color = Color.YELLOW
        mainPaint.strokeWidth = 4f
        val lines = 12
        val r = baseRadius * 1.2f * scale

        for (i in 0 until lines) {
            val angle = Math.toRadians((i * (360/lines)).toDouble())
            val x = cx + r * cos(angle).toFloat()
            val y = cy + r * sin(angle).toFloat()
            c.drawLine(cx, cy, x, y, mainPaint)
        }
    }

    private fun drawRadarScan(c: Canvas) {
        secondaryPaint.color = Color.GREEN
        secondaryPaint.style = Paint.Style.STROKE
        c.drawCircle(cx, cy, baseRadius * 0.8f, secondaryPaint)
        c.drawCircle(cx, cy, baseRadius * 0.4f, secondaryPaint)
        c.drawLine(cx, cy - baseRadius, cx, cy + baseRadius, secondaryPaint)
        c.drawLine(cx - baseRadius, cy, cx + baseRadius, cy, secondaryPaint)

        // Sweep
        mainPaint.style = Paint.Style.FILL
        val sweepShader = android.graphics.SweepGradient(cx, cy,
            intArrayOf(Color.TRANSPARENT, Color.GREEN), null)
        mainPaint.shader = sweepShader

        c.save()
        c.rotate(rotationAngle * 2f, cx, cy)
        c.drawCircle(cx, cy, baseRadius * 0.8f, mainPaint)
        c.restore()
        mainPaint.shader = null
    }

    private fun drawCircleEqualizer(c: Canvas, scale: Float) {
        mainPaint.color = Color.MAGENTA
        mainPaint.strokeWidth = 8f
        val bars = 20
        val radius = baseRadius * 0.6f

        for (i in 0 until bars) {
            val angle = (360f / bars) * i
            val barHeight = smoothedAmplitude * 100f * (if (i%2==0) 1f else 0.5f)

            val rStart = radius
            val rEnd = radius + barHeight + 20f

            val rad = Math.toRadians(angle.toDouble())
            val x1 = cx + rStart * cos(rad).toFloat()
            val y1 = cy + rStart * sin(rad).toFloat()
            val x2 = cx + rEnd * cos(rad).toFloat()
            val y2 = cy + rEnd * sin(rad).toFloat()

            c.drawLine(x1, y1, x2, y2, mainPaint)
        }
    }

    private fun drawGlitchEffect(c: Canvas, scale: Float) {
        // Random Rectangles
        mainPaint.style = Paint.Style.FILL
        for (i in 0 until 5) {
            mainPaint.color = if (random.nextBoolean()) Color.RED else Color.BLUE
            mainPaint.alpha = 150
            val w = random.nextFloat() * 100f * scale
            val h = random.nextFloat() * 20f
            val x = cx + (random.nextFloat() - 0.5f) * baseRadius * 2
            val y = cy + (random.nextFloat() - 0.5f) * baseRadius * 2
            c.drawRect(x, y, x+w, y+h, mainPaint)
        }
        textPaint.color = Color.WHITE
        textPaint.textSize = 50f
        c.drawText("ERROR", cx + random.nextInt(10), cy, textPaint)
    }

    private fun drawGhostTrails(c: Canvas, scale: Float) {
        mainPaint.style = Paint.Style.STROKE
        mainPaint.strokeWidth = 3f
        mainPaint.color = Color.WHITE

        for (i in 0 until 5) {
            mainPaint.alpha = 255 - (i * 50)
            val r = baseRadius * (scale - i * 0.1f)
            c.drawCircle(cx, cy, r, mainPaint)
        }
    }

    private fun drawSonicRing(c: Canvas, scale: Float) {
        mainPaint.style = Paint.Style.STROKE
        mainPaint.color = Color.BLUE
        mainPaint.strokeWidth = 15f
        c.drawCircle(cx, cy, baseRadius * 0.8f * scale, mainPaint)
        mainPaint.strokeWidth = 2f
        mainPaint.color = Color.WHITE
        c.drawCircle(cx, cy, baseRadius * 0.8f * scale, mainPaint) // Inner shine
    }

    private fun drawPortal(c: Canvas, scale: Float) {
        mainPaint.style = Paint.Style.STROKE
        val r = baseRadius * scale

        c.save()
        c.rotate(rotationAngle, cx, cy)
        mainPaint.color = Color.parseColor("#FFA500") // Orange
        c.drawOval(RectF(cx-r, cy-r*0.5f, cx+r, cy+r*0.5f), mainPaint)
        c.rotate(90f, cx, cy)
        mainPaint.color = Color.BLUE
        c.drawOval(RectF(cx-r, cy-r*0.5f, cx+r, cy+r*0.5f), mainPaint)
        c.restore()
    }

    private fun drawECG(c: Canvas) {
        mainPaint.color = Color.GREEN
        mainPaint.strokeWidth = 5f

        var startX = 0f
        var startY = cy

        // Simple ECG pattern simulation
        val points = mutableListOf<Float>()
        for (i in 0 until 10) {
            points.add(startX); points.add(startY)
            startX += width / 10f
            val spike = if (i == 5) -smoothedAmplitude * 300f else 0f
            startY = cy + spike
            points.add(startX); points.add(startY)
        }
        c.drawLines(points.toFloatArray(), mainPaint)
    }

    private fun drawSnow(c: Canvas) {
        mainPaint.color = Color.WHITE
        if (particles.size < 60) {
            particles.add(Particle(random.nextFloat() * width, 0f, 2f + random.nextFloat() * 5f, 5f + random.nextFloat() * 5f, 255f, Color.WHITE))
        }
        val iterator = particles.iterator()
        while (iterator.hasNext()) {
            val p = iterator.next()
            p.y += p.speed
            p.x += sin(p.y * 0.01f) * 2f // Wobble
            mainPaint.alpha = p.life.toInt()
            c.drawCircle(p.x, p.y, p.size, mainPaint)
            if (p.y > height) p.y = 0f
        }
    }

    private fun drawBarcode(c: Canvas, scale: Float) {
        mainPaint.color = Color.BLACK
        val barW = width / 20f
        for (i in 0 until 20) {
            val h = if (i % 2 == 0) height * 0.5f * scale else height * 0.2f
            c.drawRect(i * barW, (height - h)/2, i * barW + barW * 0.8f, (height + h)/2, mainPaint)
        }
        // Red scan line
        secondaryPaint.color = Color.RED
        secondaryPaint.strokeWidth = 5f
        val scanY = (frameCounter % 100) / 100f * height
        c.drawLine(0f, scanY, width.toFloat(), scanY, secondaryPaint)
    }

    private fun drawRGBSplit(c: Canvas, scale: Float) {
        val r = baseRadius * scale

        mainPaint.style = Paint.Style.STROKE
        mainPaint.strokeWidth = 8f

        // Red Channel (Offset Left)
        mainPaint.color = Color.RED
        c.drawCircle(cx - 10f * scale, cy, r, mainPaint)

        // Green Channel (Center)
        mainPaint.color = Color.GREEN
        c.drawCircle(cx, cy, r, mainPaint)

        // Blue Channel (Offset Right)
        mainPaint.color = Color.BLUE
        c.drawCircle(cx + 10f * scale, cy, r, mainPaint)
    }

    private fun drawSun(c: Canvas, scale: Float) {
        mainPaint.style = Paint.Style.FILL
        mainPaint.color = Color.YELLOW
        c.drawCircle(cx, cy, baseRadius * 0.5f * scale, mainPaint)

        mainPaint.strokeWidth = 4f
        val rays = 16
        val rInner = baseRadius * 0.6f * scale
        val rOuter = baseRadius * (1f + smoothedAmplitude)

        for (i in 0 until rays) {
             val angle = Math.toRadians((i * (360/rays) + rotationAngle).toDouble())
             val x1 = cx + rInner * cos(angle).toFloat()
             val y1 = cy + rInner * sin(angle).toFloat()
             val x2 = cx + rOuter * cos(angle).toFloat()
             val y2 = cy + rOuter * sin(angle).toFloat()
             c.drawLine(x1, y1, x2, y2, mainPaint)
        }
    }

    private fun drawVoid(c: Canvas, scale: Float) {
        mainPaint.style = Paint.Style.FILL
        mainPaint.color = Color.BLACK
        c.drawCircle(cx, cy, baseRadius * scale, mainPaint)

        // Inverse radiation (white ring sucking in)
        secondaryPaint.color = Color.WHITE
        secondaryPaint.style = Paint.Style.STROKE
        val r = (baseRadius * 1.5f) - ((frameCounter % 50) / 50f * baseRadius)
        c.drawCircle(cx, cy, r, secondaryPaint)
    }

    private fun drawTarget(c: Canvas, scale: Float) {
        mainPaint.style = Paint.Style.STROKE
        mainPaint.color = Color.RED
        mainPaint.strokeWidth = 20f

        val r = baseRadius * scale
        c.drawCircle(cx, cy, r * 0.9f, mainPaint)
        c.drawCircle(cx, cy, r * 0.6f, mainPaint)
        c.drawCircle(cx, cy, r * 0.3f, mainPaint)

        mainPaint.style = Paint.Style.FILL
        c.drawCircle(cx, cy, r * 0.1f, mainPaint)
    }

    private fun drawElectric(c: Canvas, scale: Float) {
        mainPaint.style = Paint.Style.STROKE
        mainPaint.color = Color.YELLOW
        mainPaint.strokeWidth = 3f

        // Chaos lines
        for (i in 0 until 5) {
            val r = baseRadius * scale
            val angle = random.nextFloat() * 360
            val x = cx + r * cos(angle).toFloat()
            val y = cy + r * sin(angle).toFloat()

            // Draw zigzag to center
            var currX = x; var currY = y
            for (j in 0 until 5) {
                val nextX = currX + (cx - currX) * 0.2f + (random.nextFloat()-0.5f) * 20f
                val nextY = currY + (cy - currY) * 0.2f + (random.nextFloat()-0.5f) * 20f
                c.drawLine(currX, currY, nextX, nextY, mainPaint)
                currX = nextX; currY = nextY
            }
        }
    }

    private fun drawRainbow(c: Canvas, scale: Float) {
        val colors = intArrayOf(Color.RED, Color.parseColor("#FFA500"), Color.YELLOW, Color.GREEN, Color.BLUE, Color.parseColor("#4B0082"), Color.MAGENTA)
        mainPaint.style = Paint.Style.STROKE
        mainPaint.strokeWidth = 8f

        for (i in colors.indices) {
            mainPaint.color = colors[i]
            val r = baseRadius * scale * (0.5f + i * 0.1f) + sin(frameCounter * 0.1f + i) * 10f
            c.drawCircle(cx, cy, r, mainPaint)
        }
    }

    private fun drawCyberGrid(c: Canvas, scale: Float) {
        secondaryPaint.color = Color.CYAN
        secondaryPaint.strokeWidth = 2f

        // Perspective Grid
        val horizon = cy
        val bottom = height.toFloat()

        // Vertical lines
        for (i in -5..5) {
            val xBottom = cx + i * (width/5f) * scale
            val xTop = cx + i * (width/20f)
            c.drawLine(xTop, horizon, xBottom, bottom, secondaryPaint)
        }
        // Horizontal moving lines
        val offset = (frameCounter % 20) * (height / 20f)
        for (i in 0 until 10) {
            val y = horizon + i * (height/20f) + offset
            if (y < bottom) c.drawLine(0f, y, width.toFloat(), y, secondaryPaint)
        }
    }

    private fun drawBinaryStream(c: Canvas) {
        textPaint.color = Color.GREEN
        textPaint.textSize = 25f

        val cols = (width / 25).toInt()
        for (i in 0 until cols) {
            val x = i * 25f
            val speed = (i % 3 + 1) * 5f
            val y = (frameCounter * speed) % height
            c.drawText(if (random.nextBoolean()) "1" else "0", x, y, textPaint)
        }
    }

    private fun drawPlasma(c: Canvas, scale: Float) {
        val colors = intArrayOf(Color.MAGENTA, Color.CYAN, Color.BLUE)
        val shader = android.graphics.RadialGradient(cx, cy, baseRadius * scale, colors, null, Shader.TileMode.MIRROR)
        mainPaint.shader = shader
        mainPaint.style = Paint.Style.FILL
        c.drawCircle(cx, cy, baseRadius * scale, mainPaint)
        mainPaint.shader = null // Clean up
    }

    private fun drawRetroSynth(c: Canvas, scale: Float) {
        // Sun
        mainPaint.style = Paint.Style.FILL
        val gradient = LinearGradient(cx, cy-baseRadius, cx, cy+baseRadius, Color.YELLOW, Color.MAGENTA, Shader.TileMode.CLAMP)
        mainPaint.shader = gradient
        c.drawCircle(cx, cy, baseRadius * 0.8f * scale, mainPaint)
        mainPaint.shader = null

        // Sun stripes (cutout)
        mainPaint.color = Color.BLACK // Assuming background is black-ish
        for (i in 0 until 5) {
            val y = cy + i * 20f
            c.drawRect(cx - baseRadius, y, cx + baseRadius, y + 5f, mainPaint)
        }
    }

    private fun randomColor(): Int {
        return Color.rgb(random.nextInt(256), random.nextInt(256), random.nextInt(256))
    }
}