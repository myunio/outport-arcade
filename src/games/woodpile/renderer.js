/**
 * Woodpile Tycoon — Canvas renderer.
 *
 * Procedural Canvas 2D renderer that draws era-specific scenes,
 * a flannel-wearing Newfoundlander character, tools/vehicles,
 * growing woodpile, particles, and UI overlays.
 *
 * Receives a state snapshot from the engine each frame via draw(state).
 * All drawing is procedural — no external images or sprite sheets.
 *
 * @module games/woodpile/renderer
 */

import { CANVAS_WIDTH, CANVAS_HEIGHT, TIERS, COLORS, UI_FONT, PHASE } from "./config.js"
import { drawStartScreen, drawLeaderboardOverlay, drawParticles, drawSpruce } from "../../engine/draw_utils.js"
import { SHARED_COLORS } from "../../engine/palette.js"

// Tools that are vehicles — drawn large in scene with character nearby
const VEHICLE_TOOLS = new Set([
  "splitter", "truck", "boomtruck", "skidder", "feller", "harvester", "bigcontract",
])

// Era names for the banner
const ERA_NAMES = {
  1: "Up the Brook",
  2: "Sellin' to the Neighbours",
  3: "Pulp & Paper",
  4: "Da Big Contract",
}

/**
 * Formats large numbers for display.
 *
 * @param {number} n
 * @returns {string}
 */
function formatNumber(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B"
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M"
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K"
  return Math.floor(n).toLocaleString()
}

/**
 * Canvas renderer for Woodpile Tycoon.
 *
 * @example
 * const renderer = new WoodpileRenderer(canvas)
 * // In game loop:
 * renderer.draw(engine.getState())
 */
export class WoodpileRenderer {
  /**
   * Creates a new renderer bound to the given canvas.
   *
   * @param {HTMLCanvasElement} canvas - The canvas element to draw on
   */
  constructor(canvas) {
    /** @type {HTMLCanvasElement} */
    this.canvas = canvas
    canvas.width = CANVAS_WIDTH
    canvas.height = CANVAS_HEIGHT

    /** @type {CanvasRenderingContext2D} */
    this.ctx = canvas.getContext("2d")

    /** @type {import("./engine").GameState|null} Last rendered state (for redraw). */
    this._lastState = null

    /** @type {Array} Forest layer data for parallax-style depth. */
    this.forestLayers = []
    this._initForest()
  }

  // ---------------------------------------------------------------------------
  // Forest initialization — dense boreal forest like Bayman
  // ---------------------------------------------------------------------------

