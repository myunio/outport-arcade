/**
 * Cod Jigger — Core game engine.
 *
 * Meditative fishing game: wait for a bite, pull at the right moment.
 * Manages game state, bite timing, and fish counting.
 * Extends BaseEngine for game loop, phase machine, and scoring.
 *
 * All timers are frame-based and scaled by delta-time so the game
 * runs consistently regardless of display refresh rate.
 *
 * @module games/codjigger/engine
 */
import { BaseEngine, TARGET_FRAME_MS } from "../../engine/base_engine.js"
import {
  BITE_MIN_DELAY,
  BITE_MAX_DELAY,
  BITE_WINDOW,
  PULL_DURATION,
  CAUGHT_DISPLAY,
  MISSED_DISPLAY,
} from "./config.js"

/** @type {string[]} Encouraging messages when a fish is caught. */
const CATCH_MESSAGES = [
  "Beauty!",
  "What a jig!",
  "Right on!",
  "She's a good one!",
  "Haul 'er in!",
  "Yes b'y!",
  "Jigged 'er!",
]

/** @type {string[]} Messages when the fish gets away. */
const MISS_MESSAGES = [
  "Too soon, b'y",
  "Patience now...",
  "Scared 'em off",
  "Easy does it...",
  "Steady on...",
]

/**
 * Core game engine for Cod Jigger.
 *
 * @example
 * const engine = new CodJiggerEngine({
 *   onRender: (state) => renderer.draw(state),
 * })
 * engine.start()
 */
export class CodJiggerEngine extends BaseEngine {
  /** @type {string[]} Game phases for the phase machine. */
  static phases = ["START", "WAITING", "BITE", "PULLING", "CAUGHT", "MISSED"]

  /** Resets all game-specific state. */
  reset() {
    super.reset()
    this.fishCaught = 0
    this.biteTimer = 0
    this.biteWindowTimer = 0
    this.pullTimer = 0
    this.caughtTimer = 0
    this.missedTimer = 0
    this.lineShake = 0
    this.message = ""
    this.jiggerY = 0
    this.fishY = 0
  }

  /**
   * Player pulls the line. Context-dependent:
   * - START → begin fishing
   * - WAITING → pulled too early, scare fish
   * - BITE → caught a fish!
   */
  pull() {
    if (this.phase === "START") {
      this.setPhase("WAITING")
      this._scheduleBite()
      return
    }

    if (this.phase === "BITE") {
      this.setPhase("PULLING")
      this.pullTimer = PULL_DURATION
      this.fishCaught++
      this.addScore(1)
      this.message = CATCH_MESSAGES[Math.floor(Math.random() * CATCH_MESSAGES.length)]
      this.lineShake = 0
      return
    }

    if (this.phase === "WAITING") {
      this.setPhase("MISSED")
      this.missedTimer = MISSED_DISPLAY
      this.message = MISS_MESSAGES[Math.floor(Math.random() * MISS_MESSAGES.length)]
    }
  }

  /**
   * Game-specific update logic — called each frame by BaseEngine.
   *
   * @param {number} dt - Delta-time factor (1.0 = one 60fps frame)
   */
  update(dt) {
    // Gentle jigger bob in water
    this.jiggerY = Math.sin(this.frameCount * 0.06) * 3

    if (this.phase === "WAITING") {
      this.biteTimer -= dt
      if (this.biteTimer <= 0) {
        this.setPhase("BITE")
        this.biteWindowTimer = Math.floor(BITE_WINDOW / TARGET_FRAME_MS)
      }
    }

    if (this.phase === "BITE") {
      this.lineShake = Math.sin(this.frameCount * 0.8) * 5
      this.biteWindowTimer -= dt
      if (this.biteWindowTimer <= 0) {
        this.setPhase("MISSED")
        this.missedTimer = MISSED_DISPLAY
        this.lineShake = 0
        this.message = "Got away..."
      }
    }

    if (this.phase === "PULLING") {
      this.pullTimer -= dt
      this.lineShake = 0
      this.fishY = 1 - this.pullTimer / PULL_DURATION
      if (this.pullTimer <= 0) {
        this.setPhase("CAUGHT")
        this.caughtTimer = CAUGHT_DISPLAY
      }
    }

    if (this.phase === "CAUGHT") {
      this.caughtTimer -= dt
      if (this.caughtTimer <= 0) {
        this.setPhase("WAITING")
        this.message = ""
        this._scheduleBite()
      }
    }

    if (this.phase === "MISSED") {
      this.missedTimer -= dt
      this.lineShake = 0
      if (this.missedTimer <= 0) {
        this.setPhase("WAITING")
        this.message = ""
        this._scheduleBite()
      }
    }
  }

  /**
   * Returns game-specific state merged with base state.
   *
   * @returns {Object} Complete state snapshot for renderer
   */
  getState() {
    return {
      ...super.getState(),
      fishCaught: this.fishCaught,
      lineShake: this.lineShake,
      jiggerY: this.jiggerY,
      fishY: this.fishY,
      pullTimer: this.pullTimer,
      pullDuration: PULL_DURATION,
      caughtTimer: this.caughtTimer,
      missedTimer: this.missedTimer,
      message: this.message,
    }
  }

  /**
   * Schedules the next bite after a random delay.
   *
   * @private
   */
  _scheduleBite() {
    const delayMs = BITE_MIN_DELAY + Math.random() * (BITE_MAX_DELAY - BITE_MIN_DELAY)
    this.biteTimer = Math.floor(delayMs / TARGET_FRAME_MS)
  }
}
