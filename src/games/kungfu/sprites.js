/**
 * Kung Fu Overdrive — Sprite Data & Rendering
 *
 * Pixel art sprite definitions, color palettes, and the sprite rendering
 * system for all characters. Each sprite is an array of strings where
 * each character maps to a palette color. '.' is transparent.
 *
 * @module kungfu/sprites
 */

// Sprite pixel scale
export const SP = 3

// Sprite cache for pre-rendered canvases
const spriteCache = {}

// --- RENDERING FUNCTIONS ---

/**
 * Returns a cached canvas with the sprite rendered using the given palette.
 * Creates and caches a new canvas on first call for each key.
 *
 * @param {string} key - Unique cache key for this sprite+palette combination
 * @param {string[]} data - Array of strings representing pixel rows
 * @param {Object} pal - Palette mapping character keys to CSS color strings
 * @returns {HTMLCanvasElement} Pre-rendered sprite canvas
 */
export function getSpriteCanvas(key, data, pal) {
  if (spriteCache[key]) return spriteCache[key]
  const h = data.length, w = data[0].length
  const c = document.createElement('canvas')
  c.width = w * SP; c.height = h * SP
  const cx = c.getContext('2d')
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = data[y][x]
      if (ch !== '.' && pal[ch]) {
        cx.fillStyle = pal[ch]
        cx.fillRect(x * SP, y * SP, SP, SP)
      }
    }
  }
  spriteCache[key] = c
  return c
}

/**
 * Returns a cached all-white version of a sprite canvas, used for hit flash effects.
 * Creates and caches a new canvas on first call for each key.
 *
 * @param {string} key - Base cache key (will be suffixed with '_w')
 * @param {string[]} data - Array of strings representing pixel rows
 * @param {Object} pal - Palette mapping character keys to CSS color strings
 * @returns {HTMLCanvasElement} Pre-rendered all-white sprite canvas
 */
export function getSpriteCanvasWhite(key, data, pal) {
  const wkey = key + '_w'
  if (spriteCache[wkey]) return spriteCache[wkey]
  const h = data.length, w = data[0].length
  const c = document.createElement('canvas')
  c.width = w * SP; c.height = h * SP
  const cx = c.getContext('2d')
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[y][x] !== '.' && pal[data[y][x]]) {
        cx.fillStyle = '#ffffff'
        cx.fillRect(x * SP, y * SP, SP, SP)
      }
    }
  }
  spriteCache[wkey] = c
  return c
}

/**
 * Draws a sprite onto the given canvas context, centered horizontally and
 * bottom-aligned at (x, y). Supports horizontal flipping and hit flash.
 *
 * @param {CanvasRenderingContext2D} ctx - The canvas 2D rendering context to draw on
 * @param {string} key - Unique cache key for this sprite
 * @param {string[]} data - Array of strings representing pixel rows
 * @param {Object} pal - Palette mapping character keys to CSS color strings
 * @param {number} x - Horizontal center position in canvas pixels
 * @param {number} y - Bottom edge position in canvas pixels
 * @param {boolean} flip - If true, mirrors the sprite horizontally
 * @param {boolean} flash - If true, renders the sprite in solid white
 */
export function blitSprite(ctx, key, data, pal, x, y, flip, flash) {
  const c = flash ? getSpriteCanvasWhite(key, data, pal) : getSpriteCanvas(key, data, pal)
  ctx.save()
  ctx.translate(x, y)
  if (flip) ctx.scale(-1, 1)
  ctx.drawImage(c, -c.width / 2, -c.height)
  ctx.restore()
}

// --- PALETTES ---

/** @type {Object} Player character color palette */
export const PAL_PLAYER = {
  o: '#1a0a0a', s: '#ffcc88', S: '#e8b070', t: '#442200', h: '#ff2d95',
  r: '#e03030', R: '#aa2020', b: '#2060ff', B: '#1848cc', k: '#111111',
  w: '#ffffff', f: '#ffddaa', c: '#00ffff'
}

