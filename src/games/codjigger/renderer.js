/**
 * Cod Jigger — Canvas renderer.
 *
 * Draws the North Atlantic scene: overcast sky, choppy ocean,
 * a dory with a fisher in yellow oilskins, fishing line into
 * the water, and cod fish when caught. All procedural.
 *
 * @module games/codjigger/renderer
 */

import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  WATERLINE_Y,
  WAVE_AMPLITUDE,
  DORY_X,
  DORY_Y,
  COLORS,
  UI_FONT,
  PHASE,
} from "./config.js"
import {
  drawCloud,
  drawWaves,
  drawDory,
  drawFisher,
  drawStartScreen,
} from "../../engine/draw_utils.js"

/**
 * Canvas renderer for Cod Jigger.
 *
 * @example
 * const renderer = new CodJiggerRenderer(canvas)
 * renderer.draw(gameState)
 */
export class CodJiggerRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas
    this.canvas.width = CANVAS_WIDTH
    this.canvas.height = CANVAS_HEIGHT
    this.ctx = canvas.getContext("2d")
  }

  /**
   * Main render — draws all elements for one frame.
   *
   * @param {Object} state - Game state from engine
   */
  draw(state) {
    this._drawSky(state)
    this._drawOcean(state)
    this._drawDory(state)
    this._drawFisher(state)
    this._drawLine(state)
    this._drawUnderwater(state)
    this._drawUI(state)

    if (state.phase === PHASE.START) {
      this._drawStartScreen()
    }
  }

  // ---------------------------------------------------------------------------
  // Sky
  // ---------------------------------------------------------------------------

  /** @private */
  _drawSky(state) {
    const ctx = this.ctx
    const grad = ctx.createLinearGradient(0, 0, 0, WATERLINE_Y)
    grad.addColorStop(0, COLORS.skyTop)
    grad.addColorStop(1, COLORS.skyBottom)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, CANVAS_WIDTH, WATERLINE_Y)

    // Clouds
    ctx.fillStyle = COLORS.cloud
    const t = state.frameCount * 0.15
    this._drawCloud(60 + (t % (CANVAS_WIDTH + 200)) - 100, 30, 50, 18)
    this._drawCloud(250 + ((t * 0.6) % (CANVAS_WIDTH + 200)) - 100, 50, 40, 14)
    this._drawCloud(450 + ((t * 0.8) % (CANVAS_WIDTH + 200)) - 100, 25, 60, 20)
  }

  /** @private Draws a simple cloud blob. Delegates to shared drawCloud. */
  _drawCloud(x, y, w, h) {
    drawCloud(this.ctx, x, y, w, h)
  }

  // ---------------------------------------------------------------------------
  // Ocean
  // ---------------------------------------------------------------------------

  /** @private */
  _drawOcean(state) {
    const ctx = this.ctx

    // Ocean gradient
    const grad = ctx.createLinearGradient(0, WATERLINE_Y, 0, CANVAS_HEIGHT)
    grad.addColorStop(0, COLORS.oceanTop)
    grad.addColorStop(0.5, COLORS.oceanMid)
    grad.addColorStop(1, COLORS.oceanBottom)
    ctx.fillStyle = grad
    ctx.fillRect(0, WATERLINE_Y, CANVAS_WIDTH, CANVAS_HEIGHT - WATERLINE_Y)

    // Wave crests and foam at waterline
    drawWaves(ctx, WATERLINE_Y, WAVE_AMPLITUDE, CANVAS_WIDTH, state.frameCount, COLORS)
  }

  // ---------------------------------------------------------------------------
  // Dory (boat)
  // ---------------------------------------------------------------------------

  /** @private */
  _drawDory(state) {
    const bob = Math.sin(state.frameCount * 0.04) * 2
    drawDory(this.ctx, DORY_X, DORY_Y + bob, 1, COLORS)

    // Store bob for fisher/line drawing
    this._doryBob = bob
  }

  // ---------------------------------------------------------------------------
  // Fisher
  // ---------------------------------------------------------------------------

  /** @private */
  _drawFisher(state) {
    const bob = this._doryBob
    drawFisher(this.ctx, DORY_X, DORY_Y + bob, 1, COLORS)
  }

  // ---------------------------------------------------------------------------
  // Fishing line & jigger
  // ---------------------------------------------------------------------------

  /** @private */
  _drawLine(state) {
    const ctx = this.ctx
    const bob = this._doryBob
    const shake = state.lineShake || 0

    // Rod tip position (end of right arm)
    const rodTipX = DORY_X + 20 + shake
    const rodTipY = DORY_Y + bob - 18

    // Rod
    ctx.strokeStyle = "#555"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(DORY_X + 8, DORY_Y + bob - 16)
    ctx.lineTo(rodTipX, rodTipY - 8)
    ctx.stroke()

    // Line from rod tip to water
    const jiggerX = DORY_X + 22 + shake
    const jiggerBaseY = WATERLINE_Y + 80 + state.jiggerY

    ctx.strokeStyle = COLORS.line
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(rodTipX, rodTipY - 8)
    ctx.lineTo(jiggerX, jiggerBaseY)
    ctx.stroke()

    // Jigger (lead lure)
    if (state.phase !== PHASE.PULLING && state.phase !== PHASE.CAUGHT) {
      ctx.fillStyle = COLORS.jigger
      ctx.beginPath()
      ctx.ellipse(jiggerX, jiggerBaseY + 4, 4, 8, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = COLORS.jiggerDark
      ctx.beginPath()
      ctx.ellipse(jiggerX - 1, jiggerBaseY + 4, 2, 6, 0, 0, Math.PI * 2)
      ctx.fill()

      // Hook
      ctx.strokeStyle = "#777"
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(jiggerX, jiggerBaseY + 12, 3, 0, Math.PI)
      ctx.stroke()
    }
  }

  // ---------------------------------------------------------------------------
  // Underwater scene
  // ---------------------------------------------------------------------------

  /** @private */
  _drawUnderwater(state) {
    const ctx = this.ctx
    const t = state.frameCount

    // Fish shadows swimming around (ambient)
    if (state.phase === PHASE.WAITING || state.phase === PHASE.START) {
      ctx.fillStyle = "rgba(40, 60, 50, 0.15)"
      for (let i = 0; i < 3; i++) {
        const fx = ((t * (0.5 + i * 0.3) + i * 200) % (CANVAS_WIDTH + 100)) - 50
        const fy = WATERLINE_Y + 50 + i * 35 + Math.sin(t * 0.03 + i) * 8
        this._drawFishSilhouette(fx, fy, 18 + i * 4, i % 2 === 0 ? 1 : -1)
      }
    }

    // Bite indicator — fish approaching jigger
    if (state.phase === PHASE.BITE) {
      ctx.fillStyle = "rgba(60, 80, 60, 0.25)"
      const approachX = DORY_X + 22 + state.lineShake - 25
      const approachY = WATERLINE_Y + 75 + state.jiggerY
      this._drawFishSilhouette(approachX, approachY, 22, 1)

      // Splash at waterline
      ctx.fillStyle = COLORS.splash
      for (let i = 0; i < 4; i++) {
        const sx = DORY_X + 18 + Math.sin(t * 0.5 + i * 2) * 8
        const sy = WATERLINE_Y - 2 + Math.cos(t * 0.7 + i) * 3
        ctx.beginPath()
        ctx.arc(sx, sy, 2 + Math.random(), 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Fish being pulled up
    if (state.phase === PHASE.PULLING) {
      const startY = WATERLINE_Y + 80
      const endY = DORY_Y - 10
      const fishDrawY = startY + (endY - startY) * state.fishY
      this._drawCod(DORY_X + 22, fishDrawY, 1)
    }

    // Caught fish display
    if (state.phase === PHASE.CAUGHT) {
      this._drawCod(DORY_X + 22, DORY_Y - 15 + this._doryBob, 1)
    }
  }

  /** @private Draws a simple fish silhouette (ambient). */
  _drawFishSilhouette(x, y, size, dir) {
    const ctx = this.ctx
    ctx.beginPath()
    ctx.ellipse(x, y, size, size * 0.35, 0, 0, Math.PI * 2)
    ctx.fill()
    // Tail
    ctx.beginPath()
    ctx.moveTo(x - size * dir, y)
    ctx.lineTo(x - (size + 8) * dir, y - 5)
    ctx.lineTo(x - (size + 8) * dir, y + 5)
    ctx.closePath()
    ctx.fill()
  }

  /**
   * Draws a detailed Atlantic cod.
   *
   * @private
   * @param {number} x - Center X
   * @param {number} y - Center Y
   * @param {number} dir - Direction (1 = right, -1 = left)
   */
  _drawCod(x, y, dir) {
    const ctx = this.ctx

    // Body
    ctx.fillStyle = COLORS.codBody
    ctx.beginPath()
    ctx.ellipse(x, y, 22, 9, 0, 0, Math.PI * 2)
    ctx.fill()

    // Belly
    ctx.fillStyle = COLORS.codBelly
    ctx.beginPath()
    ctx.ellipse(x, y + 3, 18, 5, 0, 0, Math.PI)
    ctx.fill()

    // Lighter top
    ctx.fillStyle = COLORS.codLight
    ctx.beginPath()
    ctx.ellipse(x, y - 2, 16, 4, 0, Math.PI, Math.PI * 2)
    ctx.fill()

    // Spots
    ctx.fillStyle = COLORS.codDark
    ctx.beginPath()
    ctx.arc(x - 6 * dir, y - 2, 1.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(x + 2 * dir, y - 1, 1, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(x - 3 * dir, y + 2, 1, 0, Math.PI * 2)
    ctx.fill()

    // Tail
    ctx.fillStyle = COLORS.codFin
    ctx.beginPath()
    ctx.moveTo(x - 20 * dir, y)
    ctx.lineTo(x - 30 * dir, y - 8)
    ctx.lineTo(x - 28 * dir, y)
    ctx.lineTo(x - 30 * dir, y + 8)
    ctx.closePath()
    ctx.fill()

    // Dorsal fin
    ctx.fillStyle = COLORS.codFin
    ctx.beginPath()
    ctx.moveTo(x - 8 * dir, y - 8)
    ctx.lineTo(x + 4 * dir, y - 10)
    ctx.lineTo(x + 6 * dir, y - 7)
    ctx.lineTo(x - 6 * dir, y - 7)
    ctx.closePath()
    ctx.fill()

    // Eye
    ctx.fillStyle = COLORS.codEyeWhite
    ctx.beginPath()
    ctx.arc(x + 14 * dir, y - 2, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = COLORS.codEye
    ctx.beginPath()
    ctx.arc(x + 14 * dir, y - 2, 1.5, 0, Math.PI * 2)
    ctx.fill()

    // Barbel (chin whisker — signature cod feature)
    ctx.strokeStyle = COLORS.codDark
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x + 18 * dir, y + 4)
    ctx.lineTo(x + 22 * dir, y + 8)
    ctx.stroke()

    // Lateral line
    ctx.strokeStyle = COLORS.codLight
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(x - 16 * dir, y)
    ctx.lineTo(x + 12 * dir, y - 1)
    ctx.stroke()
  }

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------

  /** @private */
  _drawUI(state) {
    const ctx = this.ctx

    // Fish counter
    ctx.fillStyle = COLORS.text
    ctx.font = `bold 16px ${UI_FONT}`
    ctx.textAlign = "left"
    ctx.fillText("COD JIGGING GROUNDS", 12, 22)

    ctx.textAlign = "right"
    ctx.fillText(`${state.fishCaught} fish`, CANVAS_WIDTH - 12, 22)

    // Bite alert
    if (state.phase === PHASE.BITE) {
      const pulse = Math.sin(state.frameCount * 0.3) * 0.3 + 0.7
      ctx.save()
      ctx.globalAlpha = pulse
      ctx.fillStyle = COLORS.biteAlert
      ctx.font = `bold 28px ${UI_FONT}`
      ctx.textAlign = "center"
      ctx.fillText("BITE!", CANVAS_WIDTH / 2, CANVAS_HEIGHT - 30)
      ctx.restore()
    }

    // Catch / miss message
    if (state.message && (state.phase === PHASE.CAUGHT || state.phase === PHASE.PULLING)) {
      ctx.fillStyle = COLORS.gold
      ctx.font = `bold 20px ${UI_FONT}`
      ctx.textAlign = "center"
      ctx.fillText(state.message, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 30)
    }

    if (state.message && state.phase === PHASE.MISSED) {
      ctx.fillStyle = COLORS.missText
      ctx.font = `16px ${UI_FONT}`
      ctx.textAlign = "center"
      ctx.fillText(state.message, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 30)
    }

    // Waiting hint
    if (state.phase === PHASE.WAITING && state.frameCount > 60) {
      ctx.fillStyle = "rgba(240, 237, 230, 0.3)"
      ctx.font = `12px ${UI_FONT}`
      ctx.textAlign = "center"
      ctx.fillText("click or SPACE when the line shakes", CANVAS_WIDTH / 2, CANVAS_HEIGHT - 12)
    }
  }

  /** @private */
  _drawStartScreen() {
    drawStartScreen(this.ctx, {
      title: "COD JIGGING GROUNDS",
      lines: [
        { text: "Sit in the dory. Wait for the bite." },
        { text: "When the line shakes, pull 'er in!", size: 14 },
      ],
      startPrompt: "SPACE or CLICK to start",
      canvasWidth: CANVAS_WIDTH, canvasHeight: CANVAS_HEIGHT,
      colors: COLORS, font: UI_FONT,
      layout: { titleSize: 26, descGap: 28, promptY: 230, hintY: 255 },
    })
  }
}
