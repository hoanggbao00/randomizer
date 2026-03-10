import type { Application } from "pixi.js";
import { Container, Graphics } from "pixi.js";
import type { RaceDirection } from "@/game/types/race";
import { createDirectionMapper } from "@/game/utils/coordinate-utils";

export interface CinematicSpriteFrame {
  id: string;
  opacity: number;
  worldCross: number;
  worldMain: number;
}

/**
 * Phase B: placeholder renderer for cinematic events.
 * Uses simple graphics boxes (upgrade to spritesheet later).
 */
export class CinematicEventRenderer {
  private readonly worldContainer: Container;
  private readonly nodes = new Map<string, Graphics>();
  private direction: RaceDirection = "LTR";
  private trackLengthPx = 0;

  constructor(app: Application) {
    this.worldContainer = new Container();
    app.stage.addChild(this.worldContainer);
  }

  setup(direction: RaceDirection, trackLengthPx: number): void {
    this.direction = direction;
    this.trackLengthPx = trackLengthPx;
    this.clearAll();
    // Reset camera offset (e.g. after a previous race).
    this.worldContainer.x = 0;
    this.worldContainer.y = 0;
  }

  update(sprites: CinematicSpriteFrame[], cameraWorldMain: number): void {
    const mapper = createDirectionMapper(this.direction, this.trackLengthPx);

    const alive = new Set<string>();
    for (const s of sprites) {
      alive.add(s.id);
      const node = this.nodes.get(s.id) ?? this.createNode(s.id);
      const screen = mapper.toScreen({
        main: s.worldMain,
        cross: s.worldCross,
      });
      node.x = screen.x;
      node.y = screen.y;
      node.alpha = s.opacity;
    }

    // Remove nodes that are no longer active
    for (const [id, node] of this.nodes.entries()) {
      if (!alive.has(id)) {
        node.destroy();
        this.nodes.delete(id);
      }
    }

    // Camera offset
    const cameraScreen = mapper.toScreen({ main: cameraWorldMain, cross: 0 });
    this.worldContainer.x = -cameraScreen.x;
    this.worldContainer.y = -cameraScreen.y;
  }

  destroy(): void {
    this.clearAll();
    this.worldContainer.destroy({ children: true });
  }

  private createNode(id: string): Graphics {
    const g = new Graphics();
    const isUfo = id.startsWith("ufo-");
    const color = isUfo ? 0xbd_6b_ff : 0x55_aa_ff;
    const size = isUfo ? { w: 30, h: 30 } : { w: 40, h: 20 };
    g.roundRect(-size.w / 2, -size.h / 2, size.w, size.h, 6);
    g.fill(color);
    this.worldContainer.addChild(g);
    this.nodes.set(id, g);
    return g;
  }

  private clearAll(): void {
    for (const node of this.nodes.values()) {
      node.destroy();
    }
    this.nodes.clear();
    this.worldContainer.x = 0;
    this.worldContainer.y = 0;
  }
}
