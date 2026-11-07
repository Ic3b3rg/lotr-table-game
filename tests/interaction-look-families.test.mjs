import test from 'node:test';
import assert from 'node:assert/strict';
import { lairRuntime } from './lair-victory-runtime-helper.mjs';
import { baseRuntime } from './base-products-runtime-helper.mjs';
import { itemRuntime } from './item-runtime-helper.mjs';
import { searchRuntime } from './search-runtime-helper.mjs';
import { threatTokenRuntime } from './threat-tokens-runtime-helper.mjs';
import { linkedRuntime } from './linked-runtime-helper.mjs';
import { lookInput, hash } from './interaction-look-helper.mjs';
import {
  readyMission,
  reachMission,
  commitMission,
  drainMission,
  ok,
} from './mission-combat-helper.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { runtime } from './interaction-look-runtime.mjs';
import { readyClues, atClue, commitClue, finishPhysical } from './clue-progression-http-helper.mjs';

function attest(f) {
  for (const h of f.catalog.heroes) h.maxHands = 2;
  const ir = lookInput(f.raw, f.catalog);
  f.ir.interactionLook = ir.interactionLook;
  f.ir.policies.push(...ir.policies);
}
function activate(f) {
  f.physical.cycle = { interactionLookRules: 'source-interaction-look-v1' };
  return f;
}
function finishAttempt(f) {
  for (let n = 0; n < 150 && f.sc.play.active; n++) {
    const q = f.sc.pending,
      a = f.physical.snapshot.active;
    assert.ok(q, 'source attempt must hold a concrete continuation');
    const input =
      q.kind === 'physical'
        ? a.mode === 'allocate'
          ? { kind: 'physical-allocate', ability: null, damage: 0, fear: 0 }
          : a.mode === 'select'
            ? { kind: 'physical-select', ids: a.options.slice(0, a.minimum).map((o) => o.id) }
            : a.mode === 'scout'
              ? {
                  kind: 'physical-scout',
                  prepare: null,
                  top: a.options.map((o) => o.id),
                  bottom: [],
                  discard: null,
                }
              : {
                  kind: 'physical-choice',
                  option:
                    ['continue', 'resolve', 'close', 'reveal'].find((id) =>
                      a.options.some((o) => o.id === id && !o.unavailable),
                    ) ?? a.options.find((o) => !o.unavailable).id,
                }
        : q.kind === 'choice'
          ? {
              kind: 'choice',
              event: q.options.find((o) => o.event === 'LEAVE')?.event ?? q.options[0].event,
            }
          : q.kind === 'hero-choice'
            ? { kind: 'choose-hero', heroId: q.options[0].event }
            : { kind: 'ack' };
    f.answer(input);
  }
  assert.equal(f.sc.play.active, null);
}
for (const [family, create] of [
  ['lair', () => lairRuntime({ edit: attest, successes: 3 })],
  ['baseProducts', () => baseRuntime({ edit: attest, success: 1 })],
  ['items', () => itemRuntime({ edit: attest, success: 1 })],
  ['searches', () => searchRuntime({ edit: attest, success: 1 })],
  ['threatTokens', () => threatTokenRuntime({ edit: attest, success: 1 })],
  ['linked', () => linkedRuntime({ edit: attest })],
])
  test(`${family} actual A1 confirmation resolves one source-bound look then returns`, () => {
    const f = activate(create()),
      before = structuredClone(f.state.journey);
    f.commit();
    assert.equal(f.physical.snapshot.active.purpose, 'interaction-look');
    assert.equal(f.physical.snapshot.resolution.privateLooks.length, 1);
    assert.equal(f.state.round.heroes[0].actionsUsed, 1);
    // These existing isolated source fixtures have no ordinary-cycle seed. The
    // source parent now owns the marked primitive; validate its own full replay.
    delete f.physical.cycle;
    finishAttempt(f);
    assert.equal(f.physical.snapshot.resolution.privateLooks.length, 1);
    assert.equal(f.sc.play.attempts[0].returned, true);
    assert.deepEqual(f.state.journey, before);
  });

test('firstCombat actual committed entry choice resolves look before its test and deployment callback', async (t) => {
  const r = await readyMission(t, {
    fate: 1,
    frontEdit(ir, catalog, raw) {
      const input = lookInput(raw, catalog);
      ir.interactionLook = input.interactionLook;
      ir.policies.push(...input.policies);
    },
  });
  await reachMission(r);
  await ok(commitMission(r, 'TALK'));
  const waiting = await readSession(r.host);
  assert.equal(waiting.physical.active.purpose, 'interaction-look');
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'continue' }));
  await drainMission(r);
  const saved = (await readBackup(r.host)).payload.state;
  assert.equal(saved.physical.snapshot.resolution.privateLooks.length, 1);
  assert.equal(saved.scenario.play.attempts[0].returned, true);
  assert.equal(saved.scenario.firstCombat.spawns.length, 1);
});

test('A2 interaction remains gated before mutation even with a prospective hero', () => {
  const f = activate(baseRuntime({ edit: attest }));
  f.sc.pack.manifest.scope = 'battle-startup-v1';
  const before = structuredClone(f.state);
  assert.throws(
    () => f.commit(),
    (e) => e.code === 'SCENARIO_CAPABILITY',
  );
  assert.deepEqual(f.state, before);
});

test('clues real HTTP interaction looks once and completes its source reward and return', async (t) => {
  const r = await readyClues(
    t,
    () => {},
    (ir, catalog, raw) => {
      const input = lookInput(raw, catalog);
      ir.interactionLook = input.interactionLook;
      ir.policies.push(...input.policies);
    },
  );
  await atClue(r);
  await ok(commitClue(r));
  assert.equal((await readSession(r.host)).physical.active.purpose, 'interaction-look');
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'continue' }));
  await finishPhysical(r);
  for (let n = 0; n < 12 && (await readSession(r.host)).scenario.pending; n++)
    await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
  const saved = (await readBackup(r.host)).payload.state;
  assert.equal(saved.physical.snapshot.resolution.privateLooks.length, 1);
  assert.equal(saved.scenario.play.attempts.at(-1).returned, true);
});

test('linked paid entry choice on a second visit is another true source interaction', () => {
  const f = activate(
    linkedRuntime({
      edit(fixture, pack) {
        attest(fixture);
        // Declared invented source input: the return visit already has supplies.
        pack.definitions
          .find((d) => d.variables.some((v) => v.name === 'supplied'))
          .variables.find((v) => v.name === 'supplied').value = true;
      },
    }),
  );
  f.commit();
  delete f.physical.cycle;
  finishAttempt(f);
  activate(f);
  f.commit(0, 0, 'DELIVER');
  assert.equal(f.physical.snapshot.active.purpose, 'interaction-look');
  delete f.physical.cycle;
  finishAttempt(f);
  assert.equal(f.physical.snapshot.resolution.privateLooks.length, 2);
  assert.equal(f.sc.play.attempts.filter((a) => a.returned).length, 2);
});
