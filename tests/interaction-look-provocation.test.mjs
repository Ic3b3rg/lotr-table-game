import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { readyCombat, drainCombat } from './combat-controller-helper.mjs';
import { sourceCatalog } from './original-encounter-helper.mjs';
import { attachActivationSource } from './fixtures/shadow-activations.mjs';
import { attachFailure } from './fixtures/adventure-failure.mjs';
import {
  transplantLinkedPair,
  linkedNode,
  linkedIntent,
  finishPhysical,
  ok,
} from './linked-http-helper.mjs';
import { linkedTitle, sealLinked } from './fixtures/linked-encounters.mjs';
import { lookInput, chooseBefore } from './interaction-look-helper.mjs';
import { compilePhysicalFronts } from '../dist/physical-resolution-library.mjs';
import { hash } from './fixtures/map-freeze.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';
import { command } from './preparation-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { scenarioInput } from './scenario-helper.mjs';
import { endTurns, finishCycle } from './original-round-helper.mjs';
import { drainFollowup, rally } from './second-shadow-helper.mjs';
import { startHost } from './host-helper.mjs';
import { runtime } from './interaction-look-runtime.mjs';
import { compileSourceDeployment } from '../dist/combat-library.mjs';

test('hero chooses ready group order, rejects early look uniformly and completes provocation-first plus material costs and source return', async (t) => {
  const r = await readyCombat(
    t,
    (src, pack, frozen) => {
      attachActivationSource(
        src,
        frozen.mapGeneration.projection.sections.flatMap((s) => s.tiles.map((t) => t.source)),
      );
      Object.assign(src.shadow.controller, pack.manifest.rounds.controller);
      for (const i of src.shadow.instructions) i.movement = 8;
      // Declared before startup: every invented attack deals one physical card,
      // with no resource-loss addition. No outcome is selected or retried.
      for (const asset of src.assets.filter((a) => a.cls === 'EnemyActivationModel')) {
        for (const row of asset.data.Damage) {
          row.Physical = 1;
          row.Fear = 0;
        }
        asset.data.KeyAttackAdditionalEffect = '';
        asset.dataHash = hash(asset.data);
      }
      for (const bonus of src.assets.filter((a) => a.cls === 'EnemyBonusModel')) {
        bonus.data.Physical = 0;
        bonus.data.Fear = 0;
        bonus.dataHash = hash(bonus.data);
        Object.assign(
          pack.manifest.followup.deployment.source.assets.find((a) => a.source === bonus.source),
          structuredClone(bonus),
        );
      }
      pack.manifest.followup.deployment = compileSourceDeployment(
        pack.manifest.followup.deployment.source,
      );
      src.deploymentFingerprint = pack.manifest.followup.deployment.fingerprint;
      const budget = pack.definitions
        .flatMap((d) => d.states)
        .flatMap((s) => s.actions)
        .find((a) => a.op === 'multiplyInt');
      budget.right.value = 20;
      const { index: _, op: __, origin: ___, ...fields } = budget;
      budget.origin.parameterHash = hash(fields);
      src.additions = [];
      attachFailure(pack);
      transplantLinkedPair(pack);
      // This invented linked graph is presented as a threat to exercise Dazed's exact token boundary.
      const threat = pack.manifest.prefabs.find(
        (p) => p.source === pack.manifest.linked.encounters[0].prefab,
      );
      threat.nodeType = 'threat';
      threat.sourceNodeType = 2;
      sealLinked(pack);
    },
    (c) => {
      sourceCatalog(c);
      for (const s of c.skills) {
        s.success = 0;
        s.fate = 1;
      }
      for (const h of c.heroes) {
        h.stats.damage = 20;
        h.stats.fear = 20;
        h.stats.inspiration = 6;
      }
    },
    (ir, catalog, raw, ready) => {
      linkedTitle(raw);
      for (const d of ir.definitions) {
        d.body = [{ op: 'keep-faceup' }];
        if (d.cardId.includes('damage'))
          d.persistent = [
            {
              op: 'mandatory-spend',
              window: 'before-interact',
              token: 'threat',
              resource: 'inspiration',
              n: 1,
            },
            { op: 'self-flip-down', window: 'end-own-turn' },
          ];
      }
      const look = lookInput(raw, catalog);
      ir.interactionLook = look.interactionLook;
      ir.policies.push(...look.policies);
      ir.policies
        .find((p) => p.id === catalog.heroes[0].id)
        .effects.push(
          ...Array.from({ length: 7 }, () => ({ op: 'before-interact-inspiration', amount: 1 })),
        );
      const skill = catalog.skills.find((s) => s.id === catalog.roles[0].skills[0]);
      ir.policies.push({
        id: skill.id,
        kind: 'skill',
        definitionHash: hash(skill),
        source: { sourceId: 'invented-resource', locator: 'Invented!startup' },
        effects: Array.from({ length: 6 }, () => ({ op: 'after-prepare-inspiration' })),
      });
      const artifact = compilePhysicalFronts(raw, ir, catalog);
      ready.pack.manifest.startupPreparation = {
        version: 'source-startup-preparation-v1',
        frontsFingerprint: artifact.fingerprint,
        catalogHash: hash(catalog),
        evidenceHash: hash('invented guaranteed resources'),
      };
      writeFileSync(ready.scenarioPath, JSON.stringify(ready.pack));
    },
  );
  const initial = await readSession(r.host);
  const destination = initial.scenario.spaceBindings.find(
    (b) => b.sourceId === linkedNode(initial).spaceId,
  ).id;
  for (const actor of [r.player, r.other]) {
    let s = await readSession(r.host),
      hero = s.preparation.heroes.find((h) => h.playerId === actor.body.player.id);
    if (!s.round.activeHeroId) await ok(cycleCommand(r, 'START_TURN', {}, actor));
    s = await readSession(r.host);
    const from = s.journey.heroes.find((h) => h.heroId === hero.heroId).spaceId;
    const queue = [[from]],
      seen = new Set([from]);
    let path;
    while (queue.length) {
      const p = queue.shift();
      if (p.at(-1) === destination) {
        path = p;
        break;
      }
      for (const [a, b] of s.journey.definition.connections) {
        const n = a === p.at(-1) ? b : b === p.at(-1) ? a : null;
        if (n && !seen.has(n)) {
          seen.add(n);
          queue.push([...p, n]);
        }
      }
    }
    assert.ok(path && path.length <= 3);
    for (const to of path.slice(1)) {
      s = await readSession(r.host);
      if (!s.journey.travel?.remaining) await ok(cycleCommand(r, 'START_TRAVEL', {}, actor));
      s = await readSession(r.host);
      await ok(
        cycleCommand(
          r,
          'MOVE_HERO',
          {
            fromSpaceId: s.journey.heroes.find((h) => h.heroId === hero.heroId).spaceId,
            destinationSpaceId: to,
          },
          actor,
        ),
      );
      await drainCombat(r);
      await finishCycle(r);
    }
    await ok(cycleCommand(r, 'END_TURN', {}, actor));
    await finishCycle(r);
  }
  await endTurns(r);
  await ok(cycleCommand(r, 'BEGIN_SHADOW'));
  await drainCombat(r);
  await drainFollowup(r);
  await ok(cycleCommand(r, 'CONFIRM_SHADOW_STEP', { step: 'threat' }));
  await drainFollowup(r);
  await rally(r);
  await ok(cycleCommand(r, 'START_TURN'));
  const before = await readBackup(r.host),
    at = await readSession(r.host);
  await ok(command(r.host, r.player, linkedIntent(at)));
  let s = await readSession(r.host);
  assert.ok(s.combat.pending.options.find((o) => o.id === 'early-look').unavailable);
  assert.equal(s.physical.active, null);
  assert.equal(
    (await readBackup(r.host)).payload.state.physical.snapshot.resolution.privateLooks?.length ?? 0,
    before.payload.state.physical.snapshot.resolution.privateLooks?.length ?? 0,
  );
  const suspended = await readBackup(r.host),
    q = s.combat.pending;
  const early = await command(r.host, r.player, {
    type: 'COMBAT_INPUT',
    combatId: q.combatId,
    pendingId: q.id,
    sourceFingerprint: q.sourceFingerprint,
    choice: 'early-look',
  });
  assert.equal(early.status, 409);
  assert.deepEqual((await readBackup(r.host)).payload, suspended.payload);
  // The source plan and exact pending survive an actual killed host before any group choice.
  await r.host.stop('SIGKILL');
  const restarted = await startHost({ LOTR_DATA_DIR: r.host.dataDir });
  t.after(() => restarted.stop());
  r.host = restarted;
  assert.deepEqual((await readBackup(restarted)).payload, suspended.payload);
  const pick = async (choice) => {
    const s = await readSession(r.host),
      q = s.combat.pending;
    await ok(
      command(r.host, r.player, {
        type: 'COMBAT_INPUT',
        combatId: q.combatId,
        pendingId: q.id,
        sourceFingerprint: q.sourceFingerprint,
        choice,
      }),
    );
  };
  await pick('provocation-first');
  s = await readSession(r.host);
  assert.ok(s.combat.pending.options.length >= 2);
  const cloned = (await readBackup(r.host)).payload.state;
  const excluded = cloned.scenario.enemies.groups.find(
    (g) => g.id === s.combat.pending.options[0].id,
  );
  excluded.exhausted = true;
  assert.equal(
    runtime.combatPending(cloned).options.some((o) => o.id === excluded.id),
    false,
  );
  const chosen = s.combat.pending.options.at(-1).id;
  await pick(chosen);
  // Drain each real enemy child, then explicitly choose every next ready group.
  for (let n = 0; n < 10; n++) {
    await drainCombat(r);
    s = await readSession(r.host);
    if (
      s.physical.active?.purpose === 'interaction-order' ||
      s.physical.active?.purpose === 'interaction-look'
    )
      break;
    assert.ok(
      s.combat.pending,
      JSON.stringify((await readBackup(r.host)).payload.state.combat.operations.at(-1)),
    );
    await pick(s.combat.pending.options.at(-1).id);
  }
  const afterGroups = (await readBackup(r.host)).payload.state;
  assert.equal(afterGroups.combat.operations.at(-1).provoked[0], chosen);
  assert.equal(afterGroups.combat.operations.at(-1).status, 'returned');
  assert.equal(afterGroups.physical.snapshot.active.purpose, 'interaction-order');
  assert.ok(
    afterGroups.physical.snapshot.resolution.interactionWindow.remaining.some(
      (e) => e.kind === 'spend',
    ),
  );
  // Spend all known obligations before the conditional look, preserving this chosen order.
  for (let n = 0; n < 20; n++) {
    const state = (await readBackup(r.host)).payload.state;
    if (state.physical.snapshot.active.purpose === 'interaction-look') break;
    const remaining = state.physical.snapshot.resolution.interactionWindow.remaining;
    await chooseBefore(
      r,
      remaining.some((e) => e.kind === 'spend') && state.preparation.heroes[0].inspiration > 0
        ? 'spend'
        : remaining.some((e) => e.kind === 'inspiration')
          ? 'inspiration'
          : 'look',
    );
  }
  await ok(scenarioInput(r.host, r.player, { kind: 'physical-choice', option: 'continue' }));
  await ok(scenarioInput(r.host, r.player, { kind: 'choice', event: 'LEAVE' }));
  if ((await readSession(r.host)).scenario.pending)
    await ok(scenarioInput(r.host, r.player, { kind: 'ack' }));
  const done = (await readBackup(r.host)).payload.state;
  assert.equal(done.scenario.play.attempts.at(-1).returned, true);
  assert.equal(done.round.heroes[0].actionsUsed, at.round.heroes[0].actionsUsed + 1);
  assert.deepEqual(done.journey.travel, at.journey.travel);
  assert.equal(done.physical.snapshot.resolution.privateLooks.length, 1);
});
