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

// UN AIGUILLAGE PLAT plutot qu'une table : chaque branche rend un composant
// different, et une table de composants obligerait a les declarer avant leur
// usage ou a les hisser dans un objet en tete de fichier.
export function Demo({ id }: { id: DemoId }) {
  if (id === 'demenagement') return <DemoDemenagement />;
  if (id === 'rangement') return <DemoRangement />;
  if (id === 'recherche') return <DemoRecherche />;
  if (id === 'tuile-facture') return <DemoTuileFacture />;
  if (id === 'dossier') return <DemoDossier />;
  if (id === 'export') return <DemoExport />;
  if (id === 'voix') return <DemoVoix />;
  if (id === 'scan-ia') return <DemoScanIa />;
  if (id === 'plan') return <DemoPlan />;
  if (id === 'pret') return <DemoPret />;
  if (id === 'amis') return <DemoAmis />;
  if (id === 'invite') return <DemoInvite />;
  if (id === 'affichage') return <DemoAffichage />;
  return <DemoHorsLigne />;
}

/** Le cadre commun : un aplat de la couleur de FOND de l'app, pour qu'on lise « un écran ». */
function Ecran({ legende, children }: PropsWithChildren<{ legende: string }>) {
  return (
    <View className="mb-4" accessible accessibilityLabel={legende}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden className="overflow-hidden rounded-2xl border border-ink/10 bg-sand p-3">{children}</View>
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
      <Text className="mb-2 text-body font-bold text-coral-dark">Céoù</Text>
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

      <View className="flex-row flex-wrap gap-2">
        <Tuile icon="move" label={t('inventory.objet.move')} />
        <Tuile icon="pret" label={t('loans.entry')} />
        <Tuile icon="facture" label={t('tutoriels.demos.tuile_facture.facture')} accent={colors.accentDark} />
      </View>
    </Ecran>
  );
}

