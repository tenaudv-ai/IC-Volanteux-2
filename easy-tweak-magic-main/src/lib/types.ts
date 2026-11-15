export type ID = string;

export type Gender = "H" | "F";

/** Joueur du roster club (global à l'app) */
export interface RosterPlayer {
  id: ID;
  gender: Gender;
  lastName: string;
  firstName: string;
  affiliation: string;
  /** Niveaux : Joué / Simple / Double / Mixte */
  levelPlayed?: number;
  levelSingle?: number;
  levelDouble?: number;
  levelMixed?: number;
}

export interface Category {
  id: ID;
  name: string;
  /** "shared" = répartie entre joueurs présents à la rencontre, "club" = payée par le club */
  splitMode: "shared" | "club";
  /** Tarif au km remboursé (€/km) pour les rencontres à l'extérieur. Si défini, le montant
   *  est calculé : distance aller × 2 × tarif. */
  kmRate?: number;
}

/** Versement ponctuel d'un joueur en cours d'année */
export interface PlayerContribution {
  id: ID;
  date?: string;
  amount: number;
  note?: string;
}

export interface Player {
  id: ID;
  name: string;
  /** Lien optionnel vers le roster club */
  rosterId?: ID;
  /** Participation initiale (forfait de base de la saison/équipe) */
  initialContribution: number;
  /** Versements additionnels au fil de la saison */
  contributions?: PlayerContribution[];
}

/** Frais d'une rencontre, par catégorie */
export interface MatchExpense {
  categoryId: ID;
  amount: number;
}

/** Type de match individuel dans une rencontre */
export type MatchKind = "SH" | "SD" | "DH" | "DD" | "MX";

/** Score d'un set */
export interface SetScore {
  home: number;
  away: number;
}

/** Un match individuel (1 ligne SH1, DH2, etc.) au sein d'une rencontre */
export interface MatchResult {
  /** "SH1", "DH2", "MX1"… */
  code: string;
  kind: MatchKind;
  /** Roster IDs côté domicile (notre équipe) */
  homeRosterIds: ID[];
  /** Noms bruts côté adverse (parsés du texte) */
  awayNames: string[];
  /** Sets joués */
  sets: SetScore[];
  /** True si match gagné par l'équipe domicile */
  homeWon?: boolean;
  /** Forfait (notre côté) */
  forfeit?: boolean;
}

export interface Match {
  id: ID;
  label: string;
  date?: string;
  /** Joueurs ayant joué cette rencontre (ID joueur d'équipe) */
  playerIds: ID[];
  expenses: MatchExpense[];
  /** Résultats détaillés (SH1-4, DH1-4, etc.) */
  results?: MatchResult[];
  /** Rencontre jouée à domicile (consomme des volants) */
  isHome?: boolean;
  /** Distance aller (km) depuis Andenne jusqu'à la salle adverse (rencontres à l'extérieur) */
  distanceKm?: number;
}

export interface Team {
  id: ID;
  name: string;
  players: Player[];
  matches: Match[];
  /** Budget total des frais "volants" pour la saison, réparti sur les rencontres à domicile */
  shuttleBudget?: number;
  /** Participation forfaitaire par joueur (spécifique à cette équipe). Fallback : season.playerSeasonFee */
  playerSeasonFee?: number;
  /** Montant pris en charge par le club pour CETTE équipe. Fallback : season.clubBudget */
  clubBudget?: number;
}

export interface Season {
  id: ID;
  name: string;
  /** Participation forfaitaire par joueur (valeur par défaut, surchargée par team.playerSeasonFee) */
  playerSeasonFee: number;
  /** Montant total (€) pris en charge par le club (valeur par défaut, surchargée par team.clubBudget) */
  clubBudget: number;
  categories: Category[];
  teams: Team[];
  currentTeamId?: ID;
}

export interface AppState {
  seasons: Season[];
  currentSeasonId?: ID;
  /** Roster club global, partagé entre toutes les saisons et équipes */
  roster: RosterPlayer[];
}
