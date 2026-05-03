import type { RosterPlayer, Gender } from "./types";

/**
 * Parse a tab/space separated roster text. Expected columns (in order):
 *   Genre  Joueur/Joueuse  Numéro_affiliation  Joué  Simple  Double  Mixte
 */
export function parseRosterText(raw: string): Omit<RosterPlayer, "id">[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const out: Omit<RosterPlayer, "id">[] = [];

  for (const line of lines) {
    if (/^(hommes|femmes|joueur|genre|nom)/i.test(line) && !/\d{6,}/.test(line)) continue;

    const affMatch = line.match(/(\d{5,})/);
    if (!affMatch) continue;
    const affiliation = affMatch[1];

    const before = line.slice(0, affMatch.index!).trim();
    const after = line.slice(affMatch.index! + affiliation.length).trim();

    const genderMatch = before.match(/^([HFM])\b[\s\t]*(.*)$/i);
    let gender: Gender = "H";
    let nameRaw = before;
    if (genderMatch) {
      const g = genderMatch[1].toUpperCase();
      gender = g === "F" ? "F" : "H";
      nameRaw = genderMatch[2].trim();
    }

    let lastName = nameRaw;
    let firstName = "";
    if (nameRaw.includes(",")) {
      const [ln, fn] = nameRaw.split(",").map((s) => s.trim());
      lastName = ln;
      firstName = fn ?? "";
    } else {
      const parts = nameRaw.split(/\s+/);
      if (parts.length >= 2) {
        lastName = parts[0];
        firstName = parts.slice(1).join(" ");
      }
    }

    const nums = (after.match(/\d+/g) ?? []).map(Number);
    let levels: number[] = [];
    if (nums.length >= 4) {
      levels = nums.slice(0, 4);
    } else if (nums.length === 1 && String(nums[0]).length >= 2) {
      const s = String(nums[0]);
      for (let i = 0; i < s.length; ) {
        const two = parseInt(s.slice(i, i + 2), 10);
        if (two >= 10 && two <= 15) {
          levels.push(two);
          i += 2;
        } else {
          levels.push(parseInt(s[i], 10));
          i += 1;
        }
      }
    }

    out.push({
      gender,
      lastName,
      firstName,
      affiliation,
      levelPlayed: levels[0],
      levelSingle: levels[1],
      levelDouble: levels[2],
      levelMixed: levels[3],
    });
  }

  return out;
}

export interface ParsedMatchPlayer {
  rawName: string;
  /** Normalized for matching: lowercased, no accents */
  key: string;
}

export interface ParsedMatchResult {
  code: string;
  kind: "SH" | "SD" | "DH" | "DD" | "MX";
  home: ParsedMatchPlayer[];
  away: ParsedMatchPlayer[];
  sets: { home: number; away: number }[];
  homeWon?: boolean;
  forfeit?: boolean;
}

