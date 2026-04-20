/**
 * Kung Fu Overdrive — Game configuration.
 *
 * Constants, phase definitions, wave spawns, and boss data
 * for the synthwave beat-em-up.
 *
 * @module games/kungfu/config
 */

export const W = 800
export const H = 500
export const GROUND_Y = H - 80
export const GRAVITY = 1200
export const JUMP_FORCE = -450

export const PHASE = Object.freeze({
  TITLE: "TITLE",
  PLAYING: "PLAYING",
  FLOOR_INTRO: "FLOOR_INTRO",
  BOSS_INTRO: "BOSS_INTRO",
  CUTSCENE: "CUTSCENE",
  GAME_OVER: "GAME_OVER",
  VICTORY: "VICTORY",
})

export const FLOOR_WAVES = {
  1: [
    [{ type: 'grunt', count: 2 }],
    [{ type: 'grunt', count: 3 }],
    [{ type: 'grunt', count: 2 }, { type: 'grabber', count: 1 }],
  ],
  2: [
    [{ type: 'grunt', count: 3 }],
    [{ type: 'grabber', count: 1 }, { type: 'knife_thrower', count: 1 }],
    [{ type: 'grunt', count: 2 }, { type: 'acrobat', count: 1 }],
    [{ type: 'grabber', count: 1 }, { type: 'knife_thrower', count: 2 }],
  ],
  3: [
    [{ type: 'grunt', count: 3 }, { type: 'knife_thrower', count: 1 }],
    [{ type: 'acrobat', count: 2 }, { type: 'grabber', count: 1 }],
    [{ type: 'grunt', count: 2 }, { type: 'acrobat', count: 2 }],
    [{ type: 'grabber', count: 2 }, { type: 'knife_thrower', count: 2 }],
    [{ type: 'acrobat', count: 2 }, { type: 'grunt', count: 3 }],
  ],
}

export const BOSS_DATA = {
  1: { name: 'IRON FIST', health: 50, speed: 80, damage: 18, color: '#cc8844', accentColor: '#ff6b35', w: 50, h: 80 },
  2: { name: 'SHADOW', health: 45, speed: 130, damage: 15, color: '#2a1a3a', accentColor: '#8b5cf6', w: 36, h: 65 },
  3: { name: 'NEON DRAGON', health: 65, speed: 100, damage: 20, color: '#1a1a2e', accentColor: '#ff2d95', w: 45, h: 75 },
}
