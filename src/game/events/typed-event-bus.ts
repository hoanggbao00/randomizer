export type Unsubscribe = () => void;

/**
 * Tiny typed event bus (no deps) to decouple concerns.
 * Each bus instance is isolated (simulation vs rendering).
 */
export class TypedEventBus<TEvents extends object> {
  private readonly listeners = new Map<
    keyof TEvents,
    Set<(payload: unknown) => void>
  >();

  on<K extends keyof TEvents>(
    type: K,
    handler: (payload: TEvents[K]) => void
  ): Unsubscribe {
    const set =
      this.listeners.get(type) ?? new Set<(payload: unknown) => void>();
    // Store as unknown handler; casting is contained here.
    set.add(handler as unknown as (payload: unknown) => void);
    this.listeners.set(type, set);
    return () => {
      set.delete(handler as unknown as (payload: unknown) => void);
      if (set.size === 0) {
        this.listeners.delete(type);
      }
    };
  }

  emit<K extends keyof TEvents>(type: K, payload: TEvents[K]): void {
    const set = this.listeners.get(type);
    if (!set) {
      return;
    }
    // Clone to avoid mutation during emit (unsubscribe inside handler).
    for (const handler of [...set]) {
      handler(payload);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
