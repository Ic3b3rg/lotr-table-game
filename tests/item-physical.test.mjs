import test from 'node:test';
import assert from 'node:assert/strict';
import { lastStandFixture } from './fixtures/last-stand.mjs';
import { hash, binding, evidence } from './fixtures/physical-fronts.mjs';
import { attachItem, itemPolicy } from './fixtures/item-encounter.mjs';
import { itemCompilation } from './fixtures/item-encounter.mjs';
import {
  compilePhysicalFronts,
  compileLastStand,
  freezePhysical,
  openPhysical,
  answerPhysical,
  validatePhysical,
} from '../dist/physical-resolution-library.mjs';
test('gained trinket uses its own printed depletion to change fear face without preventing any fear', () => {
  const f = lastStandFixture(),
    pack = itemCompilation().pack;
  attachItem(pack, f.catalog);
  const grant = pack.manifest.items.grant;
  for (const hero of f.catalog.heroes) hero.stats.fear = 20;
  f.ir.policies.push(itemPolicy(f.catalog));
  for (const d of f.ir.definitions) d.body = [{ op: 'keep-faceup' }];
  const p = freezePhysical(
    f.raw,
    binding,
    f.heroes,
    '1'.repeat(64),
    undefined,
    { artifact: compilePhysicalFronts(f.raw, f.ir, f.catalog), catalog: f.catalog },
    compileLastStand(f.raw, f.lastStandInput),
  );
  p.version = 3;
  const source = (n) => ({
    effectId: 'invented-item-effect-' + n,
    instanceId: 'invented-item',
    state: 0,
    entry: n + 1,
    action: 0,
    parameterHash: hash(n),
  });
  const open = (n, children) =>
    openPhysical(p, source(n), f.program(children), p.snapshot.resolution.resources ?? f.context, {
      heroes: f.heroes,
      connections: [],
    });
  const answer = (option) =>
    answerPhysical(
      p,
      p.snapshot.active.runId,
      { kind: 'physical-choice', option },
      evidence(
        p.runs.reduce((n, r) => n + r.answers.length, 0),
        p.snapshot.active.actorPlayerId,
      ),
    );
  open(0, [{ kind: 'scenario-item', hero: 0, grant, message: 'Oggetto interamente inventato.' }]);
  answer(f.heroes[0].heroId);
  assert.equal(p.snapshot.resolution.resources.itemCustody.length, 1);
  open(1, [{ kind: 'scenario-item', hero: 1, grant, message: 'Nessun doppione.' }]);
  assert.equal(p.snapshot.active, null);
  assert.equal(p.snapshot.resolution.resources.itemCustody[0].heroId, f.heroes[0].heroId);
  open(2, [
    {
      kind: 'suffer',
      hero: 0,
      face: 'faceup',
      cards: [{ family: 'fear', amount: 2 }],
      prevention: [],
    },
  ]);
  const a = p.snapshot.active,
    offer = a.options.find((o) => o.id !== 'close');
  assert.ok(offer);
  answer(offer.id);
  while (p.snapshot.active) answer('close');
  assert.equal(p.snapshot.areas[0].fear.length, 2);
  assert.equal(p.snapshot.resolution.faceup.length, 0);
  assert.equal(p.snapshot.resolution.resources.depletion[0].remaining, 1);
  assert.equal(p.snapshot.parents.at(-1).results[0].prevented.fear, 0);
  assert.equal(p.snapshot.parents.at(-1).results[0].transferred.fear, 2);
  validatePhysical(p);
  open(3, [
    {
      kind: 'suffer',
      hero: 1,
      face: 'faceup',
      cards: [{ family: 'fear', amount: 1 }],
      prevention: [],
    },
  ]);
  assert.equal(p.snapshot.active, null, 'another hero cannot consume the equipped copy');
  assert.equal(p.snapshot.resolution.resources.depletion[0].remaining, 1);
  open(4, [
    {
      kind: 'suffer',
      hero: 0,
      face: 'faceup',
      cards: [{ family: 'fear', amount: 1 }],
      prevention: [],
    },
  ]);
  const second = p.snapshot.active.options.find((o) => o.id !== 'close');
  assert.ok(second);
  answer(second.id);
  assert.equal(p.snapshot.resolution.resources.depletion[0].remaining, 0);
  open(5, [
    {
      kind: 'suffer',
      hero: 0,
      face: 'faceup',
      cards: [{ family: 'fear', amount: 1 }],
      prevention: [],
    },
  ]);
  assert.equal(p.snapshot.active, null, 'zero depletion cannot activate again');
  assert.equal(p.snapshot.areas[0].fear.length, 4);
  assert.equal(
    p.snapshot.resolution.faceup.filter((c) => p.snapshot.areas[0].fear.includes(c)).length,
    1,
  );
  assert.ok(p.snapshot.parents.every((parent) => parent.returnCount === 1));
  validatePhysical(p);
});
