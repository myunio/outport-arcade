/**
 * Bayman! — Core game engine.
 *
 * Endless runner: pineapple rides a Honda Big Red trike through
 * Newfoundland boreal forest, jumping over stumps, rocks, and moose.
 *
 * Extends BaseEngine for game loop, phase machine, scoring, and
 * state snapshots. Manages all game-specific state: player physics,
 * obstacle spawning/collision, speed progression, powerups, and
 * invincibility. Particle effects are delegated to the shared
 * ParticleSystem service.
 *
 * All physics are scaled by a delta-time factor so the game runs at
 * the same speed regardless of display refresh rate (60Hz, 120Hz, etc).
 *
 * @module games/bayman/engine
 */

import { BaseEngine } from "../../engine/base_engine.js"
import {
  CANVAS_WIDTH,
  GROUND_Y,
  GRAVITY,
  JUMP_FORCE,
  BASE_SPEED,
  SPEED_INCREASE,
  MAX_SPEED,
  MIN_OBSTACLE_GAP,
  MAX_SPAWN_CHANCE,
  SMASH_BONUS,
  POWERUP_BONUS,
  PLAYER_HITBOX_LEFT,
  PLAYER_HITBOX_RIGHT,
  PLAYER_HITBOX_HEIGHT,
  OBSTACLE_HITBOX_INSET,
  INVINCIBLE_DURATION,
  POWERUP_Y,
  POWERUP_MIN_SCORE,
  POWERUP_COOLDOWN,
  COLORS,
  PHASE,
} from "./config.js"

/**
 * Obstacle type definitions.
 *
 * Each type has a name, hitbox dimensions, and spawn weight.
 * The moose is taller and only spawns after score 10.
 *
 * @type {Array<{name: string, width: number, height: number}>}
 */
const OBSTACLE_TYPES = [
  { name: "stump", width: 30, height: 30 },
  { name: "rock", width: 35, height: 25 },
  { name: "moose", width: 45, height: 50 },
]

/**
 * Power-up type definitions — Newfoundland delicacies.
 *
 * @type {Array<{name: string, width: number, height: number}>}
 */
const POWERUP_TYPES = [
  { name: "vienna", width: 20, height: 16 },
  { name: "syrup", width: 14, height: 24 },
  { name: "margarine", width: 22, height: 16 },
]

/**
 * @typedef {Object} Obstacle
 * @property {string} type - Obstacle type name
 * @property {number} x - Current X position
 * @property {number} width - Hitbox width
 * @property {number} height - Hitbox height
 */

/**
 * @typedef {Object} GameState
 * @property {string} phase - "START", "PLAYING", or "DEAD"
 * @property {number} score - Current score
 * @property {number} highScore - Session high score
 * @property {number} speed - Current scroll speed
 * @property {number} playerX - Player X position
 * @property {number} playerY - Player Y position (bottom of trike)
 * @property {boolean} isJumping - Whether player is airborne
 * @property {Obstacle[]} obstacles - Active obstacles on screen
 * @property {number} groundOffset - Total ground scroll distance
 * @property {number} frameCount - Frames since game start
 */

/**
 * Core game engine for Bayman!
 *
 * @example
 * const engine = new BaymanEngine({
 *   onRender: (state) => renderer.draw(state),
 *   onGameOver: (score) => submitScore(score),
 *   particles: new ParticleSystem(),
 * })
 * engine.start()
 */
export class BaymanEngine extends BaseEngine {
  /** @type {string[]} Game phases for the phase machine. */
  static phases = ["START", "PLAYING", "DEAD"]

  /**
   * Handles phase transitions — starts/stops the engine ambient sound.
   *
   * @param {string} from - Previous phase
   * @param {string} to - New phase
   */
  onPhaseChange(from, to) {
    super.onPhaseChange(from, to)

    if (to === PHASE.PLAYING) {
      this.audio?.ambient.play("engine-ride")
    } else if (to === PHASE.DEAD) {
      this.audio?.ambient.stop()
    }
  }

  /** Resets all game-specific state. */
  reset() {
    super.reset()
    this.speed = BASE_SPEED
    this.playerX = 80
    this.playerY = GROUND_Y
    this.playerVY = 0
    this.isJumping = false
    this.obstacles = []
    this.powerups = []
    this.scorePopups = []
    this.shakeTimer = 0
    this.invincibleTimer = 0
    this.powerupFlash = null
    this.powerupFlashTimer = 0
    this.lastPowerupFrame = -POWERUP_COOLDOWN
    this.groundOffset = 0
  }

