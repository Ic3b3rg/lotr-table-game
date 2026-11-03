import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { startHost } from './host-helper.mjs';
import { command } from './preparation-helper.mjs';
import { readyCompany, readSession, readBackup, signBackup } from './skill-test-helper.mjs';
import { enterShadow, enterRally, resolveScout } from './rounds-helper.mjs';

async function recover(host, player) {
  const state = await readSession(host);
  const response = await host.request('/api/recover', {
    recoveryCode: player.recoveryCode,
    generation: state.generation,
  });
  assert.equal(response.status, 200);
  return { ...player, cookie: response.headers.get('set-cookie').split(';')[0] };
}

for (const moment of ['turno', 'Ombra', 'Riorganizzazione']) {
  test(`${moment}: SIGKILL, backup e recupero conservano progressi, carte e ricevute`, async (t) => {
    const { host, player } = await readyCompany(t);
    let before;
    let intent;
    if (moment === 'turno') {
      assert.equal(
        (await command(host, player, { type: 'START_ROUNDS', agreed: true })).status,
        200,
      );
      const { round } = await readSession(host);
      assert.equal(
        (
          await command(host, player, {
            type: 'START_TURN',
            roundId: round.id,
            heroId: 'hero-1',
            agreed: true,
          })
        ).status,
        200,
      );
      before = await readSession(host);
      intent = {
        type: 'START_INTERACTION_TEST',
        roundId: round.id,
        turnId: before.round.turnId,
        heroId: 'hero-1',
        stat: 'might',
        modifier: 0,
        target: 2,
        requestId: randomUUID(),
      };
    } else if (moment === 'Ombra') {
      before = await enterShadow(host, player);
      intent = {
        type: 'CONFIRM_SHADOW_STEP',
        roundId: before.round.id,
        step: 'enemies',
        agreed: true,
        requestId: randomUUID(),
      };
    } else {
      before = await enterRally(host, player);
      intent = {
        type: 'START_RALLY_SCOUT',
        roundId: before.round.id,
        heroId: 'hero-1',
        requestId: randomUUID(),
      };
    }
    const response = await command(host, player, intent, before);
    assert.equal(response.status, 200);
    const receipt = (await response.json()).receipt;
    const pending = await readSession(host);
    const backup = await readBackup(host);
    await host.stop('SIGKILL');
    const restarted = await startHost({ LOTR_DATA_DIR: host.dataDir });
    t.after(() => restarted.stop());
    assert.deepEqual(await readSession(restarted), pending);
    assert.deepEqual((await readBackup(restarted)).payload, backup.payload);
    const recovered = await recover(restarted, player);
    const replay = await command(restarted, recovered, intent, before);
    assert.equal(replay.status, 200);
    assert.deepEqual((await replay.json()).receipt, receipt);
    assert.deepEqual(await readSession(restarted), pending);
    const destination = await startHost();
    t.after(() => destination.dispose());
    const blank = await readSession(destination);
    assert.equal(
      (
        await destination.request('/api/restores', {
          backup,
          generation: blank.generation,
          expectedRevision: blank.revision,
          confirmed: true,
        })
      ).status,
      200,
    );
    const restored = await readSession(destination);
    for (const key of ['round', 'preparation', 'skillTest', 'scout'])
      assert.deepEqual(restored[key], pending[key]);
    const owner = await recover(destination, player);
    assert.equal((await command(destination, owner, intent, before)).status, 409);
    const importedReplay = await command(destination, owner, intent, {
      ...before,
      generation: restored.generation,
    });
    assert.equal(importedReplay.status, 200);
    assert.deepEqual((await importedReplay.json()).receipt, receipt);
    if (moment === 'turno') {
      assert.equal(restored.round.heroes[0].actionsUsed, 1);
      assert.equal(
        (
          await command(destination, owner, {
            type: 'RESOLVE_SKILL_TEST',
            testId: restored.skillTest.id,
          })
        ).status,
        200,
      );
    } else if (moment === 'Ombra') {
      assert.equal(restored.round.shadowStep, 'darkness');
      assert.equal(
        (
          await command(destination, owner, {
            type: 'CONFIRM_SHADOW_STEP',
            roundId: restored.round.id,
            step: 'darkness',
            agreed: true,
          })
        ).status,
        200,
      );
    } else {
      assert.equal((await resolveScout(destination, owner)).round.heroes[0].rallyDone, true);
    }
  });
}