/** @type {Object} Basic grunt enemy color palette */
export const PAL_GRUNT = {
  o: '#1a1a1a', s: '#ffcc88', S: '#e8b070', g: '#777777', G: '#555555',
  p: '#555555', P: '#444444', k: '#222222', t: '#553322'
}

/** @type {Object} Grabber enemy color palette */
export const PAL_GRABBER = {
  o: '#1a0a2a', s: '#ffcc88', S: '#e8b070', g: '#7c3aed', G: '#5b21b6',
  p: '#5b21b6', P: '#4a1a9e', k: '#222222', t: '#553322'
}

/** @type {Object} Knife thrower enemy color palette */
export const PAL_KNIFE = {
  o: '#0a0a1a', s: '#ffcc88', S: '#e8b070', g: '#2a2a3e', G: '#1a1a2e',
  p: '#1a1a2e', P: '#111122', k: '#111111', m: '#333344',
  c: '#00ffff', t: '#222233'
}

/** @type {Object} Acrobat enemy color palette */
export const PAL_ACROBAT = {
  o: '#1a0a0a', s: '#ffcc88', S: '#e8b070', g: '#dc2626', G: '#991b1b',
  p: '#991b1b', P: '#771515', k: '#222222', t: '#553322'
}

/** @type {Object} Iron Fist boss color palette */
export const PAL_IRONFIST = {
  o: '#1a0a00', s: '#ffcc88', S: '#e8b070', g: '#cc8844', G: '#aa6633',
  p: '#8B4513', P: '#6B3410', k: '#222222', t: '#442200',
  a: '#ff6b35', A: '#dd5525'
}

/** @type {Object} Shadow boss color palette */
export const PAL_SHADOW = {
  o: '#0a0a1a', s: '#ffcc88', S: '#e8b070', g: '#2a1a3a', G: '#1a0a2a',
  p: '#1a0a2a', P: '#0a0020', k: '#111111', m: '#111122',
  v: '#8b5cf6', V: '#6d3fd4', t: '#222233'
}

/** @type {Object} Dragon boss color palette */
export const PAL_DRAGON = {
  o: '#1a001a', s: '#ffcc88', S: '#e8b070', g: '#1a1a2e', G: '#111122',
  p: '#111122', P: '#0a0a18', k: '#111111', t: '#222222',
  n: '#ff2d95', N: '#cc1177', a: '#ff6b35', A: '#dd5525'
}

/** @type {Object} Tiffany (hostage) color palette */
export const PAL_TIFFANY = {
  o: '#1a1a00', s: '#ffcc88', S: '#e8b070', w: '#ffffff', W: '#ddddee',
  d: '#ffd700', D: '#ccaa00', h: '#daa520', H: '#b8860b', k: '#aa8800'
}

// --- PLAYER SPRITES (14 wide x 22 tall) ---

/** @type {string[]} Player idle stance */
export const PLAYER_IDLE = [
  '......tt......',
  '.....tsst.....',
  '....tssSSt....',
  '....ssssss....',
  '....hhhhhh....',
  '....ssooss....',
  '....ssssss....',
  '.....sSS......',
  '....rrrrrr....',
  '...rrrrrrrr...',
  '..fsrrrrrrsf..',
  '..fsrrrrrrsf..',
  '..fSRrrrrRSf..',
  '...SRrrrrRS...',
  '....kkkkkk....',
  '....bbbbbb....',
  '....bb..bb....',
  '....bb..bb....',
  '....bb..bb....',
  '....BB..BB....',
  '....Bk..kB....',
  '...kkk..kkk...',
]

/** @type {string[]} Player walk frame 1 */
export const PLAYER_WALK1 = [
  '......tt......',
  '.....tsst.....',
  '....tssSSt....',
  '....ssssss....',
  '....hhhhhh....',
  '....ssooss....',
  '....ssssss....',
  '.....sSS......',
  '....rrrrrr....',
  '...rrrrrrrr...',
  '..fSrrrrrrsf..',
  '...Srrrrrrsf..',
  '...SRrrrrRS...',
  '....Rrrrrr....',
  '....kkkkkk....',
  '....bbbbbb....',
  '...bbb..bb....',
  '..bbb....bb...',
  '..bb......bb..',
  '..BB......BB..',
  '..kk......kk..',
  '..kkk....kkk..',
]

