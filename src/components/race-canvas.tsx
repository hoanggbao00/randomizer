import type { useGameBridge } from "@/game/hooks/use-game-bridge";

interface RaceCanvasProps {
  bridge: ReturnType<typeof useGameBridge>;
  className?: string;
}

/**
 * RaceCanvas — host div for the Pixi canvas.
 * Mounts the game runtime when the div is available.
 */
export function RaceCanvas({ bridge, className }: RaceCanvasProps) {
  const { mount, unmount } = bridge;

  const hostRef = (node: HTMLDivElement | null) => {
    if (node) {
      mount(node);
    } else {
      unmount();
    }
  };

  return (
    <div
      className={className}
      ref={hostRef}
      style={{ width: "100%", height: "100%", overflow: "hidden" }}
    />
  );
}
