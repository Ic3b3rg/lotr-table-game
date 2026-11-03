import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { readyCycle, cycleCommand } from './physical-cycle-helper.mjs';
import { readSession, readBackup } from './skill-test-helper.mjs';
import { command } from './preparation-helper.mjs';
import { compileLastStand } from '../dist/physical-resolution-library.mjs';
import { diagnosticRaw, suffer } from './fixtures/physical-resolution.mjs';
import { inventedLastStand } from './fixtures/last-stand.mjs';
import { startHost } from './host-helper.mjs';

test('an ordinary legacy gate continues at the saved end-turn boundary and replays all earlier rules unchanged', async (t) => {
  const ready = await readyCycle(
    t,
    (ir) => {
      for (const d of ir.definitions.filter((d) => d.cardId.includes('damage')))
        d.persistent = [
          {
            op: 'suffer',
            window: 'end-own-turn',
            hero: 'self',
            family: 'fear',
            n: 1,
            face: 'normal',
          },
        ];
    },
    (_pack, pr) => {
      pr.children = [{ ...suffer(0, 1, 0), face: 'faceup' }, suffer(0, 0, 4)];
    },
  );
  let host = ready.host;
  t.after(() => host.stop());
  for (const type of ['START_TURN', 'END_TURN']) {
    const r = await cycleCommand(ready, type);
    assert.equal(r.status, 200, await r.text());
  }
  const before = await readBackup(host),
    at = await readSession(host);
  assert.equal(at.physical.active.reason, 'last-stand-unavailable');
  assert.equal(at.round.heroes[0].turnEnded, false);
  const path = join(host.dataDir, 'physical-last-stand.json'),
    raw = diagnosticRaw();
  await writeFile(path, JSON.stringify(compileLastStand(raw, inventedLastStand(raw))));
  const { type: _, ...q } = at.physical.cycle.pending;
  let r = await command(host, ready.player, {
    type: 'CYCLE_INPUT',
    ...q,
    input: { kind: 'physical-continue-last-stand', rules: 'source-last-stand-v1' },
  });
  assert.equal(r.status, 200, await r.text());
  const opened = await readBackup(host);
  assert.deepEqual(opened.payload.state.physical.runs[0], before.payload.state.physical.runs[0]);
  for (const key of ['decks', 'areas', 'random', 'rngCursor'])
    assert.deepEqual(
      opened.payload.state.physical.snapshot[key],
      before.payload.state.physical.snapshot[key],
    );
  assert.deepEqual(
    opened.payload.state.physical.snapshot.resolution.resources,
    before.payload.state.physical.snapshot.resolution.resources,
  );
  await host.stop('SIGKILL');
  for (const p of [
    ready.scenarioPath,
    ready.physicalPath,
    path,
    join(host.dataDir, 'physical-fronts.json'),
  ])
    await rm(p);
  host = await startHost({ LOTR_DATA_DIR: host.dataDir });
  assert.deepEqual((await readBackup(host)).payload, opened.payload);
  for (const option of ['reveal', 'resolve']) {
    const current = await readSession(host),
      { type: _, ...binding } = current.physical.cycle.pending;
    r = await command(host, ready.player, {
      type: 'CYCLE_INPUT',
      ...binding,
      input: { kind: 'physical-choice', option },
    });
    assert.equal(r.status, 200, await r.text());
  }
  const done = await readSession(host);
  assert.equal(done.round.heroes[0].turnEnded, true);
  assert.equal(done.physical.parents.at(-1).returnCount, 1);
  assert.equal(done.physical.lastStand.heroes[0].defeated, true);
});
