/**
 * Bayman! — Canvas renderer.
 *
 * Draws all visual elements: parallax boreal forest background,
 * scrolling ground trail, Honda Big Red trike with bayman rider,
 * obstacles (stumps, rocks, moose), and UI overlay (score, title,
 * start screen, game over screen).
 *
 * All drawing is procedural — no external images or sprite sheets.
 * The forest uses 4 parallax layers of spruce tree silhouettes
 * for depth, matching Newfoundland's dense boreal landscape.
 *
 * @module games/bayman/renderer
 */

import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GROUND_Y,
  PLAYER_HITBOX_HEIGHT,
  INVINCIBLE_DURATION,
  COLORS,
  UI_FONT,
  PHASE,
} from "./config.js"
import {
  drawStartScreen,
  drawBasicGameOver,
  drawLeaderboardOverlay,
  drawParticles,
  drawSpruce,
} from "../../engine/draw_utils.js"

/**
 * Canvas renderer for Bayman!
 *
 * @example
 * const renderer = new BaymanRenderer(canvas)
 * // In game loop:
 * renderer.draw(gameState)
 */
export class BaymanRenderer {
  /**
   * Creates a new renderer bound to the given canvas.
   *
   * @param {HTMLCanvasElement} canvas - The canvas element to draw on
   */
  constructor(canvas) {
    /** @type {HTMLCanvasElement} */
    this.canvas = canvas
    this.canvas.width = CANVAS_WIDTH
    this.canvas.height = CANVAS_HEIGHT

    /** @type {CanvasRenderingContext2D} */
    this.ctx = canvas.getContext("2d")
    this.ctx.imageSmoothingEnabled = false

    /** @type {import("./engine").GameState|null} Last rendered state (for redraw). */
    this._lastState = null

    /** @type {CanvasGradient} Cached sky gradient (never changes). */
    this._skyGradient = this.ctx.createLinearGradient(0, 0, 0, GROUND_Y)
    this._skyGradient.addColorStop(0, COLORS.skyTop)
    this._skyGradient.addColorStop(1, COLORS.skyBottom)

    /** @type {Array} Forest layer data for parallax rendering. */
    this.forestLayers = []
    this._initForest()
  }

  // ---------------------------------------------------------------------------
  // Forest initialization
  // ---------------------------------------------------------------------------

