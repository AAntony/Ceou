/** Locks before React renders the pending state; never queues a second write. */
export function createCommandGuard() {
  let pending = false;
  return async function run<T>(isOnline: () => boolean, task: () => Promise<T>): Promise<T> {
    if (pending) throw new Error('moving_busy');
    if (!isOnline()) throw new Error('moving_offline');
    pending = true;
    try {
      return await task();
    } finally {
      pending = false;
    }
  };
}
