// Entirely invented, finite three-owner authority. No original State, card text or source asset.
import { compileCombatClosure, compileSourceDeployment } from '../../dist/combat-library.mjs';
import { attachActivationSource } from './shadow-activations.mjs';
import { action, state, text } from './scenario.mjs';
import { certificates } from './exploration.mjs';
import { native } from './clue-progression.mjs';
import { hash } from './map-freeze.mjs';
import { sha } from './combat-closure.mjs';

const local = (name) => ({ scope: 'local', name });
const global = (name) => ({ scope: 'global', name });
const literal = (value) => ({ kind: 'literal', value });
const variable = (ref) => ({ kind: 'variable', ref });
const variableDef = (name, value) => ({
  name,
  type: typeof value === 'boolean' ? 'bool' : 'int',
  value,
});
const say = (value, extra = {}) =>
  action(0, 'message', { mode: 'ordinary', text: text(value), ignoreLog: false, ...extra });
const end = (n) => state(n, [action(0, 'hideNode'), action(1, 'stop')]);

export function attachBattleRounds(departure, src, _pack, frozen) {
  departure.reserved = [{ source: 'fixture.assets:11', count: 1 }];
  departure.reservedEliteBanners = 1;
  const namedRaw = departure.deployment.assets.find((a) => a.source === 'fixture.assets:12');
  Object.assign(namedRaw.data, {
    Activations: [70, 71].map((m_PathID) => ({ m_FileID: 0, m_PathID })),
    SpecialActivations: [],
    MaxUnitCount: 1,
    Health: 8,
    Armor: 2,
    LinkedEnemyId: 11,
  });
  namedRaw.dataHash = hash(namedRaw.data);
  const frozenDeployment = compileSourceDeployment(departure.deployment);
  departure.deploymentHash = hash(frozenDeployment);
  departure.combat.deploymentFingerprint = frozenDeployment.fingerprint;
  src.deploymentFingerprint = frozenDeployment.fingerprint;
  attachActivationSource(src, [departure.target.model]);
  const shadow = structuredClone(src.shadow);
  delete src.shadow;
  // Two initial models intentionally share instructions, as legal source references do.
  const base = compileCombatClosure(src);
  departure.combat.combat = base;
  const combat = structuredClone(src),
    named = structuredClone(
      departure.deployment.assets.find((a) => a.source === 'fixture.assets:12'),
    );
  named.data.Activations = [70, 71].map((m_PathID) => ({ m_FileID: 0, m_PathID }));
  named.data.SpecialActivations = [];
  named.data.MaxUnitCount = 1;
  named.data.Health = 8;
  named.data.Armor = 2;
  named.dataHash = hash(named.data);
  combat.models.push(named.source);
  combat.assets.push(named);
  for (const [key, value] of [
    [named.data.KeySingular, 'Avversario nominato inventato'],
    [named.data.KeyPlural, 'Avversari nominati inventati'],
  ])
    combat.texts.push({
      key,
      value,
      file: combat.files[0].file,
      locator: `Invented!${key}`,
      sha256: sha(value),
    });
  const extra = structuredClone(combat.assets.find((a) => a.cls === 'EnemyBonusModel'));
  extra.source = 'fixture.assets:31';
  extra.objectHash = hash(extra.source);
  Object.assign(extra.data, {
    Physical: 1,
    Fear: 1,
    Health: 0,
    Armor: 0,
    Sorcery: 0,
    BlocksModifiers: 0,
    Traits: 0,
  });
  extra.dataHash = hash(extra.data);
  combat.assets.push(extra);
  for (const [n, key] of [
    [70, 'named-boons'],
    [71, 'extra'],
  ]) {
    const a = structuredClone(src.assets.find((a) => a.cls === 'EnemyActivationModel'));
    a.source = `fixture.assets:${n}`;
    a.objectHash = hash(a.source);
    Object.assign(a.data, {
      MinGroupSize: 1,
      MaxGroupSize: 1,
      KeyAttackAdditionalEffect: key,
      Damage: [{ Size: 1, Physical: 3, Fear: 1 }],
    });
    a.dataHash = hash(a.data);
    combat.assets.push(a);
  }
  const body = 'Invented: discard every boon after this attack.';
  combat.texts.push({
    key: 'named-boons',
    value: body,
    file: combat.files[0].file,
    locator: 'Invented!named',
    sha256: sha(body),
  });
  combat.additions.push({
    key: 'named-boons',
    textHash: sha(body),
    predicate: 'always',
    window: 'after-enemy-attack',
    effect: { op: 'discard-boons' },
  });
  const assemblyHash = departure.deployment.mechanics.assemblyHash,
    method = (name, n) => ({
      assemblyHash,
      method: `0600${n.toString(16).padStart(4, '0')}`,
      bodyHash: hash(['invented method', name]),
    }),
    controller = method('controller', 200);
  combat.shadow = {
    ...shadow,
    version: 'source-battle-shadow-v1',
    controller: {
      ...controller,
      normalDifficulty: 0,
      enemyPointsPerHero: 0,
      difficultyEvidenceHash: hash('invented normal difficulty'),
    },
    battle: {
      boardFingerprint: departure.boardFingerprint,
      model: departure.target.model,
      principal: departure.target.principal,
      evidenceHash: hash('invented battle context'),
    },
  };
  combat.shadow.instructions = [
    ...new Set(combat.assets.filter((a) => a.cls === 'EnemyActivationModel').map((a) => a.source)),
  ].map((source) => ({
    source,
    movement: 1,
    alternativeMovement: source.endsWith(':70') || source.endsWith(':71') ? 3 : 2,
    alternativeDestination: 'hero',
    ...(source.endsWith(':70') || source.endsWith(':71')
      ? { alternativeTarget: 'highest-might' }
      : {}),
    evidenceHash: hash(['invented policy', source]),
  }));
  const logicSources = [830, 831, 832].map((n) => `example.assets:${n}`),
    recipes = ['invented-captain', 'invented-named-2', 'invented-named-3'];
  combat.scriptedGroups = recipes.map((key, n) => ({
    key,
    model: n ? named.source : 'fixture.assets:11',
    bonuses: n
      ? ['fixture.assets:31', 'fixture.assets:30']
      : ['fixture.assets:30', 'fixture.assets:31'],
    logic: logicSources[n],
    sourceGroup: n ? `example.assets:${840 + n}` : null,
    objectHash: hash(['invented preset', n]),
    baseStats: [{ health: n ? 5 : 4, armor: n === 2 ? 1 : n === 1 ? 3 : 1, sorcery: 0 }],
  }));
  const heroIds = frozen.preparation.heroes.map((h) => h.heroId),
    H = heroIds.length,
    principal = structuredClone(departure.combat.terminal.definition),
    principalSource = departure.target.principal,
    cap = {
      version: 'source-battle-rounds-v1',
      evidenceHash: hash('invented complete phase closure'),
      boardFingerprint: departure.boardFingerprint,
      baseCombatFingerprint: base.fingerprint,
      heroIds,
      model: departure.combat.model,
      adventure: {
        source: departure.combat.adventure.source,
        objectHash: departure.combat.adventure.objectHash,
        gameObject: departure.combat.adventure.gameObject,
      },
      principal: departure.combat.principal,
      globals: {
        source: 'example.assets:850',
        objectHash: hash('invented typed defaults'),
        defaults: {
          battleRound: 1,
          battlePressure: 0,
          battleEnemyPoints: 0,
          battleDarkness: false,
          battleDarknessOverride: '',
        },
        reset: method('reset', 201),
      },
      methods: Object.fromEntries(
        [
          'controller',
          'activation',
          'refresh',
          'processEvent',
          'spawnPoints',
          'spawnFixed',
          'track',
          'applyBonus',
          'signal',
          'defeat',
          'banner',
          'returnBanner',
          'reserveBanner',
        ].map((k, n) => [k, k === 'controller' ? controller : method(k, 210 + n)]),
      ),
      rounds: {
        version: 'source-battle-rounds-v1',
        projectionFingerprint: departure.boardFingerprint,
        evidenceHash: hash('invented order'),
        controller,
        configuration: {
          difficulty: 'normal',
          mapType: 'battle',
          disableDarkness: false,
          initialEnemyGroups: [],
        },
        bindings: {
          round: 'battleRound',
          threat: 'battlePressure',
          darkness: 'battleDarkness',
          darknessOverride: 'battleDarknessOverride',
        },
        events: { end: 'EXAMPLE_BATTLE_ROUND_END', start: 'EXAMPLE_BATTLE_ROUND_START' },
        threat: { perHero: 2, perToken: 1, perUnexploredTile: 0, limit: 13 * H },
        darkness: { amount: 2, negate: 'spirit', face: 'faceup', tokenPrefabs: [], spaces: [] },
      },
      combat: null,
      deployment: structuredClone(departure.deployment),
      definitions: [],
      certificates: [],
      instances: [],
      timers: [],
      thresholds: [3, 6, 8, 11].map((perHero, n) => ({
        source: `example.assets:${860 + n}`,
        owner: `example.assets:${870 + n}`,
        definition: `example.assets:${820 + n}`,
        perHero,
        objectHash: hash(['invented threshold', n]),
      })),
      thresholdEvent: 'EXAMPLE_BATTLE_THRESHOLD',
      playerCountBinding: 'battleHeroes',
      enemyPointsBinding: 'battleEnemyPoints',
      principalThresholdBinding: 'nextThreshold',
      productModels: [{ source: 'fixture.assets:1', objectHash: hash('invented product'), id: 0 }],
      nodes: [
        ...departure.combat.threats.map((t) => ({
          source: t.source,
          objectHash: t.objectHash,
          owner: 'example.assets:880',
          anchor: t.anchor,
          kind: 'threat',
        })),
        ...departure.instructions
          .filter((i) => i.op === 'marker' && i.kind === 'search')
          .map((i) => ({
            source: 'example.assets:881',
            objectHash: hash('invented tent'),
            owner: 'example.assets:882',
            anchor: i.anchor,
            kind: 'search',
          })),
      ],
      points: [],
      spawns: [],
      deploymentText: text('Collocate {count} {enemy} nello spazio indicato.'),
      victoryEvent: 'EXAMPLE_BATTLE_VICTORY',
    };
  const layout = departure.board.compiled.layouts.find(
    (l) => l.id === departure.board.compiled.selectedAlternative,
  );
  cap.points = departure.instructions
    .filter((i) => i.op === 'spawn')
    .map((p, n) => {
      const pose = layout.placements.find((a) => a.id === p.anchor);
      return {
        source: `example.assets:${890 + n}`,
        objectHash: hash(['invented point', n]),
        owner: `example.assets:${895 + n}`,
        anchor: p.anchor,
        filter: p.filter,
        cell: pose.cell,
        position: pose.position,
      };
    });
  for (const n of [3, 4])
    cap.points.push({
      ...structuredClone(cap.points[n - 3]),
      source: `example.assets:${890 + n}`,
      owner: `example.assets:${895 + n}`,
      objectHash: hash(['invented extra point', n]),
    });
  const spawn = (definition, stateIndex, index, kind, options) => {
    const type =
      kind === 'points'
        ? 'FFG.JIME.SpawnEnemyGroupsFromSpawnPoints'
        : kind === 'fixed'
          ? 'FFG.JIME.Actions.SpawnEnemyGroup'
          : 'FFG.JIME.Actions.EnemyGroupAddToTracker';
    const a = native(index, 'battleSpawn', type, {
      plan: cap.spawns.length,
      text: text('Nuovi nemici inventati: collocate i gruppi indicati.'),
    });
    cap.spawns.push({
      kind,
      origin: {
        definition,
        state: stateIndex,
        action: index,
        parameterHash: a.origin.parameterHash,
      },
      ...options,
    });
    return a;
  };
  principal.variables.push(variableDef('nextThreshold', 0));
  principal.handlers[cap.victoryEvent] = 10;
  principal.states.push(
    state(10, [action(0, 'set', { target: global('battleWon'), value: true })], { FINISHED: 17 }),
    state(
      17,
      [
        say('La battaglia inventata è vinta.'),
        native(1, 'lore', 'FFG.JIME.Actions.AddLore', { amount: 2 }),
        native(2, 'awardXP', 'FFG.JIME.Actions.AwardXP', { amount: 4 }),
      ],
      { FINISHED: 12 },
    ),
  );
  const definitions = [principal];
  for (const [n, t] of cap.thresholds.entries()) {
    const vars = [
      variableDef('points', 0),
      variableDef('nextThreshold', 0),
      variableDef('bonusLives', 0),
    ];
    const actions = [];
    if (n === 0 || n === 1) {
      actions.push(
        native(0, 'multiplyInt', 'HutongGames.PlayMaker.Actions.IntOperator', {
          target: local('points'),
          left: variable(global('battleHeroes')),
          right: literal(n === 0 ? 5 : 7),
        }),
        action(1, 'addInt', {
          target: global('battleEnemyPoints'),
          value: variable(local('points')),
        }),
        spawn(t.definition, 2, 2, 'points', {
          points: (n === 0 ? [2, 4] : [0, 4]).map((p, j) => ({
            source: cap.points[p].source,
            perHero: j,
          })),
        }),
      );
    } else if (n === 2) {
      actions.push(
        native(0, 'battleVisible', 'FFG.JIME.Actions.IsNodeVisible', {
          anchor: cap.nodes.find((n) => n.kind === 'search').anchor,
          trueEvent: 'VISIBLE',
          falseEvent: 'HIDDEN',
        }),
      );
    } else
      actions.push(
        spawn(t.definition, 2, 0, 'points', {
          points: [2, 0].map((p) => ({ source: cap.points[p].source, perHero: 8 })),
        }),
      );
    const registration =
      n < 3
        ? [
            native(0, 'sourceInt', 'HutongGames.PlayMaker.Actions.GetFsmInt', {
              definition: n ? cap.thresholds[n - 1].definition : principalSource,
              name: 'nextThreshold',
              target: local('nextThreshold'),
            }),
            action(1, 'addInt', {
              target: local('nextThreshold'),
              value: literal(([6, 8, 11][n] - [3, 6, 8][n]) * H),
            }),
            native(2, 'battleThreat', 'FFG.JIME.Actions.AddThreatEvent', {
              source: cap.thresholds[n + 1].source,
              value: variable(local('nextThreshold')),
            }),
          ]
        : [];
    const states = [
      state(0, [action(0, 'release')]),
      state(1, [say(`Soglia inventata ${n + 1}.`)], { FINISHED: 2 }),
      state(2, actions, n === 2 ? { VISIBLE: 5, HIDDEN: 8 } : { FINISHED: 3 }),
      state(3, registration, { FINISHED: 4 }),
      end(4),
    ];
    if (n === 2)
      states.push(
        state(
          5,
          [
            native(0, 'battleReserve', 'FFG.JIME.Actions.EnemyGroupRemoveFromReserve', {
              enemy: 'fixture.assets:11',
              amount: 1,
            }),
            native(1, 'battleReserve', 'FFG.JIME.Actions.EnemyBannerRemoveFromReserve', {
              enemy: null,
              amount: 1,
            }),
            native(2, 'switchInt', 'HutongGames.PlayMaker.Actions.IntSwitch', {
              value: variable(global('battleHeroes')),
              cases: [3, 5].map((h) => ({ equals: literal(h), event: 'ODD' })),
            }),
          ],
          { ODD: 9, FINISHED: 6 },
        ),
        state(
          9,
          [action(0, 'addInt', { target: global('battleEnemyPoints'), value: literal(10) })],
          { FINISHED: 6 },
        ),
        state(
          6,
          [
            native(0, 'battleNode', 'FFG.JIME.Actions.HideNode', {
              anchor: cap.nodes.find((n) => n.kind === 'search').anchor,
              visible: false,
            }),
            native(1, 'divideInt', 'HutongGames.PlayMaker.Actions.IntOperator', {
              target: local('bonusLives'),
              left: variable(global('battleHeroes')),
              right: literal(2),
            }),
            spawn(t.definition, 6, 2, 'fixed', {
              recipe: recipes[0],
              anchor: cap.points[3].source,
              pose: 'source-point',
              successEvent: 'FINISHED',
              failureEvent: 'FINISHED',
            }),
          ],
          { FINISHED: 7 },
        ),
        state(
          7,
          [
            action(0, 'objective', { id: 2, text: text('Sconfiggete il capitano inventato.') }),
            { ...say('La tenda inventata è scomparsa.'), index: 1 },
            native(2, 'lore', 'FFG.JIME.Actions.AddLore', { amount: 1 }),
          ],
          { FINISHED: 3 },
        ),
        state(8, [say('La tenda inventata era già nascosta.')], { FINISHED: 3 }),
      );
    definitions.push({
      source: t.definition,
      initial: 0,
      variables: vars,
      handlers: { [cap.thresholdEvent]: 1 },
      deferredHandlers: {},
      states,
    });
  }
  for (const [n, source] of logicSources.entries()) {
    const d = {
      source,
      initial: 0,
      variables: [variableDef('wasReady', true), variableDef('passed', false)],
      handlers: { DEFEATED: 1 },
      deferredHandlers: {},
      states: [state(0, [action(0, 'release')])],
    };
    if (n === 2)
      d.states.push(
        state(1, [say('L’ultimo avversario inventato è sconfitto.')], { FINISHED: 2 }),
        state(2, [native(0, 'endGame', 'FFG.JIME.Actions.EndGame', { success: true })]),
      );
    else {
      d.states.push(
        state(
          1,
          [
            native(0, 'battleReady', 'FFG.JIME.Actions.GetEnemyReadyState', {
              target: local('wasReady'),
            }),
            native(1, 'compareInt', 'HutongGames.PlayMaker.Actions.IntCompare', {
              left: variable(global('battleHeroes')),
              right: literal(n ? 4 : 1),
              equalEvent: 'VICTORY',
              lessEvent: 'VICTORY',
              greaterEvent: 'NEXT',
            }),
          ],
          { VICTORY: 12, NEXT: n ? 5 : 2 },
        ),
      );
      if (n === 0) {
        d.states.push(
          state(
            2,
            [
              native(0, 'challenge', 'FFG.JIME.Actions.DisplayMessageChallenge', {
                text: text('Prova inventata di agilità.'),
                stat: 'agility',
                sum: literal(0),
                bounds: [
                  { maximum: 2, event: 'FAIL' },
                  { maximum: 99, event: 'PASS' },
                ],
              }),
            ],
            { FAIL: 3, PASS: 4 },
          ),
          state(3, [action(0, 'set', { target: local('passed'), value: false })], { FINISHED: 5 }),
          state(4, [action(0, 'set', { target: local('passed'), value: true })], { FINISHED: 11 }),
        );
      }
      d.states.push(
        state(
          5,
          [
            spawn(source, 5, 0, 'tracker', {
              recipe: recipes[n + 1],
              anchor: null,
              pose: n ? 'previous-group' : 'actor',
              successEvent: 'FINISHED',
              failureEvent: 'FINISHED',
            }),
          ],
          { FINISHED: 6 },
        ),
        state(
          6,
          [
            native(0, 'whenTrue', 'HutongGames.PlayMaker.Actions.BoolAllTrue', {
              ref: local('wasReady'),
              event: 'FINISHED',
            }),
            native(1, 'battleExhaust', 'FFG.JIME.Actions.EnemyGroupExhaust', {
              group: combat.scriptedGroups[n + 1].sourceGroup,
            }),
          ],
          { FINISHED: 7 },
        ),
      );
      if (n === 0)
        d.states.push(
          state(
            7,
            [
              action(0, 'branchBool', {
                ref: local('passed'),
                trueEvent: 'PASS',
                falseEvent: 'FAIL',
              }),
            ],
            { PASS: 9, FAIL: 8 },
          ),
          state(
            8,
            [
              say('La prova inventata è fallita.', {
                consequence: { family: 'damage', amount: 3, face: 'facedown' },
                battlePlacement: recipes[1],
              }),
            ],
            { FINISHED: 10 },
          ),
          state(9, [say('La prova inventata è superata.', { battlePlacement: recipes[1] })], {
            FINISHED: 10,
          }),
        );
      else
        d.states.push(
          state(
            7,
            [
              say('Gli eroi nello spazio del nemico subiscono il colpo inventato.', {
                battleSuffering: { amount: 2, negate: 'might', family: 'damage', face: 'faceup' },
                battlePlacement: recipes[2],
              }),
            ],
            { FINISHED: 10 },
          ),
        );
      if (n === 0)
        d.states.push(
          state(
            11,
            [
              spawn(source, 11, 0, 'tracker', {
                recipe: recipes[1],
                anchor: null,
                pose: 'actor',
                successEvent: 'FINISHED',
                failureEvent: 'FINISHED',
              }),
            ],
            { FINISHED: 6 },
          ),
        );
      d.states.push(
        end(10),
        state(12, [native(0, 'endGame', 'FFG.JIME.Actions.EndGame', { success: true })]),
      );
    }
    definitions.push(d);
  }
  cap.definitions = definitions;
  cap.certificates = certificates({ definitions });
  cap.certificates[0].objectHash = cap.principal.objectHash;
  cap.instances = definitions.map((d, n) => {
    const c = cap.certificates[n];
    return {
      source: d.source,
      gameObject:
        n === 0
          ? cap.principal.gameObject
          : n <= 4
            ? cap.thresholds[n - 1].owner
            : `example.assets:${900 + n}`,
      role: n === 0 ? 'principal' : n <= 4 ? 'threshold' : 'logic',
      objectHash: c.objectHash,
      lifecycleHash: c.lifecycleHash,
      certificateHash: hash(c),
    };
  });
  cap.combat = compileCombatClosure(combat);
  departure.battleRounds = cap;
  return cap;
}
