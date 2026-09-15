/** One result per opening, including callbacks already queued when cancelling. */
export function createScannerSession() {
  let stopped = false;
  return {
    cancel() { stopped = true; },
    accept(data: string, onScanned: (value: string) => void) {
      if (stopped || !data.trim()) return false;
      stopped = true;
      onScanned(data);
      return true;
    },
  };
}
