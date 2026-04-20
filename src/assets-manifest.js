/**
 * Asset URL manifest — maps logical asset keys to bundler-processed URLs.
 *
 * Vite consumers get fingerprinted asset URLs via `?url` imports.
 * Non-bundler consumers (static HTML) ignore this file and use their
 * own `resolveAsset` callback on the GameHost options.
 *
 * Key format: `<game>/<subpath>` — e.g., `bayman/effects/jump.mp3`.
 *
 * @module assets-manifest
 */

// Bayman
import baymanAmbientEngineRev from "../assets/bayman/ambient/engine-rev.mp3?url"
import baymanAmbientEngineRide from "../assets/bayman/ambient/engine-ride.mp3?url"
import baymanEffectsCollision from "../assets/bayman/effects/collision.mp3?url"
import baymanEffectsJump from "../assets/bayman/effects/jump.mp3?url"
import baymanEffectsLand from "../assets/bayman/effects/land.mp3?url"
import baymanEffectsPowerup from "../assets/bayman/effects/powerup.mp3?url"
import baymanEffectsSmash from "../assets/bayman/effects/smash.mp3?url"

// Kung Fu
import kungFuMusicSoundtrack from "../assets/kung_fu/music/soundtrack.mp3?url"

export const ASSET_URLS = {
  "bayman/ambient/engine-rev.mp3": baymanAmbientEngineRev,
  "bayman/ambient/engine-ride.mp3": baymanAmbientEngineRide,
  "bayman/effects/collision.mp3": baymanEffectsCollision,
  "bayman/effects/jump.mp3": baymanEffectsJump,
  "bayman/effects/land.mp3": baymanEffectsLand,
  "bayman/effects/powerup.mp3": baymanEffectsPowerup,
  "bayman/effects/smash.mp3": baymanEffectsSmash,
  "kung_fu/music/soundtrack.mp3": kungFuMusicSoundtrack,
}

/**
 * Look up an asset URL for a given game and logical path.
 *
 * @param {string} game - e.g., "bayman"
 * @param {string} path - e.g., "effects/jump.mp3"
 * @returns {string|null} Fingerprinted URL or null if not in manifest
 */
export function getAssetUrl(game, path) {
  return ASSET_URLS[`${game}/${path}`] || null
}
