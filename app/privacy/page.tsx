// app/privacy/page.tsx
//
// 🆕 Page PUBLIQUE (hors du groupe de routes protégé (app)/) — accessible
// sans authentification, requise pour la validation du branding Google OAuth.
// Composant serveur, pas de logique métier : contenu statique uniquement.

import type { Metadata } from "next";
import LegalPageShell from "@/components/legal/LegalPageShell";
import { LEGAL_CONFIG } from "@/lib/legal/config";

export const metadata: Metadata = {
  title: `Politique de confidentialité — ${LEGAL_CONFIG.productName}`,
  description:
    "Comment AutoFunnel AI collecte, utilise et protège vos données personnelles ainsi que celles de vos leads.",
};

export default function PrivacyPage() {
  const { productName, domain, contactEmail, privacyLastUpdated } = LEGAL_CONFIG;

  return (
    <LegalPageShell
      eyebrow="Document légal"
      title="Politique de confidentialité"
      lastUpdated={privacyLastUpdated}
    >
      <h2>1. Qui sommes-nous</h2>
      <p>
        {productName} (« nous », « notre service ») est une plateforme SaaS qui permet de créer,
        publier et gérer des tunnels de vente assistés par IA, accessible depuis{" "}
        <strong>{domain}</strong>. Cette politique de confidentialité explique quelles données
        personnelles nous collectons, pourquoi, avec qui elles sont partagées, combien de temps
        elles sont conservées, et comment vous pouvez exercer vos droits.
      </p>
      <p>
        Elle s'applique à toute personne qui utilise {productName} en tant que titulaire de
        compte (« vous », « l'utilisateur ») ainsi qu'aux visiteurs des tunnels publiés par nos
        utilisateurs, dans les conditions précisées à la section 4.
      </p>

      <h2>2. Données que nous collectons</h2>
      <p>Selon votre usage du service, nous collectons :</p>
      <ul>
        <li>
          <strong>Données de compte</strong> : nom, adresse email, mot de passe (chiffré) ou
          identité Google lorsque vous vous connectez via Google OAuth (nom, adresse email, photo
          de profil transmis par Google avec votre consentement).
        </li>
        <li>
          <strong>Données de profil et d'usage</strong> : nom de marque, offres, contenus de vos
          tunnels, historique de génération IA, préférences de langue et d'interface.
        </li>
        <li>
          <strong>Données de facturation</strong> : plan souscrit, statut d'abonnement, historique
          de paiement. Les numéros de carte bancaire ne transitent jamais par nos serveurs : ils
          sont saisis directement chez nos prestataires de paiement (voir section 5).
        </li>
        <li>
          <strong>Données techniques</strong> : adresse IP, type d'appareil et de navigateur,
          journaux de connexion et d'erreurs, à des fins de sécurité et de bon fonctionnement du
          service.
        </li>
        <li>
          <strong>Communications</strong> : les messages que vous nous envoyez (support,
          demandes RGPD) sont conservés pour assurer le suivi de votre demande.
        </li>
      </ul>

      <h2>3. Comment nous utilisons ces données</h2>
      <ul>
        <li>Créer et sécuriser votre compte, vous authentifier (y compris via Google OAuth).</li>
        <li>Fournir le service : génération de tunnels par IA, éditeur, publication, CRM, envoi d'emails transactionnels et de campagnes que vous déclenchez.</li>
        <li>Traiter vos paiements et gérer votre abonnement.</li>
        <li>Assurer la sécurité, prévenir la fraude et diagnostiquer les erreurs techniques.</li>
        <li>Vous contacter au sujet du service (informations de compte, support, évolutions importantes).</li>
        <li>Respecter nos obligations légales et comptables.</li>
      </ul>
      <p>
        Nous ne vendons jamais vos données personnelles, et nous n'utilisons pas le contenu de vos
        tunnels ou de vos échanges avec le support à des fins publicitaires tierces.
      </p>

      <h2>4. Les leads collectés pour le compte des utilisateurs</h2>
      <p>
        Lorsque vous publiez un tunnel avec {productName}, les visiteurs de ce tunnel peuvent
        vous laisser leurs coordonnées (email, nom, réponses à un formulaire de qualification…).
        Ces données de leads sont stockées dans le CRM intégré de {productName} <strong>pour votre
        compte</strong>, afin que vous puissiez les consulter, les relancer et les exporter.
      </p>
      <p>
        Sur ces données de leads, {productName} agit en tant que <strong>sous-traitant</strong> au
        sens du RGPD : c'est vous, en tant qu'utilisateur qui publie le tunnel, qui êtes{" "}
        <strong>responsable de traitement</strong> vis-à-vis de vos propres leads (finalité de la
        collecte, base légale, mentions affichées sur votre tunnel, réponse aux demandes de droits
        de vos contacts). Nous vous fournissons les outils techniques et les mesures de sécurité
        nécessaires pour traiter ces données de façon conforme, mais la responsabilité légale de
        la collecte et de l'usage de vos leads vous incombe.
      </p>

      <h2>5. Partage des données avec nos prestataires</h2>
      <p>
        Nous faisons appel à des prestataires tiers pour faire fonctionner {productName}. Chacun
        n'a accès qu'aux données strictement nécessaires à sa mission :
      </p>
      <ul>
        <li><strong>Supabase</strong> — hébergement de la base de données et gestion de l'authentification (comptes, sessions, Google OAuth).</li>
        <li><strong>Vercel</strong> — hébergement de l'application et des tunnels publiés.</li>
        <li><strong>Resend</strong> — envoi des emails transactionnels (confirmation, livraison d'achat) et des campagnes email que vous créez pour vos leads.</li>
        <li><strong>Stripe</strong> — traitement des paiements par carte bancaire (abonnement à la plateforme et achats de vos clients).</li>
        <li><strong>CinetPay</strong> — traitement des paiements mobile money pour les créateurs qui l'activent.</li>
        <li><strong>Chariow</strong> — gestion des licences et de certains achats plateforme.</li>
        <li><strong>Sentry</strong> — supervision technique et diagnostic des erreurs applicatives ; configuré pour filtrer automatiquement les identifiants, jetons d'authentification, cookies et emails complets avant tout envoi.</li>
        <li><strong>Google</strong> — authentification via Google OAuth, à votre initiative.</li>
      </ul>
      <p>
        Ces prestataires ne sont autorisés à utiliser vos données que pour exécuter la prestation
        pour laquelle nous les mandatons, dans le cadre de leurs propres engagements de
        confidentialité et de sécurité.
      </p>

      <h2>6. Cookies et traceurs</h2>
      <p>
        {productName} utilise des cookies strictement nécessaires au fonctionnement du service :
        maintien de votre session (authentification Supabase), préférences d'affichage
        (ex. thème clair/sombre) et protection contre la fraude. Ces cookies techniques ne
        nécessitent pas de consentement préalable et ne sont pas utilisés à des fins publicitaires.
      </p>
      <p>
        Les tunnels que vous publiez peuvent inclure des outils de mesure d'audience internes
        (suivi des vues de page) destinés à vous fournir des statistiques de conversion ; ces
        données sont traitées dans les mêmes conditions que les leads (section 4).
      </p>

      <h2>7. Durée de conservation</h2>
      <ul>
        <li>Données de compte : pendant toute la durée de votre inscription, puis jusqu'à 3 ans après la clôture du compte à des fins de preuve, sauf obligation légale de conservation plus longue.</li>
        <li>Données de facturation : conservées conformément aux obligations comptables et fiscales applicables (généralement 10 ans).</li>
        <li>Leads collectés via vos tunnels : conservés tant que votre compte est actif et que vous ne les avez pas supprimés ; supprimés avec votre compte sauf demande contraire.</li>
        <li>Journaux techniques et de sécurité : conservés au maximum 12 mois.</li>
      </ul>

      <h2>8. Sécurité des données</h2>
      <p>
        Nous mettons en œuvre des mesures techniques et organisationnelles raisonnables pour
        protéger vos données : chiffrement des mots de passe, connexions chiffrées (HTTPS),
        accès restreint aux données de production, et filtrage des informations sensibles avant
        tout envoi à nos outils de supervision. Aucun système n'étant infaillible, nous vous
        invitons à utiliser un mot de passe robuste et à nous signaler toute activité suspecte.
      </p>

      <h2>9. Transferts de données</h2>
      <p>
        Certains de nos prestataires (notamment l'hébergement et la supervision technique)
        peuvent traiter des données en dehors de l'Union européenne. Dans ce cas, nous nous
        assurons qu'un mécanisme de transfert reconnu (clauses contractuelles types de la
        Commission européenne, ou équivalent) encadre ce transfert.
      </p>

      <h2>10. Vos droits</h2>
      <p>
        Conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi
        Informatique et Libertés, vous disposez des droits suivants sur vos données personnelles :
      </p>
      <ul>
        <li><strong>Droit d'accès</strong> : obtenir une copie des données que nous détenons sur vous.</li>
        <li><strong>Droit de rectification</strong> : corriger des données inexactes ou incomplètes.</li>
        <li><strong>Droit à l'effacement</strong> : demander la suppression de vos données, sous réserve de nos obligations légales de conservation.</li>
        <li><strong>Droit d'opposition</strong> et <strong>droit à la limitation</strong> du traitement.</li>
        <li><strong>Droit à la portabilité</strong> : recevoir vos données dans un format structuré et couramment utilisé.</li>
        <li><strong>Droit de retirer votre consentement</strong> à tout moment, lorsque le traitement en repose (ex. connexion Google OAuth).</li>
      </ul>
      <p>
        Pour exercer l'un de ces droits, contactez-nous à{" "}
        <a href={`mailto:${contactEmail}`}>{contactEmail}</a>. Nous répondons dans un délai
        maximum d'un mois. Si vous estimez que vos droits ne sont pas respectés, vous pouvez
        introduire une réclamation auprès de l'autorité de protection des données compétente
        (en France, la CNIL — <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">cnil.fr</a>).
      </p>
      <p>
        Si votre demande concerne des données collectées par un tunnel publié sur {productName}
        (c'est-à-dire vos échanges avec un de nos utilisateurs), nous vous invitons à contacter
        directement ce créateur ; nous pouvons vous aider à l'identifier si besoin.
      </p>

      <h2>11. Modifications de cette politique</h2>
      <p>
        Nous pouvons mettre à jour cette politique pour refléter des évolutions du service ou de
        la réglementation. La date de dernière mise à jour figure en haut de cette page. En cas de
        changement substantiel, nous vous en informerons par email ou via l'application.
      </p>

      <h2>12. Contact</h2>
      <p>
        Pour toute question relative à cette politique de confidentialité ou à vos données
        personnelles, écrivez-nous à{" "}
        <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
      </p>
    </LegalPageShell>
  );
}
