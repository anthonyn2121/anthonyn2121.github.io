/** Tiny pub-sub for streaming values between components without re-rendering React. */
export function createBus<A extends unknown[]>() {
  type Listener = (...args: A) => void;
  const listeners = new Set<Listener>();
  return {
    emit(...args: A) {
      listeners.forEach((l) => l(...args));
    },
    subscribe(l: Listener) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}

/** The reticle streams pointer position to the top bar. */
export const cursorBus = createBus<[x: number, y: number]>();
