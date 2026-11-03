import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readyScenario, startScenario, scenarioInput } from './scenario-helper.mjs';
import { state, text, action } from './fixtures/scenario.mjs';
import { hash, diagnosticRaw, inventedFrontInput } from './fixtures/physical-fronts.mjs';
import { inventedLastStand } from './fixtures/last-stand.mjs';
import { compileLastStand, compilePhysicalFronts } from '../dist/physical-resolution-library.mjs';
import { catalogFixture } from './fixtures/catalog.mjs';
import { readSession } from './skill-test-helper.mjs';
import { command } from './preparation-helper.mjs';
export function attachEncounter(pack) {
  const prefab = pack.manifest.prefabs[0],
    d = pack.definitions.find((d) => d.source === prefab.fsmSource);
  d.initial = 0;
  d.handlers = { REVEALED: 1 };
  d.states = [
    state(0),
    state(
      1,
      [
        action(0, 'message', {
          mode: 'ordinary',
          text: text('Piazzamento inventato'),
          ignoreLog: false,
        }),
      ],
      { FINISHED: 2 },
    ),
    state(2, [action(0, 'release')], { FINISHED: 0 }),
  ];
  pack.manifest.scope = 'original-encounter-v1';
  pack.manifest.playablePrefabs = [prefab.source];
  const local = (name) => ({ scope: 'local', name });
  const a = (index, op, type, fields) => ({
    index,
    op,
    ...fields,
    origin: { type, parameterHash: hash(fields), load: 'hash-match-positional' },
  });
  d.variables.push(
    { name: 'seen', type: 'bool', value: false },
    { name: 'sum', type: 'int', value: 0 },
  );
  d.states[0].transitions['NODE CLICKED'] = 20;
  d.states.push(
    state(
      20,
      [
        a(0, 'confirm', 'FFG.JIME.Actions.DisplayMessageCancelConfirm', {
          text: text('Ricerca inventata'),
          label: text('Cerca'),
          cancelLabel: text('Annulla'),
          confirmEvent: 'YES',
          cancelEvent: 'NO',
        }),
      ],
      { YES: 21, NO: 0 },
    ),
    state(
      21,
      [action(0, 'branchBool', { ref: local('seen'), trueEvent: 'YES', falseEvent: 'NO' })],
      { YES: 24, NO: 22 },
    ),
    state(
      22,
      [
        a(0, 'sourceTest', 'FFG.JIME.Actions.DisplayMessageCancelConfirm', {
          text: text('Prova iniziale inventata'),
          stat: 'agility',
          target: 1,
          passEvent: 'YES',
          failEvent: 'NO',
        }),
      ],
      { YES: 23, NO: 29 },
    ),
    state(23, [action(0, 'set', { target: local('seen'), value: true })], { FINISHED: 24 }),
    state(
      24,
      [
        a(0, 'choice', 'FFG.JIME.Actions.DisplayMessageMultipleChoice', {
          text: text('Scelta obbligatoria inventata'),
          options: [
            { event: 'COUNT', label: text('Conta') },
            { event: 'OTHER', label: text('Alternativa') },
          ],
          cancel: null,
        }),
      ],
      { COUNT: 25, OTHER: 27 },
    ),
    state(
      25,
      [
        a(0, 'challenge', 'FFG.JIME.Actions.DisplayMessageChallenge', {
          text: text('Conteggio condiviso inventato'),
          stat: 'wisdom',
          sum: local('sum'),
          bounds: [
            { maximum: 2, event: 'LOW' },
            { maximum: 3, event: 'HIGH' },
          ],
        }),
      ],
      { LOW: 30, HIGH: 26 },
    ),
    state(
      26,
      [
        action(0, 'message', {
          mode: 'ordinary',
          text: text('Premio inventato'),
          ignoreLog: false,
        }),
        a(1, 'lore', 'FFG.JIME.Actions.AddLore', { amount: 1 }),
      ],
      { FINISHED: 32 },
    ),
    state(
      27,
      [
        a(0, 'sourceTest', 'FFG.JIME.Actions.DisplayMessageCancelConfirm', {
          text: text('Alternativa inventata'),
          stat: 'might',
          target: 9,
          passEvent: 'YES',
          failEvent: 'NO',
        }),
      ],
      { YES: 28, NO: 31 },
    ),
    state(
      28,
      [
        action(0, 'message', {
          mode: 'ordinary',
          text: text('Rimozione senza premio'),
          ignoreLog: false,
        }),
      ],
      { FINISHED: 32 },
    ),
    state(
      29,
      [
        action(0, 'message', {
          mode: 'ordinary',
          text: text('Conseguenza iniziale inventata'),
          ignoreLog: false,
          consequence: { family: 'damage', amount: 2, face: 'faceup' },
        }),
      ],
      { FINISHED: 0 },
    ),
    state(
      30,
      [
        action(0, 'message', {
          mode: 'ordinary',
          text: text('Conseguenza conteggio inventata'),
          ignoreLog: false,
          consequence: { family: 'fear', amount: 2, face: 'faceup' },
        }),
      ],
      { FINISHED: 0 },
    ),
    state(
      31,
      [
        action(0, 'message', {
          mode: 'ordinary',
          text: text('Conseguenza alternativa inventata'),
          ignoreLog: false,
          consequence: { family: 'damage', amount: 1, face: 'faceup' },
        }),
      ],
      { FINISHED: 0 },
    ),
    state(32, [action(0, 'hideNode'), action(1, 'stop')]),
  );
  return prefab;
}
export function sourceCatalog(c) {
  for (const s of c.skills) {
    s.success = 1;
    s.fate = 0;
  }
  c.heroes[1].stats.wisdom = 1;
}
export async function readyOriginal(
  t,
  edit = () => {},
  catalogEdit = sourceCatalog,
  frontEdit = () => {},
) {
  const ready = await readyScenario(
    t,
    (pack) => {
      attachEncounter(pack);
      edit(pack);
    },
    catalogEdit,
  );
  const raw = diagnosticRaw(),
    catalog = catalogFixture();
  catalogEdit(catalog);
  await writeFile(join(ready.host.dataDir, 'physical-content.json'), JSON.stringify(raw));
  const fronts = inventedFrontInput(raw);
  frontEdit(fronts, catalog);
  await writeFile(
    join(ready.host.dataDir, 'physical-fronts.json'),
    JSON.stringify(compilePhysicalFronts(raw, fronts, catalog)),
  );
  await writeFile(
    join(ready.host.dataDir, 'physical-last-stand.json'),
    JSON.stringify(compileLastStand(raw, inventedLastStand(raw))),
  );
  const r = await startScenario(ready.host, ready.player);
  assert.equal(r.status, 200, await r.text());
  for (let n = 0; n < 60; n++) {
    const s = await readSession(ready.host),
      q = s.scenario.pending;
    if (!q) return ready;
    const actor = q.actorPlayerId === ready.other.body.player.id ? ready.other : ready.player;
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
    const r = await scenarioInput(ready.host, actor, input);
    assert.equal(r.status, 200, await r.text());
  }
  assert.fail('startup did not complete');
}
export function playable(s) {
  return s.scenario.instances.find((i) =>
    s.scenario.pack.manifest.playablePrefabs.includes(i.prefab),
  );
}
export async function interact(ready, actor = ready.player, extra = {}) {
  const s = await readSession(ready.host),
    i = playable(s),
    h = s.preparation.heroes.find((h) => h.playerId === actor.body.player.id);
  return command(
    ready.host,
    actor,
    {
      type: 'INTERACT_SCENARIO',
      scenarioId: s.scenario.id,
      packFingerprint: s.scenario.packFingerprint,
      projectionFingerprint: s.scenario.projectionFingerprint,
      instanceId: i.id,
      heroId: h.heroId,
      roundId: s.round.id,
      turnId: s.round.turnId,
      sourceFingerprint: hash(i),
      ...extra,
    },
    s,
  );
}
export async function finishPhysical(ready) {
  for (let n = 0; n < 100; n++) {
    const s = await readSession(ready.host),
      q = s.scenario.pending;
    if (q?.kind !== 'physical') return s;
    const actor = q.actorPlayerId === ready.other.body.player.id ? ready.other : ready.player;
    const options = s.physical.active.options;
    const option = options.some((o) => o.id === 'reveal')
      ? 'reveal'
      : options.some((o) => o.id === 'resolve')
        ? 'resolve'
        : options.some((o) => o.id === 'close')
          ? 'close'
          : options[0].id;
    const r = await scenarioInput(ready.host, actor, { kind: 'physical-choice', option });
    assert.equal(r.status, 200, await r.text());
  }
  assert.fail('physical did not return');
}
