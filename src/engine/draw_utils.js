/**
 * Shared drawing utilities for Outport mini-games.
 *
 * Nautical drawing functions used by multiple renderers (Cod Jigger
 * and Overboard). Each function accepts position, scale, and color
 * parameters so games can share the same drawing code at different
 * sizes and palettes.
 *
 * Also includes shared game screen overlays (start screen, basic
 * game over, leaderboard) used by all three games.
 *
 * @module games/engine/draw_utils
 */

// ---------------------------------------------------------------------------
// Nautical scene elements
// ---------------------------------------------------------------------------

/**
 * Draws a simple cloud blob made of three overlapping ellipses.
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context (fillStyle must be set by caller)
 * @param {number} x - Center X of the main ellipse
 * @param {number} y - Center Y of the main ellipse
 * @param {number} w - Horizontal radius of the main ellipse
 * @param {number} h - Vertical radius of the main ellipse
 */
export function drawCloud(ctx, x, y, w, h) {
  ctx.beginPath()
  ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(x - w * 0.4, y + (h > 12 ? 4 : 3), w * 0.6, h * 0.7, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(x + w * 0.4, y + (h > 12 ? 3 : 2), w * 0.5, h * 0.6, 0, 0, Math.PI * 2)
  ctx.fill()
}

/**
 * Draws animated sine-wave crests and foam highlights at the waterline.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} waterlineY - Y position of the waterline
 * @param {number} amplitude - Wave height in pixels
 * @param {number} canvasWidth - Width of the canvas
 * @param {number} frameCount - Engine frame counter for animation
 * @param {Object} colors - { wave: string, foam: string }
 * @param {Object} [options]
 * @param {number} [options.foamSpacing=80] - Pixels between foam highlights
 * @param {number} [options.foamWidth=15] - Base width of foam rectangles
 * @param {number} [options.foamHeight=2] - Height of foam rectangles
 * @param {number} [options.bottomExtend=10] - Extra fill below wave crests
 */
export function drawWaves(ctx, waterlineY, amplitude, canvasWidth, frameCount, colors, options = {}) {
  const t = frameCount
  const foamSpacing = options.foamSpacing ?? 80
  const foamWidth = options.foamWidth ?? 15
  const foamHeight = options.foamHeight ?? 2
  const bottomExtend = options.bottomExtend ?? 10

  // Wave crests
  ctx.fillStyle = colors.wave
  ctx.beginPath()
  ctx.moveTo(0, waterlineY)
  for (let x = 0; x <= canvasWidth; x += 4) {
    const y = waterlineY + Math.sin(x * 0.03 + t * 0.04) * amplitude
      + Math.sin(x * 0.015 + t * 0.025) * amplitude * 0.5
    ctx.lineTo(x, y)
  }
  ctx.lineTo(canvasWidth, waterlineY + bottomExtend)
  ctx.lineTo(0, waterlineY + bottomExtend)
  ctx.closePath()
  ctx.fill()

  // Foam highlights
  ctx.fillStyle = colors.foam
  for (let x = 0; x < canvasWidth; x += foamSpacing) {
    const wx = x + Math.sin(t * 0.02 + x) * (foamSpacing * 0.1)
    const wy = waterlineY + Math.sin(wx * 0.03 + t * 0.04) * amplitude + (foamHeight / 2)
    ctx.fillRect(wx, wy, foamWidth + Math.sin(t * 0.05 + x) * (foamWidth / 3), foamHeight)
  }
}

/**
 * Draws a dory (small flat-bottomed boat) at the given position and scale.
 *
 * CodJigger uses scale=1, Overboard uses scale~0.7. The function
 * draws hull, hull highlight, gunwale rim, interior shadow, and thwart.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - Center X of the dory
 * @param {number} y - Baseline Y of the dory (after bob applied by caller)
 * @param {number} scale - Size multiplier (1 = full size)
 * @param {Object} colors - Dory color palette { doryHull, doryLight, doryGunwale, doryInside, doryRim }
 */
export function drawDory(ctx, x, y, scale, colors) {
  const s = scale

  // Hull
  ctx.fillStyle = colors.doryHull
  ctx.beginPath()
  ctx.moveTo(x - 40 * s, y)
  ctx.quadraticCurveTo(x - 45 * s, y + 18 * s, x - 30 * s, y + 22 * s)
  ctx.lineTo(x + 30 * s, y + 22 * s)
  ctx.quadraticCurveTo(x + 45 * s, y + 18 * s, x + 40 * s, y)
  ctx.closePath()
  ctx.fill()

  // Hull highlight
  ctx.fillStyle = colors.doryLight
  ctx.beginPath()
  ctx.moveTo(x - 38 * s, y + 2 * s)
  ctx.quadraticCurveTo(x - 42 * s, y + 14 * s, x - 28 * s, y + 16 * s)
  ctx.lineTo(x + 28 * s, y + 16 * s)
  ctx.quadraticCurveTo(x + 42 * s, y + 14 * s, x + 38 * s, y + 2 * s)
  ctx.closePath()
  ctx.fill()

  // Gunwale (rim)
  ctx.strokeStyle = colors.doryGunwale
  ctx.lineWidth = 2.5 * s
  ctx.beginPath()
  ctx.moveTo(x - 40 * s, y)
  ctx.quadraticCurveTo(x, y - 3 * s, x + 40 * s, y)
  ctx.stroke()

  // Interior shadow
  ctx.fillStyle = colors.doryInside
  ctx.beginPath()
  ctx.moveTo(x - 32 * s, y + 2 * s)
  ctx.quadraticCurveTo(x, y, x + 32 * s, y + 2 * s)
  ctx.lineTo(x + 26 * s, y + 12 * s)
  ctx.lineTo(x - 26 * s, y + 12 * s)
  ctx.closePath()
  ctx.fill()

  // Thwart (seat plank)
  ctx.fillStyle = colors.doryRim
  ctx.fillRect(x - 18 * s, y + 3 * s, 36 * s, 4 * s)
}

/**
 * Draws a fisher in yellow oilskins sitting in a dory at the given
 * position and scale.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - Center X (same as dory center)
 * @param {number} y - Baseline Y (same as dory baseline with bob)
 * @param {number} scale - Size multiplier (1 = full size)
 * @param {Object} colors - Fisher color palette { oilskin, oilskinDark, oilskinShade, souwester, souwesterBrim, face, faceShadow }
 */
export function drawFisher(ctx, x, y, scale, colors) {
  const s = scale

  // Body -- yellow oilskin jacket
  ctx.fillStyle = colors.oilskin
  ctx.fillRect(x - 8 * s, y - 22 * s, 16 * s, 18 * s)

  // Oilskin shading
  ctx.fillStyle = colors.oilskinDark
  ctx.fillRect(x - 8 * s, y - 22 * s, 5 * s, 18 * s)

  // Arms
  ctx.fillStyle = colors.oilskin
  ctx.fillRect(x + 8 * s, y - 18 * s, 12 * s, 5 * s)
  ctx.fillRect(x - 16 * s, y - 16 * s, 8 * s, 5 * s)

  // Head
  ctx.fillStyle = colors.face
  ctx.beginPath()
  ctx.arc(x, y - 28 * s, 7 * s, 0, Math.PI * 2)
  ctx.fill()

  // Sou'wester hat
  ctx.fillStyle = colors.souwester
  ctx.beginPath()
  ctx.ellipse(x, y - 34 * s, 10 * s, 4 * s, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillRect(x - 6 * s, y - 38 * s, 12 * s, 6 * s)

  // Brim
  ctx.fillStyle = colors.souwesterBrim
  ctx.beginPath()
  ctx.moveTo(x - 12 * s, y - 32 * s)
  ctx.lineTo(x + 10 * s, y - 32 * s)
  ctx.lineTo(x + 8 * s, y - 30 * s)
  ctx.lineTo(x - 16 * s, y - 28 * s)
  ctx.closePath()
  ctx.fill()

  // Face shadow
  ctx.fillStyle = colors.faceShadow
  ctx.beginPath()
  ctx.arc(x, y - 28 * s, 7 * s, 0.2, Math.PI - 0.2)
  ctx.fill()

  // Eyes
  ctx.fillStyle = "#222"
  ctx.fillRect(x - 3 * s, y - 29 * s, 2 * s, 2 * s)
  ctx.fillRect(x + 2 * s, y - 29 * s, 2 * s, 2 * s)

  // Rubber boots
  ctx.fillStyle = colors.oilskinShade
  ctx.fillRect(x - 6 * s, y - 4 * s, 5 * s, 6 * s)
  ctx.fillRect(x + 2 * s, y - 4 * s, 5 * s, 6 * s)
}

// ---------------------------------------------------------------------------
// Game screen overlays
// ---------------------------------------------------------------------------

/**
 * Draws the start screen overlay: semi-transparent background, gold title,
 * description lines, pulsing "SPACE or CLICK to start", and "? for help" hint.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} config
 * @param {string} config.title - Game title (e.g., "BAYMAN!")
 * @param {string[]} config.lines - Description lines below the title
 * @param {string} config.startPrompt - Pulsing call-to-action text
 * @param {number} config.canvasWidth
 * @param {number} config.canvasHeight
 * @param {Object} config.colors - { startOverlay, gold, text }
 * @param {string} config.font - Font family string
 * @param {Object} [config.layout] - Optional position overrides
 * @param {number} [config.layout.cx] - Center X (defaults to canvasWidth / 2)
 * @param {number} [config.layout.titleY] - Y for title
 * @param {number} [config.layout.titleSize] - Font size for title
 * @param {number} [config.layout.descY] - Y for first description line
 * @param {number} [config.layout.descSize] - Font size for description lines
 * @param {number} [config.layout.descGap] - Gap between description lines
 * @param {number} [config.layout.promptY] - Y for pulsing prompt
 * @param {number} [config.layout.promptSize] - Font size for prompt
 * @param {number} [config.layout.hintY] - Y for hint line
 */
export function drawStartScreen(ctx, config) {
  const {
    title, lines, startPrompt, canvasWidth, canvasHeight, colors, font,
    layout = {},
  } = config

  const cx = layout.cx ?? canvasWidth / 2
  const titleY = layout.titleY ?? 100
  const titleSize = layout.titleSize ?? 36
  const descY = layout.descY ?? (titleY + 40)
  const descSize = layout.descSize ?? 18
  const descGap = layout.descGap ?? 26
  const promptY = layout.promptY ?? (canvasHeight - 60)
  const promptSize = layout.promptSize ?? 20
  const hintY = layout.hintY ?? (promptY + 25)

  ctx.fillStyle = colors.startOverlay
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  ctx.textAlign = "center"

  ctx.fillStyle = colors.gold
  ctx.font = `bold ${titleSize}px ${font}`
  ctx.fillText(title, cx, titleY)

  ctx.fillStyle = colors.text
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    ctx.font = `${line.size ?? descSize}px ${font}`
    ctx.fillText(line.text, cx, descY + i * descGap)
  }

  const pulse = Math.sin(Date.now() / 400) * 0.3 + 0.7
  ctx.globalAlpha = pulse
  ctx.fillStyle = colors.gold
  ctx.font = `bold ${promptSize}px ${font}`
  ctx.fillText(startPrompt, cx, promptY)
  ctx.globalAlpha = 1

  ctx.fillStyle = "#666"
  ctx.font = `11px ${font}`
  ctx.fillText("? for help \u00B7 Q to quit", cx, hintY)
}

/**
 * Draws the basic game-over overlay: dark background, "GAME OVER" heading,
 * large score, optional high score, and restart hint.
 *
 * Used as the immediate death screen before leaderboard data loads.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} config
 * @param {number} config.score - Final score
 * @param {number} config.canvasWidth
 * @param {number} config.canvasHeight
 * @param {Object} config.colors - { overlay, text, gold }
 * @param {string} config.font - Font family string
 * @param {Object} [config.layout] - Optional position overrides
 * @param {number} [config.layout.cx] - Center X
 * @param {number} [config.layout.headingY] - Y for "GAME OVER"
 * @param {number} [config.layout.headingSize] - Font size for heading
 * @param {number} [config.layout.scoreY] - Y for score
 * @param {number} [config.layout.scoreSize] - Font size for score
 * @param {number} [config.layout.hintSize] - Font size for hint
 * @param {number} [config.highScore] - Show "Best: N" if > score
 */
export function drawBasicGameOver(ctx, config) {
  const { score, canvasWidth, canvasHeight, colors, font, layout = {} } = config

  const cx = layout.cx ?? canvasWidth / 2
  const headingY = layout.headingY ?? 100
  const headingSize = layout.headingSize ?? 32
  const scoreY = layout.scoreY ?? (headingY + 60)
  const scoreSize = layout.scoreSize ?? 48
  const hintSize = layout.hintSize ?? 14

  ctx.fillStyle = colors.overlay
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  ctx.textAlign = "center"

  ctx.fillStyle = colors.text
  ctx.font = `bold ${headingSize}px ${font}`
  ctx.fillText("GAME OVER", cx, headingY)

  ctx.fillStyle = colors.gold
  ctx.font = `bold ${scoreSize}px ${font}`
  ctx.fillText(`${score}`, cx, scoreY)

  if (config.highScore && config.highScore > score) {
    ctx.fillStyle = colors.text
    ctx.font = `${hintSize}px ${font}`
    ctx.fillText(`Best: ${config.highScore}`, cx, scoreY + 30)
  }

  ctx.fillStyle = colors.text
  ctx.font = `${hintSize}px ${font}`
  ctx.fillText("R to play again \u00b7 Q to quit", cx, canvasHeight - 20)
}

/**
 * Draws the game-over overlay with leaderboard table.
 *
 * Called after score submission and leaderboard fetch complete.
 * Renders on top of a frozen scene frame.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} config
 * @param {number} config.score - Final score
 * @param {Array<{user_name: string, score: number}>} config.leaderboard - Top scores
 * @param {boolean} config.isNewHighScore - Whether this is a new personal best
 * @param {number} config.canvasWidth
 * @param {number} config.canvasHeight
 * @param {Object} config.colors - { overlay, text, gold }
 * @param {string} config.font - Font family string
 * @param {Object} [config.layout] - Optional position overrides
 * @param {number} [config.layout.cx] - Center X
 * @param {number} [config.layout.headingY] - Y for "GAME OVER"
 * @param {number} [config.layout.headingSize] - Font size for heading
 * @param {number} [config.layout.highScoreY] - Y for "NEW HIGH SCORE!" label
 * @param {number} [config.layout.highScoreSize] - Font size for high score label
 * @param {number} [config.layout.scoreY] - Y for score value
 * @param {number} [config.layout.scoreSize] - Font size for score value
 * @param {number} [config.layout.tableHeaderY] - Y for "TOP SCORES" label
 * @param {number} [config.layout.tableHeaderSize] - Font size for table header
 * @param {number} [config.layout.tableStartY] - Y for first leaderboard row
 * @param {number} [config.layout.tableRowHeight] - Row height in leaderboard
 * @param {number} [config.layout.tableEntrySize] - Font size for entries
 * @param {number} [config.layout.nameX] - Left X for name column
 * @param {number} [config.layout.scoreX] - Right X for score column
 * @param {number} [config.layout.hintSize] - Font size for hint
 */
export function drawLeaderboardOverlay(ctx, config) {
  const {
    score, leaderboard, isNewHighScore, canvasWidth, canvasHeight, colors, font,
    layout = {},
  } = config

  const cx = layout.cx ?? canvasWidth / 2
  const headingY = layout.headingY ?? 55
  const headingSize = layout.headingSize ?? 32
  const highScoreY = layout.highScoreY ?? (headingY + 22)
  const highScoreSize = layout.highScoreSize ?? 16
  const scoreY = layout.scoreY ?? (headingY + 60)
  const scoreSize = layout.scoreSize ?? 40
  const tableHeaderY = layout.tableHeaderY ?? (scoreY + 30)
  const tableHeaderSize = layout.tableHeaderSize ?? 14
  const tableStartY = layout.tableStartY ?? (tableHeaderY + 20)
  const tableRowHeight = layout.tableRowHeight ?? 20
  const tableEntrySize = layout.tableEntrySize ?? 14
  const nameX = layout.nameX ?? 170
  const scoreX = layout.scoreX ?? (canvasWidth - 170)
  const hintSize = layout.hintSize ?? 14

  ctx.fillStyle = colors.overlay
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  ctx.textAlign = "center"

  ctx.fillStyle = colors.text
  ctx.font = `bold ${headingSize}px ${font}`
  ctx.fillText("GAME OVER", cx, headingY)

  if (isNewHighScore) {
    ctx.fillStyle = colors.gold
    ctx.font = `bold ${highScoreSize}px ${font}`
    ctx.fillText("NEW HIGH SCORE!", cx, highScoreY)
  }

  ctx.fillStyle = colors.text
  ctx.font = `bold ${scoreSize}px ${font}`
  ctx.fillText(`${score}`, cx, scoreY)

  if (leaderboard && leaderboard.length > 0) {
    // Limit visible rows so the table doesn't overlap the hint line
    const hintLineY = canvasHeight - 20
    const availableSpace = hintLineY - tableStartY - 10
    const maxRows = Math.max(1, Math.floor(availableSpace / tableRowHeight))
    const visibleEntries = leaderboard.slice(0, Math.min(5, maxRows))

    ctx.fillStyle = colors.text
    ctx.font = `bold ${tableHeaderSize}px ${font}`
    ctx.fillText("TOP SCORES", cx, tableHeaderY)

    ctx.font = `${tableEntrySize}px ${font}`
    visibleEntries.forEach((entry, i) => {
      const y = tableStartY + i * tableRowHeight
      const name = entry.user_name || "???"

      ctx.textAlign = "left"
      ctx.fillStyle = colors.text
      ctx.fillText(`${i + 1}. ${name}`, nameX, y)

      ctx.textAlign = "right"
      ctx.fillText(`${entry.score}`, scoreX, y)
    })
  }

  ctx.fillStyle = colors.text
  ctx.font = `${hintSize}px ${font}`
  ctx.textAlign = "center"
  ctx.fillText("R to play again \u00b7 Q to quit", cx, canvasHeight - 20)
}

// ---------------------------------------------------------------------------
// Shared drawing primitives
// ---------------------------------------------------------------------------

/**
 * Draws particles from a state snapshot array.
 *
 * Generic particle renderer used by any game with the shared ParticleSystem.
 * Each particle has x, y, life, maxLife, color, and size properties.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} particles - Particle array from state snapshot
 */
export function drawParticles(ctx, particles) {
  if (!particles || particles.length === 0) return

  for (const p of particles) {
    const half = (p.size || 4) / 2
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife)
    ctx.fillStyle = p.color
    ctx.fillRect(p.x - half, p.y - half, p.size || 4, p.size || 4)
  }
  ctx.globalAlpha = 1
}

