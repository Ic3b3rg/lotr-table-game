import { command } from './preparation-helper.mjs';

export const startScout = (host, player, count = 2, heroId = 'hero-1', at) =>
  command(host, player, { type: 'START_SCOUT', heroId, count }, at);

export function finishScout(host, player, scout, prepareCopy = null, overrides = {}, at) {
  return command(
    host,
    player,
    {
      type: 'RESOLVE_SCOUT',
      scoutId: scout.id,
      prepareCopy,
      top: scout.revealed.filter((copy) => copy !== prepareCopy),
      bottom: [],
      discardPreparedCopy: null,
      ...overrides,
    },
    at,
  );
}
