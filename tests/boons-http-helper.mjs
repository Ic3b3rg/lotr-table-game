// Synthetic pre-startup content only; never used with original acceptance evidence.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { readyCombat, drainCombat } from './combat-controller-helper.mjs';
import { boonFixture } from './fixtures/boons.mjs';
import { compileBoons } from '../dist/physical-resolution-library.mjs';
import { digest } from '../dist/map-freeze-library.mjs';
import { readSession } from './skill-test-helper.mjs';
import { command } from './preparation-helper.mjs';

export async function readyBoonCombat(t, verified = true, edit = () => {}) {
  const f = boonFixture(verified),
    artifact = compileBoons(f.raw, f.boonInput);
  const ready = await readyCombat(
    t,
    (src, pack, frozen) => {
      src.additions.forEach((a) => {
        a.predicate = 'always';
        a.effect = { op: 'gain-boon', boon: null };
      });
      src.assets
        .filter((a) => a.cls === 'EnemyActivationModel')
        .forEach((a) => {
          a.data.MinGroupSize = 1;
          a.data.KeyAttackAdditionalEffect = 'extra';
          a.dataHash = digest(a.data);
        });
      pack.manifest.boons = { version: artifact.version, fingerprint: artifact.fingerprint };
      edit(src, pack, frozen);
    },
    undefined,
    (_fronts, _catalog, raw, ready) => {
      raw.cards = structuredClone(f.raw.cards);
      assert.equal(digest(raw), artifact.rawFingerprint);
      writeFileSync(join(ready.host.dataDir, 'physical-boons.json'), JSON.stringify(artifact));
    },
  );
  return ready;
}
export async function attackToBoon(ready) {
  const s = await readSession(ready.host),
    offer = s.combat.attacks.find((o) => !o.reason);
  assert.ok(offer, 'a frozen synthetic boon consumer must enable the real attack offer');
  const r = await command(
    ready.host,
    ready.player,
    {
      type: 'START_ATTACK',
      roundId: s.round.id,
      turnId: s.round.turnId,
      heroId: offer.heroId,
      groupId: offer.groupId,
      itemCopies: offer.itemCopies,
      stat: offer.stat,
      replaceCopy: null,
      grantId: null,
    },
    s,
  );
  assert.equal(r.status, 200, await r.text());
  return drainCombat(
    ready,
    (q) => (q.options?.some((o) => o.id === 'addition') ? 'addition' : null),
    (s) => s.physical.active?.options?.some((o) => o.id === 'hidden'),
  );
}
