import { Link, useLocation } from "@tanstack/react-router";
import { useStore, useCurrent } from "@/lib/store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Shield, Calendar, Users, Settings, Receipt, BarChart3, Home, UserSquare2, Sparkles, Globe2 } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const nav = [
  { to: "/", label: "Tableau de bord", icon: BarChart3 },
  { to: "/rencontres", label: "Rencontres", icon: Receipt },
  { to: "/statistiques", label: "Statistiques", icon: BarChart3 },
  { to: "/analyse", label: "Analyse", icon: Sparkles },
  { to: "/club-analyse", label: "Analyse club", icon: Globe2 },
  { to: "/joueurs", label: "Joueurs", icon: Users },
  { to: "/roster", label: "Roster club", icon: UserSquare2 },
  { to: "/parametres", label: "Paramètres", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { seasons, currentSeasonId, setCurrentSeason, addSeason, addTeam, setCurrentTeam } = useStore();
  const { season } = useCurrent();
  const loc = useLocation();

  const [openSeason, setOpenSeason] = useState(false);
  const [seasonName, setSeasonName] = useState("");
  const [openTeam, setOpenTeam] = useState(false);
  const [teamName, setTeamName] = useState("");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[var(--gradient-hero)] text-sidebar-foreground shadow-[var(--shadow-card)] backdrop-blur-md">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[var(--gradient-neon)] opacity-80" />
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[var(--shadow-glow)]">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-lg font-bold leading-none tracking-tight">
                Gestion <span className="text-primary">Interclubs</span> Volanteux
              </div>
              <div className="mt-0.5 text-[11px] uppercase tracking-widest opacity-70">
                Statistiques · Coûts · Analyse
              </div>
            </div>
          </Link>

          <Link
            to="/"
            className="ml-2 hidden items-center gap-1 rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium ring-1 ring-white/20 hover:bg-white/20 sm:flex"
          >
            <Home className="h-4 w-4" /> Accueil
          </Link>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select value={currentSeasonId ?? ""} onValueChange={setCurrentSeason}>
              <SelectTrigger className="h-9 min-w-44 border-white/20 bg-white/10 text-sidebar-foreground">
                <Calendar className="mr-1 h-4 w-4" />
                <SelectValue placeholder="Saison" />
              </SelectTrigger>
              <SelectContent>
                {seasons.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Dialog open={openSeason} onOpenChange={setOpenSeason}>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary" className="h-9">
                  <Plus className="h-4 w-4" /> Saison
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nouvelle saison</DialogTitle>
                </DialogHeader>
                <Label>Nom de la saison</Label>
                <Input
                  value={seasonName}
                  onChange={(e) => setSeasonName(e.target.value)}
                  placeholder="Ex: 2026-2027"
                />
                <DialogFooter>
                  <Button
                    onClick={() => {
                      if (seasonName.trim()) {
                        addSeason(seasonName.trim());
                        setSeasonName("");
                        setOpenSeason(false);
                      }
                    }}
                  >
                    Créer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {season && (
              <>
                <Select
                  value={season.currentTeamId ?? ""}
                  onValueChange={(v) => setCurrentTeam(season.id, v)}
                >
                  <SelectTrigger className="h-9 min-w-40 border-white/20 bg-white/10 text-sidebar-foreground">
                    <Users className="mr-1 h-4 w-4" />
                    <SelectValue placeholder="Équipe" />
                  </SelectTrigger>
                  <SelectContent>
                    {season.teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Dialog open={openTeam} onOpenChange={setOpenTeam}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="secondary" className="h-9">
                      <Plus className="h-4 w-4" /> Équipe
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nouvelle équipe dans {season.name}</DialogTitle>
                    </DialogHeader>
                    <Label>Nom de l'équipe</Label>
                    <Input
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="Ex: D2"
                    />
                    <DialogFooter>
                      <Button
                        onClick={() => {
                          if (teamName.trim() && season) {
                            addTeam(season.id, teamName.trim());
                            setTeamName("");
                            setOpenTeam(false);
                          }
                        }}
                      >
                        Créer
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        </div>

        {season && (
          <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 pb-2">
            {nav.map((n) => {
              const active = loc.pathname === n.to;
              const Icon = n.icon;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-all ${active ? "bg-primary text-primary-foreground shadow-[var(--shadow-glow)]" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
                >
                  <Icon className="h-4 w-4" /> {n.label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
