import type { Application } from "pixi.js";
import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { assetManager } from "@/game/assets/asset-manager";
import type { RaceDirection } from "@/game/types/race";
import type { RacerRuntimeState } from "@/game/types/racer";
import { createDirectionMapper } from "@/game/utils/coordinate-utils";

const RACER_WIDTH = 48;
const RACER_HEIGHT = 48;
const LABEL_OFFSET = 8;
const FINISH_LABEL_SWITCH_THRESHOLD = 50;
const LABEL_STYLE = new TextStyle({
  fontSize: 12,
  fill: 0xff_ff_ff,
  fontWeight: "bold",
  dropShadow: {
    distance: 1,
    color: 0x00_00_00,
    alpha: 1,
    blur: 0,
    angle: Math.PI / 4,
  },
});

interface RacerNode {
  body: Graphics;
  container: Container;
  label: Text;
  racerId: string;
}

/**
 * RacerRenderer manages Pixi display objects for all racers.
 * Uses colored rectangles as placeholders — replaced by AnimatedSprite in Phase B.
 */
export class RacerRenderer {
  private readonly worldContainer: Container;
  private readonly nodes = new Map<string, RacerNode>();
  private direction: RaceDirection = "LTR";
  private trackLengthPx = 0;

  constructor(app: Application) {
    this.worldContainer = new Container();
    app.stage.addChild(this.worldContainer);
  }

  setup(
    racerStates: Record<string, RacerRuntimeState>,
    racerNames: Record<string, string>,
    direction: RaceDirection,
    trackLengthPx: number
  ): void {
    this.direction = direction;
    this.trackLengthPx = trackLengthPx;
    this.clearAll();
    // Reset camera offset (e.g. after a previous race).
    this.worldContainer.x = 0;
    this.worldContainer.y = 0;

    for (const [racerId, state] of Object.entries(racerStates)) {
      const { color } = assetManager.getRacerVisual(racerId);

      const container = new Container();
      const body = new Graphics();
      body.rect(-RACER_WIDTH / 2, -RACER_HEIGHT / 2, RACER_WIDTH, RACER_HEIGHT);
      body.fill(color);

      const label = new Text({
        text: racerNames[racerId] ?? racerId,
        style: LABEL_STYLE,
      });
      label.anchor.set(0, 0.5);

      container.addChild(body);
      container.addChild(label);
      this.worldContainer.addChild(container);

      this.nodes.set(racerId, { container, body, label, racerId });
      this.updateNode(racerId, state);
    }
  }

  update(
    racerStates: Record<string, RacerRuntimeState>,
    cameraWorldMain: number
  ): void {
    const mapper = createDirectionMapper(this.direction, this.trackLengthPx);

    for (const [racerId, state] of Object.entries(racerStates)) {
      this.updateNode(racerId, state);
    }

    // Apply camera offset to world container
    const cameraScreen = mapper.toScreen({ main: cameraWorldMain, cross: 0 });
    this.worldContainer.x = -cameraScreen.x;
    this.worldContainer.y = -cameraScreen.y;
  }

  private updateNode(racerId: string, state: RacerRuntimeState): void {
    const node = this.nodes.get(racerId);
    if (!node) {
      return;
    }

    const mapper = createDirectionMapper(this.direction, this.trackLengthPx);
    const screen = mapper.toScreen({
      main: state.worldMain,
      cross: state.worldCross,
    });

    node.container.x = screen.x;
    node.container.y = screen.y;

    const isNearFinish =
      this.trackLengthPx > 0 &&
      Math.abs(this.trackLengthPx - state.worldMain) <
        FINISH_LABEL_SWITCH_THRESHOLD;

    this.positionLabel(node.label, this.direction, isNearFinish);

    // Dim eliminated racers, allow cinematic override.
    const baseAlpha = state.isEliminated ? 0.4 : 1;
    node.container.alpha = state.opacity ?? baseAlpha;
  }

  private positionLabel(
    label: Text,
    direction: RaceDirection,
    isNearFinish: boolean
  ): void {
    const forwardOffset = RACER_WIDTH / 2 + LABEL_OFFSET;
    const backwardOffset = -(RACER_WIDTH / 2 + LABEL_OFFSET);

    switch (direction) {
      case "LTR": {
        label.x = isNearFinish ? backwardOffset : forwardOffset;
        label.y = 0;
        label.anchor.set(isNearFinish ? 1 : 0, 0.5);
        break;
      }
      case "RTL": {
        label.x = isNearFinish ? -backwardOffset : -forwardOffset;
        label.y = 0;
        label.anchor.set(isNearFinish ? 0 : 1, 0.5);
        break;
      }
      case "TTB": {
        label.x = 0;
        label.y = isNearFinish
          ? -(RACER_HEIGHT / 2 + LABEL_OFFSET)
          : RACER_HEIGHT / 2 + LABEL_OFFSET;
        label.anchor.set(0.5, isNearFinish ? 1 : 0);
        break;
      }
      case "BTT": {
        label.x = 0;
        label.y = isNearFinish
          ? RACER_HEIGHT / 2 + LABEL_OFFSET
          : -(RACER_HEIGHT / 2 + LABEL_OFFSET);
        label.anchor.set(0.5, isNearFinish ? 0 : 1);
        break;
      }
      default: {
        const _exhaustive: never = direction;
        throw new Error(`Unknown direction: ${_exhaustive}`);
      }
    }
  }

  private clearAll(): void {
    for (const node of this.nodes.values()) {
      node.container.destroy({ children: true });
    }
    this.nodes.clear();
    // Also reset any previous camera offset so fresh setups don't inherit it.
    this.worldContainer.x = 0;
    this.worldContainer.y = 0;
  }

  destroy(): void {
    this.clearAll();
    this.worldContainer.destroy({ children: true });
  }
}
