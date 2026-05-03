import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStore, useCurrent } from "@/lib/store";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import {
  rankSinglesPlayers,
  rankDoublesPairs,
  suggestBestLineup,
  computePlayerStats,
  winRate,
} from "@/lib/stats";
import { Globe2, Trophy, Users2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/club-analyse")({
  head: () => ({ meta: [{ title: "Analyse Club — Gestion Interclubs Volanteux" }] }),
  component: Page,
});

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function Page() {
  const { season } = useCurrent();
  const { roster } = useStore();
  const [weight, setWeight] = useState(50);
  const [kind, setKind] = useState<"men" | "women" | "mixed">("men");

  if (!season)
    return (
      <AppShell>
        <EmptyState title="Pas de saison" description="Créez une saison." />
      </AppShell>
    );

  const allTeams = season.teams;
  const opts = { weightStats: weight / 100 };

  const sKind = kind === "women" ? "SD" : "SH";
  const dKind = kind === "women" ? "DD" : kind === "mixed" ? "MX" : "DH";

  const singles = rankSinglesPlayers(allTeams, roster, sKind, opts);
  const pairs = rankDoublesPairs(allTeams, roster, dKind, opts);
  const lineup = suggestBestLineup(allTeams, roster, { ...opts, kind });
  const stats = computePlayerStats(allTeams, roster).filter((s) => s.totals.played > 0);

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Globe2 className="h-6 w-6 text-primary" /> Analyse globale du club
        </h1>
        <p className="text-sm text-muted-foreground">
          Tous les joueurs du roster, toutes équipes confondues — saison {season.name}.
        </p>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Paramètres</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="mb-2 block">Discipline</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="men">Hommes (SH / DH)</SelectItem>
                <SelectItem value="women">Femmes (SD / DD)</SelectItem>
                <SelectItem value="mixed">Mixte (MX)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-2 block">
              Pondération · Classement {100 - weight}% / Statistiques {weight}%
            </Label>
            <Slider
              value={[weight]}
              onValueChange={(v) => setWeight(v[0])}
              min={0}
              max={100}
              step={5}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4 border-primary/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" /> Meilleure équipe possible (tout le club)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Simples
              </h3>
              <ol className="space-y-1.5">
                {lineup.singles.map((p, i) => (
                  <li
                    key={p.rosterId}
                    className="flex items-center gap-2 rounded-md border bg-card p-2 text-sm"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {i + 1}
                    </span>
                    <span className="flex-1 font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground">
                      Niv. {p.level ?? "?"} · {pct(p.winRate)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Doubles
              </h3>
              <ol className="space-y-1.5">
                {lineup.pairs.map((p, i) => (
                  <li
                    key={p.pairKey}
                    className="flex items-center gap-2 rounded-md border bg-card p-2 text-sm"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {i + 1}
                    </span>
                    <span className="flex-1 font-medium">
                      {p.names[0]} / {p.names[1]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Niv. ~{p.avgLevel.toFixed(1)} · {pct(p.winRate)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users2 className="h-5 w-5" /> Top simples ({sKind})
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Joueur</TableHead>
                  <TableHead className="text-right">Niv.</TableHead>
                  <TableHead className="text-right">% V.</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {singles.slice(0, 10).map((p, i) => (
                  <TableRow key={p.rosterId}>
                    <TableCell className="font-mono">{i + 1}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-right">{p.level ?? "?"}</TableCell>
                    <TableCell className="text-right">{pct(p.winRate)}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {(p.score * 100).toFixed(1)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users2 className="h-5 w-5" /> Top paires ({dKind})
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Paire</TableHead>
                  <TableHead className="text-right">Niv.</TableHead>
                  <TableHead className="text-right">% V.</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pairs.slice(0, 10).map((p, i) => (
                  <TableRow key={p.pairKey}>
                    <TableCell className="font-mono">{i + 1}</TableCell>
                    <TableCell className="font-medium">
                      {p.names[0]} / {p.names[1]}
                    </TableCell>
                    <TableCell className="text-right">
                      {p.avgLevel.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right">{pct(p.winRate)}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {(p.score * 100).toFixed(1)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Statistiques de tous les joueurs ayant joué</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Joueur</TableHead>
                <TableHead className="text-right">Joué</TableHead>
                <TableHead className="text-right">Gagnés</TableHead>
                <TableHead className="text-right">% V.</TableHead>
                <TableHead className="text-right">Sets</TableHead>
                <TableHead className="text-right">Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats
                .sort((a, b) => winRate(b.totals) - winRate(a.totals))
                .map((s) => (
                  <TableRow key={s.rosterId}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-right">{s.totals.played}</TableCell>
                    <TableCell className="text-right">{s.totals.won}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {pct(winRate(s.totals))}
                    </TableCell>
                    <TableCell className="text-right">
                      {s.totals.setsWon}-{s.totals.setsLost}
                    </TableCell>
                    <TableCell className="text-right">
                      {s.totals.pointsFor}-{s.totals.pointsAgainst}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}
