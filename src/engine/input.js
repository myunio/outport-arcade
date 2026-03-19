/**
 * Centralized input manager for game controllers.
 *
 * Tracks keyboard state (which keys are currently held) and provides
 * event routing. Automatically cleans up all listeners on destroy().
 *
 * @example
 * const input = new InputManager(canvas)
 * input.onKey = (e) => { if (e.code === "Space") engine.jump() }
 *
 * // In game update loop:
 * if (input.isDown("ArrowLeft")) player.x -= SPEED * dt
 *
 * // On teardown:
 * input.destroy()
 *
 * @module games/engine/input
 */
export class InputManager {
  /**
   * @param {HTMLCanvasElement} canvas - Game canvas element for click events
   */
  constructor(canvas) {
    /** @private */
    this._keys = new Set()
    /** @private */
    this._canvas = canvas
    /** @private */
    this._clickHandlers = []

    /**
     * Callback for keydown events. Set by the controller to route
     * game-specific key bindings.
     *
     * @type {function(KeyboardEvent): void|null}
     */
    this.onKey = null

    /** @private */
    this._onKeyDown = (e) => {
      this._keys.add(e.code)
      if (this.onKey) this.onKey(e)
    }

    /** @private */
    this._onKeyUp = (e) => {
      this._keys.delete(e.code)
    }

    document.addEventListener("keydown", this._onKeyDown)
    document.addEventListener("keyup", this._onKeyUp)
  }

  /**
   * Check if a key is currently held down.
   *
   * @param {string} code - KeyboardEvent.code value (e.g., "ArrowLeft", "Space")
   * @returns {boolean}
   */
  isDown(code) {
    return this._keys.has(code)
  }

  /**
   * Register a click handler on the game canvas.
   *
   * @param {function(): void} handler
   */
  onClick(handler) {
    this._canvas.addEventListener("click", handler)
    this._clickHandlers.push(handler)
  }

  /**
   * Remove all listeners and clear state.
   * Must be called on game teardown to prevent memory leaks.
   */
  destroy() {
    this._keys.clear()

    document.removeEventListener("keydown", this._onKeyDown)
    document.removeEventListener("keyup", this._onKeyUp)

    for (const handler of this._clickHandlers) {
      this._canvas.removeEventListener("click", handler)
    }
    this._clickHandlers = []
    this.onKey = null
  }
}
