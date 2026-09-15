export function movingError(error: unknown): string {
  const message = String((error as { message?: string })?.message ?? error);
  if (message.includes('moving_delete_not_empty')) return 'moving.deleteNotEmpty';
  if (message.includes('moving_share_rights')) return 'moving.shareRightsChanged';
  if (message.includes('moving_busy')) return 'moving.busy';
  if (message.includes('moving_offline')) return 'moving.online';
  if (message.includes('moving_forbidden')) return 'moving.forbidden';
  if (message.includes('moving_destination')) return 'moving.wrongDestination';
  if (message.includes('moving_object_changed') || message.includes('moving_object_missing') || message.includes('moving_other_project')) return 'moving.conflict';
  if (message.includes('moving_not_empty')) return 'moving.notEmpty';
  if ((error as { code?: string })?.code === 'PGRST202') return 'moving.setup';
  return 'moving.error';
}
