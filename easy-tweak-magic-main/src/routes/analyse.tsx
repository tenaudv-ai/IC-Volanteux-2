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
} from "@/lib/stats";
import { Sparkles, Trophy, Users2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/analyse")({
  head: () => ({ meta: [{ title: "Analyse — Gestion Interclubs Volanteux" }] }),
  component: Page,
});

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function Page() {
  const { season, team } = useCurrent();
  const { roster } = useStore();
  const [weight, setWeight] = useState(50);
  const [kind, setKind] = useState<"men" | "women" | "mixed">("men");

  if (!season || !team)
    return (
      <AppShell>
        <EmptyState title="Pas d'équipe" description="Choisissez une équipe d'abord." />
      </AppShell>
    );

  const rosterIds = team.players.map((p) => p.rosterId).filter(Boolean) as string[];
  const opts = { weightStats: weight / 100, rosterIds };

  const sKind = kind === "women" ? "SD" : "SH";
  const dKind = kind === "women" ? "DD" : kind === "mixed" ? "MX" : "DH";

  const singles = rankSinglesPlayers([team], roster, sKind, opts);
  const pairs = rankDoublesPairs([team], roster, dKind, opts);
  const lineup = suggestBestLineup([team], roster, { ...opts, kind });

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" /> Analyse — {team.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Meilleur joueur de simple, meilleure paire de double, équipe optimale.
        </p>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Paramètres</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4 border-primary/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" /> Équipe optimale suggérée
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lineup.singles.length === 0 && lineup.pairs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun joueur éligible dans le roster.
            </p>
          ) : (
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
                        Niv. {p.level ?? "?"} · {pct(p.winRate)} ({p.played})
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
                        Niv. ~{p.avgLevel.toFixed(1)} · {pct(p.winRate)} ({p.played})
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users2 className="h-5 w-5" /> Classement individuel ({sKind})
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Joueur</TableHead>
                <TableHead className="text-right">Niveau</TableHead>
                <TableHead className="text-right">Joué</TableHead>
                <TableHead className="text-right">% Vict.</TableHead>
                <TableHead className="text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {singles.slice(0, 10).map((p, i) => (
                <TableRow key={p.rosterId}>
                  <TableCell className="font-mono">{i + 1}</TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-right">{p.level ?? "?"}</TableCell>
                  <TableCell className="text-right">
                    {p.won}/{p.played}
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users2 className="h-5 w-5" /> Meilleures paires ({dKind})
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Paire</TableHead>
                <TableHead className="text-right">Niv. moy.</TableHead>
                <TableHead className="text-right">Joué</TableHead>
                <TableHead className="text-right">% Vict.</TableHead>
                <TableHead className="text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pairs.slice(0, 15).map((p, i) => (
                <TableRow key={p.pairKey}>
                  <TableCell className="font-mono">{i + 1}</TableCell>
                  <TableCell className="font-medium">
                    {p.names[0]} / {p.names[1]}
                  </TableCell>
                  <TableCell className="text-right">{p.avgLevel.toFixed(1)}</TableCell>
                  <TableCell className="text-right">
                    {p.won}/{p.played}
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
    </AppShell>
  );
}
