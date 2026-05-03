import * as XLSX from "xlsx";
import type { AppState, Season, Team } from "./types";
import { v4 as uuid } from "uuid";

/** Exporte une équipe d'une saison vers un fichier xlsx */
export function exportSeasonToXlsx(seasonName: string, season: Season, team: Team) {
  const wb = XLSX.utils.book_new();

  // Sheet: Joueurs
  const playersData = team.players.map((p) => ({
    Joueur: p.name,
    "Montant versé": p.initialContribution,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(playersData), "Joueurs");

  // Sheet: Catégories
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      season.categories.map((c) => ({
        Catégorie: c.name,
        Mode: c.splitMode === "club" ? "Club" : "Partagé",
      })),
    ),
    "Catégories",
  );

  // Sheet: Rencontres
  const matchRows = team.matches.map((m) => {
    const row: Record<string, string | number> = { Rencontre: m.label };
    for (const c of season.categories) {
      const e = m.expenses.find((x) => x.categoryId === c.id);
      row[c.name] = e?.amount ?? 0;
    }
    row["Joueurs présents"] = m.playerIds
      .map((pid) => team.players.find((p) => p.id === pid)?.name ?? "")
      .filter(Boolean)
      .join(", ");
    return row;
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(matchRows), "Rencontres");

  // Sheet: Saison
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      { Paramètre: "Saison", Valeur: season.name },
      { Paramètre: "Équipe", Valeur: team.name },
      { Paramètre: "Budget club (€)", Valeur: season.clubBudget },
      { Paramètre: "Participation joueur défaut (€)", Valeur: season.playerSeasonFee },
    ]),
    "Saison",
  );

  XLSX.writeFile(wb, `${seasonName.replace(/\s+/g, "_")}_${team.name.replace(/\s+/g, "_")}.xlsx`);
}

/** Tente de parser un .xlsx similaire au modèle "couts_IC". Retourne une saison à équipe unique. */
export async function importSeasonFromXlsx(file: File, seasonName: string): Promise<Season> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null }) as (
    | string
    | number
    | null
  )[][];

  const teamId = uuid();
  const season: Season = {
    id: uuid(),
    name: seasonName,
    playerSeasonFee: 40,
    clubBudget: 0,
    categories: [],
    currentTeamId: teamId,
    teams: [{ id: teamId, name: "Équipe importée", players: [], matches: [] }],
  };
  const team = season.teams[0];

  // Catégories en ligne 2 cols C..F
  const catCols: { col: number; name: string; mode: "shared" | "club" }[] = [];
  const headerRow = grid[1] ?? [];
  for (let col = 2; col <= 5; col++) {
    const v = headerRow[col];
    if (typeof v === "string" && v.trim()) {
      const name = v.replace(/^Frais\s+/i, "").trim();
      const mode: "shared" | "club" = /volant/i.test(name) ? "club" : "shared";
      const cat = { id: uuid(), name, splitMode: mode };
      season.categories.push(cat);
      catCols.push({ col, name, mode });
    }
  }

  // Joueurs en colonne H (idx 7)
  for (let r = 2; r < grid.length; r++) {
    const v = grid[r]?.[7];
    if (typeof v === "string" && v.trim() && v !== "les cases ") {
      team.players.push({ id: uuid(), name: v.trim(), initialContribution: 40 });
    }
    if (r > 12) break;
  }

  // Participation initiale en M3 (idx [2][12])
  const m3 = grid[2]?.[12];
  if (typeof m3 === "number") {
    season.playerSeasonFee = m3;
    team.players = team.players.map((p) => ({ ...p, initialContribution: m3 }));
  }

  // Rencontres
  for (let r = 3; r < Math.min(grid.length, 20); r++) {
    const label = grid[r]?.[0];
    if (typeof label !== "string" || !/Rencontre/i.test(label)) continue;
    const expenses = catCols
      .map(({ col, name }) => {
        const v = grid[r]?.[col];
        const cat = season.categories.find((c) => c.name === name)!;
        return typeof v === "number" && v > 0 ? { categoryId: cat.id, amount: v } : null;
      })
      .filter((x): x is { categoryId: string; amount: number } => x !== null);
    team.matches.push({
      id: uuid(),
      label,
      playerIds: [],
      expenses,
    });
  }

  // Versements complémentaires
  for (let r = 44; r < grid.length; r++) {
    const playerName = grid[r]?.[0];
    if (typeof playerName !== "string") continue;
    const player = team.players.find((p) => p.name === playerName);
    if (!player) continue;
    let extra = 0;
    for (let col = 1; col <= 16; col++) {
      const v = grid[r]?.[col];
      if (typeof v === "number") extra += v;
    }
    if (extra > 0) player.initialContribution += extra;
  }

  return season;
}

export function exportAllJSON(state: AppState) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `couts-ic-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importAllJSON(file: File): Promise<AppState> {
  const txt = await file.text();
  return JSON.parse(txt) as AppState;
}
