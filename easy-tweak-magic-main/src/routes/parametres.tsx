import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStore, useCurrent } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Download, Upload, AlertTriangle } from "lucide-react";
import { useRef, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { exportAllJSON, importAllJSON, importSeasonFromXlsx } from "@/lib/excel";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/parametres")({
  head: () => ({ meta: [{ title: "Paramètres — Gestion Interclubs Volanteux" }] }),
  component: Page,
});

function Page() {
  const { season, team } = useCurrent();
  const store = useStore();
  const fileXlsx = useRef<HTMLInputElement>(null);
  const fileJson = useRef<HTMLInputElement>(null);
  const [catName, setCatName] = useState("");
  const [catMode, setCatMode] = useState<"shared" | "club">("shared");

  if (!season)
    return (
      <AppShell>
        <EmptyState title="Pas de saison" description="Créez une saison." />
      </AppShell>
    );

  return (
    <AppShell>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Règles de la saison</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Nom de la saison</Label>
              <Input
                defaultValue={season.name}
                onBlur={(e) => store.updateSeason(season.id, { name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Participation joueur — défaut saison (€)</Label>
                <Input
                  type="number"
                  defaultValue={season.playerSeasonFee}
                  onBlur={(e) =>
                    store.updateSeason(season.id, {
                      playerSeasonFee: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div>
                <Label>Budget club — défaut saison (€)</Label>
                <Input
                  type="number"
                  defaultValue={season.clubBudget}
                  onBlur={(e) =>
                    store.updateSeason(season.id, {
                      clubBudget: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Ces valeurs servent de défaut. Chaque équipe peut redéfinir sa propre participation
              joueur et son propre budget club ci-dessous.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Catégories de frais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Input
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="Nouvelle catégorie"
                className="max-w-xs"
              />
              <Select value={catMode} onValueChange={(v) => setCatMode(v as "shared" | "club")}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shared">Partagé</SelectItem>
                  <SelectItem value="club">Club</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={() => {
                  if (!catName.trim()) return;
                  store.addCategory(season.id, catName.trim(), catMode);
                  setCatName("");
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <ul className="space-y-2">
              {season.categories.map((c) => (
                <li key={c.id} className="flex items-center gap-2 rounded-md border p-2">
                  <Input
                    defaultValue={c.name}
                    onBlur={(e) =>
                      store.updateCategory(season.id, c.id, { name: e.target.value })
                    }
                    className="max-w-xs"
                  />
                  <Select
                    value={c.splitMode}
                    onValueChange={(v) =>
                      store.updateCategory(season.id, c.id, { splitMode: v as "shared" | "club" })
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shared">Partagé</SelectItem>
                      <SelectItem value="club">Club</SelectItem>
                    </SelectContent>
                  </Select>
                  <label
                    className="flex items-center gap-1 text-xs text-muted-foreground"
                    title="Tarif remboursé par km pour les rencontres à l'extérieur (distance aller × 2 × tarif)"
                  >
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="—"
                      defaultValue={c.kmRate ?? ""}
                      className="h-9 w-20 text-right"
                      onBlur={(e) => {
                        const v = parseFloat(e.target.value);
                        store.updateCategory(season.id, c.id, { kmRate: v > 0 ? v : undefined });
                      }}
                    />
                    €/km ext.
                  </label>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="ml-auto"
                    onClick={() => store.removeCategory(season.id, c.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Équipes de la saison</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {season.teams.map((t) => (
              <div key={t.id} className="space-y-2 rounded-md border p-2">
                <div className="flex items-center gap-2">
                  <Input
                    defaultValue={t.name}
                    onBlur={(e) => store.renameTeam(season.id, t.id, e.target.value)}
                    className="max-w-xs"
                  />
                  <span className="text-xs text-muted-foreground">
                    {t.players.length} joueur(s) · {t.matches.length} rencontre(s)
                  </span>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="ml-auto">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer l'équipe {t.name} ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tous les joueurs et rencontres de cette équipe seront supprimés.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => store.deleteTeam(season.id, t.id)}>
                          Supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Participation joueur (€)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      defaultValue={t.playerSeasonFee ?? season.playerSeasonFee}
                      onBlur={(e) =>
                        store.updateTeam(season.id, t.id, {
                          playerSeasonFee: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Budget club équipe (€)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      defaultValue={t.clubBudget ?? season.clubBudget}
                      onBlur={(e) =>
                        store.updateTeam(season.id, t.id, {
                          clubBudget: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Budget volants (€)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      defaultValue={t.shuttleBudget ?? 0}
                      onBlur={(e) =>
                        store.updateTeam(season.id, t.id, {
                          shuttleBudget: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Volants : répartis au prorata des matchs domicile joués. Budget club : couvre
                  d'abord les frais "club" puis subventionne les frais partagés.
                </p>
              </div>
            ))}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4" /> Supprimer la saison
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer cette saison ?</AlertDialogTitle>
                  <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => store.deleteSeason(season.id)}>
                    Supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sauvegardes & import</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <input
              ref={fileXlsx}
              type="file"
              accept=".xlsx"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const newSeason = await importSeasonFromXlsx(
                    f,
                    "Importée " + new Date().toLocaleDateString(),
                  );
                  store.loadState({
                    ...store,
                    seasons: [...store.seasons, newSeason],
                    currentSeasonId: newSeason.id,
                  });
                  toast.success("Saison importée");
                } catch (err) {
                  toast.error((err as Error).message);
                }
              }}
            />
            <input
              ref={fileJson}
              type="file"
              accept="application/json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const state = await importAllJSON(f);
                  store.loadState(state);
                  toast.success("Restauré");
                } catch (err) {
                  toast.error((err as Error).message);
                }
              }}
            />
            <Button variant="outline" className="w-full" onClick={() => fileXlsx.current?.click()}>
              <Upload className="h-4 w-4" /> Importer une saison .xlsx
            </Button>
            {team && (
              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  const { exportSeasonToXlsx } = await import("@/lib/excel");
                  exportSeasonToXlsx(season.name, season, team);
                }}
              >
                <Download className="h-4 w-4" /> Exporter équipe en .xlsx
              </Button>
            )}
            <Button variant="outline" className="w-full" onClick={() => exportAllJSON(store)}>
              <Download className="h-4 w-4" /> Sauvegarde JSON complète
            </Button>
            <Button variant="outline" className="w-full" onClick={() => fileJson.current?.click()}>
              <Upload className="h-4 w-4" /> Restaurer depuis JSON
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  <AlertTriangle className="h-4 w-4" /> Tout effacer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Effacer toutes les données ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Toutes les saisons et équipes seront supprimées définitivement.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => store.resetAll()}>Effacer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
