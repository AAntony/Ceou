import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { showMessage } from '../../lib/dialog';
import { useIsOffline } from '../../lib/network';
import { useFriendships } from '../sharing/queries';
import { Choice, MovingSheet, movingError } from './components';
import type { MovingProject } from './model';
import { useMovingCommand, useMovingShareCandidates } from './queries';

type Props = { project: MovingProject; onClose: () => void };

export function EditMovingSheet({ project, onClose }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState(project.name);
  const [date, setDate] = useState(project.planned_date ?? '');
  const command = useMovingCommand();
  const offline = useIsOffline();
  const save = async () => {
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) {
      showMessage(t('moving.invalidDate')); return;
    }
    try {
      await command.mutateAsync({ action: 'project_edit', payload: { project_id: project.id, name: name.trim(), planned_date: date || null } });
      onClose();
    } catch (error) { showMessage(t(movingError(error))); }
  };
  return <MovingSheet title={t('moving.editProject')} onClose={() => { if (!command.isPending) onClose(); }}>
    <TextField label={t('moving.name')} value={name} onChangeText={setName} maxLength={160} />
    <TextField label={t('moving.date')} value={date} onChangeText={setDate} placeholder="2026-10-01" />
    {offline ? <Text className="mb-3 text-label text-ink-soft">{t('moving.online')}</Text> : null}
    <Button label={t('common.save')} loading={command.isPending} disabled={offline || !name.trim()} onPress={save} />
  </MovingSheet>;
}

export function ShareMovingSheet({ project, onClose }: Props) {
  const { t } = useTranslation();
  const friends = useFriendships();
  const candidates = useMovingShareCandidates(project.id);
  const command = useMovingCommand();
  const offline = useIsOffline();
  const [selected, setSelected] = useState(project.shared_with ?? []);
  const pending = friends.isPending || candidates.isPending;
  const failed = friends.isError || candidates.isError;
  const accepted = (friends.data ?? []).filter(friend => friend.status === 'accepted');
  const save = async () => {
    try {
      await command.mutateAsync({ action: 'sharing', payload: { project_id: project.id, friends: selected.filter(id => accepted.some(friend => friend.otherUserId === id)) } });
      onClose();
    } catch (error) { showMessage(t(movingError(error))); }
  };
  return <MovingSheet title={t('moving.shareFriends')} onClose={() => { if (!command.isPending) onClose(); }}>
    <Text className="mb-4 text-body text-ink-soft">{t('moving.shareHint')}</Text>
    {pending ? <ActivityIndicator /> : failed ? <View className="gap-3"><Text className="text-body text-ink">{t('moving.loadError')}</Text><Button label={t('common.retry')} disabled={offline} onPress={() => { void friends.refetch(); void candidates.refetch(); }} /></View>
      : !accepted.length ? <Text className="mb-4 text-body text-ink-soft">{t('moving.noFriends')}</Text>
      : accepted.map(friend => {
        const permission = candidates.data?.find(row => row.user_id === friend.otherUserId)?.permission;
        const checked = selected.includes(friend.otherUserId);
        return <Choice key={friend.otherUserId} label={friend.otherDisplayName || friend.otherFriendCode} selected={checked}
          detail={t(permission === 'modification' ? 'moving.shareModify' : permission === 'consultation' ? 'moving.shareRead' : 'moving.shareUnavailable')}
          disabled={command.isPending || (!permission && !checked)} onPress={() => setSelected(old => checked ? old.filter(id => id !== friend.otherUserId) : [...old, friend.otherUserId])} />;
      })}
    <View className="mt-3"><Button label={t('common.save')} loading={command.isPending} disabled={offline || pending || failed} onPress={save} /></View>
  </MovingSheet>;
}
