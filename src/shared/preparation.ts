import { z } from 'zod';
import { ContentIdSchema, type Catalog } from './catalog';

export const CopyIdSchema = z
  .string()
  .max(120)
  .regex(/^[A-Za-z0-9_-]+:[1-9][0-9]*$/);
export const PreparedHeroSchema = z.strictObject({
  heroId: ContentIdSchema,
  playerId: z.uuid(),
  roleId: ContentIdSchema.nullable(),
  itemCopies: z.array(CopyIdSchema).max(3),
  prepared: z.array(CopyIdSchema).max(4),
  deck: z.array(CopyIdSchema).max(30),
  discard: z.array(CopyIdSchema).max(30),
});
export const PreparationSchema = z.strictObject({
  status: z.enum(['draft', 'prepared']),
  heroes: z.array(PreparedHeroSchema).max(5),
  weaknessDeck: z.array(CopyIdSchema).max(20),
});
export const PreparationViewSchema = z.strictObject({
  status: z.enum(['draft', 'prepared']),
  heroes: z
    .array(
      PreparedHeroSchema.omit({ deck: true, discard: true }).extend({
        deckCount: z.int().nonnegative(),
        discardCount: z.int().nonnegative(),
        composition: z.array(CopyIdSchema).max(30),
      }),
    )
    .max(5),
});
export type Preparation = z.infer<typeof PreparationSchema>;
export type PreparedHero = z.infer<typeof PreparedHeroSchema>;

export const definitionId = (copy: string) => copy.slice(0, copy.lastIndexOf(':'));
export function validCopy(copy: string, entries: { id: string; quantity: number }[]) {
  const entry = entries.find((value) => value.id === definitionId(copy));
  const index = Number(copy.slice(copy.lastIndexOf(':') + 1));
  return entry && index >= 1 && index <= entry.quantity;
}
export function preparationProblem(
  catalog: Catalog,
  playerIds: string[],
  preparation: Preparation,
): string | null {
  const heroes = preparation.heroes;
  if (
    new Set(heroes.map((hero) => hero.heroId)).size !== heroes.length ||
    heroes.some((hero) => !playerIds.includes(hero.playerId))
  )
    return 'Eroe o proprietario non valido.';
  const roles = heroes.flatMap((hero) => (hero.roleId ? [hero.roleId] : []));
  if (new Set(roles).size !== roles.length) return 'Questo ruolo è già assegnato a un altro eroe.';
  const equipped = heroes.flatMap((hero) => hero.itemCopies);
  if (new Set(equipped).size !== equipped.length)
    return 'Una copia di questo oggetto è già assegnata.';
  for (const hero of heroes) {
    if (
      !catalog.heroes.some((entry) => entry.id === hero.heroId) ||
      (hero.roleId && !catalog.roles.some((entry) => entry.id === hero.roleId))
    )
      return 'Eroe o ruolo assente dal catalogo.';
    if (hero.itemCopies.some((copy) => !validCopy(copy, catalog.items)))
      return 'Questa copia di oggetto non è disponibile.';
    const items = hero.itemCopies.map(
      (copy) => catalog.items.find((entry) => entry.id === definitionId(copy))!,
    );
    if (
      items.some((item) => item.rank !== 1 || item.slot === 'trinket') ||
      items.reduce((n, item) => n + item.hands, 0) > 2 ||
      items.filter((item) => item.slot === 'armor').length > 1
    )
      return 'Scegli oggetti iniziali: rango I, al massimo due mani e un’armatura, senza monili.';
    if (
      preparation.status === 'draft' &&
      (hero.prepared.length || hero.deck.length || hero.discard.length)
    )
      return 'Un mazzo non può esistere prima della preparazione.';
  }
  if (preparation.status === 'prepared') {
    const roster = rosterProblem(playerIds, preparation);
    if (roster) return roster;
    const seen = new Set<string>();
    const reserve = preparation.weaknessDeck;
    for (const copy of reserve) {
      if (seen.has(copy) || !validCopy(copy, catalog.skills) || !catalog.weaknessCards.includes(definitionId(copy))) return 'Riserva delle debolezze incoerente.';
      seen.add(copy);
    }
    if (reserve.length !== 20 - heroes.length) return 'Numero di debolezze nella riserva non valido.';
    for (const hero of heroes) {
      const definition = catalog.heroes.find((entry) => entry.id === hero.heroId)!;
      const role = catalog.roles.find((entry) => entry.id === hero.roleId)!;
      if (hero.prepared.length !== 1 || hero.prepared[0] !== `${role.skills[0]}:1` || hero.deck.length !== 14 || hero.discard.length !== 0) return 'Mazzo iniziale o carta preparata non validi.';
      const expected = [...catalog.basicSkills, ...definition.skills, ...role.skills];
      const actual = [...hero.prepared, ...hero.deck];
      const definitions = actual.map(definitionId);
      if (expected.some((id) => definitions.filter((value) => value === id).length !== 1) || definitions.filter((id) => catalog.weaknessCards.includes(id)).length !== 1) return 'Composizione del mazzo iniziale non valida.';
      for (const copy of actual) {
        if (seen.has(copy) || !validCopy(copy, catalog.skills)) return 'Copie del mazzo duplicate o inesistenti.';
        seen.add(copy);
      }
    }
  }
  if (preparation.status === 'draft' && preparation.weaknessDeck.length)
    return 'La riserva non è ancora preparata.';
  return null;
}
export function preparationView(preparation: Preparation | null) {
  if (!preparation) return null;
  return {
    status: preparation.status,
    heroes: preparation.heroes.map(({ deck, discard, ...hero }) => ({
      ...hero,
      deckCount: deck.length,
      discardCount: discard.length,
      composition: [...hero.prepared, ...deck, ...discard].sort(),
    })),
  };
}

export function rosterProblem(playerIds: string[], preparation: Preparation): string | null {
  const heroes = preparation.heroes;
  if (playerIds.length === 1) {
    if (heroes.length < 2 || heroes.length > 4) return 'In solitario occorrono da due a quattro eroi.';
  } else if (playerIds.length < 2 || heroes.length !== playerIds.length || playerIds.some((id) => heroes.filter((hero) => hero.playerId === id).length !== 1)) return 'Ogni partecipante deve scegliere esattamente un eroe.';
  if (heroes.some((hero) => !hero.roleId)) return 'Scegli un ruolo per ogni eroe prima di preparare i mazzi.';
  return null;
}
