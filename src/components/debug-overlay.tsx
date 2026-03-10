import { useDebugStore } from "@/game/stores/debug-store";

interface DebugOverlayProps {
  className?: string;
}

export function DebugOverlay({ className }: DebugOverlayProps) {
  const frame = useDebugStore((s) => s.frame);

  if (!frame) {
    return null;
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute top-2 left-2 z-2 rounded-md bg-black/60 px-3 py-2 text-white text-xs shadow-md",
        className
      )}
    >
      <div className="font-mono">
        <div>phase: {frame.phase}</div>
        <div>t: {(frame.elapsedMs / 1000).toFixed(2)}s</div>
        <div>cinematic sprites: {frame.activeCinematicSprites}</div>
        {frame.activeCinematicLabels.length > 0 ? (
          <div className="mt-1 space-y-0.5">
            {frame.activeCinematicLabels.slice(-4).map((label) => (
              <div key={label}>{label}</div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
