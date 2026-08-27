import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, View } from 'react-native';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { FormActions } from '../../components/FormActions';
import { SegmentedTabs } from '../../components/SegmentedTabs';
import { TextField } from '../../components/TextField';
import { logClientError } from '../../lib/errorLogging';
import { useThemeColors } from '../../lib/theme';
import { scheduleLoanReminder } from '../notifications/loanReminders';
import { useFriendships } from '../sharing/queries';
import { dueInDays, useCreatePret, type PretDirection } from './queries';

type LoanSheetProps = {
  visible: boolean;
  onClose: () => void;
  objetId: string;
  objetName: string;
};

// Enregistrer un prêt ou un emprunt.
//
// DEUX FORMES D'INTERLOCUTEUR, ET LA SECONDE EST LA PLUS COURANTE. On choisit
// un ami de l'app, ou on tape simplement un nom — dans la vraie vie on prête
// surtout à des gens qui n'installeront jamais Céoù. Taper par-dessus un ami
// choisi rompt le lien vers son compte : le nom saisi devient alors la seule
// vérité, ce qui est exactement ce qu'on veut si on corrige « Marc » en
// « Marc (le voisin) ».
//
// L'ÉCHÉANCE SE SAISIT EN JOURS, pas avec un calendrier. C'est déjà la
// convention des codes d'invitation, ça évite d'ajouter une dépendance de
// sélecteur de date, et « dans 15 jours » est de toute façon la façon dont on
// pense un prêt.
export function LoanSheet({ visible, onClose, objetId, objetName }: LoanSheetProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const createPret = useCreatePret();
  const { data: friendships } = useFriendships();

  const [direction, setDirection] = useState<PretDirection>('pret');
  const [label, setLabel] = useState('');
  const [friendId, setFriendId] = useState<string | null>(null);
  const [withDue, setWithDue] = useState(true);
  const [days, setDays] = useState('14');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (visible) {
      setDirection('pret');
      setLabel('');
      setFriendId(null);
      setWithDue(true);
      setDays('14');
      setNote('');
    }
  }, [visible]);

  const friends = (friendships ?? [])
    .filter((f) => f.status === 'accepted')
    .sort((a, b) => (a.otherDisplayName || a.otherFriendCode).localeCompare(b.otherDisplayName || b.otherFriendCode));

  const pickFriend = (userId: string, name: string) => {
    // Re-toucher l'ami déjà choisi le désélectionne : sinon il faudrait vider
    // le champ à la main pour revenir à un nom libre.
    if (friendId === userId) {
      setFriendId(null);
      return;
    }
    setFriendId(userId);
    setLabel(name);
  };

  const onLabelChange = (value: string) => {
    setLabel(value);
    // Écrire par-dessus le nom d'un ami rompt le lien : on ne veut pas
    // enregistrer le compte de Marc sous le nom de quelqu'un d'autre.
    setFriendId(null);
  };

  const parsedDays = Math.max(1, Math.min(3650, parseInt(days, 10) || 1));
  const canSubmit = label.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      const created = await createPret.mutateAsync({
        objetId,
        direction,
        counterpartLabel: label,
        counterpartUserId: friendId,
        dueAt: withDue ? dueInDays(parsedDays) : null,
        note: note.trim() || null,
      });
      // Le nom de l'objet ne vient pas de la ligne insérée (elle ne porte que
      // son identifiant) mais des props de cette feuille — c'est le seul
      // endroit où les deux sont réunis.
      void scheduleLoanReminder(
        {
          id: created.id,
          objetName,
          direction: created.direction as PretDirection,
          counterpartLabel: created.counterpart_label,
          dueAt: created.due_at,
          returnedAt: created.returned_at,
        },
        t,
      );
      onClose();
    } catch (err) {
      logClientError(err, { source: 'loan_create', direction });
      Alert.alert(t('common.error_generic'));
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      sheetClassName="rounded-t-3xl bg-surface px-6 pb-6 pt-6"
      sheetStyle={{ maxHeight: '88%' }}
      scrollable
    >
      <Text className="text-heading font-bold text-ink">{t('loans.sheet.title')}</Text>
      <Text numberOfLines={2} className="mb-4 mt-1 text-label text-ink-soft">
        {objetName}
      </Text>

      <SegmentedTabs
        value={direction}
        onChange={setDirection}
        options={[
          { value: 'pret' as const, label: t('loans.direction.lent') },
          { value: 'emprunt' as const, label: t('loans.direction.borrowed') },
        ]}
      />

      <Text className="mb-2 text-label font-medium text-ink-soft">
        {direction === 'pret' ? t('loans.sheet.who_lent') : t('loans.sheet.who_borrowed')}
      </Text>

      {friends.length > 0 ? (
        <View className="mb-3 flex-row flex-wrap gap-2">
          {friends.map((friend) => {
            const name = friend.otherDisplayName || friend.otherFriendCode;
            const selected = friend.otherUserId === friendId;
            return (
              <Pressable
                key={friend.id}
                onPress={() => pickFriend(friend.otherUserId, name)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                android_ripple={{ color: colors.ripple, borderless: false }}
                className={`self-start overflow-hidden rounded-full border px-3 py-2 ${
                  selected ? 'border-coral bg-coral' : 'border-ink/10 bg-surface'
                }`}
              >
                <Text className={selected ? 'font-semibold text-white' : 'text-ink-soft'}>{name}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <TextField
        label={t('loans.sheet.name_label')}
        value={label}
        onChangeText={onLabelChange}
        placeholder={t('loans.sheet.name_placeholder')}
        maxLength={60}
      />
      <Text className="mb-4 -mt-2 text-caption leading-4 text-ink-soft">{t('loans.sheet.name_hint')}</Text>

      <Text className="mb-2 text-label font-medium text-ink-soft">{t('loans.sheet.due')}</Text>
      <SegmentedTabs
        value={withDue ? 'due' : 'open'}
        onChange={(next: 'due' | 'open') => setWithDue(next === 'due')}
        options={[
          { value: 'due' as const, label: t('loans.sheet.due_set') },
          { value: 'open' as const, label: t('loans.sheet.due_none') },
        ]}
      />

      {withDue ? (
        <TextField
          label={t('loans.sheet.due_days')}
          value={days}
          onChangeText={setDays}
          keyboardType="number-pad"
          maxLength={4}
        />
      ) : (
        <Text className="mb-4 text-caption leading-4 text-ink-soft">{t('loans.sheet.due_none_hint')}</Text>
      )}

      <TextField
        label={t('loans.sheet.note')}
        value={note}
        onChangeText={setNote}
        placeholder={t('loans.sheet.note_placeholder')}
        maxLength={120}
      />

      <View className="mt-2">
        <FormActions
          cancelLabel={t('common.cancel')}
          onCancel={onClose}
          confirmLabel={t('loans.sheet.submit')}
          onConfirm={handleSubmit}
          loading={createPret.isPending}
          disabled={!canSubmit}
        />
      </View>
    </BottomSheetModal>
  );
}