  /**
   * Generates dense boreal forest layers for parallax scrolling.
   *
   * Creates 4 layers from back to front with increasing density,
   * speed, and brightness. Trees are randomly positioned with
   * varied heights for a natural look.
   *
   * @private
   */
  _initForest() {
    const layers = [
      { speed: 0.08, color: COLORS.forest1, highlight: COLORS.forest1h, minH: 80, maxH: 120, density: 8 },
      { speed: 0.15, color: COLORS.forest2, highlight: COLORS.forest2h, minH: 70, maxH: 110, density: 10 },
      { speed: 0.25, color: COLORS.forest3, highlight: COLORS.forest3h, minH: 55, maxH: 95, density: 12 },
      { speed: 0.4, color: COLORS.forest4, highlight: COLORS.forest4h, minH: 40, maxH: 80, density: 14 },
    ]

    for (const layer of layers) {
      const trees = []
      const spacing = CANVAS_WIDTH / layer.density
      for (let i = 0; i < layer.density + 6; i++) {
        trees.push({
          x: i * spacing + (Math.random() - 0.5) * spacing * 0.6,
          h: layer.minH + Math.random() * (layer.maxH - layer.minH),
          w: 12 + Math.random() * 10,
        })
      }
      this.forestLayers.push({
        trees,
        speed: layer.speed,
        color: layer.color,
        highlight: layer.highlight,
        totalWidth: (layer.density + 6) * spacing,
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Main draw
  // ---------------------------------------------------------------------------

  /**
   * Main render method — draws all game elements for one frame.
   *
   * @param {import("./engine").GameState} state - Current game state
   */
  draw(state) {
    this._lastState = state
    this._drawScene(state)

    if (state.phase === PHASE.START) {
      this._drawStartScreen()
    } else if (state.phase === PHASE.DEAD) {
      this._drawGameOver(state)
    }
  }

  /**
   * Draws the game scene without overlays.
   *
   * @private
   * @param {import("./engine").GameState} state
   */
  _drawScene(state) {
    const ctx = this.ctx

    // Screen shake — offset the canvas for a few frames on obstacle smash
    const shaking = state.shakeTimer > 0
    if (shaking) {
      const intensity = Math.min(state.shakeTimer, 3)
      const sx = (Math.random() - 0.5) * intensity * 2
      const sy = (Math.random() - 0.5) * intensity * 2
      ctx.save()
      ctx.translate(sx, sy)
    }

    this._drawBackground()
    this._drawForest(state.groundOffset)
    this._drawGround(state.groundOffset)
    this._drawObstacles(state.obstacles)
    this._drawPowerups(state.powerups, state.frameCount)
    this._drawParticles(state.particles)
    this._drawScorePopups(state.scorePopups)
    this._drawTrike(state)
    if (state.invincibleTimer > 0) {
      this._drawInvincibleEffect(state)
    }

    if (shaking) ctx.restore()

    this._drawUI(state)
    this._drawPowerupFlash(state)
  }

  /**
   * Draws the game-over overlay with score and leaderboard.
   *
   * Called by the sidebar controller after score submission
   * and leaderboard fetch complete.
   *
   * @param {number} score - Final score
   * @param {Array<{user_name: string, score: number}>} leaderboard - Top scores
   * @param {boolean} isNewHighScore - Whether this is a new personal best
   */
  drawGameOverWithLeaderboard(score, leaderboard, isNewHighScore) {
    // Redraw the frozen scene to clear the basic game-over overlay,
    // then draw the leaderboard version on a clean canvas.
    if (this._lastState) {
      this._drawScene(this._lastState)
    }

    drawLeaderboardOverlay(this.ctx, {
      score, leaderboard, isNewHighScore,
      canvasWidth: CANVAS_WIDTH, canvasHeight: CANVAS_HEIGHT,
      colors: COLORS, font: UI_FONT,
    })
  }

  // ---------------------------------------------------------------------------
  // Background
  // ---------------------------------------------------------------------------

  /** @private Draws the sky gradient (uses cached gradient object). */
  _drawBackground() {
    this.ctx.fillStyle = this._skyGradient
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, GROUND_Y)
  }

  /**
   * Draws parallax forest layers.
   *
   * @private
   * @param {number} groundOffset - Current scroll distance
   */
  _drawForest(groundOffset) {
    for (const layer of this.forestLayers) {
      const offset = groundOffset * layer.speed
      for (const tree of layer.trees) {
        const tx = ((tree.x - offset) % layer.totalWidth + layer.totalWidth) % layer.totalWidth - 50
        if (tx + tree.w < 0 || tx > CANVAS_WIDTH) continue
        this._drawSpruce(tx, GROUND_Y, tree.h, tree.w, layer.color, layer.highlight)
      }
    }
  }

  /**
   * Draws a single spruce/fir tree silhouette.
   *
   * Three stacked triangular layers for that classic boreal look.
   *
   * @private
   */
  _drawSpruce(x, baseY, h, w, color, highlight) {
    drawSpruce(this.ctx, x, baseY, h, w, color, highlight, COLORS.trunkBrown)
  }

  // ---------------------------------------------------------------------------
  // Ground
  // ---------------------------------------------------------------------------

  /**
   * Draws the scrolling ground with trail texture.
   *
   * @private
   * @param {number} groundOffset - Current scroll distance
   */
  _drawGround(groundOffset) {
    const ctx = this.ctx

    ctx.fillStyle = COLORS.ground
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y)

    ctx.fillStyle = COLORS.groundEdge
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, 3)

    // Trail texture
    ctx.fillStyle = COLORS.groundDark
    const offset = groundOffset % 40
    for (let x = -offset; x < CANVAS_WIDTH + 40; x += 40) {
      ctx.fillRect(x, GROUND_Y + 10, 20, 2)
      ctx.fillRect(x + 15, GROUND_Y + 22, 15, 2)
    }

    // Grass tufts
    ctx.fillStyle = COLORS.groundLight
    const grassOffset = groundOffset % 60
    for (let x = -grassOffset; x < CANVAS_WIDTH + 60; x += 60) {
      ctx.fillRect(x, GROUND_Y - 2, 3, 4)
      ctx.fillRect(x + 25, GROUND_Y - 1, 2, 3)
    }
  }

  // ---------------------------------------------------------------------------
  // Trike + rider
  // ---------------------------------------------------------------------------

  /**
   * Draws a single wheel: tire, stroke, and axle dot.
   *
   * @private
   * @param {number} cx - Center X
   * @param {number} cy - Center Y
   * @param {number} outerR - Tire radius
   * @param {number} axleR - Axle dot radius
   */
  _drawWheel(cx, cy, outerR, axleR) {
    const ctx = this.ctx

    ctx.fillStyle = COLORS.trikeWheel
    ctx.beginPath()
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = COLORS.trikeWheelStroke
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2)
    ctx.stroke()

    ctx.fillStyle = COLORS.trikeAxle
    ctx.beginPath()
    ctx.arc(cx, cy, axleR, 0, Math.PI * 2)
    ctx.fill()
  }

