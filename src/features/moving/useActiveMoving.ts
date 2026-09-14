import { router } from 'expo-router';
import { useIsOffline } from '../../lib/network';
import { movingProgress } from './model';
import { useMovingProjects, useMovingSnapshot } from './queries';

export type ActiveMoving = ReturnType<typeof useActiveMoving>;

/**
 * Ongoing moves, seen from outside the moving screens.
 *
 * The percentage is the dashboard's own figure (`movingProgress`), and only
 * exists for a single ongoing move that already has objects in boxes: with
 * several moves, or none packed yet, there is no honest number to show.
 */
export function useActiveMoving() {
  const projects = useMovingProjects();
  const offline = useIsOffline();
  const all = projects.data ?? [];
  const active = all.filter((project) => project.status !== 'completed');
  const single = active.length === 1 ? active[0] : undefined;
  // Same cache entry as the dashboard: opening the move afterwards is instant.
  const snapshot = useMovingSnapshot(single?.id ?? '');
  const items = single ? snapshot.data?.items ?? [] : [];

  // The creation form only makes sense when there is nothing else to show:
  // ongoing moves and archives live on the list screen, and offline the list
  // explains why creating is unavailable.
  const startsWithForm = projects.isSuccess && all.length === 0 && !offline;

  return {
    activeCount: active.length,
    percent: items.length ? movingProgress(items).percent : null,
    resume: () => router.push(single ? `/moving/${single.id}` : '/moving'),
    start: (openForm: () => void) => (startsWithForm ? openForm() : router.push('/moving')),
  };
}
