type Unsubscribe = () => void;

/** Events supersede in-flight reads; disposed observers cannot publish stale state. */
export function observeAsyncState<T>({ read, subscribe, subscribeRefresh, publish, fallback }: {
  read: () => Promise<T>;
  subscribe: (receive: (value: T) => void) => Unsubscribe;
  subscribeRefresh: (refresh: () => void) => Unsubscribe;
  publish: (value: T) => void;
  fallback: T;
}): Unsubscribe {
  let active = true;
  let revision = 0;
  const subscriptions: Unsubscribe[] = [];
  const dispose = () => {
    active = false;
    for (const unsubscribe of subscriptions.splice(0)) unsubscribe();
  };
  const refresh = async () => {
    const startedAt = ++revision;
    let value: T;
    try { value = await read(); } catch { value = fallback; }
    if (active && startedAt === revision) publish(value);
  };
  try {
    subscriptions.push(subscribe((value) => {
      if (!active) return;
      revision++;
      publish(value);
    }));
    subscriptions.push(subscribeRefresh(() => { void refresh(); }));
    void refresh();
  } catch {
    dispose();
    publish(fallback);
  }
  return dispose;
}
