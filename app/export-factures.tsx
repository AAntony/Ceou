import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import { useSpaceForAppTabBar } from '../src/components/AppTabBar';
import { Button } from '../src/components/Button';
import { ButtonRow } from '../src/components/ButtonRow';
import { EmptyState } from '../src/components/EmptyState';
import { ErrorState } from '../src/components/ErrorState';
import { TextLink } from '../src/components/TextLink';
import {
  basculer,
  buildExportTree,
  etatDe,
  facturesSelectionnees,
  nodeKey,
  objetsDeLaFacture,
  toutesLesFeuilles,
  type TreeNode,
} from '../src/features/factures/exportTree';
import { ExportProgress } from '../src/features/factures/ExportProgress';
import { ExportTreeList } from '../src/features/factures/ExportTreeList';
import { useFacturesExportRows } from '../src/features/factures/queries';
import { useExportFactures, type FactureACibler, type ModeSortie } from '../src/features/factures/useExportFactures';
import { useIsOffline } from '../src/lib/network';

// CHOISIR CE QU'ON EXPORTE, PUIS L'ENVOYER.
//
// ═══ POURQUOI UNE ARBORESCENCE ET PAS UNE LISTE À COCHER ═══
//
// Parce que personne ne raisonne en factures. On pense « tout le salon », « la
// cave », « ce meuble-là » — les endroits, pas les tickets. Une liste plate de
// quarante factures obligerait à reconnaître chacune par son vendeur pour
// décider, c'est-à-dire à faire le travail que l'app est censée faire.
//
// L'arbre ne montre QUE les branches qui portent une facture (voir
// exportTree) : on ne peut pas exporter ce qui n'existe pas, et chercher
// douze feuilles parmi deux cents serait exactement le contraire du service
// rendu.
//
// ═══ LE LOGEMENT D'OÙ L'ON VIENT EST DÉJÀ COCHÉ ═══
//
// On arrive ici depuis le dossier d'un logement, en ayant appuyé sur
// « Exporter ». L'intention est donc connue, et la redemander en présentant
// un arbre vide serait un pas pour rien. Cocher autre chose reste à un
// appui — et décocher ce logement aussi.
//
// ═══ L'EXPORT DEMANDE UNE CONNEXION ═══
//
// C'est la seule fonctionnalité de l'app dans ce cas, et il faut le dire
// plutôt que de laisser échouer : les documents vivent dans un bucket privé,
// ils doivent être retéléchargés pour entrer dans le PDF (voir exportPdf).

