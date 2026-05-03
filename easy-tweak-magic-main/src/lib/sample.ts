import type { Season } from "./types";
import { v4 as uuid } from "uuid";

/** Sample data based on couts_IC_2025-26.xlsx (saison badminton) */
export function sampleSeason202526(): Season {
  const cats = {
    bar: { id: uuid(), name: "Bar", splitMode: "shared" as const },
    food: { id: uuid(), name: "Nourriture", splitMode: "shared" as const },
    shuttle: { id: uuid(), name: "Volants", splitMode: "club" as const },
    travel: { id: uuid(), name: "Trajet", splitMode: "shared" as const },
  };

  const players = ["Antoine", "Daryl", "Jon", "Lucas", "Martin", "Pierre", "Valentin"].map((n) => ({
    id: uuid(),
    name: n,
    initialContribution: 40,
  }));

  const findP = (name: string) => players.find((p) => p.name === name)!.id;

  const data: Array<[number, number, number, number, string[]]> = [
    [34.4, 23.2, 41.375, 0, ["Antoine", "Daryl", "Martin", "Valentin"]],
    [20.9, 16.45, 41.375, 0, ["Jon", "Pierre", "Valentin", "Antoine"]],
    [22.5, 0, 0, 0, ["Antoine", "Daryl", "Lucas"]],
    [24, 0, 0, 0, ["Daryl", "Martin", "Pierre"]],
    [30, 0, 0, 0, ["Antoine", "Lucas", "Valentin"]],
    [29.9, 14.97, 41.375, 0, ["Daryl", "Martin", "Valentin", "Antoine"]],
    [23, 0, 0, 24, ["Lucas", "Martin", "Pierre", "Valentin"]],
    [38.5, 20.74, 41.375, 0, ["Antoine", "Daryl", "Martin", "Valentin"]],
  ];

  const teamId = uuid();

  return {
    id: uuid(),
    name: "Saison 2025-2026",
    playerSeasonFee: 40,
    clubBudget: 300,
    categories: [cats.bar, cats.food, cats.shuttle, cats.travel],
    currentTeamId: teamId,
    teams: [
      {
        id: teamId,
        name: "Équipe D2",
        players,
        matches: data.map((m, i) => ({
          id: uuid(),
          label: `Rencontre ${i + 1}`,
          playerIds: m[4].map(findP),
          expenses: [
            m[0] && { categoryId: cats.bar.id, amount: m[0] },
            m[1] && { categoryId: cats.food.id, amount: m[1] },
            m[2] && { categoryId: cats.shuttle.id, amount: m[2] },
            m[3] && { categoryId: cats.travel.id, amount: m[3] },
          ].filter(Boolean) as { categoryId: string; amount: number }[],
        })),
      },
    ],
  };
}
