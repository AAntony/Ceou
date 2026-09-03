import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import privacyPolicy from '../src/features/legal/privacyPolicy.json';

// LE TEXTE VIT DANS UN JSON, ET IL EST PARTAGÉ AVEC LA PAGE PUBLIQUE.
//
// Pas de clé i18n par paragraphe : un texte juridique traduit phrase par
// phrase serait fragile à maintenir et risquerait des incohérences entre
// langues. Un objet FR/EN complet par langue reste la structure la plus
// sûre pour ce type de contenu.
//
// Mais il doit exister à DEUX endroits : ici, dans l'app, et sur une page web
// publique — les deux stores exigent une adresse consultable sans installer
// l'app, et Google Play une page de demande de suppression de compte
// par-dessus. Deux copies d'un texte juridique finissent toujours par
// diverger, et la divergence ne se voit pas : personne ne relit l'une en
// pensant à l'autre.
//
// Il est donc écrit UNE SEULE FOIS dans privacyPolicy.json, lu ici et lu par
// scripts/build-legal-page.mjs, qui régénère la page publique. Après toute
// modification du JSON : relancer ce script et redéployer, sinon la version
// publique reste en arrière.
const CONTENT = privacyPolicy.policy as Record<
  'fr' | 'en',
  { title: string; updated: string; sections: { heading: string; body: string }[] }
>;

export default function PrivacyPolicyScreen() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';
  const content = CONTENT[lang];

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: content.title }} />
      <ScrollView className="flex-1 bg-sand" contentContainerClassName="px-6 pb-16 pt-6">
        <Text className="mb-1 text-title font-bold text-ink">{content.title}</Text>
        <Text className="mb-6 text-caption text-ink-soft">{content.updated}</Text>
        {content.sections.map((section) => (
          <View key={section.heading} className="mb-5">
            <Text className="mb-1 text-subheading font-bold text-ink">{section.heading}</Text>
            {/* `body` et non `label` : c'est le seul ecran de l'app qu'on lit
                vraiment en continu, sur plusieurs paragraphes. Le corps de
                texte y a sa place, pas la taille des legendes. */}
            <Text className="text-body leading-6 text-ink-soft">{section.body}</Text>
          </View>
        ))}
      </ScrollView>
    </>
  );
}
