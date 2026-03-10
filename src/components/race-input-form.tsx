import { Button } from "@/components/ui/button";
import type { useGameBridge } from "@/game/hooks/use-game-bridge";
import { usePlaybackStore } from "@/game/stores/playback-store";
import { useUIStore } from "@/game/stores/ui-store";

interface RaceInputFormProps {
  bridge: ReturnType<typeof useGameBridge>;
}

const MOCK_RACERS = `Alice
Bob
Charlie
Diana
Eve
Frank
Grace`;

/**
 * RaceInputForm — textarea for racer names + race start button.
 * One racer per line.
 */
export function RaceInputForm({ bridge }: RaceInputFormProps) {
  const textareaInput = useUIStore((s) => s.textareaInput);
  const setTextarea = useUIStore((s) => s.setTextarea);
  const errors = useUIStore((s) => s.errors);
  const warnings = useUIStore((s) => s.warnings);
  const phase = usePlaybackStore((s) => s.phase);
  const { startRace, resetRace, previewRacers } = bridge;

  const isPlaying = phase === "PLAYING" || phase === "COUNTDOWN";
  const isEnded = phase === "ENDED";

  const handleDefaultRacers = () => {
    setTextarea(MOCK_RACERS);
    previewRacers(MOCK_RACERS);
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex flex-row items-center justify-between gap-2">
        <label className="font-semibold text-sm" htmlFor="racer-names">
          Racer Names
          <span className="ml-1 text-muted-foreground text-xs">
            (one per line)
          </span>
        </label>
        <Button disabled={isPlaying} onClick={handleDefaultRacers} size="sm">
          Default Racers
        </Button>
      </div>

      <textarea
        className="w-full resize-none rounded-md border bg-background p-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
        disabled={isPlaying}
        id="racer-names"
        onChange={(e) => {
          const next = e.target.value;
          setTextarea(next);
          if (!isPlaying) {
            previewRacers(next);
          }
        }}
        placeholder={"Alice\nBob\nCharlie\n..."}
        rows={8}
        value={textareaInput}
      />

      {errors.length > 0 && (
        <ul className="text-destructive text-sm" role="alert">
          {errors.map((err) => (
            <li key={err}>⚠ {err}</li>
          ))}
        </ul>
      )}

      {warnings.length > 0 && (
        <ul className="text-sm text-yellow-500">
          {warnings.map((w) => (
            <li key={w}>ℹ {w}</li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        {!(isPlaying || isEnded) && (
          <button
            className="flex-1 rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
            disabled={!textareaInput.trim()}
            onClick={startRace}
            type="button"
          >
            Start Race
          </button>
        )}

        {isEnded && (
          <button
            className="flex-1 rounded-md bg-secondary px-4 py-2 font-semibold text-secondary-foreground text-sm hover:bg-secondary/90"
            onClick={resetRace}
            type="button"
          >
            New Race
          </button>
        )}
      </div>
    </div>
  );
}
