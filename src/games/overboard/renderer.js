/**
 * Overboard! -- Canvas renderer.
 *
 * Draws all visual elements for the Tetris game: ocean gradient
 * background, the 10x20 grid styled as a ship's hull, crate-styled
 * tetromino pieces, score/level/lines HUD, start screen, and
 * game-over overlay with leaderboard.
 *
 * All drawing is procedural -- no external images. Pieces are drawn
 * as wooden crates with bevel highlights and shadow edges for a
 * tactile, cargo-themed look.
 *
 * @module games/overboard/renderer
 */

import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GRID_COLS,
  GRID_ROWS,
  CELL_SIZE,
  PLAY_AREA_X,
  PLAY_AREA_Y,
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
  drawBasicGameOver,
  drawLeaderboardOverlay,
} from "../../engine/draw_utils.js"

/**
 * Canvas renderer for Overboard!
 *
 * @example
 * const renderer = new OverboardRenderer(canvas)
 * renderer.draw(gameState)
 */
export class OverboardRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas
    this.canvas.width = CANVAS_WIDTH
    this.canvas.height = CANVAS_HEIGHT

    /** @type {CanvasRenderingContext2D} */
    this.ctx = canvas.getContext("2d")

    /** @type {CanvasGradient} Cached ocean gradient (below waterline). */
    this._oceanGradient = this.ctx.createLinearGradient(0, WATERLINE_Y, 0, CANVAS_HEIGHT)
    this._oceanGradient.addColorStop(0, COLORS.oceanTop)
    this._oceanGradient.addColorStop(1, COLORS.oceanBottom)

    /** @type {CanvasGradient} Cached sky gradient (above waterline). */
    this._skyGradient = this.ctx.createLinearGradient(0, 0, 0, WATERLINE_Y)
    this._skyGradient.addColorStop(0, COLORS.skyTop)
    this._skyGradient.addColorStop(1, COLORS.skyBottom)
  }

  // ---------------------------------------------------------------------------
  // Main draw
  // ---------------------------------------------------------------------------

  /**
   * Main render method -- draws all game elements for one frame.
   *
   * @param {Object} state - State snapshot from engine.getState()
   */
  draw(state) {
    this._drawBackground()
    this._drawSky(state.frameCount)
    this._drawSurfaceWaves(state.frameCount)
    this._drawDory(state.frameCount)
    this._drawFisher(state.frameCount)
    this._drawGrid()
    this._drawLockedBlocks(state.grid)
    this._drawClearAnimation(state.clearingRows, state.clearTimer)

    if (state.current) {
      this._drawGhostPiece(state)
      this._drawCurrentPiece(state.current)
    }

    this._drawHUD(state)

    if (state.phase === PHASE.START) {
      this._drawStartScreen()
    } else if (state.phase === PHASE.DEAD) {
      this._drawGameOver(state)
    }

    this._lastState = state
  }

  /**
   * Draws the game-over overlay with score and leaderboard.
   *
   * Called by the base controller after score submission
   * and leaderboard fetch complete.
   *
   * @param {number} score
   * @param {Array<{user_name: string, score: number}>} leaderboard
   * @param {boolean} isNewHighScore
   */
  drawGameOverWithLeaderboard(score, leaderboard, isNewHighScore) {
    // Redraw the frozen scene to clear the basic game-over overlay,
    // then draw the leaderboard version on a clean canvas.
    if (this._lastState) {
      this.draw({ ...this._lastState, phase: "PLAYING" })
    }

    const cx = (GRID_COLS * CELL_SIZE) / 2
    drawLeaderboardOverlay(this.ctx, {
      score, leaderboard, isNewHighScore,
      canvasWidth: CANVAS_WIDTH, canvasHeight: CANVAS_HEIGHT,
      colors: COLORS, font: UI_FONT,
      layout: {
        cx, headingY: 160, headingSize: 28,
        highScoreY: 185, highScoreSize: 14,
        scoreY: 230, scoreSize: 36,
        tableHeaderY: 265, tableHeaderSize: 12,
        tableStartY: 285, tableRowHeight: 18, tableEntrySize: 12,
        nameX: 60, scoreX: CANVAS_WIDTH - 60,
        hintSize: 12,
      },
    })
  }

  // ---------------------------------------------------------------------------
  // Background & grid
  // ---------------------------------------------------------------------------

  /** @private Draws the ocean gradient background below the waterline. */
  _drawBackground() {
    this.ctx.fillStyle = this._oceanGradient
    this.ctx.fillRect(0, WATERLINE_Y, CANVAS_WIDTH, CANVAS_HEIGHT - WATERLINE_Y)
  }

  /**
   * @private Draws the overcast sky above the waterline.
   * @param {number} frameCount - Frame counter from engine state
   */
  _drawSky(frameCount) {
    const ctx = this.ctx
    ctx.fillStyle = this._skyGradient
    ctx.fillRect(0, 0, CANVAS_WIDTH, WATERLINE_Y)

    // Drifting clouds
    ctx.fillStyle = COLORS.cloud
    const t = frameCount * 0.15
    this._drawCloud(40 + (t % (CANVAS_WIDTH + 120)) - 60, 14, 30, 10)
    this._drawCloud(180 + ((t * 0.6) % (CANVAS_WIDTH + 120)) - 60, 22, 24, 8)
    this._drawCloud(300 + ((t * 0.8) % (CANVAS_WIDTH + 120)) - 60, 10, 35, 11)
  }

  /** @private Draws a cloud blob. Delegates to shared drawCloud. */
  _drawCloud(x, y, w, h) {
    drawCloud(this.ctx, x, y, w, h)
  }

  /**
   * @private Draws animated wave crests at the waterline.
   * @param {number} frameCount - Frame counter from engine state
   */
  _drawSurfaceWaves(frameCount) {
    drawWaves(this.ctx, WATERLINE_Y, WAVE_AMPLITUDE, CANVAS_WIDTH, frameCount, COLORS, {
      foamSpacing: 60, foamWidth: 10, foamHeight: 1.5, bottomExtend: 8,
    })
  }

  /**
   * @private Draws the dory (small boat) bobbing on the waves.
   * @param {number} frameCount - Frame counter from engine state
   */
  _drawDory(frameCount) {
    const bob = Math.sin(frameCount * 0.04) * 1.5
    drawDory(this.ctx, DORY_X, DORY_Y + bob, 0.7, COLORS)

    this._doryBob = bob
  }

  /**
   * @private Draws a small fisher in yellow oilskins sitting in the dory.
   * @param {number} frameCount - Frame counter from engine state
   */
  _drawFisher(frameCount) {
    const bob = this._doryBob
    drawFisher(this.ctx, DORY_X, DORY_Y + bob, 0.7, COLORS)
  }

  /** @private Draws the playfield grid with subtle hull lines. */
  _drawGrid() {
    const ctx = this.ctx
    const x = PLAY_AREA_X
    const y = PLAY_AREA_Y
    const w = GRID_COLS * CELL_SIZE
    const h = GRID_ROWS * CELL_SIZE

    // Dark overlay for grid area (hull/underwater)
    ctx.fillStyle = COLORS.gridBg
    ctx.fillRect(x, y, w, h)

    // Subtle horizontal plank lines
    ctx.fillStyle = COLORS.plank
    for (let row = 0; row < GRID_ROWS; row++) {
      ctx.fillRect(x, y + row * CELL_SIZE + CELL_SIZE - 1, w, 1)
    }

    // Grid lines
    ctx.strokeStyle = COLORS.gridLine
    ctx.lineWidth = 0.5

    for (let col = 0; col <= GRID_COLS; col++) {
      ctx.beginPath()
      ctx.moveTo(x + col * CELL_SIZE, y)
      ctx.lineTo(x + col * CELL_SIZE, y + h)
      ctx.stroke()
    }

    for (let row = 0; row <= GRID_ROWS; row++) {
      ctx.beginPath()
      ctx.moveTo(x, y + row * CELL_SIZE)
      ctx.lineTo(x + w, y + row * CELL_SIZE)
      ctx.stroke()
    }
  }

  // ---------------------------------------------------------------------------
  // Blocks
  // ---------------------------------------------------------------------------

  /**
   * Draws all locked blocks on the grid.
   *
   * @private
   * @param {(string|null)[][]} grid
   */
  _drawLockedBlocks(grid) {
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const color = grid[row][col]
        if (color) {
          this._drawCrate(
            PLAY_AREA_X + col * CELL_SIZE,
            PLAY_AREA_Y + row * CELL_SIZE,
            color
          )
        }
      }
    }
  }

  /**
   * Draws the current falling piece.
   *
   * @private
   * @param {Object} piece - {shape, color, x, y}
   */
  _drawCurrentPiece(piece) {
    const { shape, color, x, y } = piece
    for (let row = 0; row < shape.length; row++) {
      for (let col = 0; col < shape[row].length; col++) {
        if (shape[row][col]) {
          const drawY = y + row
          if (drawY < 0) continue // Don't draw above the grid
          this._drawCrate(
            PLAY_AREA_X + (x + col) * CELL_SIZE,
            PLAY_AREA_Y + drawY * CELL_SIZE,
            color
          )
        }
      }
    }
  }

  /**
   * Draws the ghost piece (drop shadow) showing where the piece will land.
   * Uses state.ghostY computed by the engine instead of duplicating
   * collision logic here.
   *
   * @private
   * @param {Object} state - State snapshot with current piece and ghostY
   */
  _drawGhostPiece(state) {
    const { current, ghostY } = state
    if (!current) return

    if (ghostY === current.y) return // Ghost is at same position as piece

    const ctx = this.ctx
    ctx.save()
    ctx.globalAlpha = 0.2

    for (let row = 0; row < current.shape.length; row++) {
      for (let col = 0; col < current.shape[row].length; col++) {
        if (current.shape[row][col]) {
          const drawY = ghostY + row
          if (drawY < 0) continue
          const px = PLAY_AREA_X + (current.x + col) * CELL_SIZE
          const py = PLAY_AREA_Y + drawY * CELL_SIZE
          ctx.fillStyle = current.color
          ctx.fillRect(px + 1, py + 1, CELL_SIZE - 2, CELL_SIZE - 2)
        }
      }
    }

    ctx.restore()
  }

  /**
   * Draws a single crate block -- the basic visual unit.
   * Styled as a wooden crate with bevel highlight and shadow edge.
   *
   * @private
   * @param {number} x - Pixel X
   * @param {number} y - Pixel Y
   * @param {string} color - Fill color
   */
  _drawCrate(x, y, color) {
    const ctx = this.ctx
    const s = CELL_SIZE
    const inset = 1

    // Main fill
    ctx.fillStyle = color
    ctx.fillRect(x + inset, y + inset, s - inset * 2, s - inset * 2)

    // Top + left bevel (light)
    ctx.fillStyle = COLORS.crateBevel
    ctx.fillRect(x + inset, y + inset, s - inset * 2, 2)
    ctx.fillRect(x + inset, y + inset, 2, s - inset * 2)

    // Bottom + right shadow
    ctx.fillStyle = COLORS.crateShadow
    ctx.fillRect(x + inset, y + s - inset - 2, s - inset * 2, 2)
    ctx.fillRect(x + s - inset - 2, y + inset, 2, s - inset * 2)

    // Subtle grain line through center
    ctx.fillStyle = COLORS.crateGrain
    ctx.fillRect(x + 4, y + Math.floor(s / 2), s - 8, 1)
  }

  // ---------------------------------------------------------------------------
  // Clear animation
  // ---------------------------------------------------------------------------

  /**
   * Draws a flash on rows being cleared.
   *
   * @private
   * @param {number[]} clearingRows
   * @param {number} clearTimer
   */
  _drawClearAnimation(clearingRows, clearTimer) {
    if (!clearingRows || clearingRows.length === 0 || clearTimer <= 0) return

    const ctx = this.ctx
    const alpha = clearTimer / 15 // Fades out over animation duration
    ctx.save()
    ctx.globalAlpha = alpha * 0.6
    ctx.fillStyle = COLORS.clearFlash

    for (const row of clearingRows) {
      ctx.fillRect(
        PLAY_AREA_X,
        PLAY_AREA_Y + row * CELL_SIZE,
        GRID_COLS * CELL_SIZE,
        CELL_SIZE
      )
    }

    ctx.restore()
  }

  // ---------------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------------

  /**
   * Draws the score/level/lines HUD.
   * Positioned in the right margin area alongside the grid.
   *
   * @private
   * @param {Object} state - State snapshot from engine
   */
  _drawHUD(state) {
    const ctx = this.ctx
    const rightX = GRID_COLS * CELL_SIZE + 10
    const topY = PLAY_AREA_Y + 10

    // Title
    ctx.fillStyle = COLORS.gold
    ctx.font = `bold 11px ${UI_FONT}`
    ctx.textAlign = "left"
    ctx.fillText("OVERBOARD!", rightX, topY)

    // Score
    ctx.fillStyle = COLORS.text
    ctx.font = `bold 9px ${UI_FONT}`
    ctx.fillText("SCORE", rightX, topY + 25)
    ctx.font = `bold 14px ${UI_FONT}`
    ctx.fillText(`${state.score}`, rightX, topY + 42)

    // Level
    ctx.font = `bold 9px ${UI_FONT}`
    ctx.fillText("LEVEL", rightX, topY + 70)
    ctx.font = `bold 14px ${UI_FONT}`
    ctx.fillText(`${state.level}`, rightX, topY + 87)

    // Lines
    ctx.font = `bold 9px ${UI_FONT}`
    ctx.fillText("LINES", rightX, topY + 115)
    ctx.font = `bold 14px ${UI_FONT}`
    ctx.fillText(`${state.lines}`, rightX, topY + 132)
  }

  // ---------------------------------------------------------------------------
  // Screens
  // ---------------------------------------------------------------------------

  /** @private Draws the start screen overlay. */
  _drawStartScreen() {
    const cx = (GRID_COLS * CELL_SIZE) / 2
    drawStartScreen(this.ctx, {
      title: "OVERBOARD!",
      lines: [
        { text: "Stack the cargo.", size: 14 },
        { text: "Don't let it reach the deck.", size: 14 },
        { text: "" },
        { text: "\u2190\u2192 Move  \u2191 Rotate  \u2193 Drop", size: 11 },
        { text: "SPACE Hard drop  Q Quit", size: 11 },
      ],
      startPrompt: "Press any arrow to start",
      canvasWidth: CANVAS_WIDTH, canvasHeight: CANVAS_HEIGHT,
      colors: COLORS, font: UI_FONT,
      layout: {
        cx, titleY: 220, titleSize: 28,
        descY: 255, descSize: 14, descGap: 20,
        promptY: 390, promptSize: 16, hintY: 415,
      },
    })
  }

  /**
   * Draws the basic game-over overlay (before leaderboard loads).
   *
   * @private
   * @param {Object} state - State snapshot from engine
   */
  _drawGameOver(state) {
    const cx = (GRID_COLS * CELL_SIZE) / 2
    drawBasicGameOver(this.ctx, {
      score: state.score,
      canvasWidth: CANVAS_WIDTH, canvasHeight: CANVAS_HEIGHT,
      colors: COLORS, font: UI_FONT,
      layout: {
        cx, headingY: 200, headingSize: 28,
        scoreY: 255, scoreSize: 40,
        hintSize: 12,
      },
    })
  }
}
