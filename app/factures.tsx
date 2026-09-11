import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSpaceForAppTabBar } from '../src/components/AppTabBar';
import { EmptyState } from '../src/components/EmptyState';
import { ErrorState } from '../src/components/ErrorState';
import { HeaderIconButton } from '../src/components/HeaderIconButton';
import { Icon } from '../src/components/Icon';
import { SegmentedTabs } from '../src/components/SegmentedTabs';
import { usePullToRefresh } from '../src/components/usePullToRefresh';
import { dateOrderFor, fromIsoDate } from '../src/features/factures/dateField';
import { ExportProgress } from '../src/features/factures/ExportProgress';
import { FactureFormSheet } from '../src/features/factures/FactureFormSheet';
import { ObjetsSansFactureList } from '../src/features/factures/ObjetsSansFactureList';
import { useFacturesForHabitation, useObjetsSansFacture, useUpdateFacture } from '../src/features/factures/queries';
import { useExportFactures } from '../src/features/factures/useExportFactures';
import { useFeuilleFacture } from '../src/features/factures/useFeuilleFacture';
import { syncWarrantyReminders } from '../src/features/notifications/warrantyReminders';
import { useHabitationPermission } from '../src/features/sharing/queries';
import { useMediaSource } from '../src/lib/images/media';
import { useScaled } from '../src/lib/textScale';
import { useThemeColors } from '../src/lib/theme';

// LE DOSSIER D'UN LOGEMENT : tout ce qui y est prouvé, et tout ce qui ne
// l'est pas.
//
// C'est l'écran qu'on ouvre après un cambriolage, un incendie ou un dégât des
// eaux — donc pressé, et dans un mauvais jour. Trois choix en découlent :
//
//  - LE TOTAL EN PREMIER, parce que c'est le chiffre demandé d'abord et que
//    personne n'a envie de le calculer à la main ce jour-là.
//  - TOUTES LES CARTES ONT LA MÊME HAUTEUR. Elle ne vient pas d'un nombre de
//    pixels — qui se romprait au premier agrandissement du texte — mais du
//    fait que chaque carte rend TOUJOURS le même nombre de lignes, remplies
//    ou non. Une liste dont les cartes sautent selon ce qui est renseigné se
//    parcourt mal et se compare encore plus mal.
//  - LES MONTANTS S'ALIGNENT, en chiffres à chasse fixe. C'est ce qui permet
//    de lire une colonne de sommes plutôt qu'une suite de nombres.
//
// ═══ POURQUOI DEUX ONGLETS ═══
//
// Une liste de factures ne dit QUE ce qu'on a pensé à y mettre : elle paraît
// toujours complète, puisqu'elle ne montre que ses propres lignes. Le trou —
// les objets sans aucune preuve — ne se découvrait donc que le jour du
// sinistre. Le second onglet le rend visible, et surtout traitable : chaque
// rangée s'y règle sur place, sans quitter l'écran.
//
// L'ONGLET « AVEC FACTURE » LISTE DES FACTURES, PAS DES OBJETS, et c'est
// délibéré : une facture couvre souvent plusieurs objets (une livraison de
// meubles, une commande en ligne). La lister par objet afficherait le même
// ticket trois fois et compterait trois fois son montant dans le total. Chaque
// carte nomme déjà les objets qu'elle couvre. L'autre onglet, lui, est bien
// une liste d'objets : il n'y a rien d'autre à y montrer.

type Tab = 'avec' | 'sans';

type FactureEntry = NonNullable<ReturnType<typeof useFacturesForHabitation>['data']>[number];