  /**
   * Draws the Honda Big Red trike with bayman rider.
   *
   * Includes riding bounce animation and exhaust puffs.
   *
   * @private
   * @param {import("./engine").GameState} state
   */
  _drawTrike(state) {
    const ctx = this.ctx
    const x = state.playerX
    const y = state.playerY

    const bounce = (!state.isJumping && state.phase === PHASE.PLAYING)
      ? Math.sin(state.frameCount * 0.3) * 1.5 : 0
    const ty = y - PLAYER_HITBOX_HEIGHT + bounce

    // Wheelie when invincible — tilt back around the rear axle
    const invincible = state.invincibleTimer > 0
    if (invincible) {
      const pivotX = x + 6   // rear wheel center
      const pivotY = ty + 30
      ctx.save()
      ctx.translate(pivotX, pivotY)
      ctx.rotate(-0.25) // ~15 degrees back
      ctx.translate(-pivotX, -pivotY)
    }

    // --- Wheels ---
    this._drawWheel(x + 6, ty + 30, 9, 3)
    this._drawWheel(x + 44, ty + 30, 8, 2.5)

    // --- Body ---
    // Rear fender
    ctx.fillStyle = COLORS.trikeFender
    ctx.beginPath()
    ctx.arc(x + 6, ty + 30, 13, Math.PI, 0)
    ctx.fill()
    ctx.fillStyle = COLORS.trikeBody
    ctx.fillRect(x - 4, ty + 17, 20, 4)

    // Frame
    ctx.fillStyle = COLORS.trikeBody
    ctx.fillRect(x + 8, ty + 15, 28, 7)
    // Engine
    ctx.fillStyle = COLORS.trikeBodyDark
    ctx.fillRect(x + 22, ty + 18, 12, 10)
    // Seat
    ctx.fillStyle = COLORS.trikeSeat
    ctx.fillRect(x + 8, ty + 12, 16, 5)

    // Front fork
    ctx.fillStyle = COLORS.trikeAxle
    ctx.fillRect(x + 38, ty + 10, 3, 20)
    // Front fender
    ctx.fillStyle = COLORS.trikeFender
    ctx.beginPath()
    ctx.arc(x + 44, ty + 30, 11, Math.PI, 0)
    ctx.fill()

    // Handlebars
    ctx.fillStyle = COLORS.trikeHandlebars
    ctx.fillRect(x + 35, ty + 8, 12, 3)
    // Headlight
    ctx.fillStyle = COLORS.trikeHeadlight
    ctx.fillRect(x + 46, ty + 12, 3, 4)

    // Exhaust
    if (state.phase === PHASE.PLAYING && state.frameCount % 8 < 4) {
      ctx.fillStyle = COLORS.trikeExhaust
      ctx.beginPath()
      ctx.arc(x - 8, ty + 25, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x - 15, ty + 23, 3, 0, Math.PI * 2)
      ctx.fill()
    }

    // --- Bayman rider (side view) ---
    const rx = x + 8
    const ry = ty - 14

    // Back arm (behind body, reaching to handlebars)
    ctx.fillStyle = COLORS.flannelRed
    ctx.fillRect(rx + 16, ry + 7, 12, 4)
    ctx.fillStyle = COLORS.flannelDark
    ctx.fillRect(rx + 16, ry + 9, 12, 1)
    ctx.fillRect(rx + 20, ry + 7, 2, 3)
    // Back hand on grip
    ctx.fillStyle = COLORS.baymanSkinDark
    ctx.fillRect(rx + 26, ry + 6, 4, 5)

    // Torso — grey t-shirt showing through open flannel
    ctx.fillStyle = COLORS.teeGrey
    ctx.fillRect(rx + 3, ry + 4, 12, 16)

    // Flannel panels (open, plaid pattern simplified at sprite scale)
    ctx.fillStyle = COLORS.flannelRed
    ctx.fillRect(rx + 1, ry + 3, 4, 17)
    ctx.fillRect(rx + 13, ry + 3, 5, 17)
    // Dark plaid cross-stripes
    ctx.fillStyle = COLORS.flannelDark
    ctx.fillRect(rx + 1, ry + 8, 4, 2)
    ctx.fillRect(rx + 13, ry + 8, 5, 2)
    ctx.fillRect(rx + 1, ry + 14, 4, 2)
    ctx.fillRect(rx + 13, ry + 14, 5, 2)

    // Front arm (over body, reaching to handlebars)
    ctx.fillStyle = COLORS.flannelRed
    ctx.fillRect(rx + 16, ry + 3, 12, 4)
    ctx.fillStyle = COLORS.flannelDark
    ctx.fillRect(rx + 16, ry + 5, 12, 1)
    ctx.fillRect(rx + 22, ry + 3, 2, 3)
    // Front hand on handlebar
    ctx.fillStyle = COLORS.baymanSkin
    ctx.fillRect(rx + 26, ry + 2, 4, 5)

    // Neck
    ctx.fillStyle = COLORS.baymanSkin
    ctx.fillRect(rx + 6, ry - 2, 6, 6)

    // Head (side profile — oval)
    ctx.fillStyle = COLORS.baymanSkin
    ctx.beginPath()
    ctx.ellipse(rx + 9, ry - 7, 7, 7, 0, 0, Math.PI * 2)
    ctx.fill()

    // Ruddy jaw/cheek
    ctx.fillStyle = COLORS.baymanRuddy
    ctx.fillRect(rx + 12, ry - 7, 4, 6)

    // Nose (side profile, protruding right)
    ctx.fillStyle = COLORS.baymanRuddy
    ctx.fillRect(rx + 16, ry - 8, 2, 3)

    // Eye (squinting)
    ctx.fillStyle = COLORS.eyes
    ctx.fillRect(rx + 13, ry - 10, 2, 2)

    // Grin
    ctx.fillStyle = COLORS.text
    ctx.fillRect(rx + 14, ry - 4, 3, 1)
    ctx.fillStyle = COLORS.syrupBrown
    ctx.fillRect(rx + 14, ry - 3, 3, 1)

    // Stubble
    ctx.fillStyle = COLORS.baymanSkinDark
    ctx.fillRect(rx + 12, ry - 3, 1, 1)
    ctx.fillRect(rx + 14, ry - 2, 1, 1)
    ctx.fillRect(rx + 11, ry - 2, 1, 1)

    // Hair poking from under cap
    ctx.fillStyle = COLORS.hairBrown
    ctx.fillRect(rx + 2, ry - 10, 3, 4)
    // Sideburn
    ctx.fillRect(rx + 2, ry - 7, 2, 4)

    // Ball cap (side view)
    ctx.fillStyle = COLORS.capBlue
    ctx.fillRect(rx + 2, ry - 16, 13, 7)
    // Brim (extending forward)
    ctx.fillStyle = COLORS.capBlueDark
    ctx.fillRect(rx + 13, ry - 14, 7, 3)
    // Cap button
    ctx.fillStyle = COLORS.capBlueDark
    ctx.fillRect(rx + 8, ry - 16, 2, 1)

    // --- Legs (jeans, side view — sitting on trike) ---
    // Thigh — extends forward from torso toward foot peg
    ctx.fillStyle = COLORS.jeanBlue
    ctx.fillRect(rx + 5, ry + 19, 14, 5)
    // Knee bend
    ctx.fillStyle = COLORS.jeanBlueDark
    ctx.fillRect(rx + 17, ry + 20, 4, 7)
    // Shin — angled down to foot peg
    ctx.fillStyle = COLORS.jeanBlue
    ctx.fillRect(rx + 17, ry + 24, 5, 8)

    // Boot (rubber boot on foot peg)
    ctx.fillStyle = COLORS.bootBlack
    ctx.fillRect(rx + 16, ry + 31, 7, 4)
    // Boot sole
    ctx.fillStyle = COLORS.bootSole
    ctx.fillRect(rx + 15, ry + 35, 9, 2)

    // End wheelie rotation
    if (invincible) {
      ctx.restore()
    }
  }

