// src/host/game_host.js

/**
 * Framework-agnostic game hosting layer.
 *
 * Creates and manages a full-screen canvas overlay, wires input routing,
 * handles pause/help overlays, and coordinates the engine/renderer lifecycle.
 * Consumer provides callbacks for persistence and framework integration.
 *
 * Extracted from Outport's Stimulus-based BaseController so games can run
 * in any environment: Rails/Stimulus, Vite/Vue, static HTML, etc.
 *
 * @example
 * import { GameHost } from "outport-arcade/host/game_host"
 * import { BaymanEngine } from "outport-arcade/games/bayman/engine"
 * import { BaymanRenderer } from "outport-arcade/games/bayman/renderer"
 *
 * const host = new GameHost(document.body, {
 *   engine: BaymanEngine,
 *   renderer: BaymanRenderer,
 *   config: {
 *     CANVAS_WIDTH: 600,
 *     CANVAS_HEIGHT: 300,
 *     containerBackground: "#0a1628",
 *     gameName: "bayman",
 *     gameInstructions: { title: "Bayman", controls: [["Space", "Jump"]] },
 *     getAssetManifest: () => ({ effects: ["jump"] }),
 *   },
 *   canvas: { width: 600, height: 300 },
 *   resolveAsset: (path) => `/games/bayman/${path}`,
 *   handleKey: (e, engine) => { if (e.code === "Space") engine.jump() },
 *   onScore: async (score) => { ... },
 *   onExit: (engine) => { ... },
 * })
 *
 * await host.start()
 *
 * @module host/game_host
 */
import { loadAssets } from "../engine/assets.js"
import { InputManager } from "../engine/input.js"
import { ParticleSystem } from "../engine/particles.js"

