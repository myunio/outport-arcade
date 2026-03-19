/**
 * Bayman! — Game configuration constants.
 *
 * All tunable parameters for the Bayman! easter egg game:
 * canvas dimensions, physics, speed progression, obstacle
 * configuration, colors, and UI layout.
 *
 * Themed around Newfoundland outport culture: Honda Big Red
 * trike, dense boreal forest, stumps/rocks/moose obstacles.
 *
 * @module games/bayman/config
 */

import { SHARED_COLORS, UI_FONT as SHARED_UI_FONT } from "../../engine/palette.js"

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

/** @type {number} Canvas width in CSS pixels. */
export const CANVAS_WIDTH = 600

/** @type {number} Canvas height in CSS pixels. */
export const CANVAS_HEIGHT = 300

// ---------------------------------------------------------------------------
// World geometry
// ---------------------------------------------------------------------------

/** @type {number} Y position of the ground line. */
export const GROUND_Y = CANVAS_HEIGHT - 50

// ---------------------------------------------------------------------------
// Physics
// ---------------------------------------------------------------------------

/** @type {number} Gravity acceleration per frame. */
export const GRAVITY = 0.8

/** @type {number} Initial vertical velocity on jump (negative = up). */
export const JUMP_FORCE = -13

// ---------------------------------------------------------------------------
// Speed & difficulty
// ---------------------------------------------------------------------------

/** @type {number} Starting horizontal scroll speed in px/frame. */
export const BASE_SPEED = 5

/** @type {number} Speed increase per frame (progressive difficulty). */
export const SPEED_INCREASE = 0.001

/** @type {number} Maximum speed cap — difficulty plateaus here. */
export const MAX_SPEED = 14

// ---------------------------------------------------------------------------
// Obstacles
// ---------------------------------------------------------------------------

/**
 * Minimum edge-to-edge gap between obstacles in pixels.
 *
 * Derived from jump physics: worst case (two moose) needs ~10 frames to
 * land, touch ground, and re-jump to clearing height. At MAX_SPEED (14),
 * that's 140px + moose width (45) = 185px. The +20px spawn offset gives
 * an actual minimum of ~200px edge-to-edge — tight but always jumpable.
 *
 * @type {number}
 */
export const MIN_OBSTACLE_GAP = 180

/** @type {number} Maximum spawn probability per frame (prevents clustering). */
export const MAX_SPAWN_CHANCE = 0.05

/** @type {number} Bonus points for smashing an obstacle while invincible. */
export const SMASH_BONUS = 5

/** @type {number} Bonus points for collecting a power-up. */
export const POWERUP_BONUS = 10

// ---------------------------------------------------------------------------
// Player hitbox
// ---------------------------------------------------------------------------

/** @type {number} Inset from playerX to left edge of collision box. */
export const PLAYER_HITBOX_LEFT = 5

/** @type {number} Width of the player collision box (right edge = playerX + this). */
export const PLAYER_HITBOX_RIGHT = 45

/** @type {number} Height of the player collision box above playerY. */
export const PLAYER_HITBOX_HEIGHT = 35

/** @type {number} Inset applied to obstacle edges for forgiving collisions. */
export const OBSTACLE_HITBOX_INSET = 5

// ---------------------------------------------------------------------------
// Power-ups
// ---------------------------------------------------------------------------

/** @type {number} Duration of invincibility in frames (~4 seconds at 60fps). */
export const INVINCIBLE_DURATION = 240

/** @type {number} Y position where power-ups float (above ground, requires jump). */
export const POWERUP_Y = GROUND_Y - 90

/** @type {number} Minimum score before power-ups start spawning. */
export const POWERUP_MIN_SCORE = 15

/** @type {number} Minimum frames between power-up spawns. */
export const POWERUP_COOLDOWN = 300

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
// Colors — Outport brand palette
// ---------------------------------------------------------------------------

/**
 * Color palette for all game rendering.
 *
 * @type {Object}
 */
export const COLORS = {
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
  mooseLight: "#7A5540",
}

// ---------------------------------------------------------------------------
// UI layout
// ---------------------------------------------------------------------------

/** @type {string} Font family for all game text. */
export const UI_FONT = SHARED_UI_FONT
