import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readyAdventure3,
  reachSecondCamp,
  saveCheckpoint,
  readSession,
  readBackup,
  scenarioInput,
  firstJourneyMove,
} from './adventure3-startup-helper.mjs';
import { ok } from './battle-combat-helper.mjs';
import { drainPhase } from './battle-rounds-helper.mjs';
import { cycleCommand } from './physical-cycle-helper.mjs';
import { buyInput } from './camp-skills-helper.mjs';
import { choice, confirm } from './camp-preparation-helper.mjs';

for (const outcome of ['victory', 'failure'])
  test(`${outcome}: actual A2 terminal, real second camp, generated A3 startup and first legal action`, async (t) => {
    const r = await readyAdventure3(t, { outcome, groupItem: true, roleScout: true });
    const s = await reachSecondCamp(r);
    const before = (await saveCheckpoint(r, `red-${outcome}-camp`)).payload;
    if (outcome === 'failure')
      assert.equal(before.state.physical.snapshot.lastStand.heroes[2].defeated, true);
    const response = await scenarioInput(r.host, r.player, {
      kind: 'camp-depart',
      offerFingerprint: '0'.repeat(64),
      agreed: true,
    });
    const rejected = await response.json();
    assert.equal(response.status, 409);
    assert.equal(rejected.error.code, 'CAMP_DEPARTURE_GATED');
    assert.deepEqual((await readBackup(r.host)).payload, before);
    assert.equal(
      s.scenario.conclusion.xp.every((x) => x.amount === (outcome === 'victory' ? 4 : 3)),
      true,
    );
    const purchase = buyInput(s),
      training = structuredClone(s.scenario.conclusion.campaign.training);
    await ok(scenarioInput(r.host, r.player, purchase));
    const itemBefore = (await readBackup(r.host)).payload.state;
    await ok(
      scenarioInput(r.host, r.player, {
        kind: 'camp-item',
        heroId: 'hero-1',
        copy: 'sword:1',
        upgrade: 'advanced:1',
      }),
    );
    const itemAfter = (await readBackup(r.host)).payload.state;
    assert.equal(itemAfter.scenario.play.lore, itemBefore.scenario.play.lore);
    assert.deepEqual(
      itemAfter.scenario.conclusion.campaign.training,
      itemBefore.scenario.conclusion.campaign.training,
    );
    assert.deepEqual(itemAfter.preparation, itemBefore.preparation);
    await ok(scenarioInput(r.host, r.player, { ...purchase, operation: 'sell' }));
    assert.deepEqual((await readSession(r.host)).scenario.conclusion.campaign.training, training);
    await ok(scenarioInput(r.host, r.player, purchase));
    const preparation = await scenarioInput(r.host, r.player, { kind: 'camp-prepare' });
    const body = await preparation.json();
    assert.equal(
      preparation.status,
      200,
      `The new prospective A2 authority must offer the real second camp: ${JSON.stringify(body)}`,
    );
    assert.equal((await readSession(r.host)).scenario.conclusion.stage, 'camp-preparation');
    for (const actor of r.actors) {
      const current = await readSession(r.host),
        hero = current.preparation.heroes.find((h) => h.playerId === actor.body.player.id),
        choice = current.scenario.conclusion.campaign.preparation.heroes.find(
          (h) => h.heroId === hero.heroId,
        );
      await ok(
        scenarioInput(r.host, actor, {
          kind: 'camp-confirm',
          heroId: hero.heroId,
          summaryHash: choice.summaryHash,
        }),
      );
    }
    const stale = await readSession(r.host),
      staleOffer = stale.campDeparture.fingerprint;
    await ok(
      scenarioInput(r.host, r.player, {
        kind: 'camp-select-role',
        heroId: 'hero-1',
        roleId: 'role-4',
      }),
    );
    assert.equal(choice(await readSession(r.host)).confirmedRevision, null);
    assert.deepEqual(choice(await readSession(r.host), 'hero-2'), choice(stale, 'hero-2'));
    let unchanged = (await readBackup(r.host)).payload;
    assert.equal(
      (
        await scenarioInput(r.host, r.player, {
          kind: 'camp-depart',
          offerFingerprint: staleOffer,
          agreed: true,
        })
      ).status,
      409,
    );
    assert.deepEqual((await readBackup(r.host)).payload, unchanged);
    assert.equal(
      (
        await scenarioInput(r.host, r.other, {
          kind: 'camp-accessory',
          heroId: 'hero-1',
          copy: 'trinket:1',
        })
      ).status,
      403,
    );
    assert.deepEqual((await readBackup(r.host)).payload, unchanged);
    await ok(
      scenarioInput(r.host, r.player, {
        kind: 'camp-accessory',
        heroId: 'hero-1',
        copy: 'trinket:1',
      }),
    );
    await ok(scenarioInput(r.host, r.player, confirm(await readSession(r.host))));
    const confirmed = await readSession(r.host);
    assert.equal(confirmed.campDeparture.available, true, confirmed.campDeparture.reason);
    await saveCheckpoint(r, `green-${outcome}-confirmed`);
    await ok(
      scenarioInput(r.host, r.player, {
        kind: 'camp-depart',
        offerFingerprint: confirmed.campDeparture.fingerprint,
        agreed: true,
      }),
    );
    await drainPhase(r);
    const active = await readSession(r.host),
      state = (await saveCheckpoint(r, `green-${outcome}-action`)).payload.state;
    assert.equal(active.scenario.phase, 'action');
    assert.equal(state.schemaVersion, 36);
    assert.equal(state.episodes.length, 2);
    assert.equal(state.physical.cycle.version, 4);
    assert.deepEqual(state.episodes[0], before.state.episodes[0]);
    assert.deepEqual(state.scenario.journeyStartup.campaign.completedAdventureIds, [1, 2]);
    assert.equal(state.mapGeneration.projection.sections.length, 7);
    assert.equal(
      state.scenario.journeyStartup.startSpaceDraw.value,
      state.scenario.journeyStartup.startSpaceIndex,
    );
    assert.equal(
      state.scenario.globals.inventedWon,
      before.state.episodes[0].scenario.globals.inventedWon,
      'A3 retains the actual A1 result independently of the A2 result.',
    );
    assert.equal(state.scenario.globals.battleWon, outcome === 'victory');
    assert.ok(state.physical.snapshot.lastStand.heroes.every((h) => !h.defeated));
    assert.equal(
      state.scenario.journeyStartup.campaign.lastStandsFailed,
      before.state.scenario.battle.campaign.lastStandsFailed +
        before.state.physical.snapshot.lastStand.selections.filter((s) => s.outcome === 'fail')
          .length,
    );
    assert.equal(state.preparation.heroes[0].roleId, 'role-4');
    assert.ok(state.preparation.heroes[0].itemCopies.includes('advanced:1'));
    assert.ok(
      state.preparation.heroes[0].inspiration >= 1,
      'The upgraded item completes its after-setup window.',
    );
    assert.ok(state.preparation.episode.heroes[0].copies.includes(purchase.copy));
    assert.equal(state.preparation.episode.heroes[0].accessory, 'trinket:1');
    assert.equal(
      state.scenario.journeyStartup.campaign.balances.find(
        (b) => b.heroId === 'hero-1' && b.roleId === 'role-4',
      ).availableXP,
      0,
    );
    assert.equal(active.scenario.journeyStartup.startSpaceDraw, undefined);
    assert.equal(active.scenario.journeyStartup.campaign, undefined);
    await ok(cycleCommand(r, 'START_TURN', {}, r.player));
    await ok(cycleCommand(r, 'START_TRAVEL', {}, r.player));
    assert.equal((await readSession(r.host)).round.heroes[0].actionsUsed, 1);
    await firstJourneyMove(r);
    await saveCheckpoint(r, `green-${outcome}-first-travel`);
    unchanged = (await readBackup(r.host)).payload;
    const gated = await cycleCommand(r, 'BEGIN_SHADOW', {}, r.player);
    assert.equal(gated.status, 409);
    assert.equal((await gated.json()).error.code, 'ADVENTURE3_CONTINUATION_GATED');
    assert.deepEqual((await readBackup(r.host)).payload, unchanged);
  });
