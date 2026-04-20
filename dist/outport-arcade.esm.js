var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/engine/audio.js
var DEFAULT_STORAGE_KEY = "outport_arcade_audio";
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function loadStoredVolumes(key) {
  try {
    const stored = localStorage?.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}
function saveVolumes(key, volumes) {
  try {
    localStorage?.setItem(key, JSON.stringify(volumes));
  } catch {
  }
}
var EffectsPool = class {
  /**
   * @param {AudioContext} ctx
   * @param {GainNode} outputNode
   * @param {Map<string, AudioBuffer>} buffers
   */
  constructor(ctx, outputNode, buffers) {
    this._ctx = ctx;
    this._output = outputNode;
    this._buffers = buffers;
    this.volume = 1;
    this._gain = ctx.createGain();
    this._gain.connect(outputNode);
  }
  /**
   * Play a sound effect by name.
   *
   * @param {string} name - Buffer name
   * @param {Object} [options]
   * @param {number} [options.pitchVariance=0] - Random pitch variation (e.g., 0.1 = +/-10%)
   */
  play(name, { pitchVariance = 0 } = {}) {
    const buffer = this._buffers.get(name);
    if (!buffer) {
      console.warn(`[AudioManager] No buffer loaded for effect: ${name}`);
      return;
    }
    const source = this._ctx.createBufferSource();
    source.buffer = buffer;
    if (pitchVariance > 0) {
      source.playbackRate.value = 1 + (Math.random() - 0.5) * 2 * pitchVariance;
    }
    source.connect(this._gain);
    source.start();
  }
  /** @param {number} v - Volume 0-1. */
  setVolume(v) {
    this.volume = clamp(v, 0, 1);
    this._gain.gain.value = this.volume;
  }
};
var AudioChannel = class {
  /**
   * @param {AudioContext} ctx
   * @param {GainNode} outputNode
   * @param {Map<string, AudioBuffer>} buffers
   * @param {boolean} [loop=true]
   */
  constructor(ctx, outputNode, buffers, loop = true) {
    this._ctx = ctx;
    this._output = outputNode;
    this._buffers = buffers;
    this._loop = loop;
    this._source = null;
    this.volume = 1;
    this._gain = ctx.createGain();
    this._gain.connect(outputNode);
    this._currentTrack = null;
  }
  /**
   * Play a track by name. Stops any currently playing track.
   *
   * @param {string} name - Buffer name
   */
  play(name) {
    this.stop();
    const buffer = this._buffers.get(name);
    if (!buffer) {
      console.warn(`[AudioManager] No buffer loaded for track: ${name}`);
      return;
    }
    this._source = this._ctx.createBufferSource();
    this._source.buffer = buffer;
    this._source.loop = this._loop;
    this._source.connect(this._gain);
    this._source.start();
    this._currentTrack = name;
  }
  /**
   * Crossfade to a new track over the given duration.
   *
   * @param {string} name - Buffer name to crossfade to
   * @param {number} [duration=1.0] - Crossfade duration in seconds
   */
  crossfadeTo(name, duration = 1) {
    if (this._currentTrack === name) return;
    const buffer = this._buffers.get(name);
    if (!buffer) {
      console.warn(`[AudioManager] No buffer loaded for track: ${name}`);
      return;
    }
    if (this._source) {
      const oldGain = this._ctx.createGain();
      oldGain.gain.setValueAtTime(this.volume, this._ctx.currentTime);
      oldGain.gain.linearRampToValueAtTime(0, this._ctx.currentTime + duration);
      oldGain.connect(this._output);
      const oldSource = this._source;
      oldSource.disconnect();
      oldSource.connect(oldGain);
      setTimeout(() => {
        try {
          oldSource.stop();
        } catch {
        }
      }, duration * 1e3);
    }
    this._gain.gain.setValueAtTime(0, this._ctx.currentTime);
    this._gain.gain.linearRampToValueAtTime(this.volume, this._ctx.currentTime + duration);
    this._source = this._ctx.createBufferSource();
    this._source.buffer = buffer;
    this._source.loop = this._loop;
    this._source.connect(this._gain);
    this._source.start();
    this._currentTrack = name;
  }
  /** Stop the current track. */
  stop() {
    if (this._source) {
      try {
        this._source.stop();
      } catch {
      }
      this._source = null;
      this._currentTrack = null;
    }
  }
  /** @param {number} v - Volume 0-1. */
  setVolume(v) {
    this.volume = clamp(v, 0, 1);
    this._gain.gain.value = this.volume;
  }
};
var AudioManager = class {
  /**
   * @param {AudioContext} ctx - Web Audio API context
   */
  constructor(ctx) {
    this._ctx = ctx;
    this._buffers = /* @__PURE__ */ new Map();
    this._storageKey = null;
    this._masterGain = ctx.createGain();
    this._masterGain.connect(ctx.destination);
    const saved = loadStoredVolumes(this.storageKey);
    this.masterVolume = saved?.master ?? 1;
    this.muted = saved?.muted ?? false;
    this._masterGain.gain.value = this.muted ? 0 : this.masterVolume;
    this.effects = new EffectsPool(ctx, this._masterGain, this._buffers);
    this.effects.setVolume(saved?.effects ?? 1);
    this.music = new AudioChannel(ctx, this._masterGain, this._buffers, true);
    this.music.setVolume(saved?.music ?? 0.6);
    this.ambient = new AudioChannel(ctx, this._masterGain, this._buffers, true);
    this.ambient.setVolume(saved?.ambient ?? 0.4);
  }
  /** @param {string} key - Custom localStorage key for volume persistence. */
  set storageKey(key) {
    this._storageKey = key;
  }
  /** @returns {string} Current localStorage key for volume persistence. */
  get storageKey() {
    return this._storageKey || DEFAULT_STORAGE_KEY;
  }
  /**
   * Set master volume (affects all channels).
   *
   * @param {number} v - Volume 0-1
   */
  setMasterVolume(v) {
    this.masterVolume = clamp(v, 0, 1);
    this._masterGain.gain.value = this.masterVolume;
    this._saveVolumes();
  }
  /**
   * Load and decode an audio buffer.
   *
   * @param {string} name - Logical name (e.g., "splash")
   * @param {ArrayBuffer} arrayBuffer - Raw audio data
   */
  async loadBuffer(name, arrayBuffer) {
    const decoded = await this._ctx.decodeAudioData(arrayBuffer);
    this._buffers.set(name, decoded);
  }
  /**
   * Check if a buffer is loaded.
   *
   * @param {string} name
   * @returns {boolean}
   */
  hasBuffer(name) {
    return this._buffers.has(name);
  }
  /**
   * Toggle mute on/off. Preserves volume setting so unmuting
   * restores the previous level.
   *
   * @returns {boolean} New muted state
   */
  toggleMute() {
    this.muted = !this.muted;
    this._masterGain.gain.value = this.muted ? 0 : this.masterVolume;
    this._saveVolumes();
    return this.muted;
  }
  /** Suspend all audio (for pause). Resumes exactly where it left off. */
  suspend() {
    this._ctx.suspend();
  }
  /** Resume audio after suspend. */
  resume() {
    this._ctx.resume();
  }
  /** Stop all audio across all channels. */
  stopAll() {
    this.music.stop();
    this.ambient.stop();
  }
  /** @private Persist current volume settings. */
  _saveVolumes() {
    saveVolumes(this.storageKey, {
      master: this.masterVolume,
      muted: this.muted,
      effects: this.effects.volume,
      music: this.music.volume,
      ambient: this.ambient.volume
    });
  }
};

// src/engine/sprites.js
var SpriteSheet = class {
  /**
   * @param {HTMLImageElement} image - Loaded sprite sheet image
   * @param {Object} descriptor - JSON descriptor
   * @param {number} descriptor.frameWidth - Width of each frame in pixels
   * @param {number} descriptor.frameHeight - Height of each frame in pixels
   * @param {Object<string, {frames: number[], speed: number}>} descriptor.animations
   */
  constructor(image, descriptor) {
    this.image = image;
    this.frameWidth = descriptor.frameWidth;
    this.frameHeight = descriptor.frameHeight;
    this.animations = descriptor.animations || {};
    this._cols = Math.floor(image.width / this.frameWidth);
    this._animState = {};
    for (const name of Object.keys(this.animations)) {
      this._animState[name] = { elapsed: 0 };
    }
  }
  /**
   * Advance the animation clock for a named animation.
   *
   * @param {number} dt - Delta-time factor
   * @param {string} animName - Animation name
   */
  update(dt, animName) {
    const anim = this.animations[animName];
    if (!anim) return;
    const state = this._animState[animName];
    if (!state) return;
    state.elapsed += dt;
  }
  /**
   * Get the current frame index for a named animation.
   *
   * @param {string} animName - Animation name
   * @returns {number} Frame index from the animation's frames array
   */
  currentFrame(animName) {
    const anim = this.animations[animName];
    if (!anim) return 0;
    const state = this._animState[animName];
    if (!state) return anim.frames[0];
    const framesPerDt = anim.speed / 60;
    const frameIndex = Math.floor(state.elapsed * framesPerDt) % anim.frames.length;
    return anim.frames[frameIndex];
  }
  /**
   * Draw the current frame of a named animation.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x - Draw X position
   * @param {number} y - Draw Y position
   * @param {string} animName - Animation name
   * @param {number} [frameOverride] - Specific frame index (overrides animation)
   */
  draw(ctx, x, y, animName, frameOverride) {
    const frame = frameOverride !== void 0 ? frameOverride : this.currentFrame(animName);
    const { col, row } = this._frameToGrid(frame);
    ctx.drawImage(
      this.image,
      col * this.frameWidth,
      row * this.frameHeight,
      this.frameWidth,
      this.frameHeight,
      x,
      y,
      this.frameWidth,
      this.frameHeight
    );
  }
  /**
   * Draw a raw grid position (no animation lookup).
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} col - Grid column
   * @param {number} row - Grid row
   */
  drawFrame(ctx, x, y, col, row) {
    ctx.drawImage(
      this.image,
      col * this.frameWidth,
      row * this.frameHeight,
      this.frameWidth,
      this.frameHeight,
      x,
      y,
      this.frameWidth,
      this.frameHeight
    );
  }
  /**
   * Convert a frame index to grid (col, row) position.
   *
   * @param {number} frame - Frame index
   * @returns {{col: number, row: number}}
   */
  _frameToGrid(frame) {
    return {
      col: frame % this._cols,
      row: Math.floor(frame / this._cols)
    };
  }
};
var SpriteManager = class {
  constructor() {
    this._sheets = /* @__PURE__ */ new Map();
  }
  /**
   * Add a sprite sheet.
   *
   * @param {string} name
   * @param {SpriteSheet} sheet
   */
  add(name, sheet) {
    this._sheets.set(name, sheet);
  }
  /**
   * Get a sprite sheet by name.
   *
   * @param {string} name
   * @returns {SpriteSheet|null}
   */
  get(name) {
    return this._sheets.get(name) || null;
  }
};

// src/engine/assets.js
async function loadAssets(manifest = {}, { resolveAsset, audioContext } = {}) {
  const ctx = audioContext || new AudioContext();
  const audio = new AudioManager(ctx);
  const sprites = new SpriteManager();
  const audioLoads = [];
  for (const type of ["effects", "music", "ambient"]) {
    for (const name of manifest[type] || []) {
      const url = resolveAsset(`${type}/${name}.mp3`);
      audioLoads.push(_loadAudioBuffer(audio, name, url));
    }
  }
  const spriteLoads = (manifest.sprites || []).map((name) => {
    const png = resolveAsset(`${name}.png`);
    const json = resolveAsset(`${name}.json`);
    return _loadSpriteSheet(sprites, name, png, json);
  });
  await Promise.all([...audioLoads, ...spriteLoads]);
  return { audio, sprites };
}
async function _loadAudioBuffer(audio, name, url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = await response.arrayBuffer();
    await audio.loadBuffer(name, buffer);
  } catch (err) {
    console.warn(`[AssetLoader] Failed to load audio "${name}":`, err.message);
  }
}
async function _loadSpriteSheet(sprites, name, pngUrl, jsonUrl) {
  try {
    const [image, descriptor] = await Promise.all([
      _loadImage(pngUrl),
      _loadJSON(jsonUrl)
    ]);
    sprites.add(name, new SpriteSheet(image, descriptor));
  } catch (err) {
    console.warn(`[AssetLoader] Failed to load sprite "${name}":`, err.message);
  }
}
function _loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}
async function _loadJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// src/engine/input.js
var InputManager = class {
  /**
   * @param {HTMLCanvasElement} canvas - Game canvas element for click events
   */
  constructor(canvas) {
    this._keys = /* @__PURE__ */ new Set();
    this._canvas = canvas;
    this._clickHandlers = [];
    this.onKey = null;
    this._onKeyDown = (e) => {
      this._keys.add(e.code);
      if (this.onKey) this.onKey(e);
    };
    this._onKeyUp = (e) => {
      this._keys.delete(e.code);
    };
    document.addEventListener("keydown", this._onKeyDown);
    document.addEventListener("keyup", this._onKeyUp);
  }
  /**
   * Check if a key is currently held down.
   *
   * @param {string} code - KeyboardEvent.code value (e.g., "ArrowLeft", "Space")
   * @returns {boolean}
   */
  isDown(code) {
    return this._keys.has(code);
  }
  /**
   * Register a click handler on the game canvas.
   *
   * @param {function(): void} handler
   */
  onClick(handler) {
    this._canvas.addEventListener("click", handler);
    this._clickHandlers.push(handler);
  }
  /**
   * Remove all listeners and clear state.
   * Must be called on game teardown to prevent memory leaks.
   */
  destroy() {
    this._keys.clear();
    document.removeEventListener("keydown", this._onKeyDown);
    document.removeEventListener("keyup", this._onKeyUp);
    for (const handler of this._clickHandlers) {
      this._canvas.removeEventListener("click", handler);
    }
    this._clickHandlers = [];
    this.onKey = null;
  }
};

// src/engine/particles.js
var ParticleSystem = class {
  constructor() {
    this.particles = [];
  }
  /**
   * Emit a burst of particles.
   *
   * @param {Object} config
   * @param {number} config.x - Emission X position
   * @param {number} config.y - Emission Y position
   * @param {number} config.count - Number of particles
   * @param {number[]} config.speed - [min, max] speed range
   * @param {number[]} config.lifetime - [min, max] lifetime in frames
   * @param {string[]} config.colors - Color palette (random per particle)
   * @param {number} [config.spread=Math.PI*2] - Emission arc in radians
   * @param {number} [config.angle=0] - Center angle of emission arc
   * @param {number} [config.gravity=0] - Downward acceleration per frame
   * @param {number} [config.size=3] - Particle size in pixels
   */
  emit({ x, y, count, speed, lifetime, colors, spread = Math.PI * 2, angle = 0, gravity = 0, size = 3 }) {
    for (let i = 0; i < count; i++) {
      const dir = angle + (Math.random() - 0.5) * spread;
      const spd = speed[0] + Math.random() * (speed[1] - speed[0]);
      const life = lifetime[0] + Math.random() * (lifetime[1] - lifetime[0]);
      this.particles.push({
        x,
        y,
        vx: Math.cos(dir) * spd,
        vy: Math.sin(dir) * spd,
        life,
        maxLife: life,
        color: colors[Math.floor(Math.random() * colors.length)],
        gravity,
        size
      });
    }
  }
  /**
   * Update all particles. Removes dead particles.
   *
   * @param {number} dt - Delta-time factor
   */
  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
      }
    }
  }
  /**
   * Draw all particles to a canvas context.
   *
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }
  /** Remove all particles. */
  clear() {
    this.particles.length = 0;
  }
};