/** @type {string[]} Player walk frame 2 */
export const PLAYER_WALK2 = [
  '......tt......',
  '.....tsst.....',
  '....tssSSt....',
  '....ssssss....',
  '....hhhhhh....',
  '....ssooss....',
  '....ssssss....',
  '.....sSS......',
  '....rrrrrr....',
  '...rrrrrrrr...',
  '..fSrrrrrrSf..',
  '..fSrrrrrrSf..',
  '...SRrrrrRS...',
  '....Rrrrrr....',
  '....kkkkkk....',
  '....bbbbbb....',
  '....bb.bbb....',
  '...bb...bbb...',
  '..bb.....bb...',
  '..BB.....BB...',
  '..kk.....kk...',
  '..kkk...kkk...',
]

/** @type {string[]} Player punch attack */
export const PLAYER_PUNCH = [
  '......tt......',
  '.....tsst.....',
  '....tssSSt....',
  '....ssssss....',
  '....hhhhhh....',
  '....ssooss....',
  '....ssssss....',
  '.....sSS......',
  '....rrrrrr....',
  '...rrrrrrrr...',
  '..fSrrrrrrssssw',
  '..fSrrrrrrssssw',
  '...SRrrrrRS.ww.',
  '....RrrrrRS....',
  '....kkkkkk....',
  '....bbbbbb....',
  '....bb..bb....',
  '....bb..bb....',
  '....bb..bb....',
  '....BB..BB....',
  '...kkk..kkk...',
  '...kkk..kkk...',
]

/** @type {string[]} Player kick attack */
export const PLAYER_KICK = [
  '......tt......',
  '.....tsst.....',
  '....tssSSt....',
  '....ssssss....',
  '....hhhhhh....',
  '....ssooss....',
  '....ssssss....',
  '.....sSS......',
  '....rrrrrr....',
  '..fsrrrrrrrr..',
  '..fsrrrrrrrr..',
  '...SRrrrrRR...',
  '....kkkkkk....',
  '....bbbbbb....',
  '....bbb.......',
  '....bbbbbbbbbcc',
  '....BBbbbbbbbcc',
  '......BB......',
  '.....kkk......',
  '....kkk.......',
  '..............',
  '..............',
]

/** @type {string[]} Player jump kick */
export const PLAYER_JUMPKICK = [
  '......tt......',
  '.....tsst.....',
  '....tssSSt....',
  '....ssssss....',
  '....hhhhhh....',
  '....ssooss....',
  '....ssssss....',
  '.....sSS......',
  '....rrrrrr....',
  '..fsrrrrrrrr..',
  '..fsrrrrrrrr..',
  '...SRrrrrR....',
  '....kkkkkk....',
  '..bbb.........',
  '.bbb.bbbbbbcc.',
  '.BB..BBbbbbbcc',
  '..kk..........',
  '..kkk.........',
  '..............',
  '..............',
  '..............',
  '..............',
]

/** @type {string[]} Player crouch stance */
export const PLAYER_CROUCH = [
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
  '......tt......',
  '.....tsst.....',
  '....tssSSt....',
  '....ssssss....',
  '....hhhhhh....',
  '....ssooss....',
  '....ssssss....',
  '...rrrrrrrr...',
  '..fsrrrrrrsf..',
  '..fSRrrrrRSf..',
  '...kkkkkkkk...',
  '..bbbbbbbbbb..',
  '..BBbbkkbbBB..',
  '..kkkk..kkkk..',
]

/** @type {string[]} Player crouching attack */
export const PLAYER_CROUCH_ATK = [
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
  '......tt......',
  '.....tsst.....',
  '....tssSSt....',
  '....ssssss....',
  '....hhhhhh....',
  '....ssooss....',
  '....ssssss....',
  '...rrrrrrrr...',
  '..fsrrrrrrsf..',
  '..fSRrrrrRSf..',
  '...kkkkkkkk...',
  '..bbbbbbbbbbbbcc',
  '..BBbbkkbbBBbbcc',
  '..kkkk..kkkk..',
]

