import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useSpaceForAppTabBar } from '../src/components/AppTabBar';
import { Button } from '../src/components/Button';
import { EmptyState } from '../src/components/EmptyState';
import { ErrorState } from '../src/components/ErrorState';
import { Icon, type IconName } from '../src/components/Icon';
import { usePullToRefresh } from '../src/components/usePullToRefresh';
import {
  useCorbeille,
  useRestaurer,
  useViderCorbeille,
  type CorbeilleEntree,
  type CorbeilleKind,
} from '../src/features/corbeille/queries';
import { showDialog, showMessage } from '../src/lib/dialog';
import { useMediaSource } from '../src/lib/images/media';
import { useScaled } from '../src/lib/textScale';
import { useThemeColors } from '../src/lib/theme';

// LA CORBEILLE.
//
// Elle répond à un défaut qui n'était pas une fonctionnalité manquante mais un
// problème de CONFIANCE : rien de ce qu'on supprimait n'était rattrapable, et
// les clés étrangères cascadent — une pièce emportait ses rangements, ses
// boîtes et tous les objets dedans. Des mois de saisie en un appui.
//
// ON NE PEUT PAS Y NAVIGUER, seulement remettre en place. Une entrée de
// corbeille n'est pas un écran : c'est une photographie de lignes qui
// n'existent plus. Proposer de « l'ouvrir » mènerait à une fiche vide.
//
// LE SEUL GESTE VRAIMENT DÉFINITIF DE L'APP est ici, et c'est pour ça qu'il
// est écrit ainsi dans sa boîte de confirmation. Partout ailleurs on peut
// revenir en arrière depuis cet écran ; ici, non.

const ICONES: Record<CorbeilleKind, IconName> = {
  habitation: 'maison',
  piece: 'piece',
  emplacement: 'etagere',
  conteneur: 'conteneur',
  objet: 'objet',
  facture: 'facture',
};

export default function CorbeilleScreen() {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const espaceBarre = useSpaceForAppTabBar();

  const { data, isLoading, isError, fetchStatus, refetch } = useCorbeille();
  const refreshControl = usePullToRefresh();
  const restaurer = useRestaurer();
  const vider = useViderCorbeille();

  const entrees = data ?? [];
  // HORS RÉSEAU, LA REQUÊTE RESTE EN PAUSE : ni chargement, ni erreur, ni
  // donnée. Sans ce cas, l'écran annonçait « la corbeille est vide » alors
  // qu'il n'avait simplement pas pu la lire — et une corbeille vide est
  // précisément ce qu'on redoute d'y trouver. Elle vit sur le serveur : c'est
  // le seul écran de l'app qui ne sait rien dire hors ligne, et il doit le
  // dire.
  const injoignable = fetchStatus === 'paused' && data === undefined;

  const demanderAVider = () => {
    showDialog({
      title: t('corbeille.vider_title'),
      message: t('corbeille.vider_message'),
      actions: [
        { label: t('corbeille.vider'), destructive: true, onPress: () => vider.mutate() },
        { label: t('common.cancel'), cancel: true },
      ],
    });
  };

  const remettre = (entree: CorbeilleEntree) => {
    restaurer.mutate(entree.id, {
      onSuccess: (issue) => {
        // LE SERVEUR REFUSE PLUTÔT QUE D'INVENTER : si le rangement qui
        // contenait cette chose a été supprimé lui aussi, il faut le remettre
        // en place d'abord. Un message générique n'aurait rien appris.
        if (issue === 'parent_manquant') {
          showDialog({
            title: t('corbeille.parent_missing_title'),
            message: t('corbeille.parent_missing_message'),
          });
        }
      },
      onError: () => showMessage(t('common.error_generic')),
    });
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('corbeille.title') }} />

      {isLoading ? (
        <View className="flex-1 items-center justify-center bg-sand">
          <ActivityIndicator />
        </View>
      ) : injoignable ? (
        <View className="flex-1 bg-sand">
          <EmptyState icon="alert" title={t('network.offline')} subtitle={t('corbeille.offline_hint')} />
        </View>
      ) : isError ? (
        <View className="flex-1 bg-sand">
          <ErrorState onRetry={() => void refetch()} />
        </View>
      ) : (
        <ScrollView
          className="flex-1 bg-sand"
          refreshControl={refreshControl}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: espaceBarre + 24 }}
        >
          {entrees.length === 0 ? (
            <EmptyState icon="delete" title={t('corbeille.empty')} subtitle={t('corbeille.empty_hint')} />
          ) : (
            <>
              <Text className="mb-4 text-label leading-5 text-ink-soft">{t('corbeille.intro')}</Text>

              {entrees.map((entree) => (
                <Carte
                  key={entree.id}
                  entree={entree}
                  langue={i18n.language}
                  occupe={restaurer.isPending}
                  onRestore={() => remettre(entree)}
                />
              ))}

              {/* LE GESTE DÉFINITIF EN BAS, après tout ce qu'il détruirait :
                  on le rencontre en ayant lu la liste, pas avant. */}
              <View className="mt-4">
                <Button
                  label={t('corbeille.vider')}
                  variant="destructive"
                  loading={vider.isPending}
                  onPress={demanderAVider}
                />
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* Le tourniquet de la remise en place couvre l'écran : l'opération
          touche à tout l'inventaire, et laisser toucher autre chose pendant
          ce temps-là n'aurait pas de sens. */}
      {restaurer.isPending ? (
        <View className="absolute inset-0 items-center justify-center bg-black/20">
          <View className="rounded-2xl bg-surface p-6">
            <ActivityIndicator color={colors.accentDark} />
          </View>
        </View>
      ) : null}
    </>
  );
}