// src/host/game_host.js
var GameHost = class {
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
    this._container = container;
    this._options = options;
    this._destroyed = false;
    this._overlay = null;
    this._engine = null;
    this._renderer = null;
    this._input = null;
    this._audio = null;
    this._sprites = null;
    this._particles = null;
    this._pauseOverlay = null;
    this._helpOverlay = null;
    this._pausedForHelp = false;
    this._uiScale = 1;
  }
  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  /**
   * Load assets, build the overlay, create engine + renderer, wire input,
   * and start the game loop.
   */
  async start() {
    if (this._overlay) return;
    const config = this._options.config || {};
    const manifest = config.getAssetManifest?.() || {};
    const { audio, sprites } = await loadAssets(manifest, {
      resolveAsset: this._options.resolveAsset
    });
    this._audio = this._options.audio ?? audio;
    this._sprites = sprites;
    if (this._options.storageKey && !this._options.audio) {
      this._audio.storageKey = this._options.storageKey;
    }
    const canvasWidth = this._options.canvas?.width || config.CANVAS_WIDTH;
    const canvasHeight = this._options.canvas?.height || config.CANVAS_HEIGHT;
    this._overlay = this._buildOverlay(canvasWidth, canvasHeight);
    this._container.appendChild(this._overlay);
    const canvas = this._overlay.querySelector("canvas");
    const gameContainer = this._overlay.querySelector("[data-game-container]");
    gameContainer.offsetHeight;
    gameContainer.style.transform = "translateY(0)";
    gameContainer.style.opacity = "1";
    this._particles = new ParticleSystem();
    const RendererClass = this._options.renderer;
    this._renderer = new RendererClass(canvas);
    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = canvas.width;
    const logicalHeight = canvas.height;
    const displayWidth = parseInt(canvas.style.width);
    const displayHeight = parseInt(canvas.style.height);
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(displayWidth * dpr / logicalWidth, displayHeight * dpr / logicalHeight);
    this._renderer.ctx = ctx;
    this._uiScale = displayHeight / logicalHeight;
    const EngineClass = this._options.engine;
    this._engine = new EngineClass({
      onRender: (state) => this._renderer.draw(state),
      onGameOver: (score) => this._handleGameOver(score),
      audio: this._audio,
      sprites: this._sprites,
      particles: this._particles
    });
    if (this._options.initialState) {
      this._engine.loadState(this._options.initialState);
    }
    this._input = new InputManager(canvas);
    this._engine.input = this._input;
    this._input.onKey = (e) => {
      this._audio?.resume();
      this._routeKey(e);
    };
    if (this._options.handleClick) {
      this._input.onClick(() => {
        this._audio?.resume();
        this._options.handleClick(this._engine);
      });
    } else {
      this._input.onClick(() => this._audio?.resume());
    }
    this._engine.start();
    this._options.onReady?.();
  }
  /**
   * Tear down the game. Calls onExit(engine) BEFORE teardown so the
   * consumer can read engine state, then stops everything and removes DOM.
   *
   * Idempotent — safe to call multiple times (no-ops after first).
   */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this._options.onExit?.(this._engine);
    this._removePauseOverlay();
    this._removeHelpOverlay();
    if (this._audio) {
      this._audio.stopAll();
    }
    if (this._engine) {
      this._engine.stop();
      this._engine = null;
    }
    if (this._input) {
      this._input.destroy();
      this._input = null;
    }
    if (this._overlay) {
      this._overlay.remove();
      this._overlay = null;
    }
    this._renderer = null;
    this._particles = null;
    this._audio = null;
    this._sprites = null;
  }
  /**
   * Get the current engine save state, if the engine supports it.
   *
   * @returns {Object|null} Save state, or null if unavailable
   */
  getEngineState() {
    return this._engine?.getSaveState?.() ?? null;
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
    const key = e.key;
    const phase = this._engine?.phase;
    if (this._helpOverlay) {
      if (key === "?" || key === "Escape" || key === " ") {
        e.preventDefault();
        this.toggleHelp();
      }
      return;
    }
    if (this._engine?.paused) {
      e.preventDefault();
      if (key === "Escape" || key === "p" || key === "P" || key === " ") {
        this.togglePause();
      } else if (key === "q" || key === "Q") {
        this._removePauseOverlay();
        this.destroy();
      } else if (key === "?") {
        this.toggleHelp();
      } else if (key === "m" || key === "M") {
        if (this._audio) this._audio.toggleMute();
      }
      return;
    }
    if (key === "?") {
      e.preventDefault();
      this.toggleHelp();
      return;
    }
    if (key === "m" || key === "M") {
      e.preventDefault();
      if (this._audio) {
        this._audio.toggleMute();
      }
      return;
    }
    if (key === "q" || key === "Q") {
      if (this._engine.constructor.quitPhases.includes(phase)) {
        e.preventDefault();
        this.destroy();
      }
      return;
    }
    if (key === "Escape") {
      e.preventDefault();
      if (!this._engine.constructor.quitPhases.includes(phase)) {
        this.togglePause();
      }
      return;
    }
    if (key === "p" || key === "P") {
      if (!this._engine.constructor.quitPhases.includes(phase)) {
        e.preventDefault();
        this.togglePause();
      }
      return;
    }
    this._options.handleKey?.(e, this._engine);
  }
  // ---------------------------------------------------------------------------
  // Pause
  // ---------------------------------------------------------------------------
  /**
   * Toggle the pause state. When pausing, shows the pause overlay
   * with game instructions. When resuming, removes it.
   */
  togglePause() {
    if (!this._engine) return;
    if (this._engine.paused) {
      this._removePauseOverlay();
      this._engine.resume();
    } else {
      this._engine.pause();
      this._showPauseOverlay();
    }
  }
  /**
   * Build and show the pause overlay DOM element over the game container.
   *
   * @private
   */
  _showPauseOverlay() {
    if (this._pauseOverlay) return;
    const instructions = this._options.config?.gameInstructions || {
      title: "Paused",
      description: "",
      controls: []
    };
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
      hint: "ESC / SPACE to resume \xB7 Q to quit \xB7 ? for help",
      hintSize: 11,
      onClick: (e) => {
        e.stopPropagation();
        this.togglePause();
      }
    });
  }
  /**
   * Remove the pause overlay DOM element.
   *
   * @private
   */
  _removePauseOverlay() {
    if (this._pauseOverlay) {
      this._pauseOverlay.remove();
      this._pauseOverlay = null;
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
      this._removeHelpOverlay();
      if (this._pausedForHelp) {
        this._pausedForHelp = false;
        if (this._engine.paused) this._engine.resume();
      }
      return;
    }
    const wasPlaying = this._engine && !this._engine.paused && this._engine.phase !== "START" && this._engine.phase !== "DEAD";
    if (wasPlaying) {
      this._engine.pause();
      this._pausedForHelp = true;
    }
    this._showHelpOverlay();
  }
  /**
   * Build and show the help overlay with full game mechanics.
   *
   * @private
   */
  _showHelpOverlay() {
    if (this._helpOverlay) return;
    const instructions = this._options.config?.gameInstructions || { title: "Help", controls: [], tips: [] };
    const allControls = [
      ...instructions.controls || [],
      ["P / Esc", "Pause"],
      ["M", "Mute / unmute"],
      ["?", "Help"]
    ];
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
        e.stopPropagation();
        this.toggleHelp();
      }
    });
  }
  /**
   * Remove the help overlay DOM element.
   *
   * @private
   */
  _removeHelpOverlay() {
    if (this._helpOverlay) {
      this._helpOverlay.remove();
      this._helpOverlay = null;
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
    const s = this._uiScale || 1;
    const px = (base) => `${Math.round(base * s)}px`;
    const overlay = document.createElement("div");
    overlay.setAttribute(config.dataAttr, "");
    overlay.style.cssText = `
      position: absolute; inset: 0; z-index: ${config.zIndex};
      display: flex; align-items: center; justify-content: center;
      background: ${config.background};
      border-radius: 6px;
    `;
    const content = document.createElement("div");
    content.style.cssText = `
      text-align: center; color: #F0EDE6;
      font-family: monospace; padding: ${px(config.padding)};
      max-width: ${config.maxWidth};
    `;
    const titleEl = document.createElement(config.subtitle ? "h2" : "div");
    titleEl.textContent = config.title;
    titleEl.style.cssText = `
      font-size: ${px(config.titleSize)}; font-weight: bold;
      margin: 0 0 ${px(config.subtitle ? 8 : 2)} 0;
      color: #E8C65A;${config.subtitle ? " letter-spacing: 1px;" : ""}
    `;
    content.appendChild(titleEl);
    if (config.subtitle) {
      const sub = document.createElement("div");
      sub.textContent = config.subtitle;
      const subStyle = config.subtitleStyle || {};
      sub.style.cssText = `
        font-size: ${px(11)}; margin: 0 0 ${px(16)} 0;
        letter-spacing: ${subStyle.letterSpacing || "1px"};
        color: ${subStyle.color || "#888"};
        text-transform: ${subStyle.textTransform || "none"};
      `;
      content.appendChild(sub);
    }
    if (config.description) {
      const desc = document.createElement("div");
      desc.textContent = config.description;
      desc.style.cssText = `
        font-size: ${px(10)}; line-height: 1.4; margin: 0 0 ${px(10)} 0;
        color: #888;
      `;
      content.appendChild(desc);
    }
    if (config.controls && config.controls.length > 0) {
      const table = document.createElement("table");
      const bottomMargin = config.tips ? 10 : 20;
      table.style.cssText = `
        margin: 0 auto ${px(bottomMargin)} auto; border-collapse: collapse;
        font-size: ${px(config.controlsFontSize)};
      `;
      for (const [key, action] of config.controls) {
        const row = document.createElement("tr");
        const keyCell = document.createElement("td");
        keyCell.textContent = key;
        keyCell.style.cssText = `
          text-align: right; padding: ${px(config.controlsPadding)} ${px(config.controlsKeyPadding)} ${px(config.controlsPadding)} 0;
          color: #E8C65A; font-weight: bold; white-space: nowrap;
        `;
        const actionCell = document.createElement("td");
        actionCell.textContent = action;
        actionCell.style.cssText = `
          text-align: left; padding: ${px(config.controlsPadding)} 0;
          color: #CCC;
        `;
        row.appendChild(keyCell);
        row.appendChild(actionCell);
        table.appendChild(row);
      }
      content.appendChild(table);
    }
    if (config.tips && config.tips.length > 0) {
      const divider = document.createElement("div");
      divider.style.cssText = `
        border-top: 1px solid #333; margin: 0 auto ${px(8)} auto;
        max-width: ${px(200)};
      `;
      content.appendChild(divider);
      const tipsDiv = document.createElement("div");
      tipsDiv.style.cssText = `
        text-align: left; margin: 0 auto ${px(10)} auto;
        max-width: ${px(280)}; font-size: ${px(10)}; line-height: 1.5;
        color: #888;
      `;
      for (const tip of config.tips) {
        const p = document.createElement("div");
        p.textContent = `\xB7 ${tip}`;
        p.style.cssText = `margin: 0 0 ${px(1)} 0;`;
        tipsDiv.appendChild(p);
      }
      content.appendChild(tipsDiv);
    }
    const hintEl = document.createElement("div");
    hintEl.textContent = config.hint;
    hintEl.style.cssText = `
      font-size: ${px(config.hintSize)}; color: ${config.hintColor || "#666"}; letter-spacing: 1px;
    `;
    content.appendChild(hintEl);
    overlay.appendChild(content);
    overlay.addEventListener("click", config.onClick);
    const gameContainer = this._overlay.querySelector("[data-game-container]");
    gameContainer.style.position = "relative";
    gameContainer.appendChild(overlay);
    return overlay;
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
    const containerBackground = this._options.config?.containerBackground || "#0a1628";
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0, 0, 0, 0.7);
    `;
    const container = document.createElement("div");
    container.setAttribute("data-game-container", "");
    container.style.cssText = `
      background: ${containerBackground}; border-radius: 12px;
      padding: 12px; box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
      transform: translateY(40px); opacity: 0;
      transition: transform 300ms ease-out, opacity 300ms ease-out;
    `;
    const maxHeight = window.innerHeight * 0.75;
    const maxWidth = window.innerWidth * 0.85;
    const aspectRatio = width / height;
    let displayHeight = maxHeight;
    let displayWidth = displayHeight * aspectRatio;
    if (displayWidth > maxWidth) {
      displayWidth = maxWidth;
      displayHeight = displayWidth / aspectRatio;
    }
    displayWidth = Math.round(displayWidth);
    displayHeight = Math.round(displayHeight);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.style.cssText = `
      display: block; border-radius: 6px; cursor: pointer;
      width: ${displayWidth}px;
      height: ${displayHeight}px;
    `;
    container.appendChild(canvas);
    overlay.appendChild(container);
    return overlay;
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
    if (!this._options.onScore) return;
    try {
      const result = await this._options.onScore(score);
      if (result && this._renderer?.drawGameOverWithLeaderboard) {
        this._renderer.drawGameOverWithLeaderboard(
          score,
          result.leaderboard,
          result.newHighScore
        );
      }
    } catch {
    }
  }
};

// src/engine/base_engine.js
var BaseEngine = class {
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
    this._onRender = onRender;
    this._onGameOver = onGameOver || (() => {
    });
    this.audio = audio || null;
    this.sprites = sprites || null;
    this.input = input || null;
    this.particles = particles || null;
    this._frameId = null;
    this._lastTime = 0;
    this._boundLoop = (t) => this._loop(t);
    this.reset();
  }
  /**
   * Resets base state. Subclasses MUST call super.reset().
   * Preserves highScore across resets.
   */
  reset() {
    const prevHighScore = this.highScore || 0;
    this.phase = this.constructor.phases?.[0] || "START";
    this.score = 0;
    this.highScore = prevHighScore;
    this.frameCount = 0;
    this.elapsed = 0;
    this.paused = false;
    this._lastTime = 0;
  }
  /** Starts the game loop. */
  start() {
    this._lastTime = performance.now();
    this._frameId = requestAnimationFrame(this._boundLoop);
  }
  /** Stops the game loop. */
  stop() {
    if (this._frameId) {
      cancelAnimationFrame(this._frameId);
      this._frameId = null;
    }
  }
  /**
   * Pauses the game. Renders one final frame with paused state,
   * then stops the loop. Does not change the game phase — pause
   * is an engine-level concern, not a game concept.
   */
  pause() {
    if (this.paused) return;
    this.paused = true;
    this.stop();
    this.audio?.suspend();
    this._onRender(this.getState());
  }
  /**
   * Resumes from pause. Resets _lastTime to prevent a dt spike
   * from the time spent paused, then restarts the loop.
   */
  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.audio?.resume();
    this.start();
  }
  /**
   * Transitions to a new phase. Calls onPhaseChange if the phase actually changes.
   *
   * @param {string} newPhase - Phase name (must be in static phases array)
   */
  setPhase(newPhase) {
    const oldPhase = this.phase;
    if (oldPhase === newPhase) return;
    this.phase = newPhase;
    this.onPhaseChange(oldPhase, newPhase);
  }
  /**
   * Hook called on phase transitions. Override in subclasses for side effects.
   * @param {string} from - Previous phase
   * @param {string} to - New phase
   */
  onPhaseChange(from, to) {
  }
  /**
   * Check if the game can be restarted. Returns true when the game is over.
   *
   * @returns {boolean}
   */
  canRestart() {
    return this.phase === "DEAD";
  }
  /**
   * Restart the game. Resets state, sets phase to PLAYING, restarts loop.
   * Subclasses may override to add game-specific restart logic
   * (e.g., Overboard spawning first piece) — call super.restart() first.
   */
  restart() {
    this.stop();
    this.reset();
    this.setPhase("PLAYING");
    this.start();
  }
  /**
   * Adds points to score and updates high score.
   *
   * @param {number} points - Points to add
   */
  addScore(points) {
    this.score += points;
    if (this.score > this.highScore) {
      this.highScore = this.score;
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
      paused: this.paused
    };
  }
  /**
   * Game-specific update logic. Called once per frame.
   * Subclasses MUST implement this.
   *
   * @abstract
   * @param {number} dt - Delta-time in seconds (e.g., ~0.016 at 60fps)
   */
  update(dt) {
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
    const elapsed = now - this._lastTime;
    this._lastTime = now;
    const dt = Math.min(elapsed / 1e3, 0.05);
    this.frameCount += dt * 60;
    this.elapsed += elapsed / 1e3;
    this.update(dt);
    this._onRender(this.getState());
    if (this.constructor.terminalPhases.includes(this.phase)) {
      this._onGameOver(Math.floor(this.score));
      return;
    }
    this._frameId = requestAnimationFrame(this._boundLoop);
  }
};
/** @type {string[]} Phases that trigger onGameOver and stop the loop. */
__publicField(BaseEngine, "terminalPhases", ["DEAD"]);
/** @type {string[]} Phases where Q-to-quit is allowed (deliberate, never mid-gameplay). */
__publicField(BaseEngine, "quitPhases", ["START", "DEAD"]);

// src/games/bayman/config.js
var config_exports = {};
__export(config_exports, {
  BASE_SPEED: () => BASE_SPEED,
  CANVAS_HEIGHT: () => CANVAS_HEIGHT,
  CANVAS_WIDTH: () => CANVAS_WIDTH,
  COLORS: () => COLORS,
  GRAVITY: () => GRAVITY,
  GROUND_Y: () => GROUND_Y,
  INVINCIBLE_DURATION: () => INVINCIBLE_DURATION,
  JUMP_FORCE: () => JUMP_FORCE,
  MAX_SPAWN_CHANCE: () => MAX_SPAWN_CHANCE,
  MAX_SPEED: () => MAX_SPEED,
  MIN_OBSTACLE_GAP: () => MIN_OBSTACLE_GAP,
  OBSTACLE_HITBOX_INSET: () => OBSTACLE_HITBOX_INSET,
  PHASE: () => PHASE,
  PLAYER_HITBOX_HEIGHT: () => PLAYER_HITBOX_HEIGHT,
  PLAYER_HITBOX_LEFT: () => PLAYER_HITBOX_LEFT,
  PLAYER_HITBOX_RIGHT: () => PLAYER_HITBOX_RIGHT,
  POWERUP_BONUS: () => POWERUP_BONUS,
  POWERUP_COOLDOWN: () => POWERUP_COOLDOWN,
  POWERUP_MIN_SCORE: () => POWERUP_MIN_SCORE,
  POWERUP_Y: () => POWERUP_Y,
  SMASH_BONUS: () => SMASH_BONUS,
  SPEED_INCREASE: () => SPEED_INCREASE,
  UI_FONT: () => UI_FONT2
});

// src/engine/palette.js
var SHARED_COLORS = {
  text: "#F0EDE6",
  gold: "#E8C65A",
  goldDark: "#C9A83E",
  overlay: "rgba(0, 0, 0, 0.6)",
  startOverlay: "rgba(0, 0, 0, 0.5)"
};
var UI_FONT = "monospace";

// src/games/bayman/config.js
var CANVAS_WIDTH = 600;
var CANVAS_HEIGHT = 300;
var GROUND_Y = CANVAS_HEIGHT - 50;
var GRAVITY = 2880;
var JUMP_FORCE = -780;
var BASE_SPEED = 300;
var SPEED_INCREASE = 3.6;
var MAX_SPEED = 840;
var MIN_OBSTACLE_GAP = 180;
var MAX_SPAWN_CHANCE = 0.05;
var SMASH_BONUS = 5;
var POWERUP_BONUS = 10;
var PLAYER_HITBOX_LEFT = 5;
var PLAYER_HITBOX_RIGHT = 45;
var PLAYER_HITBOX_HEIGHT = 35;
var OBSTACLE_HITBOX_INSET = 5;
var INVINCIBLE_DURATION = 4;
var POWERUP_Y = GROUND_Y - 90;
var POWERUP_MIN_SCORE = 15;
var POWERUP_COOLDOWN = 5;
var PHASE = Object.freeze({
  START: "START",
  PLAYING: "PLAYING",
  DEAD: "DEAD"
});
var COLORS = {
  ...SHARED_COLORS,
  // Sky gradient
  skyTop: "#3A6B8A",
  skyBottom: "#7FAFC4",
  // Ground
  ground: "#5B7A3A",
  groundDark: "#4A6830",
  groundEdge: "#3D5228",
  groundLight: "#6B8A4A",
  // Boreal forest layers (back to front, darker = farther)
  forest1: "#1A3328",
  forest1h: "#1F3D30",
  forest2: "#1E3F2E",
  forest2h: "#264A36",
  forest3: "#244832",
  forest3h: "#2D5A3E",
  forest4: "#2A5238",
  forest4h: "#356642",
  // Honda Big Red trike
  trikeBody: "#CC3333",
  trikeBodyDark: "#A02828",
  trikeWheel: "#2A2A2A",
  trikeWheelStroke: "#444",
  trikeAxle: "#555",
  trikeFender: "#DD4444",
  trikeSeat: "#222",
  trikeHandlebars: "#333",
  trikeHeadlight: "#FFE066",
  trikeExhaust: "rgba(180, 180, 180, 0.3)",
  // Bayman rider
  baymanSkin: "#D4956B",
  baymanSkinDark: "#B87A52",
  baymanRuddy: "#C47858",
  flannelRed: "#B83025",
  flannelDark: "#1A1A1A",
  capBlue: "#2E4A6B",
  capBlueDark: "#1E3652",
  teeGrey: "#555",
  hairBrown: "#6B4F30",
  eyes: "#1A1A1A",
  jeanBlue: "#3B5A82",
  jeanBlueDark: "#2D4666",
  bootBlack: "#1A1A1A",
  bootSole: "#333",
  // Trunk
  trunkBrown: "#3D2E1A",
  // Power-ups
  viennaBlue: "#2E5FA1",
  viennaLight: "#4A7FBF",
  viennaLabel: "#E8D5A0",
  syrupBrown: "#8B4513",
  syrupLight: "#A0522D",
  syrupLabel: "#F5DEB3",
  syrupCap: "#CC3333",
  margarineYellow: "#FFD700",
  margarineLight: "#FFE44D",
  margText: "#2E5FA1",
  invincibleGlow: "rgba(232, 198, 90, 0.4)",
  // Obstacles
  stumpBrown: "#6B4F30",
  stumpLight: "#8B6B42",
  rockGray: "#7A7A7A",
  rockLight: "#999",
  mooseBrown: "#5C3D2E",
  mooseLight: "#7A5540"
};
var UI_FONT2 = UI_FONT;

// src/games/bayman/engine.js
var OBSTACLE_TYPES = [
  { name: "stump", width: 30, height: 30 },
  { name: "rock", width: 35, height: 25 },
  { name: "moose", width: 45, height: 50 }
];
var POWERUP_TYPES = [
  { name: "vienna", width: 20, height: 16 },
  { name: "syrup", width: 14, height: 24 },
  { name: "margarine", width: 22, height: 16 }
];
var BaymanEngine = class extends BaseEngine {
  /**
   * Handles phase transitions — starts/stops the engine ambient sound.
   *
   * @param {string} from - Previous phase
   * @param {string} to - New phase
   */
  onPhaseChange(from, to) {
    super.onPhaseChange(from, to);
    if (to === PHASE.PLAYING) {
      this.audio?.ambient.play("engine-ride");
    } else if (to === PHASE.DEAD) {
      this.audio?.ambient.stop();
    }
  }
  /** Resets all game-specific state. */
  reset() {
    super.reset();
    this.speed = BASE_SPEED;
    this.playerX = 80;
    this.playerY = GROUND_Y;
    this.playerVY = 0;
    this.isJumping = false;
    this.obstacles = [];
    this.powerups = [];
    this.scorePopups = [];
    this.shakeTimer = 0;
    this.invincibleTimer = 0;
    this.powerupFlash = null;
    this.powerupFlashTimer = 0;
    this.lastPowerupTime = -POWERUP_COOLDOWN;
    this.groundOffset = 0;
  }
  /**
   * Triggers a jump. No-op if already jumping or not playing.
   *
   * If in "START" phase, transitions to "PLAYING" first.
   */
  jump() {
    if (this.phase === PHASE.START) {
      this.setPhase(PHASE.PLAYING);
      return;
    }
    if (this.phase !== PHASE.PLAYING) return;
    if (!this.isJumping) {
      this.isJumping = true;
      this.playerVY = JUMP_FORCE;
      this.audio?.effects.play("jump");
    }
  }
  // ---------------------------------------------------------------------------
  // Game loop
  // ---------------------------------------------------------------------------
  /**
   * Updates game state for one frame. Called by BaseEngine each tick.
   *
   * @param {number} dt - Delta-time in seconds (~0.0167 at 60fps)
   */
  update(dt) {
    if (this.phase !== PHASE.PLAYING) return;
    this.speed = Math.min(BASE_SPEED + this.elapsed * SPEED_INCREASE, MAX_SPEED);
    this.groundOffset += this.speed * dt;
    this.addScore(this.speed * 0.05 * dt);
    if (this.isJumping) {
      this.playerVY += GRAVITY * dt;
      this.playerY += this.playerVY * dt;
      if (this.playerY >= GROUND_Y) {
        this.playerY = GROUND_Y;
        this.playerVY = 0;
        this.isJumping = false;
        this.audio?.effects.play("land");
      }
    }
    for (const obs of this.obstacles) {
      obs.x -= this.speed * dt;
    }
    this.obstacles = this.obstacles.filter((obs) => obs.x + obs.width > -10);
    for (const pu of this.powerups) {
      pu.x -= this.speed * dt;
    }
    this.powerups = this.powerups.filter((pu) => pu.x + pu.width > -10);
    if (this.invincibleTimer > 0) {
      this.invincibleTimer -= dt;
      if (this.invincibleTimer <= 0) {
        this.audio?.ambient.crossfadeTo("engine-ride", 0.5);
      }
    }
    if (this.powerupFlashTimer > 0) {
      this.powerupFlashTimer -= dt;
      if (this.powerupFlashTimer <= 0) {
        this.powerupFlash = null;
      }
    }
    this._maybeSpawn();
    this._maybeSpawnPowerup();
    this._checkCollisions();
    this._checkPowerupCollisions();
    if (this.particles) {
      this.particles.update(dt);
    }
    for (let i = this.scorePopups.length - 1; i >= 0; i--) {
      const pop = this.scorePopups[i];
      pop.y -= 72 * dt;
      pop.life -= dt;
      if (pop.life <= 0) this.scorePopups.splice(i, 1);
    }
    if (this.shakeTimer > 0) this.shakeTimer -= dt;
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
      groundOffset: this.groundOffset
    };
  }
  // ---------------------------------------------------------------------------
  // Spawning
  // ---------------------------------------------------------------------------
  /** @private Spawns a new obstacle if gap conditions are met. */
  _maybeSpawn() {
    const last = this.obstacles[this.obstacles.length - 1];
    if (last && last.x + last.width >= CANVAS_WIDTH - MIN_OBSTACLE_GAP) return;
    const spawnChance = Math.min(0.02 + this.speed * 3e-3, MAX_SPAWN_CHANCE);
    if (Math.random() < spawnChance) {
      let typeIdx;
      if (this.score < 10) {
        typeIdx = Math.random() < 0.7 ? 0 : 1;
      } else {
        typeIdx = Math.floor(Math.random() * OBSTACLE_TYPES.length);
      }
      const type = OBSTACLE_TYPES[typeIdx];
      this.obstacles.push({
        type: type.name,
        x: CANVAS_WIDTH + 20,
        width: type.width,
        height: type.height
      });
    }
  }
  /** @private Spawns a power-up if conditions are met. */
  _maybeSpawnPowerup() {
    if (this.score < POWERUP_MIN_SCORE) return;
    if (this.elapsed - this.lastPowerupTime < POWERUP_COOLDOWN) return;
    if (this.powerups.length > 0) return;
    if (Math.random() < 8e-3) {
      const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
      this.powerups.push({
        type: type.name,
        x: CANVAS_WIDTH + 20,
        y: POWERUP_Y,
        width: type.width,
        height: type.height
      });
      this.lastPowerupTime = this.elapsed;
    }
  }
  // ---------------------------------------------------------------------------
  // Collision detection
  // ---------------------------------------------------------------------------
  /** @private Checks if player collects a power-up. */
  _checkPowerupCollisions() {
    const playerLeft = this.playerX + PLAYER_HITBOX_LEFT;
    const playerRight = this.playerX + PLAYER_HITBOX_RIGHT;
    const playerTop = this.playerY - PLAYER_HITBOX_HEIGHT;
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pu = this.powerups[i];
      if (playerRight > pu.x && playerLeft < pu.x + pu.width && playerTop < pu.y + pu.height && this.playerY > pu.y) {
        this.powerupFlash = pu.type;
        this.powerupFlashTimer = 1.5;
        this.powerups.splice(i, 1);
        this.invincibleTimer = INVINCIBLE_DURATION;
        this.addScore(POWERUP_BONUS);
        this.audio?.effects.play("powerup");
        this.audio?.ambient.crossfadeTo("engine-rev", 0.3);
      }
    }
  }
  /** @private Checks player-obstacle collisions. */
  _checkCollisions() {
    const playerLeft = this.playerX + PLAYER_HITBOX_LEFT;
    const playerRight = this.playerX + PLAYER_HITBOX_RIGHT;
    const playerBottom = this.playerY;
    const playerTop = this.playerY - PLAYER_HITBOX_HEIGHT;
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      const obsTop = GROUND_Y - obs.height;
      if (playerRight > obs.x + OBSTACLE_HITBOX_INSET && playerLeft < obs.x + obs.width - OBSTACLE_HITBOX_INSET && playerBottom > obsTop + OBSTACLE_HITBOX_INSET) {
        if (this.invincibleTimer > 0) {
          const smashX = obs.x + obs.width / 2;
          const smashY = GROUND_Y - obs.height / 2;
          this._emitSmashParticles(smashX, smashY, obs.type);
          this.scorePopups.push({ x: smashX, y: smashY - 10, text: `+${SMASH_BONUS}`, life: 0.667 });
          this.shakeTimer = 0.1;
          this.obstacles.splice(i, 1);
          this.addScore(SMASH_BONUS);
          this.audio?.effects.play("smash", { pitchVariance: 0.15 });
          continue;
        }
        this.audio?.effects.play("collision");
        this.setPhase(PHASE.DEAD);
        return;
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
    if (!this.particles) return;
    const color = obstacleType === "moose" ? COLORS.mooseBrown : obstacleType === "rock" ? COLORS.rockGray : COLORS.stumpBrown;
    this.particles.emit({
      x,
      y,
      count: 12,
      speed: [120, 360],
      lifetime: [0.5, 0.833],
      colors: [color],
      spread: Math.PI * 2,
      gravity: 540,
      size: 4
    });
  }
};
/** @type {string[]} Game phases for the phase machine. */
__publicField(BaymanEngine, "phases", ["START", "PLAYING", "DEAD"]);

// src/engine/draw_utils.js
function drawCloud(ctx, x, y, w, h) {
  ctx.beginPath();
  ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x - w * 0.4, y + (h > 12 ? 4 : 3), w * 0.6, h * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + w * 0.4, y + (h > 12 ? 3 : 2), w * 0.5, h * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
}
function drawWaves(ctx, waterlineY, amplitude, canvasWidth, frameCount, colors, options = {}) {
  const t = frameCount;
  const foamSpacing = options.foamSpacing ?? 80;
  const foamWidth = options.foamWidth ?? 15;
  const foamHeight = options.foamHeight ?? 2;
  const bottomExtend = options.bottomExtend ?? 10;
  ctx.fillStyle = colors.wave;
  ctx.beginPath();
  ctx.moveTo(0, waterlineY);
  for (let x = 0; x <= canvasWidth; x += 4) {
    const y = waterlineY + Math.sin(x * 0.03 + t * 0.04) * amplitude + Math.sin(x * 0.015 + t * 0.025) * amplitude * 0.5;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(canvasWidth, waterlineY + bottomExtend);
  ctx.lineTo(0, waterlineY + bottomExtend);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = colors.foam;
  for (let x = 0; x < canvasWidth; x += foamSpacing) {
    const wx = x + Math.sin(t * 0.02 + x) * (foamSpacing * 0.1);
    const wy = waterlineY + Math.sin(wx * 0.03 + t * 0.04) * amplitude + foamHeight / 2;
    ctx.fillRect(wx, wy, foamWidth + Math.sin(t * 0.05 + x) * (foamWidth / 3), foamHeight);
  }
}
function drawDory(ctx, x, y, scale, colors) {
  const s = scale;
  ctx.fillStyle = colors.doryHull;
  ctx.beginPath();
  ctx.moveTo(x - 40 * s, y);
  ctx.quadraticCurveTo(x - 45 * s, y + 18 * s, x - 30 * s, y + 22 * s);
  ctx.lineTo(x + 30 * s, y + 22 * s);
  ctx.quadraticCurveTo(x + 45 * s, y + 18 * s, x + 40 * s, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = colors.doryLight;
  ctx.beginPath();
  ctx.moveTo(x - 38 * s, y + 2 * s);
  ctx.quadraticCurveTo(x - 42 * s, y + 14 * s, x - 28 * s, y + 16 * s);
  ctx.lineTo(x + 28 * s, y + 16 * s);
  ctx.quadraticCurveTo(x + 42 * s, y + 14 * s, x + 38 * s, y + 2 * s);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = colors.doryGunwale;
  ctx.lineWidth = 2.5 * s;
  ctx.beginPath();
  ctx.moveTo(x - 40 * s, y);
  ctx.quadraticCurveTo(x, y - 3 * s, x + 40 * s, y);
  ctx.stroke();
  ctx.fillStyle = colors.doryInside;
  ctx.beginPath();
  ctx.moveTo(x - 32 * s, y + 2 * s);
  ctx.quadraticCurveTo(x, y, x + 32 * s, y + 2 * s);
  ctx.lineTo(x + 26 * s, y + 12 * s);
  ctx.lineTo(x - 26 * s, y + 12 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = colors.doryRim;
  ctx.fillRect(x - 18 * s, y + 3 * s, 36 * s, 4 * s);
}
function drawFisher(ctx, x, y, scale, colors) {
  const s = scale;
  ctx.fillStyle = colors.oilskin;
  ctx.fillRect(x - 8 * s, y - 22 * s, 16 * s, 18 * s);
  ctx.fillStyle = colors.oilskinDark;
  ctx.fillRect(x - 8 * s, y - 22 * s, 5 * s, 18 * s);
  ctx.fillStyle = colors.oilskin;
  ctx.fillRect(x + 8 * s, y - 18 * s, 12 * s, 5 * s);
  ctx.fillRect(x - 16 * s, y - 16 * s, 8 * s, 5 * s);
  ctx.fillStyle = colors.face;
  ctx.beginPath();
  ctx.arc(x, y - 28 * s, 7 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.souwester;
  ctx.beginPath();
  ctx.ellipse(x, y - 34 * s, 10 * s, 4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - 6 * s, y - 38 * s, 12 * s, 6 * s);
  ctx.fillStyle = colors.souwesterBrim;
  ctx.beginPath();
  ctx.moveTo(x - 12 * s, y - 32 * s);
  ctx.lineTo(x + 10 * s, y - 32 * s);
  ctx.lineTo(x + 8 * s, y - 30 * s);
  ctx.lineTo(x - 16 * s, y - 28 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = colors.faceShadow;
  ctx.beginPath();
  ctx.arc(x, y - 28 * s, 7 * s, 0.2, Math.PI - 0.2);
  ctx.fill();
  ctx.fillStyle = "#222";
  ctx.fillRect(x - 3 * s, y - 29 * s, 2 * s, 2 * s);
  ctx.fillRect(x + 2 * s, y - 29 * s, 2 * s, 2 * s);
  ctx.fillStyle = colors.oilskinShade;
  ctx.fillRect(x - 6 * s, y - 4 * s, 5 * s, 6 * s);
  ctx.fillRect(x + 2 * s, y - 4 * s, 5 * s, 6 * s);
}
function drawStartScreen(ctx, config) {
  const {
    title,
    lines,
    startPrompt,
    canvasWidth,
    canvasHeight,
    colors,
    font,
    layout = {}
  } = config;
  const cx = layout.cx ?? canvasWidth / 2;
  const titleY = layout.titleY ?? 100;
  const titleSize = layout.titleSize ?? 36;
  const descY = layout.descY ?? titleY + 40;
  const descSize = layout.descSize ?? 18;
  const descGap = layout.descGap ?? 26;
  const promptY = layout.promptY ?? canvasHeight - 60;
  const promptSize = layout.promptSize ?? 20;
  const hintY = layout.hintY ?? promptY + 25;
  ctx.fillStyle = colors.startOverlay;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.textAlign = "center";
  ctx.fillStyle = colors.gold;
  ctx.font = `bold ${titleSize}px ${font}`;
  ctx.fillText(title, cx, titleY);
  ctx.fillStyle = colors.text;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    ctx.font = `${line.size ?? descSize}px ${font}`;
    ctx.fillText(line.text, cx, descY + i * descGap);
  }
  const pulse = Math.sin(Date.now() / 400) * 0.3 + 0.7;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = colors.gold;
  ctx.font = `bold ${promptSize}px ${font}`;
  ctx.fillText(startPrompt, cx, promptY);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#666";
  ctx.font = `11px ${font}`;
  ctx.fillText("? for help \xB7 Q to quit", cx, hintY);
}
function drawBasicGameOver(ctx, config) {
  const { score, canvasWidth, canvasHeight, colors, font, layout = {} } = config;
  const cx = layout.cx ?? canvasWidth / 2;
  const headingY = layout.headingY ?? 100;
  const headingSize = layout.headingSize ?? 32;
  const scoreY = layout.scoreY ?? headingY + 60;
  const scoreSize = layout.scoreSize ?? 48;
  const hintSize = layout.hintSize ?? 14;
  ctx.fillStyle = colors.overlay;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.textAlign = "center";
  ctx.fillStyle = colors.text;
  ctx.font = `bold ${headingSize}px ${font}`;
  ctx.fillText("GAME OVER", cx, headingY);
  ctx.fillStyle = colors.gold;
  ctx.font = `bold ${scoreSize}px ${font}`;
  ctx.fillText(`${score}`, cx, scoreY);
  if (config.highScore && config.highScore > score) {
    ctx.fillStyle = colors.text;
    ctx.font = `${hintSize}px ${font}`;
    ctx.fillText(`Best: ${config.highScore}`, cx, scoreY + 30);
  }
  ctx.fillStyle = colors.text;
  ctx.font = `${hintSize}px ${font}`;
  ctx.fillText("R to play again \xB7 Q to quit", cx, canvasHeight - 20);
}
function drawLeaderboardOverlay(ctx, config) {
  const {
    score,
    leaderboard,
    isNewHighScore,
    canvasWidth,
    canvasHeight,
    colors,
    font,
    layout = {}
  } = config;
  const cx = layout.cx ?? canvasWidth / 2;
  const headingY = layout.headingY ?? 55;
  const headingSize = layout.headingSize ?? 32;
  const highScoreY = layout.highScoreY ?? headingY + 22;
  const highScoreSize = layout.highScoreSize ?? 16;
  const scoreY = layout.scoreY ?? headingY + 60;
  const scoreSize = layout.scoreSize ?? 40;
  const tableHeaderY = layout.tableHeaderY ?? scoreY + 30;
  const tableHeaderSize = layout.tableHeaderSize ?? 14;
  const tableStartY = layout.tableStartY ?? tableHeaderY + 20;
  const tableRowHeight = layout.tableRowHeight ?? 20;
  const tableEntrySize = layout.tableEntrySize ?? 14;
  const nameX = layout.nameX ?? 170;
  const scoreX = layout.scoreX ?? canvasWidth - 170;
  const hintSize = layout.hintSize ?? 14;
  ctx.fillStyle = colors.overlay;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.textAlign = "center";
  ctx.fillStyle = colors.text;
  ctx.font = `bold ${headingSize}px ${font}`;
  ctx.fillText("GAME OVER", cx, headingY);
  if (isNewHighScore) {
    ctx.fillStyle = colors.gold;
    ctx.font = `bold ${highScoreSize}px ${font}`;
    ctx.fillText("NEW HIGH SCORE!", cx, highScoreY);
  }
  ctx.fillStyle = colors.text;
  ctx.font = `bold ${scoreSize}px ${font}`;
  ctx.fillText(`${score}`, cx, scoreY);
  if (leaderboard && leaderboard.length > 0) {
    const hintLineY = canvasHeight - 20;
    const availableSpace = hintLineY - tableStartY - 10;
    const maxRows = Math.max(1, Math.floor(availableSpace / tableRowHeight));
    const visibleEntries = leaderboard.slice(0, Math.min(5, maxRows));
    ctx.fillStyle = colors.text;
    ctx.font = `bold ${tableHeaderSize}px ${font}`;
    ctx.fillText("TOP SCORES", cx, tableHeaderY);
    ctx.font = `${tableEntrySize}px ${font}`;
    visibleEntries.forEach((entry, i) => {
      const y = tableStartY + i * tableRowHeight;
      const name = entry.user_name || "???";
      ctx.textAlign = "left";
      ctx.fillStyle = colors.text;
      ctx.fillText(`${i + 1}. ${name}`, nameX, y);
      ctx.textAlign = "right";
      ctx.fillText(`${entry.score}`, scoreX, y);
    });
  }
  ctx.fillStyle = colors.text;
  ctx.font = `${hintSize}px ${font}`;
  ctx.textAlign = "center";
  ctx.fillText("R to play again \xB7 Q to quit", cx, canvasHeight - 20);
}
function drawParticles(ctx, particles) {
  if (!particles || particles.length === 0) return;
  for (const p of particles) {
    const half = (p.size || 4) / 2;
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - half, p.y - half, p.size || 4, p.size || 4);
  }
  ctx.globalAlpha = 1;
}
function drawSpruce(ctx, x, baseY, h, w, color, highlight, trunkColor) {
  const tipY = baseY - h;
  const trunkW = Math.max(3, w * 0.15);
  ctx.fillStyle = trunkColor;
  ctx.fillRect(x + w / 2 - trunkW / 2, baseY - 8, trunkW, 8);
  const layers = 3;
  const layerH = h / layers;
  for (let i = 0; i < layers; i++) {
    const ly = tipY + i * layerH * 0.75;
    const lw = w * 0.3 + w * 0.7 * ((i + 1) / layers);
    const lh = layerH * 1.1;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, ly);
    ctx.lineTo(x + w / 2 + lw / 2, ly + lh);
    ctx.lineTo(x + w / 2 - lw / 2, ly + lh);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = highlight;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, ly);
    ctx.lineTo(x + w / 2 + lw / 2, ly + lh);
    ctx.lineTo(x + w / 2 + lw * 0.15, ly + lh);
    ctx.closePath();
    ctx.fill();
  }
}

// src/games/bayman/renderer.js
var BaymanRenderer = class {
  /**
   * Creates a new renderer bound to the given canvas.
   *
   * @param {HTMLCanvasElement} canvas - The canvas element to draw on
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;
    this.ctx = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
    this._lastState = null;
    this._skyGradient = this.ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    this._skyGradient.addColorStop(0, COLORS.skyTop);
    this._skyGradient.addColorStop(1, COLORS.skyBottom);
    this.forestLayers = [];
    this._initForest();
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
      { speed: 0.4, color: COLORS.forest4, highlight: COLORS.forest4h, minH: 40, maxH: 80, density: 14 }
    ];
    for (const layer of layers) {
      const trees = [];
      const spacing = CANVAS_WIDTH / layer.density;
      for (let i = 0; i < layer.density + 6; i++) {
        trees.push({
          x: i * spacing + (Math.random() - 0.5) * spacing * 0.6,
          h: layer.minH + Math.random() * (layer.maxH - layer.minH),
          w: 12 + Math.random() * 10
        });
      }
      this.forestLayers.push({
        trees,
        speed: layer.speed,
        color: layer.color,
        highlight: layer.highlight,
        totalWidth: (layer.density + 6) * spacing
      });
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
    this._lastState = state;
    this._drawScene(state);
    if (state.phase === PHASE.START) {
      this._drawStartScreen();
    } else if (state.phase === PHASE.DEAD) {
      this._drawGameOver(state);
    }
  }
  /**
   * Draws the game scene without overlays.
   *
   * @private
   * @param {import("./engine").GameState} state
   */
  _drawScene(state) {
    const ctx = this.ctx;
    const shaking = state.shakeTimer > 0;
    if (shaking) {
      const intensity = Math.min(state.shakeTimer, 3);
      const sx = (Math.random() - 0.5) * intensity * 2;
      const sy = (Math.random() - 0.5) * intensity * 2;
      ctx.save();
      ctx.translate(sx, sy);
    }
    this._drawBackground();
    this._drawForest(state.groundOffset);
    this._drawGround(state.groundOffset);
    this._drawObstacles(state.obstacles);
    this._drawPowerups(state.powerups, state.frameCount);
    this._drawParticles(state.particles);
    this._drawScorePopups(state.scorePopups);
    this._drawTrike(state);
    if (state.invincibleTimer > 0) {
      this._drawInvincibleEffect(state);
    }
    if (shaking) ctx.restore();
    this._drawUI(state);
    this._drawPowerupFlash(state);
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
    if (this._lastState) {
      this._drawScene(this._lastState);
    }
    drawLeaderboardOverlay(this.ctx, {
      score,
      leaderboard,
      isNewHighScore,
      canvasWidth: CANVAS_WIDTH,
      canvasHeight: CANVAS_HEIGHT,
      colors: COLORS,
      font: UI_FONT2
    });
  }
  // ---------------------------------------------------------------------------
  // Background
  // ---------------------------------------------------------------------------
  /** @private Draws the sky gradient (uses cached gradient object). */
  _drawBackground() {
    this.ctx.fillStyle = this._skyGradient;
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, GROUND_Y);
  }
  /**
   * Draws parallax forest layers.
   *
   * @private
   * @param {number} groundOffset - Current scroll distance
   */
  _drawForest(groundOffset) {
    for (const layer of this.forestLayers) {
      const offset = groundOffset * layer.speed;
      for (const tree of layer.trees) {
        const tx = ((tree.x - offset) % layer.totalWidth + layer.totalWidth) % layer.totalWidth - 50;
        if (tx + tree.w < 0 || tx > CANVAS_WIDTH) continue;
        this._drawSpruce(tx, GROUND_Y, tree.h, tree.w, layer.color, layer.highlight);
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
    drawSpruce(this.ctx, x, baseY, h, w, color, highlight, COLORS.trunkBrown);
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
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);
    ctx.fillStyle = COLORS.groundEdge;
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, 3);
    ctx.fillStyle = COLORS.groundDark;
    const offset = groundOffset % 40;
    for (let x = -offset; x < CANVAS_WIDTH + 40; x += 40) {
      ctx.fillRect(x, GROUND_Y + 10, 20, 2);
      ctx.fillRect(x + 15, GROUND_Y + 22, 15, 2);
    }
    ctx.fillStyle = COLORS.groundLight;
    const grassOffset = groundOffset % 60;
    for (let x = -grassOffset; x < CANVAS_WIDTH + 60; x += 60) {
      ctx.fillRect(x, GROUND_Y - 2, 3, 4);
      ctx.fillRect(x + 25, GROUND_Y - 1, 2, 3);
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
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.trikeWheel;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.trikeWheelStroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = COLORS.trikeAxle;
    ctx.beginPath();
    ctx.arc(cx, cy, axleR, 0, Math.PI * 2);
    ctx.fill();
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
    const ctx = this.ctx;
    const x = state.playerX;
    const y = state.playerY;
    const bounce = !state.isJumping && state.phase === PHASE.PLAYING ? Math.sin(state.frameCount * 0.3) * 1.5 : 0;
    const ty = y - PLAYER_HITBOX_HEIGHT + bounce;
    const invincible = state.invincibleTimer > 0;
    if (invincible) {
      const pivotX = x + 6;
      const pivotY = ty + 30;
      ctx.save();
      ctx.translate(pivotX, pivotY);
      ctx.rotate(-0.25);
      ctx.translate(-pivotX, -pivotY);
    }
    this._drawWheel(x + 6, ty + 30, 9, 3);
    this._drawWheel(x + 44, ty + 30, 8, 2.5);
    ctx.fillStyle = COLORS.trikeFender;
    ctx.beginPath();
    ctx.arc(x + 6, ty + 30, 13, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = COLORS.trikeBody;
    ctx.fillRect(x - 4, ty + 17, 20, 4);
    ctx.fillStyle = COLORS.trikeBody;
    ctx.fillRect(x + 8, ty + 15, 28, 7);
    ctx.fillStyle = COLORS.trikeBodyDark;
    ctx.fillRect(x + 22, ty + 18, 12, 10);
    ctx.fillStyle = COLORS.trikeSeat;
    ctx.fillRect(x + 8, ty + 12, 16, 5);
    ctx.fillStyle = COLORS.trikeAxle;
    ctx.fillRect(x + 38, ty + 10, 3, 20);
    ctx.fillStyle = COLORS.trikeFender;
    ctx.beginPath();
    ctx.arc(x + 44, ty + 30, 11, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = COLORS.trikeHandlebars;
    ctx.fillRect(x + 35, ty + 8, 12, 3);
    ctx.fillStyle = COLORS.trikeHeadlight;
    ctx.fillRect(x + 46, ty + 12, 3, 4);
    if (state.phase === PHASE.PLAYING && state.frameCount % 8 < 4) {
      ctx.fillStyle = COLORS.trikeExhaust;
      ctx.beginPath();
      ctx.arc(x - 8, ty + 25, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x - 15, ty + 23, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const rx = x + 8;
    const ry = ty - 14;
    ctx.fillStyle = COLORS.flannelRed;
    ctx.fillRect(rx + 16, ry + 7, 12, 4);
    ctx.fillStyle = COLORS.flannelDark;
    ctx.fillRect(rx + 16, ry + 9, 12, 1);
    ctx.fillRect(rx + 20, ry + 7, 2, 3);
    ctx.fillStyle = COLORS.baymanSkinDark;
    ctx.fillRect(rx + 26, ry + 6, 4, 5);
    ctx.fillStyle = COLORS.teeGrey;
    ctx.fillRect(rx + 3, ry + 4, 12, 16);
    ctx.fillStyle = COLORS.flannelRed;
    ctx.fillRect(rx + 1, ry + 3, 4, 17);
    ctx.fillRect(rx + 13, ry + 3, 5, 17);
    ctx.fillStyle = COLORS.flannelDark;
    ctx.fillRect(rx + 1, ry + 8, 4, 2);
    ctx.fillRect(rx + 13, ry + 8, 5, 2);
    ctx.fillRect(rx + 1, ry + 14, 4, 2);
    ctx.fillRect(rx + 13, ry + 14, 5, 2);
    ctx.fillStyle = COLORS.flannelRed;
    ctx.fillRect(rx + 16, ry + 3, 12, 4);
    ctx.fillStyle = COLORS.flannelDark;
    ctx.fillRect(rx + 16, ry + 5, 12, 1);
    ctx.fillRect(rx + 22, ry + 3, 2, 3);
    ctx.fillStyle = COLORS.baymanSkin;
    ctx.fillRect(rx + 26, ry + 2, 4, 5);
    ctx.fillStyle = COLORS.baymanSkin;
    ctx.fillRect(rx + 6, ry - 2, 6, 6);
    ctx.fillStyle = COLORS.baymanSkin;
    ctx.beginPath();
    ctx.ellipse(rx + 9, ry - 7, 7, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.baymanRuddy;
    ctx.fillRect(rx + 12, ry - 7, 4, 6);
    ctx.fillStyle = COLORS.baymanRuddy;
    ctx.fillRect(rx + 16, ry - 8, 2, 3);
    ctx.fillStyle = COLORS.eyes;
    ctx.fillRect(rx + 13, ry - 10, 2, 2);
    ctx.fillStyle = COLORS.text;
    ctx.fillRect(rx + 14, ry - 4, 3, 1);
    ctx.fillStyle = COLORS.syrupBrown;
    ctx.fillRect(rx + 14, ry - 3, 3, 1);
    ctx.fillStyle = COLORS.baymanSkinDark;
    ctx.fillRect(rx + 12, ry - 3, 1, 1);
    ctx.fillRect(rx + 14, ry - 2, 1, 1);
    ctx.fillRect(rx + 11, ry - 2, 1, 1);
    ctx.fillStyle = COLORS.hairBrown;
    ctx.fillRect(rx + 2, ry - 10, 3, 4);
    ctx.fillRect(rx + 2, ry - 7, 2, 4);
    ctx.fillStyle = COLORS.capBlue;
    ctx.fillRect(rx + 2, ry - 16, 13, 7);
    ctx.fillStyle = COLORS.capBlueDark;
    ctx.fillRect(rx + 13, ry - 14, 7, 3);
    ctx.fillStyle = COLORS.capBlueDark;
    ctx.fillRect(rx + 8, ry - 16, 2, 1);
    ctx.fillStyle = COLORS.jeanBlue;
    ctx.fillRect(rx + 5, ry + 19, 14, 5);
    ctx.fillStyle = COLORS.jeanBlueDark;
    ctx.fillRect(rx + 17, ry + 20, 4, 7);
    ctx.fillStyle = COLORS.jeanBlue;
    ctx.fillRect(rx + 17, ry + 24, 5, 8);
    ctx.fillStyle = COLORS.bootBlack;
    ctx.fillRect(rx + 16, ry + 31, 7, 4);
    ctx.fillStyle = COLORS.bootSole;
    ctx.fillRect(rx + 15, ry + 35, 9, 2);
    if (invincible) {
      ctx.restore();
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
      const x = obs.x;
      const y = GROUND_Y - obs.height;
      switch (obs.type) {
        case "stump":
          this._drawStump(x, y, obs.width, obs.height);
          break;
        case "rock":
          this._drawRock(x, y, obs.width, obs.height);
          break;
        case "moose":
          this._drawMoose(x, y);
          break;
      }
    }
  }
  /** @private */
  _drawStump(x, y, w, h) {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.stumpBrown;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = COLORS.stumpLight;
    ctx.fillRect(x + 2, y, 4, h);
    ctx.fillRect(x, y, w, 4);
    ctx.fillStyle = COLORS.stumpBrown;
    ctx.fillRect(x + 4, y + 1, w - 8, 2);
  }
  /** @private */
  _drawRock(x, y, w, h) {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.rockGray;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + h);
    ctx.lineTo(x, y + h - 5);
    ctx.lineTo(x + 3, y + 4);
    ctx.lineTo(x + w / 2, y);
    ctx.lineTo(x + w - 3, y + 3);
    ctx.lineTo(x + w, y + h - 4);
    ctx.lineTo(x + w - 3, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLORS.rockLight;
    ctx.beginPath();
    ctx.moveTo(x + 5, y + 6);
    ctx.lineTo(x + w / 2, y + 2);
    ctx.lineTo(x + w / 2 + 4, y + 6);
    ctx.lineTo(x + 8, y + 10);
    ctx.closePath();
    ctx.fill();
  }
  /** @private */
  _drawMoose(x, y) {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.mooseBrown;
    ctx.fillRect(x + 8, y + 15, 28, 18);
    ctx.fillRect(x + 30, y + 5, 8, 15);
    ctx.fillRect(x + 33, y + 2, 12, 10);
    ctx.fillStyle = COLORS.mooseLight;
    ctx.fillRect(x + 35, y - 5, 3, 8);
    ctx.fillRect(x + 33, y - 5, 8, 3);
    ctx.fillRect(x + 42, y - 3, 3, 6);
    ctx.fillRect(x + 40, y - 3, 6, 3);
    ctx.fillStyle = COLORS.mooseBrown;
    ctx.fillRect(x + 10, y + 33, 5, 17);
    ctx.fillRect(x + 20, y + 33, 5, 17);
    ctx.fillRect(x + 28, y + 33, 5, 17);
    ctx.fillStyle = COLORS.mooseLight;
    ctx.fillRect(x + 8, y + 15, 28, 3);
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
    if (!powerups) return;
    for (const pu of powerups) {
      const bob = Math.sin(frameCount * 0.083) * 3;
      const x = pu.x;
      const y = pu.y + bob;
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = 0.4 + Math.sin(frameCount * 0.111) * 0.2;
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x + pu.width / 2, y + pu.height / 2, pu.width / 2 + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      switch (pu.type) {
        case "vienna":
          this._drawVienna(x, y);
          break;
        case "syrup":
          this._drawSyrup(x, y);
          break;
        case "margarine":
          this._drawMargarine(x, y);
          break;
      }
    }
  }
  /** @private Draws a small can of blue Vienna sausages. */
  _drawVienna(x, y) {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.viennaBlue;
    ctx.fillRect(x, y + 2, 20, 12);
    ctx.fillStyle = COLORS.viennaLight;
    ctx.fillRect(x, y, 20, 3);
    ctx.fillRect(x, y + 13, 20, 3);
    ctx.fillStyle = COLORS.viennaLabel;
    ctx.fillRect(x + 3, y + 5, 14, 5);
  }
  /** @private Draws a bottle of Purity syrup. */
  _drawSyrup(x, y) {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.syrupBrown;
    ctx.fillRect(x + 2, y + 8, 10, 16);
    ctx.fillStyle = COLORS.syrupLight;
    ctx.fillRect(x + 4, y + 3, 6, 6);
    ctx.fillStyle = COLORS.syrupCap;
    ctx.fillRect(x + 3, y, 8, 4);
    ctx.fillStyle = COLORS.syrupLabel;
    ctx.fillRect(x + 3, y + 12, 8, 6);
  }
  /** @private Draws a block of Eversweet margarine. */
  _drawMargarine(x, y) {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.margarineYellow;
    ctx.fillRect(x, y + 2, 22, 12);
    ctx.fillStyle = COLORS.margarineLight;
    ctx.fillRect(x, y + 2, 22, 3);
    ctx.fillStyle = COLORS.margText;
    ctx.fillRect(x + 3, y + 6, 16, 5);
    ctx.fillStyle = "#C0C0C0";
    ctx.fillRect(x, y + 2, 3, 12);
    ctx.fillRect(x + 19, y + 2, 3, 12);
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
    drawParticles(this.ctx, particles);
  }
  /**
   * Draws floating "+5" score popups that rise and fade after smashing obstacles.
   *
   * @private
   * @param {Array} popups
   */
  _drawScorePopups(popups) {
    if (!popups || popups.length === 0) return;
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.gold;
    ctx.font = `bold 14px ${UI_FONT2}`;
    ctx.textAlign = "center";
    for (const pop of popups) {
      ctx.globalAlpha = Math.min(pop.life / 20, 1);
      ctx.fillText(pop.text, pop.x, pop.y);
    }
    ctx.globalAlpha = 1;
  }
  /**
   * Draws a big centered flash announcing the power-up collected.
   *
   * @private
   * @param {import("./engine").GameState} state
   */
  _drawPowerupFlash(state) {
    if (!state.powerupFlash || state.powerupFlashTimer <= 0) return;
    const ctx = this.ctx;
    const names = {
      vienna: "VIENNA SAUSAGES!",
      syrup: "PURITY SYRUP!",
      margarine: "EVERSWEET!"
    };
    const text = names[state.powerupFlash] || state.powerupFlash.toUpperCase();
    const alpha = Math.min(state.powerupFlashTimer / 30, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.font = `bold 22px ${UI_FONT2}`;
    ctx.fillText(text, CANVAS_WIDTH / 2 + 1, 65 + 1);
    ctx.fillStyle = COLORS.gold;
    ctx.fillText(text, CANVAS_WIDTH / 2, 65);
    ctx.font = `bold 14px ${UI_FONT2}`;
    ctx.fillText(`+${10} INVINCIBLE!`, CANVAS_WIDTH / 2, 85);
    ctx.restore();
  }
  /**
   * Draws the invincibility effect — golden glow around trike, masked so
   * the glow appears behind the character without washing them out.
   *
   * @private
   * @param {import("./engine").GameState} state
   */
  _drawInvincibleEffect(state) {
    const ctx = this.ctx;
    const x = state.playerX;
    const y = state.playerY;
    const expiring = state.invincibleTimer / INVINCIBLE_DURATION < 0.25;
    const flashMultiplier = expiring ? 0.167 : 0.083;
    const alpha = 0.3 + Math.sin(state.frameCount * flashMultiplier) * 0.2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.ellipse(x + 25, y - 15, 28, 24, 0, 0, Math.PI * 2, true);
    ctx.clip();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = COLORS.invincibleGlow;
    ctx.beginPath();
    ctx.ellipse(x + 25, y - 15, 38, 32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.text;
    ctx.font = `bold 16px ${UI_FONT2}`;
    ctx.textAlign = "right";
    ctx.fillText(`${state.score}`, CANVAS_WIDTH - 12, 22);
    ctx.textAlign = "center";
    ctx.fillText("BAYMAN!", CANVAS_WIDTH / 2, 22);
    if (state.invincibleTimer > 0) {
      const fraction = state.invincibleTimer / INVINCIBLE_DURATION;
      const expiring = fraction < 0.25;
      const barWidth = 80;
      const barX = 12;
      const barY = 14;
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.beginPath();
      ctx.roundRect(barX, barY, barWidth, 6, 3);
      ctx.fill();
      const barColor = expiring ? COLORS.syrupCap : COLORS.gold;
      if (!expiring || Math.sin(state.frameCount * 0.208) > 0) {
        ctx.fillStyle = barColor;
        ctx.beginPath();
        ctx.roundRect(barX, barY, barWidth * fraction, 6, 3);
        ctx.fill();
      }
      ctx.fillStyle = COLORS.text;
      ctx.font = `bold 10px ${UI_FONT2}`;
      ctx.textAlign = "left";
      ctx.fillText("INVINCIBLE", 12, barY + 16);
    }
  }
  /** @private Draws the start screen overlay. */
  _drawStartScreen() {
    drawStartScreen(this.ctx, {
      title: "BAYMAN!",
      lines: [
        { text: "Ride the Big Red. Jump the junks." },
        { text: "Dodge stumps, rocks, and the odd moose.", size: 14 },
        { text: "Grab a snack to go invincible!", size: 14 }
      ],
      startPrompt: "SPACE or CLICK to start",
      canvasWidth: CANVAS_WIDTH,
      canvasHeight: CANVAS_HEIGHT,
      colors: COLORS,
      font: UI_FONT2,
      layout: { descGap: 28, promptY: 240, hintY: 265 }
    });
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
      canvasWidth: CANVAS_WIDTH,
      canvasHeight: CANVAS_HEIGHT,
      colors: COLORS,
      font: UI_FONT2
    });
  }
};

// src/games/codjigger/config.js
var config_exports2 = {};
__export(config_exports2, {
  BITE_MAX_DELAY: () => BITE_MAX_DELAY,
  BITE_MIN_DELAY: () => BITE_MIN_DELAY,
  BITE_WINDOW: () => BITE_WINDOW,
  CANVAS_HEIGHT: () => CANVAS_HEIGHT2,
  CANVAS_WIDTH: () => CANVAS_WIDTH2,
  CAUGHT_DISPLAY: () => CAUGHT_DISPLAY,
  COLORS: () => COLORS2,
  DORY_X: () => DORY_X,
  DORY_Y: () => DORY_Y,
  MISSED_DISPLAY: () => MISSED_DISPLAY,
  PHASE: () => PHASE2,
  PULL_DURATION: () => PULL_DURATION,
  UI_FONT: () => UI_FONT3,
  WATERLINE_Y: () => WATERLINE_Y,
  WAVE_AMPLITUDE: () => WAVE_AMPLITUDE
});
var CANVAS_WIDTH2 = 600;
var CANVAS_HEIGHT2 = 300;
var WATERLINE_Y = 120;
var WAVE_AMPLITUDE = 3;
var DORY_X = 260;
var DORY_Y = WATERLINE_Y - 6;
var BITE_MIN_DELAY = 3e3;
var BITE_MAX_DELAY = 9e3;
var BITE_WINDOW = 1800;
var PULL_DURATION = 0.833;
var CAUGHT_DISPLAY = 1.5;
var MISSED_DISPLAY = 1;
var PHASE2 = Object.freeze({
  START: "START",
  WAITING: "WAITING",
  BITE: "BITE",
  PULLING: "PULLING",
  CAUGHT: "CAUGHT",
  MISSED: "MISSED"
});
var COLORS2 = {
  ...SHARED_COLORS,
  // Sky — overcast Newfoundland day
  skyTop: "#7A8E9E",
  skyBottom: "#A0B0BB",
  cloud: "rgba(255, 255, 255, 0.25)",
  // Ocean
  oceanTop: "#2E6B7F",
  oceanMid: "#1F5060",
  oceanBottom: "#142E3A",
  wave: "#3D8A9F",
  waveShadow: "#1A4A5A",
  foam: "rgba(255, 255, 255, 0.35)",
  // Dory (small flat-bottomed boat)
  doryHull: "#6B4226",
  doryLight: "#8B5E3C",
  doryInside: "#5A3820",
  doryRim: "#7A5030",
  doryGunwale: "#9A7050",
  // Fisher — yellow oilskins and sou'wester
  oilskin: "#E8C833",
  oilskinDark: "#C4A828",
  oilskinShade: "#B09020",
  souwester: "#D4B82C",
  souwesterBrim: "#B89A20",
  face: "#D4A574",
  faceShadow: "#C09060",
  // Fishing line & jigger
  line: "#999",
  jigger: "#888",
  jiggerDark: "#666",
  // Cod fish
  codBody: "#5A7A5A",
  codLight: "#7A9A6A",
  codBelly: "#D4C8A8",
  codDark: "#4A6A4A",
  codFin: "#6A8A5A",
  codEye: "#222",
  codEyeWhite: "#DDD",
  // Splash
  splash: "rgba(255, 255, 255, 0.6)",
  // Game-specific UI
  biteAlert: "#CC3333",
  missText: "#AAA"
};
var UI_FONT3 = UI_FONT;

// src/games/codjigger/engine.js
var CATCH_MESSAGES = [
  "Beauty!",
  "What a jig!",
  "Right on!",
  "She's a good one!",
  "Haul 'er in!",
  "Yes b'y!",
  "Jigged 'er!"
];
var MISS_MESSAGES = [
  "Too soon, b'y",
  "Patience now...",
  "Scared 'em off",
  "Easy does it...",
  "Steady on..."
];
var CodJiggerEngine = class extends BaseEngine {
  /** Resets all game-specific state. */
  reset() {
    super.reset();
    this.fishCaught = 0;
    this.biteTimer = 0;
    this.biteWindowTimer = 0;
    this.pullTimer = 0;
    this.caughtTimer = 0;
    this.missedTimer = 0;
    this.lineShake = 0;
    this.message = "";
    this.jiggerY = 0;
    this.fishY = 0;
  }
  /**
   * Player pulls the line. Context-dependent:
   * - START → begin fishing
   * - WAITING → pulled too early, scare fish
   * - BITE → caught a fish!
   */
  pull() {
    if (this.phase === "START") {
      this.setPhase("WAITING");
      this._scheduleBite();
      return;
    }
    if (this.phase === "BITE") {
      this.setPhase("PULLING");
      this.pullTimer = PULL_DURATION;
      this.fishCaught++;
      this.addScore(1);
      this.message = CATCH_MESSAGES[Math.floor(Math.random() * CATCH_MESSAGES.length)];
      this.lineShake = 0;
      return;
    }
    if (this.phase === "WAITING") {
      this.setPhase("MISSED");
      this.missedTimer = MISSED_DISPLAY;
      this.message = MISS_MESSAGES[Math.floor(Math.random() * MISS_MESSAGES.length)];
    }
  }
  /**
   * Game-specific update logic — called each frame by BaseEngine.
   *
   * @param {number} dt - Delta-time in seconds since last frame
   */
  update(dt) {
    this.jiggerY = Math.sin(this.frameCount * 0.06) * 3;
    if (this.phase === "WAITING") {
      this.biteTimer -= dt;
      if (this.biteTimer <= 0) {
        this.setPhase("BITE");
        this.biteWindowTimer = BITE_WINDOW / 1e3;
      }
    }
    if (this.phase === "BITE") {
      this.lineShake = Math.sin(this.frameCount * 0.8) * 5;
      this.biteWindowTimer -= dt;
      if (this.biteWindowTimer <= 0) {
        this.setPhase("MISSED");
        this.missedTimer = MISSED_DISPLAY;
        this.lineShake = 0;
        this.message = "Got away...";
      }
    }
    if (this.phase === "PULLING") {
      this.pullTimer -= dt;
      this.lineShake = 0;
      this.fishY = 1 - this.pullTimer / PULL_DURATION;
      if (this.pullTimer <= 0) {
        this.setPhase("CAUGHT");
        this.caughtTimer = CAUGHT_DISPLAY;
      }
    }
    if (this.phase === "CAUGHT") {
      this.caughtTimer -= dt;
      if (this.caughtTimer <= 0) {
        this.setPhase("WAITING");
        this.message = "";
        this._scheduleBite();
      }
    }
    if (this.phase === "MISSED") {
      this.missedTimer -= dt;
      this.lineShake = 0;
      if (this.missedTimer <= 0) {
        this.setPhase("WAITING");
        this.message = "";
        this._scheduleBite();
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
      message: this.message
    };
  }
  /**
   * Schedules the next bite after a random delay.
   *
   * @private
   */
  _scheduleBite() {
    const delayMs = BITE_MIN_DELAY + Math.random() * (BITE_MAX_DELAY - BITE_MIN_DELAY);
    this.biteTimer = delayMs / 1e3;
  }
};
/** @type {string[]} Game phases for the phase machine. */
__publicField(CodJiggerEngine, "phases", ["START", "WAITING", "BITE", "PULLING", "CAUGHT", "MISSED"]);

// src/games/codjigger/renderer.js
var CodJiggerRenderer = class {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.canvas.width = CANVAS_WIDTH2;
    this.canvas.height = CANVAS_HEIGHT2;
    this.ctx = canvas.getContext("2d");
  }
  /**
   * Main render — draws all elements for one frame.
   *
   * @param {Object} state - Game state from engine
   */
  draw(state) {
    this._drawSky(state);
    this._drawOcean(state);
    this._drawDory(state);
    this._drawFisher(state);
    this._drawLine(state);
    this._drawUnderwater(state);
    this._drawUI(state);
    if (state.phase === PHASE2.START) {
      this._drawStartScreen();
    }
  }
  // ---------------------------------------------------------------------------
  // Sky
  // ---------------------------------------------------------------------------
  /** @private */
  _drawSky(state) {
    const ctx = this.ctx;
    const grad = ctx.createLinearGradient(0, 0, 0, WATERLINE_Y);
    grad.addColorStop(0, COLORS2.skyTop);
    grad.addColorStop(1, COLORS2.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_WIDTH2, WATERLINE_Y);
    ctx.fillStyle = COLORS2.cloud;
    const t = state.frameCount * 0.15;
    this._drawCloud(60 + t % (CANVAS_WIDTH2 + 200) - 100, 30, 50, 18);
    this._drawCloud(250 + t * 0.6 % (CANVAS_WIDTH2 + 200) - 100, 50, 40, 14);
    this._drawCloud(450 + t * 0.8 % (CANVAS_WIDTH2 + 200) - 100, 25, 60, 20);
  }
  /** @private Draws a simple cloud blob. Delegates to shared drawCloud. */
  _drawCloud(x, y, w, h) {
    drawCloud(this.ctx, x, y, w, h);
  }
  // ---------------------------------------------------------------------------
  // Ocean
  // ---------------------------------------------------------------------------
  /** @private */
  _drawOcean(state) {
    const ctx = this.ctx;
    const grad = ctx.createLinearGradient(0, WATERLINE_Y, 0, CANVAS_HEIGHT2);
    grad.addColorStop(0, COLORS2.oceanTop);
    grad.addColorStop(0.5, COLORS2.oceanMid);
    grad.addColorStop(1, COLORS2.oceanBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, WATERLINE_Y, CANVAS_WIDTH2, CANVAS_HEIGHT2 - WATERLINE_Y);
    drawWaves(ctx, WATERLINE_Y, WAVE_AMPLITUDE, CANVAS_WIDTH2, state.frameCount, COLORS2);
  }
  // ---------------------------------------------------------------------------
  // Dory (boat)
  // ---------------------------------------------------------------------------
  /** @private */
  _drawDory(state) {
    const bob = Math.sin(state.frameCount * 0.04) * 2;
    drawDory(this.ctx, DORY_X, DORY_Y + bob, 1, COLORS2);
    this._doryBob = bob;
  }
  // ---------------------------------------------------------------------------
  // Fisher
  // ---------------------------------------------------------------------------
  /** @private */
  _drawFisher(state) {
    const bob = this._doryBob;
    drawFisher(this.ctx, DORY_X, DORY_Y + bob, 1, COLORS2);
  }
  // ---------------------------------------------------------------------------
  // Fishing line & jigger
  // ---------------------------------------------------------------------------
  /** @private */
  _drawLine(state) {
    const ctx = this.ctx;
    const bob = this._doryBob;
    const shake = state.lineShake || 0;
    const rodTipX = DORY_X + 20 + shake;
    const rodTipY = DORY_Y + bob - 18;
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(DORY_X + 8, DORY_Y + bob - 16);
    ctx.lineTo(rodTipX, rodTipY - 8);
    ctx.stroke();
    const jiggerX = DORY_X + 22 + shake;
    const jiggerBaseY = WATERLINE_Y + 80 + state.jiggerY;
    ctx.strokeStyle = COLORS2.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rodTipX, rodTipY - 8);
    ctx.lineTo(jiggerX, jiggerBaseY);
    ctx.stroke();
    if (state.phase !== PHASE2.PULLING && state.phase !== PHASE2.CAUGHT) {
      ctx.fillStyle = COLORS2.jigger;
      ctx.beginPath();
      ctx.ellipse(jiggerX, jiggerBaseY + 4, 4, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS2.jiggerDark;
      ctx.beginPath();
      ctx.ellipse(jiggerX - 1, jiggerBaseY + 4, 2, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#777";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(jiggerX, jiggerBaseY + 12, 3, 0, Math.PI);
      ctx.stroke();
    }
  }
  // ---------------------------------------------------------------------------
  // Underwater scene
  // ---------------------------------------------------------------------------
  /** @private */
  _drawUnderwater(state) {
    const ctx = this.ctx;
    const t = state.frameCount;
    if (state.phase === PHASE2.WAITING || state.phase === PHASE2.START) {
      ctx.fillStyle = "rgba(40, 60, 50, 0.15)";
      for (let i = 0; i < 3; i++) {
        const fx = (t * (0.5 + i * 0.3) + i * 200) % (CANVAS_WIDTH2 + 100) - 50;
        const fy = WATERLINE_Y + 50 + i * 35 + Math.sin(t * 0.03 + i) * 8;
        this._drawFishSilhouette(fx, fy, 18 + i * 4, i % 2 === 0 ? 1 : -1);
      }
    }
    if (state.phase === PHASE2.BITE) {
      ctx.fillStyle = "rgba(60, 80, 60, 0.25)";
      const approachX = DORY_X + 22 + state.lineShake - 25;
      const approachY = WATERLINE_Y + 75 + state.jiggerY;
      this._drawFishSilhouette(approachX, approachY, 22, 1);
      ctx.fillStyle = COLORS2.splash;
      for (let i = 0; i < 4; i++) {
        const sx = DORY_X + 18 + Math.sin(t * 0.5 + i * 2) * 8;
        const sy = WATERLINE_Y - 2 + Math.cos(t * 0.7 + i) * 3;
        ctx.beginPath();
        ctx.arc(sx, sy, 2 + Math.random(), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (state.phase === PHASE2.PULLING) {
      const startY = WATERLINE_Y + 80;
      const endY = DORY_Y - 10;
      const fishDrawY = startY + (endY - startY) * state.fishY;
      this._drawCod(DORY_X + 22, fishDrawY, 1);
    }
    if (state.phase === PHASE2.CAUGHT) {
      this._drawCod(DORY_X + 22, DORY_Y - 15 + this._doryBob, 1);
    }
  }
  /** @private Draws a simple fish silhouette (ambient). */
  _drawFishSilhouette(x, y, size, dir) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.ellipse(x, y, size, size * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - size * dir, y);
    ctx.lineTo(x - (size + 8) * dir, y - 5);
    ctx.lineTo(x - (size + 8) * dir, y + 5);
    ctx.closePath();
    ctx.fill();
  }
  /**
   * Draws a detailed Atlantic cod.
   *
   * @private
   * @param {number} x - Center X
   * @param {number} y - Center Y
   * @param {number} dir - Direction (1 = right, -1 = left)
   */
  _drawCod(x, y, dir) {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS2.codBody;
    ctx.beginPath();
    ctx.ellipse(x, y, 22, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS2.codBelly;
    ctx.beginPath();
    ctx.ellipse(x, y + 3, 18, 5, 0, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = COLORS2.codLight;
    ctx.beginPath();
    ctx.ellipse(x, y - 2, 16, 4, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS2.codDark;
    ctx.beginPath();
    ctx.arc(x - 6 * dir, y - 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 2 * dir, y - 1, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - 3 * dir, y + 2, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS2.codFin;
    ctx.beginPath();
    ctx.moveTo(x - 20 * dir, y);
    ctx.lineTo(x - 30 * dir, y - 8);
    ctx.lineTo(x - 28 * dir, y);
    ctx.lineTo(x - 30 * dir, y + 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLORS2.codFin;
    ctx.beginPath();
    ctx.moveTo(x - 8 * dir, y - 8);
    ctx.lineTo(x + 4 * dir, y - 10);
    ctx.lineTo(x + 6 * dir, y - 7);
    ctx.lineTo(x - 6 * dir, y - 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLORS2.codEyeWhite;
    ctx.beginPath();
    ctx.arc(x + 14 * dir, y - 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS2.codEye;
    ctx.beginPath();
    ctx.arc(x + 14 * dir, y - 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS2.codDark;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 18 * dir, y + 4);
    ctx.lineTo(x + 22 * dir, y + 8);
    ctx.stroke();
    ctx.strokeStyle = COLORS2.codLight;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x - 16 * dir, y);
    ctx.lineTo(x + 12 * dir, y - 1);
    ctx.stroke();
  }
  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------
  /** @private */
  _drawUI(state) {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS2.text;
    ctx.font = `bold 16px ${UI_FONT3}`;
    ctx.textAlign = "left";
    ctx.fillText("COD JIGGING GROUNDS", 12, 22);
    ctx.textAlign = "right";
    ctx.fillText(`${state.fishCaught} fish`, CANVAS_WIDTH2 - 12, 22);
    if (state.phase === PHASE2.BITE) {
      const pulse = Math.sin(state.frameCount * 0.3) * 0.3 + 0.7;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.fillStyle = COLORS2.biteAlert;
      ctx.font = `bold 28px ${UI_FONT3}`;
      ctx.textAlign = "center";
      ctx.fillText("BITE!", CANVAS_WIDTH2 / 2, CANVAS_HEIGHT2 - 30);
      ctx.restore();
    }
    if (state.message && (state.phase === PHASE2.CAUGHT || state.phase === PHASE2.PULLING)) {
      ctx.fillStyle = COLORS2.gold;
      ctx.font = `bold 20px ${UI_FONT3}`;
      ctx.textAlign = "center";
      ctx.fillText(state.message, CANVAS_WIDTH2 / 2, CANVAS_HEIGHT2 - 30);
    }
    if (state.message && state.phase === PHASE2.MISSED) {
      ctx.fillStyle = COLORS2.missText;
      ctx.font = `16px ${UI_FONT3}`;
      ctx.textAlign = "center";
      ctx.fillText(state.message, CANVAS_WIDTH2 / 2, CANVAS_HEIGHT2 - 30);
    }
    if (state.phase === PHASE2.WAITING && state.frameCount > 60) {
      ctx.fillStyle = "rgba(240, 237, 230, 0.3)";
      ctx.font = `12px ${UI_FONT3}`;
      ctx.textAlign = "center";
      ctx.fillText("click or SPACE when the line shakes", CANVAS_WIDTH2 / 2, CANVAS_HEIGHT2 - 12);
    }
  }
  /** @private */
  _drawStartScreen() {
    drawStartScreen(this.ctx, {
      title: "COD JIGGING GROUNDS",
      lines: [
        { text: "Sit in the dory. Wait for the bite." },
        { text: "When the line shakes, pull 'er in!", size: 14 }
      ],
      startPrompt: "SPACE or CLICK to start",
      canvasWidth: CANVAS_WIDTH2,
      canvasHeight: CANVAS_HEIGHT2,
      colors: COLORS2,
      font: UI_FONT3,
      layout: { titleSize: 26, descGap: 28, promptY: 230, hintY: 255 }
    });
  }
};

// src/games/overboard/config.js
var config_exports3 = {};
__export(config_exports3, {
  CANVAS_HEIGHT: () => CANVAS_HEIGHT3,
  CANVAS_WIDTH: () => CANVAS_WIDTH3,
  CELL_SIZE: () => CELL_SIZE,
  COLORS: () => COLORS3,
  DORY_X: () => DORY_X2,
  DORY_Y: () => DORY_Y2,
  DROP_INTERVALS: () => DROP_INTERVALS,
  GRID_COLS: () => GRID_COLS,
  GRID_ROWS: () => GRID_ROWS,
  HARD_DROP_POINTS: () => HARD_DROP_POINTS,
  LINES_PER_LEVEL: () => LINES_PER_LEVEL,
  LINE_CLEAR_SCORES: () => LINE_CLEAR_SCORES,
  LOCK_DELAY: () => LOCK_DELAY,
  PHASE: () => PHASE3,
  PIECES: () => PIECES,
  PIECE_NAMES: () => PIECE_NAMES,
  PLAY_AREA_X: () => PLAY_AREA_X,
  PLAY_AREA_Y: () => PLAY_AREA_Y,
  SOFT_DROP_POINTS: () => SOFT_DROP_POINTS,
  UI_FONT: () => UI_FONT4,
  WATERLINE_Y: () => WATERLINE_Y2,
  WAVE_AMPLITUDE: () => WAVE_AMPLITUDE2
});
var CANVAS_WIDTH3 = 360;
var CANVAS_HEIGHT3 = 580;
var GRID_COLS = 10;
var GRID_ROWS = 20;
var CELL_SIZE = 25;
var PLAY_AREA_X = 0;
var PLAY_AREA_Y = 80;
var WATERLINE_Y2 = 50;
var WAVE_AMPLITUDE2 = 2;
var DORY_X2 = 130;
var DORY_Y2 = WATERLINE_Y2 - 4;
var LOCK_DELAY = 0.5;
var LINES_PER_LEVEL = 10;
var DROP_INTERVALS = [
  0.8,
  0.717,
  0.633,
  0.55,
  0.467,
  0.383,
  0.3,
  0.217,
  0.133,
  0.1,
  0.083,
  0.083,
  0.083,
  0.067,
  0.067,
  0.067,
  0.05,
  0.05,
  0.05,
  0.033,
  0.033,
  0.033,
  0.033,
  0.033,
  0.033,
  0.033,
  0.033,
  0.033,
  0.033,
  0.017
];
var LINE_CLEAR_SCORES = [0, 100, 300, 500, 800];
var SOFT_DROP_POINTS = 1;
var HARD_DROP_POINTS = 2;
var PHASE3 = Object.freeze({
  START: "START",
  PLAYING: "PLAYING",
  DEAD: "DEAD"
});
var PIECES = {
  I: {
    shape: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ],
    color: "#E8C65A"
    // Pineapple gold
  },
  O: {
    shape: [
      [1, 1],
      [1, 1]
    ],
    color: "#CC3333"
    // Lobster red
  },
  T: {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    color: "#4A7A9B"
    // Ocean steel blue (brand primary)
  },
  S: {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0]
    ],
    color: "#3A6B2E"
    // Forest green
  },
  Z: {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0]
    ],
    color: "#D4742C"
    // Dory orange
  },
  J: {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    color: "#5A9BAD"
    // Coastal teal
  },
  L: {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0]
    ],
    color: "#C4A35A"
    // Rope tan
  }
};
var PIECE_NAMES = Object.keys(PIECES);
var COLORS3 = {
  ...SHARED_COLORS,
  // Sky — overcast Newfoundland day
  skyTop: "#7A8E9E",
  skyBottom: "#A0B0BB",
  cloud: "rgba(255, 255, 255, 0.25)",
  // Surface waves
  wave: "#3D8A9F",
  foam: "rgba(255, 255, 255, 0.35)",
  // Dory
  doryHull: "#6B4226",
  doryLight: "#8B5E3C",
  doryInside: "#5A3820",
  doryRim: "#7A5030",
  doryGunwale: "#9A7050",
  // Fisher
  oilskin: "#E8C833",
  oilskinDark: "#C4A828",
  oilskinShade: "#B09020",
  souwester: "#D4B82C",
  souwesterBrim: "#B89A20",
  face: "#D4A574",
  faceShadow: "#C09060",
  // Ocean gradient background (below waterline / grid)
  oceanTop: "#1F5060",
  oceanBottom: "#0a1628",
  // Grid
  gridLine: "rgba(255, 255, 255, 0.06)",
  gridBg: "rgba(0, 0, 0, 0.3)",
  // Plank lines on grid (subtle hull texture)
  plank: "rgba(255, 255, 255, 0.03)",
  // Crate styling
  crateBevel: "rgba(255, 255, 255, 0.25)",
  crateShadow: "rgba(0, 0, 0, 0.35)",
  crateGrain: "rgba(0, 0, 0, 0.15)",
  // Line clear flash
  clearFlash: "rgba(255, 255, 255, 0.5)"
};
var UI_FONT4 = UI_FONT;

// src/games/overboard/engine.js
var OverboardEngine = class extends BaseEngine {
  /** Resets all game-specific state. */
  reset() {
    super.reset();
    this.level = 0;
    this.lines = 0;
    this.grid = this._createGrid();
    this.current = null;
    this.bag = [];
    this.dropTimer = 0;
    this.lockTimer = 0;
    this.isLocking = false;
    this.clearingRows = [];
    this.clearTimer = 0;
  }
  /**
   * Creates an empty grid.
   *
   * @private
   * @returns {(string|null)[][]}
   */
  _createGrid() {
    return Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
  }
  /**
   * Restart the game. Resets state, spawns first piece, starts loop.
   * Overrides BaseEngine to spawn the first piece after reset.
   */
  restart() {
    super.restart();
    this._spawnPiece();
  }
  // ---------------------------------------------------------------------------
  // Player actions
  // ---------------------------------------------------------------------------
  /** Moves current piece left. Resets lock delay if successful while locking. */
  moveLeft() {
    if (this.phase === PHASE3.START) {
      this._startPlaying();
      return;
    }
    if (this.phase !== PHASE3.PLAYING || !this.current || this.clearTimer > 0) return;
    if (this.canPlace(this.current.shape, this.current.x - 1, this.current.y)) {
      this.current.x--;
      this._resetLockIfLocking();
    }
  }
  /** Moves current piece right. Resets lock delay if successful while locking. */
  moveRight() {
    if (this.phase === PHASE3.START) {
      this._startPlaying();
      return;
    }
    if (this.phase !== PHASE3.PLAYING || !this.current || this.clearTimer > 0) return;
    if (this.canPlace(this.current.shape, this.current.x + 1, this.current.y)) {
      this.current.x++;
      this._resetLockIfLocking();
    }
  }
  /** Rotates current piece clockwise. Resets lock delay if successful. */
  rotate() {
    if (this.phase === PHASE3.START) {
      this._startPlaying();
      return;
    }
    if (this.phase !== PHASE3.PLAYING || !this.current || this.clearTimer > 0) return;
    const rotated = this._rotateMatrix(this.current.shape);
    if (this.canPlace(rotated, this.current.x, this.current.y)) {
      this.current.shape = rotated;
      this._resetLockIfLocking();
    }
  }
  /** Soft drop -- moves piece down one row, awards 1 point. */
  softDrop() {
    if (this.phase === PHASE3.START) {
      this._startPlaying();
      return;
    }
    if (this.phase !== PHASE3.PLAYING || !this.current || this.clearTimer > 0) return;
    if (this.canPlace(this.current.shape, this.current.x, this.current.y + 1)) {
      this.current.y++;
      this.addScore(SOFT_DROP_POINTS);
      this.dropTimer = 0;
    }
  }
  /** Hard drop -- instantly drops piece to bottom, awards 2 points per cell. */
  hardDrop() {
    if (this.phase === PHASE3.START) {
      this._startPlaying();
      return;
    }
    if (this.phase !== PHASE3.PLAYING || !this.current || this.clearTimer > 0) return;
    let distance = 0;
    while (this.canPlace(this.current.shape, this.current.x, this.current.y + 1)) {
      this.current.y++;
      distance++;
    }
    this.addScore(distance * HARD_DROP_POINTS);
    this._lockPiece();
  }
  /** @private Transitions from start screen to playing. */
  _startPlaying() {
    this.setPhase(PHASE3.PLAYING);
    this._spawnPiece();
  }
  // ---------------------------------------------------------------------------
  // Game loop
  // ---------------------------------------------------------------------------
  /**
   * Updates game state for one frame. Called by BaseEngine each tick.
   *
   * @param {number} dt - Delta-time in seconds since last frame
   */
  update(dt) {
    if (this.phase !== PHASE3.PLAYING) return;
    if (this.clearTimer > 0) {
      this.clearTimer -= dt;
      if (this.clearTimer <= 0) {
        this._removeClearedRows();
        this.clearingRows = [];
        this._spawnPiece();
      }
      return;
    }
    if (!this.current) return;
    this.dropTimer += dt;
    const dropInterval = this._getDropInterval();
    if (this.dropTimer >= dropInterval) {
      this.dropTimer = 0;
      if (this.canPlace(this.current.shape, this.current.x, this.current.y + 1)) {
        this.current.y++;
        this.isLocking = false;
        this.lockTimer = 0;
      } else {
        this.isLocking = true;
      }
    }
    if (this.isLocking) {
      this.lockTimer += dt;
      if (this.lockTimer >= LOCK_DELAY) {
        this._lockPiece();
      }
    }
  }
  // ---------------------------------------------------------------------------
  // State snapshot
  // ---------------------------------------------------------------------------
  /**
   * Returns game-specific state merged with base state.
   * Computes ghost piece Y position so the renderer doesn't need
   * collision logic.
   *
   * @returns {Object} Complete state snapshot for renderer
   */
  getState() {
    let ghostY = this.current?.y ?? 0;
    if (this.current) {
      while (this.canPlace(this.current.shape, this.current.x, ghostY + 1)) {
        ghostY++;
      }
    }
    return {
      ...super.getState(),
      level: this.level,
      lines: this.lines,
      grid: this.grid,
      current: this.current,
      ghostY,
      clearingRows: this.clearingRows,
      clearTimer: this.clearTimer
    };
  }
  // ---------------------------------------------------------------------------
  // Piece management
  // ---------------------------------------------------------------------------
  /**
   * Spawns the next piece from the bag. Game over if it can't be placed.
   *
   * @private
   */
  _spawnPiece() {
    if (this.bag.length === 0) {
      this.bag = this._shuffleBag();
    }
    const name = this.bag.pop();
    const piece = PIECES[name];
    const shape = piece.shape.map((row) => [...row]);
    const x = Math.floor((GRID_COLS - shape[0].length) / 2);
    const y = 0;
    if (!this.canPlace(shape, x, y)) {
      this.setPhase(PHASE3.DEAD);
      return;
    }
    this.current = { type: name, shape, color: piece.color, x, y };
    this.dropTimer = 0;
    this.lockTimer = 0;
    this.isLocking = false;
  }
  /**
   * 7-bag randomizer: shuffles all 7 piece names.
   * Each piece appears exactly once per bag.
   *
   * @private
   * @returns {string[]}
   */
  _shuffleBag() {
    const bag = [...PIECE_NAMES];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
  }
  /**
   * Locks the current piece into the grid, checks for line clears.
   *
   * @private
   */
  _lockPiece() {
    if (!this.current) return;
    const { shape, color, x, y } = this.current;
    for (let row = 0; row < shape.length; row++) {
      for (let col = 0; col < shape[row].length; col++) {
        if (shape[row][col]) {
          const gridRow = y + row;
          const gridCol = x + col;
          if (gridRow >= 0 && gridRow < GRID_ROWS && gridCol >= 0 && gridCol < GRID_COLS) {
            this.grid[gridRow][gridCol] = color;
          }
        }
      }
    }
    this.current = null;
    this.isLocking = false;
    this.lockTimer = 0;
    const fullRows = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      if (this.grid[row].every((cell) => cell !== null)) {
        fullRows.push(row);
      }
    }
    if (fullRows.length > 0) {
      this.addScore(LINE_CLEAR_SCORES[fullRows.length] * (this.level + 1));
      this.lines += fullRows.length;
      this.level = Math.floor(this.lines / LINES_PER_LEVEL);
      this.clearingRows = fullRows;
      this.clearTimer = 0.25;
    } else {
      this._spawnPiece();
    }
  }
  /**
   * Removes cleared rows and shifts everything above down.
   *
   * @private
   */
  _removeClearedRows() {
    const rows = [...this.clearingRows].sort((a, b) => b - a);
    for (const row of rows) {
      this.grid.splice(row, 1);
      this.grid.unshift(Array(GRID_COLS).fill(null));
    }
  }
  // ---------------------------------------------------------------------------
  // Collision detection
  // ---------------------------------------------------------------------------
  /**
   * Checks if a piece shape can be placed at the given grid position.
   * Public so getState() can compute ghost piece Y without duplicating
   * collision logic in the renderer.
   *
   * @param {number[][]} shape - Piece matrix
   * @param {number} px - Grid column
   * @param {number} py - Grid row
   * @returns {boolean}
   */
  canPlace(shape, px, py) {
    for (let row = 0; row < shape.length; row++) {
      for (let col = 0; col < shape[row].length; col++) {
        if (!shape[row][col]) continue;
        const gridRow = py + row;
        const gridCol = px + col;
        if (gridCol < 0 || gridCol >= GRID_COLS || gridRow >= GRID_ROWS) return false;
        if (gridRow < 0) continue;
        if (this.grid[gridRow][gridCol] !== null) return false;
      }
    }
    return true;
  }
  // ---------------------------------------------------------------------------
  // Rotation
  // ---------------------------------------------------------------------------
  /**
   * Rotates a piece matrix 90 degrees clockwise.
   * Transpose + reverse each row.
   *
   * @private
   * @param {number[][]} matrix
   * @returns {number[][]}
   */
  _rotateMatrix(matrix) {
    const size = matrix.length;
    const rotated = Array.from({ length: size }, () => Array(size).fill(0));
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        rotated[col][size - 1 - row] = matrix[row][col];
      }
    }
    return rotated;
  }
  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  /**
   * Gets the current drop interval based on level.
   *
   * @private
   * @returns {number}
   */
  _getDropInterval() {
    if (this.level < DROP_INTERVALS.length) {
      return DROP_INTERVALS[this.level];
    }
    return 0.017;
  }
  /**
   * Resets lock timer if piece is in locking state.
   * Called when player successfully moves or rotates during lock delay.
   *
   * @private
   */
  _resetLockIfLocking() {
    if (this.isLocking) {
      this.lockTimer = 0;
    }
  }
};
/** @type {string[]} Game phases for the phase machine. */
__publicField(OverboardEngine, "phases", ["START", "PLAYING", "DEAD"]);

// src/games/overboard/renderer.js
var OverboardRenderer = class {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.canvas.width = CANVAS_WIDTH3;
    this.canvas.height = CANVAS_HEIGHT3;
    this.ctx = canvas.getContext("2d");
    this._oceanGradient = this.ctx.createLinearGradient(0, WATERLINE_Y2, 0, CANVAS_HEIGHT3);
    this._oceanGradient.addColorStop(0, COLORS3.oceanTop);
    this._oceanGradient.addColorStop(1, COLORS3.oceanBottom);
    this._skyGradient = this.ctx.createLinearGradient(0, 0, 0, WATERLINE_Y2);
    this._skyGradient.addColorStop(0, COLORS3.skyTop);
    this._skyGradient.addColorStop(1, COLORS3.skyBottom);
  }
  // ---------------------------------------------------------------------------
  // Main draw
  // ---------------------------------------------------------------------------
  /**
   * Main render method -- draws all game elements for one frame.
   *
   * @param {Object} state - State snapshot from engine.getState()
   */
  draw(state) {
    this._drawBackground();
    this._drawSky(state.frameCount);
    this._drawSurfaceWaves(state.frameCount);
    this._drawDory(state.frameCount);
    this._drawFisher(state.frameCount);
    this._drawGrid();
    this._drawLockedBlocks(state.grid);
    this._drawClearAnimation(state.clearingRows, state.clearTimer);
    if (state.current) {
      this._drawGhostPiece(state);
      this._drawCurrentPiece(state.current);
    }
    this._drawHUD(state);
    if (state.phase === PHASE3.START) {
      this._drawStartScreen();
    } else if (state.phase === PHASE3.DEAD) {
      this._drawGameOver(state);
    }
    this._lastState = state;
  }
  /**
   * Draws the game-over overlay with score and leaderboard.
   *
   * Called by the base controller after score submission
   * and leaderboard fetch complete.
   *
   * @param {number} score
   * @param {Array<{user_name: string, score: number}>} leaderboard
   * @param {boolean} isNewHighScore
   */
  drawGameOverWithLeaderboard(score, leaderboard, isNewHighScore) {
    if (this._lastState) {
      this.draw({ ...this._lastState, phase: "PLAYING" });
    }
    const cx = GRID_COLS * CELL_SIZE / 2;
    drawLeaderboardOverlay(this.ctx, {
      score,
      leaderboard,
      isNewHighScore,
      canvasWidth: CANVAS_WIDTH3,
      canvasHeight: CANVAS_HEIGHT3,
      colors: COLORS3,
      font: UI_FONT4,
      layout: {
        cx,
        headingY: 160,
        headingSize: 28,
        highScoreY: 185,
        highScoreSize: 14,
        scoreY: 230,
        scoreSize: 36,
        tableHeaderY: 265,
        tableHeaderSize: 12,
        tableStartY: 285,
        tableRowHeight: 18,
        tableEntrySize: 12,
        nameX: 60,
        scoreX: CANVAS_WIDTH3 - 60,
        hintSize: 12
      }
    });
  }
  // ---------------------------------------------------------------------------
  // Background & grid
  // ---------------------------------------------------------------------------
  /** @private Draws the ocean gradient background below the waterline. */
  _drawBackground() {
    this.ctx.fillStyle = this._oceanGradient;
    this.ctx.fillRect(0, WATERLINE_Y2, CANVAS_WIDTH3, CANVAS_HEIGHT3 - WATERLINE_Y2);
  }
  /**
   * @private Draws the overcast sky above the waterline.
   * @param {number} frameCount - Frame counter from engine state
   */
  _drawSky(frameCount) {
    const ctx = this.ctx;
    ctx.fillStyle = this._skyGradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH3, WATERLINE_Y2);
    ctx.fillStyle = COLORS3.cloud;
    const t = frameCount * 0.15;
    this._drawCloud(40 + t % (CANVAS_WIDTH3 + 120) - 60, 14, 30, 10);
    this._drawCloud(180 + t * 0.6 % (CANVAS_WIDTH3 + 120) - 60, 22, 24, 8);
    this._drawCloud(300 + t * 0.8 % (CANVAS_WIDTH3 + 120) - 60, 10, 35, 11);
  }
  /** @private Draws a cloud blob. Delegates to shared drawCloud. */
  _drawCloud(x, y, w, h) {
    drawCloud(this.ctx, x, y, w, h);
  }
  /**
   * @private Draws animated wave crests at the waterline.
   * @param {number} frameCount - Frame counter from engine state
   */
  _drawSurfaceWaves(frameCount) {
    drawWaves(this.ctx, WATERLINE_Y2, WAVE_AMPLITUDE2, CANVAS_WIDTH3, frameCount, COLORS3, {
      foamSpacing: 60,
      foamWidth: 10,
      foamHeight: 1.5,
      bottomExtend: 8
    });
  }
  /**
   * @private Draws the dory (small boat) bobbing on the waves.
   * @param {number} frameCount - Frame counter from engine state
   */
  _drawDory(frameCount) {
    const bob = Math.sin(frameCount * 0.04) * 1.5;
    drawDory(this.ctx, DORY_X2, DORY_Y2 + bob, 0.7, COLORS3);
    this._doryBob = bob;
  }
  /**
   * @private Draws a small fisher in yellow oilskins sitting in the dory.
   * @param {number} frameCount - Frame counter from engine state
   */
  _drawFisher(frameCount) {
    const bob = this._doryBob;
    drawFisher(this.ctx, DORY_X2, DORY_Y2 + bob, 0.7, COLORS3);
  }
  /** @private Draws the playfield grid with subtle hull lines. */
  _drawGrid() {
    const ctx = this.ctx;
    const x = PLAY_AREA_X;
    const y = PLAY_AREA_Y;
    const w = GRID_COLS * CELL_SIZE;
    const h = GRID_ROWS * CELL_SIZE;
    ctx.fillStyle = COLORS3.gridBg;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = COLORS3.plank;
    for (let row = 0; row < GRID_ROWS; row++) {
      ctx.fillRect(x, y + row * CELL_SIZE + CELL_SIZE - 1, w, 1);
    }
    ctx.strokeStyle = COLORS3.gridLine;
    ctx.lineWidth = 0.5;
    for (let col = 0; col <= GRID_COLS; col++) {
      ctx.beginPath();
      ctx.moveTo(x + col * CELL_SIZE, y);
      ctx.lineTo(x + col * CELL_SIZE, y + h);
      ctx.stroke();
    }
    for (let row = 0; row <= GRID_ROWS; row++) {
      ctx.beginPath();
      ctx.moveTo(x, y + row * CELL_SIZE);
      ctx.lineTo(x + w, y + row * CELL_SIZE);
      ctx.stroke();
    }
  }
  // ---------------------------------------------------------------------------
  // Blocks
  // ---------------------------------------------------------------------------
  /**
   * Draws all locked blocks on the grid.
   *
   * @private
   * @param {(string|null)[][]} grid
   */
  _drawLockedBlocks(grid) {
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const color = grid[row][col];
        if (color) {
          this._drawCrate(
            PLAY_AREA_X + col * CELL_SIZE,
            PLAY_AREA_Y + row * CELL_SIZE,
            color
          );
        }
      }
    }
  }
  /**
   * Draws the current falling piece.
   *
   * @private
   * @param {Object} piece - {shape, color, x, y}
   */
  _drawCurrentPiece(piece) {
    const { shape, color, x, y } = piece;
    for (let row = 0; row < shape.length; row++) {
      for (let col = 0; col < shape[row].length; col++) {
        if (shape[row][col]) {
          const drawY = y + row;
          if (drawY < 0) continue;
          this._drawCrate(
            PLAY_AREA_X + (x + col) * CELL_SIZE,
            PLAY_AREA_Y + drawY * CELL_SIZE,
            color
          );
        }
      }
    }
  }
  /**
   * Draws the ghost piece (drop shadow) showing where the piece will land.
   * Uses state.ghostY computed by the engine instead of duplicating
   * collision logic here.
   *
   * @private
   * @param {Object} state - State snapshot with current piece and ghostY
   */
  _drawGhostPiece(state) {
    const { current, ghostY } = state;
    if (!current) return;
    if (ghostY === current.y) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.2;
    for (let row = 0; row < current.shape.length; row++) {
      for (let col = 0; col < current.shape[row].length; col++) {
        if (current.shape[row][col]) {
          const drawY = ghostY + row;
          if (drawY < 0) continue;
          const px = PLAY_AREA_X + (current.x + col) * CELL_SIZE;
          const py = PLAY_AREA_Y + drawY * CELL_SIZE;
          ctx.fillStyle = current.color;
          ctx.fillRect(px + 1, py + 1, CELL_SIZE - 2, CELL_SIZE - 2);
        }
      }
    }
    ctx.restore();
  }
  /**
   * Draws a single crate block -- the basic visual unit.
   * Styled as a wooden crate with bevel highlight and shadow edge.
   *
   * @private
   * @param {number} x - Pixel X
   * @param {number} y - Pixel Y
   * @param {string} color - Fill color
   */
  _drawCrate(x, y, color) {
    const ctx = this.ctx;
    const s = CELL_SIZE;
    const inset = 1;
    ctx.fillStyle = color;
    ctx.fillRect(x + inset, y + inset, s - inset * 2, s - inset * 2);
    ctx.fillStyle = COLORS3.crateBevel;
    ctx.fillRect(x + inset, y + inset, s - inset * 2, 2);
    ctx.fillRect(x + inset, y + inset, 2, s - inset * 2);
    ctx.fillStyle = COLORS3.crateShadow;
    ctx.fillRect(x + inset, y + s - inset - 2, s - inset * 2, 2);
    ctx.fillRect(x + s - inset - 2, y + inset, 2, s - inset * 2);
    ctx.fillStyle = COLORS3.crateGrain;
    ctx.fillRect(x + 4, y + Math.floor(s / 2), s - 8, 1);
  }
  // ---------------------------------------------------------------------------
  // Clear animation
  // ---------------------------------------------------------------------------
  /**
   * Draws a flash on rows being cleared.
   *
   * @private
   * @param {number[]} clearingRows
   * @param {number} clearTimer
   */
  _drawClearAnimation(clearingRows, clearTimer) {
    if (!clearingRows || clearingRows.length === 0 || clearTimer <= 0) return;
    const ctx = this.ctx;
    const alpha = clearTimer / 15;
    ctx.save();
    ctx.globalAlpha = alpha * 0.6;
    ctx.fillStyle = COLORS3.clearFlash;
    for (const row of clearingRows) {
      ctx.fillRect(
        PLAY_AREA_X,
        PLAY_AREA_Y + row * CELL_SIZE,
        GRID_COLS * CELL_SIZE,
        CELL_SIZE
      );
    }
    ctx.restore();
  }
  // ---------------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------------
  /**
   * Draws the score/level/lines HUD.
   * Positioned in the right margin area alongside the grid.
   *
   * @private
   * @param {Object} state - State snapshot from engine
   */
  _drawHUD(state) {
    const ctx = this.ctx;
    const rightX = GRID_COLS * CELL_SIZE + 10;
    const topY = PLAY_AREA_Y + 10;
    ctx.fillStyle = COLORS3.gold;
    ctx.font = `bold 11px ${UI_FONT4}`;
    ctx.textAlign = "left";
    ctx.fillText("OVERBOARD!", rightX, topY);
    ctx.fillStyle = COLORS3.text;
    ctx.font = `bold 9px ${UI_FONT4}`;
    ctx.fillText("SCORE", rightX, topY + 25);
    ctx.font = `bold 14px ${UI_FONT4}`;
    ctx.fillText(`${state.score}`, rightX, topY + 42);
    ctx.font = `bold 9px ${UI_FONT4}`;
    ctx.fillText("LEVEL", rightX, topY + 70);
    ctx.font = `bold 14px ${UI_FONT4}`;
    ctx.fillText(`${state.level}`, rightX, topY + 87);
    ctx.font = `bold 9px ${UI_FONT4}`;
    ctx.fillText("LINES", rightX, topY + 115);
    ctx.font = `bold 14px ${UI_FONT4}`;
    ctx.fillText(`${state.lines}`, rightX, topY + 132);
  }
  // ---------------------------------------------------------------------------
  // Screens
  // ---------------------------------------------------------------------------
  /** @private Draws the start screen overlay. */
  _drawStartScreen() {
    const cx = GRID_COLS * CELL_SIZE / 2;
    drawStartScreen(this.ctx, {
      title: "OVERBOARD!",
      lines: [
        { text: "Stack the cargo.", size: 14 },
        { text: "Don't let it reach the deck.", size: 14 },
        { text: "" },
        { text: "\u2190\u2192 Move  \u2191 Rotate  \u2193 Drop", size: 11 },
        { text: "SPACE Hard drop  Q Quit", size: 11 }
      ],
      startPrompt: "Press any arrow to start",
      canvasWidth: CANVAS_WIDTH3,
      canvasHeight: CANVAS_HEIGHT3,
      colors: COLORS3,
      font: UI_FONT4,
      layout: {
        cx,
        titleY: 220,
        titleSize: 28,
        descY: 255,
        descSize: 14,
        descGap: 20,
        promptY: 390,
        promptSize: 16,
        hintY: 415
      }
    });
  }
  /**
   * Draws the basic game-over overlay (before leaderboard loads).
   *
   * @private
   * @param {Object} state - State snapshot from engine
   */
  _drawGameOver(state) {
    const cx = GRID_COLS * CELL_SIZE / 2;
    drawBasicGameOver(this.ctx, {
      score: state.score,
      canvasWidth: CANVAS_WIDTH3,
      canvasHeight: CANVAS_HEIGHT3,
      colors: COLORS3,
      font: UI_FONT4,
      layout: {
        cx,
        headingY: 200,
        headingSize: 28,
        scoreY: 255,
        scoreSize: 40,
        hintSize: 12
      }
    });
  }
};

// src/games/woodpile/config.js
var config_exports4 = {};
__export(config_exports4, {
  AUTOSAVE_INTERVAL: () => AUTOSAVE_INTERVAL,
  CANVAS_HEIGHT: () => CANVAS_HEIGHT4,
  CANVAS_WIDTH: () => CANVAS_WIDTH4,
  COLORS: () => COLORS4,
  PHASE: () => PHASE4,
  TIERS: () => TIERS,
  UI_FONT: () => UI_FONT5
});
var CANVAS_WIDTH4 = 700;
var CANVAS_HEIGHT4 = 420;
var PHASE4 = Object.freeze({
  START: "START",
  PLAYING: "PLAYING"
});
var TIERS = [
  { name: "Bucksaw", era: 1, perClick: 1, idleRate: 0, threshold: 50, tool: "bucksaw" },
  { name: "Axe", era: 1, perClick: 3, idleRate: 0, threshold: 200, tool: "axe" },
  { name: "Splitting Maul", era: 1, perClick: 8, idleRate: 0.5, threshold: 800, tool: "maul" },
  { name: "Chainsaw", era: 2, perClick: 20, idleRate: 3, threshold: 3e3, tool: "chainsaw" },
  { name: "Hydraulic Splitter", era: 2, perClick: 50, idleRate: 12, threshold: 12e3, tool: "splitter" },
  { name: "Pickup Truck", era: 2, perClick: 120, idleRate: 40, threshold: 5e4, tool: "truck" },
  { name: "Hire a Buddy", era: 2, perClick: 250, idleRate: 90, threshold: 12e4, tool: "buddy" },
  { name: "Boom Truck", era: 3, perClick: 600, idleRate: 250, threshold: 4e5, tool: "boomtruck" },
  { name: "Skidder", era: 3, perClick: 1500, idleRate: 700, threshold: 15e5, tool: "skidder" },
  { name: "Feller Buncher", era: 3, perClick: 4e3, idleRate: 2e3, threshold: 6e6, tool: "feller" },
  { name: "Pulp Contract", era: 4, perClick: 1e4, idleRate: 6e3, threshold: 25e6, tool: "harvester" },
  { name: "Da Big Contract", era: 4, perClick: 3e4, idleRate: 2e4, threshold: Infinity, tool: "bigcontract" }
];
var AUTOSAVE_INTERVAL = 3e4;
var COLORS4 = {
  ...SHARED_COLORS,
  // Era 1: Spring morning
  sky1Top: "#87CEEB",
  sky1Bottom: "#B0D4E8",
  ground1: "#3D6B35",
  // Era 2: Working day
  sky2Top: "#5B9BD5",
  sky2Bottom: "#A8C8E0",
  ground2: "#4A7A42",
  // Era 3: Overcast industrial
  sky3Top: "#4A6D8C",
  sky3Bottom: "#8BA8C2",
  ground3: "#5A5A4A",
  // Era 4: Epic scale
  sky4Top: "#2C3E50",
  sky4Bottom: "#5D7B93",
  ground4: "#4A5A50",
  // Trees
  treeTrunk: "#5A3A1A",
  treeGreen: "#2D5A27",
  treeDark: "#2D4A2A",
  // Character
  flannel: "#C0392B",
  flannelDark: "#2C2C2C",
  skin: "#E8C39E",
  toque: "#E74C3C",
  jeans: "#3A5A8C",
  boots: "#4A3520",
  // Wood
  logBark: "#8B7355",
  logRings: "#A08060",
  logCenter: "#6B5335",
  // UI
  progressTrack: "#2A2A3A",
  progressFill1: ["#4CAF50", "#8BC34A"],
  progressFill2: ["#2196F3", "#03A9F4"],
  progressFill3: ["#FF9800", "#FFC107"],
  progressFill4: ["#F44336", "#FF5722"],
  // Particles
  woodChips: ["#8B6914", "#A08040", "#C0A050", "#6B5010"],
  metalChips: ["#888", "#AAA", "#666"]
};
var UI_FONT5 = UI_FONT;

// src/games/woodpile/engine.js
var WoodpileEngine = class extends BaseEngine {
  reset() {
    super.reset();
    this.logs = 0;
    this.tierIndex = 0;
    this.clickAnim = 0;
    this.shakeTimer = 0;
    this.transformTimer = 0;
    this.idleAccum = 0;
    this.idleEarned = 0;
    this.totalClicks = 0;
  }
  /** Load saved state from server. */
  loadState(serverState) {
    if (!serverState) return;
    this.logs = serverState.logs || 0;
    this.tierIndex = serverState.tier_index || 0;
    this.idleEarned = serverState.idle_earned || 0;
    if (this.tierIndex >= TIERS.length) {
      this.tierIndex = TIERS.length - 1;
    }
  }
  /** Return state for server save. */
  getSaveState() {
    const tier = TIERS[this.tierIndex];
    return {
      tier_index: this.tierIndex,
      logs: Math.floor(this.logs),
      idle_rate: tier.idleRate
    };
  }
  /** Current tier object. */
  get tier() {
    return TIERS[this.tierIndex];
  }
  /** Current era number. */
  get era() {
    return this.tier.era;
  }
  /** Handle a click/tap — add logs, trigger animations. */
  chop() {
    if (this.phase === PHASE4.START) {
      this.setPhase(PHASE4.PLAYING);
      return;
    }
    if (this.phase !== PHASE4.PLAYING) return;
    this.logs += this.tier.perClick;
    this.clickAnim = 0.25;
    this.shakeTimer = 0.05;
    this.totalClicks++;
    this.idleEarned = 0;
    if (this.particles) {
      const colors = this.era >= 3 ? COLORS4.metalChips : COLORS4.woodChips;
      this.particles.emit({
        x: CANVAS_WIDTH4 * 0.35,
        y: 280,
        count: 6,
        speed: [120, 300],
        lifetime: [0.333, 0.583],
        colors,
        spread: Math.PI * 1.5,
        angle: -Math.PI / 2,
        gravity: 540,
        size: 3
      });
    }
    this._checkTierUp();
  }
  /**
   * Advance game state by one tick.
   *
   * @param {number} dt - Delta time in seconds since last frame.
   */
  update(dt) {
    if (this.phase !== PHASE4.PLAYING) return;
    const idleRate = this.tier.idleRate;
    if (idleRate > 0) {
      this.idleAccum += idleRate * dt;
      if (this.idleAccum >= 1) {
        const earned = Math.floor(this.idleAccum);
        this.logs += earned;
        this.idleAccum -= earned;
      }
    }
    if (this.clickAnim > 0) this.clickAnim -= dt;
    if (this.shakeTimer > 0) this.shakeTimer -= 0.5 * dt;
    if (this.transformTimer > 0) this.transformTimer -= dt;
    if (this.particles) this.particles.update(dt);
    this._checkTierUp();
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
      particles: this.particles ? this.particles.particles : []
    };
  }
  /** This game never ends — override canRestart to always return false. */
  canRestart() {
    return false;
  }
  /** Reset all progress back to tier 0. */
  resetProgress() {
    this.logs = 0;
    this.tierIndex = 0;
    this.idleAccum = 0;
    this.idleEarned = 0;
    this.totalClicks = 0;
    this.transformTimer = 0;
  }
  /**
   * Debug: jump to a specific tier index.
   * Sets logs to just above that tier's threshold.
   *
   * @param {number} index - Tier index (0-11)
   */
  jumpToTier(index) {
    if (index < 0 || index >= TIERS.length) return;
    this.tierIndex = index;
    this.logs = index > 0 ? TIERS[index - 1].threshold : 0;
    this.transformTimer = 1;
    this.shakeTimer = 0.167;
  }
  // ---
  _checkTierUp() {
    const tier = this.tier;
    if (this.logs >= tier.threshold && this.tierIndex < TIERS.length - 1) {
      this.tierIndex++;
      this.transformTimer = 1;
      this.shakeTimer = 0.167;
      if (this.particles) {
        const colors = this.era >= 3 ? COLORS4.metalChips : COLORS4.woodChips;
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
            size: 4
          });
        }
      }
    }
  }
};
__publicField(WoodpileEngine, "phases", ["START", "PLAYING"]);

// src/games/woodpile/renderer.js
var VEHICLE_TOOLS = /* @__PURE__ */ new Set([
  "splitter",
  "truck",
  "boomtruck",
  "skidder",
  "feller",
  "harvester",
  "bigcontract"
]);
var ERA_NAMES = {
  1: "Up the Brook",
  2: "Sellin' to the Neighbours",
  3: "Pulp & Paper",
  4: "Da Big Contract"
};
function formatNumber(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return Math.floor(n).toLocaleString();
}
var WoodpileRenderer = class {
  /**
   * Creates a new renderer bound to the given canvas.
   *
   * @param {HTMLCanvasElement} canvas - The canvas element to draw on
   */
  constructor(canvas) {
    this.canvas = canvas;
    canvas.width = CANVAS_WIDTH4;
    canvas.height = CANVAS_HEIGHT4;
    this.ctx = canvas.getContext("2d");
    this._lastState = null;
    this.forestLayers = [];
    this._initForest();
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
      { color: "#2D5A27", highlight: "#366830", minH: 45, maxH: 85, density: 8 }
    ];
    for (const layer of layers) {
      const trees = [];
      const spacing = CANVAS_WIDTH4 / layer.density;
      for (let i = 0; i < layer.density + 4; i++) {
        trees.push({
          x: i * spacing + (Math.random() - 0.5) * spacing * 0.6,
          h: layer.minH + Math.random() * (layer.maxH - layer.minH),
          w: 14 + Math.random() * 12
        });
      }
      this.forestLayers.push({
        trees,
        color: layer.color,
        highlight: layer.highlight
      });
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
    this._lastState = state;
    this._drawScene(state);
    if (state.phase === PHASE4.START) {
      this._drawStartScreen();
    }
  }
  /**
   * Draws the game scene without overlays.
   *
   * @private
   * @param {Object} state
   */
  _drawScene(state) {
    const ctx = this.ctx;
    const era = state.era;
    const shaking = state.shakeTimer > 0;
    if (shaking) {
      const intensity = Math.min(state.shakeTimer, 3);
      const sx = (Math.random() - 0.5) * intensity * 0.5;
      const sy = (Math.random() - 0.5) * intensity * 0.5;
      ctx.save();
      ctx.translate(sx, sy);
    }
    this._drawSky(era);
    this._drawForest(era);
    this._drawClouds(state.frameCount);
    this._drawGround(era);
    this._drawEraDetails(era);
    this._drawCharacterAndTool(state);
    this._drawWoodpile(state.logs, state.tierIndex, state.tier);
    this._drawParticles(state.particles);
    if (shaking) ctx.restore();
    this._drawLogCounter(state.logs, era);
    this._drawEraBanner(era);
    this._drawCurrentTier(state.tier);
    this._drawIdleIndicator(state.tier);
    this._drawProgressBar(state);
    this._drawTransformFlash(state);
    this._drawIdleEarnings(state);
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
      this._drawScene(this._lastState);
    }
    drawLeaderboardOverlay(this.ctx, {
      score,
      leaderboard,
      isNewHighScore,
      canvasWidth: CANVAS_WIDTH4,
      canvasHeight: CANVAS_HEIGHT4,
      colors: COLORS4,
      font: UI_FONT5
    });
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
    const ctx = this.ctx;
    const topKey = `sky${era}Top`;
    const bottomKey = `sky${era}Bottom`;
    const grad = ctx.createLinearGradient(0, 0, 0, 260);
    grad.addColorStop(0, COLORS4[topKey] || COLORS4.sky1Top);
    grad.addColorStop(1, COLORS4[bottomKey] || COLORS4.sky1Bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_WIDTH4, 260);
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
    const layersToShow = { 1: 4, 2: 4, 3: 3, 4: 2 };
    const count = layersToShow[era] || 4;
    for (let l = 0; l < count; l++) {
      const layer = this.forestLayers[l];
      const skipRate = era >= 3 ? 0.3 : 0;
      for (const tree of layer.trees) {
        if (skipRate > 0 && this._hash(tree.x) < skipRate) continue;
        if (tree.x + tree.w < 0 || tree.x > CANVAS_WIDTH4) continue;
        this._drawSpruce(tree.x, 260, tree.h, tree.w, layer.color, layer.highlight);
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
    const n = Math.sin(x * 127.1) * 43758.5453;
    return n - Math.floor(n);
  }
  /**
   * Draws a single spruce tree silhouette with 3 layered triangles.
   *
   * @private
   */
  _drawSpruce(x, baseY, h, w, color, highlight) {
    drawSpruce(this.ctx, x, baseY, h, w, color, highlight, COLORS4.treeTrunk);
  }
  /**
   * Draws drifting clouds.
   *
   * @private
   * @param {number} frameCount
   */
  _drawClouds(frameCount) {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, CANVAS_WIDTH4, 255);
    ctx.clip();
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    for (let i = 0; i < 3; i++) {
      const x = (frameCount * 0.01 * (i + 1) * 0.5 + i * 250) % (CANVAS_WIDTH4 + 100) - 50;
      const y = 30 + i * 35;
      const size = 30 + i * 10;
      ctx.beginPath();
      ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
      ctx.arc(x + size * 0.4, y - size * 0.15, size * 0.4, 0, Math.PI * 2);
      ctx.arc(x + size * 0.8, y, size * 0.35, 0, Math.PI * 2);
      ctx.arc(x + size * 0.35, y + size * 0.1, size * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  /**
   * Draws the ground plane with grass texture.
   *
   * @private
   * @param {number} era
   */
  _drawGround(era) {
    const ctx = this.ctx;
    const groundKey = `ground${era}`;
    ctx.fillStyle = COLORS4[groundKey] || COLORS4.ground1;
    ctx.fillRect(0, 260, CANVAS_WIDTH4, CANVAS_HEIGHT4 - 260);
    ctx.strokeStyle = "rgba(0,0,0,0.1)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 20; i++) {
      const x = (i * 37 + 10) % CANVAS_WIDTH4;
      const y = 270 + Math.sin(i * 2.3) * 30 + 40;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 8, y - 5);
      ctx.stroke();
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
      this._drawChoppingBlock(230, 280);
    } else if (era === 2) {
      this._drawHouseAndFence();
    } else if (era === 3) {
      this._drawLogDeck();
    } else if (era === 4) {
      this._drawPowerLines();
    }
  }
  /** @private Draws a chopping block stump. */
  _drawChoppingBlock(x, y) {
    const ctx = this.ctx;
    ctx.fillStyle = "#8B6914";
    ctx.beginPath();
    ctx.ellipse(x, y, 16, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7A5A10";
    ctx.fillRect(x - 16, y, 32, 20);
    ctx.fillStyle = "#6A4A08";
    ctx.beginPath();
    ctx.ellipse(x, y + 20, 16, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#9A7A20";
    ctx.beginPath();
    ctx.ellipse(x, y, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#7A5A10";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.ellipse(x, y, 8, 3, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  /** @private Draws house and fence for era 2. */
  _drawHouseAndFence() {
    const ctx = this.ctx;
    ctx.strokeStyle = "#8B7355";
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const x = 420 + i * 25;
      ctx.beginPath();
      ctx.moveTo(x, 255);
      ctx.lineTo(x, 300);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(420, 270);
    ctx.lineTo(495, 270);
    ctx.moveTo(420, 290);
    ctx.lineTo(495, 290);
    ctx.stroke();
    ctx.fillStyle = "#8B4513";
    ctx.fillRect(440, 200, 60, 55);
    ctx.fillStyle = "#A0522D";
    ctx.beginPath();
    ctx.moveTo(435, 200);
    ctx.lineTo(470, 175);
    ctx.lineTo(505, 200);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#A8D8EA";
    ctx.fillRect(455, 215, 15, 15);
    ctx.fillRect(475, 215, 15, 15);
  }
  /** @private Draws landing/log deck for era 3. */
  _drawLogDeck() {
    const ctx = this.ctx;
    ctx.fillStyle = "#5A4A30";
    ctx.fillRect(380, 270, 120, 8);
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = "#7A6040";
        ctx.fillRect(385 + i * 14, 250 - row * 10, 12, 8);
        ctx.fillStyle = "#8B7355";
        ctx.beginPath();
        ctx.ellipse(385 + i * 14, 254 - row * 10, 1.5, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  /** @private Draws power line towers and cleared corridor for era 4. */
  _drawPowerLines() {
    const ctx = this.ctx;
    ctx.fillStyle = "#6B7B5A";
    ctx.fillRect(380, 260, 320, CANVAS_HEIGHT4 - 260);
    for (let i = 0; i < 3; i++) {
      const x = 400 + i * 100;
      ctx.strokeStyle = "#555";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, 260);
      ctx.lineTo(x, 160 - i * 15);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 15, 170 - i * 15);
      ctx.lineTo(x + 15, 170 - i * 15);
      ctx.moveTo(x - 12, 185 - i * 15);
      ctx.lineTo(x + 12, 185 - i * 15);
      ctx.stroke();
      if (i < 2) {
        ctx.strokeStyle = "#444";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 15, 170 - i * 15);
        ctx.quadraticCurveTo(x + 50, 190 - i * 15, x + 100 - 15, 170 - (i + 1) * 15);
        ctx.stroke();
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
    const era = state.era;
    const tool = state.tier.tool;
    const charX = era <= 2 ? 180 : 150;
    const charY = era <= 1 ? 260 : 265;
    if (tool === "buddy") {
      this._drawCharacter(charX - 20, charY, "axe", state.frameCount, state.clickAnim);
      this._drawBuddy(charX + 40, charY, state.frameCount);
    } else if (VEHICLE_TOOLS.has(tool)) {
      this.ctx.save();
      this.ctx.translate(charX + 40, charY + 15);
      this.ctx.scale(1.8, 1.8);
      this._drawTool(0, 0, tool);
      this.ctx.restore();
      this._drawCharacter(charX - 30, charY, null, state.frameCount, state.clickAnim);
    } else {
      this._drawCharacter(charX, charY, tool, state.frameCount, state.clickAnim);
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
    const ctx = this.ctx;
    const bob = Math.sin(opts.frameCount * 0.05 + (opts.bobPhase || 0)) * 2;
    const chopSwing = (opts.clickAnim || 0) > 0 ? Math.sin(opts.clickAnim * 0.3) * 25 : 0;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.beginPath();
    ctx.ellipse(0, 45, 20, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = opts.pants;
    ctx.fillRect(-8, 20, 6, 24);
    ctx.fillRect(2, 20, 6, 24);
    ctx.fillStyle = COLORS4.boots;
    ctx.fillRect(-10, 40, 9, 6);
    ctx.fillRect(1, 40, 9, 6);
    ctx.fillStyle = opts.flannel;
    ctx.fillRect(-10, -5, 20, 26);
    ctx.fillStyle = opts.flannelDark;
    ctx.fillRect(-10, 0, 20, 2);
    ctx.fillRect(-10, 8, 20, 2);
    ctx.fillRect(-10, 16, 20, 2);
    ctx.fillRect(-4, -5, 2, 26);
    ctx.fillRect(4, -5, 2, 26);
    ctx.fillStyle = COLORS4.skin;
    ctx.beginPath();
    ctx.arc(0, -14, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = opts.toque;
    ctx.beginPath();
    ctx.arc(0, -22, 8, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-8, -24, 16, 4);
    ctx.fillStyle = "#FFF";
    ctx.beginPath();
    ctx.arc(0, -27, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#333";
    ctx.fillRect(-4, -16, 2, 2);
    ctx.fillRect(2, -16, 2, 2);
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, -12, 4, 0.1, Math.PI - 0.1);
    ctx.stroke();
    if (opts.tool) {
      ctx.save();
      ctx.translate(12, 2);
      ctx.rotate(chopSwing * Math.PI / 180);
      ctx.fillStyle = COLORS4.skin;
      ctx.fillRect(0, -2, 18, 5);
      this._drawTool(18, 0, opts.tool);
      ctx.restore();
    } else {
      ctx.fillStyle = COLORS4.skin;
      ctx.fillRect(10, 0, 12, 5);
    }
    ctx.fillStyle = COLORS4.skin;
    ctx.fillRect(-16, 0, 14, 5);
    ctx.restore();
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
      flannel: COLORS4.flannel,
      flannelDark: COLORS4.flannelDark,
      pants: COLORS4.jeans,
      toque: COLORS4.toque,
      tool: toolType,
      frameCount,
      clickAnim
    });
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
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    switch (type) {
      case "bucksaw":
        this._drawBucksaw();
        break;
      case "axe":
        this._drawAxe();
        break;
      case "maul":
        this._drawMaul();
        break;
      case "chainsaw":
        this._drawChainsaw();
        break;
      case "splitter":
        this._drawSplitter();
        break;
      case "truck":
        this._drawTruck();
        break;
      case "boomtruck":
        this._drawBoomTruck();
        break;
      case "skidder":
        this._drawSkidder();
        break;
      case "feller":
        this._drawFellerBuncher();
        break;
      case "harvester":
        this._drawHarvester();
        break;
      case "bigcontract":
        this._drawBigContract();
        break;
    }
    ctx.restore();
  }
  /** @private */
  _drawBucksaw() {
    const ctx = this.ctx;
    ctx.fillStyle = "#8B6914";
    ctx.fillRect(0, -2, 30, 4);
    ctx.fillStyle = "#C0C0C0";
    ctx.fillRect(8, 2, 20, 2);
    ctx.strokeStyle = "#A0A0A0";
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(10 + i * 2.2, 4);
      ctx.lineTo(11 + i * 2.2, 6);
      ctx.stroke();
    }
    ctx.strokeStyle = "#8B6914";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(6, -2);
    ctx.lineTo(6, -12);
    ctx.lineTo(28, -12);
    ctx.lineTo(28, -2);
    ctx.stroke();
  }
  /** @private */
  _drawAxe() {
    const ctx = this.ctx;
    ctx.fillStyle = "#8B6914";
    ctx.fillRect(0, -2, 34, 4);
    ctx.fillStyle = "#707070";
    ctx.beginPath();
    ctx.moveTo(28, -4);
    ctx.lineTo(36, -4);
    ctx.lineTo(38, -2);
    ctx.lineTo(40, 8);
    ctx.lineTo(36, 14);
    ctx.lineTo(32, 10);
    ctx.lineTo(30, 4);
    ctx.lineTo(28, 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#A0A0A0";
    ctx.beginPath();
    ctx.moveTo(38, -2);
    ctx.lineTo(41, 8);
    ctx.lineTo(37, 14);
    ctx.lineTo(36, 14);
    ctx.lineTo(40, 8);
    ctx.lineTo(38, -1);
    ctx.closePath();
    ctx.fill();
  }
  /** @private */
  _drawMaul() {
    const ctx = this.ctx;
    ctx.fillStyle = "#8B6914";
    ctx.fillRect(0, -2, 35, 5);
    ctx.fillStyle = "#606060";
    ctx.beginPath();
    ctx.moveTo(28, -10);
    ctx.lineTo(40, -4);
    ctx.lineTo(40, 8);
    ctx.lineTo(28, 14);
    ctx.lineTo(26, 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#505050";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(30, -6);
    ctx.lineTo(30, 10);
    ctx.moveTo(33, -5);
    ctx.lineTo(33, 9);
    ctx.stroke();
  }
  /** @private */
  _drawChainsaw() {
    const ctx = this.ctx;
    ctx.fillStyle = "#E67E22";
    ctx.beginPath();
    ctx.roundRect(0, -8, 22, 16, 3);
    ctx.fill();
    ctx.fillStyle = "#808080";
    ctx.fillRect(20, -3, 25, 6);
    ctx.strokeStyle = "#505050";
    ctx.lineWidth = 2;
    ctx.strokeRect(20, -3, 25, 6);
    ctx.beginPath();
    ctx.arc(45, 0, 3, -Math.PI / 2, Math.PI / 2);
    ctx.fillStyle = "#808080";
    ctx.fill();
    ctx.fillStyle = "#333";
    ctx.fillRect(2, 8, 8, 5);
    ctx.fillRect(12, -13, 4, 8);
    ctx.fillStyle = "#C0392B";
    ctx.beginPath();
    ctx.arc(-3, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  /** @private */
  _drawSplitter() {
    const ctx = this.ctx;
    ctx.fillStyle = "#666";
    ctx.fillRect(-5, 5, 50, 8);
    ctx.fillStyle = "#888";
    ctx.fillRect(0, -5, 8, 10);
    ctx.fillStyle = "#AAA";
    ctx.fillRect(8, -3, 15, 6);
    ctx.fillStyle = "#606060";
    ctx.beginPath();
    ctx.moveTo(23, -6);
    ctx.lineTo(28, 0);
    ctx.lineTo(23, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#8B6914";
    ctx.beginPath();
    ctx.ellipse(36, 2, 6, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#A07828";
    ctx.beginPath();
    ctx.ellipse(36, 2, 4, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  /** @private */
  _drawTruck() {
    const ctx = this.ctx;
    ctx.fillStyle = "#2C5F8A";
    ctx.fillRect(-5, -12, 35, 16);
    ctx.fillStyle = "#3A7BB8";
    ctx.fillRect(-5, -18, 16, 8);
    ctx.fillStyle = "#A8D8EA";
    ctx.fillRect(-2, -16, 10, 5);
    ctx.fillStyle = "#666";
    ctx.fillRect(12, -12, 25, 3);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = "#8B6914";
      ctx.beginPath();
      ctx.ellipse(18 + i * 5, -15, 2.5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.arc(2, 6, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(28, 6, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#666";
    ctx.beginPath();
    ctx.arc(2, 6, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(28, 6, 2, 0, Math.PI * 2);
    ctx.fill();
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
      flannel: "#2D6B2D",
      flannelDark: "#1A4A1A",
      pants: "#4A6A4A",
      toque: "#2C5F8A",
      tool: "axe",
      frameCount,
      bobPhase: 1.5
    });
  }
  /** @private */
  _drawBoomTruck() {
    const ctx = this.ctx;
    ctx.fillStyle = "#D4A017";
    ctx.fillRect(-5, -8, 30, 14);
    ctx.fillStyle = "#B8860B";
    ctx.fillRect(-5, -16, 14, 10);
    ctx.fillStyle = "#A8D8EA";
    ctx.fillRect(-2, -14, 9, 5);
    ctx.fillStyle = "#888";
    ctx.fillRect(10, -8, 28, 3);
    ctx.strokeStyle = "#D4A017";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(18, -8);
    ctx.lineTo(22, -28);
    ctx.lineTo(38, -22);
    ctx.stroke();
    ctx.strokeStyle = "#AAA";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(16, -6);
    ctx.lineTo(20, -20);
    ctx.stroke();
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(38, -22);
    ctx.lineTo(36, -16);
    ctx.moveTo(38, -22);
    ctx.lineTo(40, -16);
    ctx.stroke();
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.arc(0, 8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(15, 8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(30, 8, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  /** @private */
  _drawSkidder() {
    const ctx = this.ctx;
    ctx.fillStyle = "#2E7D32";
    ctx.fillRect(-5, -14, 35, 18);
    ctx.fillStyle = "#388E3C";
    ctx.fillRect(-2, -22, 16, 10);
    ctx.fillStyle = "#A8D8EA";
    ctx.fillRect(0, -20, 12, 6);
    ctx.fillStyle = "#888";
    ctx.beginPath();
    ctx.moveTo(30, -14);
    ctx.lineTo(40, -18);
    ctx.lineTo(42, -6);
    ctx.lineTo(30, 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(36, -12);
    ctx.lineTo(50, -8);
    ctx.lineTo(50, 4);
    ctx.stroke();
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.arc(2, 8, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(26, 8, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.arc(2, 8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(26, 8, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  /** @private */
  _drawFellerBuncher() {
    const ctx = this.ctx;
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.roundRect(-8, 2, 45, 10, 3);
    ctx.fill();
    ctx.fillStyle = "#333";
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(-5 + i * 7, 4, 4, 6);
    }
    ctx.fillStyle = "#D4A017";
    ctx.fillRect(0, -12, 25, 16);
    ctx.fillStyle = "#B8860B";
    ctx.fillRect(2, -22, 14, 12);
    ctx.fillStyle = "#A8D8EA";
    ctx.fillRect(4, -20, 10, 7);
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(25, -8);
    ctx.lineTo(38, -25);
    ctx.lineTo(48, -18);
    ctx.stroke();
    ctx.fillStyle = "#C0392B";
    ctx.beginPath();
    ctx.arc(48, -18, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#888";
    ctx.fillRect(45, -22, 6, 2);
  }
  /** @private */
  _drawHarvester() {
    const ctx = this.ctx;
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.roundRect(-10, 4, 55, 12, 4);
    ctx.fill();
    ctx.fillStyle = "#333";
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(-7 + i * 7, 6, 4, 8);
    }
    ctx.fillStyle = "#2E7D32";
    ctx.fillRect(-2, -16, 35, 22);
    ctx.fillStyle = "#388E3C";
    ctx.fillRect(0, -28, 18, 14);
    ctx.fillStyle = "#A8D8EA";
    ctx.fillRect(2, -26, 14, 9);
    ctx.strokeStyle = "#AAA";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(33, -10);
    ctx.lineTo(45, -30);
    ctx.lineTo(58, -20);
    ctx.stroke();
    ctx.fillStyle = "#D4A017";
    ctx.fillRect(52, -26, 12, 14);
    ctx.fillStyle = "#666";
    ctx.beginPath();
    ctx.arc(55, -24, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(55, -15, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#C0C0C0";
    ctx.beginPath();
    ctx.arc(61, -20, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  /** @private */
  _drawBigContract() {
    const ctx = this.ctx;
    ctx.fillStyle = "#2C3E50";
    ctx.fillRect(-5, -10, 50, 18);
    ctx.fillStyle = "#34495E";
    ctx.fillRect(-5, -18, 20, 10);
    ctx.fillStyle = "#A8D8EA";
    ctx.fillRect(-2, -16, 14, 6);
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(30, -10);
    ctx.lineTo(30, -28);
    ctx.stroke();
    ctx.fillStyle = "#C0392B";
    ctx.beginPath();
    ctx.arc(30, -28, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.arc(2, 12, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(18, 12, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(36, 12, 6, 0, Math.PI * 2);
    ctx.fill();
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
    const ctx = this.ctx;
    const logsPerRow = 6;
    const maxRows = 4;
    const maxLogs = logsPerRow * maxRows;
    const threshold = tier.threshold === Infinity ? 5e7 : tier.threshold;
    const prevThreshold = tierIndex > 0 ? TIERS[tierIndex - 1].threshold : 0;
    const progress = Math.min((logs - prevThreshold) / (threshold - prevThreshold), 1);
    const logsToDraw = Math.min(Math.floor(progress * maxLogs) + 1, maxLogs);
    const era = tier.era;
    const startX = 520;
    const baseY = 295;
    let drawn = 0;
    for (let row = 0; row < maxRows && drawn < logsToDraw; row++) {
      for (let i = 0; i < logsPerRow && drawn < logsToDraw; i++) {
        const x = startX + i * 14 + row % 2 * 7;
        const y = baseY - row * 11;
        ctx.fillStyle = COLORS4.logBark;
        ctx.beginPath();
        ctx.ellipse(x, y, 7, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = COLORS4.logRings;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.ellipse(x, y, 4, 3, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(x, y, 2, 1.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = COLORS4.logCenter;
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
        drawn++;
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
    drawParticles(this.ctx, particles);
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
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(220, 8, 260, 50, 10);
    ctx.fill();
    ctx.fillStyle = COLORS4.gold;
    ctx.font = `bold 28px ${UI_FONT5}`;
    ctx.textAlign = "center";
    ctx.fillText(formatNumber(Math.floor(logs)), 350, 38);
    ctx.fillStyle = "#AAA";
    ctx.font = `12px ${UI_FONT5}`;
    ctx.fillText(era >= 3 ? "board feet" : "logs", 350, 52);
    ctx.textAlign = "left";
  }
  /**
   * Draws the era banner — top-left.
   *
   * @private
   * @param {number} era
   */
  _drawEraBanner(era) {
    const ctx = this.ctx;
    const name = ERA_NAMES[era] || "";
    const text = `Era ${era}: ${name}`;
    ctx.font = `bold 12px ${UI_FONT5}`;
    const textWidth = ctx.measureText(text).width;
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.roundRect(10, 65, textWidth + 20, 24, 6);
    ctx.fill();
    ctx.fillStyle = "#c8a96e";
    ctx.fillText(text, 20, 82);
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
    const ctx = this.ctx;
    const text = tier.name;
    ctx.font = `bold 11px ${UI_FONT5}`;
    const textWidth = ctx.measureText(text).width;
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.roundRect(10, 94, textWidth + 20, 20, 6);
    ctx.fill();
    ctx.fillStyle = "#FFF";
    ctx.fillText(text, 20, 108);
  }
  _drawIdleIndicator(tier) {
    if (tier.idleRate <= 0) return;
    const ctx = this.ctx;
    const text = `${formatNumber(tier.idleRate)}/sec (idle)`;
    ctx.font = `11px ${UI_FONT5}`;
    const textWidth = ctx.measureText(text).width;
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.roundRect(10, 118, textWidth + 20, 20, 6);
    ctx.fill();
    ctx.fillStyle = "#8BC34A";
    ctx.fillText(text, 20, 132);
  }
  /**
   * Draws the progress bar toward next tier — bottom of screen.
   *
   * @private
   * @param {Object} state
   */
  _drawProgressBar(state) {
    const ctx = this.ctx;
    const tier = state.tier;
    const tierIndex = state.tierIndex;
    const era = state.era;
    if (tier.threshold === Infinity) {
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.beginPath();
      ctx.roundRect(180, 375, 340, 35, 8);
      ctx.fill();
      ctx.fillStyle = "#FFD700";
      ctx.font = `bold 16px ${UI_FONT5}`;
      ctx.textAlign = "center";
      ctx.fillText("DA BIG CONTRACT \u2014 You made it, b'y!", 350, 397);
      ctx.textAlign = "left";
      return;
    }
    const prevThreshold = tierIndex > 0 ? TIERS[tierIndex - 1].threshold : 0;
    const progress = Math.min((state.logs - prevThreshold) / (tier.threshold - prevThreshold), 1);
    const barX = 140;
    const barY = 385;
    const barW = 420;
    const barH = 18;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(barX - 2, barY - 2, barW + 4, barH + 4, 6);
    ctx.fill();
    ctx.fillStyle = COLORS4.progressTrack;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 4);
    ctx.fill();
    const fillKey = `progressFill${era}`;
    const [c1, c2] = COLORS4[fillKey] || COLORS4.progressFill1;
    const grad = ctx.createLinearGradient(barX, 0, barX + barW * progress, 0);
    grad.addColorStop(0, c1);
    grad.addColorStop(1, c2);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(barX, barY, Math.max(barW * progress, 8), barH, 4);
    ctx.fill();
    const next = TIERS[tierIndex + 1];
    if (next) {
      ctx.fillStyle = "#AAA";
      ctx.font = `11px ${UI_FONT5}`;
      ctx.textAlign = "center";
      ctx.fillText(`Next: ${next.name} (${formatNumber(tier.threshold)} logs)`, barX + barW / 2, barY - 6);
      ctx.textAlign = "left";
    }
    ctx.fillStyle = "#FFF";
    ctx.font = `bold 11px ${UI_FONT5}`;
    ctx.textAlign = "center";
    ctx.fillText(`${Math.floor(progress * 100)}%`, barX + barW / 2, barY + 14);
    ctx.textAlign = "left";
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
    if (state.transformTimer <= 0) return;
    const ctx = this.ctx;
    const alpha = state.transformTimer / 60;
    ctx.fillStyle = `rgba(255, 215, 0, ${alpha * 0.3})`;
    ctx.fillRect(0, 0, CANVAS_WIDTH4, CANVAS_HEIGHT4);
    if (state.transformTimer > 30) {
      const textAlpha = (state.transformTimer - 30) / 30 * 0.5;
      ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`;
      ctx.font = `bold 36px ${UI_FONT5}`;
      ctx.textAlign = "center";
      ctx.fillText(state.tier.name.toUpperCase() + "!", 350, 200);
      ctx.textAlign = "left";
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
    if (!state.idleEarned || state.idleEarned <= 0) return;
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.roundRect(100, 170, 500, 60, 10);
    ctx.fill();
    ctx.fillStyle = COLORS4.gold;
    ctx.font = `bold 20px ${UI_FONT5}`;
    ctx.textAlign = "center";
    ctx.fillText(`You earned ${formatNumber(state.idleEarned)} logs while you were gone!`, 350, 200);
    ctx.fillStyle = "#AAA";
    ctx.font = `12px ${UI_FONT5}`;
    ctx.fillText("Click to continue", 350, 220);
    ctx.textAlign = "left";
  }
  /** @private Draws the start screen overlay. */
  _drawStartScreen() {
    drawStartScreen(this.ctx, {
      title: "WOODPILE TYCOON",
      lines: [
        { text: "Click to chop. Watch it grow." },
        { text: "Progress through 12 tiers of woodcutting.", size: 14 },
        { text: "From bucksaw to da big contract.", size: 14 }
      ],
      startPrompt: "CLICK to start",
      canvasWidth: CANVAS_WIDTH4,
      canvasHeight: CANVAS_HEIGHT4,
      colors: COLORS4,
      font: UI_FONT5,
      layout: { descGap: 28, promptY: 240, hintY: 265 }
    });
  }
  // ---------------------------------------------------------------------------
  // Drawing helpers
};

