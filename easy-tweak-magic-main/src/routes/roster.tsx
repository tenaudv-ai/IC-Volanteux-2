import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { Plus, Trash2, Upload, Users } from "lucide-react";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { parseRosterText } from "@/lib/import-text";
import { toast } from "sonner";
import type { Gender, RosterPlayer } from "@/lib/types";

export const Route = createFileRoute("/roster")({
  head: () => ({ meta: [{ title: "Roster club — Gestion Interclubs Volanteux" }] }),
  component: Page,
});

function Page() {
  const { roster, addRosterPlayer, updateRosterPlayer, removeRosterPlayer, importRoster } =
    useStore();
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [replaceMode, setReplaceMode] = useState(false);

  const [newP, setNewP] = useState<Omit<RosterPlayer, "id">>({
    gender: "H",
    lastName: "",
    firstName: "",
    affiliation: "",
  });

  const sorted = [...roster].sort((a, b) => a.lastName.localeCompare(b.lastName));

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold">Roster du club</h1>
          <p className="text-sm text-muted-foreground">
            Liste paramétrable des joueurs/joueuses, sélectionnables ensuite dans chaque équipe.
          </p>
        </div>
        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogTrigger asChild>
            <Button variant="secondary">
              <Upload className="h-4 w-4" /> Importer (texte collé)
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Importer des joueurs (texte collé)</DialogTitle>
              <DialogDescription>
                Collez les lignes du tableau Tabt. Format attendu par ligne :
                <br />
                <code className="text-xs">
                  Genre Nom, Prénom Affiliation Joué Simple Double Mixte
                </code>
                <br />
                Les niveaux peuvent être séparés ou collés (ex: <code>121112</code>).
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={12}
              placeholder={`H\tBontijnck, Cyril\t30006933\t12\t11\t12\nH\tCARVAJAL, Daryl\t30086381\t12\t11\t12\n...`}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={replaceMode}
                onChange={(e) => setReplaceMode(e.target.checked)}
              />
              Remplacer le roster existant (sinon fusion par n° d'affiliation)
            </label>
            <DialogFooter>
              <Button
                onClick={() => {
                  const parsed = parseRosterText(importText);
                  if (parsed.length === 0) {
                    toast.error("Aucune ligne reconnue");
                    return;
                  }
                  importRoster(parsed, replaceMode);
                  toast.success(`${parsed.length} joueur·s importé·s`);
                  setImportOpen(false);
                  setImportText("");
                }}
              >
                Importer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ajouter manuellement</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-5">
          <Select
            value={newP.gender}
            onValueChange={(v) => setNewP({ ...newP, gender: v as Gender })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="H">Homme</SelectItem>
              <SelectItem value="F">Femme</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Nom"
            value={newP.lastName}
            onChange={(e) => setNewP({ ...newP, lastName: e.target.value })}
          />
          <Input
            placeholder="Prénom"
            value={newP.firstName}
            onChange={(e) => setNewP({ ...newP, firstName: e.target.value })}
          />
          <Input
            placeholder="N° affiliation"
            value={newP.affiliation}
            onChange={(e) => setNewP({ ...newP, affiliation: e.target.value })}
          />
          <Button
            onClick={() => {
              if (!newP.lastName.trim()) return;
              addRosterPlayer(newP);
              setNewP({ gender: "H", lastName: "", firstName: "", affiliation: "" });
            }}
          >
            <Plus className="h-4 w-4" /> Ajouter
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> {roster.length} joueur·s
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Genre</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Prénom</TableHead>
                <TableHead>N° affiliation</TableHead>
                <TableHead className="text-center">Joué</TableHead>
                <TableHead className="text-center">Simple</TableHead>
                <TableHead className="text-center">Double</TableHead>
                <TableHead className="text-center">Mixte</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-6 text-center text-muted-foreground">
                    Roster vide. Ajoutez ou importez des joueurs ci-dessus.
                  </TableCell>
                </TableRow>
              )}
              {sorted.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Select
                      value={p.gender}
                      onValueChange={(v) => updateRosterPlayer(p.id, { gender: v as Gender })}
                    >
                      <SelectTrigger className="h-8 w-16">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="H">H</SelectItem>
                        <SelectItem value="F">F</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      defaultValue={p.lastName}
                      onBlur={(e) => updateRosterPlayer(p.id, { lastName: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      defaultValue={p.firstName}
                      onBlur={(e) => updateRosterPlayer(p.id, { firstName: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      defaultValue={p.affiliation}
                      className="w-32"
                      onBlur={(e) => updateRosterPlayer(p.id, { affiliation: e.target.value })}
                    />
                  </TableCell>
                  {(["levelPlayed", "levelSingle", "levelDouble", "levelMixed"] as const).map(
                    (k) => (
                      <TableCell key={k} className="text-center">
                        <Input
                          type="number"
                          defaultValue={p[k] ?? ""}
                          className="w-16 text-center"
                          onBlur={(e) =>
                            updateRosterPlayer(p.id, {
                              [k]: e.target.value === "" ? undefined : parseInt(e.target.value, 10),
                            })
                          }
                        />
                      </TableCell>
                    ),
                  )}
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeRosterPlayer(p.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