  // ---------------------------------------------------------------------------
  // Obstacles
  // ---------------------------------------------------------------------------

  /**
   * Draws all active obstacles.
   *
   * @private
   * @param {import("./engine").Obstacle[]} obstacles
   */
  _drawObstacles(obstacles) {
    for (const obs of obstacles) {
      const x = obs.x
      const y = GROUND_Y - obs.height

      switch (obs.type) {
        case "stump":
          this._drawStump(x, y, obs.width, obs.height)
          break
        case "rock":
          this._drawRock(x, y, obs.width, obs.height)
          break
        case "moose":
          this._drawMoose(x, y)
          break
      }
    }
  }

  /** @private */
  _drawStump(x, y, w, h) {
    const ctx = this.ctx
    ctx.fillStyle = COLORS.stumpBrown
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = COLORS.stumpLight
    ctx.fillRect(x + 2, y, 4, h)
    ctx.fillRect(x, y, w, 4)
    ctx.fillStyle = COLORS.stumpBrown
    ctx.fillRect(x + 4, y + 1, w - 8, 2)
  }

  /** @private */
  _drawRock(x, y, w, h) {
    const ctx = this.ctx
    ctx.fillStyle = COLORS.rockGray
    ctx.beginPath()
    ctx.moveTo(x + 4, y + h)
    ctx.lineTo(x, y + h - 5)
    ctx.lineTo(x + 3, y + 4)
    ctx.lineTo(x + w / 2, y)
    ctx.lineTo(x + w - 3, y + 3)
    ctx.lineTo(x + w, y + h - 4)
    ctx.lineTo(x + w - 3, y + h)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = COLORS.rockLight
    ctx.beginPath()
    ctx.moveTo(x + 5, y + 6)
    ctx.lineTo(x + w / 2, y + 2)
    ctx.lineTo(x + w / 2 + 4, y + 6)
    ctx.lineTo(x + 8, y + 10)
    ctx.closePath()
    ctx.fill()
  }

