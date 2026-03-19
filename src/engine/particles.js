/**
 * Burst particle system for game-feel effects.
 *
 * Supports burst emission, per-particle gravity, opacity fade,
 * and dt-scaling for consistent visuals at any refresh rate.
 *
 * @example
 * const particles = new ParticleSystem()
 *
 * // Emit a burst on collision:
 * particles.emit({
 *   x: 200, y: 150, count: 12,
 *   speed: [2, 6], lifetime: [20, 40],
 *   colors: ["#8B4513", "#A0522D", "#DEB887"],
 *   spread: Math.PI * 2, gravity: 0.15,
 * })
 *
 * // In update(dt):
 * particles.update(dt)
 *
 * // In renderer:
 * particles.draw(ctx)
 *
 * @module games/engine/particles
 */
export class ParticleSystem {
  constructor() {
    /** @type {Array<Object>} Active particles. */
    this.particles = []
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
      const dir = angle + (Math.random() - 0.5) * spread
      const spd = speed[0] + Math.random() * (speed[1] - speed[0])
      const life = lifetime[0] + Math.random() * (lifetime[1] - lifetime[0])

      this.particles.push({
        x,
        y,
        vx: Math.cos(dir) * spd,
        vy: Math.sin(dir) * spd,
        life,
        maxLife: life,
        color: colors[Math.floor(Math.random() * colors.length)],
        gravity,
        size,
      })
    }
  }

  /**
   * Update all particles. Removes dead particles.
   *
   * @param {number} dt - Delta-time factor
   */
  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.vy += p.gravity * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.life -= dt

      if (p.life <= 0) {
        // Swap-and-pop: O(1) removal instead of O(n) splice
        this.particles[i] = this.particles[this.particles.length - 1]
        this.particles.pop()
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
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife)
      ctx.fillStyle = p.color
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
    }
    ctx.globalAlpha = 1
  }

  /** Remove all particles. */
  clear() {
    this.particles.length = 0
  }
}
