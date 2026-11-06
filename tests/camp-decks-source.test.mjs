import test from 'node:test';
import assert from 'node:assert/strict';
import { campDeckCapability } from '../dist/camp-decks-library.mjs';
import { source, refreshChoices, hash } from './fixtures/camp-decks.mjs';

test('camp decks rederive current recipes, retaining old purchases and removed titles', () => {
  const s = source();
  const before = structuredClone(s);
  const cap = campDeckCapability(s);
  assert.equal(cap.enabled, true);
  assert.equal(cap.runtimeReady, false);
  assert.equal(cap.adventureStartEnabled, false);
  assert.deepEqual(s, before);
  assert.ok(cap.pending.includes('benefit-quantities-57'));
});
test('older unchanged confirmations are valid, null and future confirmations rejected', () => {
  const s = source();
  s.choices[0].confirmedRevision = 1;
  assert.equal(campDeckCapability(s).enabled, true);
  for (const revision of [null, 10]) {
    s.choices[0].confirmedRevision = revision;
    assert.throws(() => campDeckCapability(s), /confirmation/i);
  }
});
test('re-signed recipes and stale hashes are not independent authority', () => {
  const s = source();
  s.choices[0].recipe.cards.pop();
  s.choices[0].summaryHash = hash(s.choices[0].recipe);
  assert.throws(() => campDeckCapability(s), /recipe|summary/i);
  const t = source();
  t.choices[0].summaryHash = 'ab'.repeat(32);
  assert.throws(() => campDeckCapability(t), /recipe|summary/i);
});
test('selected requires-content gates without promoting unselected capability identities', () => {
  const s = source();
  const role = s.catalog.roleIds[1];
  s.capability.cards.find((c) => c.kind === 'role' && c.ownerId === role).identity =
    'requires-content';
  refreshChoices(s);
  assert.equal(campDeckCapability(s).enabled, false);
  const t = source();
  t.capability.cards.find((c) => c.kind === 'role' && c.ownerId === t.catalog.roleIds[5]).identity =
    'requires-content';
  assert.equal(campDeckCapability(t).enabled, true);
});
test('inventory ownership and purchased identity must agree with owned skill copies', () => {
  for (const mutation of [
    (s) => (s.campaign.inventory[0].ownerId = s.originalRoster[1].heroId),
    (s) => s.campaign.heroes[0].skillCopies.push('invented-unknown:1'),
    (s) => s.campaign.inventory.push(structuredClone(s.campaign.inventory[0])),
    (s) => s.campaign.heroes[0].titleCopies.push(s.campaign.heroes[1].titleCopies[0]),
    (s) => s.campaign.heroes[0].skillCopies.push(s.campaign.heroes[1].skillCopies[0]),
  ]) {
    const s = source();
    mutation(s);
    refreshChoices(s);
    assert.throws(() => campDeckCapability(s));
  }
});
test('all weakness locations require exact pool, owner and episode lineage', () => {
  assert.equal(campDeckCapability(source(5)).enabled, true);
  for (const mutation of [
    (s) => s.oldWeaknesses.pop(),
    (s) => (s.oldWeaknesses[0].copy = s.oldWeaknesses[1].copy),
    (s) => (s.oldWeaknesses[0].playerId = 'invented-other'),
    (s) => (s.oldWeaknesses[0].episodeFingerprint = 'ab'.repeat(32)),
    (s) => (s.oldWeaknesses[19].heroId = s.originalRoster[0].heroId),
  ]) {
    const s = source();
    mutation(s);
    assert.throws(() => campDeckCapability(s));
  }
});
test('roles and group order must be unique and exact', () => {
  for (const mutation of [
    (s) => (s.campaign.heroes[0].roleId = s.campaign.heroes[1].roleId),
    (s) => s.drawOrder.pop(),
    (s) => (s.drawOrder[0] = s.drawOrder[1]),
    (s) => (s.originalRoster[0].initialRoleId = s.originalRoster[1].initialRoleId),
  ]) {
    const s = source();
    mutation(s);
    refreshChoices(s);
    assert.throws(() => campDeckCapability(s));
  }
});
test('missing capability binding and mismatched hash cannot be laundered by recipe', () => {
  const s = source();
  s.capability.cards[0].cardHash = 'ab'.repeat(32);
  assert.throws(() => campDeckCapability(s));
  const t = source();
  t.capability.cards.pop();
  assert.throws(() => campDeckCapability(t));
});
test('unsafe JSON rejected before getters, including inherited array indices', () => {
  let reads = 0;
  const s = source();
  Object.defineProperty(s.campaign, 'heroes', {
    get() {
      reads++;
      throw Error('read');
    },
  });
  assert.throws(() => campDeckCapability(s));
  assert.equal(reads, 0);
  const t = source();
  delete t.oldWeaknesses[0];
  Object.defineProperty(Array.prototype, '0', {
    configurable: true,
    get() {
      reads++;
      throw Error('inherited read');
    },
  });
  let rejected = false;
  try {
    campDeckCapability(t);
  } catch {
    rejected = true;
  } finally {
    delete Array.prototype[0];
  }
  assert.equal(rejected, true);
  assert.equal(reads, 0);
  for (const bad of [new Date(), { ...source(), extra: true }, Object.create({})])
    assert.throws(() => campDeckCapability(bad));
  const cycle = source();
  cycle.campaign.provenance.cycle = cycle;
  assert.throws(() => campDeckCapability(cycle));
});

test('nested proxies are rejected before any reflection or property trap executes', () => {
  let traps = 0;
  const s = source();
  s.campaign.provenance = new Proxy(
    {},
    {
      getPrototypeOf() {
        traps++;
        throw Error('proxy reflected');
      },
      ownKeys() {
        traps++;
        throw Error('proxy enumerated');
      },
      get() {
        traps++;
        throw Error('proxy read');
      },
    },
  );
  assert.throws(() => campDeckCapability(s));
  assert.equal(traps, 0);
});
