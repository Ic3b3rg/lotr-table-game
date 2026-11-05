import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  readyThreatTokens,
  reachThreatToken,
  commitThreatToken,
  threatTokenNode,
  ok,
} from './threat-tokens-http-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { readSession, readBackup, signBackup } from './skill-test-helper.mjs';
import { startHost } from './host-helper.mjs';
import { recoverSeat } from './last-stand-helper.mjs';
import { hash } from './fixtures/map-freeze.mjs';
const admin = (a, b) => {
  const c = structuredClone(a);
  for (const k of ['generation', 'revision', 'updatedAt']) c[k] = b[k];
  return c;
};
async function evidence(label, value) {
  const dir = process.env.LOTR_THREAT_TOKEN_EVIDENCE;
  if (!dir) return;
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, label + '.json'), JSON.stringify(value));
}
async function cut(t, r, label) {
  const backup = await readBackup(r.host),
    view = await readSession(r.host),
    origin = structuredClone(backup.payload.state.physical.cycle.seed);
  await r.host.stop('SIGKILL');
  const next = await startHost();
  t.after(() => next.dispose());
  for (const name of [
    'scenario-pack',
    'physical-content',
    'physical-fronts',
    'physical-last-stand',
    'physical-boons',
  ])
    await assert.rejects(access(join(next.dataDir, name + '.json')));
  const empty = await readSession(next);
  assert.equal(empty.scenario, null);
  await ok(
    next.request('/api/restores', {
      backup,
      generation: empty.generation,
      expectedRevision: empty.revision,
      confirmed: true,
    }),
  );
  const after = (await readBackup(next)).payload,
    afterView = await readSession(next);
  assert.deepEqual({ ...after, state: admin(after.state, backup.payload.state) }, backup.payload);
  assert.deepEqual(admin(afterView, view), view);
  assert.deepEqual(after.state.physical.cycle.seed, origin);
  await recoverSeat(next, r.player);
  await recoverSeat(next, r.other);
  r.host = next;
  await evidence(label, {
    backup,
    view,
    restored: after,
    restoredView: afterView,
    packless: true,
    sigkill: true,
  });
  return backup;
}

test('accepted SIGKILLs and empty packless restores preserve failure, paid retry, actual fate selection, benefit, floor and cleanup', async (t) => {
  const r = await readyThreatTokens(t);
  await reachThreatToken(r);
  const origin = (await readBackup(r.host)).payload.state.physical.cycle.seed;
  await cut(t, r, 'retry-before-cost');
  await ok(commitThreatToken(r));
  await cut(t, r, 'retry-first-paid');
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'reveal' }));
  await cut(t, r, 'retry-first-revealed');
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'resolve' }));
  await cut(t, r, 'retry-first-failed');
  await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
  await cut(t, r, 'retry-visible-wait');
  await ok(commitThreatToken(r));
  await cut(t, r, 'retry-second-paid');
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'reveal' }));
  await cut(t, r, 'retry-second-revealed');
  for (let n = 0; n < 2; n++) {
    await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'inspiration' }));
    let q = (await readSession(r.host)).physical.active;
    if (q.mode === 'select') {
      await cut(t, r, 'retry-fate-selection-' + n);
      await ok(
        scenarioInput(r.host, r.player, { kind: 'physical-select', ids: [q.options[0].id] }),
      );
    }
    await cut(t, r, 'retry-fate-paid-' + n);
  }
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'resolve' }));
  const reward = await cut(t, r, 'retry-benefit-floor-message');
  assert.equal(reward.payload.state.physical.snapshot.resolution.resources.boonCustody.length, 1);
  await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
  const final = await cut(t, r, 'retry-cleanup-return');
  assert.equal(threatTokenNode(final.payload.state).stopped, true);
  assert.equal(final.payload.state.round.heroes[0].actionsUsed, 2);
  assert.deepEqual(final.payload.state.physical.cycle.seed, origin);
});

function resignPack(backup, edit) {
  const state = backup.payload.state,
    scenarios = [state.scenario, state.physical.cycle.seed.scenario];
  let oldFingerprint, newFingerprint;
  for (const sc of scenarios) {
    oldFingerprint = sc.packFingerprint;
    edit(sc.pack);
    const cap = sc.pack.manifest.threatTokens;
    if (cap)
      for (const owner of cap.encounters) {
        const p = sc.pack.manifest.prefabs.find((p) => p.source === owner.prefab),
          d = sc.pack.definitions.find((d) => d.source === p.fsmSource);
        owner.definitionHash = hash(d);
      }
    newFingerprint = hash(sc.pack);
    sc.packFingerprint = newFingerprint;
  }
  const replace = (v) => {
    if (v === oldFingerprint) return newFingerprint;
    if (Array.isArray(v)) return v.map(replace);
    if (v && typeof v === 'object')
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, replace(x)]));
    return v;
  };
  backup.payload = replace(backup.payload);
  signBackup(backup);
}

