import type { Ctx } from '../services/context';

/** Deterministic context: fixed clock you can move, sequential ids. */
export function testCtx(start = new Date(2026, 9, 28, 10, 0, 0)) {
  let now = new Date(start);
  let n = 0;
  const ctx: Ctx & { advanceDays(d: number): void; set(d: Date): void } = {
    now: () => new Date(now),
    newId: () => `id-${++n}`,
    advanceDays(d: number) {
      now = new Date(now.getTime() + d * 86_400_000);
    },
    set(d: Date) {
      now = new Date(d);
    },
  };
  return ctx;
}
