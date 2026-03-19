/**
 * Parallel asset loader for game audio and sprite sheets.
 *
 * Uses a consumer-provided `resolveAsset` callback to resolve logical
 * asset paths to URLs. No server manifest, no framework dependencies.
 *
 * Missing assets log a warning but don't crash — games degrade
 * gracefully to silent / sprite-free operation.
 *
 * @example
 * const assets = await loadAssets(
 *   { effects: ["jump", "land"], ambient: ["engine-ride"] },
 *   { resolveAsset: (path) => `/games/bayman/${path}` }
 * )
 *
 * @module engine/assets
 */
import { AudioManager } from "./audio.js"
import { SpriteSheet, SpriteManager } from "./sprites.js"

/**
 * Load all assets for a game in parallel.
 *
 * @param {Object} manifest - Asset manifest listing what to load
 * @param {string[]} [manifest.effects] - Sound effect names
 * @param {string[]} [manifest.music] - Music track names
 * @param {string[]} [manifest.ambient] - Ambient loop names
 * @param {string[]} [manifest.sprites] - Sprite sheet names
 * @param {Object} options
 * @param {function} options.resolveAsset - Maps logical path to URL
 * @param {AudioContext} [options.audioContext] - Existing AudioContext
 * @returns {Promise<{audio: AudioManager, sprites: SpriteManager}>}
 */
export async function loadAssets(manifest = {}, { resolveAsset, audioContext } = {}) {
  const ctx = audioContext || new AudioContext()
  const audio = new AudioManager(ctx)
  const sprites = new SpriteManager()

  const audioLoads = []
  for (const type of ["effects", "music", "ambient"]) {
    for (const name of manifest[type] || []) {
      const url = resolveAsset(`${type}/${name}.mp3`)
      audioLoads.push(_loadAudioBuffer(audio, name, url))
    }
  }

  const spriteLoads = (manifest.sprites || []).map((name) => {
    const png = resolveAsset(`${name}.png`)
    const json = resolveAsset(`${name}.json`)
    return _loadSpriteSheet(sprites, name, png, json)
  })

  await Promise.all([...audioLoads, ...spriteLoads])
  return { audio, sprites }
}

/**
 * Load a single audio buffer.
 *
 * @private
 */
async function _loadAudioBuffer(audio, name, url) {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const buffer = await response.arrayBuffer()
    await audio.loadBuffer(name, buffer)
  } catch (err) {
    console.warn(`[AssetLoader] Failed to load audio "${name}":`, err.message)
  }
}

/**
 * Load a sprite sheet (PNG + JSON descriptor).
 *
 * @private
 */
async function _loadSpriteSheet(sprites, name, pngUrl, jsonUrl) {
  try {
    const [image, descriptor] = await Promise.all([
      _loadImage(pngUrl),
      _loadJSON(jsonUrl),
    ])
    sprites.add(name, new SpriteSheet(image, descriptor))
  } catch (err) {
    console.warn(`[AssetLoader] Failed to load sprite "${name}":`, err.message)
  }
}

/**
 * Load an image as HTMLImageElement.
 *
 * @private
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
function _loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  })
}

/**
 * Load and parse a JSON file.
 *
 * @private
 * @param {string} url
 * @returns {Promise<Object>}
 */
async function _loadJSON(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}
