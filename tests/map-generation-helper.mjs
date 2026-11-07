import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { catalogFixture } from './fixtures/catalog.mjs';
import { generatorFixture } from './fixtures/map-freeze.mjs';
import { readyCompany, readSession } from './skill-test-helper.mjs';
import { command } from './preparation-helper.mjs';
export async function readyGenerator(
  t,
  edit = () => {},
  extraEnv = {},
  catalogInput = null,
  partySize = 2,
) {
  const catalog = catalogInput ?? catalogFixture();
  catalog.heroes.forEach((h) => (h.maxHands = 2));
  const raw = generatorFixture(catalog);
  edit(raw);
  const directory = await mkdtemp(join(tmpdir(), 'lotr-generator-test-')),
    path = join(directory, 'generator.json');
  await writeFile(path, JSON.stringify(raw));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return {
    ...(await readyCompany(t, catalog, partySize === 3 ? 3 : true, {
      LOTR_GENERATOR_PACK: path,
      ...extraEnv,
    })),
    packPath: path,
    raw,
    catalog,
  };
}
export const offer = async (host) => (await host.request('/api/map-generation-plan')).json();
export async function generate(host, player, overrides = {}, at) {
  const plan = await offer(host);
  return command(
    host,
    player,
    {
      type: 'GENERATE_ADVENTURE_MAP',
      packFingerprint: plan.packFingerprint,
      contextFingerprint: plan.contextFingerprint,
      requestedSeed: 1,
      agreed: true,
      ...overrides,
    },
    at,
  );
}
export async function waitGeneration(host, status = 'frozen') {
  const deadline = Date.now() + 30000;
  let last = null;
  while (Date.now() < deadline) {
    const state = await readSession(host);
    last = state.mapGeneration;
    if (state.mapGeneration?.status === status) return state;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail(
    `Generation did not reach ${status}: ${JSON.stringify(last && { status: last.status, reason: last.reason, attempt: last.job?.attempt })}`,
  );
}