/** @type {string[]} Player special move */
export const PLAYER_SPECIAL = [
  '......tt......',
  '.....tsst.....',
  '....tssSSt....',
  '....ssssss....',
  '....hhhhhh....',
  '....ssooss....',
  '....ssssss....',
  '.....sSS......',
  '....rrrrrr....',
  '...rrrrrrrr...',
  '..fsrrrrrrsf..',
  '..fSRrrrrRSf..',
  '....kkkkkk....',
  'ccbbbbbbbbbbcc',
  'ccBBBbbbbBBBcc',
  'cc..BBbbBB..cc',
  '....kkkkkk....',
  '...kk..kk.....',
  '..............',
  '..............',
  '..............',
  '..............',
]

/** @type {string[]} Player hurt/knockback */
export const PLAYER_HURT = [
  '..............',
  '......tt......',
  '.....tsst.....',
  '....tssSSt....',
  '....ssssss....',
  '....hhhhhh....',
  '....ssooss....',
  '....ssssss....',
  '.....sSS......',
  '...rrrrrrrr...',
  '..fsrrrrrrsf..',
  '.fSRrrrrrrrSf.',
  '.f.SRrrrrRS.f.',
  '....kkkkkk....',
  '....bbbbbb....',
  '...bbb..bbb...',
  '..bbb....bbb..',
  '..BB......BB..',
  '..kk......kk..',
  '..kkk....kkk..',
  '..............',
  '..............',
]

// --- ENEMY SPRITES (13 wide x 19 tall) ---

/** @type {string[]} Enemy walk frame 1 */
export const ENEMY_WALK1 = [
  '.....tt......',
  '....tsst.....',
  '...tssSSt....',
  '...ssssss....',
  '...ssssss....',
  '...ssooss....',
  '....sSS......',
  '...gggggg....',
  '..sggggggg...',
  '..sgggggggs..',
  '..SGggggGS...',
  '...GggggG....',
  '...pppppp....',
  '...pp..pp....',
  '..ppp...pp...',
  '..pp.....pp..',
  '..PP.....PP..',
  '..kk.....kk..',
  '.kkk.....kkk.',
]

/** @type {string[]} Enemy walk frame 2 */
export const ENEMY_WALK2 = [
  '.....tt......',
  '....tsst.....',
  '...tssSSt....',
  '...ssssss....',
  '...ssssss....',
  '...ssooss....',
  '....sSS......',
  '...gggggg....',
  '..sggggggg...',
  '..sgggggggs..',
  '..SGggggGS...',
  '...GggggG....',
  '...pppppp....',
  '...pp..pp....',
  '...pp.ppp....',
  '..pp...pp....',
  '..PP...PP....',
  '..kk...kk....',
  '.kkk...kkk...',
]

/** @type {string[]} Enemy attack pose */
export const ENEMY_ATTACK = [
  '.....tt......',
  '....tsst.....',
  '...tssSSt....',
  '...ssssss....',
  '...ssssss....',
  '...ssooss....',
  '....sSS......',
  '...gggggg....',
  '..Sggggggsssss',
  '..Sggggggsssss',
  '..SGggggGS...',
  '...GggggG....',
  '...pppppp....',
  '...pp..pp....',
  '...pp..pp....',
  '...pp..pp....',
  '...PP..PP....',
  '...kk..kk....',
  '..kkk..kkk...',
]

/** @type {string[]} Enemy hurt/knockback */
export const ENEMY_HURT = [
  '..............',
  '.....tt.......',
  '....tsst......',
  '...tssSSt.....',
  '...ssssss.....',
  '...ssssss.....',
  '...ssooss.....',
  '....sSS.......',
  '..gggggggg....',
  '.sggggggggg...',
  '.SGgggggggS...',
  '..SGggggGS....',
  '...pppppp.....',
  '..ppp..ppp....',
  '.ppp....ppp...',
  '.PP......PP...',
  '.kk......kk...',
  '.kkk....kkk...',
  '..............',
]

