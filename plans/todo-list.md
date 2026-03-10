---
title: TODO List
ref: ./race-game-tech-lead-blueprint.md
---

## Reference
- PRD/Blueprint: `plans/race-game-tech-lead-blueprint.md`

## Phase A — Core loop (done)
- [x] Pixi canvas mount/unmount + ticker loop
- [x] Racer preview while typing names
- [x] Event-driven simulation (dynamic velocity)
- [x] Winner emerges from gameplay (no predetermined winner in default mode)
- [x] Race ends when first racer reaches finish
- [x] Camera leader tracking without snap-back

## Phase B — Cinematic/scripted events (in progress)
- [x] Prefab/Instance model (minimal)
- [x] Cinematic runner (simulation-side) + placeholder renderer
- [x] Mock Police + UFO events (Graphics placeholders)
- [x] Anchor snapshot so RACER-relative targets don’t drift
- [x] Elimination = racer disappears completely
- [x] Debug overlay (show phase/time + active cinematic labels)

### Next (Phase B polish)
- [ ] Add easing/tween helpers (ease-in-out) for smoother motion
- [ ] Improve event authoring ergonomics (from/to segments, durations)
- [ ] Add “debug toggle” (keyboard `D` or UI toggle)
- [ ] Add per-event color/shape config (not hardcoded by id prefix)

## Phase C — Event selection UI (planned)
- [ ] Add event-pack selection UI (checkbox list) in control panel
- [ ] Store enabled packs in config/state
- [ ] Schedule only enabled cinematic prefabs on Start

## Phase D — Real assets (planned)
- [ ] Replace placeholder Graphics with spritesheet-based event rendering
- [ ] Add asset loading & caching for event prefabs

