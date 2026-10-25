import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const local = (text) => ({ text, kind: 'translated', source: 'fixture: invented', verified: true });
export function catalogFixture() {
  const skill = (id, kind, number, quantity = 1, ownerId = null) => ({
    id,
    kind,
    ownerId,
    number,
    quantity,
    name: local(`Carta ${id}`),
    text: local('Testo inventato per le prove.'),
    success: 0,
    fate: 1,
    traits: [],
    identityStatus: 'confirmed',
    notes: [],
  });
  const basicSkills = Array.from({ length: 6 }, (_, i) => `basic-${i + 1}`);
  const weaknessCards = Array.from({ length: 20 }, (_, i) => `weak-${i + 1}`);
  const heroes = Array.from({ length: 6 }, (_, i) => ({
    id: `hero-${i + 1}`,
    name: local(`Eroe ${i + 1}`),
    race: local('Umano'),
    stats: {
      might: 3,
      wisdom: 2,
      agility: 3,
      spirit: 2,
      wit: 3,
      damage: 5,
      fear: 5,
      inspiration: 4,
    },
    ability: local('Capacità inventata.'),
    skills: Array.from({ length: 5 }, (_, j) => `hero-${i + 1}-skill-${j + 1}`),
    suggestedRoleId: `role-${i + 1}`,
    startingItemIds: ['sword', 'armor'],
  }));
  const roles = Array.from({ length: 6 }, (_, i) => ({
    id: `role-${i + 1}`,
    name: local(`Ruolo ${i + 1}`),
    skills: Array.from({ length: 3 }, (_, j) => `role-${i + 1}-skill-${j + 1}`),
  }));
  const item = (id, slot, hands, quantity, rank = 1) => ({
    id,
    name: local(`Oggetto ${id}`),
    text: local('Effetto inventato.'),
    slot,
    hands,
    quantity,
    rank,
    ranged: false,
    traits: [],
    upgrades: [],
    notes: [],
    identityStatus: 'confirmed',
  });
  return {
    formatVersion: 1,
    id: 'synthetic-base-v1',
    label: 'Catalogo sintetico',
    sources: [{ name: 'invented fixture', sha256: 'a'.repeat(64) }],
    heroes,
    roles,
    basicSkills,
    weaknessCards,
    skills: [
      ...basicSkills.map((id, i) => skill(id, 'basic', i + 1, 5)),
      ...heroes.flatMap((hero) => hero.skills.map((id, i) => skill(id, 'hero', i + 1, 1, hero.id))),
      ...roles.flatMap((role) => role.skills.map((id, i) => skill(id, 'role', i + 1, 1, role.id))),
      ...weaknessCards.map((id, i) => skill(id, 'weakness', i + 1)),
    ],
    items: [
      item('sword', 'hand', 1, 5),
      item('shield', 'hand', 1, 1),
      item('bow', 'hand', 2, 1),
      item('armor', 'armor', 0, 5),
      item('rare-armor', 'armor', 0, 1),
      item('advanced', 'hand', 1, 1, 2),
      item('trinket', 'trinket', 0, 1),
    ],
  };
}
export async function privateCatalog(catalog = catalogFixture()) {
  const directory = await mkdtemp(join(tmpdir(), 'lotr-catalog-test-'));
  const path = join(directory, 'catalog.json');
  await writeFile(path, JSON.stringify(catalog));
  return { directory, path, dispose: () => rm(directory, { recursive: true, force: true }) };
}