// --- GRABBER ENEMY SPRITES ---

/** @type {string[]} Grabber enemy with arms reaching */
export const GRABBER_GRAB = [
  '.....tt......',
  '....tsst.....',
  '...tssSSt....',
  '...ssssss....',
  '...ssssss....',
  '...ssooss....',
  '....sSS......',
  '...gggggg....',
  '..Sggggggsss.',
  '..SggggggssSS',
  '..SGggggGssss',
  '...GggggGssSS',
  '...pppppp....',
  '...pp..pp....',
  '...pp..pp....',
  '...pp..pp....',
  '...PP..PP....',
  '...kk..kk....',
  '..kkk..kkk...',
]

// --- KNIFE THROWER ENEMY SPRITES ---

/** @type {string[]} Knife thrower idle (masked) */
export const KNIFE_IDLE = [
  '.....tt......',
  '....tsst.....',
  '...tssSSt....',
  '...smmmms....',
  '...smmmms....',
  '...ssmmss....',
  '....sSS......',
  '...gggggg....',
  '..sggggggg...',
  '..sgggggggs..',
  '..SGggggGS...',
  '...GggggG....',
  '...pppppp....',
  '...pp..pp....',
  '...pp..pp....',
  '...pp..pp....',
  '...PP..PP....',
  '...kk..kk....',
  '..kkk..kkk...',
]

/** @type {string[]} Knife thrower throwing pose */
export const KNIFE_THROW = [
  '.....tt......',
  '....tsst.....',
  '...tssSSt....',
  '...smmmms....',
  '...smmmms....',
  '...ssmmss....',
  '....sSS......',
  '...gggggg....',
  '..Sggggggsscc',
  '..SggggggsScc',
  '..SGggggGS...',
  '...GggggG....',
  '...pppppp....',
  '...pp..pp....',
  '...pp..pp....',
  '...pp..pp....',
  '...PP..PP....',
  '...kk..kk....',
  '..kkk..kkk...',
]

// --- ACROBAT ENEMY SPRITES ---

/** @type {string[]} Acrobat mid-flip airborne pose */
export const ACROBAT_FLIP = [
  '..............',
  '...gggggg.....',
  '..ggggggggg...',
  '..gggggggggg..',
  '..SGggggGGss..',
  '...ppppppss...',
  '...PPppPPss...',
  '...kk..kk.....',
  '..kkk..kkk....',
  '.....tt.......',
  '....tsst......',
  '...tssSSt.....',
  '...ssssss.....',
  '...ssooss.....',
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
]

// --- BOSS SPRITES ---

// Iron Fist (Floor 1 Boss, 18 wide x 24 tall)

/** @type {string[]} Iron Fist idle stance */
export const IRONFIST_IDLE = [
  '......tttt........',
  '.....tssSSt.......',
  '....tsssssst......',
  '....ssssssss......',
  '....ssssssss......',
  '....sssoooss......',
  '....ssssssss......',
  '.....ssSSSs.......',
  '...gggggggggg.....',
  '..sggggggggggs....',
  '..sggggggggggs....',
  '.fsggggggggggsf...',
  '.fSGGggggGGGSf...',
  '..SGGggggGGGS....',
  '...GGggggGGG.....',
  '....pppppppp......',
  '....pp....pp......',
  '....pp....pp......',
  '....pp....pp......',
  '....pp....pp......',
  '...PPP...PPP......',
  '...PPP...PPP......',
  '..kkkk..kkkk......',
  '..kkkk..kkkk......',
]

/** @type {string[]} Iron Fist punch attack */
export const IRONFIST_PUNCH = [
  '......tttt........',
  '.....tssSSt.......',
  '....tsssssst......',
  '....ssssssss......',
  '....ssssssss......',
  '....sssoooss......',
  '....ssssssss......',
  '.....ssSSSs.......',
  '...gggggggggg.....',
  '..sggggggggggs....',
  '..sggggggggggsssssaa',
  '.fsggggggggggsssssaa',
  '.fSGGggggGGGS..aaAA',
  '..SGGggggGGGS.....',
  '...GGggggGGG......',
  '....pppppppp......',
  '....pp....pp......',
  '....pp....pp......',
  '....pp....pp......',
  '...PPP...PPP......',
  '..kkkk..kkkk......',
  '..kkkk..kkkk......',
  '..................',
  '..................',
]

