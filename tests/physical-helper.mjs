import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readyScenario, startScenario, scenarioInput } from './scenario-helper.mjs';
import { state, text } from './fixtures/scenario.mjs';
import { program, suffer, grant, discard, diagnosticRaw } from './fixtures/physical-resolution.mjs';
import { hash } from './fixtures/map-freeze.mjs';
import { readSession } from './skill-test-helper.mjs';

export async function readyPhysical(t, edit = () => {}, catalogEdit = () => {}) {
  const ready = await readyScenario(
    t,
    (pack) => {
      const pr = program([suffer(0, 3, 2, [grant()]), suffer(1, 1, 1), discard()]);
      pr.initialCredits = [1, 1];
      pr.limits = pr.limits.slice(0, 2);
      pack.name = 'Prova sintetica P0 — dati inventati';
      pack.manifest.scope = 'synthetic-physical-p0';
      pack.definitions[0].states.find((s) => s.index === 9).transitions.FINISHED = 12;
      pack.definitions[0].states.push(
        state(
          12,
          [
            {
              index: 0,
              op: 'physical',
              origin: {
                type: 'Synthetic.PhysicalProgram',
                parameterHash: hash(pr),
                load: 'hash-match-positional',
              },
              text: text('Prova sintetica: risolvete le conseguenze coperte inventate.'),
              program: pr,
            },
          ],
          { FINISHED: 10 },
        ),
      );
      edit(pack, pr);
    },
    catalogEdit,
  );
  const physicalPath = join(ready.host.dataDir, 'physical-content.json');
  await writeFile(physicalPath, JSON.stringify(diagnosticRaw()));
  return { ...ready, physicalPath };
}
export async function reachPhysical(ready) {
  const { host, player, other } = ready;
  const start = await startScenario(host, player);
  assert.equal(start.status, 200, await start.text());
  for (let n = 0; n < 45; n++) {
    const s = await readSession(host),
      q = s.scenario.pending;
    if (q.kind === 'physical') return s;
    const actor = q.actorPlayerId === other.body.player.id ? other : player;
    const input =
      q.kind === 'scout'
        ? q.stage === 'ready'
          ? { kind: 'scout-reveal' }
          : {
              kind: 'scout-resolve',
              prepareCopy: null,
              top: s.scout.revealed,
              bottom: [],
              discardPreparedCopy: null,
            }
        : q.kind === 'test'
          ? { kind: q.stage === 'ready' ? 'test-reveal' : 'test-resolve' }
          : { kind: 'ack' };
    const r = await scenarioInput(host, actor, input);
    assert.equal(r.status, 200, await r.text());
  }
  assert.fail('No physical request reached.');
}
