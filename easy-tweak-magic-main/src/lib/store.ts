import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuid } from "uuid";
import type {
  AppState,
  Category,
  Match,
  MatchExpense,
  MatchResult,
  Player,
  PlayerContribution,
  RosterPlayer,
  Season,
  Team,
} from "./types";

interface Actions {
  // seasons
  addSeason: (name: string) => string;
  updateSeason: (seasonId: string, patch: Partial<Season>) => void;
  deleteSeason: (seasonId: string) => void;
  setCurrentSeason: (seasonId: string) => void;
  // teams (within a season)
  addTeam: (seasonId: string, name: string) => string;
  renameTeam: (seasonId: string, teamId: string, name: string) => void;
  updateTeam: (seasonId: string, teamId: string, patch: Partial<Team>) => void;
  deleteTeam: (seasonId: string, teamId: string) => void;
  setCurrentTeam: (seasonId: string, teamId: string) => void;
  // categories (season-level)
  addCategory: (seasonId: string, name: string, splitMode?: Category["splitMode"]) => void;
  updateCategory: (seasonId: string, id: string, patch: Partial<Category>) => void;
  removeCategory: (seasonId: string, id: string) => void;
  // roster (club-global)
  addRosterPlayer: (p: Omit<RosterPlayer, "id">) => string;
  updateRosterPlayer: (id: string, patch: Partial<RosterPlayer>) => void;
  removeRosterPlayer: (id: string) => void;
  importRoster: (rows: Omit<RosterPlayer, "id">[], replace?: boolean) => void;
  // players (team-level)
  addPlayer: (seasonId: string, teamId: string, name: string, initial?: number) => void;
  addPlayerFromRoster: (seasonId: string, teamId: string, rosterId: string, initial?: number) => void;
  updatePlayer: (seasonId: string, teamId: string, id: string, patch: Partial<Player>) => void;
  removePlayer: (seasonId: string, teamId: string, id: string) => void;
  addPlayerContribution: (seasonId: string, teamId: string, playerId: string, c: Omit<PlayerContribution, "id">) => void;
  removePlayerContribution: (seasonId: string, teamId: string, playerId: string, contributionId: string) => void;
  // matches (team-level)
  addMatch: (seasonId: string, teamId: string, label?: string) => string;
  updateMatch: (seasonId: string, teamId: string, matchId: string, patch: Partial<Match>) => void;
  removeMatch: (seasonId: string, teamId: string, matchId: string) => void;
  setMatchExpense: (seasonId: string, teamId: string, matchId: string, exp: MatchExpense) => void;
  toggleMatchPlayer: (seasonId: string, teamId: string, matchId: string, playerId: string) => void;
  updateMatchResult: (seasonId: string, teamId: string, matchId: string, index: number, patch: Partial<MatchResult>) => void;
  // bulk
  loadState: (state: AppState) => void;
  resetAll: () => void;
}

const newTeam = (name: string): Team => ({
  id: uuid(),
  name,
  players: [],
  matches: [],
});

const newSeason = (name: string): Season => {
  const team = newTeam("Équipe 1");
  return {
    id: uuid(),
    name,
    playerSeasonFee: 40,
    clubBudget: 0,
    categories: [
      { id: uuid(), name: "Bar", splitMode: "shared" },
      { id: uuid(), name: "Nourriture", splitMode: "shared" },
      { id: uuid(), name: "Volants", splitMode: "club" },
      { id: uuid(), name: "Trajet", splitMode: "shared" },
    ],
    teams: [team],
    currentTeamId: team.id,
  };
};

function modifySeason(state: AppState, seasonId: string, fn: (s: Season) => Season): AppState {
  return {
    ...state,
    seasons: state.seasons.map((s) => (s.id === seasonId ? fn(s) : s)),
  };
}

function modifyTeam(
  state: AppState,
  seasonId: string,
  teamId: string,
  fn: (t: Team) => Team,
): AppState {
  return modifySeason(state, seasonId, (se) => ({
    ...se,
    teams: se.teams.map((t) => (t.id === teamId ? fn(t) : t)),
  }));
}

