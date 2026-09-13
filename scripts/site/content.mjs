// LE TEXTE DU SITE, ET RIEN QUE LUI.
//
// Séparé du gabarit pour une raison simple : c'est la partie qui se relit, se
// corrige et se traduit, et on ne relit pas une phrase noyée entre deux
// balises. Les deux langues vivent côte à côte dans le même objet — un ajout
// côté français qui n'a pas son pendant anglais se voit immédiatement.
//
// CE TEXTE N'APPARTIENT QU'AU SITE. Celui de la politique de confidentialité
// vient de src/features/legal/privacyPolicy.json, que lit aussi l'écran de
// l'app : recopié ici, il divergerait, et l'écart entre ce qu'une app déclare
// et ce que sa page publique déclare est exactement ce qu'un examinateur de
// store relève.

export const CONTACT = 'contact@ceou.eu';

// Sert aux adresses canoniques et aux cartes de partage, qui n'acceptent
// qu'une adresse absolue. Le reste du site se lie en relatif, pour rester
// consultable depuis un dossier local avant déploiement.
export const ORIGIN = 'https://ceou.eu';

// LE QUESTIONNAIRE, qui sert aussi d'inscription au test.
//
// UN LIEN, PAS UNE RESSOURCE : rien n'est chargé depuis Google tant que le
// visiteur ne clique pas, et le texte autour dit où il va. La règle du site —
// ne rien appeler de distant — tient donc toujours.
export const SURVEY = 'https://forms.gle/ngUZoU7c9f6euFFp6';

// LES NOMS DE FICHIERS ET LES ANCRES PARTENT DANS LES FICHES DE STORE.
// Une adresse déposée là-bas est recopiée ailleurs et ne se corrige jamais
// partout : à figer une fois la première soumission faite.
export const FILES = {
  home: { fr: 'index.html', en: 'en.html' },
  privacy: { fr: 'confidentialite.html', en: 'privacy.html' },
};
export const DELETION_ANCHOR = { fr: 'suppression-de-compte', en: 'account-deletion' };

export const OTHER = { fr: 'en', en: 'fr' };

// Les identifiants de section sont déclarés une fois et servent À LA FOIS à
// l'ancre et au lien de navigation qui la vise. Écrits deux fois, ils
// finiraient par ne plus se répondre — et un lien de menu qui ne défile pas
// est le genre de panne qu'on ne remarque qu'en production.
const IDS = {
  fr: { how: 'comment', features: 'fonctionnalites', detail: 'en-detail', pillars: 'engagements', progress: 'avancement', faq: 'questions' },
  en: { how: 'how-it-works', features: 'features', detail: 'in-detail', pillars: 'principles', progress: 'progress', faq: 'faq' },
};

