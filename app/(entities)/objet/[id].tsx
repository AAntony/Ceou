import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from '../../../src/components/Button';
import { ButtonRow } from '../../../src/components/ButtonRow';
import { ErrorState } from '../../../src/components/ErrorState';
import { HeaderIconButton } from '../../../src/components/HeaderIconButton';
import { useSpaceForAppTabBar } from '../../../src/components/AppTabBar';
import { ObjetEditSheet } from '../../../src/features/inventory/ObjetEditSheet';
import { Icon } from '../../../src/components/Icon';
import { PhotoViewerModal } from '../../../src/components/PhotoViewerModal';
import { useSession } from '../../../src/features/auth/SessionProvider';
import { useFactures } from '../../../src/features/factures/FactureBlock';
import { LoanBanner } from '../../../src/features/loans/LoanBanner';
import { LoanSheet } from '../../../src/features/loans/LoanSheet';
import { useClosePret, useObjetPret } from '../../../src/features/loans/queries';
import { LocationBreadcrumb } from '../../../src/features/inventory/LocationBreadcrumb';
import { MoveObjetModal } from '../../../src/features/inventory/MoveObjetModal';
import { useDeleteObjet, useObjet, useObjetHistory, useObjetLocationChain, useSetObjetPhotoFromLocal } from '../../../src/features/inventory/queries';
import { PlanLocationLink } from '../../../src/features/plans/PlanLocationLink';
import { canModify, useHabitationPermission } from '../../../src/features/sharing/queries';
import { confirmDelete } from '../../../src/lib/confirmDelete';
import { useMediaSource } from '../../../src/lib/images/media';
import { pickImage } from '../../../src/lib/images/pickAndUploadImage';
import { useThemeColors } from '../../../src/lib/theme';
import { usePullToRefresh } from '../../../src/components/usePullToRefresh';

