import type { MatchKind, MatchResult, RosterPlayer, Season, Team } from "./types";

export interface PlayerStatsRow {
  rosterId: string;
  name: string;
  /** Per discipline aggregates */
  byKind: Partial<Record<MatchKind, KindAggregate>>;
  totals: KindAggregate;
  forfeits: number;
}

export interface KindAggregate {
  played: number;
  won: number;
  setsWon: number;
  setsLost: number;
  pointsFor: number;
  pointsAgainst: number;
}

const emptyAgg = (): KindAggregate => ({
  played: 0,
  won: 0,
  setsWon: 0,
  setsLost: 0,
  pointsFor: 0,
  pointsAgainst: 0,
});

function resolveHomeWon(result: Pick<MatchResult, "sets" | "homeWon">) {
  const hasSets = result.sets.some((x) => x.home > 0 || x.away > 0);
  if (!hasSets) return result.homeWon;

  let homeSetsWon = 0;
  let awaySetsWon = 0;
  for (const set of result.sets) {
    if (set.home > set.away) homeSetsWon += 1;
    else if (set.away > set.home) awaySetsWon += 1;
  }

  if (homeSetsWon === awaySetsWon) return result.homeWon;
  return homeSetsWon > awaySetsWon;
}

function addAgg(target: KindAggregate, src: KindAggregate) {
  target.played += src.played;
  target.won += src.won;
  target.setsWon += src.setsWon;
  target.setsLost += src.setsLost;
  target.pointsFor += src.pointsFor;
  target.pointsAgainst += src.pointsAgainst;
}

