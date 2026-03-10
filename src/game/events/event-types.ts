import type { EventTypeDefinition } from "@/game/types/event";

/** BOOST: temporary speed increase */
export const BOOST_DEF: EventTypeDefinition = {
  typeId: "BOOST",
  displayName: "Boost",
  description: "Temporary speed increase",
  effect: {
    speedMultiplier: 1.5,
    accelDelta: 0,
    progressLock: false,
  },
  animStateOverride: null,
  priority: 10,
  selfStackable: true,
  sfxKey: "sfx-boost",
  vfxKey: "vfx-boost",
};

/** SLOW: temporary speed decrease */
export const SLOW_DEF: EventTypeDefinition = {
  typeId: "SLOW",
  displayName: "Slow",
  description: "Temporary speed decrease",
  effect: {
    speedMultiplier: 0.6,
    accelDelta: 0,
    progressLock: false,
  },
  animStateOverride: null,
  priority: 10,
  selfStackable: true,
  sfxKey: "sfx-slow",
  vfxKey: "vfx-slow",
};

/** STUN: nearly stops the racer temporarily */
export const STUN_DEF: EventTypeDefinition = {
  typeId: "STUN",
  displayName: "Stun",
  description: "Temporarily stops the racer",
  effect: {
    speedMultiplier: 0.05,
    accelDelta: 0,
    progressLock: false,
  },
  animStateOverride: null,
  priority: 20,
  selfStackable: false,
  sfxKey: "sfx-stun",
  vfxKey: "vfx-stun",
};

/** ELIMINATE: permanently removes racer from race */
export const ELIMINATE_DEF: EventTypeDefinition = {
  typeId: "ELIMINATE",
  displayName: "Eliminated",
  description: "Racer is eliminated from the race",
  effect: {
    speedMultiplier: 0,
    accelDelta: 0,
    progressLock: true,
  },
  animStateOverride: "lose",
  priority: 100,
  selfStackable: false,
  sfxKey: "sfx-eliminate",
  vfxKey: "vfx-eliminate",
};