export default function FacturesScreen() {
  const { t, i18n } = useTranslation();
  const { habitationId } = useLocalSearchParams<{ habitationId: string }>();
  const { data: permission } = useHabitationPermission(habitationId);
  // LES FACTURES SONT PRIVÉES À LEUR PROPRIÉTAIRE, et c'est ce qui interdit
  // le second onglet à quiconque d'autre : les liaisons facture/objet lui
  // étant invisibles (RLS), TOUT l'inventaire lui ressortirait « sans
  // facture ». Un écran qui ment vaut moins qu'un écran qui manque.
  const isOwner = permission === 'owner';

  const [tab, setTab] = useState<Tab>('avec');
  const refreshControl = usePullToRefresh();
  const espaceBarre = useSpaceForAppTabBar();

  // TOUCHER UNE CARTE OUVRE LA MÊME FEUILLE QUE SUR LA FICHE D'UN OBJET.
  //
  // Elle n'ouvrait que la visionneuse : on voyait le document, sans pouvoir
  // corriger le montant ou la date qu'on venait justement d'y relire. Or
  // c'est précisément en regardant une facture qu'on s'aperçoit qu'elle est
  // mal saisie. La visionneuse n'est pas perdue pour autant — l'aperçu de la
  // feuille l'ouvre en plein écran.
  const modifier = useUpdateFacture();
  const [enEdition, setEnEdition] = useState<FactureEntry | null>(null);
  const feuille = useFeuilleFacture();
  const { demander, travail } = useExportFactures();

  const dossier = useFacturesForHabitation(habitationId);
  const orphelins = useObjetsSansFacture(isOwner ? habitationId : undefined);

  // LE MÊME ORDRE QUE CELUI DU SERVEUR, retenu ici aussi. Une facture ajoutée
  // hors ligne est posée en fin de liste par la mise à jour optimiste : sans
  // ce tri, elle apparaîtrait tout en bas du dossier au lieu de sa place
  // chronologique, et on la croirait mal enregistrée.
  const factures = useMemo(
    () => [...(dossier.data ?? [])].sort((a, b) => cleDeTri(b).localeCompare(cleDeTri(a))),
    [dossier.data],
  );
  const objets = orphelins.data ?? [];

  const courant = tab === 'avec' ? dossier : orphelins;
  // ON ATTEND LES DEUX, PAS SEULEMENT L'ONGLET REGARDÉ. Les deux listes se
  // répondent : les compteurs des pastilles s'afficheraient l'un après
  // l'autre, et surtout l'onglet « Sans facture » vide doit savoir si le
  // dossier est vide lui aussi pour choisir ce qu'il annonce. Elles partent
  // ensemble, donc l'attente ne coûte rien.
  const chargement = dossier.isLoading || orphelins.isLoading;
  const chiffrees = factures.filter((f) => f.amount != null);
  const total = chiffrees.reduce((somme, f) => somme + Number(f.amount), 0);

  // REMET LES RAPPELS DE GARANTIE EN PHASE AVEC LA REALITE. Ils sont
  // programmes sur l'appareil : une date corrigee ailleurs, une facture
  // supprimee depuis un autre telephone, ou l'app reinstallee — et ce qui
  // etait pose ne correspond plus. Repartir de la liste evite d'avoir a
  // traiter chacun de ces cas. Meme montage que l'ecran des prets.
  useEffect(() => {
    if (!dossier.data || !isOwner) return;
    void syncWarrantyReminders(
      dossier.data.map((facture) => ({
        id: facture.id,
        objets: facture.objet_names,
        warrantyUntil: facture.warranty_until,
        habitationId,
      })),
      t,
      i18n.language,
    );
  }, [dossier.data, isOwner, habitationId, t, i18n.language]);

  const exporterCelleCi = (facture: FactureEntry) => {
    feuille.fermer();
    demander([
      {
        id: facture.id,
        vendor: facture.vendor,
        amount: facture.amount,
        purchaseDate: facture.purchase_date,
        warrantyUntil: facture.warranty_until,
        documentUrl: facture.document_url,
        documentKind: facture.document_kind,
        objets: facture.objet_names,
      },
    ]);
  };

  return (
    <>
      {/* `headerShown` EXPLICITE : le Stack racine les masque par défaut, et
          une destination de premier rang sans en-tête n'a plus ni titre ni
          retour. Même réabonnement que l'écran des prêts. */}
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('factures.list.title'),
          // L'EXPORT PART D'ICI, ET SEULEMENT QUAND IL Y A QUELQUE CHOSE À
          // EXPORTER. C'est l'écran où l'on relit son dossier : c'est là que
          // vient l'idée de l'envoyer. L'arbre s'ouvrira déjà coché sur ce
          // logement, sans cesser de montrer les autres.
          headerRight: () =>
            isOwner && factures.length > 0 ? (
              <HeaderIconButton
                icon="export"
                label={t('factures.export.entry')}
                onPress={() => router.push({ pathname: '/export-factures', params: { habitationId } })}
              />
            ) : null,
        }}
      />

      <View className="flex-1 bg-sand">
        {isOwner ? (
          <View className="px-6 pt-4">
            {/* LES COMPTEURS SONT DANS LES PASTILLES, et ce sont eux qui font
                le travail : « Sans facture (34) » est l'information qu'on
                vient chercher, elle ne devrait pas demander d'ouvrir
                l'onglet. Ils n'apparaissent qu'une fois la liste chargée —
                un « (0) » transitoire dirait le contraire de la vérité. */}
            <SegmentedTabs
              options={[
                { value: 'avec', label: avecCompteur(t('factures.list.tab_with'), dossier.data?.length) },
                { value: 'sans', label: avecCompteur(t('factures.list.tab_without'), orphelins.data?.length) },
              ]}
              value={tab}
              onChange={setTab}
            />
          </View>
        ) : null}

        {chargement ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : courant.isError ? (
          <ErrorState onRetry={() => courant.refetch()} />
        ) : tab === 'avec' ? (
          factures.length === 0 ? (
            <EmptyState icon="facture" title={t('factures.list.empty_title')} subtitle={t('factures.list.empty_hint')} />
          ) : (
            <ScrollView
              className="flex-1"
              contentContainerClassName="px-6 pt-1"
              // LA BARRE D'ONGLETS EST RENDUE PAR-DESSUS TOUT L'ÉCRAN (voir
              // app/_layout.tsx) : sans cette réserve, la dernière carte se
              // termine dessous. Calculée et non écrite en dur — la barre
              // grandit avec le réglage de taille du texte.
              contentContainerStyle={{ paddingBottom: espaceBarre + 16 }}
              refreshControl={refreshControl}
            >
              <Text className="mb-4 text-label leading-5 text-ink-soft">{t('factures.list.intro')}</Text>

              <TotalCard total={total} chiffrees={chiffrees.length} sur={factures.length} langue={i18n.language} />

              {factures.map((facture) => (
                <FactureCard
                  key={facture.id}
                  facture={facture}
                  onOpen={() => {
                    setEnEdition(facture);
                    feuille.ouvrir();
                  }}
                />
              ))}
            </ScrollView>
          )
        ) : objets.length === 0 ? (
          // DEUX VIDES DIFFÉRENTS, ET ILS NE DISENT PAS LA MÊME CHOSE. Aucun
          // objet découvert alors qu'aucune facture n'existe non plus : le
          // logement est vide, il n'y a rien à prouver. Aucun objet découvert
          // alors que des factures existent : tout est couvert, et c'est une
          // bonne nouvelle qu'il faut annoncer comme telle.
          factures.length === 0 ? (
            <EmptyState title={t('factures.list.no_objet_title')} subtitle={t('factures.list.no_objet_hint')} />
          ) : (
            <EmptyState
              icon="validate"
              title={t('factures.list.without_empty_title')}
              subtitle={t('factures.list.without_empty_hint')}
            />
          )
        ) : (
          // ELLE PORTE SON PROPRE DÉFILEMENT, et c'est la seule des deux :
          // cette liste-ci n'est bornée par rien — elle contient tous les
          // objets du logement — donc elle est virtualisée. Le dossier, lui,
          // compte autant de lignes qu'on a photographié de tickets, c'est-à-
          // dire quelques dizaines au plus : un ScrollView y suffit.
          <ObjetsSansFactureList habitationId={habitationId} objets={objets} refreshControl={refreshControl} />
        )}
      </View>

      {/* SEULEMENT POUR LE PROPRIÉTAIRE : lui seul a une facture à modifier,
          et lui seul en voit. */}
      {isOwner ? (
        <FactureFormSheet
          key={feuille.cle}
          visible={feuille.visible}
          facture={enEdition ?? undefined}
          // LA FEUILLE SE FERME AVANT L'EXPORT, et ce n'est pas de la
          // cosmétique : la feuille de partage et le brouillon de mail sont
          // des vues du système, et sur iOS en présenter une par-dessus une
          // modale ouverte ne fait rien du tout, en silence.
          onExport={enEdition ? () => exporterCelleCi(enEdition) : undefined}
          onClose={feuille.fermer}
          onSubmit={(valeurs) => {
            if (enEdition) {
              modifier.mutate({
                id: enEdition.id,
                vendor: valeurs.vendor,
                amount: valeurs.amount,
                purchaseDate: valeurs.purchaseDate,
                warrantyUntil: valeurs.warrantyUntil,
                document: valeurs.document,
                // Ces deux-là ne partent pas en base : ils servent à replacer
                // le rappel de garantie.
                objets: enEdition.objet_names,
                habitationId,
              });
            }
            feuille.fermer();
          }}
          loading={modifier.isPending}
        />
      ) : null}

      <ExportProgress travail={travail} />
    </>
  );
}

