// Distances routières (aller simple) depuis Andenne (place des Tilleuls) jusqu'à la salle
// de chaque club adverse. Calculées via OpenStreetMap / OSRM — novembre 2026.
// `match` : mots à chercher dans le libellé de la rencontre (en majuscules).

export interface ClubDistance {
  club: string;
  hall: string;
  km: number;
  match: string[];
}

export const CLUB_DISTANCES: ClubDistance[] = [
  { club: "BC Anderlues", hall: "Salle Omnisports, Anderlues", km: 78, match: ["ANDERLUES"] },
  { club: "BC Floreffe", hall: "Centre Sportif Communal, Floreffe", km: 35, match: ["FLOREFFE"] },
  { club: "Mutu Binche", hall: "Salle Saint Albert, Ressaix", km: 72, match: ["BINCHE"] },
  { club: "Badsax Miavoye", hall: "Hall sportif de Miavoye", km: 56, match: ["MIAVOYE"] },
  { club: "JLS Roux", hall: "Complexe Sportif de Roux", km: 59, match: ["ROUX 2", "JLS"] },
  { club: "BC Loverval", hall: "Centre Sportif de la Ferme du Château, Loverval", km: 62, match: ["LOVERVAL"] },
  { club: "BC Enghien-Silly", hall: "SillySports, Bassilly", km: 105, match: ["ENGHIEN", "SILLY"] },
  { club: "Les Volants", hall: "Salle Omnisports Max Audain, Frameries", km: 100, match: ["LES VOLANTS "] },
  { club: "Lift Le Roeulx", hall: "Centre sportif des Ascenseurs, Thieu", km: 81, match: ["ROEULX"] },
  { club: "Lob'Bad", hall: "Le Scavin, Lobbes", km: 80, match: ["LOB'BAD", "LOBBAD"] },
  { club: "Sportsa BC", hall: "Sportsa, Sambreville", km: 47, match: ["SPORTSA"] },
  { club: "BC Soignies", hall: "Hall Omnisports Pierre Dupont, Soignies", km: 86, match: ["SOIGNIES"] },
  { club: "Mont-sur-Marchienne", hall: "Complexe Sportif, Mont-sur-Marchienne", km: 67, match: ["MONT-SUR-MARCHIENNE"] },
  { club: "Athois Le Volant", hall: "Salle de la Couturelle, Meslin-l'Évêque", km: 104, match: ["ATHOIS"] },
  { club: "Ciney Badminton", hall: "Hall sportif, Ciney", km: 24, match: ["CINEY"] },
  { club: "Badclub Eghezée", hall: "Centre Sportif d'Eghezée", km: 20, match: ["EGHEZ"] },
  { club: "BC La Hulle", hall: "Complexe Sportif de la Hulle, Profondeville", km: 33, match: ["HULLE"] },
  { club: "Nambad", hall: "Tabora, Namur", km: 21, match: ["NAMBAD"] },
];

/** Cherche le club adverse dans le libellé d'une rencontre (en ignorant notre équipe). */
export function findClubDistance(label: string): ClubDistance | undefined {
  const opp = label
    .toUpperCase()
    .split(/\s+-\s+/)
    .filter((s) => !s.includes("VOLANTEUX"))
    .join(" ");
  return CLUB_DISTANCES.find((c) => c.match.some((m) => opp.includes(m)));
}

/** Montant du trajet : distance aller × 2 (aller-retour) × tarif au km. */
export const travelAmount = (kmOneWay: number, rate: number) =>
  Math.round(kmOneWay * 2 * rate * 100) / 100;
