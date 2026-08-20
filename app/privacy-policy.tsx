import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

// Contenu déclaré directement ici (pas de clé i18n par paragraphe) : un texte
// juridique traduit phrase par phrase via i18next serait fragile à maintenir
// et risquerait des incohérences entre langues. Un objet FR/EN complet par
// langue reste la structure la plus sûre pour ce type de contenu.
const CONTENT: Record<'fr' | 'en', { title: string; updated: string; sections: { heading: string; body: string }[] }> = {
  fr: {
    title: 'Politique de confidentialité',
    updated: 'Dernière mise à jour : août 2026',
    sections: [
      {
        heading: 'Avertissement',
        body: "Ce texte est rédigé par l'éditeur de l'application (pas un professionnel du droit) dans un souci de transparence honnête sur les données traitées. Il ne remplace pas une relecture juridique professionnelle, en particulier si l'application venait à être proposée plus largement au public.",
      },
      {
        heading: 'Qui traite tes données',
        body: "Ceou est édité à titre indépendant. Pour toute question sur tes données, contacte aldana.antony@gmail.com.",
      },
      {
        heading: 'Données collectées',
        body: 'Ton adresse email et ton mot de passe (pour la connexion), un nom affiché et une photo de profil optionnels, ainsi que le contenu que tu crées dans l\'app : habitations, pièces, emplacements, conteneurs, objets (nom, description, photo, code-barre) et leur historique de déplacement.',
      },
      {
        heading: 'Hébergement',
        body: 'Toutes ces données sont hébergées chez Supabase, dans l\'Union Européenne (région eu-north-1, Stockholm).',
      },
      {
        heading: "Le scan photo par intelligence artificielle",
        body: "Si tu utilises la fonctionnalité de scan photo pour ajouter plusieurs objets à la fois, la photo que tu prends est envoyée à l'API Gemini de Google (hors Union Européenne) afin de détecter automatiquement les objets qu'elle contient. Google traite cette photo uniquement pour répondre à cette requête ponctuelle. Cette fonctionnalité te demande un accord explicite avant sa toute première utilisation, distinct de l'acceptation de cette politique.",
      },
      {
        heading: 'Recherche de produit par code-barre',
        body: "Si tu scannes un code-barre, ce code (pas d'autre donnée personnelle) est envoyé à UPCItemDB, un service tiers, pour retrouver automatiquement le nom et la photo du produit.",
      },
      {
        heading: 'Ce qui n\'est jamais fait',
        body: "Tes données ne sont ni vendues, ni utilisées à des fins publicitaires, ni partagées avec d'autres utilisateurs de l'app au-delà de ce que tu choisis explicitement de partager.",
      },
      {
        heading: 'Durée de conservation',
        body: "Tes données sont conservées tant que ton compte existe. Tu peux en demander la suppression à tout moment (voir ci-dessous).",
      },
      {
        heading: 'Tes droits',
        body: "Tu peux à tout moment consulter et modifier tes données directement dans l'application. La suppression complète de ton compte et de tes données se fait depuis l'application : Profil, puis « Mon compte », puis « Supprimer mon compte ». Elle est immédiate et définitive, photos comprises. Pour un export de tes données, écris à aldana.antony@gmail.com.",
      },
    ],
  },
  en: {
    title: 'Privacy Policy',
    updated: 'Last updated: August 2026',
    sections: [
      {
        heading: 'Disclaimer',
        body: "This text was written by the app's developer (not a legal professional) in the interest of honest transparency about how data is handled. It does not replace a professional legal review, particularly if the app were to be offered more widely to the public.",
      },
      {
        heading: 'Who processes your data',
        body: 'Ceou is published independently. For any question about your data, contact aldana.antony@gmail.com.',
      },
      {
        heading: 'Data collected',
        body: "Your email and password (for login), an optional display name and profile picture, and the content you create in the app: homes, rooms, spots, containers, items (name, description, photo, barcode) and their move history.",
      },
      {
        heading: 'Hosting',
        body: 'All this data is hosted with Supabase, within the European Union (eu-north-1 region, Stockholm).',
      },
      {
        heading: 'AI photo scanning',
        body: "If you use the photo scan feature to add several items at once, the photo you take is sent to Google's Gemini API (outside the EU) to automatically detect the objects it contains. Google processes this photo only to answer that one-off request. This feature asks for your explicit consent before its very first use, separate from accepting this policy.",
      },
      {
        heading: 'Barcode product lookup',
        body: 'If you scan a barcode, that code (no other personal data) is sent to UPCItemDB, a third-party service, to automatically retrieve the product name and photo.',
      },
      {
        heading: "What is never done",
        body: "Your data is never sold, never used for advertising, and never shared with other app users beyond what you explicitly choose to share.",
      },
      {
        heading: 'Retention',
        body: 'Your data is kept for as long as your account exists. You can request its deletion at any time (see below).',
      },
      {
        heading: 'Your rights',
        body: "You can view and edit your data directly in the app at any time. Full deletion of your account and data is done from the app: Profile, then \"My account\", then \"Delete my account\". It is immediate and permanent, photos included. For a data export, write to aldana.antony@gmail.com.",
      },
    ],
  },
};

export default function PrivacyPolicyScreen() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';
  const content = CONTENT[lang];

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: content.title }} />
      <ScrollView className="flex-1 bg-sand" contentContainerClassName="px-6 pb-16 pt-6">
        <Text className="mb-1 text-2xl font-bold text-ink">{content.title}</Text>
        <Text className="mb-6 text-xs text-ink-soft">{content.updated}</Text>
        {content.sections.map((section) => (
          <View key={section.heading} className="mb-5">
            <Text className="mb-1 text-base font-bold text-ink">{section.heading}</Text>
            <Text className="text-sm leading-5 text-ink-soft">{section.body}</Text>
          </View>
        ))}
      </ScrollView>
    </>
  );
}
