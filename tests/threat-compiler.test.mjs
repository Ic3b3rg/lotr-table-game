import test from 'node:test';
import assert from 'node:assert/strict';
import { compileScenarioPack, parseScenarioPack } from '../dist/scenario-library.mjs';
import { threatCompilation, attestThreats, threatInput } from './fixtures/threat-continuations.mjs';
import { hash } from './fixtures/map-freeze.mjs';

test('three distinct source threat forms require their own complete attestation', () => {
  const input = threatCompilation();
  const compiled = compileScenarioPack(input).pack;
  assert.equal(compiled.manifest.threatContinuations.version, 'source-threat-continuations-v1');
  assert.deepEqual(
    compiled.manifest.threatContinuations.thresholds.map((t) => t.form),
    ['spawn-register', 'darkness-spawn-register', 'spawn-terminal'],
  );
  assert.deepEqual(parseScenarioPack(compiled).pack, compiled);
  delete input.threatContinuationsCertificate;
  assert.throws(() => compileScenarioPack(input), /attestat/);
});

test('coherently attested threat mutations cannot broaden historical shapes or lose owners, arithmetic and population', () => {
  for (const edit of [
    (p) => p.manifest.threatContinuations.thresholds.pop(),
    (p) => {
      delete p.definitions
        .find((d) => d.source === p.manifest.threatContinuations.thresholds[0].definition)
        .states.find((s) => s.index === 1).actions[1].suffering;
    },
    (p) => {
      p.manifest.threatContinuations.thresholds[0].suffering.amount++;
    },
    (p) => {
      p.manifest.threatContinuations.thresholds[0].owner = 'example.assets:99999';
    },
    (p) => {
      p.manifest.threatContinuations.methods.controller.bodyHash = hash('foreign controller');
    },
    (p) => {
      p.manifest.threatContinuations.thresholds[0].next.threshold++;
    },
    (p) => {
      const d = p.definitions.find(
        (d) => d.source === p.manifest.threatContinuations.thresholds[1].definition,
      );
      d.states.find((s) => s.index === 4).actions[0].value = false;
    },
    (p) => {
      const d = p.definitions.find(
        (d) => d.source === p.manifest.threatContinuations.thresholds[0].definition,
      );
      d.states.find((s) => s.index === 1).actions[0].right.value++;
    },
    (p) => {
      const d = p.definitions.find(
        (d) => d.source === p.manifest.threatContinuations.thresholds[2].definition,
      );
      d.states.find((s) => s.index === 1).actions[1].filter.ExcludeIfAny = 4;
    },
    (p) => {
      const d = p.definitions.find(
        (d) => d.source === p.manifest.threatContinuations.thresholds[2].definition,
      );
      d.states.find((s) => s.index === 1).actions[1].excludeGameEnemyPoints = true;
    },
    (p) => {
      const d = p.definitions.find(
        (d) => d.source === p.manifest.threatContinuations.thresholds[2].definition,
      );
      d.states.find((s) => s.index === 1).transitions.FINISHED = d.initial;
    },
  ]) {
    const p = threatCompilation().pack;
    edit(p);
    attestThreats(p);
    assert.throws(() => compileScenarioPack(threatInput(p)));
  }
  const p = threatCompilation().pack;
  delete p.manifest.threatContinuations;
  assert.throws(
    () => parseScenarioPack(p),
    /Registrazione|soglia/i,
    'the old four-state certificate still rejects a newly compiled successor without the new capability',
  );
});
