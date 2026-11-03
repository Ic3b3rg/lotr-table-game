import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileScenarioPack } from '../dist/scenario-library.mjs';
import { scenarioFixture, state, text } from './fixtures/scenario.mjs';
import { hash } from './fixtures/map-freeze.mjs';

// Invented identities, parameters and content. No original mapping or narrative.
export function compilation() {
  const pack = scenarioFixture(),
    prefab = pack.manifest.prefabs[0],
    d = pack.definitions[1];
  pack.manifest.scope = 'original-encounter-v1';
  pack.manifest.playablePrefabs = [prefab.source];
  const a = (index, op, type, fields) => ({
    index,
    op,
    origin: { type, parameterHash: hash(fields), load: 'hash-match-positional' },
    ...fields,
  });
  d.states[0].transitions['NODE CLICKED'] = 6;
  d.states.push(
    state(
      6,
      [
        a(0, 'confirm', 'FFG.JIME.Actions.DisplayMessageCancelConfirm', {
          text: text('Conferma inventata'),
          label: text('Cerca'),
          cancelLabel: text('Annulla'),
          confirmEvent: 'YES',
          cancelEvent: 'NO',
        }),
      ],
      { YES: 7, NO: 0 },
    ),
    state(
      7,
      [
        a(0, 'sourceTest', 'FFG.JIME.Actions.DisplayMessageCancelConfirm', {
          text: text('Prova inventata'),
          stat: 'agility',
          target: 2,
          passEvent: 'OK',
          failEvent: 'BAD',
        }),
      ],
      { OK: 8, BAD: 0 },
    ),
    state(
      8,
      [
        a(0, 'choice', 'FFG.JIME.Actions.DisplayMessageMultipleChoice', {
          text: text('Scelta inventata'),
          options: [{ event: 'NEXT', label: text('Prosegui') }],
          cancel: null,
        }),
      ],
      { NEXT: 9 },
    ),
    state(
      9,
      [
        a(0, 'challenge', 'FFG.JIME.Actions.DisplayMessageChallenge', {
          text: text('Conteggio inventato'),
          stat: 'spirit',
          sum: { scope: 'local', name: 'total' },
          bounds: [
            { maximum: 2, event: 'LOW' },
            { maximum: 4, event: 'HIGH' },
          ],
        }),
      ],
      { LOW: 0, HIGH: 10 },
    ),
    state(
      10,
      [a(0, 'nullProduct', 'FFG.JIME.OwnsProducts', { products: [null], falseEvent: 'BASE' })],
      { BASE: 11 },
    ),
    state(11, [a(0, 'lore', 'FFG.JIME.Actions.AddLore', { amount: 2 })], { FINISHED: 0 }),
  );
  d.variables.push({ name: 'total', type: 'int', value: 0 });
  return {
    pack,
    certificates: pack.definitions.map((d) => ({
      source: d.source,
      objectHash: hash(d),
      lifecycleHash: hash('invented lifecycle'),
      initial: d.initial,
      handlers: { ...d.handlers },
      deferredEdges: [],
      states: d.states.map((s) => ({
        index: s.index,
        transitions: { ...s.transitions },
        actions: s.actions.map((a) => ({
          index: a.index,
          type: a.origin.type,
          parameterHash: a.origin.parameterHash,
          enabled: true,
          instructionHash: hash(a),
        })),
      })),
    })),
  };
}
test('original manifest compiles only source-bound instructions and preserves null-product exclusion', () => {
  const raw = compilation(),
    compiled = compileScenarioPack(raw);
  assert.equal(compiled.pack.manifest.scope, 'original-encounter-v1');
  for (const edit of [
    (r) => {
      r.pack.definitions[1].states.find((s) => s.index === 7).actions[0].stat = 'might';
    },
    (r) => {
      r.pack.definitions[1].states.find((s) => s.index === 11).actions[0].amount++;
    },
    (r) => {
      r.certificates[1].states[1].actions[0].instructionHash = undefined;
    },
    (r) => {
      r.pack.manifest.playablePrefabs = [];
    },
    (r) => {
      r.pack.definitions[1].states.find((s) => s.index === 10).actions[0].products = ['invented'];
    },
    (r) => {
      r.pack.manifest.scope = 'startup-only';
    },
  ]) {
    const bad = structuredClone(raw);
    edit(bad);
    assert.throws(() => compileScenarioPack(bad));
  }
});
