/** Serialize operations sharing a resource; failures do not poison subsequent work. */
export function createSerialTasks() {
  const pending = new Map<string, Promise<unknown>>();
  return function run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const result = (pending.get(key) ?? Promise.resolve()).catch(() => {}).then(task);
    pending.set(key, result);
    const release = () => { if (pending.get(key) === result) pending.delete(key); };
    // Register both branches: using an ignored finally() would create an unhandled rejection.
    void result.then(release, release);
    return result;
  };
}