export class GameHost {
  /**
   * @param {HTMLElement} container - DOM element to host the game in
   * @param {Object} options
   * @param {Function} options.engine - Engine class constructor
   * @param {Function} options.renderer - Renderer class constructor
   * @param {Object} options.config - Game config object
   * @param {number} options.config.CANVAS_WIDTH - Logical canvas width
   * @param {number} options.config.CANVAS_HEIGHT - Logical canvas height
   * @param {string} [options.config.containerBackground="#0a1628"] - Overlay container background
   * @param {string} [options.config.gameName] - Game identifier
   * @param {Object} [options.config.gameInstructions] - Instructions for pause/help overlays
   * @param {Function} [options.config.getAssetManifest] - Returns asset manifest object
   * @param {Object} options.canvas - Canvas dimensions { width, height }
   * @param {Function} options.resolveAsset - Maps logical path to URL
   * @param {Function} [options.handleKey] - Game-specific key routing: (event, engine) => {}
   * @param {Function} [options.handleClick] - Game-specific click routing: (engine) => {}
   * @param {Function} [options.onScore] - Async callback on game over. Can return { leaderboard, newHighScore }
   * @param {Function} [options.onPhaseChange] - Called on phase transitions
   * @param {Function} [options.onReady] - Called when game is loaded and ready
   * @param {Function} [options.onExit] - Called on destroy with engine instance: (engine) => {}
   * @param {Object} [options.initialState] - Saved state to restore (calls engine.loadState())
   * @param {string} [options.storageKey="outport_arcade_audio"] - localStorage key for audio volume
   */
  constructor(container, options) {
    /** @private */
    this._container = container
    /** @private */
    this._options = options

    /** @private */
    this._destroyed = false
    /** @private */
    this._overlay = null
    /** @private */
    this._engine = null
    /** @private */
    this._renderer = null
    /** @private */
    this._input = null
    /** @private */
    this._audio = null
    /** @private */
    this._sprites = null
    /** @private */
    this._particles = null
    /** @private */
    this._pauseOverlay = null
    /** @private */
    this._helpOverlay = null
    /** @private */
    this._pausedForHelp = false
    /** @private — display-to-logical scale factor for overlay text sizing */
    this._uiScale = 1
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Load assets, build the overlay, create engine + renderer, wire input,
   * and start the game loop.
   */
  async start() {
    if (this._overlay) return

    const config = this._options.config || {}

    // Load assets (audio + sprites)
    const manifest = config.getAssetManifest?.() || {}
    const { audio, sprites } = await loadAssets(manifest, {
      resolveAsset: this._options.resolveAsset,
    })
    this._audio = audio
    this._sprites = sprites

    // Set custom storage key for audio volume persistence
    if (this._options.storageKey) {
      this._audio.storageKey = this._options.storageKey
    }

    // Build overlay DOM
    const canvasWidth = this._options.canvas?.width || config.CANVAS_WIDTH
    const canvasHeight = this._options.canvas?.height || config.CANVAS_HEIGHT
    this._overlay = this._buildOverlay(canvasWidth, canvasHeight)
    this._container.appendChild(this._overlay)

    const canvas = this._overlay.querySelector("canvas")
    const gameContainer = this._overlay.querySelector("[data-game-container]")

    // Trigger slide-up animation
    gameContainer.offsetHeight // Force reflow
    gameContainer.style.transform = "translateY(0)"
    gameContainer.style.opacity = "1"

    // Create particle system
    this._particles = new ParticleSystem()

    // Create renderer (its constructor may reset canvas.width/height — restore after)
    const RendererClass = this._options.renderer
    this._renderer = new RendererClass(canvas)

    // Renderer constructors set canvas.width/height to the game's logical size,
    // which resets the canvas state. Re-apply the HiDPI sizing and context scale
    // so the game draws at logical coordinates but renders at display resolution.
    const dpr = window.devicePixelRatio || 1
    const logicalWidth = canvas.width   // What the renderer just set (e.g., 600)
    const logicalHeight = canvas.height // e.g., 300
    const displayWidth = parseInt(canvas.style.width)
    const displayHeight = parseInt(canvas.style.height)
    canvas.width = displayWidth * dpr
    canvas.height = displayHeight * dpr
    const ctx = canvas.getContext("2d")
    ctx.scale((displayWidth * dpr) / logicalWidth, (displayHeight * dpr) / logicalHeight)
    // Re-assign ctx to renderer since getContext returns the same object but
    // the renderer cached it before the scale was applied
    this._renderer.ctx = ctx

    // Scale factor for DOM overlays (help, pause) so text scales with canvas
    this._uiScale = displayHeight / logicalHeight

    // Create engine
    const EngineClass = this._options.engine
    this._engine = new EngineClass({
      onRender: (state) => this._renderer.draw(state),
      onGameOver: (score) => this._handleGameOver(score),
      audio: this._audio,
      sprites: this._sprites,
      particles: this._particles,
    })

    // Restore saved state if provided
    if (this._options.initialState) {
      this._engine.loadState(this._options.initialState)
    }

    // Wire input
    this._input = new InputManager(canvas)
    this._engine.input = this._input

    this._input.onKey = (e) => this._routeKey(e)

    if (this._options.handleClick) {
      this._input.onClick(() => this._options.handleClick(this._engine))
    }

    // Start!
    this._engine.start()

    // Notify consumer
    this._options.onReady?.()
  }

  /**
   * Tear down the game. Calls onExit(engine) BEFORE teardown so the
   * consumer can read engine state, then stops everything and removes DOM.
   *
   * Idempotent — safe to call multiple times (no-ops after first).
   */
  destroy() {
    if (this._destroyed) return
    this._destroyed = true

    // Notify consumer before teardown so they can read engine state
    this._options.onExit?.(this._engine)

    // Remove overlays if active
    this._removePauseOverlay()
    this._removeHelpOverlay()

    // Stop audio
    if (this._audio) {
      this._audio.stopAll()
    }

    // Stop engine
    if (this._engine) {
      this._engine.stop()
      this._engine = null
    }

    // Destroy input manager
    if (this._input) {
      this._input.destroy()
      this._input = null
    }

    // Remove overlay
    if (this._overlay) {
      this._overlay.remove()
      this._overlay = null
    }

    // Clear references
    this._renderer = null
    this._particles = null
    this._audio = null
    this._sprites = null
  }

  /**
   * Get the current engine save state, if the engine supports it.
   *
   * @returns {Object|null} Save state, or null if unavailable
   */
  getEngineState() {
    return this._engine?.getSaveState?.() ?? null
  }

  // ---------------------------------------------------------------------------
  // Key routing
  // ---------------------------------------------------------------------------

  /**
   * Central key router. Handles all keyboard input based on current state.
   *
   * Consistent behavior across all games:
   *
   * | State   | Esc        | P      | ?         | Q    | M    | Space/other |
   * |---------|------------|--------|-----------|------|------|-------------|
   * | HELP    | Close help | —      | Close help| —    | —    | Close help  |
   * | PAUSED  | Resume     | Resume | Help      | Quit | Mute | Resume      |
   * | any     | —          | —      | Help      | —    | Mute | —           |
   * | START   | —          | —      | —         | Quit | —    | → handleKey |
   * | DEAD    | —          | —      | —         | Quit | —    | → handleKey |
   * | PLAYING | Pause      | Pause  | —         | —    | —    | → handleKey |
   *
   * @private
   * @param {KeyboardEvent} e
   */
  _routeKey(e) {
    const key = e.key
    const phase = this._engine?.phase

    // --- HELP overlay is showing ---
    if (this._helpOverlay) {
      if (key === "?" || key === "Escape" || key === " ") {
        e.preventDefault()
        this.toggleHelp()
      }
      return
    }

    // --- PAUSED ---
    if (this._engine?.paused) {
      e.preventDefault()
      if (key === "Escape" || key === "p" || key === "P" || key === " ") {
        this.togglePause()
      } else if (key === "q" || key === "Q") {
        this._removePauseOverlay()
        this.destroy()
      } else if (key === "?") {
        this.toggleHelp()
      } else if (key === "m" || key === "M") {
        if (this._audio) this._audio.toggleMute()
      }
      return
    }

    // --- ? for help (available in any non-overlay state) ---
    if (key === "?") {
      e.preventDefault()
      this.toggleHelp()
      return
    }

    // --- M to toggle mute (available in any state) ---
    if (key === "m" || key === "M") {
      e.preventDefault()
      if (this._audio) {
        this._audio.toggleMute()
      }
      return
    }

    // --- Q to quit (START, DEAD — deliberate, never mid-gameplay) ---
    if (key === "q" || key === "Q") {
      if (phase === "START" || phase === "DEAD") {
        e.preventDefault()
        this.destroy()
      }
      return
    }

    // --- Escape: pause during gameplay, do nothing otherwise ---
    if (key === "Escape") {
      e.preventDefault()
      if (phase !== "START" && phase !== "DEAD") {
        this.togglePause()
      }
      return
    }

    // --- P: pause/resume during gameplay only ---
    if (key === "p" || key === "P") {
      if (phase !== "START" && phase !== "DEAD") {
        e.preventDefault()
        this.togglePause()
      }
      return
    }

    // --- All other keys: pass to game ---
    this._options.handleKey?.(e, this._engine)
  }

  // ---------------------------------------------------------------------------
  // Pause
  // ---------------------------------------------------------------------------

  /**
   * Toggle the pause state. When pausing, shows the pause overlay
   * with game instructions. When resuming, removes it.
   */
  togglePause() {
    if (!this._engine) return

    if (this._engine.paused) {
      this._removePauseOverlay()
      this._engine.resume()
    } else {
      this._engine.pause()
      this._showPauseOverlay()
    }
  }

  /**
   * Build and show the pause overlay DOM element over the game container.
   *
   * @private
   */
  _showPauseOverlay() {
    if (this._pauseOverlay) return

    const instructions = this._options.config?.gameInstructions || {
      title: "Paused",
      description: "",
      controls: [],
    }

    this._pauseOverlay = this._buildOverlayPanel({
      dataAttr: "data-pause-overlay",
      zIndex: 10,
      background: "rgba(0, 0, 0, 0.85)",
      maxWidth: "80%",
      padding: 24,
      title: instructions.title,
      titleSize: 24,
      subtitle: "PAUSED",
      subtitleStyle: { letterSpacing: "3px", color: "#888", textTransform: "uppercase" },
      controls: instructions.controls,
      controlsFontSize: 12,
      controlsPadding: 3,
      controlsKeyPadding: 12,
      hint: "ESC / SPACE to resume \u00B7 Q to quit \u00B7 ? for help",
      hintSize: 11,
      onClick: (e) => {
        e.stopPropagation()
        this.togglePause()
      },
    })
  }

  /**
   * Remove the pause overlay DOM element.
   *
   * @private
   */
  _removePauseOverlay() {
    if (this._pauseOverlay) {
      this._pauseOverlay.remove()
      this._pauseOverlay = null
    }
  }

  // ---------------------------------------------------------------------------
  // Help
  // ---------------------------------------------------------------------------

  /**
   * Toggle the help overlay. If the game is running, pauses first.
   * Pressing ? again (or clicking) dismisses help and resumes if we paused.
   */
  toggleHelp() {
    if (this._helpOverlay) {
      this._removeHelpOverlay()
      // Resume if we auto-paused for help
      if (this._pausedForHelp) {
        this._pausedForHelp = false
        if (this._engine.paused) this._engine.resume()
      }
      return
    }

    // Pause the game if it's actively playing
    const wasPlaying = this._engine && !this._engine.paused && this._engine.phase !== "START" && this._engine.phase !== "DEAD"
    if (wasPlaying) {
      this._engine.pause()
      this._pausedForHelp = true
    }

    this._showHelpOverlay()
  }

  /**
   * Build and show the help overlay with full game mechanics.
   *
   * @private
   */
  _showHelpOverlay() {
    if (this._helpOverlay) return

    const instructions = this._options.config?.gameInstructions || { title: "Help", controls: [], tips: [] }

    // Merge game controls with common controls
    const allControls = [
      ...(instructions.controls || []),
      ["P / Esc", "Pause"],
      ["M", "Mute / unmute"],
      ["?", "Help"],
    ]

    this._helpOverlay = this._buildOverlayPanel({
      dataAttr: "data-help-overlay",
      zIndex: 20,
      background: "rgba(0, 0, 0, 0.9)",
      maxWidth: "90%",
      padding: 16,
      title: instructions.title,
      titleSize: 16,
      description: instructions.description,
      controls: allControls,
      controlsFontSize: 10,
      controlsPadding: 1,
      controlsKeyPadding: 8,
      tips: instructions.tips,
      hint: "? or click to close",
      hintSize: 9,
      hintColor: "#555",
      onClick: (e) => {
        e.stopPropagation()
        this.toggleHelp()
      },
    })
  }

  /**
   * Remove the help overlay DOM element.
   *
   * @private
   */
  _removeHelpOverlay() {
    if (this._helpOverlay) {
      this._helpOverlay.remove()
      this._helpOverlay = null
    }
  }

  // ---------------------------------------------------------------------------
  // Overlay panel builder
  // ---------------------------------------------------------------------------

  /**
   * Build a styled overlay panel (used by both pause and help overlays).
   *
   * Creates the outer overlay div, inner content div with optional title,
   * subtitle, description, controls table, tips, and hint. Appends to
   * the game container and returns the overlay element.
   *
   * @private
   * @param {Object} config
   * @param {string} config.dataAttr - Data attribute name for the overlay element
   * @param {number} config.zIndex - CSS z-index
   * @param {string} config.background - CSS background value
   * @param {string} config.maxWidth - CSS max-width for content
   * @param {number} config.padding - Base padding in logical pixels
   * @param {string} config.title - Title text
   * @param {number} config.titleSize - Font size for title
   * @param {string} [config.subtitle] - Small label below title (e.g., "PAUSED")
   * @param {Object} [config.subtitleStyle] - Extra CSS properties for subtitle
   * @param {string} [config.description] - Description text below title/subtitle
   * @param {Array<[string, string]>} [config.controls] - Key/action pairs for controls table
   * @param {number} [config.controlsFontSize] - Font size for controls
   * @param {number} [config.controlsPadding] - Vertical padding per control row
   * @param {number} [config.controlsKeyPadding] - Right padding on key cell
   * @param {string[]} [config.tips] - Tip strings
   * @param {string} config.hint - Hint text at the bottom
   * @param {number} config.hintSize - Font size for hint
   * @param {string} [config.hintColor="#666"] - Color for hint text
   * @param {function} config.onClick - Click handler for the overlay
   * @returns {HTMLElement} The overlay element
   */
  _buildOverlayPanel(config) {
    const s = this._uiScale || 1
    const px = (base) => `${Math.round(base * s)}px`

    const overlay = document.createElement("div")
    overlay.setAttribute(config.dataAttr, "")
    overlay.style.cssText = `
      position: absolute; inset: 0; z-index: ${config.zIndex};
      display: flex; align-items: center; justify-content: center;
      background: ${config.background};
      border-radius: 6px;
    `

    const content = document.createElement("div")
    content.style.cssText = `
      text-align: center; color: #F0EDE6;
      font-family: monospace; padding: ${px(config.padding)};
      max-width: ${config.maxWidth};
    `

    // Title
    const titleEl = document.createElement(config.subtitle ? "h2" : "div")
    titleEl.textContent = config.title
    titleEl.style.cssText = `
      font-size: ${px(config.titleSize)}; font-weight: bold;
      margin: 0 0 ${px(config.subtitle ? 8 : 2)} 0;
      color: #E8C65A;${config.subtitle ? " letter-spacing: 1px;" : ""}
    `
    content.appendChild(titleEl)

    // Subtitle (e.g., "PAUSED")
    if (config.subtitle) {
      const sub = document.createElement("div")
      sub.textContent = config.subtitle
      const subStyle = config.subtitleStyle || {}
      sub.style.cssText = `
        font-size: ${px(11)}; margin: 0 0 ${px(16)} 0;
        letter-spacing: ${subStyle.letterSpacing || "1px"};
        color: ${subStyle.color || "#888"};
        text-transform: ${subStyle.textTransform || "none"};
      `
      content.appendChild(sub)
    }

    // Description
    if (config.description) {
      const desc = document.createElement("div")
      desc.textContent = config.description
      desc.style.cssText = `
        font-size: ${px(10)}; line-height: 1.4; margin: 0 0 ${px(10)} 0;
        color: #888;
      `
      content.appendChild(desc)
    }

    // Controls table
    if (config.controls && config.controls.length > 0) {
      const table = document.createElement("table")
      const bottomMargin = config.tips ? 10 : 20
      table.style.cssText = `
        margin: 0 auto ${px(bottomMargin)} auto; border-collapse: collapse;
        font-size: ${px(config.controlsFontSize)};
      `
      for (const [key, action] of config.controls) {
        const row = document.createElement("tr")

        const keyCell = document.createElement("td")
        keyCell.textContent = key
        keyCell.style.cssText = `
          text-align: right; padding: ${px(config.controlsPadding)} ${px(config.controlsKeyPadding)} ${px(config.controlsPadding)} 0;
          color: #E8C65A; font-weight: bold; white-space: nowrap;
        `

        const actionCell = document.createElement("td")
        actionCell.textContent = action
        actionCell.style.cssText = `
          text-align: left; padding: ${px(config.controlsPadding)} 0;
          color: #CCC;
        `

        row.appendChild(keyCell)
        row.appendChild(actionCell)
        table.appendChild(row)
      }
      content.appendChild(table)
    }

    // Tips
    if (config.tips && config.tips.length > 0) {
      const divider = document.createElement("div")
      divider.style.cssText = `
        border-top: 1px solid #333; margin: 0 auto ${px(8)} auto;
        max-width: ${px(200)};
      `
      content.appendChild(divider)

      const tipsDiv = document.createElement("div")
      tipsDiv.style.cssText = `
        text-align: left; margin: 0 auto ${px(10)} auto;
        max-width: ${px(280)}; font-size: ${px(10)}; line-height: 1.5;
        color: #888;
      `
      for (const tip of config.tips) {
        const p = document.createElement("div")
        p.textContent = `\u00B7 ${tip}`
        p.style.cssText = `margin: 0 0 ${px(1)} 0;`
        tipsDiv.appendChild(p)
      }
      content.appendChild(tipsDiv)
    }

    // Hint
    const hintEl = document.createElement("div")
    hintEl.textContent = config.hint
    hintEl.style.cssText = `
      font-size: ${px(config.hintSize)}; color: ${config.hintColor || "#666"}; letter-spacing: 1px;
    `
    content.appendChild(hintEl)

    overlay.appendChild(content)

    // Click handler
    overlay.addEventListener("click", config.onClick)

    // Append to game container
    const gameContainer = this._overlay.querySelector("[data-game-container]")
    gameContainer.style.position = "relative"
    gameContainer.appendChild(overlay)

    return overlay
  }

  // ---------------------------------------------------------------------------
  // Overlay
  // ---------------------------------------------------------------------------

  /**
   * Build the fixed-position game overlay DOM.
   *
   * Creates a full-viewport backdrop with a centered container holding
   * the game canvas. Canvas is sized to fill ~75% of viewport height
   * while maintaining aspect ratio. Internal resolution is set to
   * display size x devicePixelRatio for crisp HiDPI rendering.
   *
   * @private
   * @param {number} width - Logical canvas width
   * @param {number} height - Logical canvas height
   * @returns {HTMLElement}
   */
  _buildOverlay(width, height) {
    const containerBackground = this._options.config?.containerBackground || "#0a1628"

    const overlay = document.createElement("div")
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0, 0, 0, 0.7);
    `

    const container = document.createElement("div")
    container.setAttribute("data-game-container", "")
    container.style.cssText = `
      background: ${containerBackground}; border-radius: 12px;
      padding: 12px; box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
      transform: translateY(40px); opacity: 0;
      transition: transform 300ms ease-out, opacity 300ms ease-out;
    `

    // Size the canvas to fill ~75% of viewport height, maintaining aspect ratio.
    // The canvas internal resolution is set to the display size x devicePixelRatio
    // so everything renders crisp. The 2D context is then scaled so game code still
    // draws using the original coordinates (e.g., 600x300).
    const maxHeight = window.innerHeight * 0.75
    const maxWidth = window.innerWidth * 0.85
    const aspectRatio = width / height
    let displayHeight = maxHeight
    let displayWidth = displayHeight * aspectRatio
    if (displayWidth > maxWidth) {
      displayWidth = maxWidth
      displayHeight = displayWidth / aspectRatio
    }
    displayWidth = Math.round(displayWidth)
    displayHeight = Math.round(displayHeight)

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    canvas.style.cssText = `
      display: block; border-radius: 6px; cursor: pointer;
      width: ${displayWidth}px;
      height: ${displayHeight}px;
    `

    container.appendChild(canvas)
    overlay.appendChild(container)
    return overlay
  }

  // ---------------------------------------------------------------------------
  // Game over
  // ---------------------------------------------------------------------------

  /**
   * Handle game over — delegate to consumer's onScore callback.
   *
   * If the consumer returns `{ leaderboard, newHighScore }`, passes
   * those to the renderer's drawGameOverWithLeaderboard method.
   *
   * @private
   * @param {number} score
   */
  async _handleGameOver(score) {
    if (!this._options.onScore) return

    try {
      const result = await this._options.onScore(score)

      if (result && this._renderer?.drawGameOverWithLeaderboard) {
        this._renderer.drawGameOverWithLeaderboard(
          score,
          result.leaderboard,
          result.newHighScore,
        )
      }
    } catch {
      // Consumer handles errors — silently continue
    }
  }
}
