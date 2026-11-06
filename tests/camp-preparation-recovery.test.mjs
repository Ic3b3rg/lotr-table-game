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
import { attachCampPreparation } from './fixtures/camp-preparation.mjs';
import { confirm, choice } from './camp-preparation-helper.mjs';
import { startHost } from './host-helper.mjs';
import { recoverSeat } from './last-stand-helper.mjs';
import { signBackup } from './skill-test-helper.mjs';
import { preparationEvidence } from './camp-preparation-evidence.mjs';

export function administrative(value, expected) {
  const copy = structuredClone(value);
  for (const key of ['generation', 'revision', 'updatedAt']) copy[key] = expected[key];
  return copy;
}

test('SIGKILL after next-choice commits preserves full payload, view, selections and origin on new empty packless hosts', async (t) => {
  const r = await readyGroupItemCamp(t, {
    edit(pack, _, catalog) {
      attachCampPreparation(pack, catalog);
    },
  });
  await reachGroupCamp(r);
  let count = 0,
    origin;
  async function restore() {
    const before = await readBackup(r.host),
      view = await readSession(r.host);
    origin ??= before.payload.state.physical.cycle.seed;
    assert.deepEqual(before.payload.state.physical.cycle.seed, origin);
    await r.host.stop('SIGKILL');
    await preparationEvidence(
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
    await preparationEvidence('postcommit-' + count++, {
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
  await ok(scenarioInput(r.host, r.player, { kind: 'camp-prepare' }));
  await restore();
  await ok(
    scenarioInput(r.host, r.player, {
      kind: 'camp-select-role',
      heroId: 'hero-1',
      roleId: 'role-3',
    }),
  );
  await restore();
  await ok(
    scenarioInput(r.host, r.player, {
      kind: 'camp-accessory',
      heroId: 'hero-1',
      copy: 'trinket:1',
    }),
  );
  await restore();
  await ok(scenarioInput(r.host, r.player, confirm(await readSession(r.host))));
  await restore();
  await ok(scenarioInput(r.host, r.other, { kind: 'camp-return' }));
  await restore();
  await ok(scenarioInput(r.host, r.other, { kind: 'camp-prepare' }));
  const final = await readSession(r.host);
  assert.equal(count, 5);
  assert.ok(choice(final).confirmedRevision);
  assert.equal(choice(final).accessory, 'trinket:1');
  assert.equal(final.scenario.conclusion.campaign.next.status, 'requires-content');
});

test('coherently re-signed recipes, confirmations, ownership, source, intents and full winner receipts reject422 with whole live state unchanged', async (t) => {
  const r = await readyGroupItemCamp(t, {
    edit(pack, _, catalog) {
      attachCampPreparation(pack, catalog);
    },
  });
  await reachGroupCamp(r);
  await ok(scenarioInput(r.host, r.player, { kind: 'camp-prepare' }));
  await ok(
    scenarioInput(r.host, r.player, {
      kind: 'camp-select-role',
      heroId: 'hero-1',
      roleId: 'role-3',
    }),
  );
  await ok(
    scenarioInput(r.host, r.player, {
      kind: 'camp-accessory',
      heroId: 'hero-1',
      copy: 'trinket:1',
    }),
  );
  await ok(scenarioInput(r.host, r.player, confirm(await readSession(r.host))));
  const current = await readBackup(r.host),
    view = await readSession(r.host);
  const record = (s) =>
    s.physical.cycle.records.findLast((r) => r.intent.input?.kind === 'camp-confirm');
  const edits = [
    (s) => {
      choice(s).recipe.cards.pop();
    },
    (s) => {
      choice(s).recipe.weakness.copy = 'weak-1:1';
    },
    (s) => {
      choice(s).recipe.futurePrepared = 'role-1-skill-1';
    },
    (s) => {
      choice(s).recipe.roleId = 'role-4';
    },
    (s) => {
      choice(s).recipe.itemCopies[0] = 'sword:4';
    },
    (s) => {
      choice(s).recipe.balances[0].availableXP++;
    },
    (s) => {
      choice(s).summaryHash = 'e'.repeat(64);
    },
    (s) => {
      choice(s).confirmedRevision--;
    },
    (s) => {
      choice(s, 'hero-2').accessory = 'trinket:1';
    },
    (s) => {
      choice(s).accessory = 'trinket:2';
    },
    (s) => {
      record(s).playerId = s.players[1].id;
    },
    (s) => {
      record(s).intent.input.heroId = 'hero-2';
    },
    (s) => {
      record(s).intent.input.summaryHash = 'e'.repeat(64);
    },
    (s) => {
      record(s).intent.sourceFingerprint = 'd'.repeat(64);
    },
    (s) => {
      record(s).intent.pendingId = randomUUID();
    },
    (s) => {
      s.scenario.conclusion.stage = 'camp';
    },
    (s) => {
      s.physical.cycle.seed.scenario.conclusion = s.scenario.conclusion;
    },
    (s) => {
      s.scenario.pack.manifest.campPreparation.cards[0].identity = 'requires-content';
    },
  ];
  const bads = edits.map((edit) => {
    const b = structuredClone(current);
    edit(b.payload.state);
    return b;
  });
  for (const edit of [
    (r) => {
      r.preparation.action = 'camp-return';
    },
    (r) => {
      r.kind = 'camp-return';
    },
    (r) => {
      r.type = 'START_SCENARIO';
    },
    (r) => {
      r.preparation.heroes[0].confirmedRevision--;
    },
    (r) => {
      r.preparation.heroes.pop();
    },
    (r) => {
      delete r.preparation;
    },
  ]) {
    const b = structuredClone(current),
      cmd = b.payload.commands.find((c) => c.requestId === record(b.payload.state).requestId);
    edit(cmd.receipt);
    bads.push(b);
  }
  {
    const b = structuredClone(current),
      s = b.payload.state,
      rec = record(s),
      stored = b.payload.commands.find((c) => c.requestId === rec.requestId);
    rec.intent.input.heroId = 'hero-2';
    stored.receipt.preparation.heroes[1].confirmedRevision = stored.receipt.appliedRevision;
    stored.fingerprint = createHash('sha256').update(JSON.stringify(rec.intent)).digest('hex');
    bads.push(b);
  }
  {
    const b = structuredClone(current),
      s = b.payload.state,
      rec = record(s),
      stored = b.payload.commands.find((c) => c.requestId === rec.requestId);
    choice(s).confirmedRevision--;
    stored.receipt.preparation.heroes[0].confirmedRevision = choice(s).confirmedRevision;
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
    await preparationEvidence('negative-' + n, {
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
