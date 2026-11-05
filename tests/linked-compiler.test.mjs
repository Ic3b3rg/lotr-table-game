import test from 'node:test';
import assert from 'node:assert/strict';
import { compileScenarioPack, parseScenarioPack } from '../dist/scenario-library.mjs';
import { linkedCompilation, sealLinked } from './fixtures/linked-encounters.mjs';
import { hash } from './fixtures/map-freeze.mjs';
import { native } from './fixtures/clue-progression.mjs';

test('a bounded attestation enables exactly two linked closures and source title identities', () => {
  const raw = linkedCompilation();
  const result = compileScenarioPack(raw);
  assert.equal(result.pack.manifest.linked.encounters.length, 2);
  assert.deepEqual(parseScenarioPack(result.pack).pack, result.pack);
  assert.notEqual(
    result.pack.manifest.linked.title.titleModel.modelId,
    result.pack.manifest.linked.title.skillModel.modelId,
  );
  for (const edit of [
    (r) => delete r.linkedCertificate,
    (r) => delete r.pack.manifest.linked,
    (r) => r.pack.manifest.linked.encounters.reverse(),
    (r) => r.pack.manifest.linked.encounters.push(r.pack.manifest.linked.encounters[0]),
    (r) => (r.pack.manifest.linked.encounters[0].definitionHash = 'e'.repeat(64)),
    (r) => (r.pack.manifest.linked.methods.award.assemblyHash = 'e'.repeat(64)),
    (r) =>
      (r.pack.manifest.linked.title.skillModel.source =
        r.pack.manifest.linked.title.titleModel.source),
  ]) {
    const bad = structuredClone(raw);
    edit(bad);
    if (bad.linkedCertificate && bad.pack.manifest.linked)
      bad.linkedCertificate.instructionHash = hash(bad.pack.manifest.linked);
    assert.throws(() => compileScenarioPack(bad));
  }
});

test('the linked capability grants no campaign, arbitrary title or interaction permission outside its owners', () => {
  const raw = linkedCompilation();
  assert.ok(compileScenarioPack(raw));
  for (const edit of [
    (p) =>
      p.definitions[1].states[0].actions.push(
        native(99, 'chooseHero', 'FFG.JIME.Actions.DisplayMessagePlayerChoice', {
          text: [{ kind: 'text', text: 'Inventato', style: 'plain' }],
          target: { scope: 'local', name: 'missing' },
        }),
      ),
    (p) =>
      p.definitions
        .at(-2)
        .states[0].actions.push(native(99, 'lore', 'FFG.JIME.Actions.AddLore', { amount: 1 })),
    (p) =>
      p.definitions
        .at(-1)
        .states[0].actions.push(
          native(99, 'awardTitle', 'FFG.JIME.Actions.AwardTitle', {
            recipient: { scope: 'local', name: 'tile' },
            titleModel: p.manifest.linked.title.titleModel.source,
          }),
        ),
  ]) {
    const bad = structuredClone(raw.pack);
    edit(bad);
    sealLinked(bad);
    assert.throws(() => parseScenarioPack(bad));
  }
});
