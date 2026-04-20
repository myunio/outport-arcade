/**
 * Overboard! -- Core Tetris game engine.
 *
 * Standard Tetris: 7-bag randomizer spawns tetrominoes that fall into
 * a 10x20 grid. Players move, rotate, soft/hard drop pieces to fill
 * rows. Completed rows clear with points. Game ends when a new piece
 * can't spawn.
 *
 * Extends BaseEngine for game loop, phase machine, and scoring.
 * All game state managed here -- completely decoupled from rendering.
 *
 * Physics scaled by delta-time for consistent speed across refresh rates.
 * Rotation uses simple matrix transposition + row reverse (no wall kicks).
 *
 * @module games/overboard/engine
 */

import { BaseEngine } from "../../engine/base_engine.js"
import {
  GRID_COLS,
  GRID_ROWS,
  PIECES,
  PIECE_NAMES,
  DROP_INTERVALS,
  LOCK_DELAY,
  LINES_PER_LEVEL,
  LINE_CLEAR_SCORES,
  SOFT_DROP_POINTS,
  HARD_DROP_POINTS,
  PHASE,
} from "./config.js"

/**
 * Core Tetris engine for Overboard!
 *
 * @example
 * const engine = new OverboardEngine({
 *   onRender: (state) => renderer.draw(state),
 *   onGameOver: (score) => submitScore(score),
 * })
 * engine.start()
 */
export class OverboardEngine extends BaseEngine {
  /** @type {string[]} Game phases for the phase machine. */
  static phases = ["START", "PLAYING", "DEAD"]

  /** Resets all game-specific state. */
  reset() {
    super.reset()
    this.level = 0
    this.lines = 0
    this.grid = this._createGrid()
    this.current = null
    this.bag = []
    this.dropTimer = 0
    this.lockTimer = 0
    this.isLocking = false
    this.clearingRows = []
    this.clearTimer = 0
  }