  /** @private */
  _drawMoose(x, y) {
    const ctx = this.ctx
    ctx.fillStyle = COLORS.mooseBrown
    ctx.fillRect(x + 8, y + 15, 28, 18)
    ctx.fillRect(x + 30, y + 5, 8, 15)
    ctx.fillRect(x + 33, y + 2, 12, 10)
    ctx.fillStyle = COLORS.mooseLight
    ctx.fillRect(x + 35, y - 5, 3, 8)
    ctx.fillRect(x + 33, y - 5, 8, 3)
    ctx.fillRect(x + 42, y - 3, 3, 6)
    ctx.fillRect(x + 40, y - 3, 6, 3)
    ctx.fillStyle = COLORS.mooseBrown
    ctx.fillRect(x + 10, y + 33, 5, 17)
    ctx.fillRect(x + 20, y + 33, 5, 17)
    ctx.fillRect(x + 28, y + 33, 5, 17)
    ctx.fillStyle = COLORS.mooseLight
    ctx.fillRect(x + 8, y + 15, 28, 3)
  }

  // ---------------------------------------------------------------------------
  // Power-ups
  // ---------------------------------------------------------------------------

  /**
   * Draws all active power-ups with a bobbing float animation.
   *
   * Uses frameCount for bob/sparkle animations so they run at
   * consistent speed regardless of display refresh rate.
   *
   * @private
   * @param {Array} powerups
   * @param {number} frameCount - Engine frame count for animations
   */
  _drawPowerups(powerups, frameCount) {
    if (!powerups) return

    for (const pu of powerups) {
      const bob = Math.sin(frameCount * 0.083) * 3
      const x = pu.x
      const y = pu.y + bob

      // Sparkle ring
      const ctx = this.ctx
      ctx.save()
      ctx.globalAlpha = 0.4 + Math.sin(frameCount * 0.111) * 0.2
      ctx.strokeStyle = COLORS.gold
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(x + pu.width / 2, y + pu.height / 2, pu.width / 2 + 6, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()

      switch (pu.type) {
        case "vienna":
          this._drawVienna(x, y)
          break
        case "syrup":
          this._drawSyrup(x, y)
          break
        case "margarine":
          this._drawMargarine(x, y)
          break
      }
    }
  }

  /** @private Draws a small can of blue Vienna sausages. */
  _drawVienna(x, y) {
    const ctx = this.ctx
    // Can body
    ctx.fillStyle = COLORS.viennaBlue
    ctx.fillRect(x, y + 2, 20, 12)
    // Top/bottom rim
    ctx.fillStyle = COLORS.viennaLight
    ctx.fillRect(x, y, 20, 3)
    ctx.fillRect(x, y + 13, 20, 3)
    // Label stripe
    ctx.fillStyle = COLORS.viennaLabel
    ctx.fillRect(x + 3, y + 5, 14, 5)
  }

  /** @private Draws a bottle of Purity syrup. */
  _drawSyrup(x, y) {
    const ctx = this.ctx
    // Bottle body
    ctx.fillStyle = COLORS.syrupBrown
    ctx.fillRect(x + 2, y + 8, 10, 16)
    // Neck
    ctx.fillStyle = COLORS.syrupLight
    ctx.fillRect(x + 4, y + 3, 6, 6)
    // Cap
    ctx.fillStyle = COLORS.syrupCap
    ctx.fillRect(x + 3, y, 8, 4)
    // Label
    ctx.fillStyle = COLORS.syrupLabel
    ctx.fillRect(x + 3, y + 12, 8, 6)
  }

  /** @private Draws a block of Eversweet margarine. */
  _drawMargarine(x, y) {
    const ctx = this.ctx
    // Block
    ctx.fillStyle = COLORS.margarineYellow
    ctx.fillRect(x, y + 2, 22, 12)
    // Highlight edge
    ctx.fillStyle = COLORS.margarineLight
    ctx.fillRect(x, y + 2, 22, 3)
    // Wrapper text area
    ctx.fillStyle = COLORS.margText
    ctx.fillRect(x + 3, y + 6, 16, 5)
    // Foil ends
    ctx.fillStyle = "#C0C0C0"
    ctx.fillRect(x, y + 2, 3, 12)
    ctx.fillRect(x + 19, y + 2, 3, 12)
  }

  /**
   * Draws particle effects from obstacle smash.
   *
   * Particles come from the shared ParticleSystem via state snapshot.
   * Each particle has x, y, life, maxLife, color, and size.
   *
   * @private
   * @param {Array} particles
   */
  _drawParticles(particles) {
    drawParticles(this.ctx, particles)
  }

  /**
   * Draws floating "+5" score popups that rise and fade after smashing obstacles.
   *
   * @private
   * @param {Array} popups
   */
  _drawScorePopups(popups) {
    if (!popups || popups.length === 0) return

    const ctx = this.ctx
    ctx.fillStyle = COLORS.gold
    ctx.font = `bold 14px ${UI_FONT}`
    ctx.textAlign = "center"
    for (const pop of popups) {
      ctx.globalAlpha = Math.min(pop.life / 20, 1)
      ctx.fillText(pop.text, pop.x, pop.y)
    }
    ctx.globalAlpha = 1
  }

  /**
   * Draws a big centered flash announcing the power-up collected.
   *
   * @private
   * @param {import("./engine").GameState} state
   */
  _drawPowerupFlash(state) {
    if (!state.powerupFlash || state.powerupFlashTimer <= 0) return

    const ctx = this.ctx
    const names = {
      vienna: "VIENNA SAUSAGES!",
      syrup: "PURITY SYRUP!",
      margarine: "EVERSWEET!",
    }

    const text = names[state.powerupFlash] || state.powerupFlash.toUpperCase()
    const alpha = Math.min(state.powerupFlashTimer / 30, 1) // fade out over last 0.5s

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.textAlign = "center"

    // Drop shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)"
    ctx.font = `bold 22px ${UI_FONT}`
    ctx.fillText(text, CANVAS_WIDTH / 2 + 1, 65 + 1)

    // Gold text
    ctx.fillStyle = COLORS.gold
    ctx.fillText(text, CANVAS_WIDTH / 2, 65)

    // "+10" subtitle
    ctx.font = `bold 14px ${UI_FONT}`
    ctx.fillText(`+${10} INVINCIBLE!`, CANVAS_WIDTH / 2, 85)

    ctx.restore()
  }

  /**
   * Draws the invincibility effect — golden glow around trike, masked so
   * the glow appears behind the character without washing them out.
   *
   * @private
   * @param {import("./engine").GameState} state
   */
  _drawInvincibleEffect(state) {
    const ctx = this.ctx
    const x = state.playerX
    const y = state.playerY
    const expiring = state.invincibleTimer / INVINCIBLE_DURATION < 0.25

    // Pulsing glow — faster when expiring, using frameCount for
    // consistent animation speed across refresh rates
    const flashMultiplier = expiring ? 0.167 : 0.083
    const alpha = 0.3 + Math.sin(state.frameCount * flashMultiplier) * 0.2

    // Draw glow with the character area clipped out so it reads as
    // a halo behind the trike rather than a wash over the sprite.
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    ctx.ellipse(x + 25, y - 15, 28, 24, 0, 0, Math.PI * 2, true)
    ctx.clip()
    ctx.globalAlpha = alpha
    ctx.fillStyle = COLORS.invincibleGlow
    ctx.beginPath()
    ctx.ellipse(x + 25, y - 15, 38, 32, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------

  /**
   * Draws in-game UI: title and score.
   *
   * @private
   * @param {import("./engine").GameState} state
   */
  _drawUI(state) {
    const ctx = this.ctx

    // Score — top right
    ctx.fillStyle = COLORS.text
    ctx.font = `bold 16px ${UI_FONT}`
    ctx.textAlign = "right"
    ctx.fillText(`${state.score}`, CANVAS_WIDTH - 12, 22)

    // Title — top center
    ctx.textAlign = "center"
    ctx.fillText("BAYMAN!", CANVAS_WIDTH / 2, 22)

    // Power-up timer bar — top left, near the trike
    if (state.invincibleTimer > 0) {
      const fraction = state.invincibleTimer / INVINCIBLE_DURATION
      const expiring = fraction < 0.25
      const barWidth = 80
      const barX = 12
      const barY = 14

      // Background track
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)"
      ctx.beginPath()
      ctx.roundRect(barX, barY, barWidth, 6, 3)
      ctx.fill()

      // Fill — gold, turns red and flashes when expiring
      const barColor = expiring ? COLORS.syrupCap : COLORS.gold
      if (!expiring || Math.sin(state.frameCount * 0.208) > 0) {
        ctx.fillStyle = barColor
        ctx.beginPath()
        ctx.roundRect(barX, barY, barWidth * fraction, 6, 3)
        ctx.fill()
      }

      // Label
      ctx.fillStyle = COLORS.text
      ctx.font = `bold 10px ${UI_FONT}`
      ctx.textAlign = "left"
      ctx.fillText("INVINCIBLE", 12, barY + 16)
    }
  }

  /** @private Draws the start screen overlay. */
  _drawStartScreen() {
    drawStartScreen(this.ctx, {
      title: "BAYMAN!",
      lines: [
        { text: "Ride the Big Red. Jump the junks." },
        { text: "Dodge stumps, rocks, and the odd moose.", size: 14 },
        { text: "Grab a snack to go invincible!", size: 14 },
      ],
      startPrompt: "SPACE or CLICK to start",
      canvasWidth: CANVAS_WIDTH, canvasHeight: CANVAS_HEIGHT,
      colors: COLORS, font: UI_FONT,
      layout: { descGap: 28, promptY: 240, hintY: 265 },
    })
  }

  /**
   * Draws the basic game over overlay (no leaderboard).
   *
   * Used during the frame the engine reports death.
   * The base controller will draw the full leaderboard
   * version after API calls complete.
   *
   * @private
   * @param {import("./engine").GameState} state
   */
  _drawGameOver(state) {
    drawBasicGameOver(this.ctx, {
      score: state.score,
      highScore: state.highScore,
      canvasWidth: CANVAS_WIDTH, canvasHeight: CANVAS_HEIGHT,
      colors: COLORS, font: UI_FONT,
    })
  }
}
