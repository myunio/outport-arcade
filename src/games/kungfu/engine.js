/**
 * Kung Fu Overdrive — Game engine.
 *
 * Extends BaseEngine with all update/game logic for the synthwave
 * beat-em-up. The renderer reads state via getState(); the controller
 * routes input via intent methods (punch/kick/jump/useSpecial) and
 * held-key polling through InputManager.
 *
 * This file contains NO rendering or input binding code. It is purely
 * game simulation: player physics, enemy AI, boss AI, wave spawning,
 * projectiles, collisions, particles, and screen shake.
 *
 * @module games/kungfu/engine
 */

import { BaseEngine } from "../../engine/base_engine.js"
import {
  W,
  H,
  GROUND_Y,
  GRAVITY,
  JUMP_FORCE,
  PHASE,
  FLOOR_WAVES,
  BOSS_DATA,
} from "./config.js"

export class KungFuEngine extends BaseEngine {
  static phases = [
    PHASE.TITLE,
    PHASE.PLAYING,
    PHASE.FLOOR_INTRO,
    PHASE.BOSS_INTRO,
    PHASE.CUTSCENE,
    PHASE.GAME_OVER,
    PHASE.VICTORY,
  ]

  /** Score submission is handled manually because of the continues system. */
  static terminalPhases = []

  /** Phases where Q-to-quit is allowed. */
  static quitPhases = [PHASE.TITLE, PHASE.GAME_OVER, PHASE.VICTORY]

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Reset all game state. Called by BaseEngine constructor and on restart.
   * Preserves highScore across resets (handled by super).
   */
  reset() {
    super.reset()

    // Game progression
    this.currentFloor = 1
    this.lives = 3
    this.continues = 3
    this.enemiesDefeated = 0
    this.totalHealthBonus = 0
    this.floorStartTime = 0

    // Player
    this.player = {
      x: 100,
      y: 0,
      w: 40,
      h: 70,
      vx: 0,
      vy: 0,
      speed: 200,
      facing: 1,
      grounded: true,
      crouching: false,
      health: 100,
      maxHealth: 100,
      specialEnergy: 0,
      maxSpecialEnergy: 3,
      state: "idle",
      stateTimer: 0,
      attackHitbox: null,
      invincible: false,
      invincibleTimer: 0,
    }

    // Enemies and projectiles
    this.enemies = []
    this.projectiles = []

    // Wave system
    this.currentWave = 0
    this.waveDelay = 0
    this.waveActive = false
    this.floorComplete = false
    this.spawnQueue = []

    // Boss
    this.boss = null
    this.bossIntroTimer = 0

    // Cutscene
    this.cutsceneTimer = 0
    this.cutscenePhase = 0
    this.cutsceneHearts = []

    // Particles (named gameParticles to avoid conflict with BaseEngine's particles)
    this.gameParticles = []

    // Screen shake
    this.shakeAmount = 0
    this.shakeDuration = 0

    // Screens
    this.titleTime = 0
    this.floorIntroTimer = 0

    // Intent flags — set by controller, consumed each frame
    this._punchIntent = false
    this._kickIntent = false
    this._jumpIntent = false
    this._specialIntent = false
  }

  // ---------------------------------------------------------------------------
  // Intent methods — called by the controller on keydown/button press
  // ---------------------------------------------------------------------------

  /** Queue a punch action for the next frame. */
  punch() {
    this._punchIntent = true
  }

  /** Queue a kick action for the next frame. */
  kick() {
    this._kickIntent = true
  }

  /** Queue a jump action for the next frame. */
  jump() {
    this._jumpIntent = true
  }

  /** Queue a special move for the next frame. */
  useSpecial() {
    this._specialIntent = true
  }

  // ---------------------------------------------------------------------------
  // Game flow — start / continue
  // ---------------------------------------------------------------------------

  /** Begin a new game from the title screen. */
  startGame() {
    if (this.phase === PHASE.TITLE) {
      this.currentFloor = 1
      this.score = 0
      this.lives = 3
      this.continues = 3
      this.enemiesDefeated = 0
      this.totalHealthBonus = 0
      this.floorIntroTimer = 0
      this.gameParticles = []
      this.setPhase(PHASE.FLOOR_INTRO)
    }
  }

  /** Use a continue after game over. */
  continueGame() {
    if (this.phase === PHASE.GAME_OVER && this.continues > 0) {
      this.continues--
      this.lives = 3
      this.player.health = this.player.maxHealth
      this.player.invincible = true
      this.player.invincibleTimer = 2
      this.floorIntroTimer = 0
      this.setPhase(PHASE.FLOOR_INTRO)
    }
  }

  // ---------------------------------------------------------------------------
  // Main update — called every frame by BaseEngine
  // ---------------------------------------------------------------------------

