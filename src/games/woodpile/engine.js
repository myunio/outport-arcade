/**
 * Woodpile Tycoon — Core game engine.
 *
 * Pure clicker/idle game. Click to chop wood, auto-progress through
 * tiers at thresholds. No menus, no choices — transformations are
 * automatic. Inspired by Den Young of Springdale, NL.
 *
 * @module games/woodpile/engine
 */
import { BaseEngine } from "../../engine/base_engine.js"
import { TIERS, PHASE, COLORS, CANVAS_WIDTH } from "./config.js"

export class WoodpileEngine extends BaseEngine {
  static phases = ["START", "PLAYING"]

  reset() {
    super.reset()
    this.logs = 0
    this.tierIndex = 0
    this.clickAnim = 0
    this.shakeTimer = 0
    this.transformTimer = 0
    this.idleAccum = 0
    this.idleEarned = 0 // from server on load
    this.totalClicks = 0
  }

  /** Load saved state from server. */
  loadState(serverState) {
    if (!serverState) return

    this.logs = serverState.logs || 0
    this.tierIndex = serverState.tier_index || 0
    this.idleEarned = serverState.idle_earned || 0

    // Clamp tier index to valid range
    if (this.tierIndex >= TIERS.length) {
      this.tierIndex = TIERS.length - 1
    }
  }

  /** Return state for server save. */
  getSaveState() {
    const tier = TIERS[this.tierIndex]
    return {
      tier_index: this.tierIndex,
      logs: Math.floor(this.logs),
      idle_rate: tier.idleRate,
    }
  }

  /** Current tier object. */
  get tier() {
    return TIERS[this.tierIndex]
  }

  /** Current era number. */
  get era() {
    return this.tier.era
  }

  /** Handle a click/tap — add logs, trigger animations. */
  chop() {
    if (this.phase === PHASE.START) {
      this.setPhase(PHASE.PLAYING)
      return
    }

    if (this.phase !== PHASE.PLAYING) return

    this.logs += this.tier.perClick
    this.clickAnim = 0.25
    this.shakeTimer = 0.05
    this.totalClicks++
    this.idleEarned = 0

    // Particle burst
    if (this.particles) {
      const colors = this.era >= 3 ? COLORS.metalChips : COLORS.woodChips
      this.particles.emit({
        x: CANVAS_WIDTH * 0.35,
        y: 280,
        count: 6,
        speed: [120, 300],
        lifetime: [0.333, 0.583],
        colors,
        spread: Math.PI * 1.5,
        angle: -Math.PI / 2,
        gravity: 540,
        size: 3,
      })
    }

    this._checkTierUp()
  }

  /**
   * Advance game state by one tick.
   *
   * @param {number} dt - Delta time in seconds since last frame.
   */
  update(dt) {
    if (this.phase !== PHASE.PLAYING) return

    // Tick idle income (idleRate is already logs/second)
    const idleRate = this.tier.idleRate
    if (idleRate > 0) {
      this.idleAccum += idleRate * dt
      if (this.idleAccum >= 1) {
        const earned = Math.floor(this.idleAccum)
        this.logs += earned
        this.idleAccum -= earned
      }
    }

    // Tick animations
    if (this.clickAnim > 0) this.clickAnim -= dt
    if (this.shakeTimer > 0) this.shakeTimer -= 0.5 * dt
    if (this.transformTimer > 0) this.transformTimer -= dt

    // Particles
    if (this.particles) this.particles.update(dt)

    // Check tier (idle income can also trigger tier-ups)
    this._checkTierUp()
  }

  getState() {
    return {
      ...super.getState(),
      logs: this.logs,
      tierIndex: this.tierIndex,
      tier: this.tier,
      era: this.era,
      clickAnim: this.clickAnim,
      shakeTimer: this.shakeTimer,
      transformTimer: this.transformTimer,
      idleEarned: this.idleEarned,
      totalClicks: this.totalClicks,
      particles: this.particles ? this.particles.particles : [],
    }
  }

  /** This game never ends — override canRestart to always return false. */
  canRestart() {
    return false
  }

  /** Reset all progress back to tier 0. */
  resetProgress() {
    this.logs = 0
    this.tierIndex = 0
    this.idleAccum = 0
    this.idleEarned = 0
    this.totalClicks = 0
    this.transformTimer = 0
  }

  /**
   * Debug: jump to a specific tier index.
   * Sets logs to just above that tier's threshold.
   *
   * @param {number} index - Tier index (0-11)
   */
  jumpToTier(index) {
    if (index < 0 || index >= TIERS.length) return
    this.tierIndex = index
    // Set logs to the threshold of the previous tier (start of this tier)
    this.logs = index > 0 ? TIERS[index - 1].threshold : 0
    this.transformTimer = 1.0
    this.shakeTimer = 0.167
  }

  // ---

  _checkTierUp() {
    const tier = this.tier
    if (this.logs >= tier.threshold && this.tierIndex < TIERS.length - 1) {
      this.tierIndex++
      this.transformTimer = 1.0
      this.shakeTimer = 0.167

      // Big particle burst
      if (this.particles) {
        const colors = this.era >= 3 ? COLORS.metalChips : COLORS.woodChips
        for (let i = 0; i < 3; i++) {
          this.particles.emit({
            x: 250 + i * 100,
            y: 200,
            count: 10,
            speed: [120, 360],
            lifetime: [0.417, 0.75],
            colors,
            spread: Math.PI * 2,
            gravity: 432,
            size: 4,
          })
        }
      }
    }
  }
}