test('schema 4 con Scoperta aperta migra senza riordinare e resta indipendente dai round', async (t) => {
  const { host, player } = await readyCompany(t);
  assert.equal(
    (await command(host, player, { type: 'START_SCOUT', heroId: 'hero-1', count: 3 })).status,
    200,
  );
  const before = await readSession(host);
  const backup = await readBackup(host);
  backup.payload.state.schemaVersion = 4;
  delete backup.payload.state.mapGeneration;
  delete backup.payload.state.scenario;
  delete backup.payload.state.physical;
  delete backup.payload.state.group;
  delete backup.payload.state.round;
  delete backup.payload.state.journey;
  delete backup.payload.state.scout.roundId;
  signBackup(backup);
  await host.stop();
  const db = new DatabaseSync(join(host.dataDir, 'session.sqlite'));
  db.prepare('UPDATE session SET data=? WHERE id=1').run(JSON.stringify(backup.payload.state));
  db.close();
  const restarted = await startHost({ LOTR_DATA_DIR: host.dataDir });
  t.after(() => restarted.stop());
  const migrated = await readSession(restarted);
  assert.equal(migrated.schemaVersion, 12);
  assert.equal(migrated.round, null);
  assert.deepEqual(migrated.scout, before.scout);
  assert.deepEqual(migrated.preparation, before.preparation);
  assert.deepEqual((await readBackup(restarted)).payload.commands, backup.payload.commands);
  const destination = await startHost();
  t.after(() => destination.dispose());
  const blank = await readSession(destination);
  assert.equal(
    (
      await destination.request('/api/restores', {
        backup,
        generation: blank.generation,
        expectedRevision: blank.revision,
        confirmed: true,
      })
    ).status,
    200,
  );
  assert.deepEqual((await readSession(destination)).scout, before.scout);
  const owner = await recover(destination, player);
  assert.equal(
    (await command(destination, owner, { type: 'START_ROUNDS', agreed: true })).status,
    409,
  );
  await resolveScout(destination, owner);
  assert.equal(
    (await command(destination, owner, { type: 'START_ROUNDS', agreed: true })).status,
    200,
  );
});

test('backup con round incoerenti viene rifiutato senza sostituire il tavolo', async (t) => {
  const { host, player } = await readyCompany(t);
  let state = await enterRally(host, player);
  assert.equal(
    (
      await command(host, player, {
        type: 'START_RALLY_SCOUT',
        roundId: state.round.id,
        heroId: 'hero-1',
      })
    ).status,
    200,
  );
  state = await readSession(host);
  const original = await readBackup(host);
  const changes = [
    (s) => {
      s.round.heroes[1].heroId = s.round.heroes[0].heroId;
    },
    (s) => {
      s.round.heroes.pop();
    },
    (s) => {
      s.round.activeHeroId = 'hero-1';
      s.round.turnId = randomUUID();
    },
    (s) => {
      s.round.heroes[0].actionsUsed = 3;
    },
    (s) => {
      s.round.heroes[0].turnEnded = false;
    },
    (s) => {
      s.round.shadowStep = 'threat';
    },
    (s) => {
      s.round.heroes[0].rallyDone = true;
    },
    (s) => {
      s.scout.roundId = randomUUID();
    },
    (s) => {
      s.scout.roundId = null;
    },
    (s) => {
      s.scout.resetBefore = true;
    },
    (s) => {
      s.round = null;
    },
  ];
  for (const mutate of changes) {
    const backup = structuredClone(original);
    mutate(backup.payload.state);
    signBackup(backup);
    assert.equal(
      (
        await host.request('/api/restores', {
          backup,
          generation: state.generation,
          expectedRevision: state.revision,
          confirmed: true,
        })
      ).status,
      422,
    );
    assert.deepEqual(await readSession(host), state);
  }
});
