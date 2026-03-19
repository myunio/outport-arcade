// app/javascript/games/engine/sprites.js

/**
 * Lightweight sprite sheet system for optional sprite-based rendering.
 *
 * Augments procedural drawing — does not replace it. Games can mix
 * procedural backgrounds with sprite-based characters on the same canvas.
 *
 * @example
 * const sheet = sprites.get("fisher")
 * sheet.update(dt, "idle")
 * sheet.draw(ctx, x, y, "idle")
 *
 * @module games/engine/sprites
 */

export class SpriteSheet {
  /**
   * @param {HTMLImageElement} image - Loaded sprite sheet image
   * @param {Object} descriptor - JSON descriptor
   * @param {number} descriptor.frameWidth - Width of each frame in pixels
   * @param {number} descriptor.frameHeight - Height of each frame in pixels
   * @param {Object<string, {frames: number[], speed: number}>} descriptor.animations
   */
  constructor(image, descriptor) {
    this.image = image
    this.frameWidth = descriptor.frameWidth
    this.frameHeight = descriptor.frameHeight
    this.animations = descriptor.animations || {}
    this._cols = Math.floor(image.width / this.frameWidth)

    /** @private Animation playback state per animation name. */
    this._animState = {}
    for (const name of Object.keys(this.animations)) {
      this._animState[name] = { elapsed: 0 }
    }
  }

  /**
   * Advance the animation clock for a named animation.
   *
   * @param {number} dt - Delta-time factor
   * @param {string} animName - Animation name
   */
  update(dt, animName) {
    const anim = this.animations[animName]
    if (!anim) return

    const state = this._animState[animName]
    if (!state) return

    state.elapsed += dt
  }

  /**
   * Get the current frame index for a named animation.
   *
   * @param {string} animName - Animation name
   * @returns {number} Frame index from the animation's frames array
   */
  currentFrame(animName) {
    const anim = this.animations[animName]
    if (!anim) return 0

    const state = this._animState[animName]
    if (!state) return anim.frames[0]

    // speed is frames per second. dt=1 at 60fps, so frames per dt = speed/60.
    const framesPerDt = anim.speed / 60
    const frameIndex = Math.floor(state.elapsed * framesPerDt) % anim.frames.length
    return anim.frames[frameIndex]
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
    const frame = frameOverride !== undefined ? frameOverride : this.currentFrame(animName)
    const { col, row } = this._frameToGrid(frame)

    ctx.drawImage(
      this.image,
      col * this.frameWidth, row * this.frameHeight,
      this.frameWidth, this.frameHeight,
      x, y,
      this.frameWidth, this.frameHeight,
    )
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
      col * this.frameWidth, row * this.frameHeight,
      this.frameWidth, this.frameHeight,
      x, y,
      this.frameWidth, this.frameHeight,
    )
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
      row: Math.floor(frame / this._cols),
    }
  }
}

/**
 * Manages loaded sprite sheets by name.
 */
export class SpriteManager {
  constructor() {
    /** @private */
    this._sheets = new Map()
  }

  /**
   * Add a sprite sheet.
   *
   * @param {string} name
   * @param {SpriteSheet} sheet
   */
  add(name, sheet) {
    this._sheets.set(name, sheet)
  }

  /**
   * Get a sprite sheet by name.
   *
   * @param {string} name
   * @returns {SpriteSheet|null}
   */
  get(name) {
    return this._sheets.get(name) || null
  }
}
