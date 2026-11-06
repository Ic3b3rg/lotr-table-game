import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readyScenario } from './scenario-helper.mjs';
import { attachEncounter, sourceCatalog } from './original-encounter-helper.mjs';
import { attachFailure } from './fixtures/adventure-failure.mjs';
import { addCampItemCards, attachCampItems } from './fixtures/camp-items.mjs';
import { diagnosticRaw, inventedFrontInput } from './fixtures/physical-fronts.mjs';
import { inventedLastStand } from './fixtures/last-stand.mjs';
import { compilePhysicalFronts, compileLastStand } from '../dist/physical-resolution-library.mjs';
import { hash } from './fixtures/map-freeze.mjs';
import { command } from './preparation-helper.mjs';
import { readBackup } from './skill-test-helper.mjs';

test('startup plan gates an item card/catalog mismatch before any scenario, card, cost or RNG mutation', async (t) => {
  let catalog;
  const r = await readyScenario(
    t,
    (pack) => {
      attachEncounter(pack);
      attachFailure(pack);
      attachCampItems(pack, catalog);
    },
    (c) => {
      sourceCatalog(c);
      addCampItemCards(c);
      catalog = structuredClone(c);
    },
  );
  const raw = diagnosticRaw();
  for (const [name, value] of [
    ['physical-content', raw],
    ['physical-fronts', compilePhysicalFronts(raw, inventedFrontInput(raw), r.catalog)],
    ['physical-last-stand', compileLastStand(raw, inventedLastStand(raw))],
  ])
    await writeFile(join(r.host.dataDir, name + '.json'), JSON.stringify(value));
  assert.equal((await (await r.host.request('/api/scenario-plan')).json()).available, true);
  const before = (await readBackup(r.host)).payload;
  r.pack.manifest.campItems.cards[0].cardHash = 'f'.repeat(64);
  await writeFile(r.scenarioPath, JSON.stringify(r.pack));
  const plan = await (await r.host.request('/api/scenario-plan')).json();
  assert.equal(plan.available, false);
  const response = await command(r.host, r.player, {
    type: 'START_SCENARIO',
    packFingerprint: hash(r.pack),
    projectionFingerprint: r.frozen.mapGeneration.projection.fingerprint,
    agreed: true,
  });
  assert.equal(response.status, 409);
  assert.deepEqual((await readBackup(r.host)).payload, before);
});
