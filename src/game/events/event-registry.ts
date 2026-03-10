import { z } from "zod";
import type { EventTypeDefinition, RaceEventTypeId } from "@/game/types/event";
import { BOOST_DEF, ELIMINATE_DEF, SLOW_DEF, STUN_DEF } from "./event-types";

const communityEventSchema = z.object({
  typeId: z.string().regex(/^community:.+$/),
  displayName: z.string().min(1).max(50),
  description: z.string().max(200),
  icon: z.string().optional(),
  effect: z.object({
    speedMultiplier: z.number().min(0).max(5),
    accelDelta: z.number().min(-500).max(500),
    progressLock: z.boolean(),
  }),
  /** Can point to any state key from racer spritesheet, including core states */
  animStateOverride: z.string().min(1).max(50).nullable(),
  priority: z.number().int().min(1).max(50),
  selfStackable: z.boolean(),
  sfxKey: z.string().optional(),
  vfxKey: z.string().optional(),
});

export class EventRegistry {
  private readonly types = new Map<RaceEventTypeId, EventTypeDefinition>();

  constructor() {
    this.register(BOOST_DEF);
    this.register(SLOW_DEF);
    this.register(STUN_DEF);
    this.register(ELIMINATE_DEF);
  }

  register(def: EventTypeDefinition): void {
    this.types.set(def.typeId, def);
  }

  get(typeId: RaceEventTypeId): EventTypeDefinition | undefined {
    return this.types.get(typeId);
  }

  getAll(): EventTypeDefinition[] {
    return [...this.types.values()];
  }

  getBuiltinIds(): RaceEventTypeId[] {
    return ["BOOST", "SLOW", "STUN", "ELIMINATE"];
  }

  /**
   * Load and validate community event definitions.
   * Returns successfully loaded definitions and any validation errors.
   */
  loadCommunityEvents(defs: unknown[]): {
    loaded: EventTypeDefinition[];
    errors: string[];
  } {
    const loaded: EventTypeDefinition[] = [];
    const errors: string[] = [];

    for (const [index, def] of defs.entries()) {
      const result = communityEventSchema.safeParse(def);
      if (!result.success) {
        errors.push(
          `Event at index ${index}: ${result.error.issues.map((i) => i.message).join(", ")}`
        );
        continue;
      }

      const data = result.data;
      const eventDef: EventTypeDefinition = {
        typeId: data.typeId as RaceEventTypeId,
        displayName: data.displayName,
        description: data.description,
        icon: data.icon,
        effect: data.effect,
        animStateOverride: data.animStateOverride,
        priority: data.priority,
        selfStackable: data.selfStackable,
        sfxKey: data.sfxKey,
        vfxKey: data.vfxKey,
      };

      this.register(eventDef);
      loaded.push(eventDef);
    }

    return { loaded, errors };
  }
}

/** Singleton event registry — shared across the game runtime */
export const eventRegistry = new EventRegistry();
