/** Invalidates pending capture work whenever its native camera is replaced. */
export function createCaptureGuard() {
  let generation = 0;
  let ready = false;
  let busy = false;
  return {
    reset() { generation += 1; ready = false; busy = false; },
    markReady() { ready = true; },
    begin(): number | undefined {
      if (!ready || busy) return undefined;
      busy = true;
      return generation;
    },
    isCurrent(token: number) { return token === generation && ready; },
    finish(token: number) {
      if (token !== generation) return false;
      busy = false;
      return true;
    },
    isBusy() { return busy; },
  };
}
