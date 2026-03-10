import type { RacerAnimState } from "./racer";

export interface SpriteAnimationDef {
  fps: number;
  /** Frame names in atlas */
  frames: string[];
  loop: boolean;
  /** Animation state key — matches keys in spritesheet manifest */
  state: RacerAnimState;
}

export interface RacerVisualProfile {
  anchor: { x: number; y: number };
  animations: SpriteAnimationDef[];
  /** URL or path to atlas JSON */
  atlasData: string;
  /** URL or path to atlas image */
  atlasImage: string;
  profileId: string;
  scale: number;
  /** Multiple racers can share one atlas */
  sharedAtlasId?: string;
}

/**
 * Community upload manifest format.
 * Required animation keys: idle, running.
 * Optional core keys: lose, win.
 * Any additional key is treated as community custom state.
 */
export interface AssetManifest {
  anchor: { x: number; y: number };
  animations: Record<
    string,
    {
      frames: string[];
      fps: number;
      loop: boolean;
    }
  >;
  assetId: string;
  atlasData: string;
  atlasImage: string;
  author: string;
  defaultScale: number;
  displayName: string;
  manifestVersion: 1;
}

export interface AssetValidationResult {
  profile: RacerVisualProfile;
  valid: true;
}

export interface AssetValidationError {
  errors: string[];
  valid: false;
}

export type AssetValidationOutcome =
  | AssetValidationResult
  | AssetValidationError;
