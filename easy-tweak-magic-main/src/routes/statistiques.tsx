import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStore, useCurrent } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { computePlayerStats, winRate, setRate, pointRate } from "@/lib/stats";
import type { MatchKind } from "@/lib/types";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/statistiques")({
  head: () => ({ meta: [{ title: "Statistiques — Gestion Interclubs Volanteux" }] }),
  component: Page,
});

const KINDS: { kind: MatchKind; label: string }[] = [
  { kind: "SH", label: "Simples H" },
  { kind: "SD", label: "Simples D" },
  { kind: "DH", label: "Doubles H" },
  { kind: "DD", label: "Doubles D" },
  { kind: "MX", label: "Mixtes" },
];

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function Page() {
  const { season, team } = useCurrent();
  const { roster } = useStore();

  if (!season || !team)
    return (
      <AppShell>
        <EmptyState title="Pas d'équipe" description="Choisissez une équipe d'abord." />
      </AppShell>
    );

  const stats = computePlayerStats([team], roster).filter((s) => s.totals.played > 0);
  const usedKinds = KINDS.filter((k) =>
    stats.some((s) => (s.byKind[k.kind]?.played ?? 0) > 0),
  );

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" /> Statistiques — {team.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Calculées depuis les résultats détaillés de chaque rencontre.
        </p>
      </div>

      {stats.length === 0 ? (
        <EmptyState
          title="Aucune statistique"
          description="Importez une rencontre avec ses résultats pour voir apparaître les stats."
        />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Vue d'ensemble par joueur</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Joueur</TableHead>
                    <TableHead className="text-right">Joué</TableHead>
                    <TableHead className="text-right">Gagnés</TableHead>
                    <TableHead className="text-right">% Matchs</TableHead>
                    <TableHead className="text-right">Sets</TableHead>
                    <TableHead className="text-right">% Sets</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                    <TableHead className="text-right">% Points</TableHead>
                    <TableHead className="text-right">Forfaits</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.map((s) => (
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
                      <TableCell className="text-right">{pct(setRate(s.totals))}</TableCell>
                      <TableCell className="text-right">
                        {s.totals.pointsFor}-{s.totals.pointsAgainst}
                      </TableCell>
                      <TableCell className="text-right">{pct(pointRate(s.totals))}</TableCell>
                      <TableCell className="text-right">{s.forfeits}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {usedKinds.map(({ kind, label }) => (
            <Card key={kind} className="mt-4">
              <CardHeader>
                <CardTitle>{label}</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Joueur</TableHead>
                      <TableHead className="text-right">Joué</TableHead>
                      <TableHead className="text-right">% Matchs</TableHead>
                      <TableHead className="text-right">Sets</TableHead>
                      <TableHead className="text-right">% Sets</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                      <TableHead className="text-right">% Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats
                      .filter((s) => (s.byKind[kind]?.played ?? 0) > 0)
                      .sort((a, b) => winRate(b.byKind[kind]!) - winRate(a.byKind[kind]!))
                      .map((s) => {
                        const k = s.byKind[kind]!;
                        return (
                          <TableRow key={s.rosterId}>
                            <TableCell className="font-medium">{s.name}</TableCell>
                            <TableCell className="text-right">
                              {k.won}-{k.played - k.won}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {pct(winRate(k))}
                            </TableCell>
                            <TableCell className="text-right">
                              {k.setsWon}-{k.setsLost}
                            </TableCell>
                            <TableCell className="text-right">{pct(setRate(k))}</TableCell>
                            <TableCell className="text-right">
                              {k.pointsFor}-{k.pointsAgainst}
                            </TableCell>
                            <TableCell className="text-right">{pct(pointRate(k))}</TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </AppShell>
  );
}
