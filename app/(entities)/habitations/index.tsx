import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { CreateEntityModal } from '../../../src/components/CreateEntityModal';
import { MovingEntry } from '../../../src/features/moving/MovingEntry';
import { EmptyState } from '../../../src/components/EmptyState';
import { EntityPhotoField } from '../../../src/components/EntityPhotoField';
import { EntityRow } from '../../../src/components/EntityRow';
import { ErrorState } from '../../../src/components/ErrorState';
import { SectionHeader } from '../../../src/components/SectionHeader';
import { HeaderAddButton } from '../../../src/components/HeaderAddButton';
import { SegmentedTabs } from '../../../src/components/SegmentedTabs';
import { usePullToRefresh } from '../../../src/components/usePullToRefresh';
import { PresetPicker } from '../../../src/components/PresetPicker';
import { GuestAccessLostCard, useGuestAccessLost } from '../../../src/features/auth/GuestBanner';
import { useIsAnonymous, useSession } from '../../../src/features/auth/SessionProvider';
import { useIsOffline } from '../../../src/lib/network';
import { HABITATION_TYPES, getHabitationIcon, type HabitationTypeKey } from '../../../src/features/inventory/constants';
import { objetCountLabel } from '../../../src/features/inventory/counts';
import { photoChange } from '../../../src/features/inventory/entityPhoto';
import {
  useCreateHabitation,
  useDeleteHabitation,
  useHabitationFavorites,
  useHabitationObjectCounts,
  useHabitations,
  useToggleHabitationFavorite,
  useUpdateHabitation,
} from '../../../src/features/inventory/queries';
import { useFriendships } from '../../../src/features/sharing/queries';
import { confirmDelete } from '../../../src/lib/confirmDelete';
import type { Habitation } from '../../../src/types/database';

type Tab = 'personal' | 'shared';

