import { catalogFixture } from './fixtures/catalog.mjs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readyGenerator, generate, waitGeneration } from './map-generation-helper.mjs';
import { addEncounter, fixed } from './fixtures/map-encounters.mjs';
import { scenarioFixture, state, action, text } from './fixtures/scenario.mjs';
import { hash } from './fixtures/map-freeze.mjs';
import { command } from './preparation-helper.mjs';
import { readSession } from './skill-test-helper.mjs';
export function scenarioFor(p) {
  const pack = scenarioFixture();
  pack.identity.adventureSource = p.context.adventureSource;
  pack.sources = p.provenance.files;
  const second = p.sections.find((s) => s.id === 0).tiles[1];
  const st = { kind: 'start' },
    custom = { kind: 'hash', value: second.hashId };
  const msg = (mode, value) => ({ mode, text: text(value), ignoreLog: false });
  pack.definitions[0].states = [
    state(0),
    state(1, [action(0, 'threat', { source: 'example.assets:999', threshold: 15 })], {
      FINISHED: 2,
    }),
    state(2, [action(0, 'message', msg('ordinary', 'Introduzione inventata'))], { FINISHED: 3 }),
    state(
      3,
      [
        action(0, 'getStart', { target: { scope: 'local', name: 'start' } }),
        action(1, 'revealTile', { tile: st }),
        action(2, 'message', msg('tile', 'Colloca la prima tessera')),
      ],
      { FINISHED: 4 },
    ),
    state(
      4,
      [
        action(0, 'message', msg('scout', 'Ogni eroe effettua Scoperta 2')),
        action(1, 'highlight', { tile: st, spaceIndex: 1 }),
      ],
      { FINISHED: 5 },
    ),
    state(
      5,
      [action(0, 'explore', { tile: st, noInspiration: true, skipIntro: true, skipOutro: true })],
      { FINISHED: 6 },
    ),
    state(
      6,
      [
        action(0, 'revealTile', { tile: custom }),
        action(1, 'message', msg('tile', 'Colloca la seconda tessera')),
      ],
      { FINISHED: 7 },
    ),
    state(
      7,
      [
        action(0, 'explore', {
          tile: custom,
          noInspiration: false,
          skipIntro: true,
          skipOutro: true,
        }),
      ],
      { FINISHED: 8 },
    ),
    state(
      8,
      [action(0, 'section', { sectionId: 1, text: text('Colloca {tile} nella sezione rivelata') })],
      { FINISHED: 9 },
    ),
    state(9, [action(0, 'message', msg('spirit', 'Ogni eroe effettua Spirito 1'))], {
      FINISHED: 10,
    }),
    state(
      10,
      [
        action(0, 'objective', { id: 0, text: text('Obiettivo inventato') }),
        action(1, 'message', msg('objective', 'Obiettivo inventato')),
      ],
      { FINISHED: 11 },
    ),
    state(11, [action(0, 'release')]),
  ];
  pack.globals.push(
    { name: 'boundTile', type: 'int', value: -1 },
    { name: 'boundPosition', type: 'vector', value: [0, 0, 0] },
  );
  pack.timers = ['example.assets:800'];
  pack.definitions = [
    pack.definitions[0],
    {
      source: pack.timers[0],
      initial: 0,
      variables: [
        { name: 'running', type: 'bool', value: false },
        { name: 'flipped', type: 'bool', value: false },
      ],
      handlers: { PERSON_REVEALED: 2 },
      states: [
        state(0, [action(0, 'set', { target: { scope: 'local', name: 'running' }, value: true })], {
          FINISHED: 1,
        }),
        state(1),
        state(2, [action(0, 'flip', { target: { scope: 'local', name: 'flipped' } })], {
          FINISHED: 1,
        }),
      ],
    },
  ];
  pack.manifest.prefabs = p.assignments.map((a, i) => {
    const source = `example.assets:${900 + i}`;
    const hidden = i === 1,
      person = i === 2;
    const states = hidden
      ? [
          state(0),
          state(
            1,
            [
              action(0, 'branchBool', {
                ref: { scope: 'local', name: 'gate' },
                trueEvent: 'TRUE',
                falseEvent: 'FALSE',
              }),
            ],
            { TRUE: 2, FALSE: 3 },
          ),
          state(2, [action(0, 'revealNode'), action(1, 'release')], { FINISHED: 0 }),
          state(3, [action(0, 'release')], { FINISHED: 0 }),
        ]
      : [
          state(0),
          state(
            1,
            [
              action(
                0,
                'message',
                msg(
                  'ordinary',
                  person ? 'Colloca la persona inventata' : 'Colloca il segnalino inventato',
                ),
              ),
            ],
            { FINISHED: 2 },
          ),
          state(
            2,
            person
              ? [action(0, 'broadcast', { event: 'PERSON_REVEALED' }), action(1, 'release')]
              : [action(0, 'release')],
            { FINISHED: 0 },
          ),
        ];
    // A distinct initialization path proves bindings happen before SCENARIO_BEGIN.
    if (i === 0) {
      states.push(
        state(
          8,
          [
            action(0, 'getTile', { target: { scope: 'global', name: 'boundTile' } }),
            action(1, 'getPosition', { target: { scope: 'global', name: 'boundPosition' } }),
          ],
          { FINISHED: 0 },
        ),
      );
    }
    pack.definitions.push({
      source,
      initial: i === 0 ? 8 : 0,
      variables: hidden ? [{ name: 'gate', type: 'bool', value: false }] : [],
      handlers: hidden ? { PRE_REVEAL: 1 } : { REVEALED: 1 },
      states,
    });
    return {
      ...scenarioFixture().manifest.prefabs[0],
      source: a.prefab.source,
      modelSource: a.modelSource,
      encounterId: a.encounterId,
      fsmSource: source,
      nodeSource: `example.assets:${1000 + i}`,
      nodeType: person ? 'person' : 'threat',
      initializationHash: hash(['init', i]),
      closureHash: hash(states),
    };
  });
  return pack;
}
export async function readyScenario(t, edit = () => {}, catalogEdit = () => {}) {
  const directory = await mkdtemp(join(tmpdir(), 'lotr-scenario-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const scenarioPath = join(directory, 'scenario.json');
  const catalog = catalogFixture();
  catalogEdit(catalog);
  const ready = await readyGenerator(
    t,
    (raw) => {
      const input = {
        assembly: { selection: raw.template.selection },
        placement: raw.template.placement,
      };
      fixed(input, 0, 0, addEncounter(input), 1);
      fixed(input, 0, 1, addEncounter(input), 0);
      for (const tile of raw.template.geometry.tiles)
        for (const h of tile.hexes) {
          h.render.polygon = Array.from({ length: 6 }, (_, i) => [
            Math.fround(Math.cos((i * Math.PI) / 3)),
            Math.fround(Math.sin((i * Math.PI) / 3)),
            0,
          ]);
          h.render.uv = Array.from({ length: 6 }, () => [0, 0]);
        }
    },
    { LOTR_SCENARIO_PACK: scenarioPath },
    catalog,
  );
  if ((await generate(ready.host, ready.player)).status !== 200)
    throw Error('fixture generation failed');
  const frozen = await waitGeneration(ready.host);
  const pack = scenarioFor(frozen.mapGeneration.projection);
  edit(pack, frozen);
  await writeFile(scenarioPath, JSON.stringify(pack));
  return { ...ready, pack, scenarioPath, frozen };
}
export async function startScenario(host, player, overrides = {}) {
  const offer = await (await host.request('/api/scenario-plan')).json();
  return command(host, player, {
    type: 'START_SCENARIO',
    packFingerprint: offer.packFingerprint,
    projectionFingerprint: offer.projectionFingerprint,
    agreed: true,
    ...overrides,
  });
}
export async function scenarioInput(host, player, input, overrides = {}, at) {
  const s = at ?? (await readSession(host)),
    sc = s.scenario,
    q = sc.pending;
  return command(
    host,
    player,
    {
      type: 'SCENARIO_INPUT',
      scenarioId: sc.id,
      packFingerprint: sc.packFingerprint,
      projectionFingerprint: sc.projectionFingerprint,
      pendingId: q.id,
      sourceFingerprint: q.fingerprint,
      heroId: q.heroId,
      input,
      ...overrides,
    },
    s,
  );
}
