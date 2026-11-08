import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime } from './camp-departure-runtime.mjs';

const futureProgram = {
  profile: 'source-fronts-v1',
  children: [{ kind: 'combat-addition', addition: { effect: { op: 'discard-boons' } } }],
};
const futureScenario = {
  pack: { definitions: [{ states: [{ actions: [{ op: 'physical', program: futureProgram }] }] }] },
};

test('schemas1–34 reject prospective battle phases only at their real saved locations', () => {
  const first = { pack: { manifest: { campDeparture: { battleRounds: {} } } } };
  const second = { pack: { manifest: { battleStartup: { battleRounds: {} } } } };
  for (let schemaVersion = 1; schemaVersion <= 34; schemaVersion++)
    for (const form of [
      { scenario: first },
      { scenario: second },
      { scenario: { rounds: { version: 'source-battle-rounds-v1' } } },
      { scenario: { pack: { manifest: { rounds: { version: 'source-battle-rounds-v1' } } } } },
      {
        scenario: {
          pack: {
            manifest: { combat: { source: { shadow: { version: 'source-battle-shadow-v1' } } } },
          },
        },
      },
      { physical: { cycle: { seed: { scenario: second } } } },
      { episodes: [{ scenario: first }] },
      { scenario: { enemies: { groups: [{ battleRecipe: 'invented-source-recipe' }] } } },
      { scenario: futureScenario },
      { physical: { runs: [{ program: futureProgram }] } },
      { physical: { cycle: { seed: { scenario: futureScenario } } } },
      { episodes: [{ physical: { runs: [{ program: futureProgram }] } }] },
    ])
      assert.throws(
        () => runtime.parseState({ schemaVersion, ...form }),
        /Fasi.*battaglia.*storico/,
      );
});

import { startHost } from './host-helper.mjs';
import { readBackup } from './skill-test-helper.mjs';
import { readyScenario, startScenario } from './scenario-helper.mjs';
import { readyFronts } from './physical-front-helper.mjs';
import { hash } from './fixtures/map-freeze.mjs';

for (const kind of ['combat-addition', 'enemy-attack'])
  test(`schema34 cannot admit a future physical ${kind} discard-boons program`, async (t) => {
    const r = await readyFronts(t, (pack) => {
      const original = pack.definitions[0].states.find((s) => s.index === 12),
        future = structuredClone(original);
      future.index = 13;
      future.actions[0].program.children = [
        {
          kind,
          hero: 0,
          ...(kind === 'enemy-attack' ? { negate: 'might' } : {}),
          addition: {
            key: 'invented-future-addition',
            textHash: hash('invented discard-benefits text'),
            predicate: 'always',
            window: 'after-enemy-attack',
            effect: { op: 'discard-boons' },
          },
          outcome: {
            attackId: 'invented-future-attack',
            groupId: 'invented-future-group',
            instructionId: 'fixture.assets:50',
            instructionHash: hash('invented instruction'),
            recipientHeroId: 'hero-1',
            cause: 'counterattack',
            rootSource: 'invented-root',
            directSource: 'invented-base',
            returnTo: 'invented-return',
            artifactFingerprint: hash('invented closure'),
            projectionFingerprint: hash('invented projection'),
            figureIds: ['invented-figure'],
            offered: { damage: 0, fear: 0 },
            negated: { damage: 0, fear: 0 },
            prevented: { damage: 0, fear: 0 },
            suffered: { damage: 0, fear: 0 },
            childSources: [],
            sealed: false,
          },
        },
      ];
      future.actions[0].origin.parameterHash = hash(future.actions[0].program);
      pack.definitions[0].states.push(future);
    });
    const response = await startScenario(r.host, r.player);
    assert.equal(response.status, 200, await response.clone().text());
    const current = (await readBackup(r.host)).payload.state;
    assert.doesNotThrow(() => runtime.parseState(current));
    const old = { ...structuredClone(current), schemaVersion: 34 };
    assert.throws(() => runtime.parseState(old), /Fasi.*battaglia.*storico/);
  });

test('complete schema34 payload migrates structurally to35 without altering any old domain value', async (t) => {
  const host = await startHost();
  t.after(() => host.dispose());
  const current = (await readBackup(host)).payload.state,
    old = { ...structuredClone(current), schemaVersion: 34 },
    raw = JSON.stringify(old);
  assert.deepEqual(runtime.parseState(old), current);
  assert.equal(JSON.stringify(old), raw);
  assert.deepEqual(runtime.parseState(runtime.parseState(old)), current);
});

test('battle phase words in old global dictionaries remain ordinary data', async (t) => {
  const r = await readyScenario(t, (pack) => {
    for (const name of [
      'battleRounds',
      'battle',
      'bannerPools',
      'scriptedGroups',
      'callbacks',
      'divideInt',
      'source-battle-rounds-v1',
      'discard-boons',
      'combat-addition',
      'enemy-attack',
      'children',
      'addition',
    ])
      pack.globals.push({ name, type: 'string', value: 'inert/' + name });
  });
  assert.equal((await startScenario(r.host, r.player)).status, 200);
  const current = (await readBackup(r.host)).payload.state,
    old = { ...structuredClone(current), schemaVersion: 34 };
  assert.deepEqual(runtime.parseState(old), current);
});
