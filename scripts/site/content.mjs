// Bilingual public copy. Privacy and tutorials are shared with the app; see scripts/site.md.
export const CONTACT = "contact@ceou.eu";

export const ORIGIN = "https://ceou.eu";

export const SURVEY = "https://forms.gle/ngUZoU7c9f6euFFp6";

export const FILES = {
  "home": {
    "fr": "index.html",
    "en": "en.html"
  },
  "privacy": {
    "fr": "confidentialite.html",
    "en": "privacy.html"
  },
  "tutorials": {
    "fr": "tutoriels.html",
    "en": "tutorials.html"
  }
};

export const DELETION_ANCHOR = {
  "fr": "suppression-de-compte",
  "en": "account-deletion"
};

export const OTHER = {
  "fr": "en",
  "en": "fr"
};

export const SITE = {
  "fr": {
    "lang": "fr",
    "ids": {
      "how": "comment",
      "features": "fonctionnalites",
      "detail": "en-detail",
      "pillars": "engagements",
      "progress": "avancement",
      "faq": "questions",
      "plans": "formules"
    },
    "title": "Céoù — retrouve tes affaires, simplement",
    "description": "Retrouve tes objets, repère-les sur le plan de ton logement et prépare tes cartons. Céoù, l’inventaire qui te simplifie la vie. En test sur Android.",
    "switchLabel": "English",
    "switchTitle": "Read this page in English",
    "skip": "Aller au contenu",
    "menu": {
      "open": "Ouvrir le menu",
      "close": "Fermer le menu"
    },
    "nav": [
      {
        "to": "features",
        "label": "L’application"
      },
      {
        "to": "plans",
        "label": "Gratuit & Plus"
      },
      {
        "page": "tutorials",
        "label": "Tutoriels"
      },
      {
        "to": "progress",
        "label": "La bêta"
      },
      {
        "to": "faq",
        "label": "Questions"
      }
    ],
    "navPrivacy": "Confidentialité",
    "announce": {
      "label": "Annonce",
      "tag": "En test",
      "text": "Céoù se prépare à sortir. Aide-nous à peaufiner l’application.",
      "cta": "Je participe",
      "more": "Où en est Céoù ?"
    },
    "hero": {
      "pun": "Céoù, comme « c’est où ? »",
      "title": "Moins chercher.\nMieux profiter.",
      "body": "Les piles de rechange, les papiers du vélo, ce fameux câble… Note où tu les ranges. Céoù te guide jusqu’à la bonne boîte, même quand tu as oublié laquelle.",
      "badge": "Participer aux tests Android",
      "note": "Inventaire · Plans interactifs · Déménagements",
      "cta": "Découvrir Céoù",
      "mock": {
        "label": "L’écran de recherche de Céoù : le mot « perceuse » est tapé, et la réponse s’affiche — Perceuse, dans la boîte à outils, sur l’établi, au garage.",
        "placeholder": "Chercher un objet",
        "query": "perceuse",
        "results": [
          {
            "name": "Perceuse",
            "path": "Maison › Garage › Établi › Boîte à outils"
          }
        ],
        "found": "Trouvée. Et sans retourner le garage.",
        "planTitle": "Un repère, au bon endroit"
      },
      "eyebrow": "Tes affaires ont une place. Retrouve-la."
    },
    "steps": {
      "title": "Trois gestes, et c’est réglé",
      "lede": "Commence par ce que tu cherches souvent. Le reste peut attendre.",
      "items": [
        {
          "title": "Crée ton premier lieu",
          "body": "Un appartement, une maison ou un garage. Ajoute une pièce et un rangement : inutile de tout inventorier d’un coup."
        },
        {
          "title": "Ajoute quelques objets",
          "body": "Un nom, une place, une photo si tu veux. Le scan photo et les codes-barres peuvent t’aider à aller plus vite."
        },
        {
          "title": "Retrouve-les sans fouiller",
          "body": "Tape un nom ou demande à Céoù. Le chemin s’affiche, du logement jusqu’à la boîte. Mets-le à jour quand tu déplaces l’objet."
        }
      ],
      "chainLabel": "La hiérarchie de Céoù : Maison, puis Garage, puis Établi, puis Boîte à outils, puis Perceuse.",
      "chain": [
        "Maison",
        "Garage",
        "Établi",
        "Boîte à outils",
        "Perceuse"
      ]
    },
    "tutorials": {
      "title": "Tutoriels — Céoù",
      "description": "Bien démarrer avec Céoù : inventaire, plans, assistant, factures, prêts, cartons et partages. Des explications courtes, pas à pas.",
      "eyebrow": "Tutoriels",
      "heading": "Céoù, pas à pas",
      "lede": "Commence par le premier chapitre ou va directement à ce qui t’intéresse. Les exemples illustrent les fonctions de l’application ; leur apparence peut évoluer pendant les tests.",
      "toc": "Sommaire",
      "chapter": "Chapitre {n} sur {total}",
      "backToToc": "Revenir au sommaire",
      "featuresLink": "Voir chaque fonctionnalité pas à pas",
      "cta": {
        "title": "Envie de l’essayer ?",
        "body": "Céoù n’est pas encore sorti. Réponds au questionnaire : cinq minutes, et tu peux laisser ton adresse pour tester l’application avant tout le monde."
      }
    },
    "features": {
      "title": "Ce que Céoù sait faire",
      "lede": "Pour les petites recherches du quotidien… et les grands cartons du départ.",
      "items": [
        {
          "icon": "home",
          "tone": "blue",
          "title": "Range comme chez toi",
          "body": "Logement, pièce, meuble, boîte, objet. La même logique que ton appartement — et chaque niveau se retrouve tout seul depuis celui du dessus."
        },
        {
          "icon": "search",
          "tone": "teal",
          "title": "Retrouve d’un mot",
          "body": "Tape « perceuse ». Céoù répond dans quelle boîte, dans quel meuble, dans quelle pièce, dans quel logement. Le chemin entier, pas juste un nom."
        },
        {
          "icon": "mic",
          "tone": "mustard",
          "title": "Demande à Céoù",
          "body": "« Où est la perceuse ? » L’assistant vocal cherche dans ton inventaire. Tu peux aussi lui demander d’enregistrer un déplacement."
        },
        {
          "icon": "plan",
          "tone": "sky",
          "title": "Le plan de ton logement",
          "body": "Dessine tes pièces, pose tes meubles dessus, retrouve un objet d’un coup d’œil. Et si tu préfères lire, le même plan existe en liste."
        },
        {
          "icon": "scan",
          "tone": "blue",
          "title": "Photographie, scanne",
          "body": "Garde une photo pour reconnaître tes objets. Avec l’IA, repère plusieurs objets dans une image, puis vérifie les suggestions avant de les ajouter."
        },
        {
          "icon": "loan",
          "tone": "teal",
          "title": "Prête sans oublier",
          "body": "Note à qui tu prêtes, et ce qu’on t’a prêté. Céoù te rappelle ce qui n’est pas revenu — l’objet, lui, garde sa place pour son retour."
        },
        {
          "icon": "box",
          "tone": "sky",
          "title": "Des cartons qui se racontent",
          "body": "Prépare ton déménagement, répartis les objets et scanne le QR d’un carton pour voir ce qu’il contient. Le tire-bouchon ne se perdra plus parmi les livres."
        },
        {
          "icon": "people",
          "tone": "blue",
          "title": "À chacun le bon accès",
          "body": "Partage les lieux de ton choix avec tes proches, en consultation ou en modification. Pour un déménagement, c’est toi qui décides de le partager."
        },
        {
          "icon": "receipt",
          "tone": "teal",
          "title": "Les factures, au bon endroit",
          "body": "Associe les justificatifs à tes objets et retrouve les informations de garantie. Un dossier utile le jour où tu en as besoin."
        }
      ]
    },
    "detail": {
      "title": "Regarde de plus près",
      "items": [
        {
          "mock": "plan",
          "eyebrow": "Le plan",
          "title": "Un plan pour vraiment te repérer",
          "body": "Dessine les pièces, place les rangements et retrouve-les visuellement. Depuis la fiche d’un objet, ouvre son emplacement sur le plan : tu sais tout de suite où chercher.",
          "points": [
            "Plusieurs plans pour les différents étages",
            "Zoom, repères et vue en liste pour choisir ta façon d’explorer"
          ]
        },
        {
          "mock": "chat",
          "eyebrow": "L’assistant",
          "title": "Une question, à voix haute",
          "body": "Les mains occupées ? Ouvre « Demande à Céoù » et parle naturellement. L’assistant peut rechercher un objet ou mettre à jour son rangement.",
          "points": [
            "L’IA s’utilise avec ton accord et une connexion Internet",
            "Un quota de conversation indiqué dans ton forfait"
          ]
        },
        {
          "mock": "loan",
          "eyebrow": "Les prêts",
          "title": "Ce qui est sorti de chez toi",
          "body": "Un objet prêté ne disparaît pas de l’inventaire : il garde sa place, marquée comme sortie, et la retrouve au retour. Tu vois d’un coup ce qui traîne chez les autres.",
          "points": [
            "Ce que tu as prêté, et ce qu’on t’a prêté, au même endroit",
            "Un rappel quand la date de retour est passée"
          ]
        }
      ]
    },
    "pillars": {
      "title": "Simple à utiliser. Clair sur tes choix.",
      "items": [
        {
          "icon": "a11y",
          "title": "À ta façon",
          "body": "Texte agrandi, mode clair ou sombre, navigation adaptée aux lecteurs d’écran et alternative en liste pour les plans."
        },
        {
          "icon": "offline",
          "title": "Utile même sans réseau",
          "body": "Consulte l’inventaire déjà synchronisé sur ton téléphone. L’IA, les achats et les publicités ont besoin d’Internet ; certaines modifications aussi."
        },
        {
          "icon": "shield",
          "title": "Tu gardes la main",
          "body": "Choisis tes partages et l’utilisation de l’IA. Les publicités avec récompense sont volontaires. Ton inventaire n’est pas envoyé aux services publicitaires."
        }
      ],
      "link": "Lire la politique de confidentialité"
    },
    "progress": {
      "eyebrow": "Avancement",
      "title": "Où en est Céoù",
      "lede": "L’application se teste sur Android. La sortie sur Google Play est en préparation ; aucune date n’est encore annoncée.",
      "status": {
        "done": "Terminé",
        "now": "En cours",
        "next": "À venir"
      },
      "stages": [
        {
          "status": "done",
          "title": "L’application est construite",
          "body": "Inventaire, plans, prêts, factures et déménagements sont intégrés."
        },
        {
          "status": "now",
          "title": "Les tests au quotidien",
          "body": "Céoù est utilisé chaque jour sur Android pour débusquer ce qui accroche encore. L’iPhone suivra."
        },
        {
          "status": "now",
          "title": "Forfaits et bonus IA",
          "body": "Nous vérifions les quotas, les achats et les publicités volontaires avant leur ouverture au public."
        },
        {
          "status": "next",
          "title": "La sortie",
          "body": "Google Play en premier. La version iPhone viendra dans un second temps."
        }
      ],
      "invite": {
        "title": "Teste Céoù avant sa sortie",
        "body": "Réponds au questionnaire : cinq minutes pour dire ce qui te servirait, et ce qui manque. À la fin, laisse ton adresse si tu veux tester l’application — tu recevras une invitation dès qu’une version est prête.",
        "cta": "Répondre au questionnaire",
        "note": "Questionnaire sur Google Forms. Laisse ton adresse seulement si tu souhaites être recontacté.",
        "notify": "Pour être simplement prévenu de la sortie, écris à contact@ceou.eu."
      }
    },
    "faq": {
      "title": "Questions fréquentes",
      "items": [
        {
          "q": "Est-ce que Céoù coûte quelque chose ?",
          "a": "Céoù prépare une formule gratuite et un abonnement Plus, avec davantage de lieux, d’objets et d’IA. Les quotas sont en test et le tarif de Plus n’est pas encore annoncé. Des publicités volontaires permettront d’obtenir des analyses photo supplémentaires."
        },
        {
          "q": "Faut-il créer un compte ?",
          "a": "Pour ranger tes affaires, oui : c’est ce qui te permet de les retrouver depuis un autre téléphone, et de ne rien perdre si tu changes d’appareil. Pour seulement consulter ce que quelqu’un t’a partagé, non — un code d’invitation suffit."
        },
        {
          "q": "Est-ce que ça marche sans réseau ?",
          "a": "Tu peux consulter l’inventaire déjà synchronisé sur ton téléphone. Une connexion reste nécessaire pour l’IA, les partages à jour, les achats et les publicités. Certaines modifications demandent aussi du réseau."
        },
        {
          "q": "Puis-je partager avec ma famille ?",
          "a": "Oui. Ajoute tes proches avec leur code ami, puis choisis les lieux accessibles et les droits de chacun. Un déménagement n’est partagé que si tu actives cette option."
        },
        {
          "q": "Où sont mes données ?",
          "a": "Ton inventaire est stocké chez Supabase, dans la région européenne configurée pour Céoù. L’IA, les achats, les notifications et les publicités facultatives utilisent aussi des prestataires, dont certains traitements ont lieu hors de l’Union européenne. La politique de confidentialité détaille ces échanges."
        },
        {
          "q": "Puis-je tout supprimer ?",
          "a": "Tu peux supprimer ton compte dans Profil → Mon compte, ou écrire à contact@ceou.eu sans avoir l’application. La page Confidentialité décrit les données supprimées et les exceptions. Un abonnement Google Play doit être résilié séparément."
        },
        {
          "q": "Quand est-ce que ça sort ?",
          "a": "Céoù est en test sur Android. Google Play sera la première étape, puis l’iPhone. Aucune date n’est fixée. Le questionnaire du site permet de proposer ta participation aux tests."
        }
      ]
    },
    "mocks": {
      "plan": "Un plan vu de dessus : quatre pièces nommées et un repère sur l’établi du garage, où se trouve la perceuse.",
      "chat": {
        "label": "Une conversation avec l’assistant. « Ou sont mes cles ? » — « Cles de voiture, Maison, Entree, Vide-poche. » Puis « Mets la perceuse dans la boite a outils » — « C’est range. »",
        "lines": [
          {
            "who": "me",
            "text": "Où sont mes clés ?"
          },
          {
            "who": "app",
            "name": "Clés de voiture",
            "path": "Maison › Entrée › Vide-poche"
          },
          {
            "who": "me",
            "text": "Mets la perceuse dans la boîte à outils"
          },
          {
            "who": "app",
            "name": "C’est rangé.",
            "path": "Perceuse → Maison › Garage › Établi › Boîte à outils"
          }
        ]
      },
      "loan": {
        "label": "La liste des prets : une perceuse pretee a Marc il y a douze jours, en cours ; une echelle empruntee a Lucie, dont le retour est depasse.",
        "rows": [
          {
            "initial": "M",
            "name": "Perceuse",
            "when": "Prêtée à Marc, il y a 12 jours",
            "tag": "En cours",
            "late": false
          },
          {
            "initial": "L",
            "name": "Échelle",
            "when": "Empruntée à Lucie",
            "tag": "Retour dépassé",
            "late": true
          }
        ]
      }
    },
    "cta": {
      "title": "Une question ?",
      "body": "Une idée, une hésitation ou un retour de test ? Écris à Antony, le créateur de Céoù."
    },
    "footer": {
      "tagline": "Moins chercher. Mieux profiter.",
      "privacy": "Confidentialité",
      "deletion": "Supprimer mon compte",
      "eu": "Créé par Antony Monreal · En test sur Android",
      "nav": "Le site",
      "legal": "Légal",
      "contactHeading": "Contact"
    },
    "contact": {
      "heading": "Contact",
      "body": "Pour toute question sur tes données, ou pour exercer un droit d'accès, de rectification ou d'export : "
    },
    "docBack": "Retour à l’accueil",
    "docToc": "Sur cette page",
    "plans": {
      "eyebrow": "Gratuit & Plus",
      "title": "De la place pour commencer.\nPlus, quand tu en as besoin.",
      "lede": "Deux formules en préparation. Les limites ci-dessous servent aux tests et pourront évoluer avant la sortie.",
      "columns": [
        "Inclus",
        "Céoù Gratuit",
        "Céoù Plus"
      ],
      "rows": [
        [
          "Lieux possédés",
          "2",
          "10"
        ],
        [
          "Objets",
          "150",
          "3 000"
        ],
        [
          "Analyses photo / mois",
          "5",
          "50"
        ],
        [
          "Conversation vocale / mois",
          "5 min",
          "30 min"
        ]
      ],
      "note": "Les lieux reçus en partage ne consomment pas ton quota de lieux. Le prix de Plus sera annoncé avant la commercialisation.",
      "rewardTitle": "Un coup de pouce, si tu le choisis",
      "rewardBody": "Le bonus testé : une publicité regardée jusqu’à la récompense donne 2 analyses photo supplémentaires, dans la limite de 5 publicités par jour. Ces bonus expirent à la fin du mois. Aucune publicité ne se lance pendant que tu ranges ou recherches un objet.",
      "status": "Formules et publicités en phase de test"
    },
    "docSummary": {
      "title": "L’essentiel, en un coup d’œil",
      "points": [
        "Ton inventaire sert à retrouver et gérer tes affaires.",
        "Tu choisis tes partages, l’IA et les publicités avec récompense.",
        "Pour tes données ou une suppression : contact@ceou.eu."
      ],
      "sourcesTitle": "Les politiques de nos prestataires"
    }
  },
  "en": {
    "lang": "en",
    "ids": {
      "how": "how-it-works",
      "features": "features",
      "detail": "in-detail",
      "pillars": "principles",
      "progress": "progress",
      "faq": "faq",
      "plans": "plans"
    },
    "title": "Céoù — find your things, simply",
    "description": "Find your things, locate them on your floor plan and organise your moving boxes. Céoù makes your home inventory useful every day. Testing on Android.",
    "switchLabel": "Français",
    "switchTitle": "Lire cette page en français",
    "skip": "Skip to content",
    "menu": {
      "open": "Open menu",
      "close": "Close menu"
    },
    "nav": [
      {
        "to": "features",
        "label": "The app"
      },
      {
        "to": "plans",
        "label": "Free & Plus"
      },
      {
        "page": "tutorials",
        "label": "Tutorials"
      },
      {
        "to": "progress",
        "label": "The beta"
      },
      {
        "to": "faq",
        "label": "Questions"
      }
    ],
    "navPrivacy": "Privacy",
    "announce": {
      "label": "Announcement",
      "tag": "Testing",
      "text": "Céoù is getting ready to launch. Help us put the finishing touches on it.",
      "cta": "Take part",
      "more": "Where is Céoù at?"
    },
    "hero": {
      "pun": "Céoù — French for “where is it?”",
      "title": "Less searching.\nMore living.",
      "body": "Spare batteries, bike paperwork, that one cable… Save where you put them. Céoù takes you to the right box, even when you’ve forgotten which one.",
      "badge": "Join the Android tests",
      "note": "Home inventory · Interactive plans · Moving boxes",
      "cta": "Explore Céoù",
      "mock": {
        "label": "The Céoù search screen: the word “drill” has been typed, and the answer appears — Drill, in the toolbox, on the workbench, in the garage.",
        "placeholder": "Search for an item",
        "query": "drill",
        "results": [
          {
            "name": "Drill",
            "path": "Home › Garage › Workbench › Toolbox"
          }
        ],
        "found": "Found it. Without turning the garage upside down.",
        "planTitle": "A marker, in the right place"
      },
      "eyebrow": "Everything has a place. Find it again."
    },
    "steps": {
      "title": "Three moves, and it is done",
      "lede": "Start with the things you often look for. The rest can wait.",
      "items": [
        {
          "title": "Create your first place",
          "body": "A flat, a house or a garage. Add a room and a storage spot: there’s no need to catalogue everything at once."
        },
        {
          "title": "Add a few things",
          "body": "A name, a location, a photo if you like. Photo analysis and barcodes can help you get started faster."
        },
        {
          "title": "Find them without rummaging",
          "body": "Type a name or ask Céoù. Follow the path from your home to the right box. Update it when you move the item."
        }
      ],
      "chainLabel": "The Céoù hierarchy: Home, then Garage, then Workbench, then Toolbox, then Drill.",
      "chain": [
        "Home",
        "Garage",
        "Workbench",
        "Toolbox",
        "Drill"
      ]
    },
    "tutorials": {
      "title": "Tutorials — Céoù",
      "description": "Get started with Céoù: inventory, floor plans, assistant, receipts, loans, moving boxes and sharing. Clear, step-by-step guides.",
      "eyebrow": "Tutorials",
      "heading": "Céoù, step by step",
      "lede": "Start with the first chapter or jump to what interests you. The examples illustrate the app’s features; their appearance may change during testing.",
      "toc": "Contents",
      "chapter": "Chapter {n} of {total}",
      "backToToc": "Back to contents",
      "featuresLink": "See every feature step by step",
      "cta": {
        "title": "Want to try it?",
        "body": "Céoù is not out yet. Take the survey — in French for now: five minutes, and you can leave your address to test the app before everyone else."
      }
    },
    "features": {
      "title": "What Céoù does",
      "lede": "For everyday searches… and the big boxes on moving day.",
      "items": [
        {
          "icon": "home",
          "tone": "blue",
          "title": "Organised like your home",
          "body": "Home, room, furniture, box, item. The same logic as your flat — and every level is found from the one above it."
        },
        {
          "icon": "search",
          "tone": "teal",
          "title": "Find it with one word",
          "body": "Type “drill”. Céoù answers which box, in which piece of furniture, in which room, in which home. The whole path, not just a name."
        },
        {
          "icon": "mic",
          "tone": "mustard",
          "title": "Ask Céoù",
          "body": "“Where’s the drill?” The voice assistant searches your inventory. You can also ask it to record where you’ve moved an item."
        },
        {
          "icon": "plan",
          "tone": "sky",
          "title": "A plan of your home",
          "body": "Draw your rooms, place your furniture on them, spot an item at a glance. And if you would rather read, the same plan exists as a list."
        },
        {
          "icon": "scan",
          "tone": "blue",
          "title": "Photograph, scan",
          "body": "Keep photos to recognise your things. AI can spot several items in one image; review the suggestions before adding them."
        },
        {
          "icon": "loan",
          "tone": "teal",
          "title": "Lend without forgetting",
          "body": "Record who you lent to, and what was lent to you. Céoù reminds you what has not come back — and the item keeps its place for its return."
        },
        {
          "icon": "box",
          "tone": "sky",
          "title": "Know what’s in each box",
          "body": "Plan your move, pack your items and scan a box’s QR label to see its contents. No more hunting for the corkscrew among the books."
        },
        {
          "icon": "people",
          "tone": "blue",
          "title": "Share on your terms",
          "body": "Choose which places to share with friends, and whether they can view or edit them. Sharing a move is a separate choice."
        },
        {
          "icon": "receipt",
          "tone": "teal",
          "title": "Receipts where you need them",
          "body": "Link receipts to your items and keep warranty information together. A useful record when something needs fixing."
        }
      ]
    },
    "detail": {
      "title": "A closer look",
      "items": [
        {
          "mock": "plan",
          "eyebrow": "The plan",
          "title": "A floor plan that helps you find things",
          "body": "Draw your rooms, place your storage and find it visually. Open an item’s location on the plan from its details: you know where to look.",
          "points": [
            "Separate plans for different floors",
            "Zoom, markers and a list view to explore your way"
          ]
        },
        {
          "mock": "chat",
          "eyebrow": "The assistant",
          "title": "Just ask out loud",
          "body": "Hands busy? Open “Ask Céoù” and speak naturally. The assistant can look for an item or update where you keep it.",
          "points": [
            "AI requires your consent and an Internet connection",
            "Your plan shows your conversation allowance"
          ]
        },
        {
          "mock": "loan",
          "eyebrow": "Loans",
          "title": "What has left your home",
          "body": "A lent item does not vanish from the inventory: it keeps its place, marked as out, and takes it back on return. You see at a glance what is still with other people.",
          "points": [
            "What you lent, and what was lent to you, in the same place",
            "A reminder once the return date has passed"
          ]
        }
      ]
    },
    "pillars": {
      "title": "Easy to use. Clear about your choices.",
      "items": [
        {
          "icon": "a11y",
          "title": "Make it yours",
          "body": "Larger text, light and dark themes, screen reader support and a list alternative to floor plans."
        },
        {
          "icon": "offline",
          "title": "Useful without a signal",
          "body": "Browse the inventory already synced to your phone. AI, purchases and ads need Internet access, as do some changes."
        },
        {
          "icon": "shield",
          "title": "You stay in control",
          "body": "Choose your sharing settings and whether to use AI. Rewarded ads are optional. Your inventory is not sent to advertising services."
        }
      ],
      "link": "Read the privacy policy"
    },
    "progress": {
      "eyebrow": "Progress",
      "title": "Where Céoù is at",
      "lede": "The app is being tested on Android. A Google Play launch is in preparation; no release date has been announced yet.",
      "status": {
        "done": "Done",
        "now": "In progress",
        "next": "Coming up"
      },
      "stages": [
        {
          "status": "done",
          "title": "The app is built",
          "body": "Inventory, plans, loans, receipts and moving boxes are implemented."
        },
        {
          "status": "now",
          "title": "Everyday testing",
          "body": "Céoù is used every day on Android to track down what still gets in the way. iPhone comes next."
        },
        {
          "status": "now",
          "title": "Plans and AI extras",
          "body": "We’re checking allowances, purchases and optional ads before making them publicly available."
        },
        {
          "status": "next",
          "title": "Release",
          "body": "Google Play first. An iPhone version will follow later."
        }
      ],
      "invite": {
        "title": "Try Céoù before release",
        "body": "Take the survey: five minutes to say what would help you, and what is missing. At the end, leave your address if you would like to test the app — you will get an invitation as soon as a version is ready.",
        "cta": "Take the survey",
        "note": "Survey hosted on Google Forms, currently in French. Leave your email only if you want us to contact you.",
        "notify": "To simply hear about the release, write to contact@ceou.eu."
      }
    },
    "faq": {
      "title": "Frequently asked questions",
      "items": [
        {
          "q": "Does Céoù cost anything?",
          "a": "Céoù is preparing a free plan and a Plus subscription with higher inventory and AI allowances. The limits are being tested and Plus pricing has not been announced yet. Optional ads will provide extra photo analyses."
        },
        {
          "q": "Do I need an account?",
          "a": "To put your own things away, yes: that is what lets you find them again from another phone, and lose nothing when you change device. To only look at what someone has shared with you, no — an invitation code is enough."
        },
        {
          "q": "Does it work without a network?",
          "a": "You can browse inventory already synced to your phone. AI, up-to-date sharing, purchases and ads need a connection. Some changes also require network access."
        },
        {
          "q": "Can I share with my family?",
          "a": "Yes. Add friends with their friend code, then choose which places they can access and their permissions. A move is only shared when you enable that option."
        },
        {
          "q": "Where is my data?",
          "a": "Your inventory is stored with Supabase in the European region configured for Céoù. AI, purchases, notifications and optional ads also use service providers, with some processing outside the EU. The privacy policy explains these exchanges."
        },
        {
          "q": "Can I delete everything?",
          "a": "Delete your account under Profile → My account, or email contact@ceou.eu without the app. The Privacy page explains what is deleted and the exceptions. A Google Play subscription must be cancelled separately."
        },
        {
          "q": "When is it out?",
          "a": "Céoù is being tested on Android. Google Play comes first, then iPhone. There is no fixed date yet. Use the survey on this site to express interest in testing."
        }
      ]
    },
    "mocks": {
      "plan": "A floor plan with four labelled rooms and a marker on the garage workbench, where the drill is stored.",
      "chat": {
        "label": "A conversation with the assistant. \"Where are my keys?\" — \"Car keys, Home, Hallway, Key bowl.\" Then \"Put the drill in the toolbox\" — \"Put away.\"",
        "lines": [
          {
            "who": "me",
            "text": "Where are my keys?"
          },
          {
            "who": "app",
            "name": "Car keys",
            "path": "Home › Hallway › Key bowl"
          },
          {
            "who": "me",
            "text": "Put the drill in the toolbox"
          },
          {
            "who": "app",
            "name": "Put away.",
            "path": "Drill → Home › Garage › Workbench › Toolbox"
          }
        ]
      },
      "loan": {
        "label": "The loans list: a drill lent to Marc twelve days ago, ongoing; a ladder borrowed from Lucie, now overdue.",
        "rows": [
          {
            "initial": "M",
            "name": "Drill",
            "when": "Lent to Marc, 12 days ago",
            "tag": "Out",
            "late": false
          },
          {
            "initial": "L",
            "name": "Ladder",
            "when": "Borrowed from Lucie",
            "tag": "Overdue",
            "late": true
          }
        ]
      }
    },
    "cta": {
      "title": "A question?",
      "body": "An idea, a question or feedback from testing? Write to Antony, the creator of Céoù."
    },
    "footer": {
      "tagline": "Less searching. More living.",
      "privacy": "Privacy",
      "deletion": "Delete my account",
      "eu": "Created by Antony Monreal · Testing on Android",
      "nav": "The site",
      "legal": "Legal",
      "contactHeading": "Contact"
    },
    "contact": {
      "heading": "Contact",
      "body": "For any question about your data, or to exercise a right of access, correction or export: "
    },
    "docBack": "Back to home",
    "docToc": "On this page",
    "plans": {
      "eyebrow": "Free & Plus",
      "title": "Room to get started.\nMore when you need it.",
      "lede": "Two plans in preparation. These allowances are being tested and may change before release.",
      "columns": [
        "Included",
        "Céoù Free",
        "Céoù Plus"
      ],
      "rows": [
        [
          "Places you own",
          "2",
          "10"
        ],
        [
          "Items",
          "150",
          "3,000"
        ],
        [
          "Photo analyses / month",
          "5",
          "50"
        ],
        [
          "Voice conversation / month",
          "5 min",
          "30 min"
        ]
      ],
      "note": "Places shared with you do not count towards your place allowance. Plus pricing will be announced before subscriptions go on sale.",
      "rewardTitle": "A little extra, when you choose",
      "rewardBody": "The reward being tested: watch an ad through to its reward to receive 2 extra photo analyses, up to 5 ads per day. These credits expire at the end of the month. No ad starts while you’re organising or searching for an item.",
      "status": "Plans and ads are currently being tested"
    },
    "docSummary": {
      "title": "The essentials at a glance",
      "points": [
        "Your inventory helps you find and manage your things.",
        "You choose your sharing settings, AI and rewarded ads.",
        "For data requests or account deletion: contact@ceou.eu."
      ],
      "sourcesTitle": "Our providers’ privacy information"
    }
  }
};