  /**
   * Triggers a jump. No-op if already jumping or not playing.
   *
   * If in "START" phase, transitions to "PLAYING" first.
   */
  jump() {
    if (this.phase === PHASE.START) {
      this.setPhase(PHASE.PLAYING)
      return
    }

    if (this.phase !== PHASE.PLAYING) return

    if (!this.isJumping) {
      this.isJumping = true
      this.playerVY = JUMP_FORCE
      this.audio?.effects.play("jump")
    }
  }

  // ---------------------------------------------------------------------------
  // Game loop
  // ---------------------------------------------------------------------------

  /**
   * Updates game state for one frame. Called by BaseEngine each tick.
   *
   * @param {number} dt - Delta-time factor (1.0 = 60fps)
   */
  update(dt) {
    if (this.phase !== PHASE.PLAYING) return

    this.speed = Math.min(BASE_SPEED + this.frameCount * SPEED_INCREASE, MAX_SPEED)
    this.groundOffset += this.speed * dt
    this.addScore(this.speed * 0.05 * dt)

    // Player physics
    if (this.isJumping) {
      this.playerVY += GRAVITY * dt
      this.playerY += this.playerVY * dt

      if (this.playerY >= GROUND_Y) {
        this.playerY = GROUND_Y
        this.playerVY = 0
        this.isJumping = false
        this.audio?.effects.play("land")
      }
    }

    // Move obstacles
    for (const obs of this.obstacles) {
      obs.x -= this.speed * dt
    }

    // Remove off-screen
    this.obstacles = this.obstacles.filter((obs) => obs.x + obs.width > -10)

    // Move power-ups
    for (const pu of this.powerups) {
      pu.x -= this.speed * dt
    }
    this.powerups = this.powerups.filter((pu) => pu.x + pu.width > -10)

    // Tick invincibility — crossfade back to normal engine when it expires
    if (this.invincibleTimer > 0) {
      this.invincibleTimer -= dt
      if (this.invincibleTimer <= 0) {
        this.audio?.ambient.crossfadeTo("engine-ride", 0.5)
      }
    }

    // Tick power-up flash
    if (this.powerupFlashTimer > 0) {
      this.powerupFlashTimer -= dt
      if (this.powerupFlashTimer <= 0) {
        this.powerupFlash = null
      }
    }

    // Spawn obstacles and power-ups
    this._maybeSpawn()
    this._maybeSpawnPowerup()

    // Collision detection
    this._checkCollisions()
    this._checkPowerupCollisions()

    // Update particles via shared ParticleSystem
    if (this.particles) {
      this.particles.update(dt)
    }

    // Update score popups (float upward and fade)
    for (let i = this.scorePopups.length - 1; i >= 0; i--) {
      const pop = this.scorePopups[i]
      pop.y -= 1.2 * dt
      pop.life -= dt
      if (pop.life <= 0) this.scorePopups.splice(i, 1)
    }

    // Tick screen shake
    if (this.shakeTimer > 0) this.shakeTimer -= dt
  }

  // ---------------------------------------------------------------------------
  // State snapshot
  // ---------------------------------------------------------------------------

  /**
   * Returns game-specific state merged with base state.
   *
   * @returns {GameState} Complete state snapshot for renderer
   */
  getState() {
    return {
      ...super.getState(),
      speed: this.speed,
      playerX: this.playerX,
      playerY: this.playerY,
      isJumping: this.isJumping,
      obstacles: this.obstacles,
      powerups: this.powerups,
      particles: this.particles ? this.particles.particles : [],
      scorePopups: this.scorePopups,
      shakeTimer: this.shakeTimer,
      invincibleTimer: this.invincibleTimer,
      powerupFlash: this.powerupFlash,
      powerupFlashTimer: this.powerupFlashTimer,
      groundOffset: this.groundOffset,
    }
  }

  // ---------------------------------------------------------------------------
  // Spawning
  // ---------------------------------------------------------------------------