/** Une tuile d'action, dessinée à la taille d'une miniature. */
function Tuile({ icon, label, accent }: { icon: 'move' | 'facture' | 'pret'; label: string; accent?: string }) {
  const colors = useThemeColors();
  return (
    <View style={{ flexGrow: 1, flexBasis: 80 }} className="items-center justify-center gap-1.5 rounded-2xl border border-ink/10 bg-surface px-2 py-3">
      <IconBadge icon={icon} fill={colors.accentLight} iconColor={accent ?? colors.accentDark} size={30} />
      <Text className="text-center text-caption font-semibold text-ink">
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

// ═══════════════════════════════════════════════════════════════════════
// Les huit chapitres suivants
// ═══════════════════════════════════════════════════════════════════════

function DemoVoix() {
  const { t } = useTranslation();
  const colors = useThemeColors();


  return (
    <Ecran legende={t('tutoriels.demos.voix.caption')}>
      <View className="gap-3">
        {/* LE MICRO BAT : c'est le seul bouton de cet écran, et l'étape qu'on
            lit dit « appuie dessus ». */}
        <Pulse radius={999}>
          <View

            className="flex-row items-center justify-center gap-2 rounded-full bg-coral px-3 py-3"
          >
            <Icon name="microphone" size={18} color="#fff" />
            <Text className="text-caption font-semibold text-white">{t('tutoriels.demos.voix.button')}</Text>
          </View>
        </Pulse>
        <Text className="text-label font-semibold text-ink">{t('tutoriels.demos.voix.question')}</Text>
      </View>

      {/* LA RÉPONSE EST UNE PHRASE, pas une liste : Céoù la dit à voix haute,
          et une liste ne se dit pas. */}
      <View className="mt-3 flex-row items-start gap-2 rounded-2xl bg-teal-light px-3 py-2">
        <Icon name="validate" size={16} color={colors.tealDark} />
        <Text className="flex-1 text-label text-teal-dark">{t('tutoriels.demos.voix.answer')}</Text>
      </View>
    </Ecran>
  );
}

function DemoScanIa() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const hauteur = useScaled(56);

  return (
    <Ecran legende={t('tutoriels.demos.scan_ia.caption')}>
      <View style={{ height: hauteur }} className="mb-2 items-center justify-center rounded-xl bg-sand-dark">
        <Icon name="camera" size={20} color={colors.inkFaint} />
      </View>

      <Text className="mb-1.5 text-caption font-semibold uppercase tracking-wide text-ink-faint">
        {t('tutoriels.demos.scan_ia.title')}
      </Text>
      {['objet_1', 'objet_2', 'objet_3'].map((cle) => (
        <View key={cle} className="mb-1 flex-row items-center gap-2 rounded-lg bg-surface px-2 py-1.5">
          <Icon name="included" size={14} color={colors.tealDark} />
          <Text className="flex-1 text-caption text-ink">{t(`tutoriels.demos.scan_ia.${cle}`)}</Text>
        </View>
      ))}

      <View className="mt-2 items-center rounded-xl bg-coral py-2">
        <Text className="text-caption font-semibold text-white">{t('tutoriels.demos.scan_ia.confirm')}</Text>
      </View>
    </Ecran>
  );
}

function DemoPlan() {
  const { t } = useTranslation();
  return <Ecran legende={t('tutoriels.demos.plan.caption')}>
    <View className="mb-3 flex-row items-center justify-between gap-2">
      <Text className="flex-1 text-label font-semibold text-ink">{t('onboarding.plan.default_name')}</Text>
      <Text className="text-caption text-coral-dark">{t('tutoriels.demos.plan.mode')}</Text>
    </View>
    <View className="flex-row rounded-xl border border-ink/20 bg-surface">
      <View className="flex-1 items-center justify-center gap-4 border-r border-ink/20 bg-coral-light px-2 py-6">
        <Text className="text-center text-label font-semibold text-ink">{t('tutoriels.demos.plan.piece_1')}</Text>
        <View className="h-10 w-10 items-center justify-center rounded-full border-2 border-surface bg-coral"><Text className="text-body font-bold text-white">1</Text></View>
      </View>
      <View className="flex-1 items-center justify-center px-2 py-6"><Text className="text-center text-label text-ink-soft">{t('tutoriels.demos.plan.piece_2')}</Text></View>
    </View>
    <View className="mt-3 rounded-xl border border-ink/10 bg-surface p-3">
      <Text className="text-caption text-coral-dark">{t('plans.object_focus.title')}</Text>
      <Text className="text-body font-semibold text-ink">{t('tutoriels.demos.plan.item')}</Text>
      <Text className="text-label text-ink-soft">{t('tutoriels.demos.plan.storage')}</Text>
    </View>
  </Ecran>;
}

function DemoDemenagement() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const phases = t('tutoriels.demos.demenagement.phases', { returnObjects: true }) as string[];
  return <Ecran legende={t('tutoriels.demos.demenagement.caption')}>
    <Text className="mb-3 text-body font-semibold text-ink">{t('tutoriels.demos.demenagement.title')}</Text>
    <View className="mb-3 flex-row flex-wrap gap-2">
      {phases.map((phase, i) => <View key={phase} className="flex-row items-center gap-1 rounded-xl bg-coral-light px-2 py-2"><Text className="text-caption text-coral-dark">{i + 1} · {phase}</Text></View>)}
    </View>
    <View className="mb-3 flex-row items-center gap-2"><Icon name="conteneur" size={20} color={colors.accentDark} /><Text className="flex-1 text-label text-coral-dark">{t('tutoriels.demos.demenagement.action')}</Text></View>
    <View className="flex-row items-center gap-3 rounded-xl bg-surface p-3">
      <Icon name="camera" size={26} color={colors.inkSoft} />
      <View className="flex-1"><Text className="text-label font-semibold text-ink">{t('tutoriels.demos.demenagement.box')}</Text><Text className="text-caption text-ink-soft">{t('tutoriels.demos.demenagement.contents')}</Text></View>
    </View>
  </Ecran>;
}

function DemoPret() {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <Ecran legende={t('tutoriels.demos.pret.caption')}>
      <View className="rounded-xl border border-ink/10 bg-surface p-3">
        <Text className="text-label font-semibold text-ink">{t('tutoriels.demos.pret.objet')}</Text>
        <View className="mt-1 flex-row items-center gap-2">
          <Icon name="pret" size={14} color={colors.accentDark} />
          <Text className="text-caption text-ink-soft">{t('tutoriels.demos.pret.who')}</Text>
        </View>
        <Text className="mt-0.5 text-caption text-ink-soft">{t('tutoriels.demos.pret.due')}</Text>

        <View className="mt-2 self-start rounded-full border border-ink/10 px-3 py-1">
          <Text className="text-caption font-semibold text-ink">{t('tutoriels.demos.pret.action')}</Text>
        </View>
      </View>
    </Ecran>
  );
}

