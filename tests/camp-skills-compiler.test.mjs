import test from 'node:test';
import assert from 'node:assert/strict';
import { compileScenarioPack, parseScenarioPack } from '../dist/scenario-library.mjs';
import { campCompilation } from './fixtures/camp-skills.mjs';
import { hash } from './fixtures/map-freeze.mjs';

test('camp upgrades freeze separately from the 74 initial cards and require their own source certificate', () => {
  const raw = campCompilation();
  const result = compileScenarioPack(raw);
  assert.equal(result.pack.manifest.campSkills.roles.flatMap((r) => r.upgrades).length, 54);
  assert.deepEqual(parseScenarioPack(result.pack).pack, result.pack);
  const missing = structuredClone(raw);
  delete missing.campSkillsCertificate;
  assert.throws(() => compileScenarioPack(missing), /campo|attestat/i);
});

test('resigned camp capabilities reject wrong roles, copies, prices, cores, evidence and controller bindings', () => {
  for (const edit of [
    (c) => {
      c.failureFingerprint = 'f'.repeat(64);
    },
    (c) => {
      c.methods.add.assemblyHash = 'e'.repeat(64);
    },
    (c) => {
      c.roles[0].upgrades[0].cost++;
    },
    (c) => {
      c.roles[0].upgrades[0].card.ownerId = c.roles[1].id;
    },
    (c) => {
      c.roles[0].upgrades[0].copy = c.roles[1].upgrades[0].copy;
    },
    (c) => {
      c.roles[0].upgrades[0].models = [c.roles[0].core[0]];
    },
    (c) => {
      c.roles[0].upgrades[0].evidence.cost[0].sourceId = 'missing';
    },
    (c) => {
      c.roles[0].upgrades[0].card.kind = 'hero';
    },
    (c) => {
      c.roles[0].upgrades[0].models[0].roleSource = c.roles[1].source;
    },
    (c) => {
      c.roles[0].upgrades[1].models = c.roles[0].upgrades[0].models;
    },
  ]) {
    const raw = campCompilation();
    edit(raw.pack.manifest.campSkills);
    raw.campSkillsCertificate.instructionHash = hash(raw.pack.manifest.campSkills);
    assert.throws(() => compileScenarioPack(raw));
  }
});

test('absent camp capability preserves the complete historical pack', () => {
  const raw = campCompilation();
  delete raw.pack.manifest.campSkills;
  delete raw.campSkillsCertificate;
  const before = structuredClone(raw);
  const result = compileScenarioPack(raw);
  assert.equal(result.pack.manifest.campSkills, undefined);
  assert.deepEqual(raw, before);
});
