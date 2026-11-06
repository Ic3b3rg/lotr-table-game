import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import {
  readyGroupItemCamp,
  reachGroupCamp,
  scenarioInput,
  readSession,
  readBackup,
  ok,
} from './camp-items-group-helper.mjs';
import { itemInput } from './camp-items-helper.mjs';
import { startHost } from './host-helper.mjs';
import { recoverSeat } from './last-stand-helper.mjs';
import { signBackup } from './skill-test-helper.mjs';
import { itemEvidence } from './camp-items-evidence.mjs';

export function administrative(value, expected) {
  const copy = structuredClone(value);
  for (const key of ['generation', 'revision', 'updatedAt']) copy[key] = expected[key];
  return copy;
}

test('SIGKILL after camp entry and personal/common upgrades restores full payload, view, inventory, lore, XP and origin on new empty packless hosts', async (t) => {
  const r = await readyGroupItemCamp(t);
  await reachGroupCamp(r);
  let count = 0,
    origin;
  async function restore() {
    const before = await readBackup(r.host),
      view = await readSession(r.host);
    origin ??= before.payload.state.physical.cycle.seed;
    assert.deepEqual(before.payload.state.physical.cycle.seed, origin);
    await r.host.stop('SIGKILL');
    await itemEvidence(
      'postcommit-' + count + '-cut',
      { before, view, sigkill: true },
      r.host.dataDir,
    );
    const dest = await startHost();
    t.after(() => dest.dispose());
    for (const file of [
      'scenario.json',
      'physical-content.json',
      'physical-fronts.json',
      'physical-last-stand.json',
      'catalog.json',
      'map-generator.json',
    ])
      await assert.rejects(access(join(dest.dataDir, file)));
    const empty = await readSession(dest);
    assert.equal(empty.players.length, 0);
    assert.equal(empty.scenario, null);
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
    await itemEvidence('postcommit-' + count++, {
      before,
      view,
      after,
      afterView,
      origin,
      sigkill: true,
      packless: true,
    });
    r.host = dest;
  }
  await restore();
  for (const input of [
    itemInput(),
    itemInput({ copy: 'advanced:1', upgrade: 'invented-final:1' }),
    itemInput({ heroId: null, copy: 'trinket:1', upgrade: 'invented-trinket-2:1' }),
    itemInput({ heroId: 'hero-2', copy: 'sword:2', upgrade: 'invented-alternative:1' }),
  ]) {
    const actor = input.heroId === 'hero-2' ? r.other : r.player;
    await ok(scenarioInput(r.host, actor, input));
    await restore();
  }
  const s = await readSession(r.host);
  assert.equal(count, 5);
  assert.equal(s.scenario.play.lore, 30);
  assert.ok(s.scenario.conclusion.xp.every((x) => x.amount === 6));
  assert.equal(s.scenario.conclusion.campaign.inventory[0].copy, 'invented-trinket-2:1');
});

test('coherently re-signed item inventories, lore, XP, ownership, source, intent and full winner summaries reject422 without changing any live payload or view', async (t) => {
  const r = await readyGroupItemCamp(t);
  await reachGroupCamp(r);
  await ok(scenarioInput(r.host, r.player, itemInput()));
  await ok(
    scenarioInput(
      r.host,
      r.other,
      itemInput({ heroId: null, copy: 'trinket:1', upgrade: 'invented-trinket-2:1' }),
    ),
  );
  const current = await readBackup(r.host),
    view = await readSession(r.host);
  const personal = (s) =>
    s.physical.cycle.records.findLast(
      (r) => r.intent.input?.kind === 'camp-item' && r.intent.input.heroId === 'hero-1',
    );
  const edits = [
    (s) => {
      s.scenario.conclusion.campaign.heroes[0].itemCopies[0] = 'sword:1';
    },
    (s) => {
      s.scenario.conclusion.campaign.heroes[1].itemCopies[0] = 'advanced:1';
    },
    (s) => {
      s.scenario.conclusion.campaign.inventory[0].copy = 'trinket:1';
      s.scenario.conclusion.campaign.inventory[0].cardId = 'trinket';
      s.scenario.conclusion.campaign.inventory[0].modelId = 9003;
    },
    (s) => {
      s.scenario.conclusion.campaign.inventory[0].modelId++;
    },
    (s) => {
      s.scenario.play.lore--;
    },
    (s) => {
      s.scenario.conclusion.xp[0].amount++;
    },
    (s) => {
      s.scenario.conclusion.campaign.training.balances[0].availableXP++;
    },
    (s) => {
      personal(s).intent.input.heroId = 'hero-2';
    },
    (s) => {
      personal(s).intent.input.copy = 'sword:2';
    },
    (s) => {
      personal(s).intent.input.upgrade = 'invented-final:1';
    },
    (s) => {
      personal(s).playerId = s.players[1].id;
    },
    (s) => {
      personal(s).intent.sourceFingerprint = 'e'.repeat(64);
    },
    (s) => {
      personal(s).intent.pendingId = randomUUID();
    },
    (s) => {
      s.physical.cycle.seed.scenario.pack.manifest.campItems.catalogFingerprint = 'd'.repeat(64);
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
    return b;
  });
  for (const key of [
    'heroId',
    'copy',
    'upgrade',
    'fromModelId',
    'toModelId',
    'fromRank',
    'toRank',
    'threshold',
    'lore',
  ]) {
    const b = structuredClone(current),
      receipt = b.payload.commands.find((c) => c.receipt.item?.heroId === 'hero-1').receipt.item;
    receipt[key] =
      typeof receipt[key] === 'number'
        ? receipt[key] + 1
        : key === 'heroId'
          ? 'hero-2'
          : key === 'copy'
            ? 'sword:2'
            : 'invented-alternative:1';
    bads.push(b);
  }
  // Even matching command fingerprints and receipt intent fields cannot replace source replay.
  {
    const b = structuredClone(current),
      record = personal(b.payload.state),
      stored = b.payload.commands.find((c) => c.requestId === record.requestId);
    record.intent.input.upgrade = 'invented-alternative:1';
    stored.receipt.item.upgrade = 'invented-alternative:1';
    stored.receipt.item.toModelId = 507;
    stored.fingerprint = createHash('sha256').update(JSON.stringify(record.intent)).digest('hex');
    bads.push(b);
  }
  for (const [n, b] of bads.entries()) {
    signBackup(b);
    const response = await r.host.request('/api/restores', {
      backup: b,
      generation: view.generation,
      expectedRevision: view.revision,
      confirmed: true,
    });
    assert.equal(response.status, 422, `negative ${n}: ${await response.text()}`);
    const after = await readBackup(r.host),
      afterView = await readSession(r.host);
    assert.deepEqual(after.payload, current.payload);
    assert.deepEqual(afterView, view);
    await itemEvidence('negative-' + n, {
      backup: b,
      before: current,
      view,
      after,
      afterView,
      status: 422,
    });
  }
  assert.equal(bads.length, 26);
});
