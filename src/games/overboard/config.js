/**
 * Overboard! — Game configuration constants.
 *
 * All tunable parameters for the Overboard! Tetris easter egg:
 * canvas dimensions, grid geometry, piece definitions (7 tetrominoes),
 * drop timing, scoring table, and the nautical color palette.
 *
 * Themed as cargo crates falling overboard — warm wood tones on
 * an ocean gradient, with pieces styled as fishing crates.
 *
 * @module games/overboard/config
 */

import { SHARED_COLORS, UI_FONT as SHARED_UI_FONT } from "../../engine/palette.js"

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

/** @type {number} Canvas width in CSS pixels (portrait, grid + HUD panel). */
export const CANVAS_WIDTH = 360

/** @type {number} Canvas height in CSS pixels (scene strip + grid). */
export const CANVAS_HEIGHT = 580

// ---------------------------------------------------------------------------
// Grid geometry
// ---------------------------------------------------------------------------

/** @type {number} Number of columns in the playfield. */
export const GRID_COLS = 10

/** @type {number} Number of rows in the playfield. */
export const GRID_ROWS = 20

/** @type {number} Size of each cell in pixels. */
export const CELL_SIZE = 25

/** @type {number} Left margin before the play area starts (in pixels). */
export const PLAY_AREA_X = 0

/** @type {number} Top margin before the play area starts — below the surface scene strip. */
export const PLAY_AREA_Y = 80

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Surface scene geometry
// ---------------------------------------------------------------------------

/** @type {number} Y position of the waterline in the scene strip. */
export const WATERLINE_Y = 50

/** @type {number} Wave animation amplitude in pixels. */
export const WAVE_AMPLITUDE = 2

/** @type {number} Dory center X position. */
export const DORY_X = 130

/** @type {number} Dory baseline Y position (just above waterline). */
export const DORY_Y = WATERLINE_Y - 4

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

/** @type {number} Seconds before a landed piece locks in place. */
export const LOCK_DELAY = 0.5

/** @type {number} Lines cleared per level. */
export const LINES_PER_LEVEL = 10

/**
 * Drop interval per level in seconds. Index = level number.
 * Classic NES-style speed curve.
 *
 * @type {number[]}
 */
export const DROP_INTERVALS = [
  0.800, 0.717, 0.633, 0.550, 0.467,
  0.383, 0.300, 0.217, 0.133, 0.100,
  0.083, 0.083, 0.083, 0.067, 0.067,
  0.067, 0.050, 0.050, 0.050, 0.033,
  0.033, 0.033, 0.033, 0.033, 0.033,
  0.033, 0.033, 0.033, 0.033, 0.017,
]

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Points awarded per line clear type, before level multiplier.
 * Index 0 unused; index 1 = single, 2 = double, 3 = triple, 4 = tetris.
 *
 * @type {number[]}
 */
export const LINE_CLEAR_SCORES = [0, 100, 300, 500, 800]

/** @type {number} Points per cell for soft drop. */
export const SOFT_DROP_POINTS = 1

/** @type {number} Points per cell for hard drop. */
export const HARD_DROP_POINTS = 2

// ---------------------------------------------------------------------------
// Game phases
// ---------------------------------------------------------------------------

/** @type {Object} Game phase constants. */
export const PHASE = Object.freeze({
  START: "START",
  PLAYING: "PLAYING",
  DEAD: "DEAD",
})

// ---------------------------------------------------------------------------
// Piece definitions
// ---------------------------------------------------------------------------

/**
 * The 7 standard tetrominoes. Each defined as a 2D matrix where 1 = filled.
 * Matrices are square to simplify rotation (transpose + reverse).
 *
 * @type {Object<string, {shape: number[][], color: string}>}
 */
export const PIECES = {
  I: {
    shape: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    color: "#E8C65A",       // Pineapple gold
  },
  O: {
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: "#CC3333",       // Lobster red
  },
  T: {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: "#4A7A9B",       // Ocean steel blue (brand primary)
  },
  S: {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
    color: "#3A6B2E",       // Forest green
  },
  Z: {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
    color: "#D4742C",       // Dory orange
  },
  J: {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: "#5A9BAD",       // Coastal teal
  },
  L: {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: "#C4A35A",       // Rope tan
  },
}

/** @type {string[]} Piece names for bag randomizer iteration. */
export const PIECE_NAMES = Object.keys(PIECES)

// ---------------------------------------------------------------------------
// Colors — Outport nautical palette
// ---------------------------------------------------------------------------

/**
 * Color palette for all game rendering.
 *
 * @type {Object}
 */
export const COLORS = {
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
  clearFlash: "rgba(255, 255, 255, 0.5)",
}

/** @type {string} Font family for all game text. */
export const UI_FONT = SHARED_UI_FONT
