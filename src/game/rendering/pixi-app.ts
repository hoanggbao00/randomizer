import { Application } from "pixi.js";

export interface PixiAppConfig {
  backgroundColor: number;
  height: number;
  host: HTMLDivElement;
  width: number;
}

/**
 * Wrapper around PixiJS Application.
 * Manages lifecycle: init, resize, destroy.
 */
export class PixiApp {
  private app: Application | null = null;

  get instance(): Application {
    if (!this.app) {
      throw new Error("PixiApp not initialized. Call init() first.");
    }
    return this.app;
  }

  get isInitialized(): boolean {
    return this.app !== null;
  }

  async init(config: PixiAppConfig): Promise<void> {
    this.app = new Application();

    await this.app.init({
      width: config.width,
      height: config.height,
      backgroundColor: config.backgroundColor,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    config.host.appendChild(this.app.canvas);
  }

  resize(width: number, height: number): void {
    if (!this.app) {
      return;
    }
    this.app.renderer.resize(width, height);
  }

  destroy(): void {
    if (!this.app) {
      return;
    }
    this.app.destroy(true, { children: true, texture: true });
    this.app = null;
  }
}
