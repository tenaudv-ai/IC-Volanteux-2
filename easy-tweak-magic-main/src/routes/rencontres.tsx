import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStore, useCurrent } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  FileDown,
  PenLine,
  Check,
  X,
  Trophy,
  AlertCircle,
} from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { computeTeam, fmt } from "@/lib/compute";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { findRosterMatch, parseMatchText, type ParsedMatch } from "@/lib/import-text";
import { toast } from "sonner";
import type { MatchKind, MatchResult } from "@/lib/types";

export const Route = createFileRoute("/rencontres")({
  head: () => ({ meta: [{ title: "Rencontres — Gestion Interclubs Volanteux" }] }),
  component: Page,
});

const MATCH_KINDS: { value: MatchKind; label: string; singles: boolean }[] = [
  { value: "SH", label: "Simple Homme", singles: true },
  { value: "SD", label: "Simple Dame", singles: true },
  { value: "DH", label: "Double Homme", singles: false },
  { value: "DD", label: "Double Dame", singles: false },
  { value: "MX", label: "Mixte", singles: false },
];

const KIND_COLORS: Record<MatchKind, string> = {
  SH: "bg-blue-500/10 text-blue-700 border-blue-300 dark:text-blue-400",
  SD: "bg-pink-500/10 text-pink-700 border-pink-300 dark:text-pink-400",
  DH: "bg-indigo-500/10 text-indigo-700 border-indigo-300 dark:text-indigo-400",
  DD: "bg-rose-500/10 text-rose-700 border-rose-300 dark:text-rose-400",
  MX: "bg-violet-500/10 text-violet-700 border-violet-300 dark:text-violet-400",
};