export default function HabitationsScreen() {
  const refreshControl = usePullToRefresh();
  const { t } = useTranslation();
  const { session } = useSession();
  const { data: habitations, isLoading, isError, refetch } = useHabitations();
  const { data: favorites } = useHabitationFavorites();
  const toggleFavorite = useToggleHabitationFavorite();
  const { data: friendships } = useFriendships();
  const createHabitation = useCreateHabitation();
  const updateHabitation = useUpdateHabitation();
  const deleteHabitation = useDeleteHabitation();
  const isGuest = useIsAnonymous();
  const { lost: guestAccessLost } = useGuestAccessLost();
  const [tab, setTab] = useState<Tab>('personal');
  const offline = useIsOffline();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHabitation, setEditingHabitation] = useState<Habitation | null>(null);
  const [type, setType] = useState<HabitationTypeKey>('maison');
  const [name, setName] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const { data: objetCounts } = useHabitationObjectCounts();

  const favoriteIds = new Set((favorites ?? []).map((f) => f.habitation_id));
  // Ciblé sur l'Habitation réellement en cours de bascule (et pas sur
  // `isPending` seul) : une seule étoile se verrouille, pas toute la grille.
  const isFavoritePending = (habitationId: string) =>
    toggleFavorite.isPending && toggleFavorite.variables?.habitationId === habitationId;
  const myHabitations = (habitations ?? []).filter((h) => h.user_id === session?.user.id);
  // Un visiteur ne possede aucune habitation : tout ce que la RLS lui renvoie
  // est, par construction, ce qui lui a ete partage via son code.
  const guestHabitations = habitations ?? [];
  const acceptedFriends = (friendships ?? [])
    .filter((f) => f.status === 'accepted')
    .sort((a, b) => (a.otherDisplayName || a.otherFriendCode).localeCompare(b.otherDisplayName || b.otherFriendCode));

  // L'onglet "Partagees" liste des HABITATIONS, plus des amis.
  //
  // POURQUOI CE CHANGEMENT : il listait les amis acceptes, et on n'atteignait
  // leurs habitations qu'en tapant sur chaque ami. Un acces obtenu par CODE
  // D'INVITATION ne cree aucune amitie -- l'onglet restait donc
  // desesperement vide pour quelqu'un entre par un code, alors meme que la
  // RLS lui donnait bien acces a l'habitation (defaut remonte en test reel :
  // les objets etaient visibles depuis l'accueil, mais l'habitation
  // introuvable ici).
  //
  // Lister les habitations directement traite les DEUX chemins de la meme
  // facon, et supprime au passage un niveau de navigation.
  const friendNameByOwner = new Map(
    acceptedFriends.map((f) => [f.otherUserId, f.otherDisplayName || f.otherFriendCode] as const),
  );
  const sharedHabitations = (habitations ?? [])
    .filter((h) => h.user_id !== session?.user.id)
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleDelete = (id: string) => {
    confirmDelete(t, 'inventory.habitations.delete_confirm_title', 'inventory.habitations.delete_confirm_message', () =>
      deleteHabitation.mutate(id),
    );
  };

  const openCreate = () => {
    setEditingHabitation(null);
    setType('maison');
    setPhotoUri(null);
    setName(t('inventory.habitationTypes.maison'));
    setModalOpen(true);
  };

  const openEdit = (habitation: Habitation) => {
    setEditingHabitation(habitation);
    setType(habitation.type as HabitationTypeKey);
    setPhotoUri(habitation.photo_url);
    setName(habitation.name);
    setModalOpen(true);
  };

  // Le préremplissage nom <- catégorie n'a lieu qu'à la création : en
  // édition, écraser un nom déjà personnalisé au moindre changement de
  // catégorie serait une perte de donnée, pas un raccourci.
  const handleSelectType = (key: HabitationTypeKey) => {
    setType(key);
    if (!editingHabitation) setName(t(`inventory.habitationTypes.${key}`));
  };

  const rowSubtitle = (lead: string, habitationId: string) =>
    [lead, objetCountLabel(t, objetCounts, habitationId)].filter(Boolean).join(' · ');

  const isPersonalEmpty = !isLoading && myHabitations.length === 0;

  // L'ÉCHEC NE MASQUE PAS CE QU'ON A DÉJÀ. Une lecture ratée sur une liste
  // qu'on connaît déjà — parce qu'elle vient du cache disque, ou du
  // préchargement de l'inventaire — n'est pas une raison de remplacer cette
  // liste par un écran d'erreur. C'était le défaut signalé à l'usage :
  // « cliquer sur Habitations fait une erreur » sans réseau, alors que les
  // habitations étaient là.
  //
  // On ne montre donc l'erreur que quand il n'y a VRAIMENT rien à montrer.
  // L'ordre vis-à-vis de l'état vide, lui, ne change pas : sans données du
  // tout, mieux vaut « ça n'a pas pu être lu » que « aucune habitation ».
  const showError = isError && !habitations;

  // PERDRE LE RÉSEAU EN ÉTANT SUR « PARTAGÉES » NE DOIT PAS PIÉGER. L'onglet
  // devient inerte : sans ce repli, on resterait devant une liste vide sur une
  // pastille qui ne répond plus. Calculé au rendu plutôt que corrigé par un
  // effet — le choix d'origine est ainsi retrouvé tel quel au retour du
  // réseau, sans qu'on ait eu à le réécrire.
  const effectiveTab: Tab = offline && tab === 'shared' ? 'personal' : tab;

  return (
    <>
      {/* Atteint uniquement via le bouton "Habitations" de la barre du bas,
          jamais poussé depuis un autre écran de cette pile — la flèche de
          retour native n'a donc aucune destination pertinente ("précédent"
          n'existe pas dans ce modèle de navigation, seuls Céoù/Profil le
          sont, déjà dans la barre du bas). */}
      <Stack.Screen
        options={{
          title: t('redesign.places'),
          headerBackVisible: false,
          // Seul l'onglet Personnelles peut recevoir une creation : l'onglet
          // Partagees liste des amis, pas des habitations a soi.
          header: () => <SectionHeader title={t('redesign.places')} action={
            effectiveTab === 'personal' && !isGuest ? (
              <HeaderAddButton onPress={openCreate} label={t('inventory.habitations.add')} />
            ) : null} />,
        }}
      />
      <View className="flex-1 bg-sand">
        <ScrollView contentContainerClassName="px-6 pb-28 pt-4" refreshControl={refreshControl}>
          {/* Un visiteur ne voit ni onglets ni creation : les deux onglets lui
              seraient vides par construction (il ne possede rien et n’a aucun
              ami). Il voit directement ce a quoi son code lui donne acces. */}
          {isGuest ? (
            showError ? (
              <ErrorState onRetry={() => refetch()} />
            ) : guestAccessLost ? (
              // Avant l'etat vide : "rien ne t'a ete partage" est faux quand
              // quelque chose l'avait ete et vient de s'eteindre.
              <GuestAccessLostCard />
            ) : guestHabitations.length === 0 ? (
              <EmptyState icon="home" title={t('guest.no_habitation')} />
            ) : (
              // Les plans ne sont plus remontes ici : l'ecran d'une
              // Habitation a son propre onglet Plans, les afficher aussi a ce
              // niveau donnait deux chemins vers la meme chose.
              guestHabitations.map((habitation) => (
                <EntityRow
                  key={habitation.id}
                  level="habitation"
                  icon={getHabitationIcon(habitation.type)}
                  title={habitation.name}
                  subtitle={t(`inventory.habitationTypes.${habitation.type}`)}
                  photoUri={habitation.photo_url}
                  onPress={() => router.push(`/habitation/${habitation.id}`)}
                />
              ))
            )
          ) : (
            <>
          {/* « Partagées » est GRISÉE hors connexion. Le préchargement ne
              descend que dans SES habitations : celles d'un ami ne sont pas
              sur l'appareil, l'onglet n'aurait rien à montrer et afficherait
              un vide indiscernable d'un « personne ne partage rien avec toi ».
              Grisée, elle dit qu'elle reviendra avec le réseau. */}
          <SegmentedTabs
            options={[
              { value: 'personal', label: t('inventory.habitations.tab_personal') },
              { value: 'shared', label: t('inventory.habitations.tab_shared'), disabled: offline },
            ]}
            value={effectiveTab}
            onChange={setTab}
          />

          {effectiveTab === 'personal' ? (
            // L'échec passe AVANT l'état vide : sans lui, une lecture ratée
            // affichait "Aucune habitation", ce qui laisse croire à une perte
            // de données alors que rien n'a été lu.
            showError ? (
              <ErrorState onRetry={() => refetch()} />
            ) : isPersonalEmpty ? (
              <EmptyState icon="home" title={t('inventory.habitations.empty')} />
            ) : (
              myHabitations.map((habitation) => (
                <EntityRow
                  key={habitation.id}
                  level="habitation"
                  icon={getHabitationIcon(habitation.type)}
                  title={habitation.name}
                  subtitle={rowSubtitle(t(`inventory.habitationTypes.${habitation.type}`), habitation.id)}
                  photoUri={habitation.photo_url}
                  onPress={() => router.push(`/habitation/${habitation.id}`)}
                  onEdit={() => openEdit(habitation)}
                  isFavorite={favoriteIds.has(habitation.id)}
                  onToggleFavorite={() => toggleFavorite.mutate({ habitationId: habitation.id, isFavorite: favoriteIds.has(habitation.id) })}
                  favoriteDisabled={isFavoritePending(habitation.id)}
                />
              ))
            )
          ) : showError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : sharedHabitations.length === 0 ? (
            <EmptyState icon="home" title={t('inventory.habitations.shared_empty')} />
          ) : (
            sharedHabitations.map((habitation) => (
                <EntityRow
                  key={habitation.id}
                  level="habitation"
                  icon={getHabitationIcon(habitation.type)}
                  title={habitation.name}
                  photoUri={habitation.photo_url}
                  // Le nom de l'hote quand c'est un ami (on l'a deja en
                  // memoire), sinon le fait que l'acces vienne d'un code : la
                  // profil d'un hote inconnu n'est pas lisible par la RLS, on
                  // n'invente donc pas un nom qu'on ne peut pas obtenir.
                  subtitle={rowSubtitle(
                    friendNameByOwner.get(habitation.user_id) ?? t('inventory.habitations.shared_via_invite'),
                    habitation.id,
                  )}
                  onPress={() => router.push(`/habitation/${habitation.id}`)}
                  isFavorite={favoriteIds.has(habitation.id)}
                  onToggleFavorite={() =>
                    toggleFavorite.mutate({ habitationId: habitation.id, isFavorite: favoriteIds.has(habitation.id) })
                  }
                  favoriteDisabled={isFavoritePending(habitation.id)}
                />
            ))
          )}
            </>
          )}
          {!isGuest ? <MovingEntry /> : null}
        </ScrollView>

        <CreateEntityModal
          visible={modalOpen}
          title={editingHabitation ? t('inventory.habitations.edit_title') : t('inventory.habitations.create_title')}
          nameLabel={t('inventory.habitations.name_label')}
          submitLabel={t('common.save')}
          cancelLabel={t('common.cancel')}
          name={name}
          onNameChange={setName}
          loading={createHabitation.isPending || updateHabitation.isPending}
          onClose={() => setModalOpen(false)}
          onDelete={editingHabitation ? () => handleDelete(editingHabitation.id) : undefined}
          // UNE SEULE ÉCRITURE, PHOTO COMPRISE. C'était deux temps — créer la
          // ligne, puis téléverser et réécrire — parce que le fichier est
          // nommé d'après l'identifiant. Il n'y a plus de raison d'attendre :
          // l'identifiant est tiré localement, et l'envoi du fichier voyage
          // dans le même lot que la ligne (voir entityPhotoWrite).
          onSubmit={async (submittedName) => {
            const definition = HABITATION_TYPES.find((h) => h.key === type)!;
            if (editingHabitation) {
              await updateHabitation.mutateAsync({
                id: editingHabitation.id,
                name: submittedName,
                type,
                icon: definition.icon,
                photoUrl: photoChange(photoUri, editingHabitation.photo_url),
              });
            } else {
              await createHabitation.mutateAsync({
                name: submittedName,
                type,
                icon: definition.icon,
                photoUrl: photoChange(photoUri, null),
              });
            }
            setModalOpen(false);
          }}
        >
          <PresetPicker
            presets={HABITATION_TYPES}
            selectedKey={type}
            onSelect={(key) => handleSelectType(key as HabitationTypeKey)}
            labelFor={(key) => t(`inventory.habitationTypes.${key}`)}
          />
          <EntityPhotoField level="habitation" photoUri={photoUri} onChange={setPhotoUri} />
        </CreateEntityModal>
      </View>
    </>
  );
}