/** @type {string[]} Iron Fist charge attack */
export const IRONFIST_CHARGE = [
  '......tttt........',
  '.....tssSSt.......',
  '....tsssssst......',
  '....ssssssss......',
  '....sssoooss......',
  '....ssssssss......',
  '.....ssSSSs.......',
  '..gggggggggggg....',
  '.sggggggggggggg...',
  '.sgggggggggggggs..',
  '.SGGGgggggGGGGs..',
  '..SGGGggggGGGGS..',
  '...pppppppppp.....',
  '..ppp......ppp....',
  '.ppp........ppp...',
  '.PP..........PP...',
  '.kk..........kk...',
  '.kkkk......kkkk...',
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
]

// Shadow (Floor 2 Boss, 14 wide x 22 tall)

/** @type {string[]} Shadow idle stance */
export const SHADOW_IDLE = [
  '.....ttt......',
  '....tssst.....',
  '...tssSSst....',
  '...smmmmmms...',
  '...smmmmmms...',
  '...ssvvmmss...',
  '....ssSs......',
  '...gggggg.....',
  '..vgggggggv...',
  '..vgggggggv...',
  '..VGggggGGV...',
  '...GggggGG....',
  '...pppppp.....',
  '...pp..pp.....',
  '...pp..pp.....',
  '...pp..pp.....',
  '...PP..PP.....',
  '...kk..kk.....',
  '..kkk..kkk....',
  '..............',
  '..............',
  '..............',
]

/** @type {string[]} Shadow attack pose */
export const SHADOW_ATTACK = [
  '.....ttt......',
  '....tssst.....',
  '...tssSSst....',
  '...smmmmmms...',
  '...smmmmmms...',
  '...ssvvmmss...',
  '....ssSs......',
  '...gggggg.....',
  '..vggggggvvvvVV',
  '..vggggggvvvvVV',
  '..VGggggGGV...',
  '...GggggGG....',
  '...pppppp.....',
  '...pp..pp.....',
  '...pp..pp.....',
  '...pp..pp.....',
  '...PP..PP.....',
  '...kk..kk.....',
  '..kkk..kkk....',
  '..............',
  '..............',
  '..............',
]

// Dragon (Floor 3 Boss, 15 wide x 22 tall)

/** @type {string[]} Dragon idle stance */
export const DRAGON_IDLE = [
  '.....tttt.....',
  '....tssSSt....',
  '...tsssssst...',
  '...sssssssn...',
  '...nnnnnnn....',
  '...ssnooss....',
  '...ssssssss...',
  '....ssSSSs....',
  '..nnggggggnn..',
  '..nggggggggnN.',
  '.nsggggggggsn.',
  '.nSGGggggGGSN.',
  '..SGGggggGGS..',
  '...pppppppp...',
  '...pp....pp...',
  '...pp....pp...',
  '...pp....pp...',
  '...PP....PP...',
  '..kkkk..kkkk..',
  '..kkkk..kkkk..',
  '...............',
  '...............',
]

/** @type {string[]} Dragon melee attack */
export const DRAGON_ATTACK = [
  '.....tttt.....',
  '....tssSSt....',
  '...tsssssst...',
  '...sssssssn...',
  '...nnnnnnn....',
  '...ssnooss....',
  '...ssssssss...',
  '....ssSSSs....',
  '..nnggggggnn..',
  '..nggggggggsssnN',
  '.nsggggggggsssnn',
  '.nSGGggggGGSnN..',
  '..SGGggggGGS....',
  '...pppppppp.....',
  '...pp....pp.....',
  '...pp....pp.....',
  '...PP....PP.....',
  '..kkkk..kkkk....',
  '..kkkk..kkkk....',
  '................',
  '................',
  '................',
]

