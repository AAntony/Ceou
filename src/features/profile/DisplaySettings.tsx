import { useTranslation } from 'react-i18next';
import { Pressable, Switch, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { STACK_SCALE, useTextScale, type TextScalePreference } from '../../lib/textScale';
import { useTheme, useThemeColors } from '../../lib/theme';

// LES DEUX RÉGLAGES D'ÉCRAN, DANS UNE SEULE CARTE.
//
// Le thème vivait déjà seul dans le Profil ; la taille du texte l'y aurait
// rejoint comme un second bloc sans lien avec le premier, coincé entre la
// langue et le code ami. Or ce sont les deux seuls réglages de l'app qui ne
// parlent ni du compte ni du contenu, mais de la façon dont l'écran se
// présente — et exactement les deux qu'on vient chercher quand on lit mal.
// Réunis sous un titre, ils se trouvent en une fois.
//
// Partagée entre le Profil normal et celui d'un visiteur : un visiteur ne
// possède rien dans l'app, mais il a les mêmes yeux et le même écran.

// Les trois crans, avec la taille de leur échantillon « Aa ». Montrées CÔTE À
// CÔTE, elles permettent de choisir sans essayer — un libellé seul
// (« Grande ») ne dit rien tant qu'on ne l'a pas appliqué.
//
// Les clés sont écrites en toutes lettres plutôt que composées
// (`'…sizes.' + option`) : c'est ce qui permet de vérifier mécaniquement
// qu'elles existent dans les deux langues, une clé assemblée à l'exécution
// n'étant contrôlable par rien.
const OPTIONS: { value: TextScalePreference; labelKey: string; sample: string }[] = [
  { value: 'normal', labelKey: 'profile.display.sizes.normal', sample: 'text-label' },
  { value: 'large', labelKey: 'profile.display.sizes.large', sample: 'text-subheading' },
  { value: 'huge', labelKey: 'profile.display.sizes.huge', sample: 'text-title' },
];

function Divider() {
  return <View className="my-4 h-px bg-ink/10" />;
}

/** Rangée inerte, dessinée comme une vraie ligne d'inventaire. */
function Preview() {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    // `accessible={false}` : c'est une démonstration, pas un contrôle.
    // Annoncée comme un élément de liste, elle promettrait un objet qui
    // n'existe pas dans l'inventaire de la personne.
    <View accessible={false} className="flex-row items-center rounded-2xl bg-sand p-3">
      <View className="mr-3 h-11 w-11 items-center justify-center rounded-xl bg-coral-light">
        <Icon name="tiroir" size={22} color={colors.accentDark} />
      </View>
      <View className="flex-1">
        <Text className="text-body font-semibold text-ink">{t('profile.display.preview_name')}</Text>
        <Text className="mt-0.5 text-label text-ink-soft">{t('profile.display.preview_location')}</Text>
      </View>
    </View>
  );
}

export function DisplaySettings() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { preference: themePreference, isDark, setPreference: setThemePreference } = useTheme();
  const { preference, osFontScale, textScale, setPreference } = useTextScale();

  // Arrondi au pourcent : Android renvoie des valeurs comme 1.2999999.
  const osPercent = Math.round(osFontScale * 100);

  // UNE FOIS LE TEXTE GROS, LES TROIS PASTILLES S'EMPILENT. Côte à côte,
  // chacune ne dispose que d'un tiers d'écran : « Très grande » y serait
  // coupé en plein milieu d'un mot — et c'est précisément l'option que
  // regarde quelqu'un qui vient d'agrandir le texte.
  const stacked = textScale >= STACK_SCALE;

  return (
    <View>
      <Text className="mb-2 text-label font-medium text-ink-soft">{t('profile.display.title')}</Text>

      <View className="rounded-2xl border border-ink/10 bg-surface p-4">
        {/* UN INTERRUPTEUR ET NON TROIS CHOIX (clair / sombre / système) :
            tant que personne n'y touche, l'app suit le téléphone, ce que
            'system' ferait de mieux. Le lien de retour n'apparaît QUE si un
            choix manuel a été fait — avant, il ne proposerait rien d'autre
            que l'état courant. */}
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1 flex-row items-center gap-3">
            <Icon name="theme" size={20} color={colors.inkSoft} />
            <Text className="flex-1 text-body text-ink">{t('profile.theme.dark_label')}</Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={(next) => setThemePreference(next ? 'dark' : 'light')}
            trackColor={{ false: colors.sandDark, true: colors.accent }}
            thumbColor={colors.surface}
            accessibilityLabel={t('profile.theme.dark_label')}
          />
        </View>
        {themePreference === 'system' ? null : (
          <Pressable
            onPress={() => setThemePreference('system')}
            className="mt-2 self-start py-1"
            accessibilityRole="button"
          >
            <Text className="text-caption font-semibold text-coral">{t('profile.theme.follow_system')}</Text>
          </Pressable>
        )}

        <Divider />

        <View className="flex-row items-center gap-3">
          <Icon name="textSize" size={20} color={colors.inkSoft} />
          <Text className="flex-1 text-body text-ink">{t('profile.display.text_size')}</Text>
        </View>

        {/* `radiogroup` et non trois boutons indépendants : le lecteur
            d'écran annonce alors « 2 sur 3 », donc combien de crans restent. */}
        <View accessibilityRole="radiogroup" className={`mt-3 gap-2 ${stacked ? '' : 'flex-row'}`}>
          {OPTIONS.map((option) => {
            const selected = option.value === preference;
            return (
              <Pressable
                key={option.value}
                onPress={() => setPreference(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={t(option.labelKey)}
                className={`rounded-xl border px-3 py-3 ${
                  stacked ? 'flex-row items-center gap-3' : 'flex-1 items-center justify-end'
                } ${selected ? 'border-coral bg-coral-light' : 'border-ink/10'}`}
              >
                {/* Le « Aa » est un ÉCHANTILLON, pas un libellé : lu à voix
                    haute il ne dirait que « a a ». Le texte à côté porte le
                    sens, et le Pressable porte déjà son propre nom. */}
                <Text
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  className={`${option.sample} font-bold ${selected ? 'text-coral-dark' : 'text-ink-faint'}`}
                >
                  Aa
                </Text>
                <Text
                  className={`text-caption ${stacked ? 'flex-1' : 'mt-1 text-center'} ${
                    selected ? 'font-semibold text-coral-dark' : 'text-ink-soft'
                  }`}
                >
                  {t(option.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text className="mt-2 text-caption leading-4 text-ink-soft">{t('profile.display.text_size_hint')}</Text>

        <Divider />

        {/* L'APERÇU EST LE VRAI ARGUMENT DE CETTE SECTION. Tout l'écran change
            en direct, mais on regarde le contrôle qu'on vient de toucher, pas
            la page entière : la rangée est donc posée juste en dessous, à la
            taille qu'auront les listes de l'inventaire. */}
        <Text className="mb-2 text-caption font-medium uppercase tracking-wide text-ink-faint">
          {t('profile.display.preview_title')}
        </Text>
        <Preview />

        {/* Dit à quoi le réglage s'ajoute. Sans cette ligne, quelqu'un dont le
            téléphone est déjà à 130 % ne comprend pas pourquoi « Normale »
            n'est pas la taille qu'il connaît ailleurs. */}
        <Text className="mt-3 text-caption leading-4 text-ink-faint">
          {osPercent === 100
            ? t('profile.display.system_hint')
            : t('profile.display.system_hint_active', { percent: osPercent })}
        </Text>
      </View>
    </View>
  );
}
