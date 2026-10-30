/** Injected side effects so services stay pure and testable. */
export interface Ctx {
  now: () => Date;
  newId: () => string;
}

let counter = 0;
/** Default context. The app may inject crypto.randomUUID instead. */
export const defaultCtx: Ctx = {
  now: () => new Date(),
  newId: () => `${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
};