  /** @private Spawns a new obstacle if gap conditions are met. */
  _maybeSpawn() {
    const last = this.obstacles[this.obstacles.length - 1]

    // Edge-to-edge gap check — uses right edge of last obstacle so wide
    // obstacles (moose) don't eat into the player's recovery window.
    if (last && (last.x + last.width) >= CANVAS_WIDTH - MIN_OBSTACLE_GAP) return

    const spawnChance = Math.min(0.02 + this.speed * 0.003, MAX_SPAWN_CHANCE)
    if (Math.random() < spawnChance) {
      let typeIdx
      if (this.score < 10) {
        typeIdx = Math.random() < 0.7 ? 0 : 1 // mostly stumps early
      } else {
        typeIdx = Math.floor(Math.random() * OBSTACLE_TYPES.length)
      }

      const type = OBSTACLE_TYPES[typeIdx]
      this.obstacles.push({
        type: type.name,
        x: CANVAS_WIDTH + 20,
        width: type.width,
        height: type.height,
      })
    }
  }

  /** @private Spawns a power-up if conditions are met. */
  _maybeSpawnPowerup() {
    if (this.score < POWERUP_MIN_SCORE) return
    if (this.frameCount - this.lastPowerupFrame < POWERUP_COOLDOWN) return
    if (this.powerups.length > 0) return

    if (Math.random() < 0.008) {
      const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)]
      this.powerups.push({
        type: type.name,
        x: CANVAS_WIDTH + 20,
        y: POWERUP_Y,
        width: type.width,
        height: type.height,
      })
      this.lastPowerupFrame = this.frameCount
    }
  }

  // ---------------------------------------------------------------------------
  // Collision detection
  // ---------------------------------------------------------------------------

  /** @private Checks if player collects a power-up. */
  _checkPowerupCollisions() {
    const playerLeft = this.playerX + PLAYER_HITBOX_LEFT
    const playerRight = this.playerX + PLAYER_HITBOX_RIGHT
    const playerTop = this.playerY - PLAYER_HITBOX_HEIGHT

    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pu = this.powerups[i]

      if (
        playerRight > pu.x &&
        playerLeft < pu.x + pu.width &&
        playerTop < pu.y + pu.height &&
        this.playerY > pu.y
      ) {
        this.powerupFlash = pu.type
        this.powerupFlashTimer = 90 // ~1.5 seconds at 60fps
        this.powerups.splice(i, 1)
        this.invincibleTimer = INVINCIBLE_DURATION
        this.addScore(POWERUP_BONUS)
        this.audio?.effects.play("powerup")
        this.audio?.ambient.crossfadeTo("engine-rev", 0.3)
      }
    }
  }

  /** @private Checks player-obstacle collisions. */
  _checkCollisions() {
    const playerLeft = this.playerX + PLAYER_HITBOX_LEFT
    const playerRight = this.playerX + PLAYER_HITBOX_RIGHT
    const playerBottom = this.playerY
    const playerTop = this.playerY - PLAYER_HITBOX_HEIGHT

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i]
      const obsTop = GROUND_Y - obs.height

      if (
        playerRight > obs.x + OBSTACLE_HITBOX_INSET &&
        playerLeft < obs.x + obs.width - OBSTACLE_HITBOX_INSET &&
        playerBottom > obsTop + OBSTACLE_HITBOX_INSET
      ) {
        if (this.invincibleTimer > 0) {
          // Smash through obstacle — bonus points + particle burst + screen shake
          const smashX = obs.x + obs.width / 2
          const smashY = GROUND_Y - obs.height / 2
          this._emitSmashParticles(smashX, smashY, obs.type)
          this.scorePopups.push({ x: smashX, y: smashY - 10, text: `+${SMASH_BONUS}`, life: 40 })
          this.shakeTimer = 6
          this.obstacles.splice(i, 1)
          this.addScore(SMASH_BONUS)
          this.audio?.effects.play("smash", { pitchVariance: 0.15 })
          continue
        }

        this.audio?.effects.play("collision")
        this.setPhase(PHASE.DEAD)
        return
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Particles
  // ---------------------------------------------------------------------------

  /**
   * Emits a burst of particles at the given position via the shared
   * ParticleSystem service.
   *
   * @private
   * @param {number} x - Emission X position
   * @param {number} y - Emission Y position
   * @param {string} obstacleType - Type of obstacle smashed (for color selection)
   */
  _emitSmashParticles(x, y, obstacleType) {
    if (!this.particles) return

    const color = obstacleType === "moose" ? COLORS.mooseBrown
      : obstacleType === "rock" ? COLORS.rockGray
      : COLORS.stumpBrown

    this.particles.emit({
      x,
      y,
      count: 12,
      speed: [2, 6],
      lifetime: [30, 50],
      colors: [color],
      spread: Math.PI * 2,
      gravity: 0.15,
      size: 4,
    })
  }
}
