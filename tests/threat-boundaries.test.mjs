import test from 'node:test';
import assert from 'node:assert/strict';
import { readyThreats, runtime, endTurns } from './threat-helper.mjs';
import { readBackup } from './skill-test-helper.mjs';
import { startHost } from './host-helper.mjs';

test('terminal preflight respects source return, cap overshoot, historical gates and hero priority on immutable synthetic inputs', async (t) => {
  const r = await readyThreats(t);
  await endTurns(r);
  const source = (await readBackup(r.host)).payload.state;
  const check = (edit, allowed, pattern) => {
    const s = structuredClone(source);
    edit(s);
    const before = structuredClone(s);
    if (allowed) assert.doesNotThrow(() => runtime.preflightSourceShadow(s, 'c'.repeat(64)));
    else assert.throws(() => runtime.preflightSourceShadow(s, 'c'.repeat(64)), pattern);
    assert.deepEqual(s, before, 'entire preflight input is immutable');
  };
  check((s) => {
    s.scenario.globals.pressure = 61;
  }, true);
  check(
    (s) => {
      const d = s.scenario.pack.definitions.find((d) => d.source === s.scenario.pack.principal);
      d.deferredHandlers[s.scenario.pack.manifest.rounds.events.start] =
        'invented-next-round-unavailable';
    },
    true,
    'terminal continuation never invents a ROUND_START',
  );
  check((s) => {
    s.scenario.pack.manifest.rounds.threat.limit = 83;
    const d = s.scenario.pack.definitions.find((d) => d.source === s.scenario.pack.principal);
    d.deferredHandlers[s.scenario.pack.manifest.rounds.events.start] =
      'invented-next-round-unavailable';
  }, false);
  check(
    (s) => {
      s.scenario.globals.nightInstruction = 'invented-uncompiled-override';
    },
    false,
    /oscurità/,
  );
  check(
    (s) => {
      delete s.scenario.pack.manifest.threatContinuations;
    },
    false,
    /perdita/,
  );
  check((s) => {
    const d = s.scenario.pack.definitions.find((d) => d.source === 'example.assets:1942');
    d.states.find((s) => s.index === 1).transitions = {};
    d.states.find((s) => s.index === 1).deferredTransitions = { FINISHED: 'invented-last-return' };
  }, false);
  const blocked = structuredClone(source);
  blocked.scenario.globals.nightInstruction = 'invented-uncompiled-override';
  const blockedBefore = structuredClone(blocked);
  assert.equal(
    runtime.sourceShadowAvailability(blocked).enabled,
    false,
    'the UI must expose the complete new continuation gate before confirmation',
  );
  assert.deepEqual(blocked, blockedBefore);
  const hero = structuredClone(source);
  hero.scenario.globals.pressure = 100;
  const ls = hero.physical.snapshot.lastStand;
  ls.heroes[0].defeated = true;
  ls.lossDue = {
    runId: hero.generation,
    heroId: hero.preparation.heroes[0].heroId,
    instructionHash: 'd'.repeat(64),
  };
  assert.equal(
    runtime.beginSourceShadow(hero, 'invented-priority-request-000001', 'e'.repeat(64)),
    false,
  );
  assert.equal(hero.scenario.conclusion.timing, 'shadow-start');
  assert.deepEqual(hero.scenario.conclusion.cause, ls.lossDue);
  assert.deepEqual(hero.scenario.rounds, source.scenario.rounds);
  assert.deepEqual(hero.scenario.enemies, source.scenario.enemies);
  assert.deepEqual(hero.physical.runs, source.physical.runs);
});

test('schema18 migration preserves the full schema17 payload and never installs a new capability', async (t) => {
  const host = await startHost();
  t.after(() => host.dispose());
  const raw = (await readBackup(host)).payload.state;
  assert.equal(raw.schemaVersion, 23);
  const old = structuredClone(raw);
  old.schemaVersion = 17;
  assert.deepEqual(runtime.parseState(old), raw);
  const r = await readyThreats(t);
  const capability = (await readBackup(r.host)).payload.state;
  capability.schemaVersion = 17;
  assert.throws(() => runtime.parseState(capability), /schema storico/);
});
