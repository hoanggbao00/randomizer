import { AnimatedSprite, Application, Assets, Spritesheet } from "pixi.js";
import React from "react";

interface SpritePreviewProps {
  className?: string;
  size?: number;
  spritesheetUrl: string;
}

const sheetCache = new Map<string, Spritesheet>();

export function SpritePreview({
  spritesheetUrl,
  className,
  size = 48,
}: SpritePreviewProps) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    let app: Application | null = null;
    let destroyed = false;

    const mount = async () => {
      const host = hostRef.current;
      if (!host) {
        return;
      }

      app = new Application();
      await app.init({
        width: size,
        height: size,
        backgroundAlpha: 0,
        antialias: true,
      });

      host.appendChild(app.canvas);

      let sheet = sheetCache.get(spritesheetUrl);
      if (!sheet) {
        const data = (await Assets.load(spritesheetUrl)) as {
          meta?: { image?: string };
        };
        const imagePath = data.meta?.image ?? "";
        const textureBase = await Assets.load(imagePath);
        sheet = new Spritesheet(textureBase, data);
        await sheet.parse();
        sheetCache.set(spritesheetUrl, sheet);
      }

      const idleFrames =
        sheet.animations.idle ?? sheet.animations.running ?? [];
      if (!idleFrames || idleFrames.length === 0) {
        return;
      }

      if (!app || destroyed) {
        return;
      }

      const sprite = new AnimatedSprite(idleFrames);
      sprite.anchor.set(0.5);
      sprite.x = size / 2;
      sprite.y = size / 2;
      sprite.animationSpeed = 0.15;
      sprite.play();

      app.stage.addChild(sprite);
    };

    mount().catch(() => {
      // Ignore preview load errors; game runtime will handle assets separately.
    });

    return () => {
      destroyed = true;
      if (app) {
        try {
          // Pixi v8 destroy can differ between builds; errors here
          // should not break the main app, so we swallow them.
          app.destroy();
        } catch {
          // ignore
        }
        app = null;
      }
      if (hostRef.current) {
        hostRef.current.innerHTML = "";
      }
    };
  }, [spritesheetUrl, size]);

  return (
    <div
      className={className}
      ref={hostRef}
      style={{ width: size, height: size }}
    />
  );
}
