/**
 * Kung Fu Overdrive -- Canvas renderer.
 *
 * Pure display layer: receives a state snapshot from KungFuEngine.getState()
 * via draw(state) and renders everything -- sprites, parallax backgrounds,
 * HUD, screen overlays (title, floor intro, boss intro, cutscene, game over,
 * victory), particles, and screen shake.
 *
 * Contains NO game logic, physics, or input handling. The only mutation is
 * storing _state for internal method access during a single draw call.
 *
 * @module games/kungfu/renderer
 */

import * as Sprites from "./sprites.js"
import { W, H, GROUND_Y, PHASE, BOSS_DATA } from "./config.js"

// ---------------------------------------------------------------------------
// Module-level constants — hoisted out of per-frame methods
// ---------------------------------------------------------------------------

const FLOOR_NAMES = { 1: "THE STREET", 2: "THE DOJO", 3: "THE ROOFTOP" }

const STREET_SKYLINE_X = [0, 80, 200, 300, 450, 550, 700]
const STREET_BUILDINGS_X = [0, 120, 260, 400, 560, 720]
const NEON_COLORS = ["#ff2d95", "#00ffff", "#ff6b35", "#8b5cf6"]
const ROOFTOP_SKYLINE_X = [50, 120, 200, 300, 380, 470, 560, 640, 720]

/** Cached palette + frame maps for each enemy type. */
const ENEMY_PAL_AND_FRAMES = {
  grabber: {
    pal: Sprites.PAL_GRABBER,
    frames: {
      walk1: Sprites.ENEMY_WALK1,
      walk2: Sprites.ENEMY_WALK2,
      attack: Sprites.ENEMY_ATTACK,
      hurt: Sprites.ENEMY_HURT,
      grab: Sprites.GRABBER_GRAB,
    },
  },
  knife_thrower: {
    pal: Sprites.PAL_KNIFE,
    frames: {
      walk1: Sprites.KNIFE_IDLE,
      walk2: Sprites.KNIFE_IDLE,
      attack: Sprites.KNIFE_THROW,
      hurt: Sprites.ENEMY_HURT,
      throw: Sprites.KNIFE_THROW,
    },
  },
  acrobat: {
    pal: Sprites.PAL_ACROBAT,
    frames: {
      walk1: Sprites.ENEMY_WALK1,
      walk2: Sprites.ENEMY_WALK2,
      attack: Sprites.ENEMY_ATTACK,
      hurt: Sprites.ENEMY_HURT,
      flip: Sprites.ACROBAT_FLIP,
    },
  },
  grunt: {
    pal: Sprites.PAL_GRUNT,
    frames: {
      walk1: Sprites.ENEMY_WALK1,
      walk2: Sprites.ENEMY_WALK2,
      attack: Sprites.ENEMY_ATTACK,
      hurt: Sprites.ENEMY_HURT,
    },
  },
}

