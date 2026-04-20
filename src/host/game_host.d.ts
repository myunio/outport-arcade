/**
 * Type declarations for GameHost.
 *
 * The actual implementation is in game_host.js. This file exists only
 * so TypeScript consumers get non-`any` types on import — the full
 * option shape is documented in game_host.js's JSDoc.
 */
export class GameHost {
  constructor(container: HTMLElement, options: GameHostOptions)
  start(): Promise<void>
  destroy(): void
  getEngineState(): unknown
  togglePause(): void
  toggleHelp(): void
}

export interface GameHostOptions {
  engine: unknown
  renderer: unknown
  config: Record<string, unknown>
  canvas: { width: number; height: number }
  resolveAsset: (path: string) => string
  handleKey?: (e: KeyboardEvent, engine: unknown) => void
  handleClick?: (engine: unknown) => void
  onScore?: (score: number) => Promise<unknown> | unknown
  onPhaseChange?: (from: string, to: string) => void
  onReady?: () => void
  onExit?: (engine: unknown) => void
  initialState?: unknown
  storageKey?: string
}
