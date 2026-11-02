import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { catalogFixture } from './fixtures/catalog.mjs';
import { joinPlayer } from './host-helper.mjs';
import { command, setup } from './preparation-helper.mjs';

export async function readyCompany(
  t,
  catalog = catalogFixture(),
  multiplayer = false,
  extraEnv = {},
) {
  const host = await setup(t, catalog, extraEnv);
  const player = await joinPlayer(host, 'Frodo');
  const other = multiplayer ? await joinPlayer(host, 'Sam') : null;
  assert.equal(
    (
      await command(host, player, {
        type: 'SELECT_HEROES',
        heroIds: other ? ['hero-1'] : ['hero-1', 'hero-2'],
      })
    ).status,
    200,
  );
  if (other)
    assert.equal(
      (await command(host, other, { type: 'SELECT_HEROES', heroIds: ['hero-2'] })).status,
      200,
    );
  assert.equal(
    (await command(host, player, { type: 'PREPARE_COMPANY', agreed: true })).status,
    200,
  );
  return { host, player, other };
}

export const readSession = async (host) => (await host.request('/api/session')).json();
export const readBackup = async (host) => (await host.request('/api/backups')).json();
export const startTest = (host, player, overrides = {}, at) =>
  command(
    host,
    player,
    {
      type: 'START_SKILL_TEST',
      heroId: 'hero-1',
      stat: 'might',
      modifier: 0,
      target: 3,
      ...overrides,
    },
    at,
  );

export function signBackup(backup) {
  const canonical = (value) =>
    Array.isArray(value)
      ? `[${value.map(canonical).join(',')}]`
      : value && typeof value === 'object'
        ? `{${Object.keys(value)
            .sort()
            .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
            .join(',')}}`
        : JSON.stringify(value);
  backup.checksum = createHash('sha256').update(canonical(backup.payload)).digest('hex');
  return backup;
}