export class KungFuRenderer {
  /**
   * Creates a new renderer bound to the given canvas.
   *
   * @param {HTMLCanvasElement} canvas - The canvas element to draw on
   */
  constructor(canvas) {
    /** @type {HTMLCanvasElement} */
    this.canvas = canvas
    this.canvas.width = W
    this.canvas.height = H

    /** @type {CanvasRenderingContext2D} */
    this.ctx = canvas.getContext("2d")

    /** @type {Object|null} Current state snapshot for the in-progress draw call. */
    this._state = null

    // Pre-create gradients that don't change between frames
    this._streetSkyGrad = this.ctx.createLinearGradient(0, 0, 0, GROUND_Y)
    this._streetSkyGrad.addColorStop(0, "#0a0020")
    this._streetSkyGrad.addColorStop(0.6, "#1a0a3e")
    this._streetSkyGrad.addColorStop(1, "#2d1060")

    this._streetFloorGrad = this.ctx.createLinearGradient(0, GROUND_Y, 0, H)
    this._streetFloorGrad.addColorStop(0, "#1a0a2e")
    this._streetFloorGrad.addColorStop(1, "#0a0015")

    this._rooftopSkyGrad = this.ctx.createLinearGradient(0, 0, 0, GROUND_Y)
    this._rooftopSkyGrad.addColorStop(0, "#0a0020")
    this._rooftopSkyGrad.addColorStop(0.4, "#2d1060")
    this._rooftopSkyGrad.addColorStop(0.7, "#8b2080")
    this._rooftopSkyGrad.addColorStop(1, "#ff6b35")
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Main draw entry point. Receives the full state snapshot from the engine
   * and dispatches to the appropriate phase renderer.
   *
   * @param {Object} state - State snapshot from KungFuEngine.getState()
   */
  draw(state) {
    this._state = state
    const { ctx } = this
    ctx.clearRect(0, 0, W, H)
    ctx.save()
    this._applyShake()

    switch (state.phase) {
      case PHASE.TITLE:
        this._renderTitle()
        break
      case PHASE.PLAYING:
        this._renderPlaying()
        break
      case PHASE.FLOOR_INTRO:
        this._renderFloorIntro()
        break
      case PHASE.BOSS_INTRO:
        this._renderBossIntro()
        break
      case PHASE.CUTSCENE:
        this._renderCutscene()
        break
      case PHASE.GAME_OVER:
        this._renderGameOver()
        break
      case PHASE.VICTORY:
        this._renderVictory()
        break
    }

    ctx.restore()
  }

  /**
   * Draws the game-over screen with leaderboard data, used by BaseController
   * after score submission completes.
   *
   * @param {number} score - Final score
   * @param {Array} leaderboard - Array of {user_name, score} entries
   * @param {boolean} isNewHighScore - Whether this score is a new personal best
   */
  drawGameOverWithLeaderboard(score, leaderboard, isNewHighScore) {
    if (this._state) {
      this.draw(this._state)
    }
    const { ctx } = this
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)"
    ctx.fillRect(0, 0, W, H)
    ctx.textAlign = "center"
    ctx.font = "bold 24px monospace"
    ctx.fillStyle = "#ff2d95"
    ctx.fillText(isNewHighScore ? "NEW HIGH SCORE!" : "GAME OVER", W / 2, 80)
    ctx.font = "18px monospace"
    ctx.fillStyle = "#00ffff"
    ctx.fillText(`Score: ${score.toLocaleString()}`, W / 2, 120)

    if (leaderboard && leaderboard.length > 0) {
      ctx.font = "bold 14px monospace"
      ctx.fillStyle = "#E8C65A"
      ctx.fillText("LEADERBOARD", W / 2, 160)
      ctx.font = "12px monospace"
      leaderboard.slice(0, 10).forEach((entry, i) => {
        ctx.fillStyle = "#CCC"
        ctx.fillText(
          `${i + 1}. ${entry.user_name} — ${entry.score.toLocaleString()}`,
          W / 2,
          185 + i * 20,
        )
      })
    }

    ctx.font = "11px monospace"
    ctx.fillStyle = "#666"
    ctx.fillText("Press Q to quit", W / 2, H - 30)
  }

  // ---------------------------------------------------------------------------
  // Phase renderers
  // ---------------------------------------------------------------------------

  /** @private Render the main playing view. */
  _renderPlaying() {
    this._drawFloorBackground()
    for (const e of this._state.enemies) this._drawEnemy(e)
    this._drawProjectiles()
    this._drawPlayer(this._state.player)
    this._drawBoss()
    this._drawParticles()
    this._drawHUD()
  }