  /**
   * Advance the game simulation by dt seconds.
   * @param {number} dt - Delta-time in seconds
   */
  update(dt) {
    this.updateShake(dt)
    this.updateGameParticles(dt)

    // Snapshot and clear intent flags
    const intents = {
      punch: this._punchIntent,
      kick: this._kickIntent,
      jump: this._jumpIntent,
      special: this._specialIntent,
    }
    this._punchIntent = false
    this._kickIntent = false
    this._jumpIntent = false
    this._specialIntent = false

    switch (this.phase) {
      case PHASE.TITLE:
        this.titleTime += dt
        if (intents.punch || intents.kick) this.startGame()
        break
      case PHASE.PLAYING:
        this.updatePlayer(dt, intents)
        this.updateEnemies(dt, intents)
        this.updateProjectiles(dt)
        this.updateWaves(dt)
        this.updateBoss(dt)
        this.updateBossDelayed(dt)
        this.checkPlayerAttacks()
        this.checkPlayerAttacksBoss()
        this.player.attackHitbox = null
        this.checkGrabSafety()
        this.pushApart()
        break
      case PHASE.FLOOR_INTRO:
        this.updateFloorIntro(dt)
        break
      case PHASE.BOSS_INTRO:
        this.updateBossIntro(dt)
        break
      case PHASE.CUTSCENE:
        this.updateCutscene(dt)
        break
      case PHASE.GAME_OVER:
        if (intents.punch) this.continueGame()
        break
      case PHASE.VICTORY:
        break
    }
  }

  // ---------------------------------------------------------------------------
  // State snapshot — everything the renderer needs
  // ---------------------------------------------------------------------------

  /**
   * Return a complete state snapshot for the renderer.
   * @returns {Object}
   */
  getState() {
    return {
      ...super.getState(),
      player: this.player,
      enemies: this.enemies,
      projectiles: this.projectiles,
      boss: this.boss,
      gameParticles: this.gameParticles,
      currentFloor: this.currentFloor,
      lives: this.lives,
      continues: this.continues,
      enemiesDefeated: this.enemiesDefeated,
      totalHealthBonus: this.totalHealthBonus,
      titleTime: this.titleTime,
      floorIntroTimer: this.floorIntroTimer,
      bossIntroTimer: this.bossIntroTimer,
      cutsceneTimer: this.cutsceneTimer,
      cutscenePhase: this.cutscenePhase,
      cutsceneHearts: this.cutsceneHearts,
      shakeAmount: this.shakeAmount,
      gameTime: this.elapsed,
    }
  }

  // ---------------------------------------------------------------------------
  // Player
  // ---------------------------------------------------------------------------

  /** Reset player to starting position and full health. */
  resetPlayer() {
    this.player.x = 100
    this.player.y = 0
    this.player.vx = 0
    this.player.vy = 0
    this.player.health = this.player.maxHealth
    this.player.state = "idle"
    this.player.grounded = true
    this.player.crouching = false
    this.player.attackHitbox = null
    this.player.invincible = false
    this.player.specialEnergy = 0
  }

  /**
   * Update the player: invincibility, attacks, movement, physics.
   * @param {number} dt
   * @param {Object} intents - { punch, kick, jump, special }
   */
  updatePlayer(dt, intents) {
    // Invincibility countdown
    if (this.player.invincible) {
      this.player.invincibleTimer -= dt
      if (this.player.invincibleTimer <= 0) this.player.invincible = false
    }

    // Attack animation lock
    if (this.player.stateTimer > 0) {
      this.player.stateTimer -= dt
      if (this.player.stateTimer <= 0) {
        this.player.state = this.player.grounded ? "idle" : "jump"
        this.player.attackHitbox = null
      }
      this.updatePlayerPhysics(dt)
      return
    }

    // Crouching (held key)
    this.player.crouching =
      this.input.isDown("ArrowDown") && this.player.grounded

    // Movement (held keys)
    if (!this.player.crouching) {
      if (this.input.isDown("ArrowLeft")) {
        this.player.vx = -this.player.speed
        this.player.facing = -1
        if (this.player.grounded) this.player.state = "walk"
      } else if (this.input.isDown("ArrowRight")) {
        this.player.vx = this.player.speed
        this.player.facing = 1
        if (this.player.grounded) this.player.state = "walk"
      } else {
        this.player.vx = 0
        if (this.player.grounded && this.player.state === "walk")
          this.player.state = "idle"
      }
    } else {
      this.player.vx = 0
      this.player.state = "crouch"
    }

    // Jump (intent)
    if (intents.jump && this.player.grounded) {
      this.player.vy = JUMP_FORCE
      this.player.grounded = false
      this.player.state = "jump"
    }

    // Attacks (intents)
    if (intents.punch) {
      if (this.player.crouching) {
        this.startAttack("crouch_attack", 0.25, {
          x: this.player.x + this.player.facing * 10,
          y: GROUND_Y - 10,
          w: 40,
          h: 15,
        })
      } else {
        this.startAttack("punch", 0.15, {
          x: this.player.x + this.player.facing * 15,
          y: GROUND_Y - 55,
          w: 35,
          h: 16,
        })
      }
      this.audio?.playSound("punch")
    } else if (intents.kick) {
      if (!this.player.grounded) {
        this.startAttack("jump_kick", 0.3, {
          x: this.player.x + this.player.facing * 15,
          y: GROUND_Y - 45 + this.player.y,
          w: 40,
          h: 18,
        })
      } else {
        this.startAttack("kick", 0.25, {
          x: this.player.x + this.player.facing * 15,
          y: GROUND_Y - 35,
          w: 45,
          h: 18,
        })
      }
      this.audio?.playSound("kick")
    } else if (intents.special && this.player.specialEnergy >= 1) {
      this.player.specialEnergy -= 1
      this.startAttack("special", 0.4, {
        x: this.player.x - 45,
        y: GROUND_Y - 45,
        w: 90,
        h: 25,
      })
      this.audio?.playSound("special")
    }

    this.updatePlayerPhysics(dt)
  }

