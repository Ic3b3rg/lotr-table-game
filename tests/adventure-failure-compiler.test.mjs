import test from 'node:test';
import assert from 'node:assert/strict';
import { compileScenarioPack, parseScenarioPack } from '../dist/scenario-library.mjs';
import { clueCompilerFixture, clueCompilation } from './fixtures/clue-progression.mjs';
import { attachFailure } from './fixtures/adventure-failure.mjs';
import { hash } from './fixtures/map-freeze.mjs';
function input() {
  const pack = clueCompilerFixture();
  attachFailure(pack);
  return {
    ...clueCompilation(pack),
    failureCertificate: { instructionHash: hash(pack.manifest.failure) },
  };
}
test('failure capability requires a certificate and the complete source terminal path', () => {
  const raw = input();
  assert.ok(compileScenarioPack(raw).pack.manifest.failure);
  const absent = structuredClone(raw);
  delete absent.failureCertificate;
  assert.throws(() => compileScenarioPack(absent), /attestat/);
  const broken = structuredClone(raw);
  broken.pack.definitions
    .find((d) => d.source === broken.pack.principal)
    .states.find((s) => s.index === 72)
    .actions.pop();
  assert.throws(() => parseScenarioPack(broken.pack), /conclusione|terminale|seguito/);
});
test('failure operations cannot be smuggled into a legacy pack or point to another destination', () => {
  const raw = input(),
    legacy = structuredClone(raw.pack);
  delete legacy.manifest.failure;
  assert.throws(() => parseScenarioPack(legacy), /capacità|conclusione/);
  raw.pack.manifest.failure.next.id++;
  assert.throws(() => parseScenarioPack(raw.pack), /destinazione|modello/);
});

test('the failure capability permits lore only in its certified reward state without opening unrelated principal rewards', async () => {
  const { scenarioFixture } = await import('./fixtures/scenario.mjs');
  const { attachEncounter } = await import('./original-encounter-helper.mjs');
  const { native } = await import('./fixtures/clue-progression.mjs');
  const pack = scenarioFixture();
  attachEncounter(pack);
  attachFailure(pack);
  assert.ok(parseScenarioPack(pack));
  pack.definitions
    .find((d) => d.source === pack.principal)
    .states.find((s) => s.index === 0)
    .actions.push(native(99, 'lore', 'FFG.JIME.Actions.AddLore', { amount: 2 }));
  assert.throws(() => parseScenarioPack(pack), /manifest chiuso/);
});
