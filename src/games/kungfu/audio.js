/**
 * Kung Fu Overdrive — Audio System
 *
 * Synthesized sound effects via Web Audio API and MP3 soundtrack playback.
 * All SFX are generated procedurally — no audio files needed for effects.
 *
 * Usage:
 *   const audio = new KungFuAudio()
 *   audio.init()                    // Call from a user gesture to unlock Web Audio
 *   audio.loadSoundtrack(url)       // Pass fingerprinted asset URL for the MP3
 *   audio.playSound('punch')        // Trigger a named SFX
 *   audio.retrySoundtrack()         // Call on user interaction if autoplay was blocked
 *   audio.toggleMute()              // Toggle SFX + soundtrack mute
 *   audio.destroy()                 // Release all resources
 *
 * @module kungfu/audio
 */

export class KungFuAudio {
  /** @type {AudioContext|null} */
  #ctx = null

  /** @type {HTMLAudioElement} */
  #musicPlayer

  /** @type {boolean} */
  #muted = false

  /** @type {number} */
  #musicVolume = 0.5

  constructor() {
    this.#musicPlayer = new Audio()
    this.#musicPlayer.loop = true
    this.#musicPlayer.volume = this.#musicVolume
  }

  /**
   * Initialize the Web Audio context. Must be called from a user gesture
   * (click, keydown, etc.) to satisfy browser autoplay policies.
   */
  init() {
    if (this.#ctx) return
    this.#ctx = new (window.AudioContext || window.webkitAudioContext)()
  }

  /**
   * Load and start the soundtrack from a URL.
   * @param {string} url - Fingerprinted asset URL for the MP3
   */
  loadSoundtrack(url) {
    this.#musicPlayer.src = url
    this.#musicPlayer.play().catch(() => {})
  }

  /**
   * Retry soundtrack playback. Call on user interaction if autoplay was blocked.
   */
  retrySoundtrack() {
    if (this.#musicPlayer.src && this.#musicPlayer.paused) {
      this.#musicPlayer.play().catch(() => {})
    }
  }

  /**
   * Play a named sound effect.
   * @param {string} type - Sound effect name (punch, kick, enemy_hit, enemy_defeat,
   *   player_hurt, special, boss_intro, boss_defeat, knife, grab_escape, kiai)
   */
  playSound(type) {
    if (!this.#ctx || this.#muted) return
    try {
      switch (type) {
        case 'punch': this.#playSfxPunch(); break
        case 'kick': this.#playSfxKick(); break
        case 'enemy_hit': this.#playSfxEnemyHit(); break
        case 'enemy_defeat': this.#playSfxEnemyDefeat(); break
        case 'player_hurt': this.#playSfxPlayerHurt(); break
        case 'special': this.#playSfxSpecial(); break
        case 'boss_intro': this.#playSfxBossIntro(); break
        case 'boss_defeat': this.#playSfxBossDefeat(); break
        case 'knife': this.#playSfxKnife(); break
        case 'grab_escape': this.#playSfxGrabEscape(); break
        case 'kiai': this.#playSfxKiai(); break
      }
    } catch (e) { /* ignore audio errors */ }
  }

  /**
   * Suspend audio playback. Called by BaseEngine on pause.
   */
  suspend() {
    this.#musicPlayer.pause()
    if (this.#ctx) this.#ctx.suspend().catch(() => {})
  }

  /**
   * Resume audio playback. Called by BaseEngine on resume.
   */
  resume() {
    if (!this.#muted) {
      this.#musicPlayer.play().catch(() => {})
    }
    if (this.#ctx) this.#ctx.resume().catch(() => {})
  }

  /** Stop all audio playback. Called by BaseController on teardown. */
  stopAll() {
    this.#musicPlayer.pause()
    if (this.#ctx) this.#ctx.suspend().catch(() => {})
  }

  /**
   * Toggle mute for both SFX and soundtrack.
   */
  toggleMute() {
    this.#muted = !this.#muted
    this.#musicPlayer.muted = this.#muted
  }

  /** @returns {boolean} Whether audio is currently muted */
  get muted() { return this.#muted }

  /**
   * Stop all audio and release resources. Call when the game is torn down.
   */
  destroy() {
    this.#musicPlayer.pause()
    this.#musicPlayer.src = ''
    if (this.#ctx) {
      this.#ctx.close().catch(() => {})
      this.#ctx = null
    }
  }

  // ============================================================
  // Private SFX methods
  // ============================================================

  /**
   * Karate vocal shout — formant synthesis with three randomized shout types.
   * Uses two oscillators (sawtooth + square) plus breathiness noise, shaped
   * through a bandpass filter with a short envelope.
   */
  #playSfxKiai() {
    const t = this.#ctx.currentTime
    const dur = 0.12 + Math.random() * 0.08
    // Pick a random shout type
    const type = Math.floor(Math.random() * 3)
    const baseFreq = type === 0 ? 400 : type === 1 ? 500 : 350
    const endFreq = type === 0 ? 700 : type === 1 ? 300 : 600

    // Voice oscillator 1 (main tone)
    const osc1 = this.#ctx.createOscillator()
    osc1.type = 'sawtooth'
    osc1.frequency.setValueAtTime(baseFreq, t)
    osc1.frequency.exponentialRampToValueAtTime(endFreq, t + dur)

    // Voice oscillator 2 (formant)
    const osc2 = this.#ctx.createOscillator()
    osc2.type = 'square'
    osc2.frequency.setValueAtTime(baseFreq * 1.5, t)
    osc2.frequency.exponentialRampToValueAtTime(endFreq * 1.2, t + dur)

    // Noise for breathiness
    const noiseLen = this.#ctx.sampleRate * dur
    const noiseBuf = this.#ctx.createBuffer(1, noiseLen, this.#ctx.sampleRate)
    const noiseData = noiseBuf.getChannelData(0)
    for (let i = 0; i < noiseLen; i++) noiseData[i] = (Math.random() * 2 - 1) * 0.3
    const noise = this.#ctx.createBufferSource()
    noise.buffer = noiseBuf

    // Bandpass filter to shape the vocal sound
    const filter = this.#ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(baseFreq * 2, t)
    filter.frequency.exponentialRampToValueAtTime(endFreq * 1.5, t + dur)
    filter.Q.value = 3

    // Envelope
    const gain = this.#ctx.createGain()
    gain.gain.setValueAtTime(0.001, t)
    gain.gain.linearRampToValueAtTime(0.25, t + 0.02)
    gain.gain.setValueAtTime(0.25, t + dur * 0.6)
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur)

    // Connect
    osc1.connect(filter)
    osc2.connect(filter)
    noise.connect(filter)
    filter.connect(gain).connect(this.#ctx.destination)

    osc1.start(t); osc1.stop(t + dur)
    osc2.start(t); osc2.stop(t + dur)
    noise.start(t); noise.stop(t + dur)
  }

  /** Square wave dropping from 150 Hz to 50 Hz over 100 ms — short impact thud. */
  #playSfxPunch() {
    const osc = this.#ctx.createOscillator()
    const gain = this.#ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(150, this.#ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(50, this.#ctx.currentTime + 0.08)
    gain.gain.setValueAtTime(0.3, this.#ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, this.#ctx.currentTime + 0.1)
    osc.connect(gain).connect(this.#ctx.destination)
    osc.start(); osc.stop(this.#ctx.currentTime + 0.1)
  }

  /** Square wave dropping from 100 Hz to 40 Hz over 150 ms — heavier kick impact. */
  #playSfxKick() {
    const osc = this.#ctx.createOscillator()
    const gain = this.#ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(100, this.#ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(40, this.#ctx.currentTime + 0.12)
    gain.gain.setValueAtTime(0.3, this.#ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, this.#ctx.currentTime + 0.15)
    osc.connect(gain).connect(this.#ctx.destination)
    osc.start(); osc.stop(this.#ctx.currentTime + 0.15)
  }

  /** Short white noise burst — enemy flinch hit sound. */
  #playSfxEnemyHit() {
    const bufferSize = this.#ctx.sampleRate * 0.05
    const buffer = this.#ctx.createBuffer(1, bufferSize, this.#ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
    const source = this.#ctx.createBufferSource()
    const gain = this.#ctx.createGain()
    source.buffer = buffer
    gain.gain.setValueAtTime(0.15, this.#ctx.currentTime)
    source.connect(gain).connect(this.#ctx.destination)
    source.start()
  }

  /**
   * Two-layer defeat sound — low sine drop (thud) plus sawtooth high sweep (crack).
   * Layered to give a satisfying "enemy down" feel.
   */
  #playSfxEnemyDefeat() {
    const osc = this.#ctx.createOscillator()
    const gain = this.#ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(80, this.#ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(20, this.#ctx.currentTime + 0.2)
    gain.gain.setValueAtTime(0.3, this.#ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, this.#ctx.currentTime + 0.25)
    osc.connect(gain).connect(this.#ctx.destination)
    osc.start(); osc.stop(this.#ctx.currentTime + 0.25)
    const osc2 = this.#ctx.createOscillator()
    const gain2 = this.#ctx.createGain()
    osc2.type = 'sawtooth'
    osc2.frequency.setValueAtTime(800, this.#ctx.currentTime)
    osc2.frequency.exponentialRampToValueAtTime(200, this.#ctx.currentTime + 0.1)
    gain2.gain.setValueAtTime(0.1, this.#ctx.currentTime)
    gain2.gain.exponentialRampToValueAtTime(0.001, this.#ctx.currentTime + 0.12)
    osc2.connect(gain2).connect(this.#ctx.destination)
    osc2.start(); osc2.stop(this.#ctx.currentTime + 0.12)
  }

  /** Deep sine drop from 60 Hz to 30 Hz — low gut-punch player damage sound. */
  #playSfxPlayerHurt() {
    const osc = this.#ctx.createOscillator()
    const gain = this.#ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(60, this.#ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(30, this.#ctx.currentTime + 0.15)
    gain.gain.setValueAtTime(0.25, this.#ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, this.#ctx.currentTime + 0.2)
    osc.connect(gain).connect(this.#ctx.destination)
    osc.start(); osc.stop(this.#ctx.currentTime + 0.2)
  }

  /** Sawtooth sweep from 400 Hz down to 100 Hz over 500 ms — special move whoosh. */
  #playSfxSpecial() {
    const osc = this.#ctx.createOscillator()
    const gain = this.#ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(400, this.#ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(100, this.#ctx.currentTime + 0.4)
    gain.gain.setValueAtTime(0.2, this.#ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, this.#ctx.currentTime + 0.5)
    osc.connect(gain).connect(this.#ctx.destination)
    osc.start(); osc.stop(this.#ctx.currentTime + 0.5)
  }

  /** Low sawtooth rumble with a 55/65 Hz oscillation over 1 second — ominous boss entrance. */
  #playSfxBossIntro() {
    const osc = this.#ctx.createOscillator()
    const gain = this.#ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(55, this.#ctx.currentTime)
    osc.frequency.setValueAtTime(65, this.#ctx.currentTime + 0.3)
    osc.frequency.setValueAtTime(55, this.#ctx.currentTime + 0.6)
    gain.gain.setValueAtTime(0.001, this.#ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.3, this.#ctx.currentTime + 0.2)
    gain.gain.linearRampToValueAtTime(0.3, this.#ctx.currentTime + 0.6)
    gain.gain.exponentialRampToValueAtTime(0.001, this.#ctx.currentTime + 1.0)
    osc.connect(gain).connect(this.#ctx.destination)
    osc.start(); osc.stop(this.#ctx.currentTime + 1.0)
  }

  /** Long decaying noise burst (600 ms) with quadratic envelope — explosive boss defeat. */
  #playSfxBossDefeat() {
    const bufferSize = this.#ctx.sampleRate * 0.6
    const buffer = this.#ctx.createBuffer(1, bufferSize, this.#ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2)
    const source = this.#ctx.createBufferSource()
    const gain = this.#ctx.createGain()
    source.buffer = buffer
    gain.gain.setValueAtTime(0.4, this.#ctx.currentTime)
    source.connect(gain).connect(this.#ctx.destination)
    source.start()
  }

  /** High sine ping from 1200 Hz to 600 Hz over 80 ms — sharp knife throw swish. */
  #playSfxKnife() {
    const osc = this.#ctx.createOscillator()
    const gain = this.#ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1200, this.#ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(600, this.#ctx.currentTime + 0.06)
    gain.gain.setValueAtTime(0.15, this.#ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, this.#ctx.currentTime + 0.08)
    osc.connect(gain).connect(this.#ctx.destination)
    osc.start(); osc.stop(this.#ctx.currentTime + 0.08)
  }

  /**
   * Three quick square wave blips at 300/400/500 Hz staggered 40 ms apart —
   * rapid-fire escape struggle effect.
   */
  #playSfxGrabEscape() {
    for (let i = 0; i < 3; i++) {
      const osc = this.#ctx.createOscillator()
      const gain = this.#ctx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(300 + i * 100, this.#ctx.currentTime + i * 0.04)
      gain.gain.setValueAtTime(0.1, this.#ctx.currentTime + i * 0.04)
      gain.gain.exponentialRampToValueAtTime(0.001, this.#ctx.currentTime + i * 0.04 + 0.04)
      osc.connect(gain).connect(this.#ctx.destination)
      osc.start(this.#ctx.currentTime + i * 0.04)
      osc.stop(this.#ctx.currentTime + i * 0.04 + 0.04)
    }
  }
}
