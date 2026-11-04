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
