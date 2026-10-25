import { z } from 'zod';

export const ContentIdSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/);
export const AssetNameSchema = z
  .string()
  .max(100)
  .regex(/^[A-Za-z0-9_-]+\.png$/);
export const LocalizedTextSchema = z.strictObject({
  text: z.string().min(1).max(8000),
  kind: z.enum(['official-it', 'translated']),
  source: z.string().min(1).max(500),
  verified: z.boolean(),
});
const IdentityFields = {
  id: ContentIdSchema,
  name: LocalizedTextSchema,
  text: LocalizedTextSchema,
  quantity: z.int().min(1).max(20),
  identityStatus: z.enum(['confirmed', 'candidate']),
  notes: z.array(z.string().max(1500)).max(10),
};
export const SkillDefinitionSchema = z.strictObject({
  ...IdentityFields,
  kind: z.enum(['basic', 'hero', 'role', 'weakness']),
  ownerId: ContentIdSchema.nullable(),
  number: z.int().min(1).max(20).nullable(),
  success: z.int().min(0).max(2),
  fate: z.int().min(0).max(2),
  traits: z.array(z.string().max(80)).max(8),
});
export const ItemDefinitionSchema = z.strictObject({
  ...IdentityFields,
  rank: z.int().min(1).max(3),
  slot: z.enum(['hand', 'armor', 'trinket']),
  hands: z.int().min(0).max(2),
  ranged: z.boolean(),
  traits: z.array(z.string().max(80)).max(10),
  upgrades: z.array(ContentIdSchema).max(4),
  image: AssetNameSchema.optional(),
});
const Stat = z.int().min(0).max(20);
export const HeroDefinitionSchema = z.strictObject({
  id: ContentIdSchema,
  name: LocalizedTextSchema,
  race: LocalizedTextSchema,
  stats: z.strictObject({
    might: Stat,
    wisdom: Stat,
    agility: Stat,
    spirit: Stat,
    wit: Stat,
    damage: Stat,
    fear: Stat,
    inspiration: Stat,
  }),
  ability: LocalizedTextSchema,
  skills: z.array(ContentIdSchema).length(5),
  suggestedRoleId: ContentIdSchema,
  maxHands: z.int().min(1).max(2).default(2),
  startingItemIds: z.array(ContentIdSchema).min(1).max(3),
  portrait: AssetNameSchema.optional(),
});
export const RoleDefinitionSchema = z.strictObject({
  id: ContentIdSchema,
  name: LocalizedTextSchema,
  skills: z.array(ContentIdSchema).length(3),
});
export const CatalogSchema = z
  .strictObject({
    formatVersion: z.literal(1),
    id: ContentIdSchema,
    label: z.string().min(1).max(120),
    sources: z
      .array(
        z.strictObject({
          name: z.string().min(1).max(200),
          sha256: z.string().regex(/^[a-f0-9]{64}$/),
        }),
      )
      .min(1)
      .max(20),
    heroes: z.array(HeroDefinitionSchema).length(6),
    roles: z.array(RoleDefinitionSchema).length(6),
    basicSkills: z.array(ContentIdSchema).length(6),
    weaknessCards: z.array(ContentIdSchema).length(20),
    skills: z.array(SkillDefinitionSchema).length(74),
    items: z.array(ItemDefinitionSchema).min(1).max(100),
  })
  .superRefine((catalog, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    const all = [...catalog.heroes, ...catalog.roles, ...catalog.skills, ...catalog.items];
    if (new Set(all.map((entry) => entry.id)).size !== all.length)
      fail('Identificativi duplicati nel catalogo.');
    const skills = new Map(catalog.skills.map((card) => [card.id, card]));
    const items = new Map(catalog.items.map((card) => [card.id, card]));
    const roleIds = new Set(catalog.roles.map((role) => role.id));
    const used = new Set<string>();
    function group(
      ids: string[],
      kind: 'basic' | 'hero' | 'role' | 'weakness',
      owner: string | null,
      quantity: number,
    ) {
      for (const [index, id] of ids.entries()) {
        const card = skills.get(id);
        if (
          used.has(id) ||
          !card ||
          card.kind !== kind ||
          card.ownerId !== owner ||
          (kind !== 'weakness' && card.number !== index + 1) ||
          card.quantity !== quantity
        )
          fail('Composizione o copie iniziali incoerenti nel catalogo.');
        used.add(id);
      }
    }
    group(catalog.basicSkills, 'basic', null, 5);
    group(catalog.weaknessCards, 'weakness', null, 1);
    for (const hero of catalog.heroes) {
      group(hero.skills, 'hero', hero.id, 1);
      if (!roleIds.has(hero.suggestedRoleId)) fail('Ruolo suggerito assente.');
      const equipment = hero.startingItemIds.map((id) => items.get(id));
      if (
        new Set(hero.startingItemIds).size !== hero.startingItemIds.length ||
        equipment.some((item) => !item || item.rank !== 1 || item.slot === 'trinket') ||
        equipment.reduce((n, item) => n + (item?.hands ?? 0), 0) > hero.maxHands ||
        equipment.filter((item) => item?.slot === 'armor').length > 1
      )
        fail('Oggetti suggeriti incoerenti.');
    }
    for (const role of catalog.roles) group(role.skills, 'role', role.id, 1);
    for (const item of catalog.items) {
      if (
        (item.slot === 'hand' ? item.hands < 1 : item.hands !== 0) ||
        item.upgrades.some((id) => !items.has(id) || items.get(id)!.rank !== item.rank + 1)
      )
        fail('Oggetto o avanzamento incoerente.');
    }
    for (const entry of [...catalog.skills, ...catalog.items]) {
      if (entry.identityStatus === 'candidate' && entry.notes.length === 0)
        fail('Un’associazione candidata richiede una nota.');
    }
  });
export const CatalogSummarySchema = z.strictObject({ id: ContentIdSchema, label: z.string() });
export type Catalog = z.infer<typeof CatalogSchema>;
export type LocalizedText = z.infer<typeof LocalizedTextSchema>;
export type HeroDefinition = z.infer<typeof HeroDefinitionSchema>;
export type SkillDefinition = z.infer<typeof SkillDefinitionSchema>;
export type ItemDefinition = z.infer<typeof ItemDefinitionSchema>;
