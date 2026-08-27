import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { Button } from '../../components/Button';
import type { PretEntry } from './queries';
import { isOverdue } from './queries';

type LoanBannerProps = {
  pret: PretEntry;
  onReturn: () => void;
  returning: boolean;
  editable: boolean;
};

// Le bandeau posé en tête de la fiche d'un objet prêté ou emprunté.
//
// Il n'est rendu que lorsqu'un prêt est EN COURS : une fiche d'objet normale
// n'en parle pas du tout. C'est ce qui permet de le poser tout en haut sans
// alourdir les 99 % de fiches qui ne concernent personne d'autre.
//
// Le retard se voit à la couleur avant de se lire : moutarde pour un prêt
// vivant, rouge pour une échéance passée. La date reste écrite dans les deux
// cas — « en retard » sans dire depuis quand n'aide pas à décider si on
// relance.
export function LoanBanner({ pret, onReturn, returning, editable }: LoanBannerProps) {
  const { t, i18n } = useTranslation();
  const overdue = isOverdue(pret);
  const date = pret.dueAt ? new Date(pret.dueAt).toLocaleDateString(i18n.language) : '';

  return (
    <View
      className={`mb-4 rounded-2xl border px-4 py-3 ${
        overdue ? 'border-red-500/40 bg-red-500/10' : 'border-mustard/60 bg-mustard-light'
      }`}
    >
      <Text className="text-label font-semibold text-ink">
        {pret.direction === 'pret'
          ? t('loans.banner.lent_to', { name: pret.counterpartLabel })
          : t('loans.banner.borrowed_from', { name: pret.counterpartLabel })}
      </Text>

      <Text className={`mt-0.5 text-caption ${overdue ? 'font-semibold text-danger' : 'text-ink-soft'}`}>
        {pret.dueAt === null
          ? t('loans.banner.no_due')
          : overdue
            ? t('loans.banner.overdue', { date })
            : t('loans.banner.due_on', { date })}
      </Text>

      {pret.note ? <Text className="mt-1 text-caption italic text-ink-soft">{pret.note}</Text> : null}

      {editable ? (
        <View className="mt-3">
          <Button
            label={pret.direction === 'pret' ? t('loans.banner.mark_returned') : t('loans.banner.mark_given_back')}
            variant="outline"
            onPress={onReturn}
            loading={returning}
          />
        </View>
      ) : null}
    </View>
  );
}
