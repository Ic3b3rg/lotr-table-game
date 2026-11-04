import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileScenarioPack } from '../dist/scenario-library.mjs';
import { scenarioFixture } from './fixtures/scenario.mjs';
import { attachEncounter } from './original-encounter-helper.mjs';
import { certificates } from './fixtures/exploration.mjs';
import { attachRounds, roundsCertificate } from './fixtures/source-rounds.mjs';
import { state, action } from './fixtures/scenario.mjs';
function compilation() {
  const pack = scenarioFixture();
  attachEncounter(pack);
  pack.timers = ['example.assets:803'];
  pack.definitions.push({
    source: pack.timers[0],
    initial: 0,
    variables: [{ name: 'running', type: 'bool', value: true }],
    handlers: {},
    states: [state(0, [action(0, 'release')])],
  });
  attachRounds(pack);
  const cs = structuredClone(certificates(pack));
  const timer = cs.at(-1);
  timer.states.find((s) => s.index === 42).transitions.EXPIRED = 99;
  timer.deferredEdges.push({
    from: 42,
    event: 'EXPIRED',
    to: 99,
    capability: 'example-expiration',
  });
  return { pack, certificates: cs, roundsCertificate: roundsCertificate(pack) };
}
test('compiler freezes an attested phase source and a conditional timer boundary', () => {
  const result = compileScenarioPack(compilation());
  assert.equal(result.pack.manifest.rounds.version, 'source-rounds-v1');
  assert.equal(result.pack.manifest.rounds.threat.perHero, 3);
  assert.equal(
    result.pack.definitions.at(-1).states.find((s) => s.index === 42).deferredTransitions.EXPIRED,
    'example-expiration',
  );
});
test('phase compiler rejects unattested data, broken bindings and unlabelled omitted branches', () => {
  for (const edit of [
    (i) => delete i.roundsCertificate,
    (i) => i.pack.manifest.rounds.threat.perHero++,
    (i) => {
      i.pack.manifest.rounds.bindings.threat = 'missing';
      i.roundsCertificate = roundsCertificate(i.pack);
    },
    (i) => {
      i.pack.manifest.rounds.configuration.initialEnemyGroups.push('example.assets:9999');
      i.roundsCertificate = roundsCertificate(i.pack);
    },
    (i) => delete i.pack.definitions.at(-1).states.find((s) => s.index === 42).deferredTransitions,
    (i) => i.certificates.at(-1).deferredEdges.splice(0),
  ]) {
    const input = compilation();
    edit(input);
    assert.throws(() => compileScenarioPack(input));
  }
});