// src/games/kungfu/config.js
var config_exports5 = {};
__export(config_exports5, {
  BOSS_DATA: () => BOSS_DATA,
  FLOOR_WAVES: () => FLOOR_WAVES,
  GRAVITY: () => GRAVITY2,
  GROUND_Y: () => GROUND_Y2,
  H: () => H,
  JUMP_FORCE: () => JUMP_FORCE2,
  PHASE: () => PHASE5,
  W: () => W
});
var W = 800;
var H = 500;
var GROUND_Y2 = H - 80;
var GRAVITY2 = 1200;
var JUMP_FORCE2 = -450;
var PHASE5 = Object.freeze({
  TITLE: "TITLE",
  PLAYING: "PLAYING",
  FLOOR_INTRO: "FLOOR_INTRO",
  BOSS_INTRO: "BOSS_INTRO",
  CUTSCENE: "CUTSCENE",
  GAME_OVER: "GAME_OVER",
  VICTORY: "VICTORY"
});
var FLOOR_WAVES = {
  1: [
    [{ type: "grunt", count: 2 }],
    [{ type: "grunt", count: 3 }],
    [{ type: "grunt", count: 2 }, { type: "grabber", count: 1 }]
  ],
  2: [
    [{ type: "grunt", count: 3 }],
    [{ type: "grabber", count: 1 }, { type: "knife_thrower", count: 1 }],
    [{ type: "grunt", count: 2 }, { type: "acrobat", count: 1 }],
    [{ type: "grabber", count: 1 }, { type: "knife_thrower", count: 2 }]
  ],
  3: [
    [{ type: "grunt", count: 3 }, { type: "knife_thrower", count: 1 }],
    [{ type: "acrobat", count: 2 }, { type: "grabber", count: 1 }],
    [{ type: "grunt", count: 2 }, { type: "acrobat", count: 2 }],
    [{ type: "grabber", count: 2 }, { type: "knife_thrower", count: 2 }],
    [{ type: "acrobat", count: 2 }, { type: "grunt", count: 3 }]
  ]
};
var BOSS_DATA = {
  1: { name: "IRON FIST", health: 50, speed: 80, damage: 18, color: "#cc8844", accentColor: "#ff6b35", w: 50, h: 80 },
  2: { name: "SHADOW", health: 45, speed: 130, damage: 15, color: "#2a1a3a", accentColor: "#8b5cf6", w: 36, h: 65 },
  3: { name: "NEON DRAGON", health: 65, speed: 100, damage: 20, color: "#1a1a2e", accentColor: "#ff2d95", w: 45, h: 75 }
};

