// Entirely invented graph, packets, model identities and evidence. No original IR.
import { state, action, text } from './scenario.mjs';
import { clueCompilerFixture, native, message, local, literal } from './clue-progression.mjs';
import { attachRounds } from './source-rounds.mjs';
import { attachFollowup } from './shadow-followup.mjs';
import { attachFailure } from './adventure-failure.mjs';
import { certificates } from './exploration.mjs';
import { attachCombat } from '../combat-controller-helper.mjs';
import { compileSourceDeployment } from '../../dist/combat-library.mjs';
import { hash } from './map-freeze.mjs';

export function attachMission(pack, frozen, target = pack.manifest.prefabs[0]) {
  const p = frozen.mapGeneration.projection,
    principal = pack.definitions.find((d) => d.source === pack.principal),
    timer = pack.definitions.find((d) => d.source === pack.timers[0]),
    logic = pack.definitions.find(
      (d) => d.source === pack.manifest.followup.instances[0].definition,
    );
  if (pack.manifest.playablePrefabs.includes(target.source)) {
    const old = structuredClone(pack.definitions.find((d) => d.source === target.fsmSource));
    old.source = 'example.assets:99700';
    pack.definitions.push(old);
    pack.manifest.prefabs.push({
      ...structuredClone(target),
      source: 'example.assets:99701',
      fsmSource: old.source,
    });
    pack.manifest.playablePrefabs = ['example.assets:99701'];
  }
  const events = {
    normal: 'EXAMPLE_DEPLOY',
    variant: 'EXAMPLE_DEPLOY_ATTACK',
    arm: 'EXAMPLE_ARM',
    revealed: 'EXAMPLE_VISIBLE',
    defeated: 'EXAMPLE_CALLBACK',
    escape: 'EXAMPLE_STOP',
    hide: 'EXAMPLE_HIDE',
  };
  const d = {
    source: target.fsmSource,
    initial: 0,
    variables: [],
    handlers: { REVEALED: 1, [events.hide]: 30 },
    deferredHandlers: {},
    states: [
      state(0, [], { 'NODE CLICKED': 10 }),
      state(1, [message(0, 'Colloca il segnalino del presidio inventato.')], { FINISHED: 2 }),
      state(2, [action(0, 'broadcast', { event: events.revealed }), action(1, 'release')], {
        FINISHED: 0,
      }),
      state(
        10,
        [
          native(0, 'choice', 'FFG.JIME.Actions.DisplayMessageMultipleChoice', {
            text: text('Il presidio inventato attende una decisione.'),
            options: ['TALK', 'PUSH', 'SLIP'].map((event, n) => ({
              event,
              label: text(
                ['Parla · 1 azione', 'Forza il passaggio · 1 azione', 'Scivola oltre · 1 azione'][
                  n
                ],
              ),
              cost: 'interact',
            })),
            cancel: { event: 'CANCEL', label: text('Annulla') },
          }),
        ],
        { TALK: 11, PUSH: 12, SLIP: 13, CANCEL: 0 },
      ),
      state(11, [message(0, 'Il dialogo inventato concede 1 ispirazione.', { inspiration: 1 })], {
        FINISHED: 24,
      }),
      state(
        12,
        [
          native(0, 'challenge', 'FFG.JIME.Actions.DisplayMessageChallenge', {
            text: text('Prova inventata di Forza.'),
            stat: 'might',
            sum: literal(0),
            bounds: [0, 2, 3].map((maximum, n) => ({
              maximum,
              event: ['EMPTY', 'SOME', 'FULL'][n],
            })),
          }),
        ],
        { EMPTY: 14, SOME: 15, FULL: 16 },
      ),
      state(
        13,
        [
          native(0, 'challenge', 'FFG.JIME.Actions.DisplayMessageChallenge', {
            text: text('Prova inventata di Agilità.'),
            stat: 'agility',
            sum: literal(0),
            bounds: [0, 1].map((maximum, n) => ({ maximum, event: n ? 'QUIET' : 'NOISE' })),
          }),
        ],
        { NOISE: 17, QUIET: 18 },
      ),
      state(
        14,
        [
          message(0, 'Una minaccia inventata causa 2 paure.', {
            consequence: { family: 'fear', amount: 2, face: 'faceup' },
          }),
        ],
        { FINISHED: 24 },
      ),
      state(15, [message(0, 'Il presidio inventato si prepara.')], { FINISHED: 24 }),
      state(16, [message(0, 'Ottieni il beneficio inventato.', { boon: 'emboldened' })], {
        FINISHED: 25,
      }),
      state(17, [message(0, 'Il passaggio inventato è rumoroso.')], { FINISHED: 24 }),
      state(18, [message(0, 'Ottieni il nascondiglio inventato.', { boon: 'hidden' })], {
        FINISHED: 24,
      }),
      state(24, [action(0, 'broadcast', { event: events.normal })], { FINISHED: 26 }),
      state(25, [action(0, 'broadcast', { event: events.variant })], { FINISHED: 26 }),
      state(26, [action(0, 'broadcast', { event: events.arm })], { FINISHED: 27 }),
      state(27, [action(0, 'broadcast', { event: events.revealed })], { FINISHED: 30 }),
      state(30, [action(0, 'hideNode')], { FINISHED: 31 }),
      state(31),
    ],
  };
  pack.definitions[pack.definitions.findIndex((d) => d.source === target.fsmSource)] = d;
  target.inspection = text('Un presidio inventato lungo il cammino.');
  target.nodeType = 'person';
  target.sourceNodeType = 1;
  const space =
      p.spaces.find(
        (s) => s.id === p.assignments.find((a) => a.prefab.source === target.source)?.spaceId,
      ) ?? p.spaces[0],
    tile = p.sections.flatMap((s) => s.tiles).find((t) => t.source === space.tileSource);
  principal.handlers[events.normal] = 170;
  principal.handlers[events.variant] = 171;
  for (const [index, grant] of [
    [170, false],
    [171, true],
  ])
    principal.states.push(
      state(
        index,
        [
          native(0, 'spawnFixed', 'FFG.JIME.Actions.SpawnEnemyGroup', {
            model: 'fixture.assets:10',
            logic: logic.source,
            spaceId: space.id,
            size: 2,
            additionalPoints: 13,
            ignoreCost: false,
            randomBonuses: false,
            bonuses: [],
            text: text(
              grant
                ? 'Colloca due sentinelle inventate. Puoi attaccarle senza altra azione.'
                : 'Colloca due sentinelle inventate.',
            ),
            grant,
            successEvent: 'FINISHED',
            failureEvent: 'FINISHED',
          }),
        ],
        { FINISHED: 172 },
      ),
    );
  principal.states.push(
    state(
      172,
      [
        action(0, 'objective', { id: 4, text: text('Supera il presidio inventato.') }),
        message(1, 'Supera il presidio inventato.'),
      ],
      { FINISHED: 0 },
    ),
  );
  timer.variables.push(
    { name: 'armed', type: 'bool', value: false },
    { name: 'visible', type: 'bool', value: false },
  );
  timer.handlers[events.arm] = 90;
  timer.handlers[events.revealed] = 91;
  timer.states.push(
    state(90, [action(0, 'set', { target: local('armed'), value: true })], { FINISHED: 43 }),
    state(91, [action(0, 'flip', { target: local('visible') })], { FINISHED: 43 }),
    state(
      94,
      [action(0, 'branchBool', { ref: local('armed'), trueEvent: 'ARMED', falseEvent: 'OTHER' })],
      { ARMED: 95, OTHER: 98 },
    ),
    state(95, [message(0, 'Le sentinelle inventate fuggono.')], { FINISHED: 96 }),
    state(
      96,
      [
        native(0, 'removeEnemies', 'FFG.JIME.Actions.EnemyGroupRemoveAll', {}),
        native(1, 'send', 'HutongGames.PlayMaker.Actions.SendEvent', {
          definition: logic.source,
          event: events.defeated,
        }),
      ],
      { FINISHED: 97 },
    ),
    state(97),
    state(
      98,
      [action(0, 'branchBool', { ref: local('visible'), trueEvent: 'YES', falseEvent: 'NO' })],
      { YES: 99, NO: 43 },
    ),
    state(
      99,
      [
        action(0, 'broadcast', { event: events.hide }),
        message(1, 'Il presidio inventato è abbandonato.'),
      ],
      { FINISHED: 100 },
    ),
    state(
      100,
      [
        native(0, 'send', 'HutongGames.PlayMaker.Actions.SendEvent', {
          definition: logic.source,
          event: events.defeated,
        }),
      ],
      { FINISHED: 97 },
    ),
  );
  timer.states.find((s) => s.index === 42).transitions.EXPIRED = 94;
  timer.variables.find((v) => v.name === 'remaining').value = 2;
  const cap = {
    version: 'source-first-combat-v1',
    prefab: target.source,
    prefabHash: hash(target),
    projectionFingerprint: p.fingerprint,
    evidenceHash: hash('invented mission evidence'),
    definitions: [d, principal, timer, logic].map((v, n) => ({
      role: ['person', 'principal', 'timer', 'logic'][n],
      source: v.source,
      definitionHash: hash(v),
      objectHash: hash(v.source),
      lifecycleHash: hash('invented lifecycle'),
      certificateHash: hash('pending'),
    })),
    model: { source: 'fixture.assets:10', objectHash: hash('fixture.assets:10') },
    pose: {
      gameObject: `${pack.sources[0].file}:98001`,
      tileSource: tile.source,
      tileModel: tile.modelSource,
      tileHash: tile.hashId,
      spaceSource: space.source,
      spaceId: space.id,
      index: 0,
      evidenceHash: hash('invented realized pose'),
    },
    configuration: {
      ownedProductIds: [0],
      difficulty: 'normal',
      mapType: 'journey',
      initialPending: [],
      initialReserved: [],
      physicalInventoryPerType: null,
    },
    events,
    bindings: { timerValue: 'remaining', armed: 'armed', revealed: 'visible', running: 'running' },
    combatFingerprint: pack.manifest.combat.fingerprint,
    followupFingerprint: hash(pack.manifest.followup),
    roundsFingerprint: hash(pack.manifest.rounds),
    failureFingerprint: hash(pack.manifest.failure ?? null),
  };
  pack.manifest.firstCombat = cap;
  sealMission(pack);
  return cap;
}
export function sealMission(pack) {
  const cap = pack.manifest.firstCombat;
  cap.prefabHash = hash(pack.manifest.prefabs.find((p) => p.source === cap.prefab));
  for (const row of cap.definitions)
    pack.definitions.find((d) => d.source === row.source).deferredHandlers ??= {};
  const cs = certificates(pack);
  for (const row of pack.manifest.followup.instances) {
    const d = pack.definitions.find((d) => d.source === row.definition);
    row.lifecycleHash = cs.find((c) => c.source === row.definition).lifecycleHash;
    row.initializationHash = hash({
      definition: d.source,
      initial: d.initial,
      variables: d.variables,
      actions: d.states.find((s) => s.index === d.initial).actions,
    });
  }
  for (const row of cap.definitions) {
    row.definitionHash = hash(pack.definitions.find((d) => d.source === row.source));
    const c = cs.find((c) => c.source === row.source);
    row.objectHash = c.objectHash;
    row.lifecycleHash = c.lifecycleHash;
    row.certificateHash = hash(c);
  }
  cap.combatFingerprint = pack.manifest.combat.fingerprint;
  cap.followupFingerprint = hash(pack.manifest.followup);
  cap.roundsFingerprint = hash(pack.manifest.rounds);
  cap.failureFingerprint = hash(pack.manifest.failure ?? null);
}
export function attachMissionCombat(pack, frozen, target, catalogEdit, sourceEdit = () => {}) {
  attachCombat(
    pack,
    frozen,
    (src) => {
      for (const m of [src.assets, pack.manifest.followup.deployment.source.assets].map((a) =>
        a.find((m) => m.source === 'fixture.assets:10'),
      )) {
        m.data.Costs[1].Cost = 13;
        m.dataHash = hash(m.data);
      }
      pack.manifest.followup.deployment = compileSourceDeployment(
        pack.manifest.followup.deployment.source,
      );
      src.deploymentFingerprint = pack.manifest.followup.deployment.fingerprint;
      sourceEdit(src, pack, frozen);
    },
    catalogEdit,
  );
  return attachMission(pack, frozen, target);
}
export function missionCompilation() {
  const pack = clueCompilerFixture();
  pack.timers = ['example.assets:809'];
  pack.definitions.push({
    source: pack.timers[0],
    initial: 0,
    variables: [{ name: 'running', type: 'bool', value: false }],
    handlers: {},
    deferredHandlers: {},
    states: [
      state(0, [action(0, 'set', { target: local('running'), value: true })], { FINISHED: 1 }),
      state(1),
    ],
  });
  const projection = {
      fingerprint: hash('invented projection'),
      assignments: [],
      context: { heroes: [], ownedProductIds: [0] },
      spaces: [
        {
          id: 'example-space',
          source: 'example.assets:502',
          tileSource: 'example.assets:501',
          index: 0,
        },
      ],
      sections: [
        {
          id: 0,
          tiles: [
            {
              source: 'example.assets:501',
              modelSource: 'example.assets:503',
              hashId: 501,
              worldPosition: [0, 0, 0],
            },
          ],
        },
      ],
    },
    frozen = { mapGeneration: { projection }, preparation: { heroes: [] } };
  attachRounds(pack, projection);
  attachFollowup(pack, frozen);
  attachFailure(pack);
  attachMissionCombat(pack, frozen);
  return {
    pack,
    certificates: certificates(pack),
    ...Object.fromEntries(
      ['rounds', 'followup', 'clues', 'failure', 'firstCombat'].map((k) => [
        k + 'Certificate',
        { instructionHash: hash(pack.manifest[k]) },
      ]),
    ),
  };
}
