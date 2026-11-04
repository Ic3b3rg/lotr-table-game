// Entirely invented identities, names, quantities and values. Not acceptance89/33.
import { frontFixture, hash } from './physical-fronts.mjs';
import * as api from '../../dist/physical-resolution-library.mjs';
import { binding, evidence } from './physical-fronts.mjs';
import { source } from './physical-resolution.mjs';
export function boonFixture(verified = true) {
  const f = frontFixture();
  const cards = f.raw.cards.filter((c) => c.family === 'boon');
  const kinds = ['determined', 'emboldened', 'hidden'];
  const effects = [
    [{ op: 'exchange-test-cards' }],
    [
      { op: 'add-hits', valueIndex: 0 },
      { op: 'discard-on-suffer', families: ['damage', 'fear'] },
      { op: 'discard-at-end-turn', condition: 'no-nearby-enemies' },
    ],
    [
      { op: 'prevent-all-before-test', family: 'damage' },
      { op: 'add-success', valueIndex: 0 },
    ],
  ];
  cards.forEach((c, i) => {
    c.name.value = `Favore sintetico ${i + 1}`;
    c.text.value = `Programma immaginario ${i + 1}, senza testo originale.`;
    c.mechanics.values.value = i
      ? [{ label: 'Valore inventato', value: i + 3, unit: 'punti' }]
      : [];
    c.mechanics.symbols.value = ['damage', 'fear', 'success'];
    if (verified) {
      const quantity = [2, 4, 9][i];
      c.quantity = { ...c.quantity, value: quantity, status: 'verified', note: '' };
      c.copies = Array.from({ length: quantity }, (_, n) => ({
        id: `${c.id}-copy-${n + 1}`,
        ordinal: n + 1,
      }));
    }
  });
  const input = {
    version: 'source-boons-v1',
    rules: [
      { sourceId: 'invented-workbook', locator: 'Invented rules: supply, duplicates, return' },
    ],
    definitions: cards.map((c, i) => ({
      cardId: c.id,
      kind: kinds[i],
      cardHash: hash(c),
      originalHash: hash(c.text.original),
      mechanicsHash: hash(c.mechanics),
      usageHash: hash(c.usage),
      source: c.text.original.reference,
      effects: effects[i],
    })),
  };
  return { ...f, boonInput: input };
}

export function runtimeBoons(edit = () => {}, verified = true) {
  const f = boonFixture(verified);
  const combat = {
    version: 'combat-windows-v1',
    roundId: '00000000-0000-4000-8000-000000000099',
    artifactFingerprint: hash('invented combat'),
    clauses: [],
    heroes: [],
  };
  edit(f, combat);
  const a = api.compileBoons(f.raw, f.boonInput);
  const p = api.freezePhysical(
    f.raw,
    binding,
    f.heroes,
    '1'.repeat(64),
    undefined,
    { artifact: api.compilePhysicalFronts(f.raw, f.ir, f.catalog), catalog: f.catalog },
    undefined,
    a,
  );
  let revision = 0;
  return {
    ...f,
    p,
    combat,
    open(children, spatial) {
      const n = p.runs.length;
      return api.openPhysical(
        p,
        { ...source, effectId: `invented-source-${n}` },
        { ...f.program(children), combat },
        structuredClone(p.snapshot.resolution.resources ?? f.context),
        spatial,
      );
    },
    answer(input, playerId = p.snapshot.active.actorPlayerId) {
      api.answerPhysical(
        p,
        p.snapshot.active.runId,
        typeof input === 'string' ? { kind: 'physical-choice', option: input } : input,
        evidence(revision++, playerId),
      );
    },
  };
}

export function inventedOutcome(heroId = 'hero-1', offered = { damage: 0, fear: 0 }) {
  return {
    attackId: 'invented-attack',
    groupId: 'invented-group',
    instructionId: 'fixture.assets:20',
    instructionHash: hash('invented instruction'),
    recipientHeroId: heroId,
    cause: 'activation',
    rootSource: 'invented-root',
    directSource: 'invented-direct',
    returnTo: 'invented-return',
    artifactFingerprint: hash('invented combat'),
    projectionFingerprint: hash('invented map'),
    figureIds: ['invented-figure'],
    offered,
    negated: { damage: 0, fear: 0 },
    prevented: { damage: 0, fear: 0 },
    suffered: { damage: 0, fear: 0 },
    childSources: [],
    sealed: true,
  };
}
export function boonGrant(hero = 0, boon = 'determined') {
  return {
    kind: 'combat-addition',
    hero,
    addition: {
      key: 'invented-addition',
      textHash: hash('invented addition'),
      predicate: 'always',
      window: 'condition-known',
      effect: { op: 'gain-boon', boon },
    },
    outcome: inventedOutcome(`hero-${hero + 1}`),
  };
}