  /**
   * Generates dense boreal forest layers with depth.
   *
   * Creates 4 layers from back to front with increasing brightness
   * and tree size. Static positions (no scrolling) but layered for
   * parallax-style depth, matching Newfoundland's dense boreal landscape.
   *
   * @private
   */
  _initForest() {
    const layers = [
      { color: "#1A3A18", highlight: "#1F4220", minH: 90, maxH: 130, density: 14 },
      { color: "#234A20", highlight: "#2A5426", minH: 75, maxH: 115, density: 12 },
      { color: "#2A5624", highlight: "#32622C", minH: 60, maxH: 100, density: 10 },
      { color: "#2D5A27", highlight: "#366830", minH: 45, maxH: 85, density: 8 },
    ]

    for (const layer of layers) {
      const trees = []
      const spacing = CANVAS_WIDTH / layer.density
      for (let i = 0; i < layer.density + 4; i++) {
        trees.push({
          x: i * spacing + (Math.random() - 0.5) * spacing * 0.6,
          h: layer.minH + Math.random() * (layer.maxH - layer.minH),
          w: 14 + Math.random() * 12,
        })
      }
      this.forestLayers.push({
        trees,
        color: layer.color,
        highlight: layer.highlight,
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Main draw
  // ---------------------------------------------------------------------------

  /**
   * Main render method — draws all game elements for one frame.
   *
   * @param {Object} state - Current game state snapshot from engine
   */
  draw(state) {
    this._lastState = state
    this._drawScene(state)

    if (state.phase === PHASE.START) {
      this._drawStartScreen()
    }
  }

  /**
   * Draws the game scene without overlays.
   *
   * @private
   * @param {Object} state
   */
  _drawScene(state) {
    const ctx = this.ctx
    const era = state.era

    // Screen shake
    const shaking = state.shakeTimer > 0
    if (shaking) {
      const intensity = Math.min(state.shakeTimer, 3)
      const sx = (Math.random() - 0.5) * intensity * 0.5
      const sy = (Math.random() - 0.5) * intensity * 0.5
      ctx.save()
      ctx.translate(sx, sy)
    }

    // Scene layers
    this._drawSky(era)
    this._drawForest(era)
    this._drawClouds(state.frameCount)
    this._drawGround(era)
    this._drawEraDetails(era)

    // Character + tool/vehicle
    this._drawCharacterAndTool(state)

    // Woodpile
    this._drawWoodpile(state.logs, state.tierIndex, state.tier)

    // Particles
    this._drawParticles(state.particles)

    if (shaking) ctx.restore()

    // UI (not affected by shake)
    this._drawLogCounter(state.logs, era)
    this._drawEraBanner(era)
    this._drawCurrentTier(state.tier)
    this._drawIdleIndicator(state.tier)
    this._drawProgressBar(state)
    this._drawTransformFlash(state)
    this._drawIdleEarnings(state)
  }

  /**
   * Draws the game-over overlay with leaderboard.
   *
   * @param {number} score - Final score (logs)
   * @param {Array<{user_name: string, score: number}>} leaderboard
   * @param {boolean} isNewHighScore
   */
  drawGameOverWithLeaderboard(score, leaderboard, isNewHighScore) {
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

  /**
   * Draws the sky gradient for the current era.
   *
   * @private
   * @param {number} era
   */
  _drawSky(era) {
    const ctx = this.ctx
    const topKey = `sky${era}Top`
    const bottomKey = `sky${era}Bottom`
    const grad = ctx.createLinearGradient(0, 0, 0, 260)
    grad.addColorStop(0, COLORS[topKey] || COLORS.sky1Top)
    grad.addColorStop(1, COLORS[bottomKey] || COLORS.sky1Bottom)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, CANVAS_WIDTH, 260)
  }

  /**
   * Draws dense parallax forest layers.
   *
   * Tree density reduces per era (logging clears the forest).
   * Era 4 shows mostly stumps with sparse trees.
   *
   * @private
   * @param {number} era
   */
  _drawForest(era) {
    // Show fewer layers in later eras (forest gets cleared)
    const layersToShow = { 1: 4, 2: 4, 3: 3, 4: 2 }
    const count = layersToShow[era] || 4

    for (let l = 0; l < count; l++) {
      const layer = this.forestLayers[l]
      // Skip some trees in later eras to thin the forest
      const skipRate = era >= 3 ? 0.3 : 0
      for (const tree of layer.trees) {
        if (skipRate > 0 && this._hash(tree.x) < skipRate) continue
        if (tree.x + tree.w < 0 || tree.x > CANVAS_WIDTH) continue
        this._drawSpruce(tree.x, 260, tree.h, tree.w, layer.color, layer.highlight)
      }
    }
  }

  /**
   * Simple deterministic hash for consistent tree skipping.
   *
   * @private
   * @param {number} x
   * @returns {number} 0-1
   */
  _hash(x) {
    const n = Math.sin(x * 127.1) * 43758.5453
    return n - Math.floor(n)
  }

  /**
   * Draws a single spruce tree silhouette with 3 layered triangles.
   *
   * @private
   */
  _drawSpruce(x, baseY, h, w, color, highlight) {
    drawSpruce(this.ctx, x, baseY, h, w, color, highlight, COLORS.treeTrunk)
  }

  /**
   * Draws drifting clouds.
   *
   * @private
   * @param {number} frameCount
   */
  _drawClouds(frameCount) {
    const ctx = this.ctx
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, CANVAS_WIDTH, 255)
    ctx.clip()

    ctx.fillStyle = "rgba(255,255,255,0.4)"
    for (let i = 0; i < 3; i++) {
      const x = ((frameCount * 0.01 * (i + 1) * 0.5 + i * 250) % (CANVAS_WIDTH + 100)) - 50
      const y = 30 + i * 35
      const size = 30 + i * 10
      ctx.beginPath()
      ctx.arc(x, y, size * 0.5, 0, Math.PI * 2)
      ctx.arc(x + size * 0.4, y - size * 0.15, size * 0.4, 0, Math.PI * 2)
      ctx.arc(x + size * 0.8, y, size * 0.35, 0, Math.PI * 2)
      ctx.arc(x + size * 0.35, y + size * 0.1, size * 0.3, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  }

  /**
   * Draws the ground plane with grass texture.
   *
   * @private
   * @param {number} era
   */
  _drawGround(era) {
    const ctx = this.ctx
    const groundKey = `ground${era}`
    ctx.fillStyle = COLORS[groundKey] || COLORS.ground1
    ctx.fillRect(0, 260, CANVAS_WIDTH, CANVAS_HEIGHT - 260)

    // Grass/texture lines
    ctx.strokeStyle = "rgba(0,0,0,0.1)"
    ctx.lineWidth = 1
    for (let i = 0; i < 20; i++) {
      const x = (i * 37 + 10) % CANVAS_WIDTH
      const y = 270 + Math.sin(i * 2.3) * 30 + 40
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + 8, y - 5)
      ctx.stroke()
    }
  }

  // ---------------------------------------------------------------------------
  // Era-specific scene details
  // ---------------------------------------------------------------------------

  /**
   * Draws era-specific background elements.
   *
   * @private
   * @param {number} era
   */
  _drawEraDetails(era) {
    if (era === 1) {
      this._drawChoppingBlock(230, 280)
    } else if (era === 2) {
      this._drawHouseAndFence()
    } else if (era === 3) {
      this._drawLogDeck()
    } else if (era === 4) {
      this._drawPowerLines()
    }
  }

  /** @private Draws a chopping block stump. */
  _drawChoppingBlock(x, y) {
    const ctx = this.ctx
    // Stump body
    ctx.fillStyle = "#8B6914"
    ctx.beginPath()
    ctx.ellipse(x, y, 16, 8, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "#7A5A10"
    ctx.fillRect(x - 16, y, 32, 20)
    ctx.fillStyle = "#6A4A08"
    ctx.beginPath()
    ctx.ellipse(x, y + 20, 16, 8, 0, 0, Math.PI * 2)
    ctx.fill()

    // Top grain
    ctx.fillStyle = "#9A7A20"
    ctx.beginPath()
    ctx.ellipse(x, y, 12, 5, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = "#7A5A10"
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.ellipse(x, y, 8, 3, 0, 0, Math.PI * 2)
    ctx.stroke()
  }

  /** @private Draws house and fence for era 2. */
  _drawHouseAndFence() {
    const ctx = this.ctx

    // Yard fence
    ctx.strokeStyle = "#8B7355"
    ctx.lineWidth = 3
    for (let i = 0; i < 4; i++) {
      const x = 420 + i * 25
      ctx.beginPath()
      ctx.moveTo(x, 255)
      ctx.lineTo(x, 300)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.moveTo(420, 270)
    ctx.lineTo(495, 270)
    ctx.moveTo(420, 290)
    ctx.lineTo(495, 290)
    ctx.stroke()

    // House
    ctx.fillStyle = "#8B4513"
    ctx.fillRect(440, 200, 60, 55)
    ctx.fillStyle = "#A0522D"
    ctx.beginPath()
    ctx.moveTo(435, 200)
    ctx.lineTo(470, 175)
    ctx.lineTo(505, 200)
    ctx.closePath()
    ctx.fill()
    // Windows
    ctx.fillStyle = "#A8D8EA"
    ctx.fillRect(455, 215, 15, 15)
    ctx.fillRect(475, 215, 15, 15)
  }

  /** @private Draws landing/log deck for era 3. */
  _drawLogDeck() {
    const ctx = this.ctx
    ctx.fillStyle = "#5A4A30"
    ctx.fillRect(380, 270, 120, 8)

    // Stacked logs on deck
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = "#7A6040"
        ctx.fillRect(385 + i * 14, 250 - row * 10, 12, 8)
        ctx.fillStyle = "#8B7355"
        ctx.beginPath()
        ctx.ellipse(385 + i * 14, 254 - row * 10, 1.5, 4, 0, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  /** @private Draws power line towers and cleared corridor for era 4. */
  _drawPowerLines() {
    const ctx = this.ctx

    // Cleared corridor
    ctx.fillStyle = "#6B7B5A"
    ctx.fillRect(380, 260, 320, CANVAS_HEIGHT - 260)

    // Power line towers
    for (let i = 0; i < 3; i++) {
      const x = 400 + i * 100
      ctx.strokeStyle = "#555"
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(x, 260)
      ctx.lineTo(x, 160 - i * 15)
      ctx.stroke()

      // Cross arms
      ctx.beginPath()
      ctx.moveTo(x - 15, 170 - i * 15)
      ctx.lineTo(x + 15, 170 - i * 15)
      ctx.moveTo(x - 12, 185 - i * 15)
      ctx.lineTo(x + 12, 185 - i * 15)
      ctx.stroke()

      // Wires to next tower
      if (i < 2) {
        ctx.strokeStyle = "#444"
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x + 15, 170 - i * 15)
        ctx.quadraticCurveTo(x + 50, 190 - i * 15, x + 100 - 15, 170 - (i + 1) * 15)
        ctx.stroke()
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Character + tools
  // ---------------------------------------------------------------------------

  /**
   * Draws the character and their current tool or vehicle.
   *
   * @private
   * @param {Object} state
   */
  _drawCharacterAndTool(state) {
    const era = state.era
    const tool = state.tier.tool
    const charX = era <= 2 ? 180 : 150
    const charY = era <= 1 ? 260 : 265

    if (tool === "buddy") {
      // Two characters side by side — Den and his buddy both chopping
      this._drawCharacter(charX - 20, charY, "axe", state.frameCount, state.clickAnim)
      this._drawBuddy(charX + 40, charY, state.frameCount)
    } else if (VEHICLE_TOOLS.has(tool)) {
      // Vehicle tiers: draw vehicle large in scene, character nearby
      this.ctx.save()
      this.ctx.translate(charX + 40, charY + 15)
      this.ctx.scale(1.8, 1.8)
      this._drawTool(0, 0, tool)
      this.ctx.restore()
      // Character standing nearby (no tool in hand)
      this._drawCharacter(charX - 30, charY, null, state.frameCount, state.clickAnim)
    } else {
      this._drawCharacter(charX, charY, tool, state.frameCount, state.clickAnim)
    }
  }

  /**
   * Draws a person (character or buddy) with configurable colors.
   *
   * @private
   * @param {number} x - Center X
   * @param {number} y - Base Y
   * @param {Object} opts
   * @param {string} opts.flannel - Main flannel color
   * @param {string} opts.flannelDark - Dark flannel lines color
   * @param {string} opts.pants - Pants color
   * @param {string} opts.toque - Toque color
   * @param {string|null} opts.tool - Tool to hold, or null
   * @param {number} opts.frameCount - For bob animation
   * @param {number} [opts.clickAnim=0] - Chop swing animation timer
   * @param {number} [opts.bobPhase=0] - Phase offset for bob animation
   */
  _drawPerson(x, y, opts) {
    const ctx = this.ctx
    const bob = Math.sin(opts.frameCount * 0.05 + (opts.bobPhase || 0)) * 2
    const chopSwing = (opts.clickAnim || 0) > 0 ? Math.sin(opts.clickAnim * 0.3) * 25 : 0

    ctx.save()
    ctx.translate(x, y + bob)

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.15)"
    ctx.beginPath()
    ctx.ellipse(0, 45, 20, 6, 0, 0, Math.PI * 2)
    ctx.fill()

    // Legs
    ctx.fillStyle = opts.pants
    ctx.fillRect(-8, 20, 6, 24)
    ctx.fillRect(2, 20, 6, 24)

    // Boots
    ctx.fillStyle = COLORS.boots
    ctx.fillRect(-10, 40, 9, 6)
    ctx.fillRect(1, 40, 9, 6)

    // Body (flannel)
    ctx.fillStyle = opts.flannel
    ctx.fillRect(-10, -5, 20, 26)
    ctx.fillStyle = opts.flannelDark
    ctx.fillRect(-10, 0, 20, 2)
    ctx.fillRect(-10, 8, 20, 2)
    ctx.fillRect(-10, 16, 20, 2)
    ctx.fillRect(-4, -5, 2, 26)
    ctx.fillRect(4, -5, 2, 26)

    // Head
    ctx.fillStyle = COLORS.skin
    ctx.beginPath()
    ctx.arc(0, -14, 10, 0, Math.PI * 2)
    ctx.fill()

    // Toque
    ctx.fillStyle = opts.toque
    ctx.beginPath()
    ctx.arc(0, -22, 8, Math.PI, 0)
    ctx.fill()
    ctx.fillRect(-8, -24, 16, 4)
    ctx.fillStyle = "#FFF"
    ctx.beginPath()
    ctx.arc(0, -27, 3, 0, Math.PI * 2)
    ctx.fill()

    // Face
    ctx.fillStyle = "#333"
    ctx.fillRect(-4, -16, 2, 2)
    ctx.fillRect(2, -16, 2, 2)
    ctx.strokeStyle = "#333"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(0, -12, 4, 0.1, Math.PI - 0.1)
    ctx.stroke()

    // Right arm + tool
    if (opts.tool) {
      ctx.save()
      ctx.translate(12, 2)
      ctx.rotate(chopSwing * Math.PI / 180)
      ctx.fillStyle = COLORS.skin
      ctx.fillRect(0, -2, 18, 5)
      this._drawTool(18, 0, opts.tool)
      ctx.restore()
    } else {
      ctx.fillStyle = COLORS.skin
      ctx.fillRect(10, 0, 12, 5)
    }

    // Left arm
    ctx.fillStyle = COLORS.skin
    ctx.fillRect(-16, 0, 14, 5)

    ctx.restore()
  }

  /**
   * Draws the flannel-wearing Newfoundlander character.
   *
   * @private
   * @param {number} x - Center X
   * @param {number} y - Base Y
   * @param {string|null} toolType - Hand tool to draw, or null
   * @param {number} frameCount - For idle animation
   * @param {number} clickAnim - Click animation timer
   */
  _drawCharacter(x, y, toolType, frameCount, clickAnim) {
    this._drawPerson(x, y, {
      flannel: COLORS.flannel, flannelDark: COLORS.flannelDark,
      pants: COLORS.jeans, toque: COLORS.toque,
      tool: toolType, frameCount, clickAnim,
    })
  }

  /**
   * Draws a tool or vehicle at the given position.
   *
   * @private
   * @param {number} x
   * @param {number} y
   * @param {string} type
   */
  _drawTool(x, y, type) {
    const ctx = this.ctx
    ctx.save()
    ctx.translate(x, y)

    switch (type) {
      case "bucksaw":
        this._drawBucksaw()
        break
      case "axe":
        this._drawAxe()
        break
      case "maul":
        this._drawMaul()
        break
      case "chainsaw":
        this._drawChainsaw()
        break
      case "splitter":
        this._drawSplitter()
        break
      case "truck":
        this._drawTruck()
        break
      case "boomtruck":
        this._drawBoomTruck()
        break
      case "skidder":
        this._drawSkidder()
        break
      case "feller":
        this._drawFellerBuncher()
        break
      case "harvester":
        this._drawHarvester()
        break
      case "bigcontract":
        this._drawBigContract()
        break
    }

    ctx.restore()
  }

  /** @private */
  _drawBucksaw() {
    const ctx = this.ctx
    // Handle
    ctx.fillStyle = "#8B6914"
    ctx.fillRect(0, -2, 30, 4)
    // Blade
    ctx.fillStyle = "#C0C0C0"
    ctx.fillRect(8, 2, 20, 2)
    // Teeth
    ctx.strokeStyle = "#A0A0A0"
    ctx.lineWidth = 1
    for (let i = 0; i < 8; i++) {
      ctx.beginPath()
      ctx.moveTo(10 + i * 2.2, 4)
      ctx.lineTo(11 + i * 2.2, 6)
      ctx.stroke()
    }
    // Frame
    ctx.strokeStyle = "#8B6914"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(6, -2)
    ctx.lineTo(6, -12)
    ctx.lineTo(28, -12)
    ctx.lineTo(28, -2)
    ctx.stroke()
  }

  /** @private */
  _drawAxe() {
    const ctx = this.ctx
    // Handle — long wooden shaft
    ctx.fillStyle = "#8B6914"
    ctx.fillRect(0, -2, 34, 4)

    // Axe head — side profile, blade drops down from handle
    ctx.fillStyle = "#707070"
    ctx.beginPath()
    ctx.moveTo(28, -4)    // top of head, back
    ctx.lineTo(36, -4)    // top of head, front
    ctx.lineTo(38, -2)    // curves into blade
    ctx.lineTo(40, 8)     // blade drops down
    ctx.lineTo(36, 14)    // bottom tip of cutting edge
    ctx.lineTo(32, 10)    // inside curve of blade
    ctx.lineTo(30, 4)     // back up to handle
    ctx.lineTo(28, 2)     // bottom of head, back
    ctx.closePath()
    ctx.fill()

    // Cutting edge — lighter steel on the sharp side
    ctx.fillStyle = "#A0A0A0"
    ctx.beginPath()
    ctx.moveTo(38, -2)
    ctx.lineTo(41, 8)
    ctx.lineTo(37, 14)
    ctx.lineTo(36, 14)
    ctx.lineTo(40, 8)
    ctx.lineTo(38, -1)
    ctx.closePath()
    ctx.fill()
  }

  /** @private */
  _drawMaul() {
    const ctx = this.ctx
    ctx.fillStyle = "#8B6914"
    ctx.fillRect(0, -2, 35, 5)
    // Heavy wedge head
    ctx.fillStyle = "#606060"
    ctx.beginPath()
    ctx.moveTo(28, -10)
    ctx.lineTo(40, -4)
    ctx.lineTo(40, 8)
    ctx.lineTo(28, 14)
    ctx.lineTo(26, 2)
    ctx.closePath()
    ctx.fill()
    // Weight lines
    ctx.strokeStyle = "#505050"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(30, -6)
    ctx.lineTo(30, 10)
    ctx.moveTo(33, -5)
    ctx.lineTo(33, 9)
    ctx.stroke()
  }

  /** @private */
  _drawChainsaw() {
    const ctx = this.ctx
    // Body
    ctx.fillStyle = "#E67E22"
    ctx.beginPath()
    ctx.roundRect(0, -8, 22, 16, 3)
    ctx.fill()
    // Bar
    ctx.fillStyle = "#808080"
    ctx.fillRect(20, -3, 25, 6)
    // Chain outline
    ctx.strokeStyle = "#505050"
    ctx.lineWidth = 2
    ctx.strokeRect(20, -3, 25, 6)
    // Nose sprocket
    ctx.beginPath()
    ctx.arc(45, 0, 3, -Math.PI / 2, Math.PI / 2)
    ctx.fillStyle = "#808080"
    ctx.fill()
    // Handles
    ctx.fillStyle = "#333"
    ctx.fillRect(2, 8, 8, 5)
    ctx.fillRect(12, -13, 4, 8)
    // Pull cord
    ctx.fillStyle = "#C0392B"
    ctx.beginPath()
    ctx.arc(-3, 0, 3, 0, Math.PI * 2)
    ctx.fill()
  }

  /** @private */
  _drawSplitter() {
    const ctx = this.ctx
    // Base platform
    ctx.fillStyle = "#666"
    ctx.fillRect(-5, 5, 50, 8)
    // Hydraulic cylinder
    ctx.fillStyle = "#888"
    ctx.fillRect(0, -5, 8, 10)
    // Ram
    ctx.fillStyle = "#AAA"
    ctx.fillRect(8, -3, 15, 6)
    // Wedge
    ctx.fillStyle = "#606060"
    ctx.beginPath()
    ctx.moveTo(23, -6)
    ctx.lineTo(28, 0)
    ctx.lineTo(23, 6)
    ctx.closePath()
    ctx.fill()
    // Log on splitter
    ctx.fillStyle = "#8B6914"
    ctx.beginPath()
    ctx.ellipse(36, 2, 6, 8, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "#A07828"
    ctx.beginPath()
    ctx.ellipse(36, 2, 4, 6, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  /** @private */
  _drawTruck() {
    const ctx = this.ctx
    // Truck body
    ctx.fillStyle = "#2C5F8A"
    ctx.fillRect(-5, -12, 35, 16)
    // Cab
    ctx.fillStyle = "#3A7BB8"
    ctx.fillRect(-5, -18, 16, 8)
    // Windshield
    ctx.fillStyle = "#A8D8EA"
    ctx.fillRect(-2, -16, 10, 5)
    // Bed
    ctx.fillStyle = "#666"
    ctx.fillRect(12, -12, 25, 3)
    // Logs in bed
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = "#8B6914"
      ctx.beginPath()
      ctx.ellipse(18 + i * 5, -15, 2.5, 3, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    // Wheels
    ctx.fillStyle = "#222"
    ctx.beginPath()
    ctx.arc(2, 6, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(28, 6, 5, 0, Math.PI * 2)
    ctx.fill()
    // Hubcaps
    ctx.fillStyle = "#666"
    ctx.beginPath()
    ctx.arc(2, 6, 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(28, 6, 2, 0, Math.PI * 2)
    ctx.fill()
  }

  /**
   * Draws the "Hire a Buddy" — a second character with an axe,
   * same size as the main character but green flannel + blue toque.
   *
   * @private
   * @param {number} x - Center X
   * @param {number} y - Base Y
   * @param {number} frameCount - For idle animation
   */
  _drawBuddy(x, y, frameCount) {
    this._drawPerson(x, y, {
      flannel: "#2D6B2D", flannelDark: "#1A4A1A",
      pants: "#4A6A4A", toque: "#2C5F8A",
      tool: "axe", frameCount, bobPhase: 1.5,
    })
  }

  /** @private */
  _drawBoomTruck() {
    const ctx = this.ctx
    // Truck body
    ctx.fillStyle = "#D4A017"
    ctx.fillRect(-5, -8, 30, 14)
    // Cab
    ctx.fillStyle = "#B8860B"
    ctx.fillRect(-5, -16, 14, 10)
    ctx.fillStyle = "#A8D8EA"
    ctx.fillRect(-2, -14, 9, 5)
    // Flatbed
    ctx.fillStyle = "#888"
    ctx.fillRect(10, -8, 28, 3)
    // Boom arm
    ctx.strokeStyle = "#D4A017"
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(18, -8)
    ctx.lineTo(22, -28)
    ctx.lineTo(38, -22)
    ctx.stroke()
    // Hydraulic cylinders
    ctx.strokeStyle = "#AAA"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(16, -6)
    ctx.lineTo(20, -20)
    ctx.stroke()
    // Grapple
    ctx.strokeStyle = "#666"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(38, -22)
    ctx.lineTo(36, -16)
    ctx.moveTo(38, -22)
    ctx.lineTo(40, -16)
    ctx.stroke()
    // Wheels
    ctx.fillStyle = "#222"
    ctx.beginPath(); ctx.arc(0, 8, 5, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(15, 8, 5, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(30, 8, 5, 0, Math.PI * 2); ctx.fill()
  }

  /** @private */
  _drawSkidder() {
    const ctx = this.ctx
    // Body
    ctx.fillStyle = "#2E7D32"
    ctx.fillRect(-5, -14, 35, 18)
    // Cab
    ctx.fillStyle = "#388E3C"
    ctx.fillRect(-2, -22, 16, 10)
    ctx.fillStyle = "#A8D8EA"
    ctx.fillRect(0, -20, 12, 6)
    // Grapple at back
    ctx.fillStyle = "#888"
    ctx.beginPath()
    ctx.moveTo(30, -14)
    ctx.lineTo(40, -18)
    ctx.lineTo(42, -6)
    ctx.lineTo(30, 4)
    ctx.closePath()
    ctx.fill()
    // Cable
    ctx.strokeStyle = "#555"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(36, -12)
    ctx.lineTo(50, -8)
    ctx.lineTo(50, 4)
    ctx.stroke()
    // Big wheels
    ctx.fillStyle = "#222"
    ctx.beginPath(); ctx.arc(2, 8, 8, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(26, 8, 8, 0, Math.PI * 2); ctx.fill()
    // Tire treads
    ctx.fillStyle = "#333"
    ctx.beginPath(); ctx.arc(2, 8, 5, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(26, 8, 5, 0, Math.PI * 2); ctx.fill()
  }

  /** @private */
  _drawFellerBuncher() {
    const ctx = this.ctx
    // Tracked base
    ctx.fillStyle = "#222"
    ctx.beginPath()
    ctx.roundRect(-8, 2, 45, 10, 3)
    ctx.fill()
    ctx.fillStyle = "#333"
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(-5 + i * 7, 4, 4, 6)
    }
    // Body
    ctx.fillStyle = "#D4A017"
    ctx.fillRect(0, -12, 25, 16)
    // Cab
    ctx.fillStyle = "#B8860B"
    ctx.fillRect(2, -22, 14, 12)
    ctx.fillStyle = "#A8D8EA"
    ctx.fillRect(4, -20, 10, 7)
    // Boom arm
    ctx.strokeStyle = "#888"
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(25, -8)
    ctx.lineTo(38, -25)
    ctx.lineTo(48, -18)
    ctx.stroke()
    // Cutting head
    ctx.fillStyle = "#C0392B"
    ctx.beginPath()
    ctx.arc(48, -18, 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "#888"
    ctx.fillRect(45, -22, 6, 2)
  }

  /** @private */
  _drawHarvester() {
    const ctx = this.ctx
    // Tracked base (bigger)
    ctx.fillStyle = "#222"
    ctx.beginPath()
    ctx.roundRect(-10, 4, 55, 12, 4)
    ctx.fill()
    ctx.fillStyle = "#333"
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(-7 + i * 7, 6, 4, 8)
    }
    // Large body
    ctx.fillStyle = "#2E7D32"
    ctx.fillRect(-2, -16, 35, 22)
    // Cab with ROPS
    ctx.fillStyle = "#388E3C"
    ctx.fillRect(0, -28, 18, 14)
    ctx.fillStyle = "#A8D8EA"
    ctx.fillRect(2, -26, 14, 9)
    // Processing boom
    ctx.strokeStyle = "#AAA"
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.moveTo(33, -10)
    ctx.lineTo(45, -30)
    ctx.lineTo(58, -20)
    ctx.stroke()
    // Harvester head
    ctx.fillStyle = "#D4A017"
    ctx.fillRect(52, -26, 12, 14)
    // Feed rollers
    ctx.fillStyle = "#666"
    ctx.beginPath(); ctx.arc(55, -24, 3, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(55, -15, 3, 0, Math.PI * 2); ctx.fill()
    // Saw
    ctx.fillStyle = "#C0C0C0"
    ctx.beginPath(); ctx.arc(61, -20, 4, 0, Math.PI * 2); ctx.fill()
  }

  /** @private */
  _drawBigContract() {
    const ctx = this.ctx
    // Command center vehicle
    ctx.fillStyle = "#2C3E50"
    ctx.fillRect(-5, -10, 50, 18)
    ctx.fillStyle = "#34495E"
    ctx.fillRect(-5, -18, 20, 10)
    ctx.fillStyle = "#A8D8EA"
    ctx.fillRect(-2, -16, 14, 6)
    // Antenna
    ctx.strokeStyle = "#888"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(30, -10)
    ctx.lineTo(30, -28)
    ctx.stroke()
    ctx.fillStyle = "#C0392B"
    ctx.beginPath(); ctx.arc(30, -28, 2, 0, Math.PI * 2); ctx.fill()
    // Wheels
    ctx.fillStyle = "#222"
    ctx.beginPath(); ctx.arc(2, 12, 6, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(18, 12, 6, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(36, 12, 6, 0, Math.PI * 2); ctx.fill()
  }

  // ---------------------------------------------------------------------------
  // Woodpile
  // ---------------------------------------------------------------------------

  /**
   * Draws the growing woodpile — stacked log ends.
   *
   * @private
   * @param {number} logs - Current log count
   * @param {number} tierIndex
   * @param {Object} tier - Current tier object
   */
  _drawWoodpile(logs, tierIndex, tier) {
    const ctx = this.ctx
    const logsPerRow = 6
    const maxRows = 4
    const maxLogs = logsPerRow * maxRows
    const threshold = tier.threshold === Infinity ? 50000000 : tier.threshold
    const prevThreshold = tierIndex > 0 ? TIERS[tierIndex - 1].threshold : 0
    const progress = Math.min((logs - prevThreshold) / (threshold - prevThreshold), 1)
    const logsToDraw = Math.min(Math.floor(progress * maxLogs) + 1, maxLogs)
    const era = tier.era
    const startX = 520
    const baseY = 295

    // Stack in neat horizontal rows — fill each row left-to-right before starting next
    let drawn = 0
    for (let row = 0; row < maxRows && drawn < logsToDraw; row++) {
      for (let i = 0; i < logsPerRow && drawn < logsToDraw; i++) {
        // Offset odd rows by half a log width for a natural stacked look
        const x = startX + i * 14 + (row % 2) * 7
        const y = baseY - row * 11

        // Log end (circle)
        ctx.fillStyle = COLORS.logBark
        ctx.beginPath()
        ctx.ellipse(x, y, 7, 6, 0, 0, Math.PI * 2)
        ctx.fill()

        // Rings
        ctx.strokeStyle = COLORS.logRings
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.ellipse(x, y, 4, 3, 0, 0, Math.PI * 2)
        ctx.stroke()
        ctx.beginPath()
        ctx.ellipse(x, y, 2, 1.5, 0, 0, Math.PI * 2)
        ctx.stroke()

        // Center dot
        ctx.fillStyle = COLORS.logCenter
        ctx.beginPath()
        ctx.arc(x, y, 1, 0, Math.PI * 2)
        ctx.fill()

        drawn++
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Particles
  // ---------------------------------------------------------------------------

  /**
   * Draws particles from the state snapshot.
   *
   * @private
   * @param {Array} particles
   */
  _drawParticles(particles) {
    drawParticles(this.ctx, particles)
  }

  // ---------------------------------------------------------------------------
  // UI elements
  // ---------------------------------------------------------------------------

  /**
   * Draws the log counter — big number, center-top.
   *
   * @private
   * @param {number} logs
   * @param {number} era
   */
  _drawLogCounter(logs, era) {
    const ctx = this.ctx

    ctx.fillStyle = "rgba(0,0,0,0.5)"
    ctx.beginPath()
    ctx.roundRect(220, 8, 260, 50, 10)
    ctx.fill()

    ctx.fillStyle = COLORS.gold
    ctx.font = `bold 28px ${UI_FONT}`
    ctx.textAlign = "center"
    ctx.fillText(formatNumber(Math.floor(logs)), 350, 38)

    ctx.fillStyle = "#AAA"
    ctx.font = `12px ${UI_FONT}`
    ctx.fillText(era >= 3 ? "board feet" : "logs", 350, 52)
    ctx.textAlign = "left"
  }

  /**
   * Draws the era banner — top-left.
   *
   * @private
   * @param {number} era
   */
  _drawEraBanner(era) {
    const ctx = this.ctx
    const name = ERA_NAMES[era] || ""
    const text = `Era ${era}: ${name}`

    ctx.font = `bold 12px ${UI_FONT}`
    const textWidth = ctx.measureText(text).width

    ctx.fillStyle = "rgba(0,0,0,0.3)"
    ctx.beginPath()
    ctx.roundRect(10, 65, textWidth + 20, 24, 6)
    ctx.fill()

    ctx.fillStyle = "#c8a96e"
    ctx.fillText(text, 20, 82)
  }

  /**
   * Draws the idle rate indicator below the era banner.
   *
   * @private
   * @param {Object} tier
   */
  /**
   * Draws the current tier name below the era banner.
   *
   * @private
   * @param {Object} tier
   */
  _drawCurrentTier(tier) {
    const ctx = this.ctx
    const text = tier.name

    ctx.font = `bold 11px ${UI_FONT}`
    const textWidth = ctx.measureText(text).width

    ctx.fillStyle = "rgba(0,0,0,0.3)"
    ctx.beginPath()
    ctx.roundRect(10, 94, textWidth + 20, 20, 6)
    ctx.fill()

    ctx.fillStyle = "#FFF"
    ctx.fillText(text, 20, 108)
  }

  _drawIdleIndicator(tier) {
    if (tier.idleRate <= 0) return

    const ctx = this.ctx
    const text = `${formatNumber(tier.idleRate)}/sec (idle)`

    ctx.font = `11px ${UI_FONT}`
    const textWidth = ctx.measureText(text).width

    ctx.fillStyle = "rgba(0,0,0,0.3)"
    ctx.beginPath()
    ctx.roundRect(10, 118, textWidth + 20, 20, 6)
    ctx.fill()

    ctx.fillStyle = "#8BC34A"
    ctx.fillText(text, 20, 132)
  }

  /**
   * Draws the progress bar toward next tier — bottom of screen.
   *
   * @private
   * @param {Object} state
   */
  _drawProgressBar(state) {
    const ctx = this.ctx
    const tier = state.tier
    const tierIndex = state.tierIndex
    const era = state.era

    if (tier.threshold === Infinity) {
      // Final tier — no progress bar, show banner
      ctx.fillStyle = "rgba(0,0,0,0.6)"
      ctx.beginPath()
      ctx.roundRect(180, 375, 340, 35, 8)
      ctx.fill()
      ctx.fillStyle = "#FFD700"
      ctx.font = `bold 16px ${UI_FONT}`
      ctx.textAlign = "center"
      ctx.fillText("DA BIG CONTRACT \u2014 You made it, b'y!", 350, 397)
      ctx.textAlign = "left"
      return
    }

    const prevThreshold = tierIndex > 0 ? TIERS[tierIndex - 1].threshold : 0
    const progress = Math.min((state.logs - prevThreshold) / (tier.threshold - prevThreshold), 1)
    const barX = 140
    const barY = 385
    const barW = 420
    const barH = 18

    // Background
    ctx.fillStyle = "rgba(0,0,0,0.5)"
    ctx.beginPath()
    ctx.roundRect(barX - 2, barY - 2, barW + 4, barH + 4, 6)
    ctx.fill()

    // Track
    ctx.fillStyle = COLORS.progressTrack
    ctx.beginPath()
    ctx.roundRect(barX, barY, barW, barH, 4)
    ctx.fill()

    // Fill gradient
    const fillKey = `progressFill${era}`
    const [c1, c2] = COLORS[fillKey] || COLORS.progressFill1
    const grad = ctx.createLinearGradient(barX, 0, barX + barW * progress, 0)
    grad.addColorStop(0, c1)
    grad.addColorStop(1, c2)
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.roundRect(barX, barY, Math.max(barW * progress, 8), barH, 4)
    ctx.fill()

    // Next tier label
    const next = TIERS[tierIndex + 1]
    if (next) {
      ctx.fillStyle = "#AAA"
      ctx.font = `11px ${UI_FONT}`
      ctx.textAlign = "center"
      ctx.fillText(`Next: ${next.name} (${formatNumber(tier.threshold)} logs)`, barX + barW / 2, barY - 6)
      ctx.textAlign = "left"
    }

    // Percentage
    ctx.fillStyle = "#FFF"
    ctx.font = `bold 11px ${UI_FONT}`
    ctx.textAlign = "center"
    ctx.fillText(`${Math.floor(progress * 100)}%`, barX + barW / 2, barY + 14)
    ctx.textAlign = "left"
  }

  // ---------------------------------------------------------------------------
  // Overlays
  // ---------------------------------------------------------------------------

  /**
   * Draws the transform flash on tier-up — golden overlay with tier name.
   *
   * @private
   * @param {Object} state
   */
  _drawTransformFlash(state) {
    if (state.transformTimer <= 0) return

    const ctx = this.ctx
    const alpha = state.transformTimer / 60

    ctx.fillStyle = `rgba(255, 215, 0, ${alpha * 0.3})`
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    if (state.transformTimer > 30) {
      const textAlpha = (state.transformTimer - 30) / 30 * 0.5
      ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`
      ctx.font = `bold 36px ${UI_FONT}`
      ctx.textAlign = "center"
      ctx.fillText(state.tier.name.toUpperCase() + "!", 350, 200)
      ctx.textAlign = "left"
    }
  }

  /**
   * Draws the idle earnings message when the player returns
   * and idleEarned > 0.
   *
   * @private
   * @param {Object} state
   */
  _drawIdleEarnings(state) {
    if (!state.idleEarned || state.idleEarned <= 0) return

    const ctx = this.ctx

    // Semi-transparent banner across center
    ctx.fillStyle = "rgba(0,0,0,0.6)"
    ctx.beginPath()
    ctx.roundRect(100, 170, 500, 60, 10)
    ctx.fill()

    ctx.fillStyle = COLORS.gold
    ctx.font = `bold 20px ${UI_FONT}`
    ctx.textAlign = "center"
    ctx.fillText(`You earned ${formatNumber(state.idleEarned)} logs while you were gone!`, 350, 200)

    ctx.fillStyle = "#AAA"
    ctx.font = `12px ${UI_FONT}`
    ctx.fillText("Click to continue", 350, 220)
    ctx.textAlign = "left"
  }

  /** @private Draws the start screen overlay. */
  _drawStartScreen() {
    drawStartScreen(this.ctx, {
      title: "WOODPILE TYCOON",
      lines: [
        { text: "Click to chop. Watch it grow." },
        { text: "Progress through 12 tiers of woodcutting.", size: 14 },
        { text: "From bucksaw to da big contract.", size: 14 },
      ],
      startPrompt: "CLICK to start",
      canvasWidth: CANVAS_WIDTH, canvasHeight: CANVAS_HEIGHT,
      colors: COLORS, font: UI_FONT,
      layout: { descGap: 28, promptY: 240, hintY: 265 },
    })
  }

  // ---------------------------------------------------------------------------
  // Drawing helpers
}
