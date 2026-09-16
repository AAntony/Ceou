/** Keep the last session offline; an explicit sign-out alone can clear it. */
export function observeSession<T>({ read, subscribe, publish, ready, signedOut }: {
  read: () => Promise<T | null>;
  subscribe: (receive: (event: string, session: T | null) => void) => () => void;
  publish: (session: T | null) => void;
  ready: () => void;
  signedOut: () => void;
}): () => void {
  let active = true;
  let receivedEvent = false;
  const unsubscribe = subscribe((event, session) => {
    if (!active) return;
    receivedEvent = true;
    if (event === 'SIGNED_OUT') {
      publish(null);
      signedOut();
    } else if (session !== null) publish(session);
    ready();
  });
  void read().then((session) => {
    if (active && !receivedEvent) publish(session);
  }).catch(() => {
    // Failed storage/network reads must not leave the startup screen stuck.
    // An auth event may already have supplied a usable offline session.
  }).finally(() => { if (active) ready(); });
  return () => { active = false; unsubscribe(); };
}
