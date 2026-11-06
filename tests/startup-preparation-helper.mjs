// Entirely invented cards, source instructions, effects and quantities.
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { readyScenario, startScenario, scenarioInput } from './scenario-helper.mjs';
import { catalogFixture } from './fixtures/catalog.mjs';
import { state, text } from './fixtures/scenario.mjs';
import { diagnosticRaw, inventedFrontInput, hash } from './fixtures/physical-fronts.mjs';
import { compilePhysicalFronts } from '../dist/physical-resolution-library.mjs';
import { readSession } from './skill-test-helper.mjs';

export function startupMaterial(catalog = catalogFixture()) {
  catalog.heroes.forEach((h) => (h.maxHands ??= 2));
  const raw = diagnosticRaw(),
    input = inventedFrontInput(raw);
  for (const d of input.definitions) d.body = [{ op: 'keep-faceup' }];
  const initial = new Set(catalog.roles.map((r) => r.skills[0]));
  input.policies = catalog.skills.map((c) => ({
    id: c.id,
    kind: 'skill',
    definitionHash: hash(c),
    source: { sourceId: 'invented-startup', locator: 'Invented!1' },
    effects: initial.has(c.id)
      ? [{ op: 'after-prepare-inspiration' }]
      : [{ op: 'after-prepare-flip-fear' }, { op: 'after-prepare-inspiration' }],
  }));
  const fronts = compilePhysicalFronts(raw, input, catalog);
  return {
    raw,
    input,
    fronts,
    capability: {
      version: 'source-startup-preparation-v1',
      frontsFingerprint: fronts.fingerprint,
      catalogHash: hash(catalog),
      evidenceHash: hash('invented preparation evidence'),
    },
    preparedEffects: catalog.skills.map((c) => ({
      skillId: c.id,
      cardHash: hash(c),
      ...(initial.has(c.id)
        ? { effect: 'inspiration', amount: 1 }
        : { effect: 'requires-capability', capability: 'faceup-fear-flip' }),
    })),
  };
}
export async function readyStartup(
  t,
  { fear = 0, legacy = false, edit = () => {}, catalogEdit = () => {} } = {},
) {
  const catalog = catalogFixture();
  catalogEdit(catalog);
  const material = startupMaterial(catalog);
  const ready = await readyScenario(
    t,
    (pack) => {
      pack.name = 'Avvio sintetico · carte e fonte inventate';
      pack.manifest.scope = 'synthetic-physical-p1';
      pack.preparedEffects = material.preparedEffects;
      if (!legacy) pack.manifest.startupPreparation = material.capability;
      // A source action before Scout supplies legal faceup fear for this invented test.
      if (fear) {
        const program = {
          profile: 'source-fronts-v1',
          initialCredits: [0, 0],
          limits: [0, 1].map(() => ({ kind: 'requires-capability', capability: 'source-derived' })),
          darknessHeroes: [],
          children: [
            {
              kind: 'suffer',
              hero: 0,
              face: 'faceup',
              cards: [{ family: 'fear', amount: fear }],
              prevention: [],
            },
          ],
        };
        pack.definitions[0].states.find((s) => s.index === 3).transitions.FINISHED = 12;
        pack.definitions[0].states.push(
          state(
            12,
            [
              {
                index: 0,
                op: 'physical',
                origin: {
                  type: 'Synthetic.PhysicalProgram',
                  parameterHash: hash(program),
                  load: 'hash-match-positional',
                },
                text: text('Conseguenza iniziale interamente inventata'),
                program,
              },
            ],
            { FINISHED: 4 },
          ),
        );
      }
      edit(pack, material);
    },
    (c) => Object.assign(c, catalog),
  );
  const physicalPath = join(ready.host.dataDir, 'physical-content.json');
  const frontsPath = join(ready.host.dataDir, 'physical-fronts.json');
  await writeFile(physicalPath, JSON.stringify(material.raw));
  await writeFile(frontsPath, JSON.stringify(material.fronts));
  return { ...ready, material, physicalPath, frontsPath };
}
export async function reachStartupScout(ready) {
  const { host, player } = ready;
  const r = await startScenario(host, player);
  assert.equal(r.status, 200, await r.text());
  for (let n = 0; n < 30; n++) {
    const s = await readSession(host),
      q = s.scenario.pending;
    if (
      q.kind === 'scout' ||
      (q.kind === 'physical' && s.physical.active?.options?.some((o) => o.id === 'reveal'))
    )
      return s;
    const result = await scenarioInput(host, player, { kind: 'ack' });
    assert.equal(result.status, 200, await result.text());
  }
  assert.fail('No startup Scout reached');
}
export async function revealStartupScout(ready) {
  const s = await reachStartupScout(ready);
  const r = await scenarioInput(
    ready.host,
    ready.player,
    s.scenario.pending.kind === 'scout'
      ? { kind: 'scout-reveal' }
      : { kind: 'physical-choice', option: 'reveal' },
  );
  assert.equal(r.status, 200, await r.text());
  return readSession(ready.host);
}
