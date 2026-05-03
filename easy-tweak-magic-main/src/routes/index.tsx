import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStore, useCurrent } from "@/lib/store";
import { computeTeam, fmt } from "@/lib/compute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, Upload, Sparkles, Plus, Users, ArrowRight } from "lucide-react";
import { exportSeasonToXlsx, importSeasonFromXlsx } from "@/lib/excel";
import { useRef } from "react";
import { v4 as uuid } from "uuid";
import { toast } from "sonner";
import { sampleSeason202526 } from "@/lib/sample";
import type { Season, Team } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gestion Interclubs Volanteux — Tableau de bord" },
      { name: "description", content: "Gérez frais, stats et meilleure équipe pour Les Volanteux." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const { seasons, addSeason, loadState, setCurrentSeason, setCurrentTeam, addTeam } = useStore();
  const { season } = useCurrent();
  const fileRef = useRef<HTMLInputElement>(null);

  if (seasons.length === 0) {
    return (
      <AppShell>
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-2xl bg-[var(--gradient-hero)] p-8 text-sidebar-foreground shadow-[var(--shadow-card)] ring-1 ring-white/10">
            <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent/30 blur-3xl" />
            <h1 className="relative font-display text-4xl font-bold tracking-tight">Gestion Interclubs Volanteux 🏸</h1>
            <p className="relative mt-3 max-w-2xl text-base opacity-95">
              Suivez les frais (bar, nourriture, volants, trajets), les statistiques de chaque joueur,
              et trouvez la meilleure équipe possible — saison par saison, équipe par équipe.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Démarrer rapidement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full"
                  onClick={() => {
                    addSeason("Saison 2025-2026");
                    setTimeout(() => navigate({ to: "/parametres" }), 50);
                  }}
                >
                  <Sparkles className="h-4 w-4" /> Créer ma première saison
                </Button>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    const sample = sampleSeason202526();
                    loadState({ seasons: [sample], currentSeasonId: sample.id, roster: [] });
                    toast.success("Saison 2025-26 chargée");
                  }}
                >
                  Charger l'exemple (saison 2025-26)
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Importer un fichier Excel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Importez un .xlsx au format "Gestion Interclubs Volanteux" pour démarrer une saison pré-remplie.
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      const newSeason = await importSeasonFromXlsx(f, "Saison importée");
                      loadState({ seasons: [newSeason], currentSeasonId: newSeason.id, roster: [] });
                      toast.success("Import réussi");
                    } catch (err) {
                      toast.error("Échec de l'import : " + (err as Error).message);
                    }
                  }}
                />
                <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4" /> Choisir un fichier .xlsx
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!season) {
    return (
      <AppShell>
        <Card>
          <CardHeader>
            <CardTitle>Choisir une saison</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {seasons.map((s) => (
              <Button
                key={s.id}
                variant="outline"
                className="w-full justify-between"
                onClick={() => setCurrentSeason(s.id)}
              >
                <span>{s.name}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            ))}
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const teamId = season.currentTeamId;
  const team = season.teams.find((t) => t.id === teamId);

  // Aperçu global toutes équipes de la saison
  const allPlayers = season.teams.reduce((n, t) => n + t.players.length, 0);
  const allMatches = season.teams.reduce((n, t) => n + t.matches.length, 0);
  const allExpenses = season.teams.reduce(
    (n, t) => n + t.matches.reduce((s, m) => s + m.expenses.reduce((a, e) => a + e.amount, 0), 0),
    0,
  );

  return (
    <AppShell>
      <div className="relative mb-6 overflow-hidden rounded-2xl bg-[var(--gradient-hero)] p-6 text-sidebar-foreground shadow-[var(--shadow-card)] ring-1 ring-white/10">
        <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-accent/30 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-widest opacity-80">Saison en cours</div>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{season.name}</h1>
            <p className="mt-2 text-sm opacity-95">
              Budget club : <span className="rounded-md bg-accent px-2 py-0.5 font-bold text-accent-foreground">{fmt(season.clubBudget)}</span>{" "}
              · <span className="font-semibold">{season.teams.length}</span> équipe(s)
            </p>
          </div>
          <div className="flex gap-2">
            {team && (
              <Button variant="secondary" size="sm" onClick={() => exportSeasonToXlsx(season.name, season, team)}>
                <Download className="h-4 w-4" /> Exporter Excel
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Équipes" value={season.teams.length.toString()} />
        <StatCard label="Joueurs (total)" value={allPlayers.toString()} />
        <StatCard label="Rencontres (total)" value={allMatches.toString()} />
        <StatCard label="Dépenses (total)" value={fmt(allExpenses)} accent />
      </div>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Équipes de la saison</CardTitle>
          <Button
            size="sm"
            onClick={() => {
              const id = addTeam(season.id, `Équipe ${season.teams.length + 1}`);
              setCurrentTeam(season.id, id);
            }}
          >
            <Plus className="h-4 w-4" /> Ajouter une équipe
          </Button>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {season.teams.map((t) => {
            const totals = computeTeam(season, t);
            const isActive = t.id === season.currentTeamId;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setCurrentTeam(season.id, t.id);
                }}
                className={`rounded-lg border p-3 text-left transition-colors ${isActive ? "border-primary bg-primary/5" : "hover:bg-muted"}`}
              >
                <div className="flex items-center gap-2 font-semibold">
                  <Users className="h-4 w-4" /> {t.name}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {t.players.length} joueur(s) · {t.matches.length} rencontre(s) ·{" "}
                  {fmt(totals.totalExpenses)}
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {team ? (
        <>
          <div className="mt-6 mb-2 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Équipe : {team.name}</h2>
            <Link to="/rencontres" className="text-sm text-primary hover:underline">
              Voir rencontres →
            </Link>
          </div>

          <TeamSummary season={season} team={team} />
        </>
      ) : (
        <Card className="mt-6">
          <CardContent className="p-6 text-center text-muted-foreground">
            Sélectionnez une équipe ci-dessus pour voir le détail.
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}

function TeamSummary({ season, team }: { season: Season; team: Team }) {
  const totals = computeTeam(season, team);
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Joueurs" value={team.players.length.toString()} />
        <StatCard label="Rencontres" value={team.matches.length.toString()} />
        <StatCard label="Dépenses équipe" value={fmt(totals.totalExpenses)} />
        <StatCard label="Pris en charge club" value={fmt(totals.clubSubsidyTotal)} accent />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Solde par joueur</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Joueur</TableHead>
                <TableHead className="text-right">Rencontres</TableHead>
                <TableHead className="text-right">Coût total</TableHead>
                <TableHead className="text-right">Versé</TableHead>
                <TableHead className="text-right">Solde</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {totals.players.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    Aucun joueur. Ajoutez-en dans l'onglet Joueurs.
                  </TableCell>
                </TableRow>
              )}
              {totals.players.map((p) => (
                <TableRow key={p.playerId}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-right">{p.matchesPlayed}</TableCell>
                  <TableCell className="text-right">{fmt(p.totalCost)}</TableCell>
                  <TableCell className="text-right">{fmt(p.paid)}</TableCell>
                  <TableCell
                    className={`text-right font-semibold ${p.balance < 0 ? "text-destructive" : "text-success"}`}
                  >
                    {fmt(p.balance)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Total par catégorie</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {season.categories.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg border bg-card p-3"
              >
                <span className="text-sm">{c.name}</span>
                <span className="font-semibold">{fmt(totals.totalByCategory[c.id] ?? 0)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card
      className={
        accent
          ? "border-2 border-accent/60 bg-[var(--gradient-card)] shadow-[var(--shadow-glow)]"
          : "border-2 border-border bg-[var(--gradient-card)] shadow-[var(--shadow-card)]"
      }
    >
      <CardContent className="p-5">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </div>
        <div
          className={`mt-2 font-display text-3xl font-extrabold tracking-tight ${accent ? "bg-gradient-to-br from-primary to-primary-glow bg-clip-text text-transparent" : "text-foreground"}`}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