export default function ObjetScreen() {
  const refreshControl = usePullToRefresh();
  const colors = useThemeColors();
  // `highlightPlanLink` est posé par le guide de démarrage, qui vient de
  // dessiner le plan et dépose la personne ici : c'est elle qui doit faire le
  // dernier geste du cycle, encore faut-il qu'elle voie où.
  const { id, highlightPlanLink } = useLocalSearchParams<{ id: string; highlightPlanLink?: string }>();
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const { data: objet, isLoading, isError, refetch } = useObjet(id);
  const photo = useMediaSource(objet?.photo_url);
  const { data: history } = useObjetHistory(id);
  const { data: locationChain } = useObjetLocationChain(id);
  const pieceId = locationChain?.find((node) => node.kind === 'piece')?.id;
  const emplacementId = locationChain?.find((node) => node.kind === 'emplacement')?.id;
  const habitationId = locationChain?.find((node) => node.kind === 'habitation')?.id;
  const { data: permission } = useHabitationPermission(habitationId);
  const editable = canModify(permission);
  const bottomSpace = useSpaceForAppTabBar();
  const [editing, setEditing] = useState(false);
  const [fullHistory, setFullHistory] = useState(false);
  const deleteObjet = useDeleteObjet();
  const setObjetPhoto = useSetObjetPhotoFromLocal(id);
  const { pret } = useObjetPret(id);
  const closePret = useClosePret();
  const [loanSheetOpen, setLoanSheetOpen] = useState(false);
  // Le geste, la liste et la feuille : trois morceaux d'une meme
  // fonctionnalite, poses a trois endroits differents de l'ecran.
  const {
    ouvrirAjout: ouvrirAjoutFacture,
    liste: facturesListe,
    feuille: feuilleFacture,
    facturesPerdues,
    dejaUneFacture,
  } = useFactures(id, permission === 'owner', habitationId);


  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);

  const handleChangePhoto = async () => {
    if (!session) return;
    setPhotoUploading(true);
    try {
      const localUri = await pickImage([1, 1]);
      if (localUri) setObjetPhoto.mutate(localUri);
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleDelete = () => {
    // LA SUPPRESSION EN ENTRAINE UNE AUTRE, ET ELLE DOIT LE DIRE. Une preuve
    // d'achat qui ne couvre que cet objet part avec lui (declencheur
    // purge_facture_sans_objet). C'est irreversible et ca ne se devine pas :
    // la boite le nomme, et invite a exporter avant.
    confirmDelete(
      t,
      'inventory.objet.delete_confirm_title',
      facturesPerdues > 0 ? 'inventory.objet.delete_confirm_factures' : 'inventory.objet.delete_confirm_message',
      async () => {
        await deleteObjet.mutateAsync(id);
        router.back();
      },
      { count: facturesPerdues },
    );
  };

  if (isError) {
    return (
      <View className="flex-1 bg-sand">
        <ErrorState onRetry={() => refetch()} />
      </View>
    );
  }

  if (isLoading || !objet) {
    return (
      <View className="flex-1 items-center justify-center bg-sand">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: objet.name,
          // La disquette remplace le « Enregistrer » corail qui coupait la
          // fiche en deux entre les champs et les actions. Elle n'est posee
          // que si la personne a le droit de modifier : sur une habitation
          // partagee en lecture seule, un bouton grise en permanence ne
          // dirait rien de plus que les champs deja non modifiables.
          headerRight: editable
            ? () => <HeaderIconButton icon="pencil" label={t('redesign.edit')} onPress={() => setEditing(true)} />
            : undefined,
        }}
      />
      <ScrollView className="flex-1 bg-sand" contentContainerClassName="px-6 pt-6" contentContainerStyle={{ paddingBottom: bottomSpace + 32 }} refreshControl={refreshControl}>
        <View className="mb-6 self-center">
          <Pressable
            onPress={() => (objet.photo_url ? setPhotoViewerOpen(true) : editable ? handleChangePhoto() : undefined)}
            accessibilityRole="button"
            accessibilityLabel={t(objet.photo_url ? 'a11y.view_photo' : 'a11y.change_photo')}
            className="h-40 w-40 items-center justify-center overflow-hidden rounded-2xl bg-sand-dark"
          >
            {photoUploading ? (
              <ActivityIndicator />
            ) : objet.photo_url ? (
              // Remplit son cadre plutot que d'imposer sa taille : le cadre
              // grandit avec le reglage de taille, l'image le suit.
              <Image source={photo} style={{ width: '100%', height: '100%' }} />
            ) : (
              <Text className="px-2 text-center text-label text-ink-soft">{editable ? t('inventory.objet.add_photo') : ''}</Text>
            )}
          </Pressable>
          {objet.photo_url && editable ? (
            <Pressable
              onPress={handleChangePhoto}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.change_photo')}
              className="absolute -bottom-2 -right-2 h-9 w-9 items-center justify-center rounded-full border border-ink/10 bg-surface"
              style={{ elevation: 3, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } }}
            >
              {photoUploading ? <ActivityIndicator size="small" /> : <Icon name="pencil" size={16} color={colors.ink} />}
            </Pressable>
          ) : null}
        </View>

        {pret ? (
          <LoanBanner
            pret={pret}
            onReturn={() => closePret.mutate(pret.id)}
            returning={closePret.isPending}
            editable={editable}
          />
        ) : null}

        <Text accessibilityRole="header" className="mb-4 text-title font-bold text-ink">{objet.name}</Text>
        <LocationBreadcrumb objetId={id} />
        <PlanLocationLink pieceId={pieceId} emplacementId={emplacementId} emphasis={!!highlightPlanLink} />

        <Text accessibilityRole="header" className="mb-3 text-heading font-bold text-ink">{t('redesign.details')}</Text>
        {objet.description ? <Text className="mb-5 text-body text-ink-soft">{objet.description}</Text> : null}

        {/* LA LISTE DES FACTURES DECRIT L'OBJET — ce qu'il a coute, quand,
            chez qui — donc sa place est avec les informations. Le GESTE
            d'en ajouter une, lui, est une action : il est dans la rangee
            ci-dessous, avec « Deplacer » et « Preter ». */}
        {facturesListe}

        {/* LES DEUX GESTES QU'ON FAIT SUR UN OBJET, cote a cote et sur le
            meme rang. Ils etaient l'un sous l'autre, en `ghost` : deux
            libelles sans fond ni contour, qu'on ne distinguait du texte de la
            fiche qu'en essayant d'appuyer dessus. La pastille d'icone les
            designe comme des ACTIONS, et la rangee dit qu'il s'agit d'un
            choix entre deux, pas d'une liste de reglages. */}
        {editable ? (
          <View className="mb-8">
            <ButtonRow>
              <Button
                variant="tile"
                icon="move"
                label={t('inventory.objet.move')}
                onPress={() => setMoveModalOpen(true)}
              />
              {/* Masqué quand un prêt est déjà en cours : la base refuse un
                  second prêt ouvert sur le même objet, autant ne pas proposer
                  un bouton qui ne peut qu'échouer. La rangée n'en garde pas
                  la place vide — le « Déplacer » restant prend toute la
                  largeur. */}
              {pret ? null : (
                <Button variant="tile" icon="pret" label={t('loans.entry')} onPress={() => setLoanSheetOpen(true)} />
              )}
              {/* TROISIEME TUILE, ET SEULEMENT POUR LE PROPRIETAIRE. Seule sur
                  toute la largeur, elle ecrasait les deux autres ; a leur cote
                  elle a leur taille, et l'espacement de la rangee. Un ami a
                  qui l'habitation est ouverte peut renommer un objet, mais les
                  factures ne lui appartiennent pas. */}
              {/* ELLE DISPARAIT DES QU IL Y EN A UNE : un objet n a qu une
                  preuve d achat, et la facture deja posee se modifie en
                  touchant sa carte au-dessus. */}
              {permission === 'owner' && !dejaUneFacture ? (
                <Button
                  variant="tile"
                  icon="facture"
                  label={t('factures.block.add')}
                  onPress={() => ouvrirAjoutFacture(objet.name, objet.photo_url)}
                />
              ) : null}
            </ButtonRow>
          </View>
        ) : null}

        <Text className="mb-2 text-body font-bold text-ink">{t('inventory.objet.history_title')}</Text>
        {history && history.length > 0 ? (
          (fullHistory ? history : history.slice(0, 3)).map((entry) => (
            <View key={entry.id} className="mb-2 rounded-xl border border-ink/10 px-4 py-3">
              <Text className="text-label text-ink">
                {entry.from_location_label} → {entry.to_location_label}
              </Text>
              <Text className="text-caption text-ink-soft">{new Date(entry.moved_at).toLocaleString(i18n.language)}</Text>
            </View>
          ))
        ) : (
          <Text className="text-label text-ink-soft">{t('inventory.objet.history_empty')}</Text>
        )}

        {history && history.length > 3 ? <Button label={t(fullHistory ? 'redesign.lessHistory' : 'redesign.moreHistory')} variant="ghost" onPress={() => setFullHistory(!fullHistory)} /> : null}
        {editable ? <View className="mt-6"><Button label={t('redesign.edit')} variant="outline" onPress={() => setEditing(true)} /></View> : null}
        {editable ? (
          <View className="mt-10">
            <Button label={t('common.delete')} variant="danger" onPress={handleDelete} />
          </View>
        ) : null}
      </ScrollView>

      <MoveObjetModal visible={moveModalOpen} onClose={() => setMoveModalOpen(false)} objetId={id} />
      <LoanSheet visible={loanSheetOpen} onClose={() => setLoanSheetOpen(false)} objetId={id} objetName={objet.name} />
      <PhotoViewerModal visible={photoViewerOpen} uri={objet.photo_url} onClose={() => setPhotoViewerOpen(false)} />
      {editing && editable ? <ObjetEditSheet key={id} id={id} name={objet.name} description={objet.description} onClose={() => setEditing(false)} /> : null}
      {feuilleFacture}
    </>
  );
}