/** Build per-roster-player stats from a list of teams' results. */
export function computePlayerStats(
  teams: Team[],
  roster: RosterPlayer[],
): PlayerStatsRow[] {
  const map = new Map<string, PlayerStatsRow>();

  // helper: get/create row for a roster id
  const getRow = (rid: string): PlayerStatsRow => {
    let r = map.get(rid);
    if (!r) {
      const rp = roster.find((x) => x.id === rid);
      r = {
        rosterId: rid,
        name: rp ? `${rp.firstName} ${rp.lastName}`.trim() : "—",
        byKind: {},
        totals: emptyAgg(),
        forfeits: 0,
      };
      map.set(rid, r);
    }
    return r;
  };

  for (const team of teams) {
    // resolve teamPlayerId -> rosterId
    const playerToRoster = new Map<string, string>();
    for (const p of team.players) {
      if (p.rosterId) playerToRoster.set(p.id, p.rosterId);
    }

    for (const m of team.matches) {
      if (!m.results) continue;
      for (const res of m.results) {
        // Ignorer les matchs sans résultat exploitable (pas de sets, et pas de homeWon explicite)
        const hasSets = res.sets && res.sets.some((x) => x.home > 0 || x.away > 0);
        const homeWon = resolveHomeWon(res);
        if (!hasSets && homeWon === undefined) continue;

        const setsWon = res.sets.filter((s) => s.home > s.away).length;
        const setsLost = res.sets.filter((s) => s.away > s.home).length;
        const pointsFor = res.sets.reduce((s, x) => s + x.home, 0);
        const pointsAgainst = res.sets.reduce((s, x) => s + x.away, 0);
        const won = homeWon === true ? 1 : 0;

        for (const rid of res.homeRosterIds) {
          const row = getRow(rid);
          if (!row.byKind[res.kind]) row.byKind[res.kind] = emptyAgg();
          const k = row.byKind[res.kind]!;
          if (res.forfeit) {
            row.forfeits += 1;
            continue;
          }
          const single: KindAggregate = {
            played: 1,
            won,
            setsWon,
            setsLost,
            pointsFor,
            pointsAgainst,
          };
          addAgg(k, single);
          addAgg(row.totals, single);
        }
      }
    }
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export const winRate = (a: KindAggregate) => (a.played > 0 ? a.won / a.played : 0);
export const setRate = (a: KindAggregate) => {
  const t = a.setsWon + a.setsLost;
  return t > 0 ? a.setsWon / t : 0;
};
export const pointRate = (a: KindAggregate) => {
  const t = a.pointsFor + a.pointsAgainst;
  return t > 0 ? a.pointsFor / t : 0;
};

// ===== Analyse =====

/** Best singles player (SH or SD).
 *  Score = (1 - weightStats) * normLevel + weightStats * winRate
 *  where normLevel converts level (lower = better) into 0..1 (best = 1).
 */
export interface RankedPlayer {
  rosterId: string;
  name: string;
  level?: number;
  played: number;
  won: number;
  winRate: number;
  score: number;
}

const normLevel = (lvl?: number) => {
  if (lvl === undefined || lvl === null) return 0;
  // Levels 1 (best) .. 15 (lowest). Map 1->1.0, 15->0.0
  const clamped = Math.max(1, Math.min(15, lvl));
  return (15 - clamped) / 14;
};

export interface AnalyseInput {
  /** 0 = pure ranking, 1 = pure stats */
  weightStats: number;
  /** Restrict to roster players present in these team(s) */
  rosterIds?: string[];
}

export function rankSinglesPlayers(
  teams: Team[],
  roster: RosterPlayer[],
  kind: "SH" | "SD",
  opts: AnalyseInput,
): RankedPlayer[] {
  const stats = computePlayerStats(teams, roster);
  const allowed =
    opts.rosterIds && opts.rosterIds.length > 0 ? new Set(opts.rosterIds) : null;
  const isMen = kind === "SH";
  const candidates = roster.filter((r) => {
    if (allowed && !allowed.has(r.id)) return false;
    return isMen ? r.gender === "H" : r.gender === "F";
  });

  return candidates
    .map((r) => {
      const row = stats.find((s) => s.rosterId === r.id);
      const agg = row?.byKind[kind] ?? emptyAgg();
      const wr = winRate(agg);
      const lvl = r.levelSingle ?? r.levelPlayed;
      const score =
        (1 - opts.weightStats) * normLevel(lvl) + opts.weightStats * wr;
      return {
        rosterId: r.id,
        name: `${r.firstName} ${r.lastName}`.trim(),
        level: lvl,
        played: agg.played,
        won: agg.won,
        winRate: wr,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export interface RankedPair {
  pairKey: string;
  rosterIds: [string, string];
  names: [string, string];
  played: number;
  won: number;
  winRate: number;
  avgLevel: number;
  score: number;
}

export function rankDoublesPairs(
  teams: Team[],
  roster: RosterPlayer[],
  kind: "DH" | "DD" | "MX",
  opts: AnalyseInput,
): RankedPair[] {
  const allowed =
    opts.rosterIds && opts.rosterIds.length > 0 ? new Set(opts.rosterIds) : null;
  const pairs = new Map<
    string,
    { rosterIds: [string, string]; played: number; won: number }
  >();

  for (const team of teams) {
    for (const m of team.matches) {
      if (!m.results) continue;
      for (const res of m.results) {
        if (res.kind !== kind) continue;
        if (res.homeRosterIds.length !== 2) continue;
        const [a, b] = [...res.homeRosterIds].sort();
        if (allowed && (!allowed.has(a) || !allowed.has(b))) continue;
        const key = `${a}|${b}`;
        const cur = pairs.get(key) ?? { rosterIds: [a, b] as [string, string], played: 0, won: 0 };
        if (res.forfeit) continue;
        // Ignorer les matchs sans résultat exploitable
        const hasSets = res.sets && res.sets.some((x) => x.home > 0 || x.away > 0);
        const homeWon = resolveHomeWon(res);
        if (!hasSets && homeWon === undefined) continue;
        cur.played += 1;
        if (homeWon) cur.won += 1;
        pairs.set(key, cur);
      }
    }
  }

  // Also include theoretical pairs from roster (if no matches yet) so we can rank by level
  const eligibleRoster = roster.filter((r) => {
    if (allowed && !allowed.has(r.id)) return false;
    if (kind === "DH") return r.gender === "H";
    if (kind === "DD") return r.gender === "F";
    return true; // MX both
  });
  for (let i = 0; i < eligibleRoster.length; i++) {
    for (let j = i + 1; j < eligibleRoster.length; j++) {
      const a = eligibleRoster[i];
      const b = eligibleRoster[j];
      if (kind === "MX") {
        if (a.gender === b.gender) continue;
      }
      const ids = [a.id, b.id].sort() as [string, string];
      const key = `${ids[0]}|${ids[1]}`;
      if (!pairs.has(key)) {
        pairs.set(key, { rosterIds: ids, played: 0, won: 0 });
      }
    }
  }

  const lvlField = kind === "MX" ? "levelMixed" : "levelDouble";

  return [...pairs.entries()]
    .map(([key, v]) => {
      const ra = roster.find((r) => r.id === v.rosterIds[0]);
      const rb = roster.find((r) => r.id === v.rosterIds[1]);
      const wr = v.played > 0 ? v.won / v.played : 0;
      const la = (ra?.[lvlField] ?? ra?.levelPlayed) as number | undefined;
      const lb = (rb?.[lvlField] ?? rb?.levelPlayed) as number | undefined;
      const avg = ((la ?? 12) + (lb ?? 12)) / 2;
      const score =
        (1 - opts.weightStats) * normLevel(avg) + opts.weightStats * wr;
      return {
        pairKey: key,
        rosterIds: v.rosterIds,
        names: [
          ra ? `${ra.firstName} ${ra.lastName}`.trim() : "?",
          rb ? `${rb.firstName} ${rb.lastName}`.trim() : "?",
        ] as [string, string],
        played: v.played,
        won: v.won,
        winRate: wr,
        avgLevel: avg,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Suggest a "best lineup" (men's interclubs default: 4 SH + 4 DH from 6 players).
 * Strategy: pick top-ranked SH players, then form best DH pairs from remaining/all.
 */
export interface BestLineup {
  singles: RankedPlayer[];
  pairs: RankedPair[];
  usedRosterIds: string[];
}

export function suggestBestLineup(
  teams: Team[],
  roster: RosterPlayer[],
  opts: AnalyseInput & { numSingles?: number; numPairs?: number; kind?: "men" | "women" | "mixed" },
): BestLineup {
  const numSingles = opts.numSingles ?? 4;
  const numPairs = opts.numPairs ?? 4;
  const sKind = opts.kind === "women" ? "SD" : "SH";
  const dKind = opts.kind === "women" ? "DD" : opts.kind === "mixed" ? "MX" : "DH";

  const singlesRanked = rankSinglesPlayers(teams, roster, sKind, opts);
  const singles = singlesRanked.slice(0, numSingles);

  const pairsRanked = rankDoublesPairs(teams, roster, dKind, opts);

  // Greedy: pick best pairs without reusing more than twice (typical IC: each player can play 2 doubles)
  const usage = new Map<string, number>();
  const maxPerPlayer = 2;
  const chosenPairs: RankedPair[] = [];
  for (const p of pairsRanked) {
    if (chosenPairs.length >= numPairs) break;
    const a = usage.get(p.rosterIds[0]) ?? 0;
    const b = usage.get(p.rosterIds[1]) ?? 0;
    if (a >= maxPerPlayer || b >= maxPerPlayer) continue;
    chosenPairs.push(p);
    usage.set(p.rosterIds[0], a + 1);
    usage.set(p.rosterIds[1], b + 1);
  }

  const used = new Set<string>([
    ...singles.map((s) => s.rosterId),
    ...chosenPairs.flatMap((p) => p.rosterIds),
  ]);

  return { singles, pairs: chosenPairs, usedRosterIds: [...used] };
}
