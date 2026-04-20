# @unio/outport-arcade

Portable mini-game engine and the five games that ship with [Outport](https://github.com/myunio/outport-app-v2).

This package is consumed by Outport via `github:myunio/outport-arcade` — it is not published to npm. It was extracted so the games are developable in isolation (see `examples/bayman.html`) and so the host app stays free of canvas/audio plumbing.

## Games

| Key | Title | Style |
|-----|-------|-------|
| `bayman` | Bayman! | Newfoundland, reflex |
| `cod_jigger` | Cod Jigging Grounds | Newfoundland, timing |
| `overboard` | Overboard! | Newfoundland, dodger |
| `woodpile_tycoon` | Woodpile Tycoon | Newfoundland, clicker |
| `kung_fu` | Kung Fu Overdrive | 80's arcade, brawler |

## Install

```bash
pnpm add github:myunio/outport-arcade
```

The repo's `prepare` script builds `dist/outport-arcade.esm.js` via esbuild at install time, so a plain `pnpm install` in the consumer is all you need.

## Usage

```js
import { GameHost } from "@unio/outport-arcade/host"
import { BaymanEngine, BaymanRenderer, BaymanConfig } from "@unio/outport-arcade/games/bayman"

const host = new GameHost({
  engineFactory: () => new BaymanEngine(BaymanConfig),
  rendererFactory: (canvas) => new BaymanRenderer(canvas, BaymanConfig),
  canvas: document.getElementById("game-canvas"),
  storageKey: "outport_arcade_audio",
  getAssetManifest: () => BaymanConfig.ASSETS,
  handleKey: (engine, event) => engine.handleKey(event),
  handleClick: (engine) => engine.handleClick(),
  onGameOver: ({ score }) => console.log("Final score:", score),
})

await host.start()
```

`GameHost` owns the canvas lifecycle, audio resume on first user gesture, and the per-game input routing. Games implement the `Engine` / `Renderer` contract; see any of the `src/games/*` folders for the pattern.

### Available subpath exports

- `@unio/outport-arcade` — top-level re-exports
- `@unio/outport-arcade/host` — `GameHost`
- `@unio/outport-arcade/games/<key>` — per-game engine + renderer + config
- `@unio/outport-arcade/assets/<path>` — asset files (sprites, audio) resolved via Vite/static imports
- `@unio/outport-arcade/assets-manifest` — typed asset path helpers

## Development

```bash
pnpm install        # installs esbuild; runs build
pnpm run build      # rebuild dist/
open examples/bayman.html  # drive the engine without the host app
```

Source files under `src/` are shipped raw — the consuming app's Vite pipeline compiles them. The `dist/` bundle is only used by environments that can't process raw ESM from `node_modules`.

## License

UNLICENSED. Internal to Unio / Sevenview.