  /** @private Render the title screen. */
  _renderTitle() {
    const { ctx } = this
    const titleTime = this._state.titleTime

    ctx.fillStyle = "#0a0015"
    ctx.fillRect(0, 0, W, H)

    // Synthwave grid
    ctx.strokeStyle = "#ff2d9533"
    ctx.lineWidth = 1
    for (let i = 0; i < 15; i++) {
      const y = H - 80 + (((i * 25 + titleTime * 40) % 200) - 200)
      const spread = (H - y) / H
      ctx.globalAlpha = Math.max(0, spread)
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
      ctx.stroke()
    }
    for (let i = -6; i <= 6; i++) {
      ctx.beginPath()
      ctx.moveTo(W / 2 + i * 8, H - 280)
      ctx.lineTo(W / 2 + i * 100, H)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    // Title
    ctx.textAlign = "center"
    ctx.font = "bold 40px monospace"
    ctx.fillStyle = "#ff2d95"
    ctx.shadowColor = "#ff2d95"
    ctx.shadowBlur = 15 + Math.sin(titleTime * 3) * 8
    ctx.fillText("KUNG FU", W / 2, H / 2 - 70)
    ctx.font = "bold 48px monospace"
    ctx.fillText("OVERDRIVE", W / 2, H / 2 - 20)
    ctx.shadowBlur = 0

    // Save Tiffany
    ctx.font = "14px monospace"
    ctx.fillStyle = "#ffd700"
    ctx.shadowColor = "#ffd700"
    ctx.shadowBlur = 8
    ctx.fillText("SAVE TIFFANY", W / 2, H / 2 + 10)
    ctx.shadowBlur = 0

    // Press start
    ctx.globalAlpha = 0.5 + Math.sin(titleTime * 4) * 0.5
    ctx.font = "18px monospace"
    ctx.fillStyle = "#00ffff"
    ctx.shadowColor = "#00ffff"
    ctx.shadowBlur = 10
    ctx.fillText("PRESS ENTER OR CLICK TO START", W / 2, H / 2 + 80)
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1

    // Controls
    ctx.font = "12px monospace"
    ctx.fillStyle = "#ffffff"
    ctx.fillText(
      "\u2190\u2192 MOVE   \u2191 JUMP   \u2193 CROUCH   Z PUNCH   X KICK   C SPECIAL",
      W / 2,
      H / 2 + 120,
    )
    ctx.fillText(
      "M MUTE   ESC PAUSE   Q QUIT   GAMEPAD SUPPORTED",
      W / 2,
      H / 2 + 140,
    )

    // Soundtrack credit
    ctx.font = "11px monospace"
    ctx.fillStyle = "#ff2d95"
    ctx.shadowColor = "#ff2d95"
    ctx.shadowBlur = 6
    ctx.fillText(
      "NOW PLAYING: AIR WOLF BY DOWNTOWN SUMMER",
      W / 2,
      H - 20,
    )
    ctx.shadowBlur = 0
  }

  /** @private Render the floor intro screen. */
  _renderFloorIntro() {
    const { ctx } = this
    const { currentFloor, floorIntroTimer } = this._state

    ctx.fillStyle = "#0a0015"
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = "#ff2d95"
    ctx.font = "bold 48px monospace"
    ctx.textAlign = "center"
    ctx.shadowColor = "#ff2d95"
    ctx.shadowBlur = 20 + Math.sin(floorIntroTimer * 5) * 10
    ctx.fillText("FLOOR " + currentFloor, W / 2, H / 2 - 10)
    ctx.shadowBlur = 0

    ctx.font = "14px monospace"
    ctx.fillStyle = "#888"
    ctx.fillText(FLOOR_NAMES[currentFloor] || "", W / 2, H / 2 + 25)

    if (currentFloor === 1) {
      ctx.fillStyle = "#ffd700"
      ctx.fillText("TIFFANY IS WAITING...", W / 2, H / 2 + 55)
    }
  }

  /** @private Render the boss intro overlay on top of the playing scene. */
  _renderBossIntro() {
    this._renderPlaying()
    const { ctx } = this
    const data = BOSS_DATA[this._state.currentFloor]

    ctx.fillStyle = "rgba(0,0,0,0.8)"
    ctx.fillRect(0, 0, W, H)
    ctx.textAlign = "center"
    ctx.fillStyle = "#888"
    ctx.font = "18px monospace"
    ctx.fillText("YOU FACE...", W / 2, H / 2 - 40)
    ctx.fillStyle = data.accentColor
    ctx.font = "bold 42px monospace"
    ctx.shadowColor = data.accentColor
    ctx.shadowBlur = 25
    ctx.fillText(data.name, W / 2, H / 2 + 20)
    ctx.shadowBlur = 0
  }

  /** @private Render the cutscene view (player walks to Tiffany). */
  _renderCutscene() {
    const { ctx } = this
    const {
      currentFloor,
      cutsceneTimer,
      cutscenePhase,
      cutsceneHearts,
    } = this._state

    this._drawFloorBackground()

    const meetX = W / 2
    const isFinalFloor = currentFloor === 3

    // Player position
    let playerCutX
    if (isFinalFloor && cutscenePhase >= 2) {
      playerCutX = meetX - 20
    } else {
      playerCutX = Math.min(meetX - 40, 100 + cutsceneTimer * 80)
    }

    // Tiffany position -- on Floor 3 she runs toward the player
    let tiffanyX
    if (isFinalFloor && cutscenePhase >= 1) {
      const runProgress = Math.min(1, (cutsceneTimer - 1.0) / 2.0)
      tiffanyX = W - 150 - runProgress * (W - 150 - meetX - 20)
      if (cutscenePhase >= 2) tiffanyX = meetX + 20
    } else {
      tiffanyX = W - 150
    }

    // Draw player
    if (isFinalFloor && cutscenePhase >= 2) {
      // Standing still, facing Tiffany
      Sprites.blitSprite(
        ctx,
        "player_idle",
        Sprites.PLAYER_IDLE,
        Sprites.PAL_PLAYER,
        playerCutX,
        GROUND_Y,
        false,
        false,
      )
    } else {
      const cutWalkFrame =
        Math.floor(cutsceneTimer * 4) % 2 === 0
          ? Sprites.PLAYER_WALK1
          : Sprites.PLAYER_WALK2
      Sprites.blitSprite(
        ctx,
        "player_cutwalk" + (Math.floor(cutsceneTimer * 4) % 2),
        cutWalkFrame,
        Sprites.PAL_PLAYER,
        playerCutX,
        GROUND_Y,
        false,
        false,
      )
    }

    // Draw Tiffany
    const tAlpha = Math.min(1, cutsceneTimer / 1.0)
    ctx.globalAlpha = tAlpha
    this._drawTiffany(tiffanyX, GROUND_Y)
    ctx.globalAlpha = 1

    // Floor 3: golden glow around the couple when they meet
    if (isFinalFloor && cutscenePhase >= 2) {
      ctx.save()
      ctx.shadowColor = "#ffd700"
      ctx.shadowBlur = 30
      ctx.strokeStyle = "#ffd70044"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(meetX, GROUND_Y - 35, 45, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // Draw floating hearts (Floor 3)
    for (const h of cutsceneHearts) {
      if (h.delay > 0 || h.alpha <= 0) continue
      this._drawHeart(h.x, h.y, h.size, h.alpha)
    }

    // Text
    ctx.textAlign = "center"
    if (cutscenePhase === 2) {
      ctx.font = "bold 24px monospace"
      if (isFinalFloor) {
        ctx.fillStyle = "#ffd700"
        ctx.shadowColor = "#ffd700"
        ctx.shadowBlur = 25
        ctx.fillText("YOU SAVED TIFFANY!", W / 2, 60)
      } else {
        ctx.fillStyle = currentFloor === 1 ? "#8b5cf6" : "#ff2d95"
        ctx.shadowColor = ctx.fillStyle
        ctx.shadowBlur = 15
        ctx.fillText("TIFFANY!", W / 2, 60)
        ctx.font = "14px monospace"
        ctx.fillStyle = "#aaa"
        ctx.shadowBlur = 0
        ctx.fillText(
          currentFloor === 1
            ? "Shadow has taken her to the dojo..."
            : "She's on the rooftop!",
          W / 2,
          90,
        )
      }
      ctx.shadowBlur = 0
    }
  }

  /** @private Render the game over screen. */
  _renderGameOver() {
    const { ctx } = this
    const { score, continues } = this._state

    ctx.fillStyle = "#0a0015"
    ctx.fillRect(0, 0, W, H)
    ctx.textAlign = "center"
    ctx.font = "bold 48px monospace"
    ctx.fillStyle = "#ef4444"
    ctx.shadowColor = "#ef4444"
    ctx.shadowBlur = 20
    ctx.fillText("GAME OVER", W / 2, H / 2 - 40)
    ctx.shadowBlur = 0

    ctx.font = "18px monospace"
    ctx.fillStyle = "#fff"
    ctx.fillText(
      "SCORE: " + String(score).padStart(6, "0"),
      W / 2,
      H / 2 + 10,
    )

    ctx.font = "14px monospace"
    if (continues > 0) {
      ctx.fillStyle = "#00ffff"
      ctx.fillText(
        "CONTINUE? (" + continues + " REMAINING)",
        W / 2,
        H / 2 + 50,
      )
      ctx.fillStyle = "#aaa"
      ctx.fillText("PRESS ENTER OR CLICK", W / 2, H / 2 + 75)
    } else {
      ctx.fillStyle = "#aaa"
      ctx.fillText("PRESS ENTER OR CLICK", W / 2, H / 2 + 50)
    }
  }

  /** @private Render the victory screen. */
  _renderVictory() {
    const { ctx } = this
    const { score, enemiesDefeated, totalHealthBonus } = this._state

    ctx.fillStyle = "#0a0015"
    ctx.fillRect(0, 0, W, H)
    ctx.textAlign = "center"

    // Title
    ctx.font = "bold 32px monospace"
    ctx.fillStyle = "#ff2d95"
    ctx.shadowColor = "#ff2d95"
    ctx.shadowBlur = 25
    ctx.fillText("CONGRATULATIONS", W / 2, 60)
    ctx.shadowBlur = 0

    ctx.font = "14px monospace"
    ctx.fillStyle = "#ffd700"
    ctx.shadowColor = "#ffd700"
    ctx.shadowBlur = 10
    ctx.fillText("YOU SAVED TIFFANY!", W / 2, 90)
    ctx.shadowBlur = 0

    // Draw player and Tiffany
    this._drawTiffany(W / 2 + 25, 220)
    Sprites.blitSprite(
      ctx,
      "player_idle",
      Sprites.PLAYER_IDLE,
      Sprites.PAL_PLAYER,
      W / 2 - 25,
      220,
      false,
      false,
    )
    // Glow
    ctx.save()
    ctx.shadowColor = "#ffd700"
    ctx.shadowBlur = 30
    ctx.strokeStyle = "#ffd70044"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(W / 2, 190, 50, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()

    // Score breakdown
    ctx.font = "16px monospace"
    ctx.textAlign = "left"
    const bx = W / 2 - 130
    ctx.fillStyle = "#fff"
    ctx.fillText("ENEMIES DEFEATED:", bx, 280)
    ctx.fillText(String(enemiesDefeated), bx + 260, 280)
    ctx.fillText("HEALTH BONUS:", bx, 305)
    ctx.fillText(String(totalHealthBonus), bx + 260, 305)
    ctx.fillText("TOTAL SCORE:", bx, 345)
    ctx.fillStyle = "#ff2d95"
    ctx.font = "bold 20px monospace"
    ctx.fillText(String(score).padStart(6, "0"), bx + 260, 345)

    ctx.textAlign = "center"
    ctx.font = "14px monospace"
    ctx.fillStyle = "#888"
    ctx.fillText("PRESS ENTER OR CLICK TO RETURN", W / 2, H - 40)
  }

  // ---------------------------------------------------------------------------
  // Drawing helpers -- characters
  // ---------------------------------------------------------------------------

  /**
   * Draw the player character sprite.
   *
   * @private
   * @param {Object} p - Player state object
   */
  _drawPlayer(p) {
    const { ctx } = this
    const frame = this._getPlayerFrame(p)
    const data = Sprites.PLAYER_FRAMES[frame]
    const flip = p.facing < 0
    const glow =
      p.invincible && Math.floor(this._state.gameTime * 12) % 2 ? 0.4 : 1

    ctx.save()
    ctx.globalAlpha = glow
    // Neon glow behind player
    ctx.shadowColor = "#00ffff"
    ctx.shadowBlur = 6
    Sprites.blitSprite(
      ctx,
      "player_" + frame,
      data,
      Sprites.PAL_PLAYER,
      p.x,
      GROUND_Y + p.y,
      flip,
      false,
    )
    ctx.restore()
  }

  /**
   * Draw an enemy sprite.
   *
   * @private
   * @param {Object} e - Enemy state object
   */
  _drawEnemy(e) {
    const { ctx } = this
    const frame = this._getEnemyFrame(e)
    const { pal, frames } = this._getEnemyPalAndFrames(e)
    const data = frames[frame] || frames.walk1
    const flip = e.facing < 0
    const isFlash = e.flashTimer > 0

    ctx.save()
    if (e.state === "dead") ctx.globalAlpha = Math.max(0, e.stateTimer / 0.4)
    Sprites.blitSprite(
      ctx,
      e.type + "_" + frame,
      data,
      pal,
      e.x,
      GROUND_Y + e.y,
      flip,
      isFlash,
    )
    ctx.restore()
  }

  /** @private Draw all projectiles (knives and boss energy bolts). */
  _drawProjectiles() {
    const { ctx } = this
    for (const p of this._state.projectiles) {
      ctx.save()
      ctx.shadowColor = p.isBoss ? "#ff2d95" : "#00ffff"
      ctx.shadowBlur = 10
      ctx.fillStyle = p.isBoss ? "#ff2d95" : "#00ffff"
      ctx.fillRect(p.x - 6, p.y - 2, 12, 4)
      ctx.restore()
    }
  }

  /** @private Draw the boss sprite with glow aura. */
  _drawBoss() {
    const boss = this._state.boss
    if (!boss) return

    const { ctx } = this
    const currentFloor = this._state.currentFloor
    const frame = this._getBossFrame(boss)
    const frames = Sprites.BOSS_FRAMES[currentFloor]
    const data = frames[frame] || frames.idle
    const pal = Sprites.BOSS_PALS[currentFloor]
    const flip = boss.facing < 0
    const isFlash = boss.flashTimer > 0

    ctx.save()
    if (boss.state === "teleport" && boss._teleporting) ctx.globalAlpha = 0.3
    // Boss glow aura
    ctx.shadowColor = boss.accentColor
    ctx.shadowBlur =
      boss.state === "attack" || boss.state === "special" ? 20 : 8
    Sprites.blitSprite(
      ctx,
      "boss" + currentFloor + "_" + frame,
      data,
      pal,
      boss.x,
      GROUND_Y,
      flip,
      isFlash,
    )
    ctx.restore()
  }

  /**
   * Draw Tiffany sprite at the given position.
   *
   * @private
   * @param {number} x - Horizontal center position
   * @param {number} y - Bottom edge position
   */
  _drawTiffany(x, y) {
    const { ctx } = this
    ctx.save()
    ctx.shadowColor = "#ffd700"
    ctx.shadowBlur = 12
    Sprites.blitSprite(
      ctx,
      "tiffany",
      Sprites.TIFFANY_STAND,
      Sprites.PAL_TIFFANY,
      x,
      y,
      false,
      false,
    )
    ctx.restore()
  }

  /**
   * Draw a heart shape for cutscene floating hearts.
   *
   * @private
   * @param {number} x - Center x
   * @param {number} y - Top y
   * @param {number} size - Heart size multiplier
   * @param {number} alpha - Opacity (0-1)
   */
  _drawHeart(x, y, size, alpha) {
    const { ctx } = this
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = "#ff2d95"
    ctx.shadowColor = "#ff2d95"
    ctx.shadowBlur = 12
    ctx.beginPath()
    ctx.moveTo(x, y + size * 0.3)
    ctx.bezierCurveTo(x, y, x - size, y, x - size, y + size * 0.3)
    ctx.bezierCurveTo(
      x - size,
      y + size * 0.7,
      x,
      y + size,
      x,
      y + size * 1.2,
    )
    ctx.bezierCurveTo(
      x,
      y + size,
      x + size,
      y + size * 0.7,
      x + size,
      y + size * 0.3,
    )
    ctx.bezierCurveTo(x + size, y, x, y, x, y + size * 0.3)
    ctx.fill()
    ctx.restore()
  }

  // ---------------------------------------------------------------------------
  // Drawing helpers -- backgrounds
  // ---------------------------------------------------------------------------

  /** @private Draw the background for the current floor. */
  _drawFloorBackground() {
    switch (this._state.currentFloor) {
      case 1:
        this._drawStreetBackground()
        break
      case 2:
        this._drawDojoBackground()
        break
      case 3:
        this._drawRooftopBackground()
        break
    }
  }

  /** @private Draw the street scene (Floor 1). */
  _drawStreetBackground() {
    const { ctx } = this
    const px = this._state.player.x

    // Sky
    ctx.fillStyle = this._streetSkyGrad
    ctx.fillRect(0, 0, W, GROUND_Y)

    // Far layer -- skyline
    ctx.fillStyle = "#120830"
    STREET_SKYLINE_X.forEach((bx, i) => {
      const h = 60 + (i % 3) * 30
      const ox =
        (((bx - px * 0.1) % (W + 100)) + W + 100) % (W + 100) - 50
      ctx.fillRect(ox, GROUND_Y - h, 50, h)
    })

    // Mid layer -- buildings with neon signs
    ctx.save()
    STREET_BUILDINGS_X.forEach((bx, i) => {
      const h = 80 + (i % 4) * 25
      const w = 70 + (i % 2) * 20
      const ox =
        (((bx - px * 0.3) % (W + 120)) + W + 120) % (W + 120) - 60
      ctx.fillStyle = "#1a0a2e"
      ctx.fillRect(ox, GROUND_Y - h, w, h)
      // Windows — use world-space position (bx) so lights stay stable during parallax
      ctx.fillStyle = "#2a1a4e"
      for (let wy = GROUND_Y - h + 10; wy < GROUND_Y - 10; wy += 18) {
        for (let j = 0; j < Math.floor((w - 16) / 16) + 1; j++) {
          const wx = ox + 8 + j * 16
          const worldX = bx + 8 + j * 16
          ctx.fillStyle =
            Math.sin(worldX * 7 + wy * 3) > 0.3 ? "#ffcc44" : "#2a1a4e"
          ctx.fillRect(wx, wy, 8, 10)
        }
      }
      // Neon sign
      ctx.fillStyle = NEON_COLORS[i % 4]
      ctx.shadowColor = NEON_COLORS[i % 4]
      ctx.shadowBlur = 15
      ctx.fillRect(ox + 10, GROUND_Y - h - 8, w - 20, 6)
      ctx.shadowBlur = 0
    })
    ctx.restore()

    // Street surface
    ctx.fillStyle = this._streetFloorGrad
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y)
    ctx.strokeStyle = "#ff2d95"
    ctx.lineWidth = 2
    ctx.shadowColor = "#ff2d95"
    ctx.shadowBlur = 8
    ctx.beginPath()
    ctx.moveTo(0, GROUND_Y)
    ctx.lineTo(W, GROUND_Y)
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  /** @private Draw the dojo scene (Floor 2). */
  _drawDojoBackground() {
    const { ctx } = this
    const px = this._state.player.x

    ctx.fillStyle = "#0d0d1a"
    ctx.fillRect(0, 0, W, GROUND_Y)

    // Hanging scrolls
    ctx.save()
    for (let i = 0; i < 5; i++) {
      const sx =
        (((i * 180 - px * 0.1) % (W + 200)) + W + 200) % (W + 200) - 100
      ctx.fillStyle = "#2a1a3a"
      ctx.fillRect(sx, 40, 30, 80)
      ctx.fillStyle = "#3a2a4a"
      ctx.fillRect(sx + 5, 50, 20, 60)
      ctx.fillStyle = "#1a1a2e"
      for (let j = 0; j < 3; j++) ctx.fillRect(sx + 8, 55 + j * 18, 14, 2)
    }

    // Pillars and lanterns
    for (let i = 0; i < 6; i++) {
      const ox =
        (((i * 160 - px * 0.3) % (W + 180)) + W + 180) % (W + 180) - 40
      ctx.fillStyle = "#3d2b1f"
      ctx.fillRect(ox, 20, 18, GROUND_Y - 20)
      ctx.strokeStyle = "#5a3d2b"
      ctx.lineWidth = 1
      ctx.strokeRect(ox, 20, 18, GROUND_Y - 20)
      ctx.fillStyle = "#ff6b35"
      ctx.shadowColor = "#ff6b35"
      ctx.shadowBlur = 20
      ctx.fillRect(ox + 60, 50, 16, 22)
      ctx.fillStyle = "#ffcc44"
      ctx.fillRect(ox + 63, 54, 10, 14)
      ctx.shadowBlur = 0
    }
    ctx.restore()

    // Wooden floor
    ctx.fillStyle = "#2d1b0e"
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y)
    ctx.strokeStyle = "#3d2b1f"
    ctx.lineWidth = 1
    for (let y = GROUND_Y + 8; y < H; y += 12) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
      ctx.stroke()
    }
    ctx.strokeStyle = "#8b5cf6"
    ctx.lineWidth = 2
    ctx.shadowColor = "#8b5cf6"
    ctx.shadowBlur = 6
    ctx.beginPath()
    ctx.moveTo(0, GROUND_Y)
    ctx.lineTo(W, GROUND_Y)
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  /** @private Draw the rooftop scene (Floor 3). */
  _drawRooftopBackground() {
    const { ctx } = this

    // Gradient sky
    ctx.fillStyle = this._rooftopSkyGrad
    ctx.fillRect(0, 0, W, GROUND_Y)

    // Synthwave sun
    const sunX = W / 2,
      sunY = GROUND_Y - 20,
      sunR = 60
    ctx.save()
    ctx.beginPath()
    ctx.arc(sunX, sunY, sunR, Math.PI, 0)
    ctx.clip()
    const sunGrad = ctx.createLinearGradient(
      sunX,
      sunY - sunR,
      sunX,
      sunY,
    )
    sunGrad.addColorStop(0, "#ff2d95")
    sunGrad.addColorStop(1, "#ff6b35")
    ctx.fillStyle = sunGrad
    ctx.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR)
    ctx.fillStyle = "#0a0020"
    for (let y = sunY - sunR + 10; y < sunY; y += 8) {
      const sh = Math.max(1, ((y - (sunY - sunR)) / sunR) * 4)
      ctx.fillRect(sunX - sunR, y, sunR * 2, sh)
    }
    ctx.restore()
    // Sun glow
    ctx.save()
    ctx.shadowColor = "#ff6b35"
    ctx.shadowBlur = 40
    ctx.beginPath()
    ctx.arc(sunX, sunY, sunR + 2, Math.PI, 0)
    ctx.strokeStyle = "#ff6b3566"
    ctx.lineWidth = 4
    ctx.stroke()
    ctx.restore()

    // City skyline
    ctx.fillStyle = "#1a0a2e"
    ROOFTOP_SKYLINE_X.forEach((bx, i) => {
      const h = 15 + (i % 3) * 12
      ctx.fillRect(bx, GROUND_Y - h - 5, 40, h)
    })

    // Rooftop surface
    ctx.fillStyle = "#111"
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y)
    // Perspective grid
    ctx.strokeStyle = "#ff2d9533"
    ctx.lineWidth = 1
    for (let i = 0; i < 12; i++) {
      const y = GROUND_Y + i * i * 0.5
      if (y > H) break
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
      ctx.stroke()
    }
    for (let i = -8; i <= 8; i++) {
      ctx.beginPath()
      ctx.moveTo(W / 2 + i * 5, GROUND_Y)
      ctx.lineTo(W / 2 + i * 80, H)
      ctx.stroke()
    }
    // Neon edge
    ctx.strokeStyle = "#00ffff"
    ctx.lineWidth = 2
    ctx.shadowColor = "#00ffff"
    ctx.shadowBlur = 10
    ctx.beginPath()
    ctx.moveTo(0, GROUND_Y)
    ctx.lineTo(W, GROUND_Y)
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  // ---------------------------------------------------------------------------
  // Drawing helpers -- particles and effects
  // ---------------------------------------------------------------------------

  /** @private Draw all game particles (ambient + hit effects). */
  _drawParticles() {
    const { ctx } = this
    for (const p of this._state.gameParticles) {
      ctx.save()
      ctx.globalAlpha = Math.min(1, p.life / (p.maxLife || 1))
      ctx.fillStyle = p.color
      ctx.shadowColor = p.color
      ctx.shadowBlur = 6
      ctx.fillRect(p.x, p.y, p.size, p.size)
      ctx.restore()
    }
  }

  /** @private Apply screen shake transform to the canvas. */
  _applyShake() {
    const shakeAmount = this._state.shakeAmount
    if (shakeAmount > 0) {
      this.ctx.translate(
        (Math.random() - 0.5) * shakeAmount * 2,
        (Math.random() - 0.5) * shakeAmount * 2,
      )
    }
  }

  // ---------------------------------------------------------------------------
  // Drawing helpers -- HUD
  // ---------------------------------------------------------------------------

  /** @private Draw the heads-up display (health, lives, score, boss bar, floor). */
  _drawHUD() {
    const { ctx } = this
    const { player, lives, score, boss, currentFloor } = this._state

    ctx.save()
    ctx.shadowBlur = 0

    // Health bar
    const hbX = 15,
      hbY = 15,
      hbW = 180,
      hbH = 14
    ctx.fillStyle = "#222"
    ctx.fillRect(hbX, hbY, hbW, hbH)
    const hp = player.health / player.maxHealth
    const hc = hp > 0.5 ? "#34d399" : hp > 0.25 ? "#fbbf24" : "#ef4444"
    ctx.fillStyle = hc
    ctx.shadowColor = hc
    ctx.shadowBlur = 8
    ctx.fillRect(hbX, hbY, hbW * hp, hbH)
    ctx.shadowBlur = 0
    ctx.strokeStyle = "#555"
    ctx.lineWidth = 1
    ctx.strokeRect(hbX, hbY, hbW, hbH)

    // Lives
    ctx.fillStyle = "#ff2d95"
    ctx.font = "12px monospace"
    ctx.textAlign = "left"
    for (let i = 0; i < lives; i++)
      ctx.fillText("\u2665", hbX + i * 18, hbY + hbH + 16)

    // Special energy
    const seY = hbY + hbH + 24
    for (let i = 0; i < player.maxSpecialEnergy; i++) {
      ctx.fillStyle = "#222"
      ctx.fillRect(hbX + i * 36, seY, 30, 6)
      if (player.specialEnergy > i) {
        const fill = Math.min(1, player.specialEnergy - i)
        ctx.fillStyle = "#00ffff"
        ctx.shadowColor = "#00ffff"
        ctx.shadowBlur = 6
        ctx.fillRect(hbX + i * 36, seY, 30 * fill, 6)
        ctx.shadowBlur = 0
      }
      ctx.strokeStyle = "#444"
      ctx.strokeRect(hbX + i * 36, seY, 30, 6)
    }

    // Score
    ctx.textAlign = "right"
    ctx.fillStyle = "#fff"
    ctx.font = "14px monospace"
    ctx.shadowColor = "#ff2d95"
    ctx.shadowBlur = 4
    ctx.fillText("SCORE " + String(score).padStart(6, "0"), W - 15, 28)
    ctx.shadowBlur = 0

    // Boss health bar
    if (boss) {
      const bbW = 200,
        bbH = 12
      const bbX = (W - bbW) / 2,
        bbY = 15
      ctx.textAlign = "center"
      ctx.fillStyle = boss.accentColor
      ctx.font = "bold 12px monospace"
      ctx.fillText(boss.name, W / 2, bbY - 4)
      ctx.fillStyle = "#222"
      ctx.fillRect(bbX, bbY, bbW, bbH)
      ctx.fillStyle = "#ef4444"
      ctx.shadowColor = "#ef4444"
      ctx.shadowBlur = 8
      ctx.fillRect(bbX, bbY, bbW * (boss.health / boss.maxHealth), bbH)
      ctx.shadowBlur = 0
      ctx.strokeStyle = "#555"
      ctx.strokeRect(bbX, bbY, bbW, bbH)
    }

    // Floor indicator
    ctx.textAlign = "center"
    ctx.fillStyle = "#555"
    ctx.font = "10px monospace"
    ctx.fillText("FLOOR " + currentFloor, W / 2, H - 10)

    ctx.restore()
  }

  // ---------------------------------------------------------------------------
  // Sprite frame helpers
  // ---------------------------------------------------------------------------

  /**
   * Determine which sprite frame to use for the player.
   *
   * @private
   * @param {Object} p - Player state object
   * @returns {string} Frame key into Sprites.PLAYER_FRAMES
   */
  _getPlayerFrame(p) {
    if (p.state === "hurt") return "hurt"
    if (p.state === "special") return "special"
    if (p.state === "crouch_attack") return "crouch_atk"
    if (p.crouching || p.state === "crouch") return "crouch"
    if (p.state === "jump_kick") return "jumpkick"
    if (p.state === "kick") return "kick"
    if (p.state === "punch") return "punch"
    if (p.state === "walk")
      return Math.floor(this._state.gameTime * 6) % 2 === 0
        ? "walk1"
        : "walk2"
    return "idle"
  }

  /**
   * Get the sprite frame key for an enemy.
   *
   * @private
   * @param {Object} e - Enemy state object
   * @returns {string} Frame key
   */
  _getEnemyFrame(e) {
    if (e.state === "hurt" || e.state === "dead") return "hurt"
    if (e.type === "grabber" && (e.state === "attack" || e.grabbing))
      return "grab"
    if (e.type === "knife_thrower" && e.state === "attack") return "throw"
    if (e.type === "acrobat" && e.airborne) return "flip"
    if (e.state === "attack") return "attack"
    if (e.state === "walk")
      return Math.floor(this._state.gameTime * 5) % 2 === 0
        ? "walk1"
        : "walk2"
    return "walk1"
  }

  /**
   * Get the palette and frame map for an enemy type.
   *
   * @private
   * @param {Object} e - Enemy state object
   * @returns {{ pal: Object, frames: Object }}
   */
  _getEnemyPalAndFrames(e) {
    return ENEMY_PAL_AND_FRAMES[e.type] || ENEMY_PAL_AND_FRAMES.grunt
  }

  /**
   * Get the sprite frame key for the boss.
   *
   * @private
   * @param {Object} boss - Boss state object
   * @returns {string} Frame key into Sprites.BOSS_FRAMES
   */
  _getBossFrame(boss) {
    if (!boss) return "idle"
    if (boss.state === "charge") return "charge"
    if (boss.state === "attack") return "attack"
    if (boss.state === "ranged") return "ranged"
    if (boss.state === "special") return "special"
    if (boss.state === "teleport") return "attack"
    return "idle"
  }
}