export interface ParsedMatch {
  label?: string;
  homePlayers: ParsedMatchPlayer[];
  awayPlayers: ParsedMatchPlayer[];
  rawLines: string[];
  results: ParsedMatchResult[];
  /** true si "notre équipe" (LES VOLANTEUX) est détectée comme jouant à domicile */
  weAreHome?: boolean;
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function extractPlayersFromLine(line: string): ParsedMatchPlayer[] {
  const out: ParsedMatchPlayer[] = [];
  const tokens = line
    .split(/(?<=\(\d+\))/)
    .map((t) => t.trim())
    .filter(Boolean);
  for (const token of tokens) {
    const cleaned = token.replace(/\s*\(\d+\)\s*$/, "").trim();
    if (!cleaned) continue;
    if (/^\d+(-\d+)?$/.test(cleaned)) continue;
    const key = norm(cleaned);
    if (!key || key.length < 3) continue;
    out.push({ rawName: cleaned, key });
  }
  return out;
}

function parseSets(line: string): { home: number; away: number }[] {
  const matches = line.match(/(\d+)\s*-\s*(\d+)/g) ?? [];
  return matches
    .map((m) => {
      const [h, a] = m.split("-").map((n) => parseInt(n.trim(), 10));
      return { home: h, away: a };
    })
    .filter((s) => !isNaN(s.home) && !isNaN(s.away));
}

function setsWinner(sets: { home: number; away: number }[]): boolean | undefined {
  if (sets.length === 0) return undefined;
  let h = 0;
  let a = 0;
  for (const s of sets) {
    if (s.home > s.away) h++;
    else if (s.away > s.home) a++;
  }
  if (h === a) return undefined;
  return h > a;
}

export function parseMatchText(raw: string): ParsedMatch {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Recherche d'une ligne de "label de rencontre" : contient " - " séparant 2 équipes,
  // ET au moins un code Tabt entre parenthèses.
  const headerLine =
    lines.find(
      (l) => /\s-\s/.test(l) && /\(\d+(?:-[A-Z]-\d+)?\)/.test(l) && /VOLANTEUX/i.test(l),
    ) ??
    lines.find((l) => /\s-\s/.test(l) && /VOLANTEUX/i.test(l)) ??
    lines.find((l) => /\(\d+(?:-[A-Z]-\d+)?\)/.test(l)) ??
    lines[0];
  const label = headerLine?.replace(/\s+\[.*?\]/g, "").trim();

  // Détection domicile/extérieur via le label : "ÉQUIPE DOMICILE - ÉQUIPE EXTÉRIEUR"
  let weAreHome: boolean | undefined;
  if (label && /VOLANTEUX/i.test(label)) {
    // Découpe sur " - " entouré d'espaces (pas sur "BC-XYZ")
    const sep = label.split(/\s+-\s+/);
    if (sep.length >= 2) {
      const homeSide = sep[0].toUpperCase();
      const awaySide = sep.slice(1).join(" - ").toUpperCase();
      const inHome = /VOLANTEUX/.test(homeSide);
      const inAway = /VOLANTEUX/.test(awaySide);
      if (inHome && !inAway) weAreHome = true;
      else if (inAway && !inHome) weAreHome = false;
    }
  }

  const home = new Map<string, ParsedMatchPlayer>();
  const away = new Map<string, ParsedMatchPlayer>();
  const rawLines: string[] = [];
  const results: ParsedMatchResult[] = [];

  let cur: ParsedMatchResult | null = null;
  let mode: "home" | "away" | null = null;

  const pushCur = () => {
    if (cur) {
      cur.homeWon = setsWinner(cur.sets);
      results.push(cur);
      cur = null;
      mode = null;
    }
  };

  for (const line of lines) {
    const tagMatch = line.match(/^(SH|SD|DH|DD|MX|MD)\s*(\d+)$/i);
    if (tagMatch) {
      pushCur();
      const kindRaw = tagMatch[1].toUpperCase();
      const kind = (kindRaw === "MD" ? "MX" : kindRaw) as ParsedMatchResult["kind"];
      cur = {
        code: `${kind}${tagMatch[2]}`,
        kind,
        home: [],
        away: [],
        sets: [],
      };
      mode = "home";
      rawLines.push(line);
      continue;
    }
    if (line === "-") {
      mode = "away";
      continue;
    }
    if (/^[\d\s\-]+$/.test(line) && /\d/.test(line)) {
      if (cur) cur.sets = parseSets(line);
      mode = null;
      continue;
    }
    if (/forfait|wo|w\.o\./i.test(line)) {
      if (cur) cur.forfeit = true;
      continue;
    }
    if (!mode || !cur) continue;

    const players = extractPlayersFromLine(line);
    for (const p of players) {
      if (mode === "home") {
        cur.home.push(p);
        if (!home.has(p.key)) home.set(p.key, p);
      } else {
        cur.away.push(p);
        if (!away.has(p.key)) away.set(p.key, p);
      }
    }
    if (players.length > 0) {
      rawLines.push(`  ${mode === "home" ? "→" : "←"} ${line}`);
    }
  }
  pushCur();

  return {
    label,
    homePlayers: [...home.values()],
    awayPlayers: [...away.values()],
    rawLines,
    results,
    weAreHome,
  };
}

export function rosterMatchKey(p: { firstName: string; lastName: string }) {
  return norm(`${p.firstName} ${p.lastName}`);
}

export function findRosterMatch<T extends { firstName: string; lastName: string }>(
  parsedKey: string,
  roster: T[],
): T | undefined {
  const tokens = parsedKey.split(" ").filter(Boolean);
  return roster.find((r) => {
    const a = rosterMatchKey(r);
    const b = norm(`${r.lastName} ${r.firstName}`);
    if (a === parsedKey || b === parsedKey) return true;
    const full = `${a} ${b}`;
    return tokens.every((t) => full.includes(t));
  });
}
