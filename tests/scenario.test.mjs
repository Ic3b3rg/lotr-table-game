import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readyScenario, startScenario, scenarioInput } from './scenario-helper.mjs';
import { readSession } from './skill-test-helper.mjs';
import { command } from './preparation-helper.mjs';
test('HTTP avvio: initialization di tutti i prefab prima di intro e nessuna rigenerazione', async (t) => {
  const { host, player, frozen } = await readyScenario(t);
  const plan = await host.request('/api/scenario-plan');
  assert.equal(plan.status, 200);
  assert.equal((await plan.json()).available, true);
  const response = await startScenario(host, player);
  assert.equal(response.status, 200, await response.text());
  const s = await readSession(host),
    sc = s.scenario;
  assert.equal(sc.pending.kind, 'message');
  assert.equal(sc.pending.state, 2);
  assert.equal(sc.globals.boundTile, s.mapGeneration.projection.sections[0].tiles[0].hashId);
  assert.deepEqual(
    sc.globals.boundPosition,
    s.mapGeneration.projection.assignments[0].nodePosition,
  );
  assert.equal(sc.instances.find((i) => i.kind === 'timer').variables.running, true);
  assert.equal(sc.instances.filter((i) => i.kind === 'encounter').length, 3);
  assert.deepEqual(s.mapGeneration, frozen.mapGeneration);
  assert.equal(s.round, null);
  assert.equal(s.journey, null);
  const legacy = await command(host, player, { type: 'START_SCOUT', heroId: 'hero-1', count: 2 });
  assert.equal(legacy.status, 409);
  assert.equal((await scenarioInput(host, player, { kind: 'ack' })).status, 200);
  const placed = await readSession(host);
  assert.equal(placed.scenario.pending.kind, 'placement');
  assert.equal(placed.scenario.tiles.filter((t) => t.visible).length, 1);
  assert.equal(placed.journey, null);
});
test('Scout2 e Spirito1 per eroe, eventi in space order, flip once-only e unico handoff al turno', async (t) => {
  const { host, player, other, frozen } = await readyScenario(t);
  assert.equal((await startScenario(host, player)).status, 200);
  const kinds = [],
    cards = [];
  for (let n = 0; n < 40; n++) {
    const s = await readSession(host),
      sc = s.scenario,
      q = sc.pending;
    if (sc.phase === 'action') break;
    assert.ok(q);
    kinds.push(q.kind);
    const actor = q.heroId === 'hero-2' ? other : player;
    if (q.kind === 'scout') {
      assert.equal(
        (
          await scenarioInput(
            host,
            actor === player ? other : player,
            q.stage === 'ready'
              ? { kind: 'scout-reveal' }
              : {
                  kind: 'scout-resolve',
                  prepareCopy: null,
                  top: s.scout.revealed,
                  bottom: [],
                  discardPreparedCopy: null,
                },
          )
        ).status,
        403,
      );
      if (q.stage === 'ready') {
        assert.equal((await scenarioInput(host, actor, { kind: 'ack' })).status, 409);
        assert.equal((await scenarioInput(host, actor, { kind: 'scout-reveal' })).status, 200);
        const open = await readSession(host);
        assert.equal(open.scout.count, 2);
        assert.equal(open.scout.resetBefore, false);
        cards.push(open.scout.revealed);
      } else {
        assert.equal(
          (
            await scenarioInput(host, actor, {
              kind: 'scout-resolve',
              prepareCopy: s.scout.revealed[0],
              top: s.scout.revealed.slice(1),
              bottom: [],
              discardPreparedCopy: null,
            })
          ).status,
          200,
        );
      }
    } else if (q.kind === 'test') {
      if (q.stage === 'ready')
        assert.equal((await scenarioInput(host, actor, { kind: 'test-reveal' })).status, 200);
      else {
        assert.equal(s.skillTest.stat, 'spirit');
        assert.equal(s.skillTest.target, 1);
        cards.push(s.skillTest.revealed);
        if (
          s.skillTest.fateRemaining &&
          s.preparation.heroes.find((h) => h.heroId === q.heroId).inspiration
        ) {
          assert.equal((await scenarioInput(host, actor, { kind: 'convert' })).status, 200);
        }
        assert.equal((await scenarioInput(host, actor, { kind: 'test-resolve' })).status, 200);
      }
    } else {
      const r = await scenarioInput(
        host,
        player,
        { kind: 'ack' },
        { requestId: `scenario-ack-request-number-${n}` },
        s,
      );
      assert.equal(r.status, 200, await r.text());
      const at = await readSession(host);
      const duplicate = await scenarioInput(
        host,
        player,
        { kind: 'ack' },
        { requestId: `scenario-ack-request-number-${n}` },
        s,
      );
      assert.equal(duplicate.status, 200);
      assert.deepEqual(await readSession(host), at);
    }
  }
  const end = await readSession(host),
    sc = end.scenario;
  assert.equal(sc.phase, 'action');
  assert.equal(sc.handoffCount, 1);
  assert.equal(end.round.number, 1);
  assert.deepEqual(end.mapGeneration, frozen.mapGeneration);
  assert.equal(sc.completedSetup.length, 4);
  assert.deepEqual(
    sc.completedSetup.map((c) => [c.kind, c.heroId]),
    [
      ['scout', 'hero-1'],
      ['scout', 'hero-2'],
      ['test', 'hero-1'],
      ['test', 'hero-2'],
    ],
  );
  assert.equal(sc.instances.find((i) => i.kind === 'timer').variables.flipped, true);
  assert.equal(sc.events.filter((e) => e.event === 'PERSON_REVEALED').length, 1);
  const nodes = sc.instances.filter((i) => i.kind === 'encounter');
  assert.deepEqual(
    end.mapGeneration.projection.assignments.map(
      (a) => nodes.find((i) => i.spaceId === a.spaceId).visible,
    ),
    [true, false, true],
  );
  assert.ok(nodes.every((i) => i.processing === 0));
  assert.equal(sc.tiles.filter((t) => t.explored).length, 2);
  assert.ok(sc.tiles.some((t) => !t.visible));
  assert.ok(sc.tiles.filter((t) => t.visible && !t.explored).length >= 1);
  assert.equal(
    end.journey.heroes[0].spaceId,
    sc.spaceBindings.find(
      (b) =>
        b.sourceId ===
        end.mapGeneration.projection.spaces.find((s) => s.sectionId === 0 && s.index === 1).id,
    ).id,
  );
  assert.ok(end.round.heroes.every((h) => h.actionsUsed === 0));
  assert.equal(
    (
      await command(host, player, {
        type: 'START_TURN',
        roundId: end.round.id,
        heroId: 'hero-1',
        agreed: true,
      })
    ).status,
    200,
  );
  const turn = await readSession(host);
  assert.ok(turn.round.turnId);
  assert.equal(
    (await command(host, player, { type: 'BEGIN_SHADOW', roundId: turn.round.id, agreed: true }))
      .status,
    409,
  );
});
for (const mode of ['conversion', 'capped'])
  test(`ricompensa setup ${mode}: risultato e completamento persistono al limite`, async (t) => {
    const { readBackup, signBackup } = await import('./skill-test-helper.mjs');
    const {
      host,
      player: seat,
      other: second,
      catalog,
    } = await readyScenario(
      t,
      () => {},
      (c) => {
        if (mode === 'capped')
          for (const card of c.skills) {
            card.success = 1;
            card.fate = 0;
          }
      },
    );
    const backup = await readBackup(host);
    for (const h of backup.payload.state.preparation.heroes) h.inspiration = 4;
    signBackup(backup);
    const before = await readSession(host);
    assert.equal(
      (
        await host.request('/api/restores', {
          backup,
          generation: before.generation,
          expectedRevision: before.revision,
          confirmed: true,
        })
      ).status,
      200,
    );
    const generation = (await readSession(host)).generation;
    const recover = async (seat) => {
      const r = await host.request('/api/recover', { generation, recoveryCode: seat.recoveryCode });
      return { ...seat, cookie: r.headers.get('set-cookie').split(';')[0] };
    };
    const player = await recover(seat),
      other = await recover(second);
    assert.equal((await startScenario(host, player)).status, 200);
    for (let n = 0; n < 45; n++) {
      const s = await readSession(host),
        q = s.scenario.pending;
      if (!q) break;
      const actor = q.heroId === 'hero-2' ? other : player;
      let input = { kind: 'ack' };
      if (q.kind === 'scout')
        input =
          q.stage === 'ready'
            ? { kind: 'scout-reveal' }
            : {
                kind: 'scout-resolve',
                prepareCopy: null,
                top: s.scout.revealed,
                bottom: [],
                discardPreparedCopy: null,
              };
      if (q.kind === 'test') {
        if (q.stage === 'ready') input = { kind: 'test-reveal' };
        else {
          if (mode === 'conversion' && s.skillTest.converted === 0) {
            assert.equal((await scenarioInput(host, actor, { kind: 'convert' })).status, 200);
          }
          input = { kind: 'test-resolve' };
        }
      }
      const r = await scenarioInput(host, actor, input);
      assert.equal(r.status, 200, await r.text());
    }
    const end = await readSession(host);
    assert.equal(end.scenario.phase, 'action');
    const tests = end.scenario.completedSetup.filter((c) => c.kind === 'test');
    assert.equal(tests.length, 2);
    for (const c of tests) {
      assert.equal(c.outcome, 'pass');
      assert.equal(c.reward, mode === 'capped' ? 0 : 1);
      assert.equal(c.converted, mode === 'capped' ? 0 : 1);
    }
    assert.ok(
      end.preparation.heroes.every(
        (h) => h.inspiration === catalog.heroes.find((d) => d.id === h.heroId).stats.inspiration,
      ),
    );
  });
