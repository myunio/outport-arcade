/**
 * Three-channel audio engine built on Web Audio API.
 *
 * Architecture:
 *   AudioManager
 *     ├── MusicChannel    — one track at a time, crossfade support
 *     ├── AmbientChannel  — looping background layer
 *     └── EffectsPool     — multiple simultaneous short sounds
 *
 * All audio content is produced by Sevenview Studios (Clint and Elliott).
 * The engine supports production-grade layered audio: music, ambient,
 * and effects playing simultaneously with independent volume controls.
 *
 * Volume settings persist in localStorage across sessions.
 *
 * @example
 * const audio = new AudioManager(new AudioContext())
 * await audio.loadBuffer("splash", arrayBuffer)
 * audio.effects.play("splash")
 * audio.music.play("theme")
 * audio.setMasterVolume(0.8)
 *
 * @module games/engine/audio
 */

/** @type {string} Default localStorage key for volume settings. */
const DEFAULT_STORAGE_KEY = "outport_arcade_audio"

/**
 * Clamp a number to [min, max].
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

/**
 * Load saved volume settings from localStorage.
 *
 * @param {string} key - localStorage key
 * @returns {Object|null}
 */
function loadStoredVolumes(key) {
  try {
    const stored = localStorage?.getItem(key)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

/**
 * Save volume settings to localStorage.
 *
 * @param {string} key - localStorage key
 * @param {Object} volumes
 */
function saveVolumes(key, volumes) {
  try {
    localStorage?.setItem(key, JSON.stringify(volumes))
  } catch {
    // localStorage unavailable — silently continue
  }
}

/**
 * Effects pool — plays short one-shot sounds with optional overlap.
 */
class EffectsPool {
  /**
   * @param {AudioContext} ctx
   * @param {GainNode} outputNode
   * @param {Map<string, AudioBuffer>} buffers
   */
  constructor(ctx, outputNode, buffers) {
    this._ctx = ctx
    this._output = outputNode
    this._buffers = buffers
    this.volume = 1.0
    this._gain = ctx.createGain()
    this._gain.connect(outputNode)
  }

  /**
   * Play a sound effect by name.
   *
   * @param {string} name - Buffer name
   * @param {Object} [options]
   * @param {number} [options.pitchVariance=0] - Random pitch variation (e.g., 0.1 = +/-10%)
   */
  play(name, { pitchVariance = 0 } = {}) {
    const buffer = this._buffers.get(name)
    if (!buffer) {
      console.warn(`[AudioManager] No buffer loaded for effect: ${name}`)
      return
    }

    const source = this._ctx.createBufferSource()
    source.buffer = buffer
    if (pitchVariance > 0) {
      source.playbackRate.value = 1 + (Math.random() - 0.5) * 2 * pitchVariance
    }
    source.connect(this._gain)
    source.start()
  }

  /** @param {number} v - Volume 0-1. */
  setVolume(v) {
    this.volume = clamp(v, 0, 1)
    this._gain.gain.value = this.volume
  }
}

/**
 * Single-track channel for music or ambient audio.
 * Supports play, stop, crossfade, and looping.
 */
class AudioChannel {
  /**
   * @param {AudioContext} ctx
   * @param {GainNode} outputNode
   * @param {Map<string, AudioBuffer>} buffers
   * @param {boolean} [loop=true]
   */
  constructor(ctx, outputNode, buffers, loop = true) {
    this._ctx = ctx
    this._output = outputNode
    this._buffers = buffers
    this._loop = loop
    this._source = null
    this.volume = 1.0
    this._gain = ctx.createGain()
    this._gain.connect(outputNode)
    this._currentTrack = null
  }

  /**
   * Play a track by name. Stops any currently playing track.
   *
   * @param {string} name - Buffer name
   */
  play(name) {
    this.stop()
    const buffer = this._buffers.get(name)
    if (!buffer) {
      console.warn(`[AudioManager] No buffer loaded for track: ${name}`)
      return
    }

    this._source = this._ctx.createBufferSource()
    this._source.buffer = buffer
    this._source.loop = this._loop
    this._source.connect(this._gain)
    this._source.start()
    this._currentTrack = name
  }

  /**
   * Crossfade to a new track over the given duration.
   *
   * @param {string} name - Buffer name to crossfade to
   * @param {number} [duration=1.0] - Crossfade duration in seconds
   */
  crossfadeTo(name, duration = 1.0) {
    if (this._currentTrack === name) return

    const buffer = this._buffers.get(name)
    if (!buffer) {
      console.warn(`[AudioManager] No buffer loaded for track: ${name}`)
      return
    }

    // Fade out current
    if (this._source) {
      const oldGain = this._ctx.createGain()
      oldGain.gain.setValueAtTime(this.volume, this._ctx.currentTime)
      oldGain.gain.linearRampToValueAtTime(0, this._ctx.currentTime + duration)
      oldGain.connect(this._output)

      const oldSource = this._source
      oldSource.disconnect()
      oldSource.connect(oldGain)
      setTimeout(() => {
        try { oldSource.stop() } catch { /* already stopped */ }
      }, duration * 1000)
    }

    // Fade in new
    this._gain.gain.setValueAtTime(0, this._ctx.currentTime)
    this._gain.gain.linearRampToValueAtTime(this.volume, this._ctx.currentTime + duration)

    this._source = this._ctx.createBufferSource()
    this._source.buffer = buffer
    this._source.loop = this._loop
    this._source.connect(this._gain)
    this._source.start()
    this._currentTrack = name
  }

  /** Stop the current track. */
  stop() {
    if (this._source) {
      try { this._source.stop() } catch { /* already stopped */ }
      this._source = null
      this._currentTrack = null
    }
  }

  /** @param {number} v - Volume 0-1. */
  setVolume(v) {
    this.volume = clamp(v, 0, 1)
    this._gain.gain.value = this.volume
  }
}

export class AudioManager {
  /**
   * @param {AudioContext} ctx - Web Audio API context
   */
  constructor(ctx) {
    this._ctx = ctx
    this._buffers = new Map()
    this._storageKey = null

    // Master gain node
    this._masterGain = ctx.createGain()
    this._masterGain.connect(ctx.destination)

    // Restore saved volumes
    const saved = loadStoredVolumes(this.storageKey)

    this.masterVolume = saved?.master ?? 1.0
    this.muted = saved?.muted ?? false
    this._masterGain.gain.value = this.muted ? 0 : this.masterVolume

    /** @type {EffectsPool} Sound effects channel. */
    this.effects = new EffectsPool(ctx, this._masterGain, this._buffers)
    this.effects.setVolume(saved?.effects ?? 1.0)

    /** @type {AudioChannel} Music channel — one track at a time. */
    this.music = new AudioChannel(ctx, this._masterGain, this._buffers, true)
    this.music.setVolume(saved?.music ?? 0.6)

    /** @type {AudioChannel} Ambient channel — looping background layer. */
    this.ambient = new AudioChannel(ctx, this._masterGain, this._buffers, true)
    this.ambient.setVolume(saved?.ambient ?? 0.4)
  }

  /** @param {string} key - Custom localStorage key for volume persistence. */
  set storageKey(key) { this._storageKey = key }

  /** @returns {string} Current localStorage key for volume persistence. */
  get storageKey() { return this._storageKey || DEFAULT_STORAGE_KEY }

  /**
   * Set master volume (affects all channels).
   *
   * @param {number} v - Volume 0-1
   */
  setMasterVolume(v) {
    this.masterVolume = clamp(v, 0, 1)
    this._masterGain.gain.value = this.masterVolume
    this._saveVolumes()
  }

  /**
   * Load and decode an audio buffer.
   *
   * @param {string} name - Logical name (e.g., "splash")
   * @param {ArrayBuffer} arrayBuffer - Raw audio data
   */
  async loadBuffer(name, arrayBuffer) {
    const decoded = await this._ctx.decodeAudioData(arrayBuffer)
    this._buffers.set(name, decoded)
  }

  /**
   * Check if a buffer is loaded.
   *
   * @param {string} name
   * @returns {boolean}
   */
  hasBuffer(name) {
    return this._buffers.has(name)
  }

  /**
   * Toggle mute on/off. Preserves volume setting so unmuting
   * restores the previous level.
   *
   * @returns {boolean} New muted state
   */
  toggleMute() {
    this.muted = !this.muted
    this._masterGain.gain.value = this.muted ? 0 : this.masterVolume
    this._saveVolumes()
    return this.muted
  }

  /** Suspend all audio (for pause). Resumes exactly where it left off. */
  suspend() {
    this._ctx.suspend()
  }

  /** Resume audio after suspend. */
  resume() {
    this._ctx.resume()
  }

  /** Stop all audio across all channels. */
  stopAll() {
    this.music.stop()
    this.ambient.stop()
  }

  /** @private Persist current volume settings. */
  _saveVolumes() {
    saveVolumes(this.storageKey, {
      master: this.masterVolume,
      muted: this.muted,
      effects: this.effects.volume,
      music: this.music.volume,
      ambient: this.ambient.volume,
    })
  }
}