export const SITE = {
  fr: {
    lang: 'fr',
    ids: IDS.fr,
    title: 'Céoù — sais toujours où sont tes affaires',
    description:
      "Céoù note où tu ranges tes affaires, pièce par pièce, et te le redit quand tu l'as oublié. Hors ligne, sans publicité, hébergé dans l'Union européenne.",
    switchLabel: 'English',
    switchTitle: 'Read this page in English',
    skip: 'Aller au contenu',
    menu: { open: 'Ouvrir le menu', close: 'Fermer le menu' },
    nav: [
      { to: 'how', label: 'Comment ça marche' },
      { to: 'features', label: 'Fonctionnalités' },
      { to: 'pillars', label: 'Engagements' },
      { to: 'progress', label: 'Avancement' },
      { to: 'faq', label: 'Questions' },
    ],
    navPrivacy: 'Confidentialité',

    // Le bandeau au-dessus de l'en-tête, sur les quatre pages.
    //
    // UN BOUTON COURT, EXPRÈS : sur un téléphone de 375 pixels, « Répondre
    // au questionnaire » renvoyait le second lien à la ligne, et le bandeau
    // montait à 134 pixels — un sixième de l'écran avant même le logo.
    announce: {
      label: 'Annonce',
      tag: 'En test',
      text: 'Céoù cherche ses premiers testeurs : 5 minutes pour donner ton avis.',
      cta: 'Je participe',
      more: 'Où en est Céoù ?',
    },

    hero: {
      pun: 'Céoù, comme « c’est où ? »',
      title: 'Range une fois. Retrouve toujours.',
      body: "Céoù retient où tu poses tes affaires — quelle pièce, quel meuble, quelle boîte — et te le redit le jour où tu ne t'en souviens plus.",
      badge: 'Bientôt sur Android et iOS',
      note: 'Sans publicité. Marche hors ligne. Hébergé dans l’Union européenne.',
      cta: 'Voir ce que ça fait',
      mock: {
        label:
          'L’écran de recherche de Céoù : le mot « perceuse » est tapé, et la réponse s’affiche — Perceuse, dans la boîte à outils, sur l’établi, au garage.',
        placeholder: 'Chercher un objet',
        query: 'perceuse',
        results: [
          { name: 'Perceuse', path: 'Maison › Garage › Établi › Boîte à outils' },
          { name: 'Mèches à béton', path: 'Maison › Garage › Établi › Boîte à outils' },
        ],
      },
    },

    steps: {
      title: 'Trois gestes, et c’est réglé',
      lede: 'Le rangement se décrit une fois. Ce que tu gagnes, tu le gagnes pendant des années.',
      items: [
        {
          title: 'Décris ton logement',
          body: 'Une seule fois : tes pièces, tes meubles, les boîtes qui traînent dedans. Céoù reprend la structure de chez toi, pas une liste à plat où tout se ressemble.',
        },
        {
          title: 'Range pour de vrai',
          body: 'La perceuse va dans la boîte à outils, sur l’établi, au garage. Tu le dis une fois — au clavier, à la voix, ou en photographiant le tiroir entier.',
        },
        {
          title: 'Demande, le jour venu',
          body: 'Six mois plus tard, tape « perceuse ». Céoù te rend le chemin complet, du logement jusqu’à la boîte. Sans réfléchir, sans fouiller.',
        },
      ],
      chainLabel: 'La hiérarchie de Céoù : Maison, puis Garage, puis Établi, puis Boîte à outils, puis Perceuse.',
      chain: ['Maison', 'Garage', 'Établi', 'Boîte à outils', 'Perceuse'],
    },

    features: {
      title: 'Ce que Céoù sait faire',
      lede: 'Tout est là dès la première ouverture. Rien n’est réservé, rien ne se débloque.',
      items: [
        {
          icon: 'home',
          tone: 'blue',
          title: 'Range comme chez toi',
          body: 'Logement, pièce, meuble, boîte, objet. La même logique que ton appartement — et chaque niveau se retrouve tout seul depuis celui du dessus.',
        },
        {
          icon: 'search',
          tone: 'teal',
          title: 'Retrouve d’un mot',
          body: 'Tape « perceuse ». Céoù répond dans quelle boîte, dans quel meuble, dans quelle pièce, dans quel logement. Le chemin entier, pas juste un nom.',
        },
        {
          icon: 'mic',
          tone: 'mustard',
          title: 'Demande à voix haute',
          body: '« Où sont mes clés ? » Pose la question, l’assistant répond. Il peut même ranger un objet à ta place, sans que tu touches l’écran.',
        },
        {
          icon: 'plan',
          tone: 'sky',
          title: 'Le plan de ton logement',
          body: 'Dessine tes pièces, pose tes meubles dessus, retrouve un objet d’un coup d’œil. Et si tu préfères lire, le même plan existe en liste.',
        },
        {
          icon: 'scan',
          tone: 'blue',
          title: 'Photographie, scanne',
          body: 'Une photo par objet, pour reconnaître sans lire. Un code-barre pour retrouver un nom tout seul. Une photo de tiroir pour créer plusieurs objets d’un coup.',
        },
        {
          icon: 'loan',
          tone: 'teal',
          title: 'Prête sans oublier',
          body: 'Note à qui tu prêtes, et ce qu’on t’a prêté. Céoù te rappelle ce qui n’est pas revenu — l’objet, lui, garde sa place pour son retour.',
        },
      ],
    },

    detail: {
      title: 'Regarde de plus près',
      items: [
        {
          mock: 'plan',
          eyebrow: 'Le plan',
          title: 'Ton logement, vu de dessus',
          body: 'Trace tes pièces, pose tes meubles dessus. Les murs qui portent se dessinent épais, les cloisons fines, et les trous sont des portes — le plan ressemble à ce que tu as sous les pieds.',
          points: [
            'Les meubles se posent sur le plan et gardent leur place',
            'Le même plan se lit en liste, pièce par pièce, pour qui ne voit pas l’écran',
          ],
        },
        {
          mock: 'chat',
          eyebrow: 'L’assistant',
          title: 'Les mains prises, la question quand même',
          body: 'Un carton dans les bras, tu demandes à voix haute. Céoù comprend la question, et sait aussi ranger : « mets la perceuse dans la boîte à outils » suffit.',
          points: [
            'Rien n’est envoyé avant que tu aies dit oui, une fois, en connaissance de cause',
            'La politique de confidentialité dit exactement qui reçoit quoi',
          ],
        },
        {
          mock: 'loan',
          eyebrow: 'Les prêts',
          title: 'Ce qui est sorti de chez toi',
          body: 'Un objet prêté ne disparaît pas de l’inventaire : il garde sa place, marquée comme sortie, et la retrouve au retour. Tu vois d’un coup ce qui traîne chez les autres.',
          points: [
            'Ce que tu as prêté, et ce qu’on t’a prêté, au même endroit',
            'Un rappel quand la date de retour est passée',
          ],
        },
      ],
    },

    pillars: {
      title: 'Ce sur quoi on ne transige pas',
      items: [
        {
          icon: 'a11y',
          title: 'Pensé pour être lisible',
          body: 'Le texte grossit jusqu’à deux fois sans que rien ne se casse ni ne se tronque. Le plan se lit aussi en liste, pour qui ne voit pas l’écran ou ne peut pas le pincer. Thème sombre, grandes cibles, contrastes vérifiés un par un.',
        },
        {
          icon: 'offline',
          title: 'Marche sans réseau',
          body: 'Une cave, un garage, un box en sous-sol : Céoù continue de répondre sur ce qu’il sait déjà, enregistre ce que tu changes, et l’envoie tout seul au retour du réseau.',
        },
        {
          icon: 'shield',
          title: 'Tes données restent les tiennes',
          body: 'Hébergées dans l’Union européenne. Jamais vendues, jamais de publicité, jamais partagées au-delà de ce que tu choisis. Tout se supprime depuis l’application, définitivement.',
        },
      ],
      link: 'Lire la politique de confidentialité',
    },

    // OÙ EN EST CÉOÙ — LA FRISE EST TENUE À LA MAIN, dans les deux langues.
    //
    // Rien ne la met à jour toute seule : quand une étape change, changer son
    // `status`, réengendrer et redéployer. Une frise qui annonce « en cours »
    // ce qui est sorti depuis un mois dit surtout que le site est abandonné.
    //
    //   done  terminé     now  en cours     next  à venir
    progress: {
      eyebrow: 'Avancement',
      title: 'Où en est Céoù',
      lede: 'Céoù n’est pas encore sur les stores. Voici où on en est, et comment l’essayer avant tout le monde.',
      status: { done: 'Terminé', now: 'En cours', next: 'À venir' },
      stages: [
        {
          status: 'done',
          title: 'L’application est construite',
          body: 'Tout ce que décrit cette page existe déjà et fonctionne sur téléphone.',
        },
        {
          status: 'now',
          title: 'Les tests au quotidien',
          body: 'Céoù est utilisé chaque jour sur Android pour débusquer ce qui accroche encore. L’iPhone suivra.',
        },
        {
          status: 'now',
          title: 'Tes avis',
          body: 'Un questionnaire de cinq minutes pour fixer les dernières priorités avant la sortie.',
        },
        {
          status: 'next',
          title: 'La sortie',
          body: 'Sur le Play Store et l’App Store.',
        },
      ],
      invite: {
        title: 'Teste Céoù avant sa sortie',
        body: 'Réponds au questionnaire : cinq minutes pour dire ce qui te servirait, et ce qui manque. À la fin, laisse ton adresse si tu veux tester l’application — tu recevras une invitation dès qu’une version est prête.',
        cta: 'Répondre au questionnaire',
        note: 'Anonyme, sur Google Forms. Ton adresse n’est demandée que si tu veux tester.',
        notify: 'Pour être simplement prévenu de la sortie, écris à ' + CONTACT + '.',
      },
    },

    faq: {
      title: 'Questions fréquentes',
      items: [
        {
          q: 'Est-ce que Céoù coûte quelque chose ?',
          a: 'Il n’y a ni publicité, ni achat dans l’application. Rien de ce qui est décrit sur cette page n’est réservé à une formule payante.',
        },
        {
          q: 'Faut-il créer un compte ?',
          a: 'Pour ranger tes affaires, oui : c’est ce qui te permet de les retrouver depuis un autre téléphone, et de ne rien perdre si tu changes d’appareil. Pour seulement consulter ce que quelqu’un t’a partagé, non — un code d’invitation suffit.',
        },
        {
          q: 'Est-ce que ça marche sans réseau ?',
          a: 'Oui. Céoù répond sur ce qu’il sait déjà et enregistre ce que tu changes, même au fond d’une cave. Tout part au serveur tout seul quand le réseau revient.',
        },
        {
          q: 'Puis-je partager avec ma famille ?',
          a: 'Oui. Chacun a un code ami, qui ne change jamais : ton proche scanne le tien, et tu choisis ensuite quelles habitations tu lui ouvres. Rien n’est partagé avant ce choix.',
        },
        {
          q: 'Où sont mes données ?',
          a: 'Chez Supabase, dans l’Union européenne, à Stockholm. Deux fonctions font appel à des services hors Union — le scan photo et l’assistant vocal — et chacune te le demande avant, une fois, explicitement.',
        },
        {
          q: 'Puis-je tout supprimer ?',
          a: 'Oui, depuis l’application : Profil, puis « Mon compte », puis la suppression. Le compte et tout ce qu’il contient partent définitivement. La marche à suivre est aussi décrite sur cette page, pour qui n’a plus l’application.',
        },
        {
          q: 'Quand est-ce que ça sort ?',
          a: 'Céoù est en test sur Android, et se prépare pour le Play Store et l’App Store. Pour l’essayer avant sa sortie, réponds au questionnaire proposé sur ce site. Pour être simplement prévenu le jour venu, écris à ' + CONTACT + '.',
        },
      ],
    },

    // LES MAQUETTES DE LA SECTION « EN DETAIL ».
    //
    // Du texte et non des captures : une capture serait fausse au premier
    // changement d'interface, illisible sur un petit ecran, et muette pour
    // un lecteur d'ecran. Chaque bloc porte un role="img" et une phrase qui
    // dit ce qu'il montre — c'est elle qui est lue, pas les fragments.
    mocks: {
      plan: 'Un plan de logement vu de dessus : quatre pieces en pastel, les murs traces, les portes en creux, et un repere pose sur un meuble du salon.',
      chat: {
        label: 'Une conversation avec l’assistant. « Ou sont mes cles ? » — « Cles de voiture, Maison, Entree, Vide-poche. » Puis « Mets la perceuse dans la boite a outils » — « C’est range. »',
        lines: [
          { who: 'me', text: 'Où sont mes clés ?' },
          { who: 'app', name: 'Clés de voiture', path: 'Maison › Entrée › Vide-poche' },
          { who: 'me', text: 'Mets la perceuse dans la boîte à outils' },
          { who: 'app', name: 'C’est rangé.', path: 'Perceuse → Maison › Garage › Établi › Boîte à outils' },
        ],
      },
      loan: {
        label: 'La liste des prets : une perceuse pretee a Marc il y a douze jours, en cours ; une echelle empruntee a Lucie, dont le retour est depasse.',
        rows: [
          { initial: 'M', name: 'Perceuse', when: 'Prêtée à Marc, il y a 12 jours', tag: 'En cours', late: false },
          { initial: 'L', name: 'Échelle', when: 'Empruntée à Lucie', tag: 'Retour dépassé', late: true },
        ],
      },
    },

    cta: {
      title: 'Une question ?',
      body: 'Écris, on répond. C’est une petite équipe, et le courrier arrive vraiment.',
    },

    footer: {
      tagline: 'Céoù — sais toujours où sont tes affaires',
      privacy: 'Confidentialité',
      deletion: 'Supprimer mon compte',
      eu: 'Hébergé dans l’Union européenne',
      nav: 'Le site',
      legal: 'Légal',
      contactHeading: 'Contact',
    },

    // Repris sur les deux pages de politique, sous le texte juridique.
    contact: {
      heading: 'Contact',
      body: "Pour toute question sur tes données, ou pour exercer un droit d'accès, de rectification ou d'export : ",
    },
    docBack: 'Retour à l’accueil',
    docToc: 'Sur cette page',
  },

  en: {
    lang: 'en',
    ids: IDS.en,
    title: 'Céoù — always know where your things are',
    description:
      'Céoù remembers where you put your things, room by room, and tells you when you have forgotten. Works offline, no ads, hosted in the European Union.',
    switchLabel: 'Français',
    switchTitle: 'Lire cette page en français',
    skip: 'Skip to content',
    menu: { open: 'Open menu', close: 'Close menu' },
    nav: [
      { to: 'how', label: 'How it works' },
      { to: 'features', label: 'Features' },
      { to: 'pillars', label: 'Principles' },
      { to: 'progress', label: 'Progress' },
      { to: 'faq', label: 'FAQ' },
    ],
    navPrivacy: 'Privacy',

    announce: {
      label: 'Announcement',
      tag: 'Testing',
      text: 'Céoù is looking for its first testers: 5 minutes to share your thoughts.',
      cta: 'Take part',
      more: 'Where is Céoù at?',
    },

    hero: {
      pun: 'Céoù — French for “where is it?”',
      title: 'Put it away once. Find it every time.',
      body: 'Céoù remembers where you put your things — which room, which piece of furniture, which box — and tells you on the day you cannot remember.',
      badge: 'Coming soon to Android and iOS',
      note: 'No ads. Works offline. Hosted in the European Union.',
      cta: 'See what it does',
      mock: {
        label:
          'The Céoù search screen: the word “drill” has been typed, and the answer appears — Drill, in the toolbox, on the workbench, in the garage.',
        placeholder: 'Search for an item',
        query: 'drill',
        results: [
          { name: 'Drill', path: 'Home › Garage › Workbench › Toolbox' },
          { name: 'Masonry bits', path: 'Home › Garage › Workbench › Toolbox' },
        ],
      },
    },

    steps: {
      title: 'Three moves, and it is done',
      lede: 'You describe your home once. What you get back, you get back for years.',
      items: [
        {
          title: 'Describe your home',
          body: 'Once only: your rooms, your furniture, the boxes sitting inside them. Céoù mirrors the structure of your home, not a flat list where everything looks alike.',
        },
        {
          title: 'Put things away for real',
          body: 'The drill goes in the toolbox, on the workbench, in the garage. You say it once — by typing, out loud, or by photographing the whole drawer.',
        },
        {
          title: 'Ask, when the day comes',
          body: 'Six months later, type “drill”. Céoù gives you the whole path, from the home down to the box. No thinking, no digging.',
        },
      ],
      chainLabel: 'The Céoù hierarchy: Home, then Garage, then Workbench, then Toolbox, then Drill.',
      chain: ['Home', 'Garage', 'Workbench', 'Toolbox', 'Drill'],
    },

    features: {
      title: 'What Céoù does',
      lede: 'Everything is there the first time you open it. Nothing is held back, nothing unlocks later.',
      items: [
        {
          icon: 'home',
          tone: 'blue',
          title: 'Organised like your home',
          body: 'Home, room, furniture, box, item. The same logic as your flat — and every level is found from the one above it.',
        },
        {
          icon: 'search',
          tone: 'teal',
          title: 'Find it with one word',
          body: 'Type “drill”. Céoù answers which box, in which piece of furniture, in which room, in which home. The whole path, not just a name.',
        },
        {
          icon: 'mic',
          tone: 'mustard',
          title: 'Just ask out loud',
          body: '“Where are my keys?” Ask, and the assistant answers. It can even put an item away for you, without you touching the screen.',
        },
        {
          icon: 'plan',
          tone: 'sky',
          title: 'A plan of your home',
          body: 'Draw your rooms, place your furniture on them, spot an item at a glance. And if you would rather read, the same plan exists as a list.',
        },
        {
          icon: 'scan',
          tone: 'blue',
          title: 'Photograph, scan',
          body: 'A photo per item, to recognise without reading. A barcode to fetch a name on its own. A photo of a drawer to create several items at once.',
        },
        {
          icon: 'loan',
          tone: 'teal',
          title: 'Lend without forgetting',
          body: 'Record who you lent to, and what was lent to you. Céoù reminds you what has not come back — and the item keeps its place for its return.',
        },
      ],
    },

    detail: {
      title: 'A closer look',
      items: [
        {
          mock: 'plan',
          eyebrow: 'The plan',
          title: 'Your home, seen from above',
          body: 'Trace your rooms, place your furniture on them. Load-bearing walls are drawn thick, partitions thin, and the gaps are doors — the plan looks like what is under your feet.',
          points: [
            'Furniture sits on the plan and keeps its place',
            'The same plan reads as a list, room by room, for anyone who cannot see the screen',
          ],
        },
        {
          mock: 'chat',
          eyebrow: 'The assistant',
          title: 'Hands full, question all the same',
          body: 'A box in your arms, you ask out loud. Céoù understands the question, and can also put things away: “put the drill in the toolbox” is enough.',
          points: [
            'Nothing is sent before you have said yes, once, knowing what for',
            'The privacy policy says exactly who receives what',
          ],
        },
        {
          mock: 'loan',
          eyebrow: 'Loans',
          title: 'What has left your home',
          body: 'A lent item does not vanish from the inventory: it keeps its place, marked as out, and takes it back on return. You see at a glance what is still with other people.',
          points: [
            'What you lent, and what was lent to you, in the same place',
            'A reminder once the return date has passed',
          ],
        },
      ],
    },

    pillars: {
      title: 'What we will not trade away',
      items: [
        {
          icon: 'a11y',
          title: 'Built to be readable',
          body: 'Text grows to twice its size without breaking or truncating anything. The plan can also be read as a list, for anyone who cannot see the screen or pinch it. Dark theme, large targets, contrasts checked one by one.',
        },
        {
          icon: 'offline',
          title: 'Works without a network',
          body: 'A cellar, a garage, a basement storage unit: Céoù keeps answering from what it already knows, records what you change, and sends it on its own once the network is back.',
        },
        {
          icon: 'shield',
          title: 'Your data stays yours',
          body: 'Hosted in the European Union. Never sold, never used for advertising, never shared beyond what you choose. Everything can be deleted from the app, permanently.',
        },
      ],
      link: 'Read the privacy policy',
    },

    progress: {
      eyebrow: 'Progress',
      title: 'Where Céoù is at',
      lede: 'Céoù is not in the stores yet. Here is where things stand, and how to try it before everyone else.',
      status: { done: 'Done', now: 'In progress', next: 'Coming up' },
      stages: [
        {
          status: 'done',
          title: 'The app is built',
          body: 'Everything described on this page already exists and works on a phone.',
        },
        {
          status: 'now',
          title: 'Everyday testing',
          body: 'Céoù is used every day on Android to track down what still gets in the way. iPhone comes next.',
        },
        {
          status: 'now',
          title: 'Your feedback',
          body: 'A five-minute survey to settle the last priorities before release.',
        },
        {
          status: 'next',
          title: 'Release',
          body: 'On the Play Store and the App Store.',
        },
      ],
      invite: {
        title: 'Try Céoù before release',
        body: 'Take the survey: five minutes to say what would help you, and what is missing. At the end, leave your address if you would like to test the app — you will get an invitation as soon as a version is ready.',
        cta: 'Take the survey',
        // Le questionnaire n'existe qu'en français : le dire avant le clic
        // plutôt que de le laisser découvrir à l'arrivée.
        note: 'Anonymous, on Google Forms — in French for now. Your address is only asked for if you want to test.',
        notify: 'To simply hear about the release, write to ' + CONTACT + '.',
      },
    },

    faq: {
      title: 'Frequently asked questions',
      items: [
        {
          q: 'Does Céoù cost anything?',
          a: 'There are no ads and no in-app purchases. Nothing described on this page is reserved for a paid tier.',
        },
        {
          q: 'Do I need an account?',
          a: 'To put your own things away, yes: that is what lets you find them again from another phone, and lose nothing when you change device. To only look at what someone has shared with you, no — an invitation code is enough.',
        },
        {
          q: 'Does it work without a network?',
          a: 'Yes. Céoù answers from what it already knows and records what you change, even at the back of a cellar. Everything reaches the server on its own once the network is back.',
        },
        {
          q: 'Can I share with my family?',
          a: 'Yes. Everyone has a friend code, which never changes: they scan yours, and you then choose which homes to open to them. Nothing is shared before that choice.',
        },
        {
          q: 'Where is my data?',
          a: 'With Supabase, in the European Union, in Stockholm. Two features call on services outside the Union — the photo scan and the voice assistant — and each asks you first, once, explicitly.',
        },
        {
          q: 'Can I delete everything?',
          a: 'Yes, from the app: Profile, then “My account”, then delete. The account and everything in it go permanently. The steps are also written on this site, for anyone who no longer has the app.',
        },
        {
          q: 'When is it out?',
          a: 'Céoù is being tested on Android, and prepared for the Play Store and the App Store. To try it before release, take the survey offered on this site. To simply hear about release day, write to ' + CONTACT + '.',
        },
      ],
    },

    mocks: {
      plan: 'A home plan seen from above: four pastel rooms, the walls traced, the doors left as gaps, and a marker on a piece of furniture in the living room.',
      chat: {
        label: 'A conversation with the assistant. "Where are my keys?" — "Car keys, Home, Hallway, Key bowl." Then "Put the drill in the toolbox" — "Put away."',
        lines: [
          { who: 'me', text: 'Where are my keys?' },
          { who: 'app', name: 'Car keys', path: 'Home › Hallway › Key bowl' },
          { who: 'me', text: 'Put the drill in the toolbox' },
          { who: 'app', name: 'Put away.', path: 'Drill → Home › Garage › Workbench › Toolbox' },
        ],
      },
      loan: {
        label: 'The loans list: a drill lent to Marc twelve days ago, ongoing; a ladder borrowed from Lucie, now overdue.',
        rows: [
          { initial: 'M', name: 'Drill', when: 'Lent to Marc, 12 days ago', tag: 'Out', late: false },
          { initial: 'L', name: 'Ladder', when: 'Borrowed from Lucie', tag: 'Overdue', late: true },
        ],
      },
    },

    cta: {
      title: 'A question?',
      body: 'Write to us, we answer. It is a small team, and the mail really does arrive.',
    },

    footer: {
      tagline: 'Céoù — always know where your things are',
      privacy: 'Privacy',
      deletion: 'Delete my account',
      eu: 'Hosted in the European Union',
      nav: 'The site',
      legal: 'Legal',
      contactHeading: 'Contact',
    },

    contact: {
      heading: 'Contact',
      body: 'For any question about your data, or to exercise a right of access, correction or export: ',
    },
    docBack: 'Back to home',
    docToc: 'On this page',
  },
};
