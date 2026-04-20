/**
 * Outport Arcade — portable game engine and mini-games.
 *
 * @module @unio/outport-arcade
 */

// Engine core
export { GameHost } from "./host/game_host.js"
export { BaseEngine } from "./engine/base_engine.js"
export { AudioManager } from "./engine/audio.js"
export { InputManager } from "./engine/input.js"
export { ParticleSystem } from "./engine/particles.js"
export { SpriteSheet, SpriteManager } from "./engine/sprites.js"
export { loadAssets } from "./engine/assets.js"

// Games
export { BaymanEngine, BaymanRenderer } from "./games/bayman/index.js"
export * as BaymanConfig from "./games/bayman/config.js"

export { CodJiggerEngine, CodJiggerRenderer } from "./games/codjigger/index.js"
export * as CodJiggerConfig from "./games/codjigger/config.js"

export { OverboardEngine, OverboardRenderer } from "./games/overboard/index.js"
export * as OverboardConfig from "./games/overboard/config.js"

export { WoodpileEngine, WoodpileRenderer } from "./games/woodpile/index.js"
export * as WoodpileConfig from "./games/woodpile/config.js"

export { KungFuEngine, KungFuRenderer } from "./games/kungfu/index.js"
export * as KungFuConfig from "./games/kungfu/config.js"
