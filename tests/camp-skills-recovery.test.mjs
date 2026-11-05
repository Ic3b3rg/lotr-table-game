import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  readyCamp,
  reachCamp,
  buyInput,
  campaignHero,
  training,
  scenarioInput,
  readSession,
  readBackup,
  ok,
} from './camp-skills-helper.mjs';
import { signBackup } from './skill-test-helper.mjs';
import { startHost } from './host-helper.mjs';
import { recoverSeat } from './last-stand-helper.mjs';
import { campEvidence } from './camp-skills-evidence.mjs';

export const administrative = (value, expected) => {
  const copy = structuredClone(value);
  for (const key of ['generation', 'revision', 'updatedAt']) copy[key] = expected[key];
  return copy;
};

test('SIGKILL after camp entry, purchases, role change and refund restores whole inventory, balances, reward and origin on new empty packless hosts', async (t) => {
  const r = await readyCamp(t);
  await reachCamp(r);
  let count = 0,
    origin;
  async function restore() {
    const before = await readBackup(r.host),
      view = await readSession(r.host);
    origin ??= before.payload.state.physical.cycle.seed;
    assert.deepEqual(before.payload.state.physical.cycle.seed, origin);
    await r.host.stop('SIGKILL');
    const dest = await startHost();
    t.after(() => dest.dispose());
    for (const file of [
      'scenario-pack',
      'physical-content',
      'physical-fronts',
      'physical-last-stand',
      'catalog',
    ])
      await assert.rejects(access(join(dest.dataDir, file + '.json')));
    const empty = await readSession(dest);
    await ok(
      dest.request('/api/restores', {
        backup: before,
        generation: empty.generation,
        expectedRevision: empty.revision,
        confirmed: true,
      }),
    );
    const after = await readBackup(dest),
      afterView = await readSession(dest);
    assert.deepEqual(
      { ...after.payload, state: administrative(after.payload.state, before.payload.state) },
      before.payload,
    );
    assert.deepEqual(administrative(afterView, view), view);
    await recoverSeat(dest, r.player);
    await recoverSeat(dest, r.other);
    await campEvidence('postcommit-' + count++, {
      before,
      view,
      after,
      afterView,
      origin,
      packless: true,
      sigkill: true,
    });
    r.host = dest;
  }
  await restore();
  let s = await readSession(r.host);
  const buy = buyInput(s);
  await ok(scenarioInput(r.host, r.player, buy));
  await restore();
  await ok(
    scenarioInput(r.host, r.player, { kind: 'camp-role', heroId: 'hero-1', roleId: 'role-3' }),
  );
  await restore();
  await ok(scenarioInput(r.host, r.player, { ...buy, operation: 'sell' }));
  await restore();
  await ok(scenarioInput(r.host, r.player, buy));
  await restore();
  s = await readSession(r.host);
  assert.equal(count, 5);
  assert.equal(training(s).balances[0].availableXP, 4);
  assert.ok(campaignHero(s).skillCopies.includes(buy.copy));
  assert.equal(campaignHero(s).roleId, 'role-3');
});

test('coherently re-signed changes to camp outputs, financial intent, owner, source and receipt reject422 with whole live state/view/origin unchanged', async (t) => {
  const r = await readyCamp(t);
  const s = await reachCamp(r);
  await ok(scenarioInput(r.host, r.player, buyInput(s)));
  const current = await readBackup(r.host),
    view = await readSession(r.host);
  const edits = [
    (s) => s.scenario.conclusion.campaign.training.balances[0].availableXP++,
    (s) => s.scenario.conclusion.xp[0].amount++,
    (s) => s.scenario.conclusion.campaign.heroes[0].skillCopies.pop(),
    (s) =>
      s.scenario.conclusion.campaign.heroes[0].skillCopies.push(
        s.scenario.conclusion.campaign.heroes[0].skillCopies.at(-1),
      ),
    (s) =>
      s.scenario.conclusion.campaign.heroes[1].skillCopies.push(
        s.scenario.conclusion.campaign.heroes[0].skillCopies.at(-1),
      ),
    (s) => s.scenario.conclusion.campaign.heroes[0].skillCopies.splice(0, 1),
    (s) => {
      s.scenario.conclusion.campaign.training.balances[0].availableXP++;
      s.scenario.conclusion.xp[0].amount++;
    },
    (s) => {
      s.scenario.conclusion.campaign.training.balances[0].roleId = 'role-3';
    },
    (s) => {
      s.physical.cycle.records.at(-1).intent.input.heroId = 'hero-2';
    },
    (s) => {
      s.physical.cycle.records.at(-1).intent.input.roleId = 'role-2';
    },
    (s) => {
      s.physical.cycle.records.at(-1).intent.input.copy = 'basic-1:1';
    },
    (s) => {
      s.physical.cycle.records.at(-1).intent.input.operation = 'sell';
    },
    (s) => {
      s.physical.cycle.records.at(-1).playerId = s.players[1].id;
    },
    (s) => {
      s.physical.cycle.records.at(-1).intent.pendingId = randomUUID();
    },
    (s) => {
      s.physical.cycle.records.at(-1).intent.sourceFingerprint = 'f'.repeat(64);
    },
    (s) => {
      s.physical.cycle.seed.scenario.pack.manifest.campSkills.catalogFingerprint = 'e'.repeat(64);
    },
    (s) => {
      s.physical.cycle.seed.scenario.conclusion = s.scenario.conclusion;
    },
    (s) => {
      s.scenario.conclusion.stage = 'campaign-story';
    },
  ];
  const bads = edits.map((edit) => {
    const b = structuredClone(current);
    edit(b.payload.state);
    return signBackup(b);
  });
  for (const key of ['cost', 'before', 'after']) {
    const b = structuredClone(current);
    b.payload.commands.find((c) => c.receipt.skill).receipt.skill[key]++;
    bads.push(signBackup(b));
  }
  for (const [n, backup] of bads.entries()) {
    const response = await r.host.request('/api/restores', {
      backup,
      generation: view.generation,
      expectedRevision: view.revision,
      confirmed: true,
    });
    assert.equal(response.status, 422, `negative ${n}: ${await response.text()}`);
    const after = await readBackup(r.host),
      afterView = await readSession(r.host);
    assert.deepEqual(after.payload, current.payload);
    assert.deepEqual(afterView, view);
    await campEvidence('negative-' + n, {
      backup,
      before: current,
      view,
      after,
      afterView,
      status: 422,
    });
  }
  assert.equal(bads.length, 21);
});