// src/games/kungfu/engine.js
var KungFuEngine = class extends BaseEngine {
  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------
  /**
   * Reset all game state. Called by BaseEngine constructor and on restart.
   * Preserves highScore across resets (handled by super).
   */
  reset() {
    super.reset();
    this.currentFloor = 1;
    this.lives = 3;
    this.continues = 3;
    this.enemiesDefeated = 0;
    this.totalHealthBonus = 0;
    this.floorStartTime = 0;
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
      invincibleTimer: 0
    };
    this.enemies = [];
    this.projectiles = [];
    this.currentWave = 0;
    this.waveDelay = 0;
    this.waveActive = false;
    this.floorComplete = false;
    this.spawnQueue = [];
    this.boss = null;
    this.bossIntroTimer = 0;
    this.cutsceneTimer = 0;
    this.cutscenePhase = 0;
    this.cutsceneHearts = [];
    this.gameParticles = [];
    this.shakeAmount = 0;
    this.shakeDuration = 0;
    this.titleTime = 0;
    this.floorIntroTimer = 0;
    this._punchIntent = false;
    this._kickIntent = false;
    this._jumpIntent = false;
    this._specialIntent = false;
  }
  // ---------------------------------------------------------------------------
  // Intent methods — called by the controller on keydown/button press
  // ---------------------------------------------------------------------------
  /** Queue a punch action for the next frame. */
  punch() {
    this._punchIntent = true;
  }
  /** Queue a kick action for the next frame. */
  kick() {
    this._kickIntent = true;
  }
  /** Queue a jump action for the next frame. */
  jump() {
    this._jumpIntent = true;
  }
  /** Queue a special move for the next frame. */
  useSpecial() {
    this._specialIntent = true;
  }
  // ---------------------------------------------------------------------------
  // Game flow — start / continue
  // ---------------------------------------------------------------------------
  /** Begin a new game from the title screen. */
  startGame() {
    if (this.phase === PHASE5.TITLE) {
      this.currentFloor = 1;
      this.score = 0;
      this.lives = 3;
      this.continues = 3;
      this.enemiesDefeated = 0;
      this.totalHealthBonus = 0;
      this.floorIntroTimer = 0;
      this.gameParticles = [];
      this.setPhase(PHASE5.FLOOR_INTRO);
    }
  }
  /** Use a continue after game over. */
  continueGame() {
    if (this.phase === PHASE5.GAME_OVER && this.continues > 0) {
      this.continues--;
      this.lives = 3;
      this.player.health = this.player.maxHealth;
      this.player.invincible = true;
      this.player.invincibleTimer = 2;
      this.floorIntroTimer = 0;
      this.setPhase(PHASE5.FLOOR_INTRO);
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
    this.updateShake(dt);
    this.updateGameParticles(dt);
    const intents = {
      punch: this._punchIntent,
      kick: this._kickIntent,
      jump: this._jumpIntent,
      special: this._specialIntent
    };
    this._punchIntent = false;
    this._kickIntent = false;
    this._jumpIntent = false;
    this._specialIntent = false;
    switch (this.phase) {
      case PHASE5.TITLE:
        this.titleTime += dt;
        if (intents.punch || intents.kick) this.startGame();
        break;
      case PHASE5.PLAYING:
        this.updatePlayer(dt, intents);
        this.updateEnemies(dt, intents);
        this.updateProjectiles(dt);
        this.updateWaves(dt);
        this.updateBoss(dt);
        this.updateBossDelayed(dt);
        this.checkPlayerAttacks();
        this.checkPlayerAttacksBoss();
        this.player.attackHitbox = null;
        this.checkGrabSafety();
        this.pushApart();
        break;
      case PHASE5.FLOOR_INTRO:
        this.updateFloorIntro(dt);
        break;
      case PHASE5.BOSS_INTRO:
        this.updateBossIntro(dt);
        break;
      case PHASE5.CUTSCENE:
        this.updateCutscene(dt);
        break;
      case PHASE5.GAME_OVER:
        if (intents.punch) this.continueGame();
        break;
      case PHASE5.VICTORY:
        break;
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
      gameTime: this.elapsed
    };
  }
  // ---------------------------------------------------------------------------
  // Player
  // ---------------------------------------------------------------------------
  /** Reset player to starting position and full health. */
  resetPlayer() {
    this.player.x = 100;
    this.player.y = 0;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.health = this.player.maxHealth;
    this.player.state = "idle";
    this.player.grounded = true;
    this.player.crouching = false;
    this.player.attackHitbox = null;
    this.player.invincible = false;
    this.player.specialEnergy = 0;
  }
  /**
   * Update the player: invincibility, attacks, movement, physics.
   * @param {number} dt
   * @param {Object} intents - { punch, kick, jump, special }
   */
  updatePlayer(dt, intents) {
    if (this.player.invincible) {
      this.player.invincibleTimer -= dt;
      if (this.player.invincibleTimer <= 0) this.player.invincible = false;
    }
    if (this.player.stateTimer > 0) {
      this.player.stateTimer -= dt;
      if (this.player.stateTimer <= 0) {
        this.player.state = this.player.grounded ? "idle" : "jump";
        this.player.attackHitbox = null;
      }
      this.updatePlayerPhysics(dt);
      return;
    }
    this.player.crouching = this.input.isDown("ArrowDown") && this.player.grounded;
    if (!this.player.crouching) {
      if (this.input.isDown("ArrowLeft")) {
        this.player.vx = -this.player.speed;
        this.player.facing = -1;
        if (this.player.grounded) this.player.state = "walk";
      } else if (this.input.isDown("ArrowRight")) {
        this.player.vx = this.player.speed;
        this.player.facing = 1;
        if (this.player.grounded) this.player.state = "walk";
      } else {
        this.player.vx = 0;
        if (this.player.grounded && this.player.state === "walk")
          this.player.state = "idle";
      }
    } else {
      this.player.vx = 0;
      this.player.state = "crouch";
    }
    if (intents.jump && this.player.grounded) {
      this.player.vy = JUMP_FORCE2;
      this.player.grounded = false;
      this.player.state = "jump";
    }
    if (intents.punch) {
      if (this.player.crouching) {
        this.startAttack("crouch_attack", 0.25, {
          x: this.player.x + this.player.facing * 10,
          y: GROUND_Y2 - 10,
          w: 40,
          h: 15
        });
      } else {
        this.startAttack("punch", 0.15, {
          x: this.player.x + this.player.facing * 15,
          y: GROUND_Y2 - 55,
          w: 35,
          h: 16
        });
      }
      this.audio?.playSound("punch");
    } else if (intents.kick) {
      if (!this.player.grounded) {
        this.startAttack("jump_kick", 0.3, {
          x: this.player.x + this.player.facing * 15,
          y: GROUND_Y2 - 45 + this.player.y,
          w: 40,
          h: 18
        });
      } else {
        this.startAttack("kick", 0.25, {
          x: this.player.x + this.player.facing * 15,
          y: GROUND_Y2 - 35,
          w: 45,
          h: 18
        });
      }
      this.audio?.playSound("kick");
    } else if (intents.special && this.player.specialEnergy >= 1) {
      this.player.specialEnergy -= 1;
      this.startAttack("special", 0.4, {
        x: this.player.x - 45,
        y: GROUND_Y2 - 45,
        w: 90,
        h: 25
      });
      this.audio?.playSound("special");
    }
    this.updatePlayerPhysics(dt);
  }
  /**
   * Begin an attack state.
   * @param {string} state - Attack state name
   * @param {number} duration - Duration in seconds
   * @param {Object} hitbox - Attack hitbox { x, y, w, h }
   */
  startAttack(state, duration, hitbox) {
    this.player.state = state;
    this.player.stateTimer = duration;
    this.player.attackHitbox = hitbox;
  }
  /**
   * Apply gravity and movement to the player.
   * @param {number} dt
   */
  updatePlayerPhysics(dt) {
    if (!this.player.grounded) this.player.vy += GRAVITY2 * dt;
    this.player.x += this.player.vx * dt;
    this.player.y += this.player.vy * dt;
    if (this.player.y >= 0) {
      this.player.y = 0;
      this.player.vy = 0;
      this.player.grounded = true;
    }
    this.player.x = Math.max(20, Math.min(W - 20, this.player.x));
  }
  // ---------------------------------------------------------------------------
  // Collision
  // ---------------------------------------------------------------------------
  /** Damage multiplier based on current attack type. */
  _getAttackDamage() {
    switch (this.player.state) {
      case "special":
        return 3;
      case "jump_kick":
        return 2;
      case "kick":
        return 1.5;
      default:
        return 1;
    }
  }
  /**
   * Test if two axis-aligned rectangles overlap.
   * @param {Object|null} a - { x, y, w, h }
   * @param {Object|null} b - { x, y, w, h }
   * @returns {boolean}
   */
  rectsOverlap(a, b) {
    if (!a || !b) return false;
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  // ---------------------------------------------------------------------------
  // Enemies — spawning
  // ---------------------------------------------------------------------------
  /**
   * Spawn a grunt enemy.
   * @param {string} side - "left" or "right"
   */
  spawnGrunt(side) {
    const x = side === "left" ? -30 : W + 30;
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
      airborne: false
    });
  }
  /**
   * Spawn a grabber enemy.
   * @param {string} side - "left" or "right"
   */
  spawnGrabber(side) {
    const x = side === "left" ? -30 : W + 30;
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
      airborne: false
    });
  }
  /**
   * Spawn a knife thrower enemy.
   * @param {string} side - "left" or "right"
   */
  spawnKnifeThrower(side) {
    const x = side === "left" ? -30 : W + 30;
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
      attackCooldown: 2,
      attackRange: 250,
      minRange: 150,
      damage: 10,
      points: 300,
      flashTimer: 0,
      grabbing: false,
      grabEscapeCount: 0,
      airborne: false
    });
  }
  /**
   * Spawn an acrobat enemy.
   * @param {string} side - "left" or "right"
   */
  spawnAcrobat(side) {
    const x = side === "left" ? -30 : W + 30;
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
      attackCooldown: 1,
      attackRange: 100,
      damage: 12,
      points: 500,
      flashTimer: 0,
      grabbing: false,
      grabEscapeCount: 0,
      airborne: false
    });
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
      const e = this.enemies[i];
      if (e.flashTimer > 0) e.flashTimer -= dt;
      if (e.stateTimer > 0) {
        e.stateTimer -= dt;
        if (e.stateTimer <= 0) {
          if (e.state === "dead") {
            this.enemies.splice(i, 1);
            continue;
          }
          e.state = "walk";
        }
        continue;
      }
      if (e.state === "hurt") continue;
      e.facing = this.player.x > e.x ? 1 : -1;
      const dist = Math.abs(this.player.x - e.x);
      if (e.type === "grabber") {
        if (e.grabbing) {
          this.player.state = "hurt";
          this.player.stateTimer = 0.1;
          this.player.vx = 0;
          this.player.x = e.x - e.facing * 20;
          if (!this.player.invincible) {
            this.player.health -= e.damage * dt;
            if (this.player.health <= 0) {
              this.player.health = 0;
              this.loseLife();
              e.grabbing = false;
              continue;
            }
          }
          if (intents.punch || intents.kick) {
            e.grabEscapeCount++;
            if (e.grabEscapeCount >= 5) {
              e.grabbing = false;
              e.grabEscapeCount = 0;
              e.state = "hurt";
              e.stateTimer = 0.5;
              e.x += this.player.facing * 30;
              this.player.state = "idle";
              this.player.stateTimer = 0;
              this.audio?.playSound("grab_escape");
            }
          }
          continue;
        }
        if (dist <= e.attackRange && e.attackCooldown <= 0 && !this.player.invincible) {
          e.grabbing = true;
          e.grabEscapeCount = 0;
          e.state = "attack";
          e.attackCooldown = 2;
          this.player.state = "hurt";
          this.player.stateTimer = 0.1;
          this.player.vx = 0;
          continue;
        }
      }
      if (e.type === "knife_thrower") {
        e.attackCooldown -= dt;
        if (dist < e.minRange) {
          e.x -= e.facing * e.speed * dt;
          e.state = "walk";
        } else if (dist <= e.attackRange && e.attackCooldown <= 0) {
          e.state = "attack";
          e.stateTimer = 0.4;
          e.attackCooldown = 2;
          this.projectiles.push({
            x: e.x + e.facing * 15,
            y: GROUND_Y2 - 40,
            vx: e.facing * 300,
            w: 12,
            h: 4,
            damage: e.damage
          });
          this.audio?.playSound("knife");
        } else if (dist > e.attackRange) {
          e.x += e.facing * e.speed * dt;
          e.state = "walk";
        } else {
          e.state = "idle";
        }
        continue;
      }
      if (e.type === "acrobat") {
        e.attackCooldown -= dt;
        if (e.airborne) {
          e.vy += GRAVITY2 * dt;
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          if (e.y >= 0) {
            e.y = 0;
            e.airborne = false;
            e.vy = 0;
            e.vx = 0;
            e.state = "walk";
            if (Math.abs(this.player.x - e.x) < 40 && !this.player.invincible) {
              this.damagePlayer(e.damage);
            }
          }
          continue;
        }
        if (dist <= e.attackRange && e.attackCooldown <= 0) {
          e.airborne = true;
          e.vy = -400;
          e.vx = e.facing * 150;
          e.state = "attack";
          e.attackCooldown = 2;
        } else if (dist > e.attackRange) {
          e.x += e.facing * e.speed * dt;
          e.state = "walk";
        }
        continue;
      }
      if (dist > e.attackRange) {
        e.vx = e.speed * e.facing;
        e.x += e.vx * dt;
        e.state = "walk";
      } else {
        e.vx = 0;
        e.attackCooldown -= dt;
        if (e.attackCooldown <= 0) {
          e.state = "attack";
          e.stateTimer = 0.3;
          e.attackCooldown = 1;
          if (!this.player.invincible) this.damagePlayer(e.damage);
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
      const p = this.projectiles[i];
      p.x += p.vx * dt;
      if (p.x < -20 || p.x > W + 20) {
        this.projectiles.splice(i, 1);
        continue;
      }
      if (!this.player.invincible) {
        const pb = {
          x: this.player.x - 15,
          y: GROUND_Y2 - 70 + this.player.y,
          w: 30,
          h: 70
        };
        if (this.rectsOverlap(p, pb)) {
          this.damagePlayer(p.damage);
          this.projectiles.splice(i, 1);
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
    this.player.health -= amount;
    this.player.invincible = true;
    this.player.invincibleTimer = 0.5;
    this.player.state = "hurt";
    this.player.stateTimer = 0.2;
    this.audio?.playSound("player_hurt");
    this.triggerShake(4, 0.1);
    this.spawnHitParticles(this.player.x, GROUND_Y2 - 35, "#ef4444", 5);
    if (this.player.health <= 0) {
      this.player.health = 0;
      this.loseLife();
    }
  }
  /**
   * Handle losing a life. Transitions to GAME_OVER if no lives remain,
   * and submits the score if no continues are left either.
   */
  loseLife() {
    this.lives--;
    if (this.lives <= 0) {
      this.setPhase(PHASE5.GAME_OVER);
      if (this.continues <= 0) {
        this._onGameOver(Math.floor(this.score));
        this.stop();
      }
    } else {
      this.player.health = this.player.maxHealth;
      this.player.invincible = true;
      this.player.invincibleTimer = 2;
    }
  }
  // ---------------------------------------------------------------------------
  // Player attacks vs enemies / boss
  // ---------------------------------------------------------------------------
  /** Check player attack hitbox against all enemies. */
  checkPlayerAttacks() {
    if (!this.player.attackHitbox) return;
    for (const e of this.enemies) {
      if (e.state === "dead" || e.state === "hurt") continue;
      const eb = {
        x: e.x - e.w / 2,
        y: GROUND_Y2 - e.h + e.y,
        w: e.w,
        h: e.h
      };
      if (this.rectsOverlap(this.player.attackHitbox, eb)) {
        this.hitEnemy(e, this._getAttackDamage());
      }
    }
  }
  /**
   * Apply damage to an enemy. Awards points and special energy on kill.
   * @param {Object} e - Enemy object
   * @param {number} damage
   */
  hitEnemy(e, damage) {
    e.health -= damage;
    e.flashTimer = 0.1;
    e.state = "hurt";
    e.stateTimer = 0.3;
    e.x += this.player.facing * 20;
    if (e.grabbing) {
      e.grabbing = false;
      this.player.state = "idle";
      this.player.stateTimer = 0;
    }
    this.player.specialEnergy = Math.min(
      this.player.maxSpecialEnergy,
      this.player.specialEnergy + 0.2
    );
    this.audio?.playSound("enemy_hit");
    this.spawnHitParticles(e.x, GROUND_Y2 - 30, "#00ffff", 4);
    if (e.health <= 0) {
      e.state = "dead";
      e.stateTimer = 0.4;
      this.score += e.points;
      this.enemiesDefeated++;
      this.audio?.playSound("enemy_defeat");
      this.spawnHitParticles(e.x, GROUND_Y2 - 30, "#fff", 8);
    }
  }
  /** Check player attack hitbox against the boss. */
  checkPlayerAttacksBoss() {
    if (!this.boss || !this.player.attackHitbox) return;
    const bb = {
      x: this.boss.x - this.boss.w / 2,
      y: GROUND_Y2 - this.boss.h,
      w: this.boss.w,
      h: this.boss.h
    };
    if (this.rectsOverlap(this.player.attackHitbox, bb)) {
      this.boss.health -= this._getAttackDamage();
      this.boss.flashTimer = 0.1;
      this.player.specialEnergy = Math.min(
        this.player.maxSpecialEnergy,
        this.player.specialEnergy + 0.15
      );
      this.audio?.playSound("enemy_hit");
      this.spawnHitParticles(
        this.boss.x,
        GROUND_Y2 - this.boss.h / 2,
        this.boss.accentColor,
        5
      );
      this.triggerShake(3, 0.08);
      if (this.boss.health <= 0) this.defeatBoss();
    }
  }
  // ---------------------------------------------------------------------------
  // Grab safety and push-apart
  // ---------------------------------------------------------------------------
  /** If the grabber died or vanished while grabbing, free the player. */
  checkGrabSafety() {
    const anyGrabbing = this.enemies.some((e) => e.grabbing);
    if (!anyGrabbing && this.player.state === "hurt" && this.player.stateTimer <= 0) {
      const wasGrabbed = this.player.vx === 0 && this.player.grounded;
      if (wasGrabbed) {
        this.player.state = "idle";
        this.player.stateTimer = 0;
      }
    }
  }
  /** Push player and enemies apart so they don't stack. */
  pushApart() {
    for (const e of this.enemies) {
      if (e.state === "dead" || e.grabbing) continue;
      const dx = this.player.x - e.x;
      const dist = Math.abs(dx);
      if (dist < 25 && Math.abs(this.player.y - e.y) < 20) {
        const push = (25 - dist) * 0.5;
        const dir = dx > 0 ? 1 : -1;
        this.player.x += dir * push;
        e.x -= dir * push;
        this.player.x = Math.max(20, Math.min(W - 20, this.player.x));
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
    for (let i = this.spawnQueue.length - 1; i >= 0; i--) {
      this.spawnQueue[i].delay -= dt;
      if (this.spawnQueue[i].delay <= 0) {
        const s = this.spawnQueue.splice(i, 1)[0];
        switch (s.type) {
          case "grunt":
            this.spawnGrunt(s.side);
            break;
          case "grabber":
            this.spawnGrabber(s.side);
            break;
          case "knife_thrower":
            this.spawnKnifeThrower(s.side);
            break;
          case "acrobat":
            this.spawnAcrobat(s.side);
            break;
        }
      }
    }
    if (this.floorComplete) return;
    const waves = FLOOR_WAVES[this.currentFloor];
    if (!waves || this.currentWave >= waves.length) {
      if (this.enemies.length === 0 && this.spawnQueue.length === 0) {
        this.floorComplete = true;
        this.startBossFight();
      }
      return;
    }
    if (this.waveActive) {
      if (this.enemies.length === 0 && this.spawnQueue.length === 0) {
        this.waveActive = false;
        this.waveDelay = 1.5;
        this.currentWave++;
      }
      return;
    }
    this.waveDelay -= dt;
    if (this.waveDelay > 0) return;
    const wave = waves[this.currentWave];
    for (const group of wave) {
      for (let i = 0; i < group.count; i++) {
        const side = Math.random() > 0.5 ? "left" : "right";
        this.spawnQueue.push({ type: group.type, side, delay: i * 0.3 });
      }
    }
    this.waveActive = true;
  }
  /** Initialize a new floor: clear enemies, reset player. */
  initFloor() {
    this.enemies = [];
    this.projectiles = [];
    this.spawnQueue = [];
    this.currentWave = 0;
    this.waveDelay = 1;
    this.waveActive = false;
    this.floorComplete = false;
    this.floorStartTime = this.elapsed;
    this.resetPlayer();
  }
  // ---------------------------------------------------------------------------
  // Boss system
  // ---------------------------------------------------------------------------
  /** Transition to the boss intro screen. */
  startBossFight() {
    this.setPhase(PHASE5.BOSS_INTRO);
    this.bossIntroTimer = 0;
    this.audio?.playSound("boss_intro");
  }
  /**
   * Update the boss AI: state timer, then delegate to per-boss logic.
   * @param {number} dt
   */
  updateBoss(dt) {
    if (!this.boss) return;
    if (this.boss.flashTimer > 0) this.boss.flashTimer -= dt;
    if (this.boss.stateTimer > 0) {
      this.boss.stateTimer -= dt;
      if (this.boss.stateTimer <= 0) this.boss.state = "idle";
      if (this.boss.state === "charge") {
        this.boss.x += this.boss.facing * this.boss.speed * 3 * dt;
        this.boss.x = Math.max(30, Math.min(W - 30, this.boss.x));
      }
      return;
    }
    this.boss.facing = this.player.x > this.boss.x ? 1 : -1;
    this.boss.attackCooldown -= dt;
    const dist = Math.abs(this.player.x - this.boss.x);
    switch (this.currentFloor) {
      case 1:
        this.updateIronFist(dt, dist);
        break;
      case 2:
        this.updateShadow(dt, dist);
        break;
      case 3:
        this.updateNeonDragon(dt, dist);
        break;
    }
  }
  /**
   * Iron Fist boss AI — Floor 1.
   * @param {number} dt
   * @param {number} dist - Distance to player
   */
  updateIronFist(dt, dist) {
    if (dist > 60) {
      this.boss.x += this.boss.facing * this.boss.speed * dt;
      this.boss.state = "walk";
    } else if (this.boss.attackCooldown <= 0) {
      this.boss.state = "attack";
      this.boss.stateTimer = 0.4;
      this.boss.attackCooldown = 0.9;
      this.boss._pendingDamage = true;
      this.boss._damageDelay = 0.25;
    }
    if (this.boss.attackCooldown < -0.5) {
      this.boss.state = "charge";
      this.boss.stateTimer = 0.7;
      this.boss.attackCooldown = 1.6;
      this.boss._pendingDamage = true;
      this.boss._damageDelay = 0.4;
      this.boss._chargeDamage = true;
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
        this.boss.state = "teleport";
        this.boss.stateTimer = 0.5;
        this.boss.attackCooldown = 1.2;
        this.boss._teleporting = true;
        this.boss._teleportDelay = 0.35;
      } else {
        this.boss.state = "attack";
        this.boss.stateTimer = 0.25;
        this.boss.attackCooldown = 0.8;
        if (dist < 80 && !this.player.invincible) {
          this.damagePlayer(this.boss.damage);
          this.triggerShake(5, 0.15);
        }
      }
    } else {
      this.boss.x += this.boss.facing * this.boss.speed * 0.5 * dt;
      this.boss.x = Math.max(30, Math.min(W - 30, this.boss.x));
      this.boss.state = "walk";
    }
  }
  /**
   * Neon Dragon boss AI — Floor 3.
   * @param {number} dt
   * @param {number} dist - Distance to player
   */
  updateNeonDragon(dt, dist) {
    if (this.boss.phase === 1 && this.boss.health <= this.boss.maxHealth / 2) {
      this.boss.phase = 2;
      this.boss.speed *= 1.5;
      this.boss.attackCooldown = 0.5;
      this.triggerShake(10, 0.4);
      this.spawnHitParticles(this.boss.x, GROUND_Y2 - 40, "#ff2d95", 15);
    }
    if (this.boss.attackCooldown <= 0) {
      const roll = Math.random();
      if (dist > 200 || roll < 0.3 && dist > 100) {
        this.boss.state = "ranged";
        this.boss.stateTimer = 0.5;
        this.boss.attackCooldown = this.boss.phase === 2 ? 1 : 1.8;
        this.boss._fireProjectile = true;
        this.boss._projectileDelay = 0.3;
      } else if (roll < 0.6 || this.boss.phase === 2) {
        this.boss.state = "attack";
        this.boss.stateTimer = 0.4;
        this.boss.attackCooldown = this.boss.phase === 2 ? 0.7 : 1.4;
        if (dist < 60 && !this.player.invincible) {
          this.damagePlayer(this.boss.damage);
          this.triggerShake(5, 0.15);
        }
      } else {
        this.boss.state = "special";
        this.boss.stateTimer = 0.6;
        this.boss.attackCooldown = 2;
        this.boss._pendingDamage = true;
        this.boss._damageDelay = 0.4;
        this.boss._specialDamage = true;
      }
    } else {
      this.boss.x += this.boss.facing * this.boss.speed * dt;
      this.boss.x = Math.max(30, Math.min(W - 30, this.boss.x));
      this.boss.state = "walk";
    }
  }
  /**
   * Process boss delayed actions (pending damage, teleport, projectile).
   * @param {number} dt
   */
  updateBossDelayed(dt) {
    if (!this.boss) return;
    if (this.boss._pendingDamage) {
      this.boss._damageDelay -= dt;
      if (this.boss._damageDelay <= 0) {
        this.boss._pendingDamage = false;
        const dist = Math.abs(this.player.x - this.boss.x);
        const range = this.boss._specialDamage ? 100 : this.boss._chargeDamage ? 50 : 70;
        const dmg = this.boss._specialDamage ? this.boss.damage * 1.5 : this.boss._chargeDamage ? this.boss.damage * 1.5 : this.boss.damage;
        if (dist < range && !this.player.invincible) {
          this.damagePlayer(dmg);
          this.triggerShake(8, 0.2);
        }
        this.boss._chargeDamage = false;
        this.boss._specialDamage = false;
      }
    }
    if (this.boss._teleporting) {
      this.boss._teleportDelay -= dt;
      if (this.boss._teleportDelay <= 0) {
        this.boss._teleporting = false;
        this.boss.x = this.player.x + -this.player.facing * 60;
        this.boss.x = Math.max(30, Math.min(W - 30, this.boss.x));
        this.boss.facing = this.player.x > this.boss.x ? 1 : -1;
        this.boss.state = "attack";
        this.boss.stateTimer = 0.3;
        if (Math.abs(this.player.x - this.boss.x) < 60 && !this.player.invincible) {
          this.damagePlayer(this.boss.damage);
          this.triggerShake(5, 0.15);
        }
      }
    }
    if (this.boss._fireProjectile) {
      this.boss._projectileDelay -= dt;
      if (this.boss._projectileDelay <= 0) {
        this.boss._fireProjectile = false;
        this.projectiles.push({
          x: this.boss.x + this.boss.facing * 30,
          y: GROUND_Y2 - 40,
          vx: this.boss.facing * 350,
          w: 16,
          h: 8,
          damage: this.boss.damage,
          isBoss: true
        });
      }
    }
  }
  /** Handle boss defeat: award bonuses, clear boss, start cutscene. */
  defeatBoss() {
    const healthBonus = Math.floor(this.player.health * 10);
    const speedBonus = Math.max(
      0,
      2e3 - Math.floor((this.elapsed - this.floorStartTime) * 10)
    );
    this.totalHealthBonus += healthBonus;
    this.score += 1e3 + healthBonus + speedBonus;
    this.boss = null;
    this.audio?.playSound("boss_defeat");
    this.triggerShake(12, 0.5);
    this.spawnHitParticles(W / 2, GROUND_Y2 - 50, "#fff", 20);
    this.startCutscene();
  }
  // ---------------------------------------------------------------------------
  // Cutscene
  // ---------------------------------------------------------------------------
  /** Transition to cutscene state. */
  startCutscene() {
    this.setPhase(PHASE5.CUTSCENE);
    this.cutsceneTimer = 0;
    this.cutscenePhase = 0;
  }
  /**
   * Update cutscene progression and floating hearts.
   * @param {number} dt
   */
  updateCutscene(dt) {
    this.cutsceneTimer += dt;
    if (this.cutscenePhase === 0 && this.cutsceneTimer > 1)
      this.cutscenePhase = 1;
    if (this.cutscenePhase === 1 && this.cutsceneTimer > 3) {
      this.cutscenePhase = 2;
      if (this.currentFloor === 3) {
        this.cutsceneHearts = [];
        for (let i = 0; i < 5; i++) {
          this.cutsceneHearts.push({
            x: W / 2 + (Math.random() - 0.5) * 40,
            y: GROUND_Y2 - 80,
            vy: -30 - Math.random() * 20,
            vx: (Math.random() - 0.5) * 15,
            size: 8 + Math.random() * 6,
            delay: i * 0.35,
            alpha: 1
          });
        }
      }
    }
    for (const h of this.cutsceneHearts) {
      if (h.delay > 0) {
        h.delay -= dt;
        continue;
      }
      h.y += h.vy * dt;
      h.x += h.vx * dt;
      h.alpha = Math.max(0, h.alpha - dt * 0.2);
    }
    if (this.cutscenePhase === 2 && this.cutsceneTimer > (this.currentFloor === 3 ? 6.5 : 5)) {
      if (this.currentFloor >= 3) {
        this.setPhase(PHASE5.VICTORY);
        this._onGameOver(Math.floor(this.score));
        this.stop();
      } else {
        this.currentFloor++;
        this.setPhase(PHASE5.FLOOR_INTRO);
        this.floorIntroTimer = 0;
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
    this.floorIntroTimer += dt;
    if (this.floorIntroTimer > 2) {
      this.floorIntroTimer = 0;
      this.setPhase(PHASE5.PLAYING);
      this.initFloor();
    }
  }
  /**
   * Update boss intro timer, spawn boss, then transition to PLAYING.
   * @param {number} dt
   */
  updateBossIntro(dt) {
    this.bossIntroTimer += dt;
    if (this.bossIntroTimer > 3) {
      const data = BOSS_DATA[this.currentFloor];
      this.boss = {
        ...data,
        x: W - 100,
        y: 0,
        maxHealth: data.health,
        facing: -1,
        state: "idle",
        stateTimer: 0,
        attackCooldown: 2,
        flashTimer: 0,
        phase: 1,
        _pendingDamage: false,
        _damageDelay: 0,
        _chargeDamage: false,
        _specialDamage: false,
        _teleporting: false,
        _teleportDelay: 0,
        _fireProjectile: false,
        _projectileDelay: 0
      };
      this.setPhase(PHASE5.PLAYING);
    }
  }
  // ---------------------------------------------------------------------------
  // Particles
  // ---------------------------------------------------------------------------
  /** Spawn a random ambient particle. */
  spawnAmbientParticle() {
    const p = {
      x: Math.random() * W,
      y: Math.random() * GROUND_Y2 * 0.8,
      vx: (Math.random() - 0.5) * 20,
      vy: -Math.random() * 15 - 5,
      life: Math.random() * 3 + 2,
      maxLife: 0,
      size: Math.random() * 2 + 1,
      color: ["#ff2d95", "#00ffff", "#8b5cf6", "#ff6b35"][Math.floor(Math.random() * 4)]
    };
    p.maxLife = p.life;
    this.gameParticles.push(p);
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
        color
      });
    }
  }
  /**
   * Update all game particles. Spawns ambient particles during PLAYING.
   * @param {number} dt
   */
  updateGameParticles(dt) {
    if (Math.random() < 4.8 * dt && this.phase === PHASE5.PLAYING)
      this.spawnAmbientParticle();
    for (let i = this.gameParticles.length - 1; i >= 0; i--) {
      const p = this.gameParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.gameParticles[i] = this.gameParticles[this.gameParticles.length - 1];
        this.gameParticles.pop();
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
    this.shakeAmount = amount;
    this.shakeDuration = duration;
  }
  /**
   * Decay the screen shake over time.
   * @param {number} dt
   */
  updateShake(dt) {
    if (this.shakeDuration > 0) {
      this.shakeDuration -= dt;
      if (this.shakeDuration <= 0) this.shakeAmount = 0;
    }
  }
};
__publicField(KungFuEngine, "phases", [
  PHASE5.TITLE,
  PHASE5.PLAYING,
  PHASE5.FLOOR_INTRO,
  PHASE5.BOSS_INTRO,
  PHASE5.CUTSCENE,
  PHASE5.GAME_OVER,
  PHASE5.VICTORY
]);
/** Score submission is handled manually because of the continues system. */
__publicField(KungFuEngine, "terminalPhases", []);
/** Phases where Q-to-quit is allowed. */
__publicField(KungFuEngine, "quitPhases", [PHASE5.TITLE, PHASE5.GAME_OVER, PHASE5.VICTORY]);

// src/games/kungfu/sprites.js
var SP = 3;
var spriteCache = {};
function getSpriteCanvas(key, data, pal) {
  if (spriteCache[key]) return spriteCache[key];
  const h = data.length, w = data[0].length;
  const c = document.createElement("canvas");
  c.width = w * SP;
  c.height = h * SP;
  const cx = c.getContext("2d");
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = data[y][x];
      if (ch !== "." && pal[ch]) {
        cx.fillStyle = pal[ch];
        cx.fillRect(x * SP, y * SP, SP, SP);
      }
    }
  }
  spriteCache[key] = c;
  return c;
}
function getSpriteCanvasWhite(key, data, pal) {
  const wkey = key + "_w";
  if (spriteCache[wkey]) return spriteCache[wkey];
  const h = data.length, w = data[0].length;
  const c = document.createElement("canvas");
  c.width = w * SP;
  c.height = h * SP;
  const cx = c.getContext("2d");
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[y][x] !== "." && pal[data[y][x]]) {
        cx.fillStyle = "#ffffff";
        cx.fillRect(x * SP, y * SP, SP, SP);
      }
    }
  }
  spriteCache[wkey] = c;
  return c;
}
function blitSprite(ctx, key, data, pal, x, y, flip, flash) {
  const c = flash ? getSpriteCanvasWhite(key, data, pal) : getSpriteCanvas(key, data, pal);
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(c, -c.width / 2, -c.height);
  ctx.restore();
}
var PAL_PLAYER = {
  o: "#1a0a0a",
  s: "#ffcc88",
  S: "#e8b070",
  t: "#442200",
  h: "#ff2d95",
  r: "#e03030",
  R: "#aa2020",
  b: "#2060ff",
  B: "#1848cc",
  k: "#111111",
  w: "#ffffff",
  f: "#ffddaa",
  c: "#00ffff"
};
var PAL_GRUNT = {
  o: "#1a1a1a",
  s: "#ffcc88",
  S: "#e8b070",
  g: "#777777",
  G: "#555555",
  p: "#555555",
  P: "#444444",
  k: "#222222",
  t: "#553322"
};
var PAL_GRABBER = {
  o: "#1a0a2a",
  s: "#ffcc88",
  S: "#e8b070",
  g: "#7c3aed",
  G: "#5b21b6",
  p: "#5b21b6",
  P: "#4a1a9e",
  k: "#222222",
  t: "#553322"
};
var PAL_KNIFE = {
  o: "#0a0a1a",
  s: "#ffcc88",
  S: "#e8b070",
  g: "#2a2a3e",
  G: "#1a1a2e",
  p: "#1a1a2e",
  P: "#111122",
  k: "#111111",
  m: "#333344",
  c: "#00ffff",
  t: "#222233"
};
var PAL_ACROBAT = {
  o: "#1a0a0a",
  s: "#ffcc88",
  S: "#e8b070",
  g: "#dc2626",
  G: "#991b1b",
  p: "#991b1b",
  P: "#771515",
  k: "#222222",
  t: "#553322"
};
var PAL_IRONFIST = {
  o: "#1a0a00",
  s: "#ffcc88",
  S: "#e8b070",
  g: "#cc8844",
  G: "#aa6633",
  p: "#8B4513",
  P: "#6B3410",
  k: "#222222",
  t: "#442200",
  a: "#ff6b35",
  A: "#dd5525"
};
var PAL_SHADOW = {
  o: "#0a0a1a",
  s: "#ffcc88",
  S: "#e8b070",
  g: "#2a1a3a",
  G: "#1a0a2a",
  p: "#1a0a2a",
  P: "#0a0020",
  k: "#111111",
  m: "#111122",
  v: "#8b5cf6",
  V: "#6d3fd4",
  t: "#222233"
};
var PAL_DRAGON = {
  o: "#1a001a",
  s: "#ffcc88",
  S: "#e8b070",
  g: "#1a1a2e",
  G: "#111122",
  p: "#111122",
  P: "#0a0a18",
  k: "#111111",
  t: "#222222",
  n: "#ff2d95",
  N: "#cc1177",
  a: "#ff6b35",
  A: "#dd5525"
};
var PAL_TIFFANY = {
  o: "#1a1a00",
  s: "#ffcc88",
  S: "#e8b070",
  w: "#ffffff",
  W: "#ddddee",
  d: "#ffd700",
  D: "#ccaa00",
  h: "#daa520",
  H: "#b8860b",
  k: "#aa8800"
};
var PLAYER_IDLE = [
  "......tt......",
  ".....tsst.....",
  "....tssSSt....",
  "....ssssss....",
  "....hhhhhh....",
  "....ssooss....",
  "....ssssss....",
  ".....sSS......",
  "....rrrrrr....",
  "...rrrrrrrr...",
  "..fsrrrrrrsf..",
  "..fsrrrrrrsf..",
  "..fSRrrrrRSf..",
  "...SRrrrrRS...",
  "....kkkkkk....",
  "....bbbbbb....",
  "....bb..bb....",
  "....bb..bb....",
  "....bb..bb....",
  "....BB..BB....",
  "....Bk..kB....",
  "...kkk..kkk..."
];
var PLAYER_WALK1 = [
  "......tt......",
  ".....tsst.....",
  "....tssSSt....",
  "....ssssss....",
  "....hhhhhh....",
  "....ssooss....",
  "....ssssss....",
  ".....sSS......",
  "....rrrrrr....",
  "...rrrrrrrr...",
  "..fSrrrrrrsf..",
  "...Srrrrrrsf..",
  "...SRrrrrRS...",
  "....Rrrrrr....",
  "....kkkkkk....",
  "....bbbbbb....",
  "...bbb..bb....",
  "..bbb....bb...",
  "..bb......bb..",
  "..BB......BB..",
  "..kk......kk..",
  "..kkk....kkk.."
];
var PLAYER_WALK2 = [
  "......tt......",
  ".....tsst.....",
  "....tssSSt....",
  "....ssssss....",
  "....hhhhhh....",
  "....ssooss....",
  "....ssssss....",
  ".....sSS......",
  "....rrrrrr....",
  "...rrrrrrrr...",
  "..fSrrrrrrSf..",
  "..fSrrrrrrSf..",
  "...SRrrrrRS...",
  "....Rrrrrr....",
  "....kkkkkk....",
  "....bbbbbb....",
  "....bb.bbb....",
  "...bb...bbb...",
  "..bb.....bb...",
  "..BB.....BB...",
  "..kk.....kk...",
  "..kkk...kkk..."
];
var PLAYER_PUNCH = [
  "......tt......",
  ".....tsst.....",
  "....tssSSt....",
  "....ssssss....",
  "....hhhhhh....",
  "....ssooss....",
  "....ssssss....",
  ".....sSS......",
  "....rrrrrr....",
  "...rrrrrrrr...",
  "..fSrrrrrrssssw",
  "..fSrrrrrrssssw",
  "...SRrrrrRS.ww.",
  "....RrrrrRS....",
  "....kkkkkk....",
  "....bbbbbb....",
  "....bb..bb....",
  "....bb..bb....",
  "....bb..bb....",
  "....BB..BB....",
  "...kkk..kkk...",
  "...kkk..kkk..."
];
var PLAYER_KICK = [
  "......tt......",
  ".....tsst.....",
  "....tssSSt....",
  "....ssssss....",
  "....hhhhhh....",
  "....ssooss....",
  "....ssssss....",
  ".....sSS......",
  "....rrrrrr....",
  "..fsrrrrrrrr..",
  "..fsrrrrrrrr..",
  "...SRrrrrRR...",
  "....kkkkkk....",
  "....bbbbbb....",
  "....bbb.......",
  "....bbbbbbbbbcc",
  "....BBbbbbbbbcc",
  "......BB......",
  ".....kkk......",
  "....kkk.......",
  "..............",
  ".............."
];
var PLAYER_JUMPKICK = [
  "......tt......",
  ".....tsst.....",
  "....tssSSt....",
  "....ssssss....",
  "....hhhhhh....",
  "....ssooss....",
  "....ssssss....",
  ".....sSS......",
  "....rrrrrr....",
  "..fsrrrrrrrr..",
  "..fsrrrrrrrr..",
  "...SRrrrrR....",
  "....kkkkkk....",
  "..bbb.........",
  ".bbb.bbbbbbcc.",
  ".BB..BBbbbbbcc",
  "..kk..........",
  "..kkk.........",
  "..............",
  "..............",
  "..............",
  ".............."
];
var PLAYER_CROUCH = [
  "..............",
  "..............",
  "..............",
  "..............",
  "..............",
  "..............",
  "..............",
  "..............",
  "......tt......",
  ".....tsst.....",
  "....tssSSt....",
  "....ssssss....",
  "....hhhhhh....",
  "....ssooss....",
  "....ssssss....",
  "...rrrrrrrr...",
  "..fsrrrrrrsf..",
  "..fSRrrrrRSf..",
  "...kkkkkkkk...",
  "..bbbbbbbbbb..",
  "..BBbbkkbbBB..",
  "..kkkk..kkkk.."
];
var PLAYER_CROUCH_ATK = [
  "..............",
  "..............",
  "..............",
  "..............",
  "..............",
  "..............",
  "..............",
  "..............",
  "......tt......",
  ".....tsst.....",
  "....tssSSt....",
  "....ssssss....",
  "....hhhhhh....",
  "....ssooss....",
  "....ssssss....",
  "...rrrrrrrr...",
  "..fsrrrrrrsf..",
  "..fSRrrrrRSf..",
  "...kkkkkkkk...",
  "..bbbbbbbbbbbbcc",
  "..BBbbkkbbBBbbcc",
  "..kkkk..kkkk.."
];
var PLAYER_SPECIAL = [
  "......tt......",
  ".....tsst.....",
  "....tssSSt....",
  "....ssssss....",
  "....hhhhhh....",
  "....ssooss....",
  "....ssssss....",
  ".....sSS......",
  "....rrrrrr....",
  "...rrrrrrrr...",
  "..fsrrrrrrsf..",
  "..fSRrrrrRSf..",
  "....kkkkkk....",
  "ccbbbbbbbbbbcc",
  "ccBBBbbbbBBBcc",
  "cc..BBbbBB..cc",
  "....kkkkkk....",
  "...kk..kk.....",
  "..............",
  "..............",
  "..............",
  ".............."
];
var PLAYER_HURT = [
  "..............",
  "......tt......",
  ".....tsst.....",
  "....tssSSt....",
  "....ssssss....",
  "....hhhhhh....",
  "....ssooss....",
  "....ssssss....",
  ".....sSS......",
  "...rrrrrrrr...",
  "..fsrrrrrrsf..",
  ".fSRrrrrrrrSf.",
  ".f.SRrrrrRS.f.",
  "....kkkkkk....",
  "....bbbbbb....",
  "...bbb..bbb...",
  "..bbb....bbb..",
  "..BB......BB..",
  "..kk......kk..",
  "..kkk....kkk..",
  "..............",
  ".............."
];
var ENEMY_WALK1 = [
  ".....tt......",
  "....tsst.....",
  "...tssSSt....",
  "...ssssss....",
  "...ssssss....",
  "...ssooss....",
  "....sSS......",
  "...gggggg....",
  "..sggggggg...",
  "..sgggggggs..",
  "..SGggggGS...",
  "...GggggG....",
  "...pppppp....",
  "...pp..pp....",
  "..ppp...pp...",
  "..pp.....pp..",
  "..PP.....PP..",
  "..kk.....kk..",
  ".kkk.....kkk."
];
var ENEMY_WALK2 = [
  ".....tt......",
  "....tsst.....",
  "...tssSSt....",
  "...ssssss....",
  "...ssssss....",
  "...ssooss....",
  "....sSS......",
  "...gggggg....",
  "..sggggggg...",
  "..sgggggggs..",
  "..SGggggGS...",
  "...GggggG....",
  "...pppppp....",
  "...pp..pp....",
  "...pp.ppp....",
  "..pp...pp....",
  "..PP...PP....",
  "..kk...kk....",
  ".kkk...kkk..."
];
var ENEMY_ATTACK = [
  ".....tt......",
  "....tsst.....",
  "...tssSSt....",
  "...ssssss....",
  "...ssssss....",
  "...ssooss....",
  "....sSS......",
  "...gggggg....",
  "..Sggggggsssss",
  "..Sggggggsssss",
  "..SGggggGS...",
  "...GggggG....",
  "...pppppp....",
  "...pp..pp....",
  "...pp..pp....",
  "...pp..pp....",
  "...PP..PP....",
  "...kk..kk....",
  "..kkk..kkk..."
];
var ENEMY_HURT = [
  "..............",
  ".....tt.......",
  "....tsst......",
  "...tssSSt.....",
  "...ssssss.....",
  "...ssssss.....",
  "...ssooss.....",
  "....sSS.......",
  "..gggggggg....",
  ".sggggggggg...",
  ".SGgggggggS...",
  "..SGggggGS....",
  "...pppppp.....",
  "..ppp..ppp....",
  ".ppp....ppp...",
  ".PP......PP...",
  ".kk......kk...",
  ".kkk....kkk...",
  ".............."
];
var GRABBER_GRAB = [
  ".....tt......",
  "....tsst.....",
  "...tssSSt....",
  "...ssssss....",
  "...ssssss....",
  "...ssooss....",
  "....sSS......",
  "...gggggg....",
  "..Sggggggsss.",
  "..SggggggssSS",
  "..SGggggGssss",
  "...GggggGssSS",
  "...pppppp....",
  "...pp..pp....",
  "...pp..pp....",
  "...pp..pp....",
  "...PP..PP....",
  "...kk..kk....",
  "..kkk..kkk..."
];
var KNIFE_IDLE = [
  ".....tt......",
  "....tsst.....",
  "...tssSSt....",
  "...smmmms....",
  "...smmmms....",
  "...ssmmss....",
  "....sSS......",
  "...gggggg....",
  "..sggggggg...",
  "..sgggggggs..",
  "..SGggggGS...",
  "...GggggG....",
  "...pppppp....",
  "...pp..pp....",
  "...pp..pp....",
  "...pp..pp....",
  "...PP..PP....",
  "...kk..kk....",
  "..kkk..kkk..."
];
var KNIFE_THROW = [
  ".....tt......",
  "....tsst.....",
  "...tssSSt....",
  "...smmmms....",
  "...smmmms....",
  "...ssmmss....",
  "....sSS......",
  "...gggggg....",
  "..Sggggggsscc",
  "..SggggggsScc",
  "..SGggggGS...",
  "...GggggG....",
  "...pppppp....",
  "...pp..pp....",
  "...pp..pp....",
  "...pp..pp....",
  "...PP..PP....",
  "...kk..kk....",
  "..kkk..kkk..."
];
var ACROBAT_FLIP = [
  "..............",
  "...gggggg.....",
  "..ggggggggg...",
  "..gggggggggg..",
  "..SGggggGGss..",
  "...ppppppss...",
  "...PPppPPss...",
  "...kk..kk.....",
  "..kkk..kkk....",
  ".....tt.......",
  "....tsst......",
  "...tssSSt.....",
  "...ssssss.....",
  "...ssooss.....",
  "..............",
  "..............",
  "..............",
  "..............",
  ".............."
];
var IRONFIST_IDLE = [
  "......tttt........",
  ".....tssSSt.......",
  "....tsssssst......",
  "....ssssssss......",
  "....ssssssss......",
  "....sssoooss......",
  "....ssssssss......",
  ".....ssSSSs.......",
  "...gggggggggg.....",
  "..sggggggggggs....",
  "..sggggggggggs....",
  ".fsggggggggggsf...",
  ".fSGGggggGGGSf...",
  "..SGGggggGGGS....",
  "...GGggggGGG.....",
  "....pppppppp......",
  "....pp....pp......",
  "....pp....pp......",
  "....pp....pp......",
  "....pp....pp......",
  "...PPP...PPP......",
  "...PPP...PPP......",
  "..kkkk..kkkk......",
  "..kkkk..kkkk......"
];
var IRONFIST_PUNCH = [
  "......tttt........",
  ".....tssSSt.......",
  "....tsssssst......",
  "....ssssssss......",
  "....ssssssss......",
  "....sssoooss......",
  "....ssssssss......",
  ".....ssSSSs.......",
  "...gggggggggg.....",
  "..sggggggggggs....",
  "..sggggggggggsssssaa",
  ".fsggggggggggsssssaa",
  ".fSGGggggGGGS..aaAA",
  "..SGGggggGGGS.....",
  "...GGggggGGG......",
  "....pppppppp......",
  "....pp....pp......",
  "....pp....pp......",
  "....pp....pp......",
  "...PPP...PPP......",
  "..kkkk..kkkk......",
  "..kkkk..kkkk......",
  "..................",
  ".................."
];
var IRONFIST_CHARGE = [
  "......tttt........",
  ".....tssSSt.......",
  "....tsssssst......",
  "....ssssssss......",
  "....sssoooss......",
  "....ssssssss......",
  ".....ssSSSs.......",
  "..gggggggggggg....",
  ".sggggggggggggg...",
  ".sgggggggggggggs..",
  ".SGGGgggggGGGGs..",
  "..SGGGggggGGGGS..",
  "...pppppppppp.....",
  "..ppp......ppp....",
  ".ppp........ppp...",
  ".PP..........PP...",
  ".kk..........kk...",
  ".kkkk......kkkk...",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  ".................."
];
var SHADOW_IDLE = [
  ".....ttt......",
  "....tssst.....",
  "...tssSSst....",
  "...smmmmmms...",
  "...smmmmmms...",
  "...ssvvmmss...",
  "....ssSs......",
  "...gggggg.....",
  "..vgggggggv...",
  "..vgggggggv...",
  "..VGggggGGV...",
  "...GggggGG....",
  "...pppppp.....",
  "...pp..pp.....",
  "...pp..pp.....",
  "...pp..pp.....",
  "...PP..PP.....",
  "...kk..kk.....",
  "..kkk..kkk....",
  "..............",
  "..............",
  ".............."
];
var SHADOW_ATTACK = [
  ".....ttt......",
  "....tssst.....",
  "...tssSSst....",
  "...smmmmmms...",
  "...smmmmmms...",
  "...ssvvmmss...",
  "....ssSs......",
  "...gggggg.....",
  "..vggggggvvvvVV",
  "..vggggggvvvvVV",
  "..VGggggGGV...",
  "...GggggGG....",
  "...pppppp.....",
  "...pp..pp.....",
  "...pp..pp.....",
  "...pp..pp.....",
  "...PP..PP.....",
  "...kk..kk.....",
  "..kkk..kkk....",
  "..............",
  "..............",
  ".............."
];
var DRAGON_IDLE = [
  ".....tttt.....",
  "....tssSSt....",
  "...tsssssst...",
  "...sssssssn...",
  "...nnnnnnn....",
  "...ssnooss....",
  "...ssssssss...",
  "....ssSSSs....",
  "..nnggggggnn..",
  "..nggggggggnN.",
  ".nsggggggggsn.",
  ".nSGGggggGGSN.",
  "..SGGggggGGS..",
  "...pppppppp...",
  "...pp....pp...",
  "...pp....pp...",
  "...pp....pp...",
  "...PP....PP...",
  "..kkkk..kkkk..",
  "..kkkk..kkkk..",
  "...............",
  "..............."
];
var DRAGON_ATTACK = [
  ".....tttt.....",
  "....tssSSt....",
  "...tsssssst...",
  "...sssssssn...",
  "...nnnnnnn....",
  "...ssnooss....",
  "...ssssssss...",
  "....ssSSSs....",
  "..nnggggggnn..",
  "..nggggggggsssnN",
  ".nsggggggggsssnn",
  ".nSGGggggGGSnN..",
  "..SGGggggGGS....",
  "...pppppppp.....",
  "...pp....pp.....",
  "...pp....pp.....",
  "...PP....PP.....",
  "..kkkk..kkkk....",
  "..kkkk..kkkk....",
  "................",
  "................",
  "................"
];
var DRAGON_RANGED = [
  ".....tttt.....",
  "....tssSSt....",
  "...tsssssst...",
  "...sssssssn...",
  "...nnnnnnn....",
  "...ssnooss....",
  "...ssssssss...",
  "....ssSSSs....",
  "..nnggggggnn..",
  "..nggggggggssnnNN",
  ".nsggggggggssnnNN",
  ".nSGGggggGGSnN..",
  "..SGGggggGGS....",
  "...pppppppp.....",
  "...pp....pp.....",
  "...pp....pp.....",
  "...PP....PP.....",
  "..kkkk..kkkk....",
  "..kkkk..kkkk....",
  "................",
  "................",
  "................"
];
var DRAGON_SPECIAL = [
  ".....tttt........",
  "....tssSSt.......",
  "...tsssssst......",
  "...sssssssn......",
  "...nnnnnnn.......",
  "...ssnooss.......",
  "...ssssssss......",
  "....ssSSSs.......",
  "..nnggggggnn.....",
  "..nggggggggnN....",
  ".nsggggggggsn....",
  ".nSGGggggGGSN....",
  "..SGGggggGGS.....",
  "NNppppppppppNN...",
  "NNPPppppppPPNN...",
  "nn..PPppPP..nn...",
  "....kkkkkk.......",
  "...kk..kk........",
  ".................",
  ".................",
  ".................",
  "................."
];
var TIFFANY_STAND = [
  "....hhhh......",
  "...hhsshh.....",
  "..hhssSSh.....",
  "..hssssssh....",
  "..hssOOssh....",
  "..hssssssH....",
  "...hssSsh.....",
  "...wwwwww.....",
  "..dwwwwwwd....",
  "..dwwwwwwd....",
  "..dWwwwwWd....",
  "...Dwwwwd.....",
  "...dwwwwd.....",
  "...dwwwwd.....",
  "..dwwwwwwd....",
  "..dwwwwwwd....",
  ".ddwwwwwwdd...",
  ".DDWwwwwWDD...",
  "..DDD..DDD....",
  "..kkk..kkk....",
  "..............",
  ".............."
];
var PLAYER_FRAMES = {
  idle: PLAYER_IDLE,
  walk1: PLAYER_WALK1,
  walk2: PLAYER_WALK2,
  punch: PLAYER_PUNCH,
  kick: PLAYER_KICK,
  jumpkick: PLAYER_JUMPKICK,
  crouch: PLAYER_CROUCH,
  crouch_atk: PLAYER_CROUCH_ATK,
  special: PLAYER_SPECIAL,
  hurt: PLAYER_HURT
};
var BOSS_FRAMES = {
  1: { idle: IRONFIST_IDLE, walk: IRONFIST_IDLE, attack: IRONFIST_PUNCH, charge: IRONFIST_CHARGE },
  2: { idle: SHADOW_IDLE, walk: SHADOW_IDLE, attack: SHADOW_ATTACK },
  3: { idle: DRAGON_IDLE, walk: DRAGON_IDLE, attack: DRAGON_ATTACK, ranged: DRAGON_RANGED, special: DRAGON_SPECIAL }
};
var BOSS_PALS = { 1: PAL_IRONFIST, 2: PAL_SHADOW, 3: PAL_DRAGON };

