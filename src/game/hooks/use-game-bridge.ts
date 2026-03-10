import { RaceOrchestrator } from "@/game/core/race-orchestrator";

/**
 * useGameBridge — React hook that manages the game lifecycle.
 * Mounts Pixi canvas into a host div and exposes orchestrator actions.
 *
 * Uses a generation counter to guard against React StrictMode's
 * double-invoke of effect callbacks: if unmount() fires before the
 * async mountPixi() resolves, the stale completion is detected and
 * the orphaned orchestrator is immediately destroyed.
 */
export function useGameBridge() {
  const orchestratorRef = useRef<RaceOrchestrator | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  // Incremented on every unmount so stale async mounts can self-cancel.
  const mountGenRef = useRef(0);

  const mount = async (host: HTMLDivElement) => {
    // Claim this mount generation before any await.
    mountGenRef.current += 1;
    const myGen = mountGenRef.current;

    if (orchestratorRef.current) {
      return;
    }

    hostRef.current = host;
    const orchestrator = new RaceOrchestrator();
    await orchestrator.mountPixi(host);

    // If unmount() fired while we were awaiting, our generation is stale.
    // Destroy the orphaned orchestrator and bail out.
    if (mountGenRef.current !== myGen) {
      orchestrator.unmount();
      return;
    }

    orchestratorRef.current = orchestrator;
  };

  const unmount = () => {
    // Invalidate any in-flight mount by bumping the generation.
    mountGenRef.current += 1;

    orchestratorRef.current?.unmount();
    orchestratorRef.current = null;
  };

  const startRace = () => {
    orchestratorRef.current?.startRace();
  };

  const previewRacers = (rawNames: string) => {
    orchestratorRef.current?.previewRacers(rawNames);
  };

  const pauseRace = () => {
    orchestratorRef.current?.pauseRace();
  };

  const resetRace = () => {
    orchestratorRef.current?.resetRace();
  };

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      const host = hostRef.current;
      if (!(host && orchestratorRef.current)) {
        return;
      }
      orchestratorRef.current.resize(host.clientWidth, host.clientHeight);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unmount();
    };
  }, [unmount]);

  return {
    mount,
    unmount,
    startRace,
    previewRacers,
    pauseRace,
    resetRace,
    orchestratorRef,
  };
}