export default function ExportFacturesScreen() {
  const { t } = useTranslation();
  const { habitationId } = useLocalSearchParams<{ habitationId?: string }>();
  const offline = useIsOffline();
  const espaceBarre = useSpaceForAppTabBar();

  const { data, isLoading, isError, refetch } = useFacturesExportRows(true);
  const rows = useMemo(() => data ?? [], [data]);
  const racines = useMemo(() => buildExportTree(rows), [rows]);

  const { exporter, travail } = useExportFactures();

  // L'ÉTAT PAR DÉFAUT EST CALCULÉ, PAS POSÉ PAR UN EFFET. Un effet qui
  // écrirait la sélection au retour de la requête provoquerait un rendu en
  // cascade, et il faudrait en plus un garde-fou pour ne pas écraser les
  // choix déjà faits quand la liste se rafraîchit. `null` veut dire « on n'a
  // encore rien touché » : c'est tout ce qu'il y a à retenir.
  const defaut = useMemo(() => etatInitial(racines, habitationId), [racines, habitationId]);
  const [choix, setChoix] = useState<{ selection: Set<string>; ouverts: Set<string> } | null>(null);
  const courant = choix ?? defaut;

  const onBasculer = useCallback(
    (noeud: TreeNode) => {
      setChoix((etat) => {
        const base = etat ?? defaut;
        return { ...base, selection: basculer(noeud, base.selection) };
      });
    },
    [defaut],
  );

  const onDeplier = useCallback(
    (noeud: TreeNode) => {
      setChoix((etat) => {
        const base = etat ?? defaut;
        const ouverts = new Set(base.ouverts);
        if (ouverts.has(noeud.key)) ouverts.delete(noeud.key);
        else ouverts.add(noeud.key);
        return { ...base, ouverts };
      });
    },
    [defaut],
  );

  const choisies = useMemo(() => facturesSelectionnees(rows, courant.selection), [rows, courant.selection]);
  const toutCoche = useMemo(
    () => racines.length > 0 && racines.every((racine) => etatDe(racine, courant.selection) === 'all'),
    [racines, courant.selection],
  );

  const lancer = (mode: ModeSortie) => {
    const cibles: FactureACibler[] = choisies.map((row) => ({
      id: row.facture_id,
      vendor: row.vendor,
      amount: row.amount,
      purchaseDate: row.purchase_date,
      warrantyUntil: row.warranty_until,
      documentUrl: row.document_url,
      documentKind: row.document_kind,
      // CE QU'ON A DEMANDÉ, ET RIEN DE PLUS. Une facture peut couvrir des
      // objets hors sélection ; les nommer dans le PDF révélerait qu'on
      // possède autre chose, à quelqu'un à qui on n'exportait qu'un salon.
      objets: objetsDeLaFacture(rows, row.facture_id, courant.selection),
    }));
    void exporter(cibles, mode);
  };

  const bloque = choisies.length === 0 || offline || travail !== null;

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('factures.export.title') }} />

      <View className="flex-1 bg-sand">
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : racines.length === 0 ? (
          <EmptyState
            icon="facture"
            title={t('factures.export.empty_title')}
            subtitle={t('factures.export.empty_hint')}
          />
        ) : (
          <>
            <ExportTreeList
              racines={racines}
              ouverts={courant.ouverts}
              selection={courant.selection}
              onBasculer={onBasculer}
              onDeplier={onDeplier}
              entete={
                <View className="mb-1">
                  <Text className="mb-2 text-label leading-5 text-ink-soft">{t('factures.export.intro')}</Text>
                  <View className="flex-row justify-end">
                    <TextLink
                      label={t(toutCoche ? 'factures.export.clear' : 'factures.export.select_all')}
                      onPress={() =>
                        setChoix({
                          ouverts: courant.ouverts,
                          selection: toutCoche ? new Set<string>() : toutesLesFeuilles(racines),
                        })
                      }
                    />
                  </View>
                </View>
              }
            />

            {/* LA BARRE RESTE VISIBLE PENDANT QU'ON COCHE, et elle dit toujours
                combien de FACTURES partiront. C'est le seul chiffre qui compte
                au moment de décider : le nombre de cases cochées, lui, ne veut
                rien dire, puisqu'une facture peut couvrir plusieurs objets et
                ne s'imprime qu'une fois. */}
            {/* ELLE MONTE AU-DESSUS DE LA BARRE D'ONGLETS, par un rembourrage
                et non une marge : le fond continue ainsi derrière la barre,
                au lieu de laisser une bande de sable entre les deux. */}
            <View
              className="border-t border-ink/10 bg-surface px-6 pt-4"
              style={{ paddingBottom: espaceBarre + 16 }}
            >
              <Text className="mb-3 text-center text-label text-ink">
                {t('factures.export.selected', { count: choisies.length })}
              </Text>
              {offline ? (
                <Text className="mb-3 text-center text-caption text-ink-soft">{t('factures.export.offline')}</Text>
              ) : null}
              <ButtonRow>
                <Button label={t('factures.export.mail')} onPress={() => lancer('mail')} disabled={bloque} />
                <Button
                  label={t('factures.export.save')}
                  variant="outline"
                  onPress={() => lancer('partage')}
                  disabled={bloque}
                />
              </ButtonRow>
            </View>
          </>
        )}

      </View>

      <ExportProgress travail={travail} />
    </>
  );
}

/**
 * Ce qui est déplié et coché à l'ouverture.
 *
 * Le logement d'où l'on vient, et lui seul. Sans paramètre — depuis une
 * entrée générale — l'arbre s'ouvre replié et vide : rien ne dit alors ce
 * qu'on est venu chercher, et tout cocher serait un choix pris à la place de
 * la personne.
 */
function etatInitial(
  racines: TreeNode[],
  habitationId: string | undefined,
): { selection: Set<string>; ouverts: Set<string> } {
  if (!habitationId) return { selection: new Set(), ouverts: new Set() };

  const cle = nodeKey('habitation', habitationId);
  const racine = racines.find((noeud) => noeud.key === cle);
  if (!racine) return { selection: new Set(), ouverts: new Set() };

  return { selection: new Set(racine.leaves), ouverts: new Set([cle]) };
}
