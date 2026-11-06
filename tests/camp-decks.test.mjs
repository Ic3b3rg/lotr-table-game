import test from 'node:test';
import assert from 'node:assert/strict';
import {
  materializeCampDecks,
  verifyCampDeckArtifact,
  campDeckCapability,
} from '../dist/camp-decks-library.mjs';
import { indexForWord } from '../src/camp-decks/random.ts';
import { source, grownSource, refreshChoices, hash, seed } from './fixtures/camp-decks.mjs';
const realize = (s = source(), entropy = { seed }) => materializeCampDecks(s, entropy);
const resign = (a) => {
  const { artifactFingerprint: _, ...body } = a;
  a.artifactFingerprint = hash(body);
  return a;
};
const pins = (a) =>
  Object.fromEntries(
    ['sourceFingerprint', 'realizationFingerprint', 'artifactFingerprint'].map((k) => [k, a[k]]),
  );

test('materialized artifact remains private, non-active and before every startup prerequisite', () => {
  const s = source();
  const a = realize(s);
  assert.equal(a.format, 'camp-decks-artifact-v1');
  assert.equal(a.materialized.runtimeReady, false);
  assert.equal(a.materialized.adventureStartEnabled, false);
  assert.equal(a.materialized.phase, 'before-activation-and-preparation-triggers');
  assert.equal(a.source.episode.outcome, 'loss');
  assert.deepEqual(a.materialized.lineage.campaign, s.campaign);
  assert.deepEqual(a.source, s);
  assert.ok(a.materialized.pending.includes('post-loss-weakness-after-Scout3-in-future-consumer'));
});
test('new role1 is prepared, never shuffled; purchases, removed titles and only new role free cards survive', () => {
  const s = source();
  const a = realize(s);
  for (const [i, h] of a.materialized.heroes.entries()) {
    const recipe = s.choices.find((r) => r.heroId === h.heroId).recipe;
    const role = s.catalog.cards.find((c) => c.id === recipe.futurePrepared);
    assert.deepEqual(h.prepared, [role.copies[0]]);
    assert.equal(h.deck.includes(h.prepared[0]), false);
    assert.equal(h.deck.length, recipe.cards.length);
    for (const kind of ['discard', 'revealed', 'setAside']) assert.deepEqual(h[kind], []);
    const current = s.campaign.heroes.find((r) => r.heroId === h.heroId);
    for (const copy of current.titleCopies) assert.ok(h.deck.includes(copy));
    for (const c of s.catalog.cards.filter(
      (c) => c.kind === 'purchased' && current.skillCopies.includes(c.copies[0]),
    ))
      assert.ok(h.deck.includes(c.copies[0]));
    for (const c of s.catalog.cards.filter(
      (c) => c.kind === 'role' && c.ownerId === s.originalRoster[i].initialRoleId,
    ))
      assert.equal([...h.deck, ...h.prepared].includes(c.copies[0]), false);
  }
});
test('complete weakness pool has pinned top-first order and group-permutation assignments', () => {
  const s = source(5);
  const a = realize(s);
  const p = a.materialized.weaknessPool;
  assert.deepEqual(
    p.shuffled.map((copy) => Number(copy.split(':')[0].split('-').at(-1))),
    [15, 14, 19, 17, 5, 20, 12, 6, 1, 4, 11, 7, 18, 9, 3, 2, 13, 10, 8, 16],
  );
  assert.deepEqual(
    p.assignments,
    s.drawOrder.map((heroId, i) => ({ heroId, copy: p.shuffled[i] })),
  );
  assert.deepEqual(p.reserve, p.shuffled.slice(5));
  assert.equal(new Set([...p.reserve, ...p.assignments.map((r) => r.copy)]).size, 20);
  assert.equal(
    a.materialized.heroes.reduce(
      (n, h) => n + h.deck.filter((c) => c.includes('weakness')).length,
      0,
    ),
    5,
  );
});
test('basic copies follow stable roster even when campaign arrays and group order change', () => {
  const s = source();
  const a = realize(s);
  s.drawOrder.reverse();
  s.campaign.heroes.reverse();
  s.choices.reverse();
  const b = realize(s);
  for (const [i, h] of b.materialized.heroes.entries()) {
    const all = [...h.deck, ...h.prepared];
    for (const c of s.catalog.cards.filter((c) => c.kind === 'basic')) {
      assert.ok(all.includes(c.copies[i]));
      assert.ok(
        [...a.materialized.heroes[i].deck, ...a.materialized.heroes[i].prepared].includes(
          c.copies[i],
        ),
      );
    }
  }
});
test('legal grown decks over thirty and over fifty-six preserve every owned card', () => {
  const s = grownSource();
  const a = realize(s);
  const h = a.materialized.heroes[0];
  assert.ok(h.deck.length > 56);
  assert.equal(h.deck.length, s.choices[0].recipe.cards.length);
  assert.equal(new Set([...h.deck, ...h.prepared]).size, h.deck.length + 1);
  assert.deepEqual(verifyCampDeckArtifact(JSON.parse(JSON.stringify(a))), a);
});
test('same seed reproduces all bytes and streams are distinct and independent', () => {
  const s = source();
  const a = realize(s);
  assert.deepEqual(realize(s), a);
  const b = realize(s, { seed: '34'.repeat(32) });
  assert.equal(b.sourceFingerprint, a.sourceFingerprint);
  assert.notEqual(b.realizationFingerprint, a.realizationFingerprint);
  assert.notEqual(b.artifactFingerprint, a.artifactFingerprint);
  assert.notDeepEqual(b.materialized.heroes[0].deck, a.materialized.heroes[0].deck);
  const streams = a.materialized.streams;
  assert.equal(new Set(streams.map((s) => s.stream)).size, streams.length);
  assert.equal(streams[0].stream, 'weakness-pool');
  assert.notEqual(streams[0].words[0].word, streams[1].words[0].word);
  const larger = grownSource();
  assert.deepEqual(realize(larger).materialized.streams[2], a.materialized.streams[2]);
});
test('trusted source, realization and artifact pins reject changed seed and coherent invented authority', () => {
  const a = realize();
  const expected = pins(a);
  assert.deepEqual(verifyCampDeckArtifact(a, expected), a);
  const b = realize(source(), { seed: '34'.repeat(32) });
  for (const k of ['realizationFingerprint', 'artifactFingerprint'])
    assert.throws(() => verifyCampDeckArtifact(b, { [k]: expected[k] }), /pin/i);
  const s = source();
  s.campaign.provenance.history.push('invented-changed');
  const c = realize(s);
  assert.doesNotThrow(() => verifyCampDeckArtifact(c));
  assert.throws(
    () => verifyCampDeckArtifact(c, { sourceFingerprint: expected.sourceFingerprint }),
    /pin/i,
  );
});
test('re-signed order, multiset, resources, lineage, placement and trace tampering all fail replay', () => {
  const a = realize();
  for (const change of [
    (x) => x.materialized.heroes[0].deck.reverse(),
    (x) => (x.materialized.heroes[0].deck[0] = x.materialized.heroes[0].deck[1]),
    (x) => x.materialized.heroes[0].prepared.push(x.materialized.heroes[0].deck.pop()),
    (x) => x.materialized.weaknessPool.reserve.reverse(),
    (x) => x.materialized.streams[0].words[0].word++,
    (x) => x.materialized.streams[1].cursor++,
    (x) => x.materialized.lineage.campaign.heroes[0].provenance.inspiration++,
    (x) => (x.materialized.lineage.episode.outcome = 'win'),
    (x) => (x.materialized.runtimeReady = true),
    (x) => (x.extra = 'invented'),
  ]) {
    const t = structuredClone(a);
    change(t);
    resign(t);
    assert.throws(() => verifyCampDeckArtifact(t));
  }
});
test('gated source is diagnosed before any entropy read or draw', () => {
  const s = source();
  s.capability.cards.find(
    (c) => c.kind === 'role' && c.ownerId === s.campaign.heroes[0].roleId,
  ).identity = 'requires-content';
  refreshChoices(s);
  let reads = 0;
  const entropy = {
    get seed() {
      reads++;
      throw Error('entropy accessed');
    },
  };
  const gate = realize(s, entropy);
  assert.equal(gate.format, 'camp-decks-gate-v1');
  assert.equal(gate.entropyDraws, 0);
  assert.equal(gate.capability.enabled, false);
  assert.equal(reads, 0);
  assert.throws(() => verifyCampDeckArtifact(gate));
});
test('input and complete expanded artifact use identical budgets, and every returned artifact roundtrips', () => {
  const s = source();
  s.campaign.provenance.history = Array(60000).fill('invented');
  assert.equal(campDeckCapability(s).enabled, true);
  assert.throws(() => realize(s), /nodi|budget|limite/i);
  const a = realize();
  assert.deepEqual(verifyCampDeckArtifact(JSON.parse(JSON.stringify(a))), a);
  const bad = structuredClone(a);
  bad.materialized.lineage.campaign.provenance.history = Array(100001).fill('invented');
  assert.throws(() => verifyCampDeckArtifact(bad), /nodi|budget|limite/i);
});
test('defensive copies keep archived inputs, resources, output and verification results independent', () => {
  const s = source();
  const before = structuredClone(s);
  const a = realize(s);
  assert.deepEqual(s, before);
  const verified = verifyCampDeckArtifact(a);
  verified.source.campaign.heroes[0].provenance.inspiration++;
  assert.equal(a.source.campaign.heroes[0].provenance.inspiration, 2);
  a.source.campaign.heroes[0].provenance.inspiration++;
  assert.deepEqual(s, before);
});
test('untrusted entropy and pins are strict JSON and required provenance cannot be omitted', () => {
  const s = source();
  delete s.campaign.provenance;
  assert.throws(() => campDeckCapability(s));
  for (const entropy of [{ seed: 'bad' }, { seed, extra: true }, new Date()])
    assert.throws(() => realize(source(), entropy));
  const a = realize();
  let reads = 0;
  const p = {
    get sourceFingerprint() {
      reads++;
      return a.sourceFingerprint;
    },
  };
  assert.throws(() => verifyCampDeckArtifact(a, p));
  assert.equal(reads, 0);
  assert.throws(() => verifyCampDeckArtifact(a, { unknown: 'abc' }));
});
test('rejection sampler handles full uint32 boundary without modulo bias or size56 cap', () => {
  assert.equal(indexForWord(0, 201), 0);
  assert.equal(indexForWord(4294967295, 2), 1);
  const size = 57,
    limit = Math.floor(2 ** 32 / size) * size;
  assert.equal(indexForWord(limit - 1, size), 56);
  assert.equal(indexForWord(limit, size), null);
  assert.equal(indexForWord(4294967295, size), null);
  for (const [word, n] of [
    [-1, 57],
    [2 ** 32, 2],
    [1.2, 2],
    [1, 0],
    [1, 202],
  ])
    assert.throws(() => indexForWord(word, n));
});

test('embedded authority and result lineage do not share mutable references', () => {
  const a = realize();
  a.source.campaign.heroes[0].provenance.inspiration = 99;
  assert.equal(a.materialized.lineage.campaign.heroes[0].provenance.inspiration, 2);
  a.materialized.lineage.choices[0].recipe.balances[0].availableXP = 99;
  assert.equal(a.source.choices[0].recipe.balances[0].availableXP, 11);
});

test('JSON provenance keys survive parsing without silent schema normalization', () => {
  const s = source();
  s.campaign.provenance = JSON.parse(
    '{"__proto__":{"invented":true},"constructor":"invented-data","history":["invented"]}',
  );
  const a = realize(s);
  assert.deepEqual(a.source.campaign.provenance, s.campaign.provenance);
  assert.deepEqual(a.materialized.lineage.campaign.provenance, s.campaign.provenance);
  assert.equal(Object.getPrototypeOf(a.source.campaign.provenance), Object.prototype);
  assert.deepEqual(verifyCampDeckArtifact(JSON.parse(JSON.stringify(a))), a);
});
