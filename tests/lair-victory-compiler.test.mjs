import test from 'node:test';
import assert from 'node:assert/strict';
import { compileScenarioPack, parseScenarioPack } from '../dist/scenario-library.mjs';
import { lairCompilation, sealLair } from './fixtures/lair-victory.mjs';
import { native } from './fixtures/clue-progression.mjs';
import { playableScenarioPrefab } from '../src/shared/clues.ts';
import { hash } from './fixtures/map-freeze.mjs';

test('lair capability is attested, frozen to the clue and terminal owners and enables only its prefab', () => {
  const raw = lairCompilation();
  const compiled = compileScenarioPack(raw).pack;
  assert.deepEqual(parseScenarioPack(compiled).pack, compiled);
  assert.equal(playableScenarioPrefab(compiled, compiled.manifest.lair.prefab), true);
  assert.equal(playableScenarioPrefab(compiled, 'example.assets:uncompiled'), false);
  const absent = structuredClone(raw);
  delete absent.lairCertificate;
  assert.throws(() => compileScenarioPack(absent), /attestat|covo/i);
  for (const field of [
    'definitionHash',
    'principalHash',
    'cluesFingerprint',
    'failureFingerprint',
  ]) {
    const bad = structuredClone(raw);
    bad.pack.manifest.lair[field] = 'f'.repeat(64);
    bad.lairCertificate.instructionHash = hash(bad.pack.manifest.lair);
    assert.throws(() => compileScenarioPack(bad), /covo|freeze|conclusione/i);
  }
});

test('only the two certified reward branches may change campaign state; EndGame has one certified owner', () => {
  const raw = lairCompilation();
  assert.ok(compileScenarioPack(raw));
  for (const edit of [
    (p) => delete p.manifest.lair,
    (p) =>
      p.definitions[0].states[0].actions.push(
        native(99, 'awardXP', 'FFG.JIME.Actions.AwardXP', { amount: 1 }),
      ),
    (p) =>
      p.definitions[0].states[0].actions.push(
        native(99, 'lore', 'FFG.JIME.Actions.AddLore', { amount: 1 }),
      ),
    (p) =>
      p.definitions[1].states[0].actions.push(
        native(99, 'endGame', 'FFG.JIME.Actions.EndGame', { success: true }),
      ),
    (p) => {
      p.definitions[0].states.find((s) => s.index === 90).actions[0].value = false;
    },
    (p) => {
      p.definitions[0].states.find((s) => s.index === 90).transitions.FINISHED = 70;
    },
  ]) {
    const bad = structuredClone(raw.pack);
    edit(bad);
    if (bad.manifest.lair) sealLair(bad);
    assert.throws(() => parseScenarioPack(bad));
  }
});

test('lair controller evidence cannot be replaced by another assembly under a resigned capability', () => {
  const raw = lairCompilation();
  raw.pack.manifest.lair.methods.end.assemblyHash = 'e'.repeat(64);
  raw.lairCertificate.instructionHash = hash(raw.pack.manifest.lair);
  assert.throws(() => compileScenarioPack(raw), /covo|owner|controller|freeze/i);
});
