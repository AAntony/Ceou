import type { PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { IconBadge } from '../../components/IconBadge';
import { useScaled } from '../../lib/textScale';
import { useThemeColors } from '../../lib/theme';
import { PathRail } from '../onboarding/PathRail';
import type { DemoId } from './chapitres';
import { Pulse } from './Pulse';

// DES ÉCRANS DE L'APP, REDESSINÉS EN MINIATURE.
//
// POURQUOI PAS DES CAPTURES D'ÉCRAN, qui seraient plus fidèles et plus
// rapides : une image est figée. Elle ignore le thème sombre, elle ne grandit
// pas avec le réglage de taille du texte — les deux choses sur lesquelles
// cette app a le plus travaillé — elle pèse sur chaque mise à jour, et elle
// devient fausse sans prévenir le jour où l'écran qu'elle montre change.
// Redessinée avec les composants et les jetons de l'app, la miniature suit
// tout ça d'elle-même.
//
// CE SONT DES ILLUSTRATIONS, PAS DES ÉCRANS. Rien n'y est pressable : ce qui
// ressemble à un bouton n'en est pas un, et une miniature qui répondrait au
// doigt promettrait une navigation qu'elle ne sait pas faire.
//
// ⚠️ ELLES SONT LUES COMME UN SEUL BLOC PAR UN LECTEUR D'ÉCRAN, et c'est
// voulu : `accessible` sur le cadre, avec la légende pour libellé. Sans ça,
// la synthèse vocale énumérerait les libellés d'une interface FACTICE — « Avec
// facture, Sans facture, Darty, 249,00 € » — que personne ne peut atteindre.
// La légende, elle, dit ce que l'image montre.
//
// L'EXEMPLE RESTE LE MÊME D'UN BOUT À L'AUTRE DES TUTORIELS : des ciseaux
// dans une boîte, une perceuse achetée chez Darty. Changer d'exemple à chaque
// chapitre obligerait à réapprendre le décor avant de lire la leçon.

export function Demo({ id }: { id: DemoId }) {
  if (id === 'rangement') return <DemoRangement />;
  if (id === 'recherche') return <DemoRecherche />;
  if (id === 'tuile-facture') return <DemoTuileFacture />;
  if (id === 'dossier') return <DemoDossier />;
  return <DemoExport />;
}

/** Le cadre commun : un aplat de la couleur de FOND de l'app, pour qu'on lise « un écran ». */
function Ecran({ legende, children }: PropsWithChildren<{ legende: string }>) {
  return (
    <View className="mb-4" accessible accessibilityLabel={legende}>
      <View className="overflow-hidden rounded-2xl border border-ink/10 bg-sand p-3">{children}</View>
      <Text className="mt-2 text-caption leading-4 text-ink-soft">{legende}</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════

function DemoRangement() {
  const { t } = useTranslation();
  return (
    <Ecran legende={t('tutoriels.demos.rangement.caption')}>
      {/* LE FIL DU GUIDE DE DÉMARRAGE, repris tel quel. C'est la même idée
          enseignée au même endroit de l'app : la redessiner autrement ferait
          croire à deux notions différentes. */}
      <PathRail
        items={[
          { level: 'habitation', icon: 'maison', label: t('tutoriels.demos.rangement.habitation') },
          { level: 'piece', icon: 'cuisine', label: t('tutoriels.demos.rangement.piece') },
          { level: 'emplacement', icon: 'commode', label: t('tutoriels.demos.rangement.emplacement') },
          { level: 'conteneur', icon: 'boite', label: t('tutoriels.demos.rangement.conteneur') },
          { level: 'objet', icon: 'objet', label: t('tutoriels.demos.rangement.objet') },
        ]}
      />
    </Ecran>
  );
}

function DemoRecherche() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const largeur = useScaled(44);
  const hauteur = useScaled(34);

  return (
    <Ecran legende={t('tutoriels.demos.recherche.caption')}>
      <View className="flex-row items-center gap-2 rounded-xl border border-ink/10 bg-surface px-3 py-2">
        <Icon name="search" size={16} color={colors.inkFaint} />
        <Text className="text-label text-ink">{t('tutoriels.demos.recherche.query')}</Text>
      </View>

      <View className="mt-2 flex-row items-center gap-3 rounded-xl border border-ink/10 bg-surface p-2">
        <View
          style={{ width: largeur, height: hauteur }}
          className="items-center justify-center rounded-lg bg-sand-dark"
        >
          <Icon name="objet" size={16} color={colors.inkFaint} />
        </View>
        <View className="flex-1">
          <Text className="text-label font-semibold text-ink">{t('tutoriels.demos.recherche.result')}</Text>
          {/* LA RÉPONSE, C'EST LE CHEMIN — pas le nom, qu'on connaissait déjà. */}
          <Text className="text-caption text-ink-soft">{t('tutoriels.demos.recherche.path')}</Text>
        </View>
      </View>
    </Ecran>
  );
}

function DemoTuileFacture() {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <Ecran legende={t('tutoriels.demos.tuile_facture.caption')}>
      <Text className="text-body font-semibold text-ink">{t('tutoriels.demos.tuile_facture.objet')}</Text>
      <Text className="mb-3 text-caption text-ink-soft">{t('tutoriels.demos.tuile_facture.lieu')}</Text>

      {/* LA MOITIÉ DE LARGEUR EST PORTÉE PAR LES ENVELOPPES, jamais par la
          tuile. Un `flex-1` posé sur la tuile elle-même passe à `flexBasis: 0`
          dès qu'un parent se mesure sur son contenu — c'est le piège de
          hauteur documenté dans BottomSheetModal, et l'anneau interpose
          justement un tel parent. */}
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Tuile icon="move" label={t('tutoriels.demos.tuile_facture.move')} />
        </View>
        {/* L'ANNEAU EST SUR CELLE-CI, et sur aucune autre : l'étape qu'on est
            en train de lire parle de ce bouton précis. */}
        <View className="flex-1">
          <Pulse radius={16}>
            <Tuile icon="facture" label={t('tutoriels.demos.tuile_facture.facture')} accent={colors.accentDark} />
          </Pulse>
        </View>
      </View>
    </Ecran>
  );
}

/** Une tuile d'action, dessinée à la taille d'une miniature. */
function Tuile({ icon, label, accent }: { icon: 'move' | 'facture'; label: string; accent?: string }) {
  const colors = useThemeColors();
  return (
    <View className="items-center gap-1.5 rounded-2xl border border-ink/10 bg-surface px-2 py-3">
      <IconBadge icon={icon} fill={colors.accentLight} iconColor={accent ?? colors.accentDark} size={30} />
      <Text numberOfLines={2} className="text-center text-caption font-semibold text-ink">
        {label}
      </Text>
    </View>
  );
}

function DemoDossier() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const largeur = useScaled(30);
  const hauteur = useScaled(38);

  return (
    <Ecran legende={t('tutoriels.demos.dossier.caption')}>
      {/* LES DEUX ONGLETS : c'est la moitié de la leçon. Le second dit ce qui
          MANQUE, et c'est lui qui fait vivre la fonctionnalité. */}
      <View className="mb-2 flex-row gap-1 rounded-full bg-sand-dark p-1">
        <View className="flex-1 items-center rounded-full bg-surface py-1">
          <Text className="text-caption font-semibold text-ink">{t('tutoriels.demos.dossier.tab_with')}</Text>
        </View>
        <View className="flex-1 items-center py-1">
          <Text className="text-caption text-ink-soft">{t('tutoriels.demos.dossier.tab_without')}</Text>
        </View>
      </View>

      <View className="overflow-hidden rounded-xl border border-ink/10 bg-surface">
        <View className="flex-row items-center gap-2 p-2">
          <View
            style={{ width: largeur, height: hauteur }}
            className="items-center justify-center rounded-md bg-sand-dark"
          >
            <Icon name="facture" size={14} color={colors.inkFaint} />
          </View>
          <View className="flex-1">
            <Text className="text-label font-semibold text-ink">{t('tutoriels.demos.dossier.vendor')}</Text>
            <Text className="text-caption text-ink-soft">{t('tutoriels.demos.dossier.date')}</Text>
          </View>
          <Text className="text-label font-semibold text-ink" style={{ fontVariant: ['tabular-nums'] }}>
            {t('tutoriels.demos.dossier.amount')}
          </Text>
        </View>

        {/* LA BANDE DU BAS : un même ticket, deux objets. C'est exactement ce
            que le chapitre cherche à faire comprendre. */}
        <View className="flex-row flex-wrap gap-1.5 border-t border-ink/10 px-2 py-2">
          <Pastille label={t('tutoriels.demos.dossier.objet_1')} />
          <Pastille label={t('tutoriels.demos.dossier.objet_2')} />
        </View>
      </View>
    </Ecran>
  );
}

function Pastille({ label }: { label: string }) {
  const colors = useThemeColors();
  return (
    <View className="flex-row items-center gap-1 rounded-full bg-sand-dark px-2 py-1">
      <Icon name="objet" size={12} color={colors.inkSoft} />
      <Text className="text-caption text-ink">{label}</Text>
    </View>
  );
}

function DemoExport() {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <Ecran legende={t('tutoriels.demos.export.caption')}>
      <View className="flex-row items-center gap-3 rounded-xl bg-surface px-3 py-2">
        <Icon name="back" size={18} color={colors.inkSoft} />
        <Text className="flex-1 text-body font-semibold text-ink">{t('tutoriels.demos.export.title')}</Text>
        <Pulse radius={999}>
          <View className="rounded-full border border-ink/10 p-2">
            <Icon name="export" size={18} color={colors.accentDark} />
          </View>
        </Pulse>
      </View>
    </Ecran>
  );
}