/** Ce sur quoi le serveur trie le dossier : la date d'achat, à défaut celle de saisie. */
function cleDeTri(facture: FactureEntry): string {
  return facture.purchase_date ?? facture.created_at.slice(0, 10);
}

/** « Sans facture (34) », ou le seul libellé tant que le compte est inconnu. */
function avecCompteur(libelle: string, compte: number | undefined): string {
  return compte === undefined ? libelle : `${libelle} (${compte})`;
}

/**
 * Ce que le dossier vaut, annoncé d'entrée.
 *
 * IL DIT SUR QUOI IL PORTE, et ce n'est pas un scrupule inutile : le montant
 * étant facultatif, un total muet laisserait croire qu'il couvre tout le
 * logement alors qu'il ignore les factures sans montant. Quelqu'un qui
 * recopie ce chiffre dans une déclaration doit savoir ce qu'il recopie.
 */
function TotalCard({
  total,
  chiffrees,
  sur,
  langue,
}: {
  total: number;
  chiffrees: number;
  sur: number;
  langue: string;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  if (chiffrees === 0) return null;

  return (
    <View className="mb-5 rounded-2xl bg-coral-light p-4">
      <View className="flex-row items-center gap-2">
        <Icon name="facture" size={16} color={colors.accentDark} />
        <Text className="text-caption font-semibold uppercase tracking-wider text-coral-dark">
          {t('factures.list.total_label')}
        </Text>
      </View>
      <Text
        className="mt-1 text-display font-bold text-ink"
        style={{ fontVariant: ['tabular-nums'] }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {formatMontant(total, langue)}
      </Text>
      <Text className="text-caption text-ink-soft">{t('factures.list.total_on', { count: chiffrees, sur })}</Text>
    </View>
  );
}

function FactureCard({ facture, onOpen }: { facture: FactureEntry; onOpen: () => void }) {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const document = useMediaSource(facture.document_url);
  const order = dateOrderFor(i18n.language);

  // La vignette est dessinée en pixels et suit donc le réglage de taille :
  // sinon elle deviendrait un timbre à côté d'un texte doublé.
  const largeur = useScaled(52);
  const hauteur = useScaled(68);

  const date = fromIsoDate(facture.purchase_date, order);
  const titre = facture.vendor || date || t('factures.block.untitled');
  const garantieFinie = facture.warranty_until ? new Date(facture.warranty_until) < new Date() : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('factures.list.open_document', { name: titre })}
      onPress={onOpen}
      className="mb-3 flex-row gap-3 rounded-2xl border border-ink/10 bg-surface p-3 active:opacity-70"
    >
      {/* PROPORTION D'UN TICKET, plus haute que large : c'est ce qui la fait
          reconnaître comme un document et non comme la photo d'un objet. */}
      <View
        style={{ width: largeur, height: hauteur }}
        className="overflow-hidden rounded-lg border border-ink/10 bg-sand-dark"
      >
        {document ? (
          <Image source={document} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Icon name="facture" size={18} color={colors.inkFaint} />
          </View>
        )}
      </View>

      {/* TROIS LIGNES, TOUJOURS. C'est ce qui donne à toutes les cartes la
          même hauteur sans figer un nombre de pixels — donc une liste qui
          reste régulière même à 200 % de texte. */}
      <View className="flex-1 justify-center">
        <View className="flex-row items-center gap-2">
          <Text numberOfLines={1} className="flex-1 text-body font-semibold text-ink">
            {titre}
          </Text>
          {garantieFinie === false ? (
            <View className="rounded-full bg-teal-light px-2 py-0.5">
              <Text className="text-caption font-semibold text-teal-dark">{t('factures.block.warranty_active')}</Text>
            </View>
          ) : null}
        </View>

        {/* LE MONTANT EST LE HÉROS de la ligne, et il garde sa place même
            absent : une ligne qui disparaîtrait ferait sauter la carte. */}
        <Text
          numberOfLines={1}
          className={facture.amount != null ? 'text-subheading font-bold text-ink' : 'text-subheading text-ink-faint'}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {facture.amount != null ? formatMontant(Number(facture.amount), i18n.language) : t('factures.list.no_amount')}
        </Text>

        <Text numberOfLines={1} className="text-caption text-ink-soft">
          {[facture.vendor && date ? date : null, facture.objet_names.join(', ')].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
}

function formatMontant(montant: number, langue: string): string {
  return new Intl.NumberFormat(langue, { style: 'currency', currency: 'EUR' }).format(montant);
}
