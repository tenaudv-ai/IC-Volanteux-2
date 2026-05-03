import type { Season, Team } from "./types";

export interface PlayerComputed {
  playerId: string;
  name: string;
  matchesPlayed: number;
  /** Matchs joués à domicile */
  homeMatchesPlayed: number;
  /** Coût rencontres bruts (somme des parts par catégorie 'shared' sur les rencontres jouées) */
  matchCost: number;
  /** Réduction grâce à la prise en charge club */
  clubSubsidy: number;
  /** Quote-part frais volants (au prorata des matchs domicile joués) */
  shuttleCost: number;
  /** Coût total après prise en charge club + volants */
  totalCost: number;
  /** Versé par le joueur */
  paid: number;
  /** Solde = paid - totalCost (positif = crédit) */
  balance: number;
}

export interface TeamTotals {
  totalExpenses: number;
  totalByCategory: Record<string, number>;
  /** Frais "club" entièrement pris en charge */
  clubCategoryTotal: number;
  /** Subvention du club distribuée sur les frais "shared" (limitée par clubBudget restant) */
  clubSharedSubsidy: number;
  /** Total pris en charge par le club (clubCategoryTotal + clubSharedSubsidy) */
  clubSubsidyTotal: number;
  players: PlayerComputed[];
}

/** Calcule pour une équipe d'une saison donnée. La part club (clubBudget) est globale à la saison ;
 *  on l'utilise ici pour subventionner les frais "shared" de l'équipe, après avoir absorbé les frais "club". */
export function computeTeam(season: Season, team: Team): TeamTotals {
  const totalByCategory: Record<string, number> = {};
  for (const c of season.categories) totalByCategory[c.id] = 0;

  const matchCost: Record<string, number> = {};
  const clubSubsidy: Record<string, number> = {};
  const matchesPlayed: Record<string, number> = {};
  const homeMatchesPlayed: Record<string, number> = {};
  for (const p of team.players) {
    matchCost[p.id] = 0;
    clubSubsidy[p.id] = 0;
    matchesPlayed[p.id] = 0;
    homeMatchesPlayed[p.id] = 0;
  }

  let totalExpenses = 0;
  let clubCategoryTotal = 0;
  let sharedExpensesTotal = 0;

  // Premier passage : agrégats + coût brut "shared" par joueur
  for (const m of team.matches) {
    for (const pid of m.playerIds) {
      if (matchesPlayed[pid] !== undefined) {
        matchesPlayed[pid] += 1;
        if (m.isHome) homeMatchesPlayed[pid] += 1;
      }
    }
    for (const e of m.expenses) {
      const cat = season.categories.find((c) => c.id === e.categoryId);
      if (!cat) continue;
      totalExpenses += e.amount;
      totalByCategory[cat.id] = (totalByCategory[cat.id] ?? 0) + e.amount;

      if (cat.splitMode === "club") {
        clubCategoryTotal += e.amount;
      } else {
        sharedExpensesTotal += e.amount;
        const present = m.playerIds.filter((pid) => team.players.some((p) => p.id === pid));
        if (present.length === 0) continue;
        const perPlayer = e.amount / present.length;
        for (const pid of present) matchCost[pid] += perPlayer;
      }
    }
  }

  // Subvention du club sur les frais "shared" : budget restant après frais "club".
  // On utilise le budget propre à l'équipe si défini, sinon le budget saison.
  const teamClubBudget = team.clubBudget ?? season.clubBudget;
  const remainingBudget = Math.max(0, teamClubBudget - clubCategoryTotal);
  const clubSharedSubsidy = Math.min(remainingBudget, sharedExpensesTotal);
  const subsidyRatio = sharedExpensesTotal > 0 ? clubSharedSubsidy / sharedExpensesTotal : 0;

  // Appliquer la subvention proportionnellement à chaque joueur
  for (const p of team.players) {
    const subsidy = matchCost[p.id] * subsidyRatio;
    clubSubsidy[p.id] = subsidy;
  }

  // Frais volants : répartis au prorata des matchs DOMICILE joués
  const shuttleBudget = Math.max(0, team.shuttleBudget ?? 0);
  const totalHomeMatchSlots = Object.values(homeMatchesPlayed).reduce((s, n) => s + n, 0);
  const shuttleCost: Record<string, number> = {};
  for (const p of team.players) {
    shuttleCost[p.id] =
      totalHomeMatchSlots > 0
        ? (shuttleBudget * homeMatchesPlayed[p.id]) / totalHomeMatchSlots
        : 0;
  }

  const players: PlayerComputed[] = team.players.map((p) => {
    const cost = matchCost[p.id];
    const subsidy = clubSubsidy[p.id];
    const shuttle = shuttleCost[p.id];
    const total = Math.max(0, cost - subsidy) + shuttle;
    const extraPaid = (p.contributions ?? []).reduce((s, c) => s + (c.amount || 0), 0);
    const paid = (p.initialContribution || 0) + extraPaid;
    return {
      playerId: p.id,
      name: p.name,
      matchesPlayed: matchesPlayed[p.id],
      homeMatchesPlayed: homeMatchesPlayed[p.id],
      matchCost: cost,
      clubSubsidy: subsidy,
      shuttleCost: shuttle,
      totalCost: total,
      paid,
      balance: paid - total,
    };
  });

  return {
    totalExpenses,
    totalByCategory,
    clubCategoryTotal,
    clubSharedSubsidy,
    clubSubsidyTotal: clubCategoryTotal + clubSharedSubsidy,
    players,
  };
}

export const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
