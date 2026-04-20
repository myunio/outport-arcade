/**
 * Cod Jigger — Game configuration constants.
 *
 * A meditative fishing mini-game: sit in a dory on the North Atlantic,
 * jig for cod, and pull when the line shakes. Patience rewarded.
 *
 * @module games/codjigger/config
 */

import { SHARED_COLORS, UI_FONT as SHARED_UI_FONT } from "../../engine/palette.js"

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

export const CANVAS_WIDTH = 600
export const CANVAS_HEIGHT = 300

// ---------------------------------------------------------------------------
// Scene geometry
// ---------------------------------------------------------------------------

/** @type {number} Y position of the waterline. */
export const WATERLINE_Y = 120

/** @type {number} Wave animation amplitude in pixels. */
export const WAVE_AMPLITUDE = 3

// ---------------------------------------------------------------------------
// Dory position
// ---------------------------------------------------------------------------

export const DORY_X = 260
export const DORY_Y = WATERLINE_Y - 6

// ---------------------------------------------------------------------------
// Fishing timing
// ---------------------------------------------------------------------------

/** @type {number} Minimum delay before a bite in ms. */
export const BITE_MIN_DELAY = 3000

/** @type {number} Maximum delay before a bite in ms. */
export const BITE_MAX_DELAY = 9000

/** @type {number} Window to react to a bite in ms. */
export const BITE_WINDOW = 1800

/** @type {number} Seconds to animate pulling the fish up (was 50 frames at 60fps). */
export const PULL_DURATION = 0.833

/** @type {number} Seconds to display caught fish (was 90 frames at 60fps). */
export const CAUGHT_DISPLAY = 1.5

/** @type {number} Seconds to display miss message (was 60 frames at 60fps). */
export const MISSED_DISPLAY = 1.0

// ---------------------------------------------------------------------------
// Game phases
// ---------------------------------------------------------------------------

export const PHASE = Object.freeze({
  START: "START",
  WAITING: "WAITING",
  BITE: "BITE",
  PULLING: "PULLING",
  CAUGHT: "CAUGHT",
  MISSED: "MISSED",
})

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

export const COLORS = {
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
  missText: "#AAA",
}

export const UI_FONT = SHARED_UI_FONT
