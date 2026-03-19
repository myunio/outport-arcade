/**
 * Shared color palette and UI constants for all Outport mini-games.
 *
 * Colors that appear identically across multiple game configs are
 * defined here once. Game-specific configs import and spread these
 * into their own COLORS objects, adding game-specific entries on top.
 *
 * @module games/engine/palette
 */

/**
 * Colors shared by all three games (Bayman, Cod Jigger, Overboard).
 *
 * @type {Object}
 */
export const SHARED_COLORS = {
  text: "#F0EDE6",
  gold: "#E8C65A",
  goldDark: "#C9A83E",
  overlay: "rgba(0, 0, 0, 0.6)",
  startOverlay: "rgba(0, 0, 0, 0.5)",
}

/**
 * Font family for all game UI text.
 *
 * @type {string}
 */
export const UI_FONT = "monospace"
