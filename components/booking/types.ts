// components/booking/types.ts
//
// Types partagés par les sous-onglets de l'écran « Rendez-vous ».
// Extraits de l'ancienne page monolithique pour que chaque onglet soit un
// composant autonome et que la page ne soit plus qu'un routeur.

export type Rule = { weekday: number; startMin: number; endMin: number };

export type Exception = {
  day: string;
  kind: "closed" | "window";
  startMin?: number | null;
  endMin?: number | null;
};

export type EventType = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  durationMin: number;
  bufferMin: number;
  minNoticeMin: number;
  horizonDays: number;
  slotStepMin: number;
  timezone: string;
  locationKind: "visio" | "phone" | "in_person" | "custom";
  locationValue?: string | null;
  /** 🆕 Couleur d'accent du calendrier public (hex). Vide → couleur de marque. */
  color?: string | null;

  // 🆕 FICHE HÔTE — entièrement optionnelle, rattachée au TYPE de RDV.
  //
  // Calendly rattache l'avatar au profil du compte. Suffisant pour un
  // consultant seul, insuffisant dès qu'un même compte propose « Appel
  // découverte avec Dramane » et « Coaching avec Awa ».
  //
  // `hostName` est le champ DÉCLENCHEUR : sans lui, aucun bloc n'est rendu
  // côté public. Un avatar seul ne doit pas produire une fiche anonyme.
  hostName?: string | null;
  hostTitle?: string | null;
  hostAvatarUrl?: string | null;
  hostBio?: string | null;

  active: boolean;
  availability: Rule[];
  exceptions: Exception[];
};

export const JOURS = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];

export const toHHMM = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export const fromHHMM = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
