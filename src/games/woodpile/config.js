/**
 * Woodpile Tycoon — Game configuration.
 *
 * Clicker/idle game: tap to chop, auto-progress through tiers.
 * Inspired by Den Young of Springdale, NL.
 *
 * @module games/woodpile/config
 */
import { SHARED_COLORS, UI_FONT as SHARED_UI_FONT } from "../../engine/palette.js"

export const CANVAS_WIDTH = 700
export const CANVAS_HEIGHT = 420

export const PHASE = Object.freeze({
  START: "START",
  PLAYING: "PLAYING",
})

/**
 * Tier definitions — each tier has a tool, era, production rates, and threshold.
 *
 * Eras: 1=Up the Brook, 2=Sellin' to the Neighbours, 3=Pulp & Paper, 4=Da Big Contract
 * Era shifts at tiers 3→4 (chainsaw), 7→8 (boom truck), 9→10 (pulp contract), 11 (da big contract).
 */
export const TIERS = [
  { name: "Bucksaw",            era: 1, perClick: 1,     idleRate: 0,      threshold: 50,        tool: "bucksaw" },
  { name: "Axe",                era: 1, perClick: 3,     idleRate: 0,      threshold: 200,       tool: "axe" },
  { name: "Splitting Maul",     era: 1, perClick: 8,     idleRate: 0.5,    threshold: 800,       tool: "maul" },
  { name: "Chainsaw",           era: 2, perClick: 20,    idleRate: 3,      threshold: 3000,      tool: "chainsaw" },
  { name: "Hydraulic Splitter", era: 2, perClick: 50,    idleRate: 12,     threshold: 12000,     tool: "splitter" },
  { name: "Pickup Truck",       era: 2, perClick: 120,   idleRate: 40,     threshold: 50000,     tool: "truck" },
  { name: "Hire a Buddy",       era: 2, perClick: 250,   idleRate: 90,     threshold: 120000,    tool: "buddy" },
  { name: "Boom Truck",         era: 3, perClick: 600,   idleRate: 250,    threshold: 400000,    tool: "boomtruck" },
  { name: "Skidder",            era: 3, perClick: 1500,  idleRate: 700,    threshold: 1500000,   tool: "skidder" },
  { name: "Feller Buncher",     era: 3, perClick: 4000,  idleRate: 2000,   threshold: 6000000,   tool: "feller" },
  { name: "Pulp Contract",      era: 4, perClick: 10000, idleRate: 6000,   threshold: 25000000,  tool: "harvester" },
  { name: "Da Big Contract",    era: 4, perClick: 30000, idleRate: 20000,  threshold: Infinity,  tool: "bigcontract" },
]

/** Auto-save interval in milliseconds. */
export const AUTOSAVE_INTERVAL = 30000

/**
 * Color palette — extends shared palette with woodpile-specific colors.
 */
export const COLORS = {
  ...SHARED_COLORS,

  // Era 1: Spring morning
  sky1Top: "#87CEEB",
  sky1Bottom: "#B0D4E8",
  ground1: "#3D6B35",

  // Era 2: Working day
  sky2Top: "#5B9BD5",
  sky2Bottom: "#A8C8E0",
  ground2: "#4A7A42",

  // Era 3: Overcast industrial
  sky3Top: "#4A6D8C",
  sky3Bottom: "#8BA8C2",
  ground3: "#5A5A4A",

  // Era 4: Epic scale
  sky4Top: "#2C3E50",
  sky4Bottom: "#5D7B93",
  ground4: "#4A5A50",

  // Trees
  treeTrunk: "#5A3A1A",
  treeGreen: "#2D5A27",
  treeDark: "#2D4A2A",

  // Character
  flannel: "#C0392B",
  flannelDark: "#2C2C2C",
  skin: "#E8C39E",
  toque: "#E74C3C",
  jeans: "#3A5A8C",
  boots: "#4A3520",

  // Wood
  logBark: "#8B7355",
  logRings: "#A08060",
  logCenter: "#6B5335",

  // UI
  progressTrack: "#2A2A3A",
  progressFill1: ["#4CAF50", "#8BC34A"],
  progressFill2: ["#2196F3", "#03A9F4"],
  progressFill3: ["#FF9800", "#FFC107"],
  progressFill4: ["#F44336", "#FF5722"],

  // Particles
  woodChips: ["#8B6914", "#A08040", "#C0A050", "#6B5010"],
  metalChips: ["#888", "#AAA", "#666"],
}

export const UI_FONT = SHARED_UI_FONT