test('fear/P2 boundaries restore packless and individually resigned null, floor, origin and receipt forgeries reject422 without mutating whole state or view', async (t) => {
  const r = await readyThreatTokens(t, {
    catalogEdit: (c) => {
      for (const h of c.heroes) h.stats.fear = 1;
    },
  });
  await reachThreatToken(r, 'null-product');
  await ok(commitThreatToken(r, 'null-product'));
  await cut(t, r, 'spirit-paid');
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'reveal' }));
  await cut(t, r, 'spirit-cards');
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'resolve' }));
  await cut(t, r, 'fear-p2-open');
  for (let n = 0; (await readSession(r.host)).scenario.pending && n < 40; n++) {
    const q = (await readSession(r.host)).physical.active;
    assert.equal(q.kind, 'decision');
    const option =
      ['force-fail', 'resolve', 'close', 'reveal'].find((id) =>
        q.options.some((o) => o.id === id),
      ) ?? q.options[0].id;
    await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option }));
  }
  const final = await cut(t, r, 'fear-defeat-cleanup'),
    payload = (await readBackup(r.host)).payload,
    view = await readSession(r.host);
  assert.equal(payload.state.physical.snapshot.lastStand.heroes[0].defeated, true);
  assert.equal(payload.state.scenario.play.tests[0].successes, 0);
  assert.equal(payload.state.scenario.play.attempts[0].returned, true);
  const packOwner = (pack, n) =>
    pack.definitions.find(
      (d) =>
        d.source ===
        pack.manifest.prefabs.find(
          (p) => p.source === pack.manifest.threatTokens.encounters[n].prefab,
        ).fsmSource,
    );
  const edits = [
    (b) =>
      resignPack(b, (p) => {
        packOwner(p, 1).states.find((s) => s.index === 88).actions[0].products = [
          'example.assets:999',
        ];
      }),
    (b) =>
      resignPack(b, (p) => {
        packOwner(p, 1).states.find((s) => s.index === 88).actions[0].products = [];
      }),
    (b) =>
      resignPack(b, (p) => {
        const a = packOwner(p, 1).states.find((s) => s.index === 88).actions[0];
        [a.ownEvent, a.missingEvent] = [a.missingEvent, a.ownEvent];
      }),
    (b) =>
      resignPack(b, (p) => {
        packOwner(p, 1).states.find((s) => s.index === 88).transitions.OWNED = 87;
      }),
    (b) =>
      resignPack(b, (p) => {
        packOwner(p, 0).states.find((s) => s.index === 85).actions[1].value.value = -3;
      }),
    (b) =>
      resignPack(b, (p) => {
        p.manifest.threatTokens.threat.action = 0;
      }),
    (b) =>
      resignPack(b, (p) => {
        p.manifest.threatTokens.encounters[1].excludedStates.pop();
      }),
    (b) =>
      resignPack(b, (p) => {
        p.manifest.threatTokens.ownedProductIds.push(5);
      }),
    (b) => {
      b.payload.state.scenario.play.attempts[0].cost = 0;
    },
    (b) => {
      b.payload.state.scenario.play.tests[0].successes = 2;
    },
    (b) => {
      b.payload.state.scenario.play.attempts[0].playerId = r.other.body.player.id;
    },
    (b) => {
      threatTokenNode(b.payload.state, 'null-product').visible = true;
    },
    (b) => {
      b.payload.state.physical.runs.at(-1).source.parameterHash = 'f'.repeat(64);
    },
    (b) => {
      b.payload.state.physical.cycle.seed.round.number = 9;
    },
    (b) => {
      b.payload.commands.at(-1).receipt.source = 'e'.repeat(64);
    },
    (b) => {
      b.payload.state.schemaVersion = 25;
    },
    (b) =>
      resignPack(b, (p) => {
        delete p.manifest.threatTokens;
      }),
  ];
  for (const [index, edit] of edits.entries()) {
    const bad = structuredClone(final);
    edit(bad);
    signBackup(bad);
    const response = await r.host.request('/api/restores', {
      backup: bad,
      generation: view.generation,
      expectedRevision: view.revision,
      confirmed: true,
    });
    assert.equal(response.status, 422, `negative ${index}: ${await response.text()}`);
    assert.deepEqual((await readBackup(r.host)).payload, payload);
    assert.deepEqual(await readSession(r.host), view);
    await evidence('negative-' + index, {
      backup: bad,
      status: 422,
      wholePayloadUnchanged: true,
      wholeViewUnchanged: true,
    });
  }
});
