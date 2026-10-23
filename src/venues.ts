export type Venue = { name: string; slug: string; address: string };

/** `name` must match the text of `h3.horaire_nom_cinema` on the schedule page. */
export const VENUES: Venue[] = [
  { name: "Manutention", slug: "manutention", address: "4 Rue des Escaliers Sainte-Anne, 84000 Avignon" },
  { name: "République", slug: "republique", address: "5 rue Figuière, 84000 Avignon" },
];