  /**
   * Begin an attack state.
   * @param {string} state - Attack state name
   * @param {number} duration - Duration in seconds
   * @param {Object} hitbox - Attack hitbox { x, y, w, h }
   */
  startAttack(state, duration, hitbox) {
    this.player.state = state
    this.player.stateTimer = duration
    this.player.attackHitbox = hitbox
  }

  /**
   * Apply gravity and movement to the player.
   * @param {number} dt
   */
  updatePlayerPhysics(dt) {
    if (!this.player.grounded) this.player.vy += GRAVITY * dt
    this.player.x += this.player.vx * dt
    this.player.y += this.player.vy * dt
    if (this.player.y >= 0) {
      this.player.y = 0
      this.player.vy = 0
      this.player.grounded = true
    }
    this.player.x = Math.max(20, Math.min(W - 20, this.player.x))
  }

  // ---------------------------------------------------------------------------
  // Collision
  // ---------------------------------------------------------------------------

  /** Damage multiplier based on current attack type. */
  _getAttackDamage() {
    switch (this.player.state) {
      case "special":
        return 3
      case "jump_kick":
        return 2
      case "kick":
        return 1.5
      default:
        return 1
    }
  }

  /**
   * Test if two axis-aligned rectangles overlap.
   * @param {Object|null} a - { x, y, w, h }
   * @param {Object|null} b - { x, y, w, h }
   * @returns {boolean}
   */
  rectsOverlap(a, b) {
    if (!a || !b) return false
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    )
  }

  // ---------------------------------------------------------------------------
  // Enemies — spawning
  // ---------------------------------------------------------------------------

  /**
   * Spawn a grunt enemy.
   * @param {string} side - "left" or "right"
   */
  spawnGrunt(side) {
    const x = side === "left" ? -30 : W + 30
    this.enemies.push({
      type: "grunt",
      x,
      y: 0,
      w: 30,
      h: 60,
      vx: 0,
      vy: 0,
      health: 2,
      maxHealth: 2,
      speed: 80 + this.currentFloor * 10,
      facing: side === "left" ? 1 : -1,
      state: "walk",
      stateTimer: 0,
      attackCooldown: 0,
      attackRange: 35,
      damage: 8,
      points: 100,
      flashTimer: 0,
      grabbing: false,
      grabEscapeCount: 0,
      airborne: false,
    })
  }

  /**
   * Spawn a grabber enemy.
   * @param {string} side - "left" or "right"
   */
  spawnGrabber(side) {
    const x = side === "left" ? -30 : W + 30
    this.enemies.push({
      type: "grabber",
      x,
      y: 0,
      w: 30,
      h: 60,
      vx: 0,
      vy: 0,
      health: 3,
      maxHealth: 3,
      speed: 65 + this.currentFloor * 8,
      facing: side === "left" ? 1 : -1,
      state: "walk",
      stateTimer: 0,
      attackCooldown: 0,
      attackRange: 30,
      damage: 3,
      points: 200,
      flashTimer: 0,
      grabbing: false,
      grabEscapeCount: 0,
      airborne: false,
    })
  }

  /**
   * Spawn a knife thrower enemy.
   * @param {string} side - "left" or "right"
   */
  spawnKnifeThrower(side) {
    const x = side === "left" ? -30 : W + 30
    this.enemies.push({
      type: "knife_thrower",
      x,
      y: 0,
      w: 26,
      h: 58,
      vx: 0,
      vy: 0,
      health: 1,
      maxHealth: 1,
      speed: 50 + this.currentFloor * 5,
      facing: side === "left" ? 1 : -1,
      state: "walk",
      stateTimer: 0,
      attackCooldown: 2.0,
      attackRange: 250,
      minRange: 150,
      damage: 10,
      points: 300,
      flashTimer: 0,
      grabbing: false,
      grabEscapeCount: 0,
      airborne: false,
    })
  }

  /**
   * Spawn an acrobat enemy.
   * @param {string} side - "left" or "right"
   */
  spawnAcrobat(side) {
    const x = side === "left" ? -30 : W + 30
    this.enemies.push({
      type: "acrobat",
      x,
      y: 0,
      w: 28,
      h: 55,
      vx: 0,
      vy: 0,
      health: 2,
      maxHealth: 2,
      speed: 120 + this.currentFloor * 10,
      facing: side === "left" ? 1 : -1,
      state: "walk",
      stateTimer: 0,
      attackCooldown: 1.0,
      attackRange: 100,
      damage: 12,
      points: 500,
      flashTimer: 0,
      grabbing: false,
      grabEscapeCount: 0,
      airborne: false,
    })
  }

  // ---------------------------------------------------------------------------
  // Enemies — update AI
  // ---------------------------------------------------------------------------

  /**
   * Update all enemy AI, movement, and attack logic.
   * @param {number} dt
   * @param {Object} intents - Player intents (needed for grab escape)
   */
  updateEnemies(dt, intents) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i]
      if (e.flashTimer > 0) e.flashTimer -= dt

      // State timer (hurt/dead recovery)
      if (e.stateTimer > 0) {
        e.stateTimer -= dt
        if (e.stateTimer <= 0) {
          if (e.state === "dead") {
            this.enemies.splice(i, 1)
            continue
          }
          e.state = "walk"
        }
        continue
      }
      if (e.state === "hurt") continue

      e.facing = this.player.x > e.x ? 1 : -1
      const dist = Math.abs(this.player.x - e.x)

      // Grabber logic
      if (e.type === "grabber") {
        if (e.grabbing) {
          // Keep player locked while grabbed
          this.player.state = "hurt"
          this.player.stateTimer = 0.1
          this.player.vx = 0
          this.player.x = e.x - e.facing * 20
          if (!this.player.invincible) {
            this.player.health -= e.damage * dt
            if (this.player.health <= 0) {
              this.player.health = 0
              this.loseLife()
              e.grabbing = false
              continue
            }
          }
          if (intents.punch || intents.kick) {
            e.grabEscapeCount++
            if (e.grabEscapeCount >= 5) {
              e.grabbing = false
              e.grabEscapeCount = 0
              e.state = "hurt"
              e.stateTimer = 0.5
              e.x += this.player.facing * 30
              this.player.state = "idle"
              this.player.stateTimer = 0
              this.audio?.playSound("grab_escape")
            }
          }
          continue
        }
        if (
          dist <= e.attackRange &&
          e.attackCooldown <= 0 &&
          !this.player.invincible
        ) {
          e.grabbing = true
          e.grabEscapeCount = 0
          e.state = "attack"
          e.attackCooldown = 2.0
          this.player.state = "hurt"
          this.player.stateTimer = 0.1
          this.player.vx = 0
          continue
        }
      }

      // Knife thrower logic
      if (e.type === "knife_thrower") {
        e.attackCooldown -= dt
        if (dist < e.minRange) {
          e.x -= e.facing * e.speed * dt
          e.state = "walk"
        } else if (dist <= e.attackRange && e.attackCooldown <= 0) {
          e.state = "attack"
          e.stateTimer = 0.4
          e.attackCooldown = 2.0
          this.projectiles.push({
            x: e.x + e.facing * 15,
            y: GROUND_Y - 40,
            vx: e.facing * 300,
            w: 12,
            h: 4,
            damage: e.damage,
          })
          this.audio?.playSound("knife")
        } else if (dist > e.attackRange) {
          e.x += e.facing * e.speed * dt
          e.state = "walk"
        } else {
          e.state = "idle"
        }
        continue
      }

      // Acrobat logic
      if (e.type === "acrobat") {
        e.attackCooldown -= dt
        if (e.airborne) {
          e.vy += GRAVITY * dt
          e.x += e.vx * dt
          e.y += e.vy * dt
          if (e.y >= 0) {
            e.y = 0
            e.airborne = false
            e.vy = 0
            e.vx = 0
            e.state = "walk"
            if (
              Math.abs(this.player.x - e.x) < 40 &&
              !this.player.invincible
            ) {
              this.damagePlayer(e.damage)
            }
          }
          continue
        }
        if (dist <= e.attackRange && e.attackCooldown <= 0) {
          e.airborne = true
          e.vy = -400
          e.vx = e.facing * 150
          e.state = "attack"
          e.attackCooldown = 2.0
        } else if (dist > e.attackRange) {
          e.x += e.facing * e.speed * dt
          e.state = "walk"
        }
        continue
      }

      // Default grunt logic
      if (dist > e.attackRange) {
        e.vx = e.speed * e.facing
        e.x += e.vx * dt
        e.state = "walk"
      } else {
        e.vx = 0
        e.attackCooldown -= dt
        if (e.attackCooldown <= 0) {
          e.state = "attack"
          e.stateTimer = 0.3
          e.attackCooldown = 1.0
          if (!this.player.invincible) this.damagePlayer(e.damage)
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Projectiles
  // ---------------------------------------------------------------------------

  /**
   * Update all projectiles (knives, boss fireballs).
   * @param {number} dt
   */
  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]
      p.x += p.vx * dt
      if (p.x < -20 || p.x > W + 20) {
        this.projectiles.splice(i, 1)
        continue
      }
      if (!this.player.invincible) {
        const pb = {
          x: this.player.x - 15,
          y: GROUND_Y - 70 + this.player.y,
          w: 30,
          h: 70,
        }
        if (this.rectsOverlap(p, pb)) {
          this.damagePlayer(p.damage)
          this.projectiles.splice(i, 1)
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Damage and lives
  // ---------------------------------------------------------------------------

  /**
   * Damage the player: reduce health, trigger hurt state, shake, particles.
   * @param {number} amount - Damage amount
   */
  damagePlayer(amount) {
    this.player.health -= amount
    this.player.invincible = true
    this.player.invincibleTimer = 0.5
    this.player.state = "hurt"
    this.player.stateTimer = 0.2
    this.audio?.playSound("player_hurt")
    this.triggerShake(4, 0.1)
    this.spawnHitParticles(this.player.x, GROUND_Y - 35, "#ef4444", 5)
    if (this.player.health <= 0) {
      this.player.health = 0
      this.loseLife()
    }
  }

  /**
   * Handle losing a life. Transitions to GAME_OVER if no lives remain,
   * and submits the score if no continues are left either.
   */
  loseLife() {
    this.lives--
    if (this.lives <= 0) {
      this.setPhase(PHASE.GAME_OVER)
      if (this.continues <= 0) {
        this._onGameOver(Math.floor(this.score))
        this.stop()
      }
    } else {
      this.player.health = this.player.maxHealth
      this.player.invincible = true
      this.player.invincibleTimer = 2
    }
  }

  // ---------------------------------------------------------------------------
  // Player attacks vs enemies / boss
  // ---------------------------------------------------------------------------

  /** Check player attack hitbox against all enemies. */
  checkPlayerAttacks() {
    if (!this.player.attackHitbox) return
    for (const e of this.enemies) {
      if (e.state === "dead" || e.state === "hurt") continue
      const eb = {
        x: e.x - e.w / 2,
        y: GROUND_Y - e.h + e.y,
        w: e.w,
        h: e.h,
      }
      if (this.rectsOverlap(this.player.attackHitbox, eb)) {
        this.hitEnemy(e, this._getAttackDamage())
      }
    }
  }

  /**
   * Apply damage to an enemy. Awards points and special energy on kill.
   * @param {Object} e - Enemy object
   * @param {number} damage
   */
  hitEnemy(e, damage) {
    e.health -= damage
    e.flashTimer = 0.1
    e.state = "hurt"
    e.stateTimer = 0.3
    e.x += this.player.facing * 20
    if (e.grabbing) {
      e.grabbing = false
      this.player.state = "idle"
      this.player.stateTimer = 0
    }
    this.player.specialEnergy = Math.min(
      this.player.maxSpecialEnergy,
      this.player.specialEnergy + 0.2
    )
    this.audio?.playSound("enemy_hit")
    this.spawnHitParticles(e.x, GROUND_Y - 30, "#00ffff", 4)
    if (e.health <= 0) {
      e.state = "dead"
      e.stateTimer = 0.4
      this.score += e.points
      this.enemiesDefeated++
      this.audio?.playSound("enemy_defeat")
      this.spawnHitParticles(e.x, GROUND_Y - 30, "#fff", 8)
    }
  }

  /** Check player attack hitbox against the boss. */
  checkPlayerAttacksBoss() {
    if (!this.boss || !this.player.attackHitbox) return
    const bb = {
      x: this.boss.x - this.boss.w / 2,
      y: GROUND_Y - this.boss.h,
      w: this.boss.w,
      h: this.boss.h,
    }
    if (this.rectsOverlap(this.player.attackHitbox, bb)) {
      this.boss.health -= this._getAttackDamage()
      this.boss.flashTimer = 0.1
      this.player.specialEnergy = Math.min(
        this.player.maxSpecialEnergy,
        this.player.specialEnergy + 0.15
      )
      this.audio?.playSound("enemy_hit")
      this.spawnHitParticles(
        this.boss.x,
        GROUND_Y - this.boss.h / 2,
        this.boss.accentColor,
        5
      )
      this.triggerShake(3, 0.08)
      if (this.boss.health <= 0) this.defeatBoss()
    }
  }

  // ---------------------------------------------------------------------------
  // Grab safety and push-apart
  // ---------------------------------------------------------------------------

  /** If the grabber died or vanished while grabbing, free the player. */
  checkGrabSafety() {
    const anyGrabbing = this.enemies.some((e) => e.grabbing)
    if (
      !anyGrabbing &&
      this.player.state === "hurt" &&
      this.player.stateTimer <= 0
    ) {
      const wasGrabbed = this.player.vx === 0 && this.player.grounded
      if (wasGrabbed) {
        this.player.state = "idle"
        this.player.stateTimer = 0
      }
    }
  }

  /** Push player and enemies apart so they don't stack. */
  pushApart() {
    for (const e of this.enemies) {
      if (e.state === "dead" || e.grabbing) continue
      const dx = this.player.x - e.x
      const dist = Math.abs(dx)
      if (dist < 25 && Math.abs(this.player.y - e.y) < 20) {
        const push = (25 - dist) * 0.5
        const dir = dx > 0 ? 1 : -1
        this.player.x += dir * push
        e.x -= dir * push
        this.player.x = Math.max(20, Math.min(W - 20, this.player.x))
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Wave system
  // ---------------------------------------------------------------------------

  /**
   * Process spawn queue and advance waves.
   * @param {number} dt
   */
  updateWaves(dt) {
    // Process spawn queue
    for (let i = this.spawnQueue.length - 1; i >= 0; i--) {
      this.spawnQueue[i].delay -= dt
      if (this.spawnQueue[i].delay <= 0) {
        const s = this.spawnQueue.splice(i, 1)[0]
        switch (s.type) {
          case "grunt":
            this.spawnGrunt(s.side)
            break
          case "grabber":
            this.spawnGrabber(s.side)
            break
          case "knife_thrower":
            this.spawnKnifeThrower(s.side)
            break
          case "acrobat":
            this.spawnAcrobat(s.side)
            break
        }
      }
    }

    if (this.floorComplete) return
    const waves = FLOOR_WAVES[this.currentFloor]
    if (!waves || this.currentWave >= waves.length) {
      if (this.enemies.length === 0 && this.spawnQueue.length === 0) {
        this.floorComplete = true
        this.startBossFight()
      }
      return
    }
    if (this.waveActive) {
      if (this.enemies.length === 0 && this.spawnQueue.length === 0) {
        this.waveActive = false
        this.waveDelay = 1.5
        this.currentWave++
      }
      return
    }
    this.waveDelay -= dt
    if (this.waveDelay > 0) return
    const wave = waves[this.currentWave]
    for (const group of wave) {
      for (let i = 0; i < group.count; i++) {
        const side = Math.random() > 0.5 ? "left" : "right"
        this.spawnQueue.push({ type: group.type, side, delay: i * 0.3 })
      }
    }
    this.waveActive = true
  }

  /** Initialize a new floor: clear enemies, reset player. */
  initFloor() {
    this.enemies = []
    this.projectiles = []
    this.spawnQueue = []
    this.currentWave = 0
    this.waveDelay = 1.0
    this.waveActive = false
    this.floorComplete = false
    this.floorStartTime = this.elapsed
    this.resetPlayer()
  }

  // ---------------------------------------------------------------------------
  // Boss system
  // ---------------------------------------------------------------------------

  /** Transition to the boss intro screen. */
  startBossFight() {
    this.setPhase(PHASE.BOSS_INTRO)
    this.bossIntroTimer = 0
    this.audio?.playSound("boss_intro")
  }

  /**
   * Update the boss AI: state timer, then delegate to per-boss logic.
   * @param {number} dt
   */
  updateBoss(dt) {
    if (!this.boss) return
    if (this.boss.flashTimer > 0) this.boss.flashTimer -= dt

    if (this.boss.stateTimer > 0) {
      this.boss.stateTimer -= dt
      if (this.boss.stateTimer <= 0) this.boss.state = "idle"
      if (this.boss.state === "charge") {
        this.boss.x += this.boss.facing * this.boss.speed * 3 * dt
        this.boss.x = Math.max(30, Math.min(W - 30, this.boss.x))
      }
      return
    }

    this.boss.facing = this.player.x > this.boss.x ? 1 : -1
    this.boss.attackCooldown -= dt
    const dist = Math.abs(this.player.x - this.boss.x)

    switch (this.currentFloor) {
      case 1:
        this.updateIronFist(dt, dist)
        break
      case 2:
        this.updateShadow(dt, dist)
        break
      case 3:
        this.updateNeonDragon(dt, dist)
        break
    }
  }

  /**
   * Iron Fist boss AI — Floor 1.
   * @param {number} dt
   * @param {number} dist - Distance to player
   */
  updateIronFist(dt, dist) {
    if (dist > 60) {
      this.boss.x += this.boss.facing * this.boss.speed * dt
      this.boss.state = "walk"
    } else if (this.boss.attackCooldown <= 0) {
      this.boss.state = "attack"
      this.boss.stateTimer = 0.4
      this.boss.attackCooldown = 0.9
      this.boss._pendingDamage = true
      this.boss._damageDelay = 0.25
    }
    if (this.boss.attackCooldown < -0.5) {
      this.boss.state = "charge"
      this.boss.stateTimer = 0.7
      this.boss.attackCooldown = 1.6
      this.boss._pendingDamage = true
      this.boss._damageDelay = 0.4
      this.boss._chargeDamage = true
    }
  }

  /**
   * Shadow boss AI — Floor 2.
   * @param {number} dt
   * @param {number} dist - Distance to player
   */
  updateShadow(dt, dist) {
    if (this.boss.attackCooldown <= 0) {
      if (Math.random() > 0.35) {
        this.boss.state = "teleport"
        this.boss.stateTimer = 0.5
        this.boss.attackCooldown = 1.2
        this.boss._teleporting = true
        this.boss._teleportDelay = 0.35
      } else {
        this.boss.state = "attack"
        this.boss.stateTimer = 0.25
        this.boss.attackCooldown = 0.8
        if (dist < 80 && !this.player.invincible) {
          this.damagePlayer(this.boss.damage)
          this.triggerShake(5, 0.15)
        }
      }
    } else {
      this.boss.x += this.boss.facing * this.boss.speed * 0.5 * dt
      this.boss.x = Math.max(30, Math.min(W - 30, this.boss.x))
      this.boss.state = "walk"
    }
  }

  /**
   * Neon Dragon boss AI — Floor 3.
   * @param {number} dt
   * @param {number} dist - Distance to player
   */
  updateNeonDragon(dt, dist) {
    // Phase 2 transition at half health
    if (this.boss.phase === 1 && this.boss.health <= this.boss.maxHealth / 2) {
      this.boss.phase = 2
      this.boss.speed *= 1.5
      this.boss.attackCooldown = 0.5
      this.triggerShake(10, 0.4)
      this.spawnHitParticles(this.boss.x, GROUND_Y - 40, "#ff2d95", 15)
    }
    if (this.boss.attackCooldown <= 0) {
      const roll = Math.random()
      if (dist > 200 || (roll < 0.3 && dist > 100)) {
        this.boss.state = "ranged"
        this.boss.stateTimer = 0.5
        this.boss.attackCooldown = this.boss.phase === 2 ? 1.0 : 1.8
        this.boss._fireProjectile = true
        this.boss._projectileDelay = 0.3
      } else if (roll < 0.6 || this.boss.phase === 2) {
        this.boss.state = "attack"
        this.boss.stateTimer = 0.4
        this.boss.attackCooldown = this.boss.phase === 2 ? 0.7 : 1.4
        if (dist < 60 && !this.player.invincible) {
          this.damagePlayer(this.boss.damage)
          this.triggerShake(5, 0.15)
        }
      } else {
        this.boss.state = "special"
        this.boss.stateTimer = 0.6
        this.boss.attackCooldown = 2.0
        this.boss._pendingDamage = true
        this.boss._damageDelay = 0.4
        this.boss._specialDamage = true
      }
    } else {
      this.boss.x += this.boss.facing * this.boss.speed * dt
      this.boss.x = Math.max(30, Math.min(W - 30, this.boss.x))
      this.boss.state = "walk"
    }
  }

  /**
   * Process boss delayed actions (pending damage, teleport, projectile).
   * @param {number} dt
   */
  updateBossDelayed(dt) {
    if (!this.boss) return

    // Pending melee damage
    if (this.boss._pendingDamage) {
      this.boss._damageDelay -= dt
      if (this.boss._damageDelay <= 0) {
        this.boss._pendingDamage = false
        const dist = Math.abs(this.player.x - this.boss.x)
        const range = this.boss._specialDamage
          ? 100
          : this.boss._chargeDamage
            ? 50
            : 70
        const dmg = this.boss._specialDamage
          ? this.boss.damage * 1.5
          : this.boss._chargeDamage
            ? this.boss.damage * 1.5
            : this.boss.damage
        if (dist < range && !this.player.invincible) {
          this.damagePlayer(dmg)
          this.triggerShake(8, 0.2)
        }
        this.boss._chargeDamage = false
        this.boss._specialDamage = false
      }
    }

    // Teleport
    if (this.boss._teleporting) {
      this.boss._teleportDelay -= dt
      if (this.boss._teleportDelay <= 0) {
        this.boss._teleporting = false
        this.boss.x = this.player.x + -this.player.facing * 60
        this.boss.x = Math.max(30, Math.min(W - 30, this.boss.x))
        this.boss.facing = this.player.x > this.boss.x ? 1 : -1
        this.boss.state = "attack"
        this.boss.stateTimer = 0.3
        if (
          Math.abs(this.player.x - this.boss.x) < 60 &&
          !this.player.invincible
        ) {
          this.damagePlayer(this.boss.damage)
          this.triggerShake(5, 0.15)
        }
      }
    }

    // Fire projectile
    if (this.boss._fireProjectile) {
      this.boss._projectileDelay -= dt
      if (this.boss._projectileDelay <= 0) {
        this.boss._fireProjectile = false
        this.projectiles.push({
          x: this.boss.x + this.boss.facing * 30,
          y: GROUND_Y - 40,
          vx: this.boss.facing * 350,
          w: 16,
          h: 8,
          damage: this.boss.damage,
          isBoss: true,
        })
      }
    }
  }

  /** Handle boss defeat: award bonuses, clear boss, start cutscene. */
  defeatBoss() {
    const healthBonus = Math.floor(this.player.health * 10)
    const speedBonus = Math.max(
      0,
      2000 - Math.floor((this.elapsed - this.floorStartTime) * 10)
    )
    this.totalHealthBonus += healthBonus
    this.score += 1000 + healthBonus + speedBonus
    this.boss = null
    this.audio?.playSound("boss_defeat")
    this.triggerShake(12, 0.5)
    this.spawnHitParticles(W / 2, GROUND_Y - 50, "#fff", 20)
    this.startCutscene()
  }

  // ---------------------------------------------------------------------------
  // Cutscene
  // ---------------------------------------------------------------------------

  /** Transition to cutscene state. */
  startCutscene() {
    this.setPhase(PHASE.CUTSCENE)
    this.cutsceneTimer = 0
    this.cutscenePhase = 0
  }

  /**
   * Update cutscene progression and floating hearts.
   * @param {number} dt
   */
  updateCutscene(dt) {
    this.cutsceneTimer += dt
    if (this.cutscenePhase === 0 && this.cutsceneTimer > 1.0)
      this.cutscenePhase = 1
    if (this.cutscenePhase === 1 && this.cutsceneTimer > 3.0) {
      this.cutscenePhase = 2
      // Spawn hearts on Floor 3 reunion
      if (this.currentFloor === 3) {
        this.cutsceneHearts = []
        for (let i = 0; i < 5; i++) {
          this.cutsceneHearts.push({
            x: W / 2 + (Math.random() - 0.5) * 40,
            y: GROUND_Y - 80,
            vy: -30 - Math.random() * 20,
            vx: (Math.random() - 0.5) * 15,
            size: 8 + Math.random() * 6,
            delay: i * 0.35,
            alpha: 1,
          })
        }
      }
    }

    // Update floating hearts
    for (const h of this.cutsceneHearts) {
      if (h.delay > 0) {
        h.delay -= dt
        continue
      }
      h.y += h.vy * dt
      h.x += h.vx * dt
      h.alpha = Math.max(0, h.alpha - dt * 0.2)
    }

    if (
      this.cutscenePhase === 2 &&
      this.cutsceneTimer > (this.currentFloor === 3 ? 6.5 : 5.0)
    ) {
      if (this.currentFloor >= 3) {
        // Victory! Submit score and stop.
        this.setPhase(PHASE.VICTORY)
        this._onGameOver(Math.floor(this.score))
        this.stop()
      } else {
        this.currentFloor++
        this.setPhase(PHASE.FLOOR_INTRO)
        this.floorIntroTimer = 0
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Floor intro / Boss intro
  // ---------------------------------------------------------------------------

  /**
   * Update floor intro timer, then transition to PLAYING.
   * @param {number} dt
   */
  updateFloorIntro(dt) {
    this.floorIntroTimer += dt
    if (this.floorIntroTimer > 2) {
      this.floorIntroTimer = 0
      this.setPhase(PHASE.PLAYING)
      this.initFloor()
    }
  }

  /**
   * Update boss intro timer, spawn boss, then transition to PLAYING.
   * @param {number} dt
   */
  updateBossIntro(dt) {
    this.bossIntroTimer += dt
    if (this.bossIntroTimer > 3) {
      const data = BOSS_DATA[this.currentFloor]
      this.boss = {
        ...data,
        x: W - 100,
        y: 0,
        maxHealth: data.health,
        facing: -1,
        state: "idle",
        stateTimer: 0,
        attackCooldown: 2.0,
        flashTimer: 0,
        phase: 1,
        _pendingDamage: false,
        _damageDelay: 0,
        _chargeDamage: false,
        _specialDamage: false,
        _teleporting: false,
        _teleportDelay: 0,
        _fireProjectile: false,
        _projectileDelay: 0,
      }
      this.setPhase(PHASE.PLAYING)
    }
  }

  // ---------------------------------------------------------------------------
  // Particles
  // ---------------------------------------------------------------------------

  /** Spawn a random ambient particle. */
  spawnAmbientParticle() {
    const p = {
      x: Math.random() * W,
      y: Math.random() * GROUND_Y * 0.8,
      vx: (Math.random() - 0.5) * 20,
      vy: -Math.random() * 15 - 5,
      life: Math.random() * 3 + 2,
      maxLife: 0,
      size: Math.random() * 2 + 1,
      color: ["#ff2d95", "#00ffff", "#8b5cf6", "#ff6b35"][
        Math.floor(Math.random() * 4)
      ],
    }
    p.maxLife = p.life
    this.gameParticles.push(p)
  }

  /**
   * Spawn hit effect particles.
   * @param {number} x
   * @param {number} y
   * @param {string} color - CSS color
   * @param {number} count
   */
  spawnHitParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      this.gameParticles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 200,
        vy: (Math.random() - 0.5) * 200 - 50,
        life: Math.random() * 0.3 + 0.1,
        maxLife: 0.4,
        size: Math.random() * 3 + 1,
        color,
      })
    }
  }

  /**
   * Update all game particles. Spawns ambient particles during PLAYING.
   * @param {number} dt
   */
  updateGameParticles(dt) {
    if (Math.random() < 4.8 * dt && this.phase === PHASE.PLAYING)
      this.spawnAmbientParticle()
    for (let i = this.gameParticles.length - 1; i >= 0; i--) {
      const p = this.gameParticles[i]
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.life -= dt
      if (p.life <= 0) {
        this.gameParticles[i] = this.gameParticles[this.gameParticles.length - 1]
        this.gameParticles.pop()
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Screen shake
  // ---------------------------------------------------------------------------

  /**
   * Start a screen shake effect.
   * @param {number} amount - Shake intensity in pixels
   * @param {number} duration - Duration in seconds
   */
  triggerShake(amount, duration) {
    this.shakeAmount = amount
    this.shakeDuration = duration
  }

  /**
   * Decay the screen shake over time.
   * @param {number} dt
   */
  updateShake(dt) {
    if (this.shakeDuration > 0) {
      this.shakeDuration -= dt
      if (this.shakeDuration <= 0) this.shakeAmount = 0
    }
  }
}
