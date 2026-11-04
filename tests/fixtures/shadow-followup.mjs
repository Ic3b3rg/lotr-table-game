import { action, state, text } from './scenario.mjs';
import { hash } from './map-freeze.mjs';
import { compileSourceDeployment } from '../../dist/combat-library.mjs';
import { deploymentSource } from './source-deployment.mjs';

export function attachFollowup(pack, frozen) {
  const p = frozen.mapGeneration.projection;
  const local = (name) => ({ scope: 'local', name });
  const global = (name) => ({ scope: 'global', name });
  const message = (index, value) =>
    action(index, 'message', { mode: 'ordinary', text: text(value), ignoreLog: false });
  const native = (index, op, type, fields) => ({
    index,
    op,
    ...fields,
    origin: { type, parameterHash: hash(fields), load: 'hash-match-positional' },
  });
  const send = (index, definition, event) =>
    native(index, 'send', 'HutongGames.PlayMaker.Actions.SendEvent', { definition, event });
  const timer = pack.definitions.find((d) => d.source === pack.timers[0]);
  timer.variables.find((v) => v.name === 'remaining').value = 2;
  const compare = timer.states.find((s) => s.index === 42);
  delete compare.deferredTransitions;
  compare.transitions.EXPIRED = 44;
  timer.states.push(
    state(44, [message(0, 'Il tempo di prova è scaduto.')], { FINISHED: 45 }),
    state(45, [send(0, 'example.assets:810', 'EXAMPLE_CALLBACK')]),
    state(46, [action(0, 'set', { target: local('running'), value: false }), action(1, 'release')]),
  );
  timer.handlers.EXAMPLE_STOP = 46;
  pack.globals.push(
    { name: 'clueTotal', type: 'int', value: 3 },
    { name: 'companyCount', type: 'int', value: 0 },
    { name: 'poolPoints', type: 'int', value: 0 },
  );
  pack.definitions.push(
    {
      source: 'example.assets:810',
      initial: 0,
      variables: [],
      handlers: { EXAMPLE_CALLBACK: 1 },
      states: [
        state(0),
        state(
          1,
          [
            message(0, 'Il sentiero inventato continua.'),
            native(1, 'lore', 'FFG.JIME.Actions.AddLore', { amount: 2 }),
          ],
          { FINISHED: 2 },
        ),
        state(
          2,
          [
            action(0, 'section', {
              sectionId: 2,
              text: text('Colloca {tile} e il suo segnalino esplorazione.'),
            }),
          ],
          { FINISHED: 3 },
        ),
        state(
          3,
          [
            message(0, 'Annuncio inventato: zero.'),
            action(1, 'objective', {
              id: 2,
              text: text('Obiettivo inventato: {objective-count}.'),
              bindings: [{ placeholder: '{objective-count}', ref: global('clueTotal') }],
            }),
          ],
          { FINISHED: 4 },
        ),
        state(4, [send(0, timer.source, 'EXAMPLE_STOP')], { FINISHED: 5 }),
        state(5, [action(0, 'hideNode'), action(1, 'stop')]),
      ],
    },
    {
      source: 'example.assets:811',
      initial: 0,
      variables: [{ name: 'points', type: 'int', value: 0 }],
      handlers: { EXAMPLE_THRESHOLD: 1 },
      states: [
        state(0),
        state(
          1,
          [
            native(0, 'multiplyInt', 'HutongGames.PlayMaker.Actions.IntOperator', {
              target: local('points'),
              left: { kind: 'variable', ref: global('companyCount') },
              right: { kind: 'literal', value: 6 },
            }),
            native(1, 'spawnRandom', 'FFG.JIME.Actions.SpawnRandomEnemyGroups', {
              points: local('points'),
              text: text('Prova collettiva inventata prima del piazzamento.'),
              trial: {
                stat: 'agility',
                target: 2,
                failure: { family: 'damage', amount: 2, face: 'facedown' },
              },
              excludeGameEnemyPoints: false,
              filter: { MustHaveAny: 0, MustHaveAll: 0, ExcludeIfAny: 0 },
              sections: null,
            }),
          ],
          { FINISHED: 2 },
        ),
        state(2, [action(0, 'threat', { source: 'example.assets:1000', threshold: 50 })], {
          FINISHED: 3,
        }),
        state(3, [action(0, 'hideNode'), action(1, 'stop')]),
      ],
    },
  );
  pack.sources.push({ file: 'fixture.assets', sha256: hash('file') });
  const source = deploymentSource();
  source.assets.find((a) => a.source === source.adventure).source = pack.identity.adventureSource;
  source.adventure = pack.identity.adventureSource;
  const sourceFile = pack.sources.find((f) => f.file === source.adventure.split(':')[0]);
  if (!source.files.some((f) => f.file === sourceFile.file)) source.files.push(sourceFile);
  pack.manifest.followup = {
    version: 'source-shadow-followup-v1',
    projectionFingerprint: p.fingerprint,
    evidenceHash: hash('invented followup'),
    playerCountBinding: 'companyCount',
    enemyPointsBinding: 'poolPoints',
    thresholdEvent: 'EXAMPLE_THRESHOLD',
    instances: [
      {
        gameObject: 'example.assets:812',
        definition: 'example.assets:810',
        kind: 'logic',
        hasNode: false,
        initializationHash: hash('logic startup'),
        lifecycleHash: hash('logic lifecycle'),
      },
      {
        gameObject: 'example.assets:813',
        definition: 'example.assets:811',
        kind: 'threat',
        hasNode: false,
        initializationHash: hash('threat startup'),
        lifecycleHash: hash('threat lifecycle'),
      },
    ],
    thresholds: [
      { source: 'example.assets:999', definition: 'example.assets:811' },
      { source: 'example.assets:1000', definition: null },
    ],
    deployment: compileSourceDeployment(source),
    deploymentText: text('Colloca {count} {enemy}.'),
    explorationNodes: p.sections.flatMap((s) =>
      s.tiles.map((t, index) => ({
        tileSource: t.source,
        source: `example.assets:${20000 + s.id * 100 + index}`,
        position: t.worldPosition,
      })),
    ),
    explorationText: {
      single: text('Colloca il segnalino esplorazione.'),
      plural: text('Colloca i segnalini esplorazione.'),
    },
  };
}
