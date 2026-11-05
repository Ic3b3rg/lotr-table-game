import test from 'node:test';
import assert from 'node:assert/strict';
import { compileScenarioPack, parseScenarioPack } from '../dist/scenario-library.mjs';
import { threatCompilation } from './fixtures/threat-continuations.mjs';
import { attachLiveGroups } from './fixtures/live-groups.mjs';
import { hash } from './fixtures/map-freeze.mjs';

test('the live group capability must be attested and bound to the frozen source controllers', () => {
  const input = threatCompilation();
  attachLiveGroups(input.pack);
  input.liveGroupsCertificate = { instructionHash: hash(input.pack.manifest.liveGroups) };
  const compiled = compileScenarioPack(input).pack;
  assert.deepEqual(parseScenarioPack(compiled).pack, compiled);
  for (const field of ['roundsFingerprint', 'followupFingerprint', 'failureFingerprint']) {
    const bad = structuredClone(input);
    bad.pack.manifest.liveGroups[field] = 'f'.repeat(64);
    bad.liveGroupsCertificate.instructionHash = hash(bad.pack.manifest.liveGroups);
    assert.throws(() => compileScenarioPack(bad), /grupp|freeze/i);
  }
  delete input.liveGroupsCertificate;
  assert.throws(() => compileScenarioPack(input), /attestat/i);
  delete input.pack.manifest.liveGroups;
  input.liveGroupsCertificate = { instructionHash: hash('foreign') };
  assert.throws(() => compileScenarioPack(input), /attestat/i);
});

test('a physical instruction cannot smuggle new group rules into a pack without the pre-startup capability', async (t) => {
  const { readyFronts } = await import('./physical-front-helper.mjs');
  const r = await readyFronts(t, (pack, program) => {
    program.groupRules = 'source-live-groups-v1';
  });
  assert.throws(() => parseScenarioPack(r.pack), /grupp/i);
});
