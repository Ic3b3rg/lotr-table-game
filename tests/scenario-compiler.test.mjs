import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as lib from '../dist/scenario-library.mjs';
import { scenarioFixture } from './fixtures/scenario.mjs';
import { hash } from './fixtures/map-freeze.mjs';
function input() {
  const pack = scenarioFixture();
  return {
    pack,
    certificates: pack.definitions.map((d) => ({
      source: d.source,
      objectHash: hash(d),
      lifecycleHash: hash('lifecycle'),
      initial: d.initial,
      handlers: { ...d.handlers },
      states: d.states.map((s) => ({
        index: s.index,
        transitions: { ...s.transitions },
        actions: s.actions.map((a) => ({
          index: a.index,
          type: a.origin.type,
          parameterHash: a.origin.parameterHash,
          enabled: true,
        })),
      })),
      deferredEdges: [],
    })),
  };
}
test('compiler: ogni azione eseguibile e ogni handler ha evidenza, senza omissioni silenziose', () => {
  assert.equal(typeof lib.compileScenarioPack, 'function');
  const raw = input(),
    compiled = lib.compileScenarioPack(raw);
  assert.equal(compiled.pack.manifest.evidenceHash, hash(raw.certificates));
  for (const edit of [
    (r) => r.certificates.pop(),
    (r) => (r.certificates[0].states[0].actions[0].parameterHash = '0'.repeat(64)),
    (r) =>
      r.certificates[0].states[0].actions.push({
        index: 2,
        type: 'Invented.NotImplemented',
        parameterHash: hash('unknown'),
        enabled: true,
      }),
    (r) => (r.certificates[0].handlers.NEW_EVENT = 1),
    (r) => (r.pack.definitions[0].handlers.MISSING = 1),
    (r) => (r.pack.definitions[0].states[0].actions[0].op = 'eval'),
  ]) {
    const bad = structuredClone(raw);
    edit(bad);
    assert.throws(() => lib.compileScenarioPack(bad));
  }
});
test('testo fonte: enfasi e icone accessibili, markup sconosciuto resta testo e PUA ignote bloccano', () => {
  assert.equal(typeof lib.compileSourceText, 'function');
  assert.deepEqual(lib.compileSourceText('[i]Inventato[/i] [b]forte[/b]')[0], {
    kind: 'text',
    text: 'Inventato',
    style: 'italic',
  });
  const tokens = lib.compileSourceText('<b>Testo inventato</b> \uf461 <script>inventato</script>');
  assert.deepEqual(tokens[0], { kind: 'text', text: 'Testo inventato', style: 'bold' });
  assert.ok(tokens.some((t) => t.kind === 'icon' && t.name === 'spirit'));
  assert.ok(tokens.some((t) => t.kind === 'text' && t.text.includes('<script>')));
  assert.throws(() => lib.compileSourceText('simbolo \ueeee'), /icon/i);
});
test('un certificato non rende eseguibile un tipo fonte ignoto o associato all’handler sbagliato', () => {
  const unknown = input();
  unknown.pack.definitions[0].states[0].actions[0].origin.type = 'Invented.UnknownAction';
  unknown.certificates[0].states[0].actions[0].type = 'Invented.UnknownAction';
  assert.throws(() => lib.compileScenarioPack(unknown), /handler|fonte/i);
  const wrongHandler = input();
  wrongHandler.pack.definitions[0].states[0].actions[0].op = 'getTile';
  assert.throws(() => lib.compileScenarioPack(wrongHandler), /handler|fonte/i);
});
test('i controlli carte inviano richiesta/source/hero correnti anziché comandi liberi', () => {
  assert.equal(typeof lib.bindScenarioCards, 'function');
  const session = {
    scenario: {
      id: 'scenario',
      phase: 'setup',
      packFingerprint: 'pack',
      projectionFingerprint: 'map',
      pending: {
        id: 'pending',
        fingerprint: 'source',
        heroId: 'hero',
        kind: 'test',
        stage: 'revealed',
      },
    },
  };
  const bound = lib.bindScenarioCards(session, { type: 'CONVERT_FATE', testId: 'test' });
  assert.equal(bound.type, 'SCENARIO_INPUT');
  assert.equal(bound.heroId, 'hero');
  assert.equal(bound.pendingId, 'pending');
  assert.deepEqual(bound.input, { kind: 'convert' });
  assert.equal(
    lib.bindScenarioCards({ scenario: null }, { type: 'CONVERT_FATE', testId: 'test' }).type,
    'CONVERT_FATE',
  );
});
test('physical instructions retain accessible damage and fear symbols from their packets', () => {
  assert.deepEqual(
    lib
      .compileSourceText('\uf469 \uf468')
      .filter((x) => x.kind === 'icon')
      .map((x) => x.name),
    ['damage', 'fear'],
  );
});
