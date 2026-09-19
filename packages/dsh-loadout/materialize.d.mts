/** Boot-time preset materialization row for the Loadout bundle. See materialize.mjs. */
export declare const name: string
export declare const inject: readonly []
export declare const PRESET_ID: string
export declare const MARKER_FILE: string
export declare const COMPOSITION_VERSION: number

export interface MaterializedMarker {
  readonly presetId?: string
  readonly version: number
  readonly sourceHash?: string
  readonly materializedAt?: string
}

export interface MaterializeReport {
  readonly action: 'created' | 'upgraded' | 'present' | 'present-outdated' | 'claimed'
  readonly presetDir: string
  readonly markerPath: string
  readonly sourceHash?: string
  readonly markerVersion?: number
  readonly sourceVersion?: number
  readonly note?: string
}

export interface MaterializeOptions {
  readonly home: string
  readonly sourceDir: string
  readonly presetId?: string
  readonly now?: () => string
  /** Test seam: invoked after the tree is staged and before the claiming rename (create) or the swap (upgrade). */
  readonly onStaged?: () => void
}

export declare function presetSourceDir(presetId?: string): string
export declare function readMaterializationMarker(presetDir: string): MaterializedMarker | undefined
export declare function materializePreset(options: MaterializeOptions): MaterializeReport
export declare function apply(ctx?: unknown): void
