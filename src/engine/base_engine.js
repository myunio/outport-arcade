/**
 * Base game engine — shared foundation for all Outport mini-games.
 *
 * Provides the game loop (requestAnimationFrame with seconds-based delta-time),
 * a phase machine for game state transitions, scoring with high score
 * tracking, and a state snapshot system for renderer communication.
 *
 * Games extend this class and implement:
 * - `update(dt)` — game-specific logic per frame
 * - `getState()` — return game-specific state merged with super.getState()
 * - `reset()` — initialize game-specific state (call super.reset())
 * - `onPhaseChange(from, to)` — optional hook for phase transitions
 *
 * @example
 * class MyEngine extends BaseEngine {
 *   static phases = ["START", "PLAYING", "DEAD"]
 *
 *   reset() {
 *     super.reset()
 *     this.enemies = []
 *   }
 *
 *   update(dt) {
 *     for (const e of this.enemies) e.x -= SPEED * dt
 *   }
 *
 *   getState() {
 *     return { ...super.getState(), enemies: this.enemies }
 *   }
 * }
 *
 * @module games/engine/base_engine
 */

export class BaseEngine {
  /** @type {string[]} Phases that trigger onGameOver and stop the loop. */
  static terminalPhases = ["DEAD"]

  /** @type {string[]} Phases where Q-to-quit is allowed (deliberate, never mid-gameplay). */
  static quitPhases = ["START", "DEAD"]

  /**
   * @param {Object} callbacks
   * @param {function(Object): void} callbacks.onRender - Called each frame with state snapshot
   * @param {function(number): void} [callbacks.onGameOver] - Called once when phase becomes DEAD
   * @param {Object} [callbacks.audio] - AudioManager instance
   * @param {Object} [callbacks.sprites] - SpriteManager instance
   * @param {Object} [callbacks.input] - InputManager instance
   * @param {Object} [callbacks.particles] - ParticleSystem instance
   */
  constructor({ onRender, onGameOver, audio, sprites, input, particles } = {}) {
    this._onRender = onRender
    this._onGameOver = onGameOver || (() => {})
    this.audio = audio || null
    this.sprites = sprites || null
    this.input = input || null
    this.particles = particles || null
    this._frameId = null
    this._lastTime = 0
    /** @private Bound loop callback — avoids allocating a closure every frame. */
    this._boundLoop = (t) => this._loop(t)
    this.reset()
  }

  /**
   * Resets base state. Subclasses MUST call super.reset().
   * Preserves highScore across resets.
   */
  reset() {
    const prevHighScore = this.highScore || 0
    this.phase = this.constructor.phases?.[0] || "START"
    this.score = 0
    this.highScore = prevHighScore
    this.frameCount = 0
    this.elapsed = 0
    this.paused = false
    this._lastTime = 0
  }

  /** Starts the game loop. */
  start() {
    this._lastTime = performance.now()
    this._frameId = requestAnimationFrame(this._boundLoop)
  }

  /** Stops the game loop. */
  stop() {
    if (this._frameId) {
      cancelAnimationFrame(this._frameId)
      this._frameId = null
    }
  }

  /**
   * Pauses the game. Renders one final frame with paused state,
   * then stops the loop. Does not change the game phase — pause
   * is an engine-level concern, not a game concept.
   */
  pause() {
    if (this.paused) return
    this.paused = true
    this.stop()
    this.audio?.suspend()
    this._onRender(this.getState())
  }

  /**
   * Resumes from pause. Resets _lastTime to prevent a dt spike
   * from the time spent paused, then restarts the loop.
   */
  resume() {
    if (!this.paused) return
    this.paused = false
    this.audio?.resume()
    this.start()
  }

  /**
   * Transitions to a new phase. Calls onPhaseChange if the phase actually changes.
   *
   * @param {string} newPhase - Phase name (must be in static phases array)
   */
  setPhase(newPhase) {
    const oldPhase = this.phase
    if (oldPhase === newPhase) return
    this.phase = newPhase
    this.onPhaseChange(oldPhase, newPhase)
  }

  /**
   * Hook called on phase transitions. Override in subclasses for side effects.
   * @param {string} from - Previous phase
   * @param {string} to - New phase
   */
  onPhaseChange(from, to) {
    // Override in subclasses for side effects (audio, state transitions)
  }

  /**
   * Check if the game can be restarted. Returns true when the game is over.
   *
   * @returns {boolean}
   */
  canRestart() {
    return this.phase === "DEAD"
  }

  /**
   * Restart the game. Resets state, sets phase to PLAYING, restarts loop.
   * Subclasses may override to add game-specific restart logic
   * (e.g., Overboard spawning first piece) — call super.restart() first.
   */
  restart() {
    this.stop()
    this.reset()
    this.setPhase("PLAYING")
    this.start()
  }

  /**
   * Adds points to score and updates high score.
   *
   * @param {number} points - Points to add
   */
  addScore(points) {
    this.score += points
    if (this.score > this.highScore) {
      this.highScore = this.score
    }
  }

  /**
   * Returns base state snapshot. Subclasses MUST call super.getState()
   * and merge their state on top.
   *
   * @returns {Object} Base state snapshot
   */
  getState() {
    return {
      phase: this.phase,
      score: Math.floor(this.score),
      highScore: Math.floor(this.highScore),
      frameCount: this.frameCount,
      elapsed: this.elapsed,
      paused: this.paused,
    }
  }

  /**
   * Game-specific update logic. Called once per frame.
   * Subclasses MUST implement this.
   *
   * @abstract
   * @param {number} dt - Delta-time in seconds (e.g., ~0.016 at 60fps)
   */
  update(dt) {
    // Override in subclass
  }

  // ---------------------------------------------------------------------------
  // Private — game loop
  // ---------------------------------------------------------------------------

  /**
   * Main loop. Computes delta-time in seconds, calls update and render,
   * checks for terminal phase (game over). dt is capped at 0.05s (50ms)
   * to prevent runaway updates after tab switches. frameCount accumulates
   * at ~60/sec regardless of display refresh rate (framerate-independent).
   *
   * @private
   * @param {number} now - Timestamp from requestAnimationFrame
   */
  _loop(now) {
    const elapsed = now - this._lastTime
    this._lastTime = now
    const dt = Math.min(elapsed / 1000, 0.05)

    this.frameCount += dt * 60
    this.elapsed += elapsed / 1000

    this.update(dt)
    this._onRender(this.getState())

    if (this.constructor.terminalPhases.includes(this.phase)) {
      this._onGameOver(Math.floor(this.score))
      return
    }

    this._frameId = requestAnimationFrame(this._boundLoop)
  }
}