function DemoAmis() {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <Ecran legende={t('tutoriels.demos.amis.caption')}>
      <Text className="mb-2 text-label font-semibold text-ink">{t('profile.sections.sharing.title')}</Text>
      <Text className="mb-1 text-caption text-ink-soft">{t('tutoriels.demos.amis.code_label')}</Text>
      <View className="flex-row items-center justify-between rounded-xl border border-ink/10 bg-surface px-3 py-2">
        <Text className="text-body font-bold tracking-widest text-ink">{t('tutoriels.demos.amis.code')}</Text>
        <Icon name="qrcode" size={16} color={colors.inkSoft} />
      </View>

      {/* LE DROIT SE RÈGLE PAR HABITATION : la rangée le montre mieux qu'une
          phrase, parce qu'elle met le logement et le droit sur la même ligne. */}
      <View className="mt-2 flex-row items-center gap-2 rounded-xl border border-ink/10 bg-surface px-3 py-2">
        <Icon name="maison" size={14} color={colors.accentDark} />
        <Text className="flex-1 text-caption text-ink">{t('tutoriels.demos.amis.habitation')}</Text>
        <View className="rounded-full bg-coral-light px-2 py-0.5">
          <Text className="text-caption font-semibold text-coral-dark">{t('tutoriels.demos.amis.permission')}</Text>
        </View>
      </View>
    </Ecran>
  );
}

function DemoInvite() {
  const { t } = useTranslation();

  return (
    <Ecran legende={t('tutoriels.demos.invite.caption')}>
      <View className="items-center rounded-xl border border-ink/10 bg-surface px-3 py-3">
        <Text className="text-caption text-ink-soft">{t('tutoriels.demos.invite.label')}</Text>
        <Text className="mt-1 text-heading font-bold tracking-widest text-ink">
          {t('tutoriels.demos.invite.code')}
        </Text>
        <Text className="mt-1 text-center text-caption text-ink-faint">{t('tutoriels.demos.invite.note')}</Text>
      </View>
    </Ecran>
  );
}

function DemoAffichage() {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <Ecran legende={t('tutoriels.demos.affichage.caption')}>
      <Text className="mb-3 text-label font-semibold text-ink">{t('profile.sections.preferences.title')}</Text>
      <Text className="mb-1.5 text-caption text-ink-soft">{t('tutoriels.demos.affichage.title')}</Text>
      <View className="flex-row flex-wrap gap-2">
        {[
          { cle: 'normal', actif: false },
          { cle: 'large', actif: true },
          { cle: 'huge', actif: false },
        ].map(({ cle, actif }) => (
          <View key={cle} className={`flex-1 items-center justify-center rounded-xl border px-1 py-3 ${actif ? 'border-coral bg-coral-light' : 'border-ink/10 bg-surface'}`}>
            <Text className={`text-caption ${actif ? 'font-semibold text-ink' : 'text-ink-soft'}`}>
              Aa{'\n'}{t(`tutoriels.demos.affichage.${cle}`)}
            </Text>
          </View>
        ))}
      </View>

      {/* L'APERÇU EST CE QUI REND LE RÉGLAGE COMPRÉHENSIBLE : « grande » ne
          veut rien dire tant qu'on n'a pas vu une vraie rangée grandir. */}
      <View className="mt-2 flex-row items-center gap-2 rounded-xl border border-ink/10 bg-surface px-3 py-2">
        <Icon name="objet" size={16} color={colors.inkFaint} />
        <View className="flex-1">
          <Text className="text-label font-semibold text-ink">{t('tutoriels.demos.affichage.preview_name')}</Text>
          <Text className="text-caption text-ink-soft">{t('tutoriels.demos.affichage.preview_location')}</Text>
        </View>
      </View>
    </Ecran>
  );
}

function DemoHorsLigne() {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <Ecran legende={t('tutoriels.demos.hors_ligne.caption')}>
      <View className="mb-2 flex-row items-center gap-2 rounded-lg bg-mustard-light px-3 py-1.5">
        <Icon name="alert" size={14} color={colors.mustardDark} />
        <Text className="text-caption font-semibold text-mustard-dark">
          {t('tutoriels.demos.hors_ligne.banner')}
        </Text>
      </View>

      {/* L'OBJET EST DÉJÀ LÀ, bandeau ou pas : c'est toute la leçon du
          chapitre, et un écran vide ne l'aurait pas dite. */}
      <View className="flex-row items-center gap-2 rounded-xl border border-ink/10 bg-surface px-3 py-2">
        <Icon name="objet" size={16} color={colors.inkFaint} />
        <View className="flex-1">
          <Text className="text-label font-semibold text-ink">{t('tutoriels.demos.hors_ligne.objet')}</Text>
          <Text className="text-caption text-ink-soft">{t('tutoriels.demos.hors_ligne.lieu')}</Text>
        </View>
        <Icon name="validate" size={16} color={colors.tealDark} />
      </View>
    </Ecran>
  );
}