// src/games/kungfu/renderer.js
var FLOOR_NAMES = { 1: "THE STREET", 2: "THE DOJO", 3: "THE ROOFTOP" };
var STREET_SKYLINE_X = [0, 80, 200, 300, 450, 550, 700];
var STREET_BUILDINGS_X = [0, 120, 260, 400, 560, 720];
var NEON_COLORS = ["#ff2d95", "#00ffff", "#ff6b35", "#8b5cf6"];
var ROOFTOP_SKYLINE_X = [50, 120, 200, 300, 380, 470, 560, 640, 720];
var ENEMY_PAL_AND_FRAMES = {
  grabber: {
    pal: PAL_GRABBER,
    frames: {
      walk1: ENEMY_WALK1,
      walk2: ENEMY_WALK2,
      attack: ENEMY_ATTACK,
      hurt: ENEMY_HURT,
      grab: GRABBER_GRAB
    }
  },
  knife_thrower: {
    pal: PAL_KNIFE,
    frames: {
      walk1: KNIFE_IDLE,
      walk2: KNIFE_IDLE,
      attack: KNIFE_THROW,
      hurt: ENEMY_HURT,
      throw: KNIFE_THROW
    }
  },
  acrobat: {
    pal: PAL_ACROBAT,
    frames: {
      walk1: ENEMY_WALK1,
      walk2: ENEMY_WALK2,
      attack: ENEMY_ATTACK,
      hurt: ENEMY_HURT,
      flip: ACROBAT_FLIP
    }
  },
  grunt: {
    pal: PAL_GRUNT,
    frames: {
      walk1: ENEMY_WALK1,
      walk2: ENEMY_WALK2,
      attack: ENEMY_ATTACK,
      hurt: ENEMY_HURT
    }
  }
};
var KungFuRenderer = class {
  /**
   * Creates a new renderer bound to the given canvas.
   *
   * @param {HTMLCanvasElement} canvas - The canvas element to draw on
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = canvas.getContext("2d");
    this._state = null;
    this._streetSkyGrad = this.ctx.createLinearGradient(0, 0, 0, GROUND_Y2);
    this._streetSkyGrad.addColorStop(0, "#0a0020");
    this._streetSkyGrad.addColorStop(0.6, "#1a0a3e");
    this._streetSkyGrad.addColorStop(1, "#2d1060");
    this._streetFloorGrad = this.ctx.createLinearGradient(0, GROUND_Y2, 0, H);
    this._streetFloorGrad.addColorStop(0, "#1a0a2e");
    this._streetFloorGrad.addColorStop(1, "#0a0015");
    this._rooftopSkyGrad = this.ctx.createLinearGradient(0, 0, 0, GROUND_Y2);
    this._rooftopSkyGrad.addColorStop(0, "#0a0020");
    this._rooftopSkyGrad.addColorStop(0.4, "#2d1060");
    this._rooftopSkyGrad.addColorStop(0.7, "#8b2080");
    this._rooftopSkyGrad.addColorStop(1, "#ff6b35");
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
    this._state = state;
    const { ctx } = this;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    this._applyShake();
    switch (state.phase) {
      case PHASE5.TITLE:
        this._renderTitle();
        break;
      case PHASE5.PLAYING:
        this._renderPlaying();
        break;
      case PHASE5.FLOOR_INTRO:
        this._renderFloorIntro();
        break;
      case PHASE5.BOSS_INTRO:
        this._renderBossIntro();
        break;
      case PHASE5.CUTSCENE:
        this._renderCutscene();
        break;
      case PHASE5.GAME_OVER:
        this._renderGameOver();
        break;
      case PHASE5.VICTORY:
        this._renderVictory();
        break;
    }
    ctx.restore();
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
      this.draw(this._state);
    }
    const { ctx } = this;
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.font = "bold 24px monospace";
    ctx.fillStyle = "#ff2d95";
    ctx.fillText(isNewHighScore ? "NEW HIGH SCORE!" : "GAME OVER", W / 2, 80);
    ctx.font = "18px monospace";
    ctx.fillStyle = "#00ffff";
    ctx.fillText(`Score: ${score.toLocaleString()}`, W / 2, 120);
    if (leaderboard && leaderboard.length > 0) {
      ctx.font = "bold 14px monospace";
      ctx.fillStyle = "#E8C65A";
      ctx.fillText("LEADERBOARD", W / 2, 160);
      ctx.font = "12px monospace";
      leaderboard.slice(0, 10).forEach((entry, i) => {
        ctx.fillStyle = "#CCC";
        ctx.fillText(
          `${i + 1}. ${entry.user_name} \u2014 ${entry.score.toLocaleString()}`,
          W / 2,
          185 + i * 20
        );
      });
    }
    ctx.font = "11px monospace";
    ctx.fillStyle = "#666";
    ctx.fillText("Press Q to quit", W / 2, H - 30);
  }
  // ---------------------------------------------------------------------------
  // Phase renderers
  // ---------------------------------------------------------------------------
  /** @private Render the main playing view. */
  _renderPlaying() {
    this._drawFloorBackground();
    for (const e of this._state.enemies) this._drawEnemy(e);
    this._drawProjectiles();
    this._drawPlayer(this._state.player);
    this._drawBoss();
    this._drawParticles();
    this._drawHUD();
  }
  /** @private Render the title screen. */
  _renderTitle() {
    const { ctx } = this;
    const titleTime = this._state.titleTime;
    ctx.fillStyle = "#0a0015";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#ff2d9533";
    ctx.lineWidth = 1;
    for (let i = 0; i < 15; i++) {
      const y = H - 80 + ((i * 25 + titleTime * 40) % 200 - 200);
      const spread = (H - y) / H;
      ctx.globalAlpha = Math.max(0, spread);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    for (let i = -6; i <= 6; i++) {
      ctx.beginPath();
      ctx.moveTo(W / 2 + i * 8, H - 280);
      ctx.lineTo(W / 2 + i * 100, H);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    ctx.font = "bold 40px monospace";
    ctx.fillStyle = "#ff2d95";
    ctx.shadowColor = "#ff2d95";
    ctx.shadowBlur = 15 + Math.sin(titleTime * 3) * 8;
    ctx.fillText("KUNG FU", W / 2, H / 2 - 70);
    ctx.font = "bold 48px monospace";
    ctx.fillText("OVERDRIVE", W / 2, H / 2 - 20);
    ctx.shadowBlur = 0;
    ctx.font = "14px monospace";
    ctx.fillStyle = "#ffd700";
    ctx.shadowColor = "#ffd700";
    ctx.shadowBlur = 8;
    ctx.fillText("SAVE TIFFANY", W / 2, H / 2 + 10);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.5 + Math.sin(titleTime * 4) * 0.5;
    ctx.font = "18px monospace";
    ctx.fillStyle = "#00ffff";
    ctx.shadowColor = "#00ffff";
    ctx.shadowBlur = 10;
    ctx.fillText("PRESS ENTER OR CLICK TO START", W / 2, H / 2 + 80);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.font = "12px monospace";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(
      "\u2190\u2192 MOVE   \u2191 JUMP   \u2193 CROUCH   Z PUNCH   X KICK   C SPECIAL",
      W / 2,
      H / 2 + 120
    );
    ctx.fillText(
      "M MUTE   ESC PAUSE   Q QUIT   GAMEPAD SUPPORTED",
      W / 2,
      H / 2 + 140
    );
    ctx.font = "11px monospace";
    ctx.fillStyle = "#ff2d95";
    ctx.shadowColor = "#ff2d95";
    ctx.shadowBlur = 6;
    ctx.fillText(
      "NOW PLAYING: AIR WOLF BY DOWNTOWN SUMMER",
      W / 2,
      H - 20
    );
    ctx.shadowBlur = 0;
  }
  /** @private Render the floor intro screen. */
  _renderFloorIntro() {
    const { ctx } = this;
    const { currentFloor, floorIntroTimer } = this._state;
    ctx.fillStyle = "#0a0015";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#ff2d95";
    ctx.font = "bold 48px monospace";
    ctx.textAlign = "center";
    ctx.shadowColor = "#ff2d95";
    ctx.shadowBlur = 20 + Math.sin(floorIntroTimer * 5) * 10;
    ctx.fillText("FLOOR " + currentFloor, W / 2, H / 2 - 10);
    ctx.shadowBlur = 0;
    ctx.font = "14px monospace";
    ctx.fillStyle = "#888";
    ctx.fillText(FLOOR_NAMES[currentFloor] || "", W / 2, H / 2 + 25);
    if (currentFloor === 1) {
      ctx.fillStyle = "#ffd700";
      ctx.fillText("TIFFANY IS WAITING...", W / 2, H / 2 + 55);
    }
  }
  /** @private Render the boss intro overlay on top of the playing scene. */
  _renderBossIntro() {
    this._renderPlaying();
    const { ctx } = this;
    const data = BOSS_DATA[this._state.currentFloor];
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#888";
    ctx.font = "18px monospace";
    ctx.fillText("YOU FACE...", W / 2, H / 2 - 40);
    ctx.fillStyle = data.accentColor;
    ctx.font = "bold 42px monospace";
    ctx.shadowColor = data.accentColor;
    ctx.shadowBlur = 25;
    ctx.fillText(data.name, W / 2, H / 2 + 20);
    ctx.shadowBlur = 0;
  }
  /** @private Render the cutscene view (player walks to Tiffany). */
  _renderCutscene() {
    const { ctx } = this;
    const {
      currentFloor,
      cutsceneTimer,
      cutscenePhase,
      cutsceneHearts
    } = this._state;
    this._drawFloorBackground();
    const meetX = W / 2;
    const isFinalFloor = currentFloor === 3;
    let playerCutX;
    if (isFinalFloor && cutscenePhase >= 2) {
      playerCutX = meetX - 20;
    } else {
      playerCutX = Math.min(meetX - 40, 100 + cutsceneTimer * 80);
    }
    let tiffanyX;
    if (isFinalFloor && cutscenePhase >= 1) {
      const runProgress = Math.min(1, (cutsceneTimer - 1) / 2);
      tiffanyX = W - 150 - runProgress * (W - 150 - meetX - 20);
      if (cutscenePhase >= 2) tiffanyX = meetX + 20;
    } else {
      tiffanyX = W - 150;
    }
    if (isFinalFloor && cutscenePhase >= 2) {
      blitSprite(
        ctx,
        "player_idle",
        PLAYER_IDLE,
        PAL_PLAYER,
        playerCutX,
        GROUND_Y2,
        false,
        false
      );
    } else {
      const cutWalkFrame = Math.floor(cutsceneTimer * 4) % 2 === 0 ? PLAYER_WALK1 : PLAYER_WALK2;
      blitSprite(
        ctx,
        "player_cutwalk" + Math.floor(cutsceneTimer * 4) % 2,
        cutWalkFrame,
        PAL_PLAYER,
        playerCutX,
        GROUND_Y2,
        false,
        false
      );
    }
    const tAlpha = Math.min(1, cutsceneTimer / 1);
    ctx.globalAlpha = tAlpha;
    this._drawTiffany(tiffanyX, GROUND_Y2);
    ctx.globalAlpha = 1;
    if (isFinalFloor && cutscenePhase >= 2) {
      ctx.save();
      ctx.shadowColor = "#ffd700";
      ctx.shadowBlur = 30;
      ctx.strokeStyle = "#ffd70044";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(meetX, GROUND_Y2 - 35, 45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    for (const h of cutsceneHearts) {
      if (h.delay > 0 || h.alpha <= 0) continue;
      this._drawHeart(h.x, h.y, h.size, h.alpha);
    }
    ctx.textAlign = "center";
    if (cutscenePhase === 2) {
      ctx.font = "bold 24px monospace";
      if (isFinalFloor) {
        ctx.fillStyle = "#ffd700";
        ctx.shadowColor = "#ffd700";
        ctx.shadowBlur = 25;
        ctx.fillText("YOU SAVED TIFFANY!", W / 2, 60);
      } else {
        ctx.fillStyle = currentFloor === 1 ? "#8b5cf6" : "#ff2d95";
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 15;
        ctx.fillText("TIFFANY!", W / 2, 60);
        ctx.font = "14px monospace";
        ctx.fillStyle = "#aaa";
        ctx.shadowBlur = 0;
        ctx.fillText(
          currentFloor === 1 ? "Shadow has taken her to the dojo..." : "She's on the rooftop!",
          W / 2,
          90
        );
      }
      ctx.shadowBlur = 0;
    }
  }
  /** @private Render the game over screen. */
  _renderGameOver() {
    const { ctx } = this;
    const { score, continues } = this._state;
    ctx.fillStyle = "#0a0015";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.font = "bold 48px monospace";
    ctx.fillStyle = "#ef4444";
    ctx.shadowColor = "#ef4444";
    ctx.shadowBlur = 20;
    ctx.fillText("GAME OVER", W / 2, H / 2 - 40);
    ctx.shadowBlur = 0;
    ctx.font = "18px monospace";
    ctx.fillStyle = "#fff";
    ctx.fillText(
      "SCORE: " + String(score).padStart(6, "0"),
      W / 2,
      H / 2 + 10
    );
    ctx.font = "14px monospace";
    if (continues > 0) {
      ctx.fillStyle = "#00ffff";
      ctx.fillText(
        "CONTINUE? (" + continues + " REMAINING)",
        W / 2,
        H / 2 + 50
      );
      ctx.fillStyle = "#aaa";
      ctx.fillText("PRESS ENTER OR CLICK", W / 2, H / 2 + 75);
    } else {
      ctx.fillStyle = "#aaa";
      ctx.fillText("PRESS ENTER OR CLICK", W / 2, H / 2 + 50);
    }
  }
  /** @private Render the victory screen. */
  _renderVictory() {
    const { ctx } = this;
    const { score, enemiesDefeated, totalHealthBonus } = this._state;
    ctx.fillStyle = "#0a0015";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.font = "bold 32px monospace";
    ctx.fillStyle = "#ff2d95";
    ctx.shadowColor = "#ff2d95";
    ctx.shadowBlur = 25;
    ctx.fillText("CONGRATULATIONS", W / 2, 60);
    ctx.shadowBlur = 0;
    ctx.font = "14px monospace";
    ctx.fillStyle = "#ffd700";
    ctx.shadowColor = "#ffd700";
    ctx.shadowBlur = 10;
    ctx.fillText("YOU SAVED TIFFANY!", W / 2, 90);
    ctx.shadowBlur = 0;
    this._drawTiffany(W / 2 + 25, 220);
    blitSprite(
      ctx,
      "player_idle",
      PLAYER_IDLE,
      PAL_PLAYER,
      W / 2 - 25,
      220,
      false,
      false
    );
    ctx.save();
    ctx.shadowColor = "#ffd700";
    ctx.shadowBlur = 30;
    ctx.strokeStyle = "#ffd70044";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W / 2, 190, 50, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.font = "16px monospace";
    ctx.textAlign = "left";
    const bx = W / 2 - 130;
    ctx.fillStyle = "#fff";
    ctx.fillText("ENEMIES DEFEATED:", bx, 280);
    ctx.fillText(String(enemiesDefeated), bx + 260, 280);
    ctx.fillText("HEALTH BONUS:", bx, 305);
    ctx.fillText(String(totalHealthBonus), bx + 260, 305);
    ctx.fillText("TOTAL SCORE:", bx, 345);
    ctx.fillStyle = "#ff2d95";
    ctx.font = "bold 20px monospace";
    ctx.fillText(String(score).padStart(6, "0"), bx + 260, 345);
    ctx.textAlign = "center";
    ctx.font = "14px monospace";
    ctx.fillStyle = "#888";
    ctx.fillText("PRESS ENTER OR CLICK TO RETURN", W / 2, H - 40);
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
    const { ctx } = this;
    const frame = this._getPlayerFrame(p);
    const data = PLAYER_FRAMES[frame];
    const flip = p.facing < 0;
    const glow = p.invincible && Math.floor(this._state.gameTime * 12) % 2 ? 0.4 : 1;
    ctx.save();
    ctx.globalAlpha = glow;
    ctx.shadowColor = "#00ffff";
    ctx.shadowBlur = 6;
    blitSprite(
      ctx,
      "player_" + frame,
      data,
      PAL_PLAYER,
      p.x,
      GROUND_Y2 + p.y,
      flip,
      false
    );
    ctx.restore();
  }
  /**
   * Draw an enemy sprite.
   *
   * @private
   * @param {Object} e - Enemy state object
   */
  _drawEnemy(e) {
    const { ctx } = this;
    const frame = this._getEnemyFrame(e);
    const { pal, frames } = this._getEnemyPalAndFrames(e);
    const data = frames[frame] || frames.walk1;
    const flip = e.facing < 0;
    const isFlash = e.flashTimer > 0;
    ctx.save();
    if (e.state === "dead") ctx.globalAlpha = Math.max(0, e.stateTimer / 0.4);
    blitSprite(
      ctx,
      e.type + "_" + frame,
      data,
      pal,
      e.x,
      GROUND_Y2 + e.y,
      flip,
      isFlash
    );
    ctx.restore();
  }
  /** @private Draw all projectiles (knives and boss energy bolts). */
  _drawProjectiles() {
    const { ctx } = this;
    for (const p of this._state.projectiles) {
      ctx.save();
      ctx.shadowColor = p.isBoss ? "#ff2d95" : "#00ffff";
      ctx.shadowBlur = 10;
      ctx.fillStyle = p.isBoss ? "#ff2d95" : "#00ffff";
      ctx.fillRect(p.x - 6, p.y - 2, 12, 4);
      ctx.restore();
    }
  }
  /** @private Draw the boss sprite with glow aura. */
  _drawBoss() {
    const boss = this._state.boss;
    if (!boss) return;
    const { ctx } = this;
    const currentFloor = this._state.currentFloor;
    const frame = this._getBossFrame(boss);
    const frames = BOSS_FRAMES[currentFloor];
    const data = frames[frame] || frames.idle;
    const pal = BOSS_PALS[currentFloor];
    const flip = boss.facing < 0;
    const isFlash = boss.flashTimer > 0;
    ctx.save();
    if (boss.state === "teleport" && boss._teleporting) ctx.globalAlpha = 0.3;
    ctx.shadowColor = boss.accentColor;
    ctx.shadowBlur = boss.state === "attack" || boss.state === "special" ? 20 : 8;
    blitSprite(
      ctx,
      "boss" + currentFloor + "_" + frame,
      data,
      pal,
      boss.x,
      GROUND_Y2,
      flip,
      isFlash
    );
    ctx.restore();
  }
  /**
   * Draw Tiffany sprite at the given position.
   *
   * @private
   * @param {number} x - Horizontal center position
   * @param {number} y - Bottom edge position
   */
  _drawTiffany(x, y) {
    const { ctx } = this;
    ctx.save();
    ctx.shadowColor = "#ffd700";
    ctx.shadowBlur = 12;
    blitSprite(
      ctx,
      "tiffany",
      TIFFANY_STAND,
      PAL_TIFFANY,
      x,
      y,
      false,
      false
    );
    ctx.restore();
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
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#ff2d95";
    ctx.shadowColor = "#ff2d95";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(x, y + size * 0.3);
    ctx.bezierCurveTo(x, y, x - size, y, x - size, y + size * 0.3);
    ctx.bezierCurveTo(
      x - size,
      y + size * 0.7,
      x,
      y + size,
      x,
      y + size * 1.2
    );
    ctx.bezierCurveTo(
      x,
      y + size,
      x + size,
      y + size * 0.7,
      x + size,
      y + size * 0.3
    );
    ctx.bezierCurveTo(x + size, y, x, y, x, y + size * 0.3);
    ctx.fill();
    ctx.restore();
  }
  // ---------------------------------------------------------------------------
  // Drawing helpers -- backgrounds
  // ---------------------------------------------------------------------------
  /** @private Draw the background for the current floor. */
  _drawFloorBackground() {
    switch (this._state.currentFloor) {
      case 1:
        this._drawStreetBackground();
        break;
      case 2:
        this._drawDojoBackground();
        break;
      case 3:
        this._drawRooftopBackground();
        break;
    }
  }
  /** @private Draw the street scene (Floor 1). */
  _drawStreetBackground() {
    const { ctx } = this;
    const px = this._state.player.x;
    ctx.fillStyle = this._streetSkyGrad;
    ctx.fillRect(0, 0, W, GROUND_Y2);
    ctx.fillStyle = "#120830";
    STREET_SKYLINE_X.forEach((bx, i) => {
      const h = 60 + i % 3 * 30;
      const ox = ((bx - px * 0.1) % (W + 100) + W + 100) % (W + 100) - 50;
      ctx.fillRect(ox, GROUND_Y2 - h, 50, h);
    });
    ctx.save();
    STREET_BUILDINGS_X.forEach((bx, i) => {
      const h = 80 + i % 4 * 25;
      const w = 70 + i % 2 * 20;
      const ox = ((bx - px * 0.3) % (W + 120) + W + 120) % (W + 120) - 60;
      ctx.fillStyle = "#1a0a2e";
      ctx.fillRect(ox, GROUND_Y2 - h, w, h);
      ctx.fillStyle = "#2a1a4e";
      for (let wy = GROUND_Y2 - h + 10; wy < GROUND_Y2 - 10; wy += 18) {
        for (let j = 0; j < Math.floor((w - 16) / 16) + 1; j++) {
          const wx = ox + 8 + j * 16;
          const worldX = bx + 8 + j * 16;
          ctx.fillStyle = Math.sin(worldX * 7 + wy * 3) > 0.3 ? "#ffcc44" : "#2a1a4e";
          ctx.fillRect(wx, wy, 8, 10);
        }
      }
      ctx.fillStyle = NEON_COLORS[i % 4];
      ctx.shadowColor = NEON_COLORS[i % 4];
      ctx.shadowBlur = 15;
      ctx.fillRect(ox + 10, GROUND_Y2 - h - 8, w - 20, 6);
      ctx.shadowBlur = 0;
    });
    ctx.restore();
    ctx.fillStyle = this._streetFloorGrad;
    ctx.fillRect(0, GROUND_Y2, W, H - GROUND_Y2);
    ctx.strokeStyle = "#ff2d95";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#ff2d95";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y2);
    ctx.lineTo(W, GROUND_Y2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  /** @private Draw the dojo scene (Floor 2). */
  _drawDojoBackground() {
    const { ctx } = this;
    const px = this._state.player.x;
    ctx.fillStyle = "#0d0d1a";
    ctx.fillRect(0, 0, W, GROUND_Y2);
    ctx.save();
    for (let i = 0; i < 5; i++) {
      const sx = ((i * 180 - px * 0.1) % (W + 200) + W + 200) % (W + 200) - 100;
      ctx.fillStyle = "#2a1a3a";
      ctx.fillRect(sx, 40, 30, 80);
      ctx.fillStyle = "#3a2a4a";
      ctx.fillRect(sx + 5, 50, 20, 60);
      ctx.fillStyle = "#1a1a2e";
      for (let j = 0; j < 3; j++) ctx.fillRect(sx + 8, 55 + j * 18, 14, 2);
    }
    for (let i = 0; i < 6; i++) {
      const ox = ((i * 160 - px * 0.3) % (W + 180) + W + 180) % (W + 180) - 40;
      ctx.fillStyle = "#3d2b1f";
      ctx.fillRect(ox, 20, 18, GROUND_Y2 - 20);
      ctx.strokeStyle = "#5a3d2b";
      ctx.lineWidth = 1;
      ctx.strokeRect(ox, 20, 18, GROUND_Y2 - 20);
      ctx.fillStyle = "#ff6b35";
      ctx.shadowColor = "#ff6b35";
      ctx.shadowBlur = 20;
      ctx.fillRect(ox + 60, 50, 16, 22);
      ctx.fillStyle = "#ffcc44";
      ctx.fillRect(ox + 63, 54, 10, 14);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
    ctx.fillStyle = "#2d1b0e";
    ctx.fillRect(0, GROUND_Y2, W, H - GROUND_Y2);
    ctx.strokeStyle = "#3d2b1f";
    ctx.lineWidth = 1;
    for (let y = GROUND_Y2 + 8; y < H; y += 12) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "#8b5cf6";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#8b5cf6";
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y2);
    ctx.lineTo(W, GROUND_Y2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  /** @private Draw the rooftop scene (Floor 3). */
  _drawRooftopBackground() {
    const { ctx } = this;
    ctx.fillStyle = this._rooftopSkyGrad;
    ctx.fillRect(0, 0, W, GROUND_Y2);
    const sunX = W / 2, sunY = GROUND_Y2 - 20, sunR = 60;
    ctx.save();
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, Math.PI, 0);
    ctx.clip();
    const sunGrad = ctx.createLinearGradient(
      sunX,
      sunY - sunR,
      sunX,
      sunY
    );
    sunGrad.addColorStop(0, "#ff2d95");
    sunGrad.addColorStop(1, "#ff6b35");
    ctx.fillStyle = sunGrad;
    ctx.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR);
    ctx.fillStyle = "#0a0020";
    for (let y = sunY - sunR + 10; y < sunY; y += 8) {
      const sh = Math.max(1, (y - (sunY - sunR)) / sunR * 4);
      ctx.fillRect(sunX - sunR, y, sunR * 2, sh);
    }
    ctx.restore();
    ctx.save();
    ctx.shadowColor = "#ff6b35";
    ctx.shadowBlur = 40;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR + 2, Math.PI, 0);
    ctx.strokeStyle = "#ff6b3566";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#1a0a2e";
    ROOFTOP_SKYLINE_X.forEach((bx, i) => {
      const h = 15 + i % 3 * 12;
      ctx.fillRect(bx, GROUND_Y2 - h - 5, 40, h);
    });
    ctx.fillStyle = "#111";
    ctx.fillRect(0, GROUND_Y2, W, H - GROUND_Y2);
    ctx.strokeStyle = "#ff2d9533";
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const y = GROUND_Y2 + i * i * 0.5;
      if (y > H) break;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    for (let i = -8; i <= 8; i++) {
      ctx.beginPath();
      ctx.moveTo(W / 2 + i * 5, GROUND_Y2);
      ctx.lineTo(W / 2 + i * 80, H);
      ctx.stroke();
    }
    ctx.strokeStyle = "#00ffff";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#00ffff";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y2);
    ctx.lineTo(W, GROUND_Y2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  // ---------------------------------------------------------------------------
  // Drawing helpers -- particles and effects
  // ---------------------------------------------------------------------------
  /** @private Draw all game particles (ambient + hit effects). */
  _drawParticles() {
    const { ctx } = this;
    for (const p of this._state.gameParticles) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life / (p.maxLife || 1));
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.fillRect(p.x, p.y, p.size, p.size);
      ctx.restore();
    }
  }
  /** @private Apply screen shake transform to the canvas. */
  _applyShake() {
    const shakeAmount = this._state.shakeAmount;
    if (shakeAmount > 0) {
      this.ctx.translate(
        (Math.random() - 0.5) * shakeAmount * 2,
        (Math.random() - 0.5) * shakeAmount * 2
      );
    }
  }
  // ---------------------------------------------------------------------------
  // Drawing helpers -- HUD
  // ---------------------------------------------------------------------------
  /** @private Draw the heads-up display (health, lives, score, boss bar, floor). */
  _drawHUD() {
    const { ctx } = this;
    const { player, lives, score, boss, currentFloor } = this._state;
    ctx.save();
    ctx.shadowBlur = 0;
    const hbX = 15, hbY = 15, hbW = 180, hbH = 14;
    ctx.fillStyle = "#222";
    ctx.fillRect(hbX, hbY, hbW, hbH);
    const hp = player.health / player.maxHealth;
    const hc = hp > 0.5 ? "#34d399" : hp > 0.25 ? "#fbbf24" : "#ef4444";
    ctx.fillStyle = hc;
    ctx.shadowColor = hc;
    ctx.shadowBlur = 8;
    ctx.fillRect(hbX, hbY, hbW * hp, hbH);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1;
    ctx.strokeRect(hbX, hbY, hbW, hbH);
    ctx.fillStyle = "#ff2d95";
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    for (let i = 0; i < lives; i++)
      ctx.fillText("\u2665", hbX + i * 18, hbY + hbH + 16);
    const seY = hbY + hbH + 24;
    for (let i = 0; i < player.maxSpecialEnergy; i++) {
      ctx.fillStyle = "#222";
      ctx.fillRect(hbX + i * 36, seY, 30, 6);
      if (player.specialEnergy > i) {
        const fill = Math.min(1, player.specialEnergy - i);
        ctx.fillStyle = "#00ffff";
        ctx.shadowColor = "#00ffff";
        ctx.shadowBlur = 6;
        ctx.fillRect(hbX + i * 36, seY, 30 * fill, 6);
        ctx.shadowBlur = 0;
      }
      ctx.strokeStyle = "#444";
      ctx.strokeRect(hbX + i * 36, seY, 30, 6);
    }
    ctx.textAlign = "right";
    ctx.fillStyle = "#fff";
    ctx.font = "14px monospace";
    ctx.shadowColor = "#ff2d95";
    ctx.shadowBlur = 4;
    ctx.fillText("SCORE " + String(score).padStart(6, "0"), W - 15, 28);
    ctx.shadowBlur = 0;
    if (boss) {
      const bbW = 200, bbH = 12;
      const bbX = (W - bbW) / 2, bbY = 15;
      ctx.textAlign = "center";
      ctx.fillStyle = boss.accentColor;
      ctx.font = "bold 12px monospace";
      ctx.fillText(boss.name, W / 2, bbY - 4);
      ctx.fillStyle = "#222";
      ctx.fillRect(bbX, bbY, bbW, bbH);
      ctx.fillStyle = "#ef4444";
      ctx.shadowColor = "#ef4444";
      ctx.shadowBlur = 8;
      ctx.fillRect(bbX, bbY, bbW * (boss.health / boss.maxHealth), bbH);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#555";
      ctx.strokeRect(bbX, bbY, bbW, bbH);
    }
    ctx.textAlign = "center";
    ctx.fillStyle = "#555";
    ctx.font = "10px monospace";
    ctx.fillText("FLOOR " + currentFloor, W / 2, H - 10);
    ctx.restore();
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
    if (p.state === "hurt") return "hurt";
    if (p.state === "special") return "special";
    if (p.state === "crouch_attack") return "crouch_atk";
    if (p.crouching || p.state === "crouch") return "crouch";
    if (p.state === "jump_kick") return "jumpkick";
    if (p.state === "kick") return "kick";
    if (p.state === "punch") return "punch";
    if (p.state === "walk")
      return Math.floor(this._state.gameTime * 6) % 2 === 0 ? "walk1" : "walk2";
    return "idle";
  }
  /**
   * Get the sprite frame key for an enemy.
   *
   * @private
   * @param {Object} e - Enemy state object
   * @returns {string} Frame key
   */
  _getEnemyFrame(e) {
    if (e.state === "hurt" || e.state === "dead") return "hurt";
    if (e.type === "grabber" && (e.state === "attack" || e.grabbing))
      return "grab";
    if (e.type === "knife_thrower" && e.state === "attack") return "throw";
    if (e.type === "acrobat" && e.airborne) return "flip";
    if (e.state === "attack") return "attack";
    if (e.state === "walk")
      return Math.floor(this._state.gameTime * 5) % 2 === 0 ? "walk1" : "walk2";
    return "walk1";
  }
  /**
   * Get the palette and frame map for an enemy type.
   *
   * @private
   * @param {Object} e - Enemy state object
   * @returns {{ pal: Object, frames: Object }}
   */
  _getEnemyPalAndFrames(e) {
    return ENEMY_PAL_AND_FRAMES[e.type] || ENEMY_PAL_AND_FRAMES.grunt;
  }
  /**
   * Get the sprite frame key for the boss.
   *
   * @private
   * @param {Object} boss - Boss state object
   * @returns {string} Frame key into Sprites.BOSS_FRAMES
   */
  _getBossFrame(boss) {
    if (!boss) return "idle";
    if (boss.state === "charge") return "charge";
    if (boss.state === "attack") return "attack";
    if (boss.state === "ranged") return "ranged";
    if (boss.state === "special") return "special";
    if (boss.state === "teleport") return "attack";
    return "idle";
  }
};
export {
  AudioManager,
  BaseEngine,
  config_exports as BaymanConfig,
  BaymanEngine,
  BaymanRenderer,
  config_exports2 as CodJiggerConfig,
  CodJiggerEngine,
  CodJiggerRenderer,
  GameHost,
  InputManager,
  config_exports5 as KungFuConfig,
  KungFuEngine,
  KungFuRenderer,
  config_exports3 as OverboardConfig,
  OverboardEngine,
  OverboardRenderer,
  ParticleSystem,
  SpriteManager,
  SpriteSheet,
  config_exports4 as WoodpileConfig,
  WoodpileEngine,
  WoodpileRenderer,
  loadAssets
};
//# sourceMappingURL=outport-arcade.esm.js.map