  /**
   * Creates an empty grid.
   *
   * @private
   * @returns {(string|null)[][]}
   */
  _createGrid() {
    return Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null))
  }

  /**
   * Restart the game. Resets state, spawns first piece, starts loop.
   * Overrides BaseEngine to spawn the first piece after reset.
   */
  restart() {
    super.restart()
    this._spawnPiece()
  }

  // ---------------------------------------------------------------------------
  // Player actions
  // ---------------------------------------------------------------------------

  /** Moves current piece left. Resets lock delay if successful while locking. */
  moveLeft() {
    if (this.phase === PHASE.START) {
      this._startPlaying()
      return
    }
    if (this.phase !== PHASE.PLAYING || !this.current || this.clearTimer > 0) return
    if (this.canPlace(this.current.shape, this.current.x - 1, this.current.y)) {
      this.current.x--
      this._resetLockIfLocking()
    }
  }

  /** Moves current piece right. Resets lock delay if successful while locking. */
  moveRight() {
    if (this.phase === PHASE.START) {
      this._startPlaying()
      return
    }
    if (this.phase !== PHASE.PLAYING || !this.current || this.clearTimer > 0) return
    if (this.canPlace(this.current.shape, this.current.x + 1, this.current.y)) {
      this.current.x++
      this._resetLockIfLocking()
    }
  }

  /** Rotates current piece clockwise. Resets lock delay if successful. */
  rotate() {
    if (this.phase === PHASE.START) {
      this._startPlaying()
      return
    }
    if (this.phase !== PHASE.PLAYING || !this.current || this.clearTimer > 0) return
    const rotated = this._rotateMatrix(this.current.shape)
    if (this.canPlace(rotated, this.current.x, this.current.y)) {
      this.current.shape = rotated
      this._resetLockIfLocking()
    }
  }

  /** Soft drop -- moves piece down one row, awards 1 point. */
  softDrop() {
    if (this.phase === PHASE.START) {
      this._startPlaying()
      return
    }
    if (this.phase !== PHASE.PLAYING || !this.current || this.clearTimer > 0) return
    if (this.canPlace(this.current.shape, this.current.x, this.current.y + 1)) {
      this.current.y++
      this.addScore(SOFT_DROP_POINTS)
      this.dropTimer = 0
    }
  }

  /** Hard drop -- instantly drops piece to bottom, awards 2 points per cell. */
  hardDrop() {
    if (this.phase === PHASE.START) {
      this._startPlaying()
      return
    }
    if (this.phase !== PHASE.PLAYING || !this.current || this.clearTimer > 0) return
    let distance = 0
    while (this.canPlace(this.current.shape, this.current.x, this.current.y + 1)) {
      this.current.y++
      distance++
    }
    this.addScore(distance * HARD_DROP_POINTS)
    this._lockPiece()
  }

  /** @private Transitions from start screen to playing. */
  _startPlaying() {
    this.setPhase(PHASE.PLAYING)
    this._spawnPiece()
  }

  // ---------------------------------------------------------------------------
  // Game loop
  // ---------------------------------------------------------------------------

  /**
   * Updates game state for one frame. Called by BaseEngine each tick.
   *
   * @param {number} dt - Delta-time in seconds since last frame
   */
  update(dt) {
    if (this.phase !== PHASE.PLAYING) return

    // Line clear animation in progress
    if (this.clearTimer > 0) {
      this.clearTimer -= dt
      if (this.clearTimer <= 0) {
        this._removeClearedRows()
        this.clearingRows = []
        this._spawnPiece()
      }
      return
    }

    if (!this.current) return

    // Gravity -- drop piece at interval determined by level
    this.dropTimer += dt
    const dropInterval = this._getDropInterval()

    if (this.dropTimer >= dropInterval) {
      this.dropTimer = 0
      if (this.canPlace(this.current.shape, this.current.x, this.current.y + 1)) {
        this.current.y++
        this.isLocking = false
        this.lockTimer = 0
      } else {
        // Piece has landed -- start lock delay
        this.isLocking = true
      }
    }

    // Lock delay countdown
    if (this.isLocking) {
      this.lockTimer += dt
      if (this.lockTimer >= LOCK_DELAY) {
        this._lockPiece()
      }
    }
  }

  // ---------------------------------------------------------------------------
  // State snapshot
  // ---------------------------------------------------------------------------

  /**
   * Returns game-specific state merged with base state.
   * Computes ghost piece Y position so the renderer doesn't need
   * collision logic.
   *
   * @returns {Object} Complete state snapshot for renderer
   */
  getState() {
    let ghostY = this.current?.y ?? 0
    if (this.current) {
      while (this.canPlace(this.current.shape, this.current.x, ghostY + 1)) {
        ghostY++
      }
    }

    return {
      ...super.getState(),
      level: this.level,
      lines: this.lines,
      grid: this.grid,
      current: this.current,
      ghostY,
      clearingRows: this.clearingRows,
      clearTimer: this.clearTimer,
    }
  }

  // ---------------------------------------------------------------------------
  // Piece management
  // ---------------------------------------------------------------------------

  /**
   * Spawns the next piece from the bag. Game over if it can't be placed.
   *
   * @private
   */
  _spawnPiece() {
    if (this.bag.length === 0) {
      this.bag = this._shuffleBag()
    }

    const name = this.bag.pop()
    const piece = PIECES[name]
    const shape = piece.shape.map((row) => [...row])

    // Center piece horizontally, place at top
    const x = Math.floor((GRID_COLS - shape[0].length) / 2)
    const y = 0

    if (!this.canPlace(shape, x, y)) {
      this.setPhase(PHASE.DEAD)
      return
    }

    this.current = { type: name, shape, color: piece.color, x, y }
    this.dropTimer = 0
    this.lockTimer = 0
    this.isLocking = false
  }

  /**
   * 7-bag randomizer: shuffles all 7 piece names.
   * Each piece appears exactly once per bag.
   *
   * @private
   * @returns {string[]}
   */
  _shuffleBag() {
    const bag = [...PIECE_NAMES]
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[bag[i], bag[j]] = [bag[j], bag[i]]
    }
    return bag
  }

  /**
   * Locks the current piece into the grid, checks for line clears.
   *
   * @private
   */
  _lockPiece() {
    if (!this.current) return

    const { shape, color, x, y } = this.current

    // Write piece into grid
    for (let row = 0; row < shape.length; row++) {
      for (let col = 0; col < shape[row].length; col++) {
        if (shape[row][col]) {
          const gridRow = y + row
          const gridCol = x + col
          if (gridRow >= 0 && gridRow < GRID_ROWS && gridCol >= 0 && gridCol < GRID_COLS) {
            this.grid[gridRow][gridCol] = color
          }
        }
      }
    }

    this.current = null
    this.isLocking = false
    this.lockTimer = 0

    // Check for completed rows
    const fullRows = []
    for (let row = 0; row < GRID_ROWS; row++) {
      if (this.grid[row].every((cell) => cell !== null)) {
        fullRows.push(row)
      }
    }

    if (fullRows.length > 0) {
      // Award score: points * (level + 1)
      this.addScore(LINE_CLEAR_SCORES[fullRows.length] * (this.level + 1))
      this.lines += fullRows.length
      this.level = Math.floor(this.lines / LINES_PER_LEVEL)
      this.clearingRows = fullRows
      this.clearTimer = 0.25 // 250ms line-clear animation
    } else {
      this._spawnPiece()
    }
  }

  /**
   * Removes cleared rows and shifts everything above down.
   *
   * @private
   */
  _removeClearedRows() {
    // Sort descending so we remove from bottom up
    const rows = [...this.clearingRows].sort((a, b) => b - a)
    for (const row of rows) {
      this.grid.splice(row, 1)
      this.grid.unshift(Array(GRID_COLS).fill(null))
    }
  }

  // ---------------------------------------------------------------------------
  // Collision detection
  // ---------------------------------------------------------------------------

  /**
   * Checks if a piece shape can be placed at the given grid position.
   * Public so getState() can compute ghost piece Y without duplicating
   * collision logic in the renderer.
   *
   * @param {number[][]} shape - Piece matrix
   * @param {number} px - Grid column
   * @param {number} py - Grid row
   * @returns {boolean}
   */
  canPlace(shape, px, py) {
    for (let row = 0; row < shape.length; row++) {
      for (let col = 0; col < shape[row].length; col++) {
        if (!shape[row][col]) continue

        const gridRow = py + row
        const gridCol = px + col

        // Out of bounds
        if (gridCol < 0 || gridCol >= GRID_COLS || gridRow >= GRID_ROWS) return false

        // Above the top is OK (pieces spawn partially off-screen)
        if (gridRow < 0) continue

        // Collision with locked piece
        if (this.grid[gridRow][gridCol] !== null) return false
      }
    }
    return true
  }

  // ---------------------------------------------------------------------------
  // Rotation
  // ---------------------------------------------------------------------------

  /**
   * Rotates a piece matrix 90 degrees clockwise.
   * Transpose + reverse each row.
   *
   * @private
   * @param {number[][]} matrix
   * @returns {number[][]}
   */
  _rotateMatrix(matrix) {
    const size = matrix.length
    const rotated = Array.from({ length: size }, () => Array(size).fill(0))
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        rotated[col][size - 1 - row] = matrix[row][col]
      }
    }
    return rotated
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Gets the current drop interval based on level.
   *
   * @private
   * @returns {number}
   */
  _getDropInterval() {
    if (this.level < DROP_INTERVALS.length) {
      return DROP_INTERVALS[this.level]
    }
    return 0.017
  }

  /**
   * Resets lock timer if piece is in locking state.
   * Called when player successfully moves or rotates during lock delay.
   *
   * @private
   */
  _resetLockIfLocking() {
    if (this.isLocking) {
      this.lockTimer = 0
    }
  }
}
