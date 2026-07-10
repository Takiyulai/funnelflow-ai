// app/terms/page.tsx
//
// 🆕 Page PUBLIQUE (hors du groupe de routes protégé (app)/) — accessible
// sans authentification, requise pour la validation du branding Google OAuth.
// Composant serveur, pas de logique métier : contenu statique uniquement.

import type { Metadata } from "next";
import LegalPageShell from "@/components/legal/LegalPageShell";
import { LEGAL_CONFIG } from "@/lib/legal/config";

export const metadata: Metadata = {
  title: `Conditions d'utilisation — ${LEGAL_CONFIG.productName}`,
  description:
    "Les conditions générales d'utilisation et de vente d'AutoFunnel AI : compte, abonnements, paiement, usage acceptable et responsabilités.",
};

export default function TermsPage() {
  const { productName, domain, contactEmail, termsLastUpdated } = LEGAL_CONFIG;

  return (
    <LegalPageShell
      eyebrow="Document légal"
      title="Conditions d'utilisation"
      lastUpdated={termsLastUpdated}
    >
      <h2>1. Objet</h2>
      <p>
        Les présentes conditions générales d'utilisation et de vente (« CGU ») régissent l'accès
        et l'utilisation de {productName}, une plateforme SaaS accessible depuis{" "}
        <strong>{domain}</strong> permettant de générer, éditer, publier et gérer des tunnels de
        vente assistés par intelligence artificielle, ainsi que les fonctionnalités associées
        (CRM, campagnes email, automatisations, paiements).
      </p>
      <p>
        En créant un compte ou en utilisant le service, vous acceptez les présentes CGU dans leur
        intégralité. Si vous n'acceptez pas ces conditions, vous ne devez pas utiliser {productName}.
      </p>

      <h2>2. Création de compte</h2>
      <p>
        L'accès au service nécessite la création d'un compte, par email et mot de passe ou via
        Google OAuth. Vous vous engagez à fournir des informations exactes et à maintenir la
        confidentialité de vos identifiants. Vous êtes responsable de toute activité effectuée
        depuis votre compte. Un compte est réservé à un usage personnel ou professionnel légitime ;
        vous devez avoir au moins 18 ans ou l'âge légal de majorité dans votre juridiction pour
        souscrire un abonnement payant.
      </p>

      <h2>3. Description du service</h2>
      <p>
        {productName} fournit des outils de génération de tunnels de vente par IA, un éditeur
        visuel, la publication en ligne, un CRM de gestion des leads, des campagnes et
        automatisations email, ainsi qu'un export optionnel vers systeme.io ou en HTML/CSS. Les
        fonctionnalités disponibles dépendent du plan souscrit (Starter, Pro, Agency). Nous nous
        réservons le droit de faire évoluer, ajouter ou retirer des fonctionnalités, avec
        information préalable en cas de changement substantiel affectant votre usage.
      </p>

      <h2>4. Abonnements et paiement</h2>
      <ul>
        <li>Les plans payants sont facturés de façon récurrente (mensuelle) via notre prestataire de paiement Stripe, ou activés via une licence Chariow selon le mode de souscription choisi.</li>
        <li>Les prix affichés sont ceux en vigueur au moment de la souscription et peuvent évoluer ; toute augmentation vous sera communiquée à l'avance et ne s'appliquera qu'à la période de facturation suivante.</li>
        <li>Vous pouvez résilier votre abonnement à tout moment depuis votre espace de facturation ; l'accès reste actif jusqu'à la fin de la période déjà payée. Sauf disposition légale contraire applicable dans votre juridiction, les sommes déjà versées ne sont pas remboursables au prorata.</li>
        <li>Un abonnement impayé ou une carte refusée peut entraîner la suspension de l'accès aux fonctionnalités payantes jusqu'à régularisation.</li>
        <li>Lorsque vous vendez vos propres offres via un tunnel publié sur {productName} (paiement Stripe, CinetPay ou autre), la relation contractuelle de vente s'établit entre vous et votre client : {productName} met à disposition l'infrastructure technique mais n'est pas partie à cette vente.</li>
      </ul>

      <h2>5. Usage acceptable</h2>
      <p>Vous vous engagez à ne pas utiliser {productName} pour :</p>
      <ul>
        <li>Publier des contenus illégaux, frauduleux, trompeurs, diffamatoires ou portant atteinte aux droits de tiers.</li>
        <li>Collecter des leads ou envoyer des emails sans base légale ni consentement valable (spam, achat de listes email, non-respect du droit de la personne à se désinscrire).</li>
        <li>Vendre des produits ou services illégaux, ou usurper l'identité d'un tiers.</li>
        <li>Tenter de contourner les limites techniques du service (quotas, sécurité), d'en extraire le code source, ou de perturber son fonctionnement (introduction de logiciels malveillants, surcharge délibérée, tentative d'accès non autorisé).</li>
        <li>Utiliser les fonctionnalités de génération par IA pour produire des contenus enfreignant la loi ou les droits d'un tiers.</li>
      </ul>
      <p>
        Tout manquement à ces règles peut entraîner la suspension ou la résiliation de votre
        compte, sans préavis en cas de manquement grave, et sans préjudice d'éventuelles poursuites.
      </p>

      <h2>6. Vos responsabilités sur les données de vos leads</h2>
      <p>
        Comme précisé dans notre <a href="/privacy">politique de confidentialité</a>, vous êtes
        responsable de traitement pour les données personnelles collectées via vos propres
        tunnels (leads, clients). Il vous appartient de disposer d'une base légale valide pour
        cette collecte, d'informer les personnes concernées, d'honorer leurs demandes de droits
        RGPD et, le cas échéant, de disposer de votre propre politique de confidentialité affichée
        sur vos tunnels publiés. {productName} agit en tant que sous-traitant technique et met à
        votre disposition les outils nécessaires à cette conformité, sans se substituer à vos
        obligations légales.
      </p>

      <h2>7. Propriété intellectuelle</h2>
      <p>
        {productName}, sa marque, son logo, son code et ses interfaces restent notre propriété
        exclusive ou celle de nos concédants. Vous conservez l'intégralité des droits sur les
        contenus que vous créez (textes, offres, marque, médias importés) ainsi que sur vos
        données de leads. Vous nous accordez uniquement le droit technique d'héberger, afficher
        et transmettre ces contenus dans le cadre du fonctionnement du service.
      </p>

      <h2>8. Disponibilité et maintenance</h2>
      <p>
        Nous mettons tout en œuvre pour assurer une disponibilité continue du service, sans
        pouvoir garantir une disponibilité ininterrompue. Des interruptions planifiées (maintenance)
        ou imprévues (incident technique, panne d'un prestataire tiers) peuvent survenir. Nous nous
        efforçons de limiter leur durée et de vous en informer lorsque cela est possible.
      </p>

      <h2>9. Limitation de responsabilité</h2>
      <p>
        {productName} est fourni « en l'état ». Dans la limite permise par la loi applicable, nous
        ne pouvons être tenus responsables des dommages indirects (perte de chiffre d'affaires, de
        clientèle, de données) résultant de l'utilisation ou de l'impossibilité d'utiliser le
        service, y compris en cas de défaillance d'un prestataire tiers (hébergement, paiement,
        emailing). Notre responsabilité totale, si elle est engagée, est limitée au montant que
        vous nous avez versé au cours des douze derniers mois précédant le fait générateur.
      </p>

      <h2>10. Résiliation</h2>
      <p>
        Vous pouvez supprimer votre compte à tout moment depuis les paramètres de votre espace, ou
        en nous contactant. Nous pouvons suspendre ou résilier votre compte en cas de manquement
        aux présentes CGU, d'impayé persistant, ou d'usage frauduleux du service. La suppression
        du compte entraîne la suppression de vos tunnels et données associées selon les délais
        décrits dans notre politique de confidentialité.
      </p>

      <h2>11. Modifications des CGU</h2>
      <p>
        Nous pouvons modifier ces CGU pour refléter des évolutions du service, de nos prestataires
        ou de la réglementation. La date de dernière mise à jour figure en haut de cette page. En
        cas de changement substantiel, vous en serez informé par email ou via l'application ; la
        poursuite de l'utilisation du service après notification vaut acceptation des nouvelles
        conditions.
      </p>

      <h2>12. Droit applicable</h2>
      <p>
        Les présentes CGU sont soumises au droit applicable dans la juridiction d'établissement de{" "}
        {productName}. En cas de litige, une solution amiable sera recherchée en priorité avant
        toute action contentieuse.
      </p>

      <h2>13. Contact</h2>
      <p>
        Pour toute question relative à ces conditions d'utilisation, écrivez-nous à{" "}
        <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
      </p>
    </LegalPageShell>
  );
}