/** @type {string[]} Dragon ranged energy attack */
export const DRAGON_RANGED = [
  '.....tttt.....',
  '....tssSSt....',
  '...tsssssst...',
  '...sssssssn...',
  '...nnnnnnn....',
  '...ssnooss....',
  '...ssssssss...',
  '....ssSSSs....',
  '..nnggggggnn..',
  '..nggggggggssnnNN',
  '.nsggggggggssnnNN',
  '.nSGGggggGGSnN..',
  '..SGGggggGGS....',
  '...pppppppp.....',
  '...pp....pp.....',
  '...pp....pp.....',
  '...PP....PP.....',
  '..kkkk..kkkk....',
  '..kkkk..kkkk....',
  '................',
  '................',
  '................',
]

/** @type {string[]} Dragon special move */
export const DRAGON_SPECIAL = [
  '.....tttt........',
  '....tssSSt.......',
  '...tsssssst......',
  '...sssssssn......',
  '...nnnnnnn.......',
  '...ssnooss.......',
  '...ssssssss......',
  '....ssSSSs.......',
  '..nnggggggnn.....',
  '..nggggggggnN....',
  '.nsggggggggsn....',
  '.nSGGggggGGSN....',
  '..SGGggggGGS.....',
  'NNppppppppppNN...',
  'NNPPppppppPPNN...',
  'nn..PPppPP..nn...',
  '....kkkkkk.......',
  '...kk..kk........',
  '.................',
  '.................',
  '.................',
  '.................',
]

// --- TIFFANY SPRITES (14 wide x 22 tall) ---

/** @type {string[]} Tiffany (hostage) standing */
export const TIFFANY_STAND = [
  '....hhhh......',
  '...hhsshh.....',
  '..hhssSSh.....',
  '..hssssssh....',
  '..hssOOssh....',
  '..hssssssH....',
  '...hssSsh.....',
  '...wwwwww.....',
  '..dwwwwwwd....',
  '..dwwwwwwd....',
  '..dWwwwwWd....',
  '...Dwwwwd.....',
  '...dwwwwd.....',
  '...dwwwwd.....',
  '..dwwwwwwd....',
  '..dwwwwwwd....',
  '.ddwwwwwwdd...',
  '.DDWwwwwWDD...',
  '..DDD..DDD....',
  '..kkk..kkk....',
  '..............',
  '..............',
]

// --- FRAME MAPS ---

/**
 * Maps player state names to their corresponding sprite data arrays.
 * Used by the draw system to look up the correct sprite for the current state.
 *
 * @type {Object.<string, string[]>}
 */
export const PLAYER_FRAMES = {
  idle: PLAYER_IDLE, walk1: PLAYER_WALK1, walk2: PLAYER_WALK2,
  punch: PLAYER_PUNCH, kick: PLAYER_KICK, jumpkick: PLAYER_JUMPKICK,
  crouch: PLAYER_CROUCH, crouch_atk: PLAYER_CROUCH_ATK,
  special: PLAYER_SPECIAL, hurt: PLAYER_HURT
}

/**
 * Maps boss floor numbers to their frame sets.
 * Each floor entry contains named pose keys pointing to sprite data arrays.
 *
 * @type {Object.<number, Object.<string, string[]>>}
 */
export const BOSS_FRAMES = {
  1: { idle: IRONFIST_IDLE, walk: IRONFIST_IDLE, attack: IRONFIST_PUNCH, charge: IRONFIST_CHARGE },
  2: { idle: SHADOW_IDLE, walk: SHADOW_IDLE, attack: SHADOW_ATTACK },
  3: { idle: DRAGON_IDLE, walk: DRAGON_IDLE, attack: DRAGON_ATTACK, ranged: DRAGON_RANGED, special: DRAGON_SPECIAL }
}

/**
 * Maps boss floor numbers to their color palettes.
 *
 * @type {Object.<number, Object>}
 */
export const BOSS_PALS = { 1: PAL_IRONFIST, 2: PAL_SHADOW, 3: PAL_DRAGON }