function Carte({
  entree,
  langue,
  occupe,
  onRestore,
}: {
  entree: CorbeilleEntree;
  langue: string;
  occupe: boolean;
  onRestore: () => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  const contenu = contenuDe(t, entree);
  const date = new Date(entree.deleted_at).toLocaleDateString(langue);

  return (
    <View className="mb-3 rounded-2xl border border-ink/10 bg-surface p-3">
      <View className="flex-row items-center gap-3">
        <Vignette photoUrl={entree.photo_url} kind={entree.kind} />
        <View className="flex-1">
          <Text className="text-body font-semibold text-ink">{entree.label || t('corbeille.untitled')}</Text>
          <Text className="text-caption text-ink-soft">
            {t(`corbeille.kinds.${entree.kind}`)} · {t('corbeille.deleted_on', { date })}
          </Text>
        </View>
      </View>

      {/* CE QUI EST PARTI AVEC, et c'est l'information qui compte : personne ne
          se souvient qu'une pièce contenait vingt-quatre objets. */}
      {contenu ? (
        <View className="mt-2 flex-row items-center gap-2">
          <Icon name="included" size={14} color={colors.inkFaint} />
          <Text className="flex-1 text-caption text-ink-soft">{t('corbeille.with_contents', { contents: contenu })}</Text>
        </View>
      ) : null}

      <View className="mt-3">
        <Button label={t('corbeille.restore')} variant="outline" disabled={occupe} onPress={onRestore} />
      </View>
    </View>
  );
}

/**
 * LA PHOTO PLUTÔT QUE L'ICÔNE DU TYPE.
 *
 * L'icône disait « Objet », la même pour les quarante objets d'une cave — or
 * savoir LEQUEL est exactement ce qu'on vient chercher ici. Signalé à l'usage
 * dès le premier essai.
 *
 * CARRÉ ARRONDI DANS LES DEUX CAS, photo ou repli : c'est ce qui garde la
 * liste régulière. Une vignette ronde à côté d'une carrée ferait sauter
 * l'alignement d'une rangée à l'autre.
 *
 * ET L'IMAGE PEUT ÉCHOUER SANS CASSER : le fichier d'une suppression faite
 * chez quelqu'un d'autre est rangé sous le préfixe du propriétaire, illisible
 * une fois la ligne partie (voir la migration). `onError` retombe alors sur
 * l'icône, au lieu d'un cadre vide.
 */
function Vignette({ photoUrl, kind }: { photoUrl: string | null; kind: CorbeilleKind }) {
  const colors = useThemeColors();
  const [echec, setEchec] = useState(false);
  const source = useMediaSource(echec ? null : photoUrl);
  const taille = useScaled(44);

  return (
    <View
      style={{ width: taille, height: taille }}
      className="items-center justify-center overflow-hidden rounded-xl border border-ink/10 bg-sand-dark"
    >
      {source ? (
        <Image
          source={source}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          onError={() => setEchec(true)}
        />
      ) : (
        <Icon name={ICONES[kind]} size={20} color={colors.accentDark} />
      )}
    </View>
  );
}

/**
 * « 3 rangements, 24 objets » — ce qui partait avec la chose supprimée.
 *
 * LA CHOSE ELLE-MÊME EST RETIRÉE DE SON PROPRE DÉCOMPTE : le serveur compte
 * la pièce supprimée parmi les pièces, et « 1 pièce, 3 rangements » à côté
 * d'une carte qui dit déjà « Pièce » se lirait comme une pièce de plus.
 */
function contenuDe(t: TFunction, entree: CorbeilleEntree): string {
  const familles: { cle: keyof CorbeilleEntree['resume']; kind: CorbeilleKind }[] = [
    { cle: 'pieces', kind: 'piece' },
    { cle: 'emplacements', kind: 'emplacement' },
    { cle: 'conteneurs', kind: 'conteneur' },
    { cle: 'objets', kind: 'objet' },
    { cle: 'factures', kind: 'facture' },
  ];

  return familles
    .map(({ cle, kind }) => {
      const brut = entree.resume[cle] ?? 0;
      const compte = entree.kind === kind ? brut - 1 : brut;
      return compte > 0 ? t(`corbeille.count.${cle}`, { count: compte }) : null;
    })
    .filter((morceau): morceau is string => morceau !== null)
    .join(', ');
}