/**
 * Draws a single spruce tree silhouette with 3 layered triangles.
 *
 * Used by multiple renderers for boreal forest backgrounds.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - Left X of tree bounding box
 * @param {number} baseY - Y position of ground line
 * @param {number} h - Total tree height
 * @param {number} w - Tree width
 * @param {string} color - Main foliage color
 * @param {string} highlight - Highlight color for right side
 * @param {string} trunkColor - Trunk color
 */
export function drawSpruce(ctx, x, baseY, h, w, color, highlight, trunkColor) {
  const tipY = baseY - h
  const trunkW = Math.max(3, w * 0.15)

  // Trunk
  ctx.fillStyle = trunkColor
  ctx.fillRect(x + w / 2 - trunkW / 2, baseY - 8, trunkW, 8)

  // 3 layered triangles
  const layers = 3
  const layerH = h / layers
  for (let i = 0; i < layers; i++) {
    const ly = tipY + i * layerH * 0.75
    const lw = (w * 0.3) + (w * 0.7) * ((i + 1) / layers)
    const lh = layerH * 1.1

    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(x + w / 2, ly)
    ctx.lineTo(x + w / 2 + lw / 2, ly + lh)
    ctx.lineTo(x + w / 2 - lw / 2, ly + lh)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = highlight
    ctx.beginPath()
    ctx.moveTo(x + w / 2, ly)
    ctx.lineTo(x + w / 2 + lw / 2, ly + lh)
    ctx.lineTo(x + w / 2 + lw * 0.15, ly + lh)
    ctx.closePath()
    ctx.fill()
  }
}
