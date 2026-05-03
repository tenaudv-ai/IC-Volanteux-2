import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStore, useCurrent } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/EmptyState";
import { computeTeam, fmt } from "@/lib/compute";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/joueurs")({
  head: () => ({ meta: [{ title: "Joueurs — Gestion Interclubs Volanteux" }] }),
  component: Page,
});

function Page() {
  const { season, team } = useCurrent();
  const { addPlayer, addPlayerFromRoster, updatePlayer, removePlayer, roster } = useStore();
  const [name, setName] = useState("");
  const [fee, setFee] = useState<string>("");
  const [rosterPick, setRosterPick] = useState<string>("");

  if (!season)
    return (
      <AppShell>
        <EmptyState title="Pas de saison" description="Créez une saison pour commencer." />
      </AppShell>
    );
  if (!team)
    return (
      <AppShell>
        <EmptyState
          title="Aucune équipe sélectionnée"
          description="Choisissez ou créez une équipe dans la saison."
        />
      </AppShell>
    );

  const totals = computeTeam(season, team);
  const usedRosterIds = new Set(
    team.players.map((p) => p.rosterId).filter(Boolean) as string[],
  );
  const availableRoster = roster
    .filter((r) => !usedRosterIds.has(r.id))
    .sort((a, b) => a.lastName.localeCompare(b.lastName));

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="font-display text-2xl font-bold">Joueurs — {team.name}</h1>
        <p className="text-sm text-muted-foreground">{season.name}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" /> Ajouter depuis le roster club
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          {roster.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Roster vide.{" "}
              <Link to="/roster" className="font-medium text-primary underline">
                Créer/importer le roster
              </Link>
              .
            </p>
          ) : (
            <>
              <Select value={rosterPick} onValueChange={setRosterPick}>
                <SelectTrigger className="min-w-72">
                  <SelectValue placeholder="Choisir un joueur du roster" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoster.length === 0 && (
                    <div className="p-2 text-sm text-muted-foreground">
                      Tous les joueurs du roster sont déjà dans l'équipe.
                    </div>
                  )}
                  {availableRoster.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.gender} · {r.lastName} {r.firstName}
                      {r.affiliation ? ` (${r.affiliation})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                disabled={!rosterPick}
                onClick={() => {
                  addPlayerFromRoster(season.id, team.id, rosterPick);
                  setRosterPick("");
                }}
              >
                <Plus className="h-4 w-4" /> Ajouter à l'équipe
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Ajouter manuellement</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input
            placeholder="Nom"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="max-w-xs"
          />
          <Input
            type="number"
            placeholder={`Montant versé (déf. ${season.playerSeasonFee} €)`}
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            className="max-w-xs"
          />
          <Button
            onClick={() => {
              if (!name.trim()) return;
              addPlayer(
                season.id,
                team.id,
                name.trim(),
                fee === "" ? season.playerSeasonFee : parseFloat(fee),
              );
              setName("");
              setFee("");
            }}
          >
            <Plus className="h-4 w-4" /> Ajouter
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Liste des joueurs</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead className="text-right">Base versée (€)</TableHead>
                <TableHead className="text-right">Versements en cours</TableHead>
                <TableHead className="text-right">Total versé</TableHead>
                <TableHead className="text-right">Coût total</TableHead>
                <TableHead className="text-right">Solde</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.players.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                    Aucun joueur. Ajoutez-en ci-dessus.
                  </TableCell>
                </TableRow>
              )}
              {team.players.map((p) => {
                const c = totals.players.find((x) => x.playerId === p.id);
                return (
                  <PlayerRow key={p.id} seasonId={season.id} teamId={team.id} player={p} computed={c} />
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function PlayerRow({
  seasonId,
  teamId,
  player,
  computed,
}: {
  seasonId: string;
  teamId: string;
  player: import("@/lib/types").Player;
  computed?: ReturnType<typeof computeTeam>["players"][number];
}) {
  const { updatePlayer, removePlayer, addPlayerContribution, removePlayerContribution } =
    useStore();
  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState("");
  const [note, setNote] = useState("");
  const contribs = player.contributions ?? [];
  const contribTotal = contribs.reduce((s, c) => s + (c.amount || 0), 0);

  return (
    <>
      <TableRow>
        <TableCell>
          <Input
            defaultValue={player.name}
            onBlur={(e) => updatePlayer(seasonId, teamId, player.id, { name: e.target.value })}
          />
        </TableCell>
        <TableCell className="text-right">
          <Input
            type="number"
            defaultValue={player.initialContribution}
            className="w-28 text-right"
            onBlur={(e) =>
              updatePlayer(seasonId, teamId, player.id, {
                initialContribution: parseFloat(e.target.value) || 0,
              })
            }
          />
        </TableCell>
        <TableCell className="text-right">
          <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
            {fmt(contribTotal)} ({contribs.length})
          </Button>
        </TableCell>
        <TableCell className="text-right font-medium">
          {computed ? fmt(computed.paid) : "–"}
        </TableCell>
        <TableCell className="text-right">
          {computed ? fmt(computed.totalCost) : "–"}
        </TableCell>
        <TableCell
          className={`text-right font-semibold ${computed && computed.balance < 0 ? "text-destructive" : "text-success"}`}
        >
          {computed ? fmt(computed.balance) : "–"}
        </TableCell>
        <TableCell className="text-right">
          <Button size="icon" variant="ghost" onClick={() => removePlayer(seasonId, teamId, player.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/30">
            <div className="space-y-2 p-2">
              <div className="text-sm font-medium">Versements en cours d'année</div>
              {contribs.length === 0 && (
                <p className="text-xs text-muted-foreground">Aucun versement additionnel.</p>
              )}
              {contribs.map((c) => (
                <div key={c.id} className="flex items-center gap-2 text-sm">
                  <span className="font-mono">{fmt(c.amount)}</span>
                  {c.date && <span className="text-muted-foreground">{c.date}</span>}
                  {c.note && <span className="text-muted-foreground">— {c.note}</span>}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="ml-auto h-7 w-7"
                    onClick={() => removePlayerContribution(seasonId, teamId, player.id, c.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <div className="flex flex-wrap items-end gap-2 pt-2">
                <Input
                  type="number"
                  placeholder="Montant (€)"
                  value={amt}
                  onChange={(e) => setAmt(e.target.value)}
                  className="w-32"
                />
                <Input
                  placeholder="Note (optionnel)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="max-w-xs"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    const v = parseFloat(amt);
                    if (!v) return;
                    addPlayerContribution(seasonId, teamId, player.id, {
                      amount: v,
                      note: note || undefined,
                      date: new Date().toISOString().slice(0, 10),
                    });
                    setAmt("");
                    setNote("");
                  }}
                >
                  <Plus className="h-4 w-4" /> Ajouter versement
                </Button>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
