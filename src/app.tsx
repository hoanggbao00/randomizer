import "./styles.css";
import { DebugOverlay } from "@/components/debug-overlay";
import { RaceCanvas } from "@/components/race-canvas";
import { RaceInputForm } from "@/components/race-input-form";
import { useGameBridge } from "@/game/hooks/use-game-bridge";
import { usePlaybackStore } from "@/game/stores/playback-store";
import { useRacerStore } from "@/game/stores/racer-store";

function App() {
  const bridge = useGameBridge();
  const winnerRacerId = usePlaybackStore((s) => s.winnerRacerId);
  const winnerName = useRacerStore((state) => {
    if (!winnerRacerId) {
      return null;
    }
    const found = state.inputs.find((r) => r.id === winnerRacerId);
    return found?.name ?? winnerRacerId;
  });

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Game Canvas — takes full remaining height */}
      <div className="relative flex-1">
        <RaceCanvas bridge={bridge} className="absolute inset-0" />
        <DebugOverlay />

        {/* Winner overlay */}
        {winnerRacerId ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="rounded-xl bg-background p-8 text-center shadow-2xl">
              <p className="font-medium text-muted-foreground text-sm">
                Winner
              </p>
              <h2 className="mt-1 font-bold text-4xl text-primary">
                🏆 {winnerName}
              </h2>
            </div>
          </div>
        ) : null}
      </div>

      {/* Control panel */}
      <div className="w-full border-t bg-card shadow-lg">
        <RaceInputForm bridge={bridge} />
      </div>
    </div>
  );
}

export default App;
