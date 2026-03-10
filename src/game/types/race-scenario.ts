import type { EventDrivenScenario } from "./scenario";
import type { PrecomputedScenario } from "./timeline";

export type RaceScenario = PrecomputedScenario | EventDrivenScenario;

export function isEventDrivenScenario(
  s: RaceScenario
): s is EventDrivenScenario {
  return (s as EventDrivenScenario).mode === "EVENT_DRIVEN";
}

export function isPrecomputedScenario(
  s: RaceScenario
): s is PrecomputedScenario {
  return !isEventDrivenScenario(s);
}
