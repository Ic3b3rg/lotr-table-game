import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as combat from '../dist/combat-library.mjs';
import { combatFixture, seedFor } from './fixtures/combat.mjs';
import { hash } from './fixtures/map-freeze.mjs';

const spawn = (a, id = 'spawn-1') => ({ id, spawnId: a.compiled.spawns[0].id });

test('spawn places two independent figures on the frozen source space and spends only points', () => {
  assert.equal(typeof combat.createCombatKernel, 'function');
  const a = combat.compileCombatSource(combatFixture()),
    seed = seedFor(a),
    k = combat.createCombatKernel(a, seed);
  const receipt = k.spawn(spawn(a));
  assert.equal(receipt.status, 'spawned');
  assert.equal(receipt.continuation.kind, 'source-event');
  assert.deepEqual(
    k.view().group.figures.map((f) => f.health),
    [4, 4],
  );
  assert.notEqual(k.view().group.figures[0].id, k.view().group.figures[1].id);
  assert.deepEqual(k.view().group.position, a.compiled.spawns[0].position);
  assert.deepEqual(k.view().availability, { inPlay: 2, pending: 0, reserved: 0, available: 4 });
  assert.equal(k.view().budget, 0);
  assert.equal(k.view().group.exhausted, false);
  assert.deepEqual(k.spawn(spawn(a)), receipt);
  assert.deepEqual(seed, seedFor(a));
  const checkpoint = k.checkpoint();
  assert.deepEqual(combat.restoreCombatKernel(checkpoint).checkpoint(), checkpoint);
  const changed = k.view();
  changed.group.figures[0].health = 0;
  assert.equal(k.view().group.figures[0].health, 4);
});

test('spawn distinguishes no-capacity failure, unsupported shortage and the source budget clamp', () => {
  const a = combat.compileCombatSource(combatFixture());
  const full = combat.createCombatKernel(
    a,
    seedFor(a, { availability: { inPlay: 4, pending: 1, reserved: 1 }, budget: 3 }),
  );
  const failure = full.spawn(spawn(a));
  assert.equal(failure.status, 'failed');
  assert.equal(failure.continuation.event, 'NO');
  assert.equal(full.view().budget, 3);
  assert.equal(full.view().group, null);
  const short = combat.createCombatKernel(
    a,
    seedFor(a, { availability: { inPlay: 4, pending: 1, reserved: 0 }, budget: 3 }),
  );
  const before = short.checkpoint();
  assert.deepEqual(short.spawn(spawn(a)).gates, ['spawn-availability-unproven']);
  assert.deepEqual(short.checkpoint(), before);
  const rich = combat.createCombatKernel(a, seedFor(a, { budget: 99 }));
  rich.spawn(spawn(a));
  assert.equal(rich.view().budget, 5);
  const source = combatFixture();
  const action = source.fsms[0].states[0].actions[0];
  action.parameters.AdditionalPoints.value = 0;
  action.parameterHash = hash(action.parameters);
  const lowArtifact = combat.compileCombatSource(source);
  const low = combat.createCombatKernel(lowArtifact, seedFor(lowArtifact));
  assert.equal(low.spawn(spawn(lowArtifact)).status, 'failed');
  assert.equal(low.view().budget, 0);
});

test('checkpoint replays receipts and rejects altered or cross-source state even when rehashed', () => {
  const a = combat.compileCombatSource(combatFixture()),
    k = combat.createCombatKernel(a, seedFor(a));
  k.spawn(spawn(a));
  const checkpoint = k.checkpoint();
  for (const mutate of [
    (c) => {
      c.state.group.figures[0].health++;
    },
    (c) => {
      c.state.group.position.nodePosition[0]++;
    },
    (c) => {
      c.state.budget++;
    },
    (c) => {
      c.journal[0].receipt.status = 'failed';
    },
    (c) => {
      c.journal = [];
    },
    (c) => {
      c.projectionFingerprint = '0'.repeat(64);
    },
  ]) {
    const bad = structuredClone(checkpoint);
    mutate(bad);
    const { fingerprint, ...data } = bad;
    bad.fingerprint = hash(data);
    assert.throws(() => combat.restoreCombatKernel(bad));
  }
  assert.throws(() =>
    combat.restoreCombatKernel(checkpoint, { artifactFingerprint: '0'.repeat(64) }),
  );
  assert.throws(() => k.spawn({ ...spawn(a), spawnId: 'foreign' }));
  assert.throws(() =>
    combat.createCombatKernel(
      a,
      seedFor(a, { availability: { inPlay: -1, pending: 0, reserved: 0 } }),
    ),
  );
});

test('checkpoint size is preflighted before committing another result', () => {
  const source = combatFixture();
  source.assets[0].data.inertPadding = Array(70000).fill(0);
  source.assets[0].dataHash = hash(source.assets[0].data);
  const a = combat.compileCombatSource(source);
  const k = combat.createCombatKernel(a, seedFor(a), {
    externalEffect(query) {
      return {
        id: query.id,
        contextFingerprint: hash(query),
        artifactFingerprint: query.artifactFingerprint,
        projectionFingerprint: query.projectionFingerprint,
        hits: 0,
        modifiers: [],
        evidence: {
          file: 'invented.assets',
          locator: 'invented bounded effect',
          sha256: hash('source'),
        },
      };
    },
  });
  k.spawn(spawn(a));
  let last;
  assert.throws(() => {
    for (let n = 0; n < 1000; n++) {
      last = k.view();
      k.applyExternal({ id: `effect-${n}`, effectId: 'bounded' });
    }
  }, /Limite nodi|Limite byte/);
  assert.deepEqual(k.view(), last);
  const c = k.checkpoint();
  assert.deepEqual(combat.restoreCombatKernel(c).checkpoint(), c);
});