function SetsDisplay({
  sets,
  homeWon,
}: {
  sets: { home: number; away: number }[];
  homeWon?: boolean;
}) {
  if (!sets || sets.length === 0)
    return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {sets.map((s, i) => {
        const weWon = s.home > s.away;
        return (
          <span
            key={i}
            className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-mono font-semibold border ${
              weWon
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
                : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800"
            }`}
          >
            {s.home}
            <span className="opacity-50">-</span>
            {s.away}
          </span>
        );
      })}
      {homeWon !== undefined && (
        <span
          className={`ml-0.5 text-xs font-bold ${homeWon ? "text-emerald-600" : "text-red-500"}`}
        >
          {homeWon ? "✓" : "✗"}
        </span>
      )}
    </div>
  );
}

function AddMatchResultForm({
  seasonId,
  teamId,
  matchId,
  existingResults,
  roster,
  teamPlayers,
  onDone,
}: {
  seasonId: string;
  teamId: string;
  matchId: string;
  existingResults: MatchResult[];
  roster: ReturnType<typeof useStore.getState>["roster"];
  teamPlayers: { id: string; name: string; rosterId?: string }[];
  onDone: () => void;
}) {
  const { updateMatch } = useStore();
  const [kind, setKind] = useState<MatchKind>("SH");
  const [num, setNum] = useState("1");
  const [homeRosterIds, setHomeRosterIds] = useState<string[]>([""]);
  const [awayNames, setAwayNames] = useState<string[]>([""]);
  const [sets, setSets] = useState<{ home: number; away: number }[]>([{ home: 0, away: 0 }]);
  const [forfeit, setForfeit] = useState(false);

  const isSingles = MATCH_KINDS.find((k) => k.value === kind)?.singles ?? true;
  const maxPlayers = isSingles ? 1 : 2;

  function setHomeSlot(i: number, val: string) {
    const next = [...homeRosterIds];
    next[i] = val;
    setHomeRosterIds(next);
  }
  function setAwaySlot(i: number, val: string) {
    const next = [...awayNames];
    next[i] = val;
    setAwayNames(next);
  }
  function setSet(i: number, side: "home" | "away", val: number) {
    const next = sets.map((s, si) => (si === i ? { ...s, [side]: val } : s));
    setSets(next);
  }

  function deriveHomeWon(s: { home: number; away: number }[]) {
    let h = 0,
      a = 0;
    for (const x of s) {
      if (x.home > x.away) h++;
      else if (x.away > x.home) a++;
    }
    if (h === a) return undefined;
    return h > a;
  }

  function handleSave() {
    const slots = Array.from({ length: maxPlayers });
    const rIds = slots.map((_, i) => homeRosterIds[i] ?? "").filter(Boolean);
    const awNm = slots.map((_, i) => awayNames[i] ?? "").filter(Boolean);
    const cleanSets = forfeit ? [] : sets.filter((s) => s.home > 0 || s.away > 0);
    const newResult: MatchResult = {
      code: `${kind}${num}`,
      kind,
      homeRosterIds: rIds,
      awayNames: awNm,
      sets: cleanSets,
      homeWon: forfeit ? true : deriveHomeWon(cleanSets),
      forfeit,
    };
    updateMatch(seasonId, teamId, matchId, {
      results: [...existingResults, newResult],
    });
    onDone();
    toast.success(`Match ${newResult.code} ajouté`);
  }

  function handleKindChange(v: MatchKind) {
    setKind(v);
    const isSing = MATCH_KINDS.find((k) => k.value === v)?.singles ?? true;
    const max = isSing ? 1 : 2;
    setHomeRosterIds((prev) =>
      prev.length > max ? prev.slice(0, max) : [...prev, ""].slice(0, max),
    );
    setAwayNames((prev) =>
      prev.length > max ? prev.slice(0, max) : [...prev, ""].slice(0, max),
    );
  }

  return (
    <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-4 space-y-4">
      <h4 className="font-semibold text-sm flex items-center gap-2">
        <PenLine className="h-4 w-4 text-primary" />
        Ajouter un match individuel
      </h4>

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[160px]">
          <Label className="mb-1.5 block text-xs">Type</Label>
          <Select value={kind} onValueChange={(v) => handleKindChange(v as MatchKind)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MATCH_KINDS.map((k) => (
                <SelectItem key={k.value} value={k.value}>
                  {k.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-20">
          <Label className="mb-1.5 block text-xs">N°</Label>
          <Input
            type="number"
            min={1}
            max={9}
            value={num}
            onChange={(e) => setNum(e.target.value)}
            className="h-9 text-center"
          />
        </div>
        <div className="flex items-end pb-0.5">
          <label className="flex items-center gap-2 cursor-pointer text-sm h-9">
            <Checkbox checked={forfeit} onCheckedChange={(v) => setForfeit(!!v)} />
            Forfait (WO)
          </label>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5 block text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
            Notre équipe ({maxPlayers} joueur{maxPlayers > 1 ? "s" : ""})
          </Label>
          <div className="space-y-1.5">
            {Array.from({ length: maxPlayers }).map((_, i) => (
              <Select
                key={i}
                value={homeRosterIds[i] ?? ""}
                onValueChange={(v) => setHomeSlot(i, v)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="— choisir —" />
                </SelectTrigger>
                <SelectContent>
                  {teamPlayers.map((p) => {
                    const r = roster.find((x) => x.id === p.rosterId);
                    const label = r ? `${r.firstName} ${r.lastName}`.trim() : p.name;
                    return (
                      <SelectItem key={p.id} value={p.rosterId ?? p.id}>
                        {label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            ))}
          </div>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground font-semibold">
            Adversaire{maxPlayers > 1 ? "s" : ""}
          </Label>
          <div className="space-y-1.5">
            {Array.from({ length: maxPlayers }).map((_, i) => (
              <Input
                key={i}
                placeholder="Nom adversaire"
                value={awayNames[i] ?? ""}
                onChange={(e) => setAwaySlot(i, e.target.value)}
                className="h-9 text-sm"
              />
            ))}
          </div>
        </div>
      </div>

      {!forfeit && (
        <div>
          <Label className="mb-1.5 block text-xs">Sets</Label>
          <div className="flex flex-wrap items-center gap-2">
            {sets.map((s, i) => (
              <div key={i} className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  value={s.home}
                  onChange={(e) => setSet(i, "home", parseInt(e.target.value) || 0)}
                  className="h-8 w-14 text-center text-sm"
                />
                <span className="text-muted-foreground text-xs font-mono">–</span>
                <Input
                  type="number"
                  min={0}
                  value={s.away}
                  onChange={(e) => setSet(i, "away", parseInt(e.target.value) || 0)}
                  className="h-8 w-14 text-center text-sm"
                />
                {sets.length > 1 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => setSets(sets.filter((_, si) => si !== i))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => setSets([...sets, { home: 0, away: 0 }])}
            >
              + Set
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-2 justify-end pt-1">
        <Button size="sm" variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <Button size="sm" onClick={handleSave}>
          <Check className="h-4 w-4" /> Ajouter
        </Button>
      </div>
    </div>
  );
}

function MatchResultRow({
  result,
  idx,
  seasonId,
  teamId,
  matchId,
  matchResults,
  roster,
}: {
  result: MatchResult;
  idx: number;
  seasonId: string;
  teamId: string;
  matchId: string;
  matchResults: MatchResult[];
  roster: ReturnType<typeof useStore.getState>["roster"];
}) {
  const { updateMatch } = useStore();
  const [editingSets, setEditingSets] = useState(false);

  function deriveHomeWon(s: { home: number; away: number }[]) {
    let h = 0,
      a = 0;
    for (const x of s) {
      if (x.home > x.away) h++;
      else if (x.away > x.home) a++;
    }
    if (h === a) return undefined;
    return h > a;
  }

  function updateResult(patch: Partial<MatchResult>) {
    const updated = matchResults.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    updateMatch(seasonId, teamId, matchId, { results: updated });
  }

  function updateSet(si: number, side: "home" | "away", val: number) {
    const newSets = result.sets.map((s, i) => (i === si ? { ...s, [side]: val } : s));
    updateResult({ sets: newSets, homeWon: deriveHomeWon(newSets) });
  }

  const homeNames = result.homeRosterIds
    .map((rid) => {
      const r = roster.find((x) => x.id === rid);
      return r ? `${r.firstName} ${r.lastName}`.trim() : "?";
    })
    .join(" / ");

  const awayNamesStr = result.awayNames.join(" / ");
  const kindColor = KIND_COLORS[result.kind] ?? "";

  return (
    <div
      className={`rounded-lg border p-3 space-y-2 transition-colors ${
        result.homeWon === true
          ? "border-emerald-300/60 bg-emerald-50/50 dark:border-emerald-800/60 dark:bg-emerald-950/20"
          : result.homeWon === false
            ? "border-red-300/40 bg-red-50/40 dark:border-red-800/40 dark:bg-red-950/20"
            : "border-border bg-card"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-mono font-bold ${kindColor}`}
        >
          {result.code}
        </span>

        <div className="flex flex-1 items-center gap-1.5 flex-wrap min-w-0">
          <span
            className={`text-sm font-semibold ${result.homeWon === true ? "text-emerald-700 dark:text-emerald-400" : ""}`}
          >
            {homeNames || "—"}
          </span>
          <span className="text-muted-foreground text-xs">vs</span>
          <span className="text-sm text-muted-foreground">{awayNamesStr || "—"}</span>
        </div>

        {result.forfeit && (
          <Badge variant="outline" className="text-xs border-amber-400 text-amber-600">
            WO
          </Badge>
        )}

        {result.homeWon === true && (
          <Trophy className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
        )}
        {result.homeWon === false && <X className="h-3.5 w-3.5 text-red-400 shrink-0" />}

        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          onClick={() => {
            const updated = matchResults.filter((_, i) => i !== idx);
            updateMatch(seasonId, teamId, matchId, { results: updated });
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {!result.forfeit && (
        <div className="flex flex-wrap items-center gap-2">
          {!editingSets ? (
            <>
              <SetsDisplay sets={result.sets} homeWon={result.homeWon} />
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setEditingSets(true)}
              >
                <PenLine className="h-3 w-3 mr-1" />
                Modifier
              </Button>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {result.sets.map((s, si) => (
                <div key={si} className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">S{si + 1}:</span>
                  <Input
                    type="number"
                    min={0}
                    defaultValue={s.home}
                    className="h-7 w-12 text-center text-xs"
                    onBlur={(e) => updateSet(si, "home", parseInt(e.target.value) || 0)}
                  />
                  <span className="text-muted-foreground text-xs">–</span>
                  <Input
                    type="number"
                    min={0}
                    defaultValue={s.away}
                    className="h-7 w-12 text-center text-xs"
                    onBlur={(e) => updateSet(si, "away", parseInt(e.target.value) || 0)}
                  />
                  {result.sets.length > 1 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => {
                        const ns = result.sets.filter((_, i) => i !== si);
                        updateResult({ sets: ns, homeWon: deriveHomeWon(ns) });
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() =>
                  updateResult({
                    sets: [...result.sets, { home: 0, away: 0 }],
                    homeWon: deriveHomeWon([...result.sets, { home: 0, away: 0 }]),
                  })
                }
              >
                + Set
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setEditingSets(false)}
              >
                <Check className="h-3 w-3 mr-1" /> OK
              </Button>
            </div>
          )}
        </div>
      )}

      {result.sets.length === 0 && !result.forfeit && (
        <div className="flex items-center gap-2">
          <select
            className="h-7 rounded-md border bg-background px-2 text-xs"
            value={result.homeWon === undefined ? "" : result.homeWon ? "won" : "lost"}
            onChange={(e) => {
              const v = e.target.value;
              updateResult({ homeWon: v === "" ? undefined : v === "won" });
            }}
          >
            <option value="">Résultat ?</option>
            <option value="won">Gagné</option>
            <option value="lost">Perdu</option>
          </select>
        </div>
      )}
    </div>
  );
}

function Page() {
  const { season, team } = useCurrent();
  const {
    addMatch,
    removeMatch,
    updateMatch,
    setMatchExpense,
    toggleMatchPlayer,
    addRosterPlayer,
    addPlayerFromRoster,
    roster,
  } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [parsed, setParsed] = useState<ParsedMatch | null>(null);
  const [weAreHome, setWeAreHome] = useState(true);
  const [matchMap, setMatchMap] = useState<Record<string, string>>({});
  const [showAddResult, setShowAddResult] = useState<string | null>(null);

  if (!season)
    return (
      <AppShell>
        <EmptyState title="Pas de saison" description="Créez une saison pour commencer." />
      </AppShell>
    );
  if (!team)
    return (
      <AppShell>
        <EmptyState title="Aucune équipe" description="Choisissez ou créez une équipe." />
      </AppShell>
    );

  const totals = computeTeam(season, team);

  function detectOurSide(p: ParsedMatch): boolean {
    if (p.weAreHome !== undefined) return p.weAreHome;
    const homeHits = p.homePlayers.filter((hp) => findRosterMatch(hp.key, roster)).length;
    const awayHits = p.awayPlayers.filter((hp) => findRosterMatch(hp.key, roster)).length;
    if (homeHits === 0 && awayHits === 0) return true;
    return homeHits >= awayHits;
  }

  function previewParse(text: string) {
    const p = parseMatchText(text);
    setParsed(p);
    const ourSideIsHome = detectOurSide(p);
    setWeAreHome(ourSideIsHome);
    const ourPlayers = ourSideIsHome ? p.homePlayers : p.awayPlayers;
    const map: Record<string, string> = {};
    for (const hp of ourPlayers) {
      const r = findRosterMatch(hp.key, roster);
      map[hp.rawName] = r ? r.id : "__new__";
    }
    setMatchMap(map);
  }

  function recomputeMap(p: ParsedMatch, ourIsHome: boolean) {
    const ourPlayers = ourIsHome ? p.homePlayers : p.awayPlayers;
    const map: Record<string, string> = {};
    for (const hp of ourPlayers) {
      const r = findRosterMatch(hp.key, roster);
      map[hp.rawName] = r ? r.id : "__new__";
    }
    setMatchMap(map);
  }

  function applyImport() {
    if (!parsed || !season || !team) return;
    const ourPlayers = weAreHome ? parsed.homePlayers : parsed.awayPlayers;
    const nameToRoster: Record<string, string> = {};
    for (const hp of ourPlayers) {
      const choice = matchMap[hp.rawName];
      if (!choice) continue;
      let rosterId = choice;
      if (choice === "__new__") {
        const parts = hp.rawName.split(/\s+/);
        const first = parts[0] ?? hp.rawName;
        const last = parts.slice(1).join(" ") || hp.rawName;
        rosterId = addRosterPlayer({
          gender: "H",
          firstName: first,
          lastName: last,
          affiliation: "",
        });
      }
      const existing = team.players.find((p) => p.rosterId === rosterId);
      if (!existing) addPlayerFromRoster(season.id, team.id, rosterId);
      nameToRoster[hp.rawName] = rosterId;
    }
    const resolvedRosterIds = [...new Set(Object.values(nameToRoster))];
    const fresh = useStore
      .getState()
      .seasons.find((s) => s.id === season.id)
      ?.teams.find((t) => t.id === team.id);
    const playerIdsForMatch: string[] = [];
    if (fresh) {
      for (const rid of resolvedRosterIds) {
        const tp = fresh.players.find((p) => p.rosterId === rid);
        if (tp) playerIdsForMatch.push(tp.id);
      }
    }

    const results = parsed.results.map((r) => {
      const ourSide = weAreHome ? r.home : r.away;
      const oppSide = weAreHome ? r.away : r.home;
      const sets = weAreHome ? r.sets : r.sets.map((s) => ({ home: s.away, away: s.home }));
      const homeWon =
        r.homeWon === undefined ? undefined : weAreHome ? r.homeWon : !r.homeWon;
      return {
        code: r.code,
        kind: r.kind,
        homeRosterIds: ourSide
          .map((p) => nameToRoster[p.rawName])
          .filter((x): x is string => Boolean(x)),
        awayNames: oppSide.map((p) => p.rawName),
        sets,
        homeWon,
        forfeit: r.forfeit,
      };
    });

    const matchId = addMatch(season.id, team.id, parsed.label || "Rencontre importée");
    for (const pid of playerIdsForMatch) {
      toggleMatchPlayer(season.id, team.id, matchId, pid);
    }
    updateMatch(season.id, team.id, matchId, { results, isHome: weAreHome });
    setOpenId(matchId);
    setImportOpen(false);
    setImportText("");
    setParsed(null);
    setMatchMap({});
    toast.success(
      `Rencontre importée (${weAreHome ? "domicile" : "extérieur"}) : ${playerIdsForMatch.length} joueur·s, ${results.length} match·s`,
    );
  }

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Rencontres — {team.name}</h1>
          <p className="text-sm text-muted-foreground">{season.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary">
                <FileDown className="h-4 w-4" /> Importer (texte)
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Importer une rencontre depuis Tabt</DialogTitle>
                <DialogDescription>
                  Collez le texte de la rencontre (copié depuis Tabt). L'app détecte
                  automatiquement les joueurs et les scores.
                </DialogDescription>
              </DialogHeader>

              <Textarea
                rows={8}
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value);
                  if (e.target.value.trim()) previewParse(e.target.value);
                  else setParsed(null);
                }}
                placeholder={`LES VOLANTEUX 1 (M) [339] (180-M-1) - BC METTET 2 ...\nDH1\nMartin GILSON (10)Daryl CARVAJAL (12)\n-\nEric Marchal (12)David Lecrinier (12)\n21-13 21-12\n...`}
                className="font-mono text-xs"
              />

              {parsed &&
                (() => {
                  const ourPlayers = weAreHome ? parsed.homePlayers : parsed.awayPlayers;
                  const oppPlayers = weAreHome ? parsed.awayPlayers : parsed.homePlayers;
                  const won = parsed.results.filter(
                    (r) => r.homeWon === (weAreHome ? true : false),
                  ).length;
                  const lost = parsed.results.filter(
                    (r) => r.homeWon === (weAreHome ? false : true),
                  ).length;

                  return (
                    <div className="space-y-4">
                      <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                        {parsed.label && (
                          <p className="text-sm font-semibold">{parsed.label}</p>
                        )}
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>🏸 {parsed.results.length} match·s parsés</span>
                          {parsed.results.length > 0 && (
                            <span>
                              <span className="text-emerald-600 font-semibold">{won}V</span>
                              {" – "}
                              <span className="text-red-500 font-semibold">{lost}D</span>
                            </span>
                          )}
                          <span>{ourPlayers.length} joueur·s détectés</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2">
                        <span className="text-sm font-medium">Notre équipe joue :</span>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant={weAreHome ? "default" : "outline"}
                            onClick={() => {
                              setWeAreHome(true);
                              recomputeMap(parsed, true);
                            }}
                          >
                            À domicile
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={!weAreHome ? "default" : "outline"}
                            onClick={() => {
                              setWeAreHome(false);
                              recomputeMap(parsed, false);
                            }}
                          >
                            À l'extérieur
                          </Button>
                        </div>
                        {parsed.weAreHome !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            (auto-détecté : {parsed.weAreHome ? "domicile" : "extérieur"})
                          </span>
                        )}
                      </div>

                      {parsed.results.length > 0 && (
                        <div>
                          <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Aperçu des matchs parsés
                          </Label>
                          <div className="space-y-px rounded-md border divide-y overflow-hidden">
                            {parsed.results.map((r, i) => {
                              const ourSide = weAreHome ? r.home : r.away;
                              const oppSide = weAreHome ? r.away : r.home;
                              const sets = weAreHome
                                ? r.sets
                                : r.sets.map((s) => ({ home: s.away, away: s.home }));
                              const weWon =
                                r.homeWon === undefined
                                  ? undefined
                                  : weAreHome
                                    ? r.homeWon
                                    : !r.homeWon;
                              const kindColor = KIND_COLORS[r.kind] ?? "";
                              return (
                                <div
                                  key={i}
                                  className={`flex flex-wrap items-center gap-2 px-3 py-2 text-xs ${weWon === true ? "bg-emerald-50/60 dark:bg-emerald-950/20" : weWon === false ? "bg-red-50/40 dark:bg-red-950/20" : ""}`}
                                >
                                  <span
                                    className={`font-mono font-bold rounded border px-1.5 py-0.5 ${kindColor}`}
                                  >
                                    {r.code}
                                  </span>
                                  <span className="font-medium">
                                    {ourSide.map((p) => p.rawName).join(" / ") || "—"}
                                  </span>
                                  <span className="text-muted-foreground">vs</span>
                                  <span className="text-muted-foreground">
                                    {oppSide.map((p) => p.rawName).join(" / ") || "—"}
                                  </span>
                                  <div className="ml-auto">
                                    <SetsDisplay sets={sets} homeWon={weWon} />
                                  </div>
                                  {r.forfeit && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] border-amber-400 text-amber-600"
                                    >
                                      WO
                                    </Badge>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {ourPlayers.length > 0 && (
                        <div>
                          <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Association joueurs ({ourPlayers.length} détectés)
                          </Label>
                          <div className="space-y-1.5">
                            {ourPlayers.map((hp) => {
                              const matched = roster.find((r) => r.id === matchMap[hp.rawName]);
                              return (
                                <div key={hp.rawName} className="flex items-center gap-2">
                                  <span
                                    className={`flex-1 text-sm flex items-center gap-1.5 ${!matched && matchMap[hp.rawName] !== "__new__" ? "text-amber-600" : ""}`}
                                  >
                                    {!matched && matchMap[hp.rawName] !== "__new__" && (
                                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                    )}
                                    {hp.rawName}
                                  </span>
                                  <select
                                    className="h-9 rounded-md border bg-background px-2 text-sm min-w-[180px]"
                                    value={matchMap[hp.rawName] ?? ""}
                                    onChange={(e) =>
                                      setMatchMap({ ...matchMap, [hp.rawName]: e.target.value })
                                    }
                                  >
                                    <option value="">— ignorer —</option>
                                    <option value="__new__">+ Créer dans le roster</option>
                                    {roster.map((r) => (
                                      <option key={r.id} value={r.id}>
                                        {r.lastName} {r.firstName}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {oppPlayers.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Adversaires : {oppPlayers.map((p) => p.rawName).join(", ")}
                        </p>
                      )}
                    </div>
                  );
                })()}

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setImportOpen(false);
                    setParsed(null);
                    setImportText("");
                  }}
                >
                  Annuler
                </Button>
                <Button onClick={applyImport} disabled={!parsed}>
                  Créer la rencontre
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            onClick={() => {
              const id = addMatch(season.id, team.id);
              setOpenId(id);
            }}
          >
            <Plus className="h-4 w-4" /> Ajouter
          </Button>
        </div>
      </div>

      {team.matches.length === 0 && (
        <EmptyState
          title="Aucune rencontre"
          description='Cliquez sur "Ajouter" ou importez depuis Tabt.'
        />
      )}

      <div className="space-y-3">
        {team.matches.map((m) => {
          const isOpen = openId === m.id;
          const total = m.expenses.reduce((s, e) => s + e.amount, 0);
          const results = m.results ?? [];
          const won = results.filter((r) => r.homeWon === true).length;
          const lost = results.filter((r) => r.homeWon === false).length;

          return (
            <Card key={m.id}>
              <CardHeader
                className="cursor-pointer"
                onClick={() => setOpenId(isOpen ? null : m.id)}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  )}
                  <Input
                    className="max-w-xs"
                    defaultValue={m.label}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) =>
                      updateMatch(season.id, team.id, m.id, { label: e.target.value })
                    }
                  />
                  {results.length > 0 && (
                    <div className="flex items-center gap-1 text-xs font-semibold">
                      <span className="text-emerald-600">{won}V</span>
                      <span className="text-muted-foreground">–</span>
                      <span className="text-red-500">{lost}D</span>
                    </div>
                  )}
                  <span className="ml-auto text-sm text-muted-foreground">
                    {m.playerIds.length} joueur·s · {fmt(total)}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeMatch(season.id, team.id, m.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              {isOpen && (
                <CardContent className="space-y-5">
                  <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                    <Checkbox
                      checked={!!m.isHome}
                      onCheckedChange={(v) =>
                        updateMatch(season.id, team.id, m.id, { isHome: !!v })
                      }
                    />
                    À domicile (consomme des volants)
                  </label>

                  <div>
                    <Label className="mb-2 block">Frais</Label>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {season.categories.map((c) => {
                        const e = m.expenses.find((x) => x.categoryId === c.id);
                        return (
                          <div
                            key={c.id}
                            className="flex items-center gap-2 rounded-md border p-2"
                          >
                            <span className="flex-1 text-sm">
                              {c.name}
                              <span className="ml-1 text-xs text-muted-foreground">
                                ({c.splitMode === "club" ? "club" : "partagé"})
                              </span>
                            </span>
                            <Input
                              type="number"
                              step="0.01"
                              defaultValue={e?.amount ?? ""}
                              className="w-28 text-right"
                              onBlur={(ev) =>
                                setMatchExpense(season.id, team.id, m.id, {
                                  categoryId: c.id,
                                  amount: parseFloat(ev.target.value) || 0,
                                })
                              }
                            />
                            <span className="text-xs text-muted-foreground">€</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <Label className="mb-2 block">Joueurs présents</Label>
                    <div className="flex flex-wrap gap-2">
                      {team.players.map((p) => {
                        const checked = m.playerIds.includes(p.id);
                        return (
                          <label
                            key={p.id}
                            className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${checked ? "border-primary bg-primary/10" : "hover:bg-muted"}`}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() =>
                                toggleMatchPlayer(season.id, team.id, m.id, p.id)
                              }
                            />
                            {p.name}
                          </label>
                        );
                      })}
                    </div>
                    {team.players.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        Ajoutez d'abord des joueurs dans l'onglet Joueurs.
                      </p>
                    )}
                  </div>

                  {/* Matchs individuels */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-base">
                        Matchs individuels{" "}
                        {results.length > 0 && (
                          <span className="font-normal text-sm text-muted-foreground">
                            ({won}V – {lost}D sur {results.length})
                          </span>
                        )}
                      </Label>
                      {showAddResult !== m.id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowAddResult(m.id)}
                        >
                          <Plus className="h-3.5 w-3.5" /> Ajouter un match
                        </Button>
                      )}
                    </div>

                    {showAddResult === m.id && (
                      <div className="mb-3">
                        <AddMatchResultForm
                          seasonId={season.id}
                          teamId={team.id}
                          matchId={m.id}
                          existingResults={results}
                          roster={roster}
                          teamPlayers={team.players}
                          onDone={() => setShowAddResult(null)}
                        />
                      </div>
                    )}

                    {results.length > 0 ? (
                      <div className="space-y-2">
                        {results.map((r, idx) => (
                          <MatchResultRow
                            key={idx}
                            result={r}
                            idx={idx}
                            seasonId={season.id}
                            teamId={team.id}
                            matchId={m.id}
                            matchResults={results}
                            roster={roster}
                          />
                        ))}
                      </div>
                    ) : (
                      !showAddResult && (
                        <p className="text-sm text-muted-foreground italic">
                          Aucun match individuel. Importez depuis Tabt ou ajoutez manuellement.
                        </p>
                      )
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {totals.players.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Récap équipe</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Total dépenses :{" "}
            <span className="font-semibold text-foreground">{fmt(totals.totalExpenses)}</span> ·
            Pris en charge club :{" "}
            <span className="font-semibold text-foreground">{fmt(totals.clubSubsidyTotal)}</span>{" "}
            (budget saison : {fmt(season.clubBudget)})
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