test('stale/cross-request e doppio invio non ridisegnano carte o saltano una richiesta', async (t) => {
  const { host, player } = await readyScenario(t);
  assert.equal((await startScenario(host, player)).status, 200);
  const intro = await readSession(host);
  assert.equal((await scenarioInput(host, player, { kind: 'ack' })).status, 200);
  const placement = await readSession(host);
  assert.equal(
    (
      await scenarioInput(
        host,
        player,
        { kind: 'ack' },
        { expectedRevision: placement.revision },
        intro,
      )
    ).status,
    409,
  );
  assert.equal(
    (await scenarioInput(host, player, { kind: 'ack' }, { heroId: 'hero-2' })).status,
    409,
  );
  assert.equal(
    (await scenarioInput(host, player, { kind: 'ack' }, { sourceFingerprint: '0'.repeat(64) }))
      .status,
    409,
  );
  assert.deepEqual(await readSession(host), placement);
  assert.equal((await scenarioInput(host, player, { kind: 'ack' })).status, 200);
  const scout = await readSession(host),
    requestId = 'same-scout-request-0000000001';
  const responses = await Promise.all([
    scenarioInput(host, player, { kind: 'scout-reveal' }, { requestId }, scout),
    scenarioInput(host, player, { kind: 'scout-reveal' }, { requestId }, scout),
  ]);
  assert.deepEqual(
    responses.map((r) => r.status),
    [200, 200],
  );
  const opened = await readSession(host);
  assert.equal(opened.scout.revealed.length, 2);
  assert.equal(opened.scenario.commands.filter((c) => c.kind === 'scout-reveal').length, 1);
  const wrong = await scenarioInput(host, player, { kind: 'ack' }, { requestId }, scout);
  assert.equal(wrong.status, 409);
  assert.deepEqual(await readSession(host), opened);
});
test('initialization segue anche FINISHED di uno stato senza azioni', async (t) => {
  const { host, player, pack } = await readyScenario(t, (p) => {
    const d = p.definitions.find((d) => d.source === p.manifest.prefabs[0].fsmSource);
    d.states.find((s) => s.index === 8).transitions.FINISHED = 9;
    d.states.push({ index: 9, actions: [], transitions: { FINISHED: 0 } });
  });
  assert.equal((await startScenario(host, player)).status, 200);
  const sc = (await readSession(host)).scenario;
  assert.equal(
    sc.instances.find((i) => i.definition === pack.manifest.prefabs[0].fsmSource).state,
    0,
  );
});
test('un prefab auditato solo per initialization non abilita reveal di un’altra realizzazione', async (t) => {
  const { host, player } = await readyScenario(t, (p) => {
    const d = p.definitions.find((d) => d.source === p.manifest.prefabs[0].fsmSource);
    d.deferredHandlers = { REVEALED: 'reveal-not-compiled' };
    delete d.handlers.REVEALED;
  });
  const offer = await (await host.request('/api/scenario-plan')).json();
  assert.equal(offer.available, false);
  assert.equal(
    (
      await startScenario(host, player, {
        packFingerprint: 'a'.repeat(64),
        projectionFingerprint: 'b'.repeat(64),
      })
    ).status,
    409,
  );
  assert.equal((await readSession(host)).scenario, null);
});