export const useStore = create<AppState & Actions>()(
  persist(
    (set) => ({
      seasons: [],
      currentSeasonId: undefined,
      roster: [],

      addSeason: (name) => {
        const season = newSeason(name);
        set((s) => ({ ...s, seasons: [...s.seasons, season], currentSeasonId: season.id }));
        return season.id;
      },
      updateSeason: (seasonId, patch) =>
        set((s) => modifySeason(s, seasonId, (se) => ({ ...se, ...patch }))),
      deleteSeason: (seasonId) =>
        set((s) => {
          const seasons = s.seasons.filter((se) => se.id !== seasonId);
          return {
            ...s,
            seasons,
            currentSeasonId: s.currentSeasonId === seasonId ? seasons[0]?.id : s.currentSeasonId,
          };
        }),
      setCurrentSeason: (seasonId) => set((s) => ({ ...s, currentSeasonId: seasonId })),

      addTeam: (seasonId, name) => {
        const team = newTeam(name);
        set((s) =>
          modifySeason(s, seasonId, (se) => ({
            ...se,
            teams: [...se.teams, team],
            currentTeamId: team.id,
          })),
        );
        return team.id;
      },
      renameTeam: (seasonId, teamId, name) =>
        set((s) => modifyTeam(s, seasonId, teamId, (t) => ({ ...t, name }))),
      updateTeam: (seasonId, teamId, patch) =>
        set((s) => modifyTeam(s, seasonId, teamId, (t) => ({ ...t, ...patch }))),
      deleteTeam: (seasonId, teamId) =>
        set((s) =>
          modifySeason(s, seasonId, (se) => {
            const teams = se.teams.filter((t) => t.id !== teamId);
            return {
              ...se,
              teams,
              currentTeamId: se.currentTeamId === teamId ? teams[0]?.id : se.currentTeamId,
            };
          }),
        ),
      setCurrentTeam: (seasonId, teamId) =>
        set((s) => modifySeason(s, seasonId, (se) => ({ ...se, currentTeamId: teamId }))),

      addCategory: (seasonId, name, splitMode = "shared") =>
        set((s) =>
          modifySeason(s, seasonId, (se) => ({
            ...se,
            categories: [...se.categories, { id: uuid(), name, splitMode }],
          })),
        ),
      updateCategory: (seasonId, id, patch) =>
        set((s) =>
          modifySeason(s, seasonId, (se) => ({
            ...se,
            categories: se.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
          })),
        ),
      removeCategory: (seasonId, id) =>
        set((s) =>
          modifySeason(s, seasonId, (se) => ({
            ...se,
            categories: se.categories.filter((c) => c.id !== id),
            teams: se.teams.map((t) => ({
              ...t,
              matches: t.matches.map((m) => ({
                ...m,
                expenses: m.expenses.filter((e) => e.categoryId !== id),
              })),
            })),
          })),
        ),

      addRosterPlayer: (p) => {
        const id = uuid();
        set((s) => ({ ...s, roster: [...s.roster, { ...p, id }] }));
        return id;
      },
      updateRosterPlayer: (id, patch) =>
        set((s) => ({
          ...s,
          roster: s.roster.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        })),
      removeRosterPlayer: (id) =>
        set((s) => ({ ...s, roster: s.roster.filter((r) => r.id !== id) })),
      importRoster: (rows, replace = false) =>
        set((s) => {
          const next = rows.map((r) => ({ ...r, id: uuid() }));
          if (replace) return { ...s, roster: next };
          // Merge by affiliation (or lastName+firstName fallback)
          const existing = [...s.roster];
          for (const r of next) {
            const idx = existing.findIndex(
              (x) =>
                (r.affiliation && x.affiliation === r.affiliation) ||
                (x.lastName.toLowerCase() === r.lastName.toLowerCase() &&
                  x.firstName.toLowerCase() === r.firstName.toLowerCase()),
            );
            if (idx >= 0) existing[idx] = { ...existing[idx], ...r, id: existing[idx].id };
            else existing.push(r);
          }
          return { ...s, roster: existing };
        }),

      addPlayer: (seasonId, teamId, name, initial = 0) =>
        set((s) =>
          modifyTeam(s, seasonId, teamId, (t) => ({
            ...t,
            players: [...t.players, { id: uuid(), name, initialContribution: initial }],
          })),
        ),
      addPlayerFromRoster: (seasonId, teamId, rosterId, initial) =>
        set((s) => {
          const r = s.roster.find((x) => x.id === rosterId);
          if (!r) return s;
          const name = `${r.firstName} ${r.lastName}`.trim();
          const season = s.seasons.find((se) => se.id === seasonId);
          const team = season?.teams.find((t) => t.id === teamId);
          const fee = initial ?? team?.playerSeasonFee ?? season?.playerSeasonFee ?? 0;
          return modifyTeam(s, seasonId, teamId, (t) => {
            if (t.players.some((p) => p.rosterId === rosterId)) return t;
            return {
              ...t,
              players: [
                ...t.players,
                { id: uuid(), name, rosterId, initialContribution: fee },
              ],
            };
          });
        }),
      updatePlayer: (seasonId, teamId, id, patch) =>
        set((s) =>
          modifyTeam(s, seasonId, teamId, (t) => ({
            ...t,
            players: t.players.map((p) => (p.id === id ? { ...p, ...patch } : p)),
          })),
        ),
      removePlayer: (seasonId, teamId, id) =>
        set((s) =>
          modifyTeam(s, seasonId, teamId, (t) => ({
            ...t,
            players: t.players.filter((p) => p.id !== id),
            matches: t.matches.map((m) => ({
              ...m,
              playerIds: m.playerIds.filter((pid) => pid !== id),
            })),
          })),
        ),
      addPlayerContribution: (seasonId, teamId, playerId, c) =>
        set((s) =>
          modifyTeam(s, seasonId, teamId, (t) => ({
            ...t,
            players: t.players.map((p) =>
              p.id === playerId
                ? {
                    ...p,
                    contributions: [
                      ...(p.contributions ?? []),
                      { ...c, id: uuid() },
                    ],
                  }
                : p,
            ),
          })),
        ),
      removePlayerContribution: (seasonId, teamId, playerId, contributionId) =>
        set((s) =>
          modifyTeam(s, seasonId, teamId, (t) => ({
            ...t,
            players: t.players.map((p) =>
              p.id === playerId
                ? {
                    ...p,
                    contributions: (p.contributions ?? []).filter(
                      (c) => c.id !== contributionId,
                    ),
                  }
                : p,
            ),
          })),
        ),

      addMatch: (seasonId, teamId, label) => {
        const id = uuid();
        set((s) =>
          modifyTeam(s, seasonId, teamId, (t) => ({
            ...t,
            matches: [
              ...t.matches,
              {
                id,
                label: label ?? `Rencontre ${t.matches.length + 1}`,
                playerIds: [],
                expenses: [],
              },
            ],
          })),
        );
        return id;
      },
      updateMatch: (seasonId, teamId, matchId, patch) =>
        set((s) =>
          modifyTeam(s, seasonId, teamId, (t) => ({
            ...t,
            matches: t.matches.map((m) => (m.id === matchId ? { ...m, ...patch } : m)),
          })),
        ),
      removeMatch: (seasonId, teamId, matchId) =>
        set((s) =>
          modifyTeam(s, seasonId, teamId, (t) => ({
            ...t,
            matches: t.matches.filter((m) => m.id !== matchId),
          })),
        ),
      setMatchExpense: (seasonId, teamId, matchId, exp) =>
        set((s) =>
          modifyTeam(s, seasonId, teamId, (t) => ({
            ...t,
            matches: t.matches.map((m) => {
              if (m.id !== matchId) return m;
              const others = m.expenses.filter((e) => e.categoryId !== exp.categoryId);
              return { ...m, expenses: exp.amount ? [...others, exp] : others };
            }),
          })),
        ),
      toggleMatchPlayer: (seasonId, teamId, matchId, playerId) =>
        set((s) =>
          modifyTeam(s, seasonId, teamId, (t) => ({
            ...t,
            matches: t.matches.map((m) => {
              if (m.id !== matchId) return m;
              const present = m.playerIds.includes(playerId);
              return {
                ...m,
                playerIds: present
                  ? m.playerIds.filter((p) => p !== playerId)
                  : [...m.playerIds, playerId],
              };
            }),
          })),
        ),
      updateMatchResult: (seasonId, teamId, matchId, index, patch) =>
        set((s) =>
          modifyTeam(s, seasonId, teamId, (t) => ({
            ...t,
            matches: t.matches.map((m) => {
              if (m.id !== matchId) return m;
              const results = (m.results ?? []).map((r, i) =>
                i === index ? { ...r, ...patch } : r,
              );
              return { ...m, results };
            }),
          })),
        ),

      loadState: (state) => set(() => ({ ...state, roster: state.roster ?? [] })),
      resetAll: () => set(() => ({ seasons: [], currentSeasonId: undefined, roster: [] })),
    }),
    {
      name: "ic-couts-v2",
      version: 3,
      migrate: (persisted: unknown) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        return { seasons: p.seasons ?? [], currentSeasonId: p.currentSeasonId, roster: p.roster ?? [] } as AppState;
      },
    },
  ),
);

export function useCurrent() {
  const { seasons, currentSeasonId } = useStore();
  const season = seasons.find((s) => s.id === currentSeasonId);
  const team = season?.teams.find((t) => t.id === season.currentTeamId);
  return { season, team } as { season?: Season; team?: Team };
}
