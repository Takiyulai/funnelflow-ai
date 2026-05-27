// lib/funnels/pageGenerator.ts
import type {
  FunnelBrief,
  FunnelKind,
  FunnelPage,
  FunnelSection,
  FunnelSectionType,
  Language,
  PageRole,
} from "@/lib/funnels/types";
import { makePageId } from "@/lib/funnels/types";
import type { PageBlueprint } from "@/lib/funnels/pageCatalogs";

// ─────────────────────────────────────────────────────────────────────────────
// blueprintName — résolution multilingue du nom de page
// (auparavant importé depuis pageCatalogs, désormais inline)
// ─────────────────────────────────────────────────────────────────────────────

function blueprintName(bp: PageBlueprint, _lang: Language): string {
  // Pour l'instant on retourne le name interne du blueprint.
  // À évoluer plus tard si on veut une localisation complète.
  return bp.name;
}

// ─────────────────────────────────────────────────────────────────────────────
// normalizePageSlug — empêche les "/" parasites en début/fin de slug
// ─────────────────────────────────────────────────────────────────────────────

export function normalizePageSlug(raw: string, isHome: boolean): string {
  if (isHome) return "/";
  const cleaned = (raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "page";
}

// ─────────────────────────────────────────────────────────────────────────────
// filterSectionsByBlueprint — anti-section-fantôme
// ─────────────────────────────────────────────────────────────────────────────

export function filterSectionsByBlueprint(
  sections: FunnelSection[],
  blueprint: PageBlueprint,
): FunnelSection[] {
  const allowed = new Set<FunnelSectionType>(
    (blueprint.allowedSectionTypes ?? blueprint.defaultSectionTypes) as FunnelSectionType[],
  );
  return sections.filter((s) => allowed.has(s.type));
}

// ─────────────────────────────────────────────────────────────────────────────
// 🆕 PAGE_COPY — Titres et bodies conversion-first par funnelKind × role × langue
// ─────────────────────────────────────────────────────────────────────────────

type SectionTemplate = {
  type: FunnelSectionType;
  eyebrow: string;
  headline: string;
  subheadline?: string;
  body?: string;
  bullets?: string[];
  ctaLabel?: string;
};

type RoleCopy = {
  fr: SectionTemplate[];
  en: SectionTemplate[];
  es: SectionTemplate[];
};

type PageCopyMap = Partial<Record<FunnelKind, Partial<Record<PageRole, RoleCopy>>>>;

const PAGE_COPY: PageCopyMap = {
  // ─── LEAD MAGNET ──────────────────────────────────────────────────────────
  "lead-magnet": {
    thankyou: {
      fr: [
        {
          type: "hero",
          eyebrow: "INSCRIPTION CONFIRMÉE",
          headline: "Merci ! Votre ressource arrive dans votre boîte mail",
          subheadline: "Vérifiez votre boîte de réception dans les 2 prochaines minutes.",
          body: "Nous venons de vous envoyer votre ressource gratuite par email. Si vous ne la voyez pas, pensez à regarder dans vos spams ou promotions, et à ajouter notre adresse à vos contacts pour ne rien manquer.",
        },
        {
          type: "process",
          eyebrow: "VOS PROCHAINES ÉTAPES",
          headline: "Voici ce qu'il vous reste à faire",
          bullets: [
            "Ouvrez votre boîte mail dans les 2 minutes",
            "Cherchez l'email avec votre ressource",
            "Vérifiez vos spams si besoin",
            "Ajoutez-nous à vos contacts pour les prochains envois",
          ],
        },
        {
          type: "faq",
          eyebrow: "QUESTIONS FRÉQUENTES",
          headline: "Vous n'avez pas reçu l'email ?",
          body: "Patientez 5 minutes, puis vérifiez vos spams. Si vous ne trouvez toujours rien, contactez-nous et nous renverrons votre ressource manuellement.",
        },
        {
          type: "cta",
          eyebrow: "EN ATTENDANT",
          headline: "Ouvrez votre boîte mail maintenant",
          body: "Votre ressource gratuite vous attend.",
          ctaLabel: "Ouvrir Gmail",
        },
      ],
      en: [
        {
          type: "hero",
          eyebrow: "REGISTRATION CONFIRMED",
          headline: "Thank you! Your resource is on its way to your inbox",
          subheadline: "Check your inbox within the next 2 minutes.",
          body: "We just sent your free resource by email. If you don't see it, check your spam or promotions folder, and add our address to your contacts so you don't miss anything.",
        },
        {
          type: "process",
          eyebrow: "YOUR NEXT STEPS",
          headline: "Here's what to do now",
          bullets: [
            "Open your inbox within 2 minutes",
            "Look for the email with your resource",
            "Check your spam folder if needed",
            "Add us to your contacts for future emails",
          ],
        },
        {
          type: "faq",
          eyebrow: "FAQ",
          headline: "Didn't get the email?",
          body: "Wait 5 minutes, then check your spam. If still nothing, contact us and we'll resend your resource manually.",
        },
        {
          type: "cta",
          eyebrow: "MEANWHILE",
          headline: "Open your inbox now",
          body: "Your free resource is waiting for you.",
          ctaLabel: "Open Gmail",
        },
      ],
      es: [
        {
          type: "hero",
          eyebrow: "INSCRIPCIÓN CONFIRMADA",
          headline: "¡Gracias! Tu recurso está en camino a tu bandeja de entrada",
          subheadline: "Revisa tu bandeja en los próximos 2 minutos.",
          body: "Acabamos de enviarte tu recurso gratuito por email. Si no lo ves, revisa tu carpeta de spam o promociones, y añade nuestra dirección a tus contactos.",
        },
        {
          type: "process",
          eyebrow: "TUS PRÓXIMOS PASOS",
          headline: "Esto es lo que tienes que hacer",
          bullets: [
            "Abre tu bandeja en los próximos 2 minutos",
            "Busca el email con tu recurso",
            "Revisa tu carpeta de spam si es necesario",
            "Añádenos a tus contactos para próximos envíos",
          ],
        },
        {
          type: "faq",
          eyebrow: "PREGUNTAS FRECUENTES",
          headline: "¿No recibiste el email?",
          body: "Espera 5 minutos, luego revisa tu spam. Si aún no encuentras nada, contáctanos y reenviaremos tu recurso manualmente.",
        },
        {
          type: "cta",
          eyebrow: "MIENTRAS TANTO",
          headline: "Abre tu bandeja ahora",
          body: "Tu recurso gratuito te espera.",
          ctaLabel: "Abrir Gmail",
        },
      ],
    },
    delivery: {
      fr: [
        {
          type: "hero",
          eyebrow: "VOTRE ACCÈS",
          headline: "Votre ressource est prête à être téléchargée",
          subheadline: "Téléchargez votre guide en un clic et commencez dès maintenant.",
          body: "Cliquez sur le bouton ci-dessous pour télécharger votre ressource. Conservez-la dans un dossier facile d'accès pour pouvoir la consulter à tout moment.",
        },
        {
          type: "process",
          eyebrow: "POUR BIEN COMMENCER",
          headline: "Comment tirer le meilleur de cette ressource",
          bullets: [
            "Téléchargez le fichier sur votre appareil",
            "Bloquez 30 minutes dans votre agenda pour le lire",
            "Appliquez la première étape dès aujourd'hui",
            "Revenez nous dire vos résultats par email",
          ],
        },
        {
          type: "offer",
          eyebrow: "POUR ALLER PLUS LOIN",
          headline: "Découvrez notre accompagnement complet",
          body: "Si cette ressource vous a plu, vous adorerez notre programme complet qui va beaucoup plus loin et vous guide pas à pas.",
        },
        {
          type: "cta",
          eyebrow: "TÉLÉCHARGEZ MAINTENANT",
          headline: "Récupérez votre ressource gratuite",
          ctaLabel: "Télécharger mon guide",
        },
      ],
      en: [
        {
          type: "hero",
          eyebrow: "YOUR ACCESS",
          headline: "Your resource is ready to download",
          subheadline: "Download your guide in one click and start right now.",
          body: "Click the button below to download your resource. Keep it in an easy-to-find folder so you can refer to it anytime.",
        },
        {
          type: "process",
          eyebrow: "GET STARTED",
          headline: "How to get the most from this resource",
          bullets: [
            "Download the file to your device",
            "Block 30 minutes in your calendar to read it",
            "Apply the first step today",
            "Reply by email to share your results",
          ],
        },
        {
          type: "offer",
          eyebrow: "GO FURTHER",
          headline: "Discover our complete program",
          body: "If you enjoyed this resource, you'll love our full program that goes much deeper and guides you step by step.",
        },
        {
          type: "cta",
          eyebrow: "DOWNLOAD NOW",
          headline: "Get your free resource",
          ctaLabel: "Download my guide",
        },
      ],
      es: [
        {
          type: "hero",
          eyebrow: "TU ACCESO",
          headline: "Tu recurso está listo para descargar",
          subheadline: "Descarga tu guía en un clic y empieza ahora mismo.",
          body: "Haz clic en el botón para descargar tu recurso. Guárdalo en una carpeta accesible para consultarlo cuando quieras.",
        },
        {
          type: "process",
          eyebrow: "PARA EMPEZAR",
          headline: "Cómo sacar el máximo de este recurso",
          bullets: [
            "Descarga el archivo en tu dispositivo",
            "Bloquea 30 minutos en tu agenda para leerlo",
            "Aplica el primer paso hoy",
            "Cuéntanos tus resultados por email",
          ],
        },
        {
          type: "offer",
          eyebrow: "PARA IR MÁS LEJOS",
          headline: "Descubre nuestro programa completo",
          body: "Si te gustó este recurso, te encantará nuestro programa completo que profundiza mucho más y te guía paso a paso.",
        },
        {
          type: "cta",
          eyebrow: "DESCARGA AHORA",
          headline: "Obtén tu recurso gratuito",
          ctaLabel: "Descargar mi guía",
        },
      ],
    },
  },

  // ─── WEBINAR ──────────────────────────────────────────────────────────────
  webinar: {
    confirmation: {
      fr: [
        {
          type: "hero",
          eyebrow: "INSCRIPTION CONFIRMÉE",
          headline: "Votre place pour le webinaire est réservée",
          subheadline: "Notez la date et préparez-vous à découvrir notre méthode complète.",
          body: "Vous recevrez un email de rappel quelques heures avant le démarrage avec le lien de connexion. Pensez à ajouter l'événement à votre calendrier pour ne pas l'oublier.",
        },
        {
          type: "process",
          eyebrow: "POUR NE RIEN MANQUER",
          headline: "Trois étapes simples avant le webinaire",
          bullets: [
            "Ajoutez l'événement à votre calendrier maintenant",
            "Préparez vos questions à l'avance",
            "Connectez-vous 5 minutes avant l'heure de démarrage",
            "Installez-vous au calme avec une bonne connexion",
          ],
        },
        {
          type: "benefits",
          eyebrow: "CE QUE VOUS ALLEZ APPRENDRE",
          headline: "Le programme du webinaire en bref",
          bullets: [
            "La méthode complète, étape par étape",
            "Les erreurs courantes à éviter absolument",
            "Des exemples concrets et applicables",
            "Une session de questions/réponses en direct",
          ],
        },
        {
          type: "faq",
          eyebrow: "QUESTIONS FRÉQUENTES",
          headline: "Comment rejoindre le webinaire le jour J",
          body: "Le lien de connexion vous sera envoyé par email 1 heure avant le démarrage. Aucune installation requise, tout se passe directement dans votre navigateur.",
        },
        {
          type: "cta",
          eyebrow: "PROCHAINE ÉTAPE",
          headline: "Ajoutez le webinaire à votre agenda",
          ctaLabel: "Ajouter à mon calendrier",
        },
      ],
      en: [
        {
          type: "hero",
          eyebrow: "REGISTRATION CONFIRMED",
          headline: "Your seat for the webinar is booked",
          subheadline: "Save the date and get ready to discover our complete method.",
          body: "You'll receive a reminder email a few hours before the start, with the connection link. Add the event to your calendar so you don't miss it.",
        },
        {
          type: "process",
          eyebrow: "DON'T MISS IT",
          headline: "Three simple steps before the webinar",
          bullets: [
            "Add the event to your calendar now",
            "Prepare your questions in advance",
            "Log in 5 minutes before start time",
            "Find a quiet spot with a good connection",
          ],
        },
        {
          type: "benefits",
          eyebrow: "WHAT YOU'LL LEARN",
          headline: "Webinar agenda at a glance",
          bullets: [
            "The complete method, step by step",
            "Common mistakes to absolutely avoid",
            "Concrete, applicable examples",
            "A live Q&A session",
          ],
        },
        {
          type: "faq",
          eyebrow: "FAQ",
          headline: "How to join the webinar on the day",
          body: "The connection link will be emailed 1 hour before the start. No installation required, everything happens in your browser.",
        },
        {
          type: "cta",
          eyebrow: "NEXT STEP",
          headline: "Add the webinar to your calendar",
          ctaLabel: "Add to my calendar",
        },
      ],
      es: [
        {
          type: "hero",
          eyebrow: "INSCRIPCIÓN CONFIRMADA",
          headline: "Tu plaza para el webinar está reservada",
          subheadline: "Guarda la fecha y prepárate para descubrir nuestro método completo.",
          body: "Recibirás un email recordatorio unas horas antes del inicio, con el enlace de conexión. Añade el evento a tu calendario para no olvidarlo.",
        },
        {
          type: "process",
          eyebrow: "PARA NO PERDERTE NADA",
          headline: "Tres pasos simples antes del webinar",
          bullets: [
            "Añade el evento a tu calendario ahora",
            "Prepara tus preguntas con antelación",
            "Conéctate 5 minutos antes del inicio",
            "Busca un lugar tranquilo con buena conexión",
          ],
        },
        {
          type: "benefits",
          eyebrow: "LO QUE APRENDERÁS",
          headline: "Programa del webinar en breve",
          bullets: [
            "El método completo, paso a paso",
            "Errores comunes a evitar",
            "Ejemplos concretos y aplicables",
            "Una sesión de preguntas en vivo",
          ],
        },
        {
          type: "faq",
          eyebrow: "PREGUNTAS FRECUENTES",
          headline: "Cómo unirte al webinar el día del evento",
          body: "El enlace de conexión se enviará por email 1 hora antes del inicio. Sin instalación, todo desde tu navegador.",
        },
        {
          type: "cta",
          eyebrow: "PRÓXIMO PASO",
          headline: "Añade el webinar a tu agenda",
          ctaLabel: "Añadir a mi calendario",
        },
      ],
    },
    replay: {
      fr: [
        {
          type: "hero",
          eyebrow: "REPLAY DISPONIBLE",
          headline: "Revoir le webinaire à votre rythme",
          subheadline: "L'intégralité de la session est disponible ci-dessous.",
          body: "Reprenez les points clés du webinaire à votre rythme. Cette vidéo restera accessible pour une durée limitée, profitez-en sans tarder.",
        },
        {
          type: "video",
          eyebrow: "LE REPLAY",
          headline: "Visionnez la session complète",
          body: "Cliquez sur la vidéo pour démarrer la lecture.",
        },
        {
          type: "benefits",
          eyebrow: "LES POINTS CLÉS",
          headline: "Ce que vous avez appris pendant la session",
          bullets: [
            "La méthode complète présentée pas à pas",
            "Les outils concrets à mettre en place",
            "Les erreurs à éviter absolument",
            "La feuille de route pour passer à l'action",
          ],
        },
        {
          type: "offer",
          eyebrow: "OFFRE SPÉCIALE REPLAY",
          headline: "Allez plus loin avec notre programme complet",
          body: "Les participants du webinaire bénéficient d'une offre exclusive pour rejoindre notre programme complet. Cette offre n'est valable que pendant quelques jours.",
        },
        {
          type: "guarantee",
          eyebrow: "NOTRE GARANTIE",
          headline: "Satisfait ou remboursé pendant 30 jours",
          body: "Si vous n'êtes pas satisfait du programme dans les 30 jours, nous vous remboursons sans poser de questions.",
        },
        {
          type: "cta",
          eyebrow: "PASSEZ À L'ACTION",
          headline: "Rejoignez le programme maintenant",
          ctaLabel: "Je veux le programme",
        },
      ],
      en: [
        {
          type: "hero",
          eyebrow: "REPLAY AVAILABLE",
          headline: "Watch the webinar at your own pace",
          subheadline: "The full session is available below.",
          body: "Revisit the key points at your own pace. This video will remain available for a limited time, don't wait.",
        },
        {
          type: "video",
          eyebrow: "THE REPLAY",
          headline: "Watch the full session",
          body: "Click the video to start playing.",
        },
        {
          type: "benefits",
          eyebrow: "KEY TAKEAWAYS",
          headline: "What you learned during the session",
          bullets: [
            "The complete method, step by step",
            "Concrete tools to implement",
            "Mistakes to absolutely avoid",
            "The roadmap to take action",
          ],
        },
        {
          type: "offer",
          eyebrow: "SPECIAL REPLAY OFFER",
          headline: "Go further with our complete program",
          body: "Webinar attendees get an exclusive offer to join our full program. This offer is only valid for a few days.",
        },
        {
          type: "guarantee",
          eyebrow: "OUR GUARANTEE",
          headline: "30-day money-back guarantee",
          body: "If you're not satisfied with the program within 30 days, we'll refund you, no questions asked.",
        },
        {
          type: "cta",
          eyebrow: "TAKE ACTION",
          headline: "Join the program now",
          ctaLabel: "I want the program",
        },
      ],
      es: [
        {
          type: "hero",
          eyebrow: "REPLAY DISPONIBLE",
          headline: "Revive el webinar a tu ritmo",
          subheadline: "La sesión completa está disponible abajo.",
          body: "Repasa los puntos clave a tu ritmo. Este video estará disponible por tiempo limitado, no esperes.",
        },
        {
          type: "video",
          eyebrow: "EL REPLAY",
          headline: "Mira la sesión completa",
          body: "Haz clic en el video para iniciar la reproducción.",
        },
        {
          type: "benefits",
          eyebrow: "PUNTOS CLAVE",
          headline: "Lo que aprendiste durante la sesión",
          bullets: [
            "El método completo paso a paso",
            "Las herramientas concretas a implementar",
            "Los errores a evitar",
            "La hoja de ruta para pasar a la acción",
          ],
        },
        {
          type: "offer",
          eyebrow: "OFERTA ESPECIAL REPLAY",
          headline: "Ve más lejos con nuestro programa completo",
          body: "Los participantes del webinar obtienen una oferta exclusiva. Solo válida unos días.",
        },
        {
          type: "guarantee",
          eyebrow: "NUESTRA GARANTÍA",
          headline: "Garantía de devolución de 30 días",
          body: "Si no estás satisfecho dentro de los 30 días, te reembolsamos sin preguntas.",
        },
        {
          type: "cta",
          eyebrow: "PASA A LA ACCIÓN",
          headline: "Únete al programa ahora",
          ctaLabel: "Quiero el programa",
        },
      ],
    },
  },

  // ─── DIGITAL PRODUCT ──────────────────────────────────────────────────────
  "digital-product": {
    thankyou: {
      fr: [
        {
          type: "hero",
          eyebrow: "COMMANDE CONFIRMÉE",
          headline: "Merci pour votre achat, votre commande est validée",
          subheadline: "Vous allez recevoir votre accès dans les prochaines minutes.",
          body: "Un email de confirmation vient de vous être envoyé avec le détail de votre commande et le lien d'accès à votre produit. Pensez à vérifier vos spams si vous ne le voyez pas.",
        },
        {
          type: "process",
          eyebrow: "VOS PROCHAINES ÉTAPES",
          headline: "Comment accéder à votre produit",
          bullets: [
            "Vérifiez votre email de confirmation",
            "Cliquez sur le lien d'accès personnel",
            "Créez votre mot de passe si demandé",
            "Commencez avec le module de démarrage",
          ],
        },
        {
          type: "benefits",
          eyebrow: "CE QUE VOUS OBTENEZ",
          headline: "Tout ce qui est inclus dans votre commande",
          bullets: [
            "Accès immédiat à l'intégralité du contenu",
            "Mises à jour à vie incluses",
            "Support par email sous 24 à 48 h",
            "Tous les bonus annoncés sur la page de vente",
          ],
        },
        {
          type: "cta",
          eyebrow: "C'EST PARTI",
          headline: "Accédez à votre espace membre",
          ctaLabel: "Accéder à mon contenu",
        },
      ],
      en: [
        {
          type: "hero",
          eyebrow: "ORDER CONFIRMED",
          headline: "Thanks for your purchase, your order is confirmed",
          subheadline: "You'll receive your access within the next few minutes.",
          body: "A confirmation email has just been sent with your order details and access link. Check your spam folder if you don't see it.",
        },
        {
          type: "process",
          eyebrow: "YOUR NEXT STEPS",
          headline: "How to access your product",
          bullets: [
            "Check your confirmation email",
            "Click on your personal access link",
            "Create your password if requested",
            "Start with the onboarding module",
          ],
        },
        {
          type: "benefits",
          eyebrow: "WHAT YOU GET",
          headline: "Everything included in your order",
          bullets: [
            "Immediate access to all content",
            "Lifetime updates included",
            "Email support within 24-48 hours",
            "All bonuses announced on the sales page",
          ],
        },
        {
          type: "cta",
          eyebrow: "LET'S GO",
          headline: "Access your member area",
          ctaLabel: "Access my content",
        },
      ],
      es: [
        {
          type: "hero",
          eyebrow: "PEDIDO CONFIRMADO",
          headline: "Gracias por tu compra, tu pedido está validado",
          subheadline: "Recibirás tu acceso en los próximos minutos.",
          body: "Un email de confirmación acaba de enviarse con los detalles de tu pedido y el enlace de acceso. Revisa tu spam si no lo ves.",
        },
        {
          type: "process",
          eyebrow: "TUS PRÓXIMOS PASOS",
          headline: "Cómo acceder a tu producto",
          bullets: [
            "Revisa tu email de confirmación",
            "Haz clic en tu enlace de acceso personal",
            "Crea tu contraseña si se solicita",
            "Empieza con el módulo de inicio",
          ],
        },
        {
          type: "benefits",
          eyebrow: "LO QUE OBTIENES",
          headline: "Todo lo incluido en tu pedido",
          bullets: [
            "Acceso inmediato a todo el contenido",
            "Actualizaciones de por vida incluidas",
            "Soporte por email en 24-48 horas",
            "Todos los bonos anunciados",
          ],
        },
        {
          type: "cta",
          eyebrow: "VAMOS",
          headline: "Accede a tu área de miembro",
          ctaLabel: "Acceder a mi contenido",
        },
      ],
    },
  },

  // ─── BOOKING ──────────────────────────────────────────────────────────────
  booking: {
    confirmation: {
      fr: [
        {
          type: "hero",
          eyebrow: "RÉSERVATION CONFIRMÉE",
          headline: "Votre appel est réservé, à très vite",
          subheadline: "Vous recevrez un rappel par email avant le rendez-vous.",
          body: "Nous avons hâte d'échanger avec vous. Pour tirer le meilleur de notre appel, prenez quelques minutes pour préparer le contexte de votre situation et les questions que vous souhaitez aborder.",
        },
        {
          type: "process",
          eyebrow: "POUR PRÉPARER L'APPEL",
          headline: "Trois choses à faire avant le rendez-vous",
          bullets: [
            "Notez vos 3 objectifs principaux",
            "Préparez vos questions les plus importantes",
            "Installez-vous au calme avec une bonne connexion",
            "Ayez un carnet de notes à portée de main",
          ],
        },
        {
          type: "benefits",
          eyebrow: "DURANT L'APPEL",
          headline: "Ce que nous allons aborder ensemble",
          bullets: [
            "Comprendre précisément votre situation actuelle",
            "Identifier les blocages qui vous freinent",
            "Définir les étapes prioritaires à mettre en place",
            "Voir si nous pouvons travailler ensemble",
          ],
        },
        {
          type: "cta",
          eyebrow: "À TRÈS VITE",
          headline: "Préparez votre appel dès maintenant",
          ctaLabel: "Voir mon calendrier",
        },
      ],
      en: [
        {
          type: "hero",
          eyebrow: "BOOKING CONFIRMED",
          headline: "Your call is booked, see you soon",
          subheadline: "You'll receive a reminder email before the appointment.",
          body: "We can't wait to chat with you. To make the most of our call, take a few minutes to prepare your context and the questions you want to discuss.",
        },
        {
          type: "process",
          eyebrow: "PREPARE FOR THE CALL",
          headline: "Three things to do before the appointment",
          bullets: [
            "Write down your 3 main goals",
            "Prepare your most important questions",
            "Find a quiet spot with a good connection",
            "Keep a notebook within reach",
          ],
        },
        {
          type: "benefits",
          eyebrow: "DURING THE CALL",
          headline: "What we'll cover together",
          bullets: [
            "Understand your current situation in detail",
            "Identify what's blocking you",
            "Define the priority steps to take",
            "See if we can work together",
          ],
        },
        {
          type: "cta",
          eyebrow: "SEE YOU SOON",
          headline: "Prepare for your call now",
          ctaLabel: "View my calendar",
        },
      ],
      es: [
        {
          type: "hero",
          eyebrow: "RESERVA CONFIRMADA",
          headline: "Tu llamada está reservada, nos vemos pronto",
          subheadline: "Recibirás un recordatorio por email antes de la cita.",
          body: "Tenemos ganas de hablar contigo. Para aprovechar al máximo nuestra llamada, prepara el contexto de tu situación y las preguntas que quieras abordar.",
        },
        {
          type: "process",
          eyebrow: "PREPARA LA LLAMADA",
          headline: "Tres cosas que hacer antes de la cita",
          bullets: [
            "Anota tus 3 objetivos principales",
            "Prepara tus preguntas más importantes",
            "Busca un lugar tranquilo con buena conexión",
            "Ten un cuaderno a mano",
          ],
        },
        {
          type: "benefits",
          eyebrow: "DURANTE LA LLAMADA",
          headline: "Lo que cubriremos juntos",
          bullets: [
            "Comprender tu situación actual en detalle",
            "Identificar los bloqueos que te frenan",
            "Definir los pasos prioritarios a dar",
            "Ver si podemos trabajar juntos",
          ],
        },
        {
          type: "cta",
          eyebrow: "HASTA PRONTO",
          headline: "Prepara tu llamada ahora",
          ctaLabel: "Ver mi calendario",
        },
      ],
    },
  },

  // ─── CHALLENGE ────────────────────────────────────────────────────────────
  challenge: {
    confirmation: {
      fr: [
        {
          type: "hero",
          eyebrow: "INSCRIPTION CONFIRMÉE",
          headline: "Bienvenue dans le challenge, on commence très bientôt",
          subheadline: "Préparez-vous à vivre une transformation en quelques jours.",
          body: "Votre place est réservée. Vous recevrez chaque jour un email avec le contenu du jour, les exercices à réaliser et la communauté pour échanger avec les autres participants.",
        },
        {
          type: "process",
          eyebrow: "AVANT LE DÉPART",
          headline: "Trois étapes pour bien démarrer",
          bullets: [
            "Ajoutez nos emails à vos contacts",
            "Bloquez 30 minutes par jour dans votre agenda",
            "Préparez votre carnet d'exercices",
            "Rejoignez la communauté privée",
          ],
        },
        {
          type: "benefits",
          eyebrow: "CE QUI VOUS ATTEND",
          headline: "Le programme complet du challenge",
          bullets: [
            "Une vidéo courte chaque jour pendant la durée du challenge",
            "Des exercices concrets à appliquer immédiatement",
            "Une communauté privée pour échanger",
            "Un bilan personnalisé en fin de challenge",
          ],
        },
        {
          type: "cta",
          eyebrow: "PROCHAINE ÉTAPE",
          headline: "Rejoignez la communauté privée",
          ctaLabel: "Accéder à la communauté",
        },
      ],
      en: [
        {
          type: "hero",
          eyebrow: "REGISTRATION CONFIRMED",
          headline: "Welcome to the challenge, we start very soon",
          subheadline: "Get ready for a transformation in just a few days.",
          body: "Your spot is reserved. You'll receive an email each day with the day's content, exercises to do, and the community to chat with other participants.",
        },
        {
          type: "process",
          eyebrow: "BEFORE THE START",
          headline: "Three steps to kick off right",
          bullets: [
            "Add our emails to your contacts",
            "Block 30 minutes per day in your calendar",
            "Prepare your exercise notebook",
            "Join the private community",
          ],
        },
        {
          type: "benefits",
          eyebrow: "WHAT'S COMING",
          headline: "Full challenge program",
          bullets: [
            "A short video every day during the challenge",
            "Concrete exercises to apply immediately",
            "A private community to engage",
            "A personalized recap at the end",
          ],
        },
        {
          type: "cta",
          eyebrow: "NEXT STEP",
          headline: "Join the private community",
          ctaLabel: "Access the community",
        },
      ],
      es: [
        {
          type: "hero",
          eyebrow: "INSCRIPCIÓN CONFIRMADA",
          headline: "Bienvenido al reto, empezamos muy pronto",
          subheadline: "Prepárate para una transformación en pocos días.",
          body: "Tu plaza está reservada. Recibirás cada día un email con el contenido del día, los ejercicios y la comunidad para intercambiar.",
        },
        {
          type: "process",
          eyebrow: "ANTES DE EMPEZAR",
          headline: "Tres pasos para arrancar bien",
          bullets: [
            "Añade nuestros emails a tus contactos",
            "Bloquea 30 minutos por día en tu agenda",
            "Prepara tu cuaderno de ejercicios",
            "Únete a la comunidad privada",
          ],
        },
        {
          type: "benefits",
          eyebrow: "LO QUE TE ESPERA",
          headline: "Programa completo del reto",
          bullets: [
            "Un video corto cada día durante el reto",
            "Ejercicios concretos a aplicar de inmediato",
            "Una comunidad privada para intercambiar",
            "Un balance personalizado al final",
          ],
        },
        {
          type: "cta",
          eyebrow: "PRÓXIMO PASO",
          headline: "Únete a la comunidad privada",
          ctaLabel: "Acceder a la comunidad",
        },
      ],
    },
  },

  // ─── COACHING HIGH TICKET ─────────────────────────────────────────────────
  "coaching-high-ticket": {
    confirmation: {
      fr: [
        {
          type: "hero",
          eyebrow: "CANDIDATURE REÇUE",
          headline: "Votre candidature est en cours d'examen",
          subheadline: "Nous revenons vers vous sous 48 heures.",
          body: "Merci d'avoir pris le temps de remplir votre candidature avec soin. Notre équipe étudie chaque dossier individuellement pour s'assurer que l'accompagnement est réellement adapté à votre situation.",
        },
        {
          type: "process",
          eyebrow: "LA SUITE",
          headline: "Voici ce qui va se passer maintenant",
          bullets: [
            "Notre équipe étudie votre dossier sous 48 h",
            "Si nous pouvons vous aider, vous recevrez un email",
            "Vous pourrez réserver votre appel stratégique",
            "Sinon, nous vous expliquerons pourquoi par email",
          ],
        },
        {
          type: "benefits",
          eyebrow: "EN ATTENDANT",
          headline: "Préparez votre appel stratégique",
          bullets: [
            "Clarifiez précisément vos objectifs 12 mois",
            "Identifiez les blocages que vous voulez lever",
            "Listez vos questions sur l'accompagnement",
            "Préparez une présentation de votre activité",
          ],
        },
        {
          type: "cta",
          eyebrow: "À TRÈS BIENTÔT",
          headline: "Découvrez nos études de cas en attendant",
          ctaLabel: "Voir les cas clients",
        },
      ],
      en: [
        {
          type: "hero",
          eyebrow: "APPLICATION RECEIVED",
          headline: "Your application is being reviewed",
          subheadline: "We'll get back to you within 48 hours.",
          body: "Thanks for taking the time to fill out your application carefully. Our team reviews every file individually to make sure coaching is truly a fit for your situation.",
        },
        {
          type: "process",
          eyebrow: "WHAT'S NEXT",
          headline: "Here's what happens now",
          bullets: [
            "Our team reviews your file within 48 hours",
            "If we can help, you'll receive an email",
            "You'll be able to book your strategy call",
            "Otherwise, we'll explain why by email",
          ],
        },
        {
          type: "benefits",
          eyebrow: "MEANWHILE",
          headline: "Prepare your strategy call",
          bullets: [
            "Clarify your 12-month goals precisely",
            "Identify the blockers you want to lift",
            "List your questions about coaching",
            "Prepare a brief overview of your business",
          ],
        },
        {
          type: "cta",
          eyebrow: "SEE YOU SOON",
          headline: "Discover our case studies while you wait",
          ctaLabel: "View case studies",
        },
      ],
      es: [
        {
          type: "hero",
          eyebrow: "CANDIDATURA RECIBIDA",
          headline: "Tu candidatura está siendo revisada",
          subheadline: "Te contestaremos en 48 horas.",
          body: "Gracias por tomarte el tiempo de rellenar tu candidatura con cuidado. Nuestro equipo revisa cada expediente individualmente para asegurarse de que el coaching encaja con tu situación.",
        },
        {
          type: "process",
          eyebrow: "QUÉ SIGUE",
          headline: "Esto es lo que va a pasar ahora",
          bullets: [
            "Nuestro equipo revisa tu expediente en 48 h",
            "Si podemos ayudarte, recibirás un email",
            "Podrás reservar tu llamada estratégica",
            "Si no, te explicaremos por qué por email",
          ],
        },
        {
          type: "benefits",
          eyebrow: "MIENTRAS TANTO",
          headline: "Prepara tu llamada estratégica",
          bullets: [
            "Clarifica tus objetivos a 12 meses",
            "Identifica los bloqueos que quieres superar",
            "Lista tus preguntas sobre el coaching",
            "Prepara una breve presentación de tu actividad",
          ],
        },
        {
          type: "cta",
          eyebrow: "HASTA PRONTO",
          headline: "Descubre nuestros casos de éxito mientras tanto",
          ctaLabel: "Ver casos de éxito",
        },
      ],
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Fallback générique par rôle
// ─────────────────────────────────────────────────────────────────────────────

function getGenericRoleCopy(role: PageRole, lang: Language): SectionTemplate[] {
  const map: Partial<Record<PageRole, RoleCopy>> = {
    thankyou: {
      fr: [
        {
          type: "hero",
          eyebrow: "MERCI",
          headline: "Votre demande a bien été enregistrée",
          subheadline: "Nous revenons vers vous dans les meilleurs délais.",
          body: "Un email de confirmation vous a été envoyé. Pensez à vérifier vos spams si vous ne le voyez pas.",
        },
        {
          type: "process",
          eyebrow: "PROCHAINES ÉTAPES",
          headline: "Ce qu'il vous reste à faire",
          bullets: [
            "Vérifiez votre boîte mail",
            "Ajoutez-nous à vos contacts",
            "Patientez quelques minutes le temps de la réception",
          ],
        },
        {
          type: "cta",
          eyebrow: "À TRÈS VITE",
          headline: "Découvrez la suite",
          ctaLabel: "Continuer",
        },
      ],
      en: [
        {
          type: "hero",
          eyebrow: "THANK YOU",
          headline: "Your request has been registered",
          subheadline: "We'll get back to you as soon as possible.",
          body: "A confirmation email has been sent. Check your spam folder if you don't see it.",
        },
        {
          type: "process",
          eyebrow: "NEXT STEPS",
          headline: "What's left for you to do",
          bullets: [
            "Check your inbox",
            "Add us to your contacts",
            "Wait a few minutes for delivery",
          ],
        },
        {
          type: "cta",
          eyebrow: "SEE YOU SOON",
          headline: "Discover what's next",
          ctaLabel: "Continue",
        },
      ],
      es: [
        {
          type: "hero",
          eyebrow: "GRACIAS",
          headline: "Tu solicitud ha sido registrada",
          subheadline: "Te contactaremos lo antes posible.",
          body: "Se te ha enviado un email de confirmación. Revisa tu spam si no lo ves.",
        },
        {
          type: "process",
          eyebrow: "PRÓXIMOS PASOS",
          headline: "Lo que te queda por hacer",
          bullets: [
            "Revisa tu bandeja de entrada",
            "Añádenos a tus contactos",
            "Espera unos minutos para la recepción",
          ],
        },
        {
          type: "cta",
          eyebrow: "HASTA PRONTO",
          headline: "Descubre la continuación",
          ctaLabel: "Continuar",
        },
      ],
    },
    confirmation: {
      fr: [
        {
          type: "hero",
          eyebrow: "C'EST CONFIRMÉ",
          headline: "Votre inscription est bien validée",
          subheadline: "Tout est prêt pour la suite.",
          body: "Vous recevrez prochainement un email contenant toutes les informations utiles. Pensez à vérifier vos spams si vous ne le voyez pas dans les 5 minutes.",
        },
        {
          type: "process",
          eyebrow: "LA SUITE",
          headline: "Ce qui va se passer maintenant",
          bullets: [
            "Vous recevez un email récapitulatif",
            "Préparez les éléments demandés",
            "Suivez les instructions du prochain email",
          ],
        },
        {
          type: "cta",
          eyebrow: "PROCHAINE ÉTAPE",
          headline: "Continuez votre parcours",
          ctaLabel: "Continuer",
        },
      ],
      en: [
        {
          type: "hero",
          eyebrow: "CONFIRMED",
          headline: "Your registration is validated",
          subheadline: "Everything is ready for what's next.",
          body: "You'll soon receive an email with all the useful information. Check your spam folder if you don't see it within 5 minutes.",
        },
        {
          type: "process",
          eyebrow: "WHAT'S NEXT",
          headline: "What will happen now",
          bullets: [
            "You'll receive a recap email",
            "Prepare the requested elements",
            "Follow the instructions in the next email",
          ],
        },
        {
          type: "cta",
          eyebrow: "NEXT STEP",
          headline: "Continue your journey",
          ctaLabel: "Continue",
        },
      ],
      es: [
        {
          type: "hero",
          eyebrow: "CONFIRMADO",
          headline: "Tu inscripción está validada",
          subheadline: "Todo está listo para lo que sigue.",
          body: "Pronto recibirás un email con toda la información útil. Revisa tu spam si no lo ves en 5 minutos.",
        },
        {
          type: "process",
          eyebrow: "QUÉ SIGUE",
          headline: "Lo que va a pasar ahora",
          bullets: [
            "Recibirás un email resumen",
            "Prepara los elementos solicitados",
            "Sigue las instrucciones del próximo email",
          ],
        },
        {
          type: "cta",
          eyebrow: "PRÓXIMO PASO",
          headline: "Continúa tu recorrido",
          ctaLabel: "Continuar",
        },
      ],
    },
    replay: {
      fr: [
        {
          type: "hero",
          eyebrow: "REPLAY",
          headline: "Revoir la session à votre rythme",
          subheadline: "Tout le contenu reste accessible ci-dessous.",
          body: "Reprenez les points clés à votre rythme. Pensez à prendre des notes pour passer à l'action après le visionnage.",
        },
        {
          type: "video",
          eyebrow: "LE REPLAY",
          headline: "Visionnez la session complète",
        },
        {
          type: "cta",
          eyebrow: "POUR ALLER PLUS LOIN",
          headline: "Découvrez notre offre",
          ctaLabel: "Voir l'offre",
        },
      ],
      en: [
        {
          type: "hero",
          eyebrow: "REPLAY",
          headline: "Watch the session at your own pace",
          subheadline: "All content remains available below.",
          body: "Revisit the key points at your own pace. Take notes to take action after watching.",
        },
        {
          type: "video",
          eyebrow: "THE REPLAY",
          headline: "Watch the full session",
        },
        {
          type: "cta",
          eyebrow: "GO FURTHER",
          headline: "Discover our offer",
          ctaLabel: "View the offer",
        },
      ],
      es: [
        {
          type: "hero",
          eyebrow: "REPLAY",
          headline: "Revive la sesión a tu ritmo",
          subheadline: "Todo el contenido sigue disponible abajo.",
          body: "Repasa los puntos clave. Toma notas para pasar a la acción.",
        },
        {
          type: "video",
          eyebrow: "EL REPLAY",
          headline: "Mira la sesión completa",
        },
        {
          type: "cta",
          eyebrow: "PARA IR MÁS LEJOS",
          headline: "Descubre nuestra oferta",
          ctaLabel: "Ver la oferta",
        },
      ],
    },
    delivery: {
      fr: [
        {
          type: "hero",
          eyebrow: "VOTRE ACCÈS",
          headline: "Votre ressource est prête",
          subheadline: "Téléchargez-la en un clic ci-dessous.",
          body: "Cliquez sur le bouton de téléchargement pour récupérer votre ressource. Conservez-la dans un endroit accessible.",
        },
        {
          type: "process",
          eyebrow: "POUR BIEN COMMENCER",
          headline: "Comment utiliser cette ressource",
          bullets: [
            "Téléchargez le fichier sur votre appareil",
            "Bloquez du temps pour le consulter",
            "Appliquez la première étape rapidement",
          ],
        },
        {
          type: "cta",
          eyebrow: "TÉLÉCHARGEZ",
          headline: "Récupérez votre ressource",
          ctaLabel: "Télécharger",
        },
      ],
      en: [
        {
          type: "hero",
          eyebrow: "YOUR ACCESS",
          headline: "Your resource is ready",
          subheadline: "Download it in one click below.",
          body: "Click the download button to grab your resource. Save it somewhere accessible.",
        },
        {
          type: "process",
          eyebrow: "GET STARTED",
          headline: "How to use this resource",
          bullets: [
            "Download the file to your device",
            "Block time to go through it",
            "Apply the first step quickly",
          ],
        },
        {
          type: "cta",
          eyebrow: "DOWNLOAD",
          headline: "Get your resource",
          ctaLabel: "Download",
        },
      ],
      es: [
        {
          type: "hero",
          eyebrow: "TU ACCESO",
          headline: "Tu recurso está listo",
          subheadline: "Descárgalo en un clic abajo.",
          body: "Haz clic en el botón de descarga para obtener tu recurso. Guárdalo en un lugar accesible.",
        },
        {
          type: "process",
          eyebrow: "PARA EMPEZAR",
          headline: "Cómo usar este recurso",
          bullets: [
            "Descarga el archivo en tu dispositivo",
            "Bloquea tiempo para revisarlo",
            "Aplica el primer paso rápido",
          ],
        },
        {
          type: "cta",
          eyebrow: "DESCARGA",
          headline: "Obtén tu recurso",
          ctaLabel: "Descargar",
        },
      ],
    },
  };

  const entry = map[role];
  if (!entry) return [];
  return entry[lang] ?? entry.fr;
}

function getPageCopy(
  funnelKind: FunnelKind | undefined,
  role: PageRole,
  lang: Language,
): SectionTemplate[] {
  if (funnelKind) {
    const kindMap = PAGE_COPY[funnelKind];
    const roleMap = kindMap?.[role];
    if (roleMap) {
      return roleMap[lang] ?? roleMap.fr ?? [];
    }
  }
  return getGenericRoleCopy(role, lang);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internes
// ─────────────────────────────────────────────────────────────────────────────

function makeSectionId(type: FunnelSectionType, index: number): string {
  const rand = Math.random().toString(36).slice(2, 6);
  return `sec_${type}_${index}_${rand}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// buildPlaceholderPage — refondu : produit 3+ sections riches, jamais de "Brand — name"
// ─────────────────────────────────────────────────────────────────────────────

export function buildPlaceholderPage(
  blueprint: PageBlueprint,
  brief: FunnelBrief,
  isHome: boolean = false,
): FunnelPage {
  const lang = brief.language;
  const name = blueprintName(blueprint, lang);

  // 🆕 On récupère du copy pré-écrit conversion-first pour ce rôle
  const copy = getPageCopy(brief.funnelKind, blueprint.role, lang);

  // Si on n'a pas de copy dédié (rôle exotique), on génère un hero générique
  const sections: FunnelSection[] =
    copy.length > 0
      ? copy.map((tpl, i) => buildSectionFromTemplate(tpl, i, brief))
      : [buildGenericHero(blueprint, brief)];

  return {
    id: makePageId(),
    slug: normalizePageSlug(blueprint.slug, isHome),
    name,
    role: blueprint.role,
    sections,
    visible: true,
    isHome,
  };
}

function buildSectionFromTemplate(
  tpl: SectionTemplate,
  index: number,
  brief: FunnelBrief,
): FunnelSection {
  const section: FunnelSection = {
    id: makeSectionId(tpl.type, index),
    type: tpl.type,
    eyebrow: tpl.eyebrow,
    headline: tpl.headline,
    subheadline: tpl.subheadline,
    body: tpl.body,
    bullets: tpl.bullets,
    visible: true,
    image: { mode: brief.defaultImageMode ?? "none" },
  };

  // CTA contextuel pour les sections "cta" / "hero" / "offer"
  if (tpl.ctaLabel) {
    section.cta = {
      label: tpl.ctaLabel,
      mode: "anchor",
      anchorId: "lead-form",
      target: "_self",
    };
  } else if (tpl.type === "hero" || tpl.type === "cta" || tpl.type === "offer") {
    if (brief.primaryCta) {
      section.cta = brief.primaryCta;
    }
  }

  return section;
}

function buildGenericHero(
  blueprint: PageBlueprint,
  brief: FunnelBrief,
): FunnelSection {
  const lang = brief.language;
  const headline =
    lang === "fr"
      ? "Cette page est en cours de personnalisation"
      : lang === "es"
        ? "Esta página está siendo personalizada"
        : "This page is being customized";
  const body =
    brief.promise ||
    (lang === "fr"
      ? "Le contenu sera adapté à votre offre dans quelques instants."
      : lang === "es"
        ? "El contenido se adaptará a tu oferta en breve."
        : "Content will be tailored to your offer shortly.");

  return {
    id: makeSectionId("hero", 0),
    type: "hero",
    eyebrow:
      lang === "fr"
        ? "EN COURS"
        : lang === "es"
          ? "EN CURSO"
          : "IN PROGRESS",
    headline,
    body,
    visible: true,
    image: { mode: brief.defaultImageMode ?? "none" },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// buildPagesFromBlueprints — orchestration principale
// ─────────────────────────────────────────────────────────────────────────────

export function buildPagesFromBlueprints(args: {
  blueprints: PageBlueprint[];
  sectionsByRole: Map<PageRole, FunnelSection[]>;
  brief: FunnelBrief;
  /** Indique quel role est la page d'accueil (défaut : le premier blueprint) */
  homeRole?: PageRole;
}): FunnelPage[] {
  const { blueprints, sectionsByRole, brief, homeRole } = args;
  const lang = brief.language;
  const effectiveHomeRole = homeRole ?? blueprints[0]?.role;

  return blueprints.map((bp) => {
    const isHome = bp.role === effectiveHomeRole;
    const aiSections = sectionsByRole.get(bp.role);

    // Si l'IA n'a rien fourni OU si ses sections sont vides/inutilisables,
    // on utilise le placeholder ENRICHI (3+ sections conversion-first).
    if (!aiSections || aiSections.length === 0) {
      return buildPlaceholderPage(bp, brief, isHome);
    }

    const filtered = filterSectionsByBlueprint(aiSections, bp);
    const sections = filtered.length > 0 ? filtered : aiSections;

    return {
      id: makePageId(),
      slug: normalizePageSlug(bp.slug, isHome),
      name: blueprintName(bp, lang),
      role: bp.role,
      sections,
      visible: true,
      isHome,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// chainPagesNavigation — relie les pages entre elles (CTA "Suivant")
// ─────────────────────────────────────────────────────────────────────────────

export function chainPagesNavigation(pages: FunnelPage[]): FunnelPage[] {
  if (pages.length === 0) return pages;

  return pages.map((page, index) => {
    const nextPage = pages[index + 1];

    if (!nextPage) {
      return { ...page, nextPageId: undefined };
    }

    const updatedSections = injectNextCtaIfMissing(page.sections, nextPage);

    return {
      ...page,
      nextPageId: nextPage.id,
      sections: updatedSections,
    };
  });
}

function injectNextCtaIfMissing(
  sections: FunnelSection[],
  nextPage: FunnelPage,
): FunnelSection[] {
  const hasExplicitCta = sections.some((s) => s.cta?.label && s.cta?.mode);
  if (hasExplicitCta) return sections;

  const ctaHostPriority: FunnelSectionType[] = ["cta", "form", "offer", "hero"];

  let targetIndex = -1;
  for (const type of ctaHostPriority) {
    const idx = findLastIndex(sections, (s) => s.type === type);
    if (idx !== -1) {
      targetIndex = idx;
      break;
    }
  }

  if (targetIndex === -1 && sections.length > 0) {
    targetIndex = sections.length - 1;
  }

  if (targetIndex === -1) return sections;

  const target = sections[targetIndex];

  const cleanSlug = nextPage.slug.replace(/^\/+/, "").replace(/\/+$/, "");
  const ctaUrl = nextPage.isHome || !cleanSlug ? "/" : `/${cleanSlug}`;

  const newCta = {
    label: getNextLabelForPage(nextPage),
    mode: "redirect" as const,
    url: ctaUrl,
    target: "_self" as const,
    pageId: nextPage.id,
  };

  const updated = [...sections];
  updated[targetIndex] = { ...target, cta: newCta };
  return updated;
}

// Mapping de labels CTA par rôle de page (remplace l'ancien blueprintNextLabel)
function getNextLabelForPage(page: FunnelPage): string {
  const byRole: Partial<Record<PageRole, string>> = {
    optin: "S'inscrire maintenant",
    registration: "Réserver ma place",
    sales: "Découvrir l'offre",
    checkout: "Passer au paiement",
    landing: "En savoir plus",
    booking: "Réserver mon appel",
    application: "Candidater",
    "case-studies": "Voir les cas clients",
    confirmation: "Voir la confirmation",
    thankyou: "Voir la confirmation",
    replay: "Voir le replay",
    delivery: "Accéder à ma ressource",
    access: "Accéder maintenant",
    upsell: "Découvrir l'option premium",
    downsell: "Voir une alternative",
    live: "Rejoindre la session live",
    qualification: "Continuer la candidature",
    "challenge-landing": "Rejoindre le challenge",
    "challenge-day": "Voir le jour suivant",
    custom: "Continuer",
  };
  return byRole[page.role] ?? "Continuer";
}

function findLastIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) return i;
  }
  return -1;
}
