import { catalogFixture } from './fixtures/catalog.mjs';
import { sourceCatalog } from './original-encounter-helper.mjs';
import assert from 'node:assert/strict';
import { atSecondShadow, drainFollowup, rally } from './second-shadow-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { command } from './preparation-helper.mjs';
import { answerCycle } from './original-round-helper.mjs';
import { readSession } from './skill-test-helper.mjs';
import { closureFixture } from './fixtures/combat-closure.mjs';
import { compileCombatClosure, compileSourceDeployment } from '../dist/combat-library.mjs';
import { digest } from '../dist/map-freeze-library.mjs';
export function attachCombat(pack, frozen, edit = () => {}, catalogEdit = sourceCatalog) {
  const src = closureFixture();
  const deploy = pack.manifest.followup.deployment.source;
  for (const asset of src.assets.filter((a) => a.cls !== 'EnemyActivationModel')) {
    const index = deploy.assets.findIndex((a) => a.source === asset.source);
    deploy.assets[index] = structuredClone(asset);
  }
  pack.manifest.followup.deployment = compileSourceDeployment(deploy);
  src.deploymentFingerprint = pack.manifest.followup.deployment.fingerprint;
  src.projectionFingerprint = frozen.mapGeneration.projection.fingerprint;
  src.files = deploy.files;
  const catalog = catalogFixture();
  catalog.heroes.forEach((h) => (h.maxHands = 2));
  catalogEdit(catalog);
  src.items = frozen.mapGeneration.projection.context.heroes
    .flatMap((h) => h.items)
    .filter((i, n, list) => list.findIndex((x) => x.catalogId === i.catalogId) === n)
    .map((i) => ({
      id: i.catalogId,
      model: i.source,
      definitionHash: digest(catalog.items.find((c) => c.id === i.catalogId)),
      originalHash: digest(['invented', i.catalogId]),
      file: 'fixture.assets',
      locator: 'Invented!K1',
      ranged: catalog.items.find((c) => c.id === i.catalogId).ranged,
      stat: catalog.items.find((c) => c.id === i.catalogId).slot === 'hand' ? 'might' : null,
      body: '1 Success: 1 hit\n2 Successes: 2 hits',
    }));
  const owned = [
    ...new Set(
      frozen.preparation.heroes.flatMap((h) =>
        h.composition.map((copy) => copy.slice(0, copy.lastIndexOf(':'))),
      ),
    ),
  ];
  src.definitions = owned.map((id) => ({
    id,
    definitionHash: digest(catalog.skills.find((s) => s.id === id)),
    originalHash: digest(['invented', id]),
    locator: 'Invented!K1',
    clauses: 0,
  }));
  src.heroes = frozen.preparation.heroes.map((h) => ({
    heroId: h.heroId,
    definitionHash: digest(catalog.heroes.find((c) => c.id === h.heroId)),
    originalHash: digest(['invented', h.heroId]),
    locator: 'Invented!M1',
    effect: 'rally-extra-card',
  }));
  edit(src, pack, frozen);
  pack.manifest.combat = compileCombatClosure(src);
}
export async function readyCombat(t, edit = () => {}, catalogEdit, frontEdit) {
  const ready = await atSecondShadow(
    t,
    (pack, frozen) => attachCombat(pack, frozen, edit, catalogEdit),
    catalogEdit,
    frontEdit,
  );
  let r = await cycleCommand(ready, 'BEGIN_SHADOW');
  assert.equal(r.status, 200, await r.text());
  await drainFollowup(ready);
  r = await cycleCommand(ready, 'CONFIRM_SHADOW_STEP', { step: 'threat' });
  assert.equal(r.status, 200, await r.text());
  await drainFollowup(ready);
  await rally(ready);
  r = await cycleCommand(ready, 'START_TURN');
  assert.equal(r.status, 200, await r.text());
  let s = await readSession(ready.host);
  if (!s.combat.attacks.length) {
    const hero = s.preparation.heroes[0],
      from = s.journey.heroes[0].spaceId;
    const targets = s.scenario.enemies.groups
      .filter((g) => g.figures.some((f) => f.health > 0))
      .map((g) => s.scenario.spaceBindings.find((b) => b.sourceId === g.spaceId).id);
    const queue = [[from]],
      seen = new Set([from]);
    let path;
    while (queue.length) {
      const p = queue.shift();
      if (targets.includes(p.at(-1))) {
        path = p;
        break;
      }
      for (const [a, b] of s.journey.definition.connections) {
        const next = a === p.at(-1) ? b : b === p.at(-1) ? a : null;
        if (next && !seen.has(next)) {
          seen.add(next);
          queue.push([...p, next]);
        }
      }
    }
    assert.ok(path && path.length <= 3);
    r = await cycleCommand(ready, 'START_TRAVEL');
    assert.equal(r.status, 200, await r.text());
    for (const destinationSpaceId of path.slice(1)) {
      s = await readSession(ready.host);
      r = await cycleCommand(ready, 'MOVE_HERO', {
        fromSpaceId: s.journey.heroes[0].spaceId,
        destinationSpaceId,
      });
      assert.equal(r.status, 200, await r.text());
    }
  }
  return ready;
}
export async function drainCombat(ready, choose = () => null, pause = () => false) {
  for (let n = 0; n < 200; n++) {
    const s = await readSession(ready.host);
    if (!s.combat?.current || pause(s)) return s;
    const q = s.physical.active;
    let r;
    if (q) {
      assert.equal(q.kind, 'decision');
      assert.ok(
        s.physical.cycle.pending,
        'A physical combat child must retain its ordinary continuation',
      );
      const input =
        q.mode === 'allocate'
          ? { kind: 'physical-allocate', ability: q.options[0]?.id ?? null, damage: 0, fear: 0 }
          : q.mode === 'scout'
            ? {
                kind: 'physical-scout',
                prepare: null,
                discard: null,
                top: q.options.map((o) => o.id),
                bottom: [],
              }
            : q.mode === 'select'
              ? { kind: 'physical-select', ids: q.options.slice(0, q.minimum).map((o) => o.id) }
              : {
                  kind: 'physical-choice',
                  option:
                    choose(q, s) ??
                    ['resolve', 'apply', 'close', 'keep', 'reveal'].find((id) =>
                      q.options.some((o) => o.id === id && !o.unavailable),
                    ) ??
                    q.options[0].id,
                };
      r = await answerCycle(ready, input, s);
    } else {
      const pending = s.combat.pending;
      assert.ok(pending);
      const actor = [ready.player, ready.other].find(
        (p) => p.body.player.id === pending.actorPlayerId,
      );
      r = await command(
        ready.host,
        actor,
        {
          type: 'COMBAT_INPUT',
          combatId: pending.combatId,
          pendingId: pending.id,
          sourceFingerprint: pending.sourceFingerprint,
          choice:
            choose(pending, s) ??
            pending.options.find((o) => o.id === 'close')?.id ??
            pending.options[0].id,
        },
        s,
      );
    }
    assert.equal(r.status, 200, (await r.text()) + ready.host.diagnostics());
  }
  assert.fail('combat did not return');
}
