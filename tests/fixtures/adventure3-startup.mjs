// Seven-section journey recipe and complete ordered pools, all entirely invented.
import { generatorFixture } from './map-freeze.mjs';
import { addEncounter } from './map-encounters.mjs';
import { hash } from './map-freeze.mjs';
import { action, state, text } from './scenario.mjs';
import { certificates } from './exploration.mjs';
import { compileSourceDeployment, compileCombatClosure } from '../../dist/combat-library.mjs';
export function adventure3Generator(catalog) {
  const g = generatorFixture(catalog),
    t = g.template,
    s = t.selection;
  g.algorithm = 'session-A3-generator-pack-v1';
  g.identity.adventureId = 3;
  g.identity.adventureSource = 'example.assets:990';
  t.placement.provenance.files.push({ file: 'example.assets', sha256: '9'.repeat(64) });
  s.provenance.files.push({ file: 'example.assets', sha256: '9'.repeat(64) });
  t.geometry.provenance.files.push({ file: 'example.assets', sha256: '9'.repeat(64) });
  s.algorithm = 'source-selection-A3-v1';
  t.geometry.algorithm = 'source-map-geometry-pack-A3-v1';
  t.geometry.mapPosition = [-11.240086555480957, 0.9968953132629395, 0];
  t.geometry.cornerSin = [0.5, 1, 0.5, -0.5, -1, -0.5].map(Math.fround);
  t.placement.algorithm = 'source-encounter-placement-pack-A3-v1';
  const rename = (v, delta) =>
    Array.isArray(v)
      ? v.map((x) => rename(x, delta))
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, rename(x, delta)]))
        : typeof v === 'string' && /^invented.assets:\d+$/.test(v)
          ? `invented.assets:${Number(v.split(':')[1]) + delta}`
          : v;
  for (let n = 8; n < 32; n++) {
    const shape = rename(structuredClone(t.geometry.tiles[n % 8]), n * 1000000);
    const row = s.standard[n];
    Object.assign(shape, { source: row.source, modelSource: row.modelSource, hashId: row.hashId });
    shape.spaces.forEach((space, i) => {
      space.source = row.spaces[i].source;
    });
    t.geometry.tiles.push(shape);
  }
  s.products[0].tileCodes = s.standard.slice(0, 32).map((x) => x.code);
  for (const tile of t.geometry.tiles)
    for (const h of tile.hexes) {
      h.render.polygon = Array.from({ length: 6 }, (_, i) => [
        Math.fround(Math.cos((i * Math.PI) / 3)),
        Math.fround(Math.sin((i * Math.PI) / 3)),
        0,
      ]);
      h.render.uv = Array.from({ length: 6 }, () => [0, 0]);
    }
  for (const tile of t.geometry.tiles) {
    tile.hexes = tile.hexes.slice(0, 2).map((h, n) => ({ ...h, space: n }));
    tile.edges = tile.edges.filter((e) => e.hex < 2);
  }
  const original = s.sections.map((x) => structuredClone(x));
  const geometry = t.geometry.sections.map((x) => structuredClone(x));
  const placement = t.placement.sections.map((x) => structuredClone(x));
  s.sections = Array.from({ length: 7 }, (_, index) => ({
    ...structuredClone(original[index % 4]),
    index,
    source: `invented.assets:${90000 + index}`,
    start: null,
    required: [],
    traitRequirements: [],
    fixedEncounterSources: [],
    minimumSpaces: 2,
    maximumSpaces: index === 1 ? 4 : 3,
    ignorePlayerScaling: index > 1,
    allowedTileSets: index < 2 ? 8 : 3,
    relativeSizeFactor: index === 0 ? Math.fround(0.15) : 0.5,
  }));
  t.geometry.sections = s.sections.map((x, i) => ({
    ...structuredClone(geometry[i % 4]),
    id: i,
    source: x.source,
    tileClumpFactor: 1,
    sectionClumpFactor: i < 2 ? 1 : 0,
  }));
  t.placement.sections = s.sections.map((x, i) => ({
    ...structuredClone(placement[i % 4]),
    index: i,
    source: x.source,
    tileEncounters: [],
    sectionEncounterSources: [],
    randomFillPercent: [
      Math.fround(0.605),
      Math.fround(0.605),
      Math.fround(0.6),
      0.5,
      Math.fround(0.6),
      0.5,
      Math.fround(0.6),
    ][i],
  }));
  s.requiredConnections = [
    [0, 1],
    [1, 3],
    [1, 4],
    [1, 5],
    [1, 6],
    [1, 2],
  ];
  s.standard.forEach((tile, n) => {
    tile.set = n < 12 ? 8 : 1;
  });
  const input = { assembly: { selection: s }, placement: t.placement };
  // Every realized model is retained. These four finite examples exercise the shared prefab seam.
  while (s.encounters.length < 4) addEncounter(input);
  for (const [n, section] of [0, 2, 4, 6].entries()) {
    const source = s.encounters[n].source;
    s.sections[section].fixedEncounterSources = [source];
    t.placement.sections[section].sectionEncounterSources = [source];
    if (n) t.placement.models[n].prefab = structuredClone(t.placement.models[1].prefab);
  }
  s.encounters.forEach((model, n) => {
    model.type = 0;
    model.id = 100200 + n;
    t.placement.models[n].id = model.id;
  });
  s.groups.forEach((group) => {
    group.requiredSources = [];
    group.optionalSources = [];
    group.requiredOptionalCount = 0;
  });
  return g;
}

// Source-shaped, finite invented program. No original prose, identities, cards or game history.
export function attachAdventure3(departure, _source, a1, frozen, catalog) {
  const generator = adventure3Generator(catalog),
    generatorHash = hash(generator),
    heroIds = frozen.preparation.heroes.map((h) => h.heroId),
    global = (name) => ({ scope: 'global', name }),
    local = (name) => ({ scope: 'local', name }),
    variable = (ref) => ({ kind: 'variable', ref }),
    literal = (value) => ({ kind: 'literal', value }),
    native = (index, op, type, fields) => ({
      index,
      op,
      ...fields,
      origin: { type, parameterHash: hash(fields), load: 'hash-match-positional' },
    }),
    say = (body, mode = 'ordinary', extra = {}) =>
      action(0, 'message', { mode, text: text(body), ignoreLog: false, ...extra });
  const deployment = structuredClone(departure.deployment);
  deployment.assets.find((a) => a.source === deployment.adventure).source =
    generator.identity.adventureSource;
  deployment.adventure = generator.identity.adventureSource;
  deployment.files.find((f) => f.file === 'example.assets').sha256 = '9'.repeat(64);
  deployment.assets.find((a) => a.cls === 'AdventureModel').data.GlobalEnemyFilter = {
    MustHaveAny: 0,
    MustHaveAll: 0,
    ExcludeIfAny: 0,
  };
  deployment.assets.find((a) => a.source === 'fixture.assets:10').data.Traits = 3;
  deployment.assets.find((a) => a.source === 'fixture.assets:11').data.Traits = 128;
  deployment.texts.EXAMPLE_11 = 'Riserva inventata';
  deployment.texts.EXAMPLES_11 = 'Riserve inventate';
  deployment.texts.EXAMPLE_12 = 'Altro modello inventato';
  deployment.texts.EXAMPLES_12 = 'Altri modelli inventati';
  for (const a of deployment.assets) a.dataHash = hash(a.data);
  const pack = {
    formatVersion: 1,
    algorithm: 'source-startup-ir-v1',
    identity: {
      adventureId: 3,
      adventureSource: generator.identity.adventureSource,
      language: 'Italian',
    },
    name: 'Viaggio3 · fonte e partita inventate',
    sources: [
      ...deployment.files,
      ...generator.template.selection.provenance.files.filter(
        (f) => !deployment.files.some((d) => d.file === f.file),
      ),
    ],
    principal: 'example.assets:991',
    timers: [],
    globals: [
      ['inventedWon', 'bool', false],
      ['battleWon', 'bool', false],
      ['rangerTile', 'int', 0],
      ['phaseCounter', 'int', 1],
      ['pressure', 'int', 0],
      ['night', 'bool', false],
      ['nightInstruction', 'string', ''],
      ['companyCount', 'int', 0],
      ['poolPoints', 'int', 0],
    ].map(([name, type, value]) => ({ name, type, value })),
    definitions: [],
    manifest: {
      scope: 'original-encounter-v1',
      evidenceHash: hash('invented A3 closure'),
      prefabs: [],
      playablePrefabs: [],
      journeyStartup: {
        version: 'source-journey-startup-A3-v1',
        generatorHash,
        heroIds,
        startSpacePolicy: 'unity-range-port-v1',
        provocationPolicy: 'source-provocation-A3-v1',
        explorationNodes: generator.template.geometry.tiles.map((tile, n) => ({
          tileSource: tile.source,
          source: `example.assets:${300000 + n}`,
          position: [0, 0, 0],
        })),
        rangerPrefab: generator.template.placement.models[0].prefab.source,
        rangerTileBinding: 'rangerTile',
        previousOutcomeBinding: 'inventedWon',
        roundStartEvent: 'ROUND_START',
        resetBindings: [
          'rangerTile',
          'phaseCounter',
          'pressure',
          'night',
          'nightInstruction',
          'companyCount',
          'poolPoints',
        ],
        reserved: [{ source: 'fixture.assets:11', count: 3 }],
        reservedEliteBanners: 0,
      },
      startupPreparation: {
        version: 'source-startup-preparation-v1',
        catalogHash: hash(catalog),
        frontsFingerprint: departure.frontsFingerprint,
        evidenceHash: hash('invented initial equipment windows'),
      },
      rounds: {
        version: 'source-rounds-v1',
        projectionFingerprint: '0'.repeat(64),
        evidenceHash: hash('invented journey controller'),
        controller: {
          assemblyHash: hash('invented assembly'),
          method: '06001234',
          bodyHash: hash('invented journey body'),
        },
        configuration: {
          difficulty: 'normal',
          mapType: 'journey',
          disableDarkness: false,
          initialEnemyGroups: [],
        },
        bindings: {
          round: 'phaseCounter',
          threat: 'pressure',
          darkness: 'night',
          darknessOverride: 'nightInstruction',
        },
        events: { end: 'ROUND_END', start: 'ROUND_START' },
        threat: { perHero: 2, perToken: 1, perUnexploredTile: 1, limit: 68 },
        darkness: { amount: 2, negate: 'spirit', face: 'faceup', tokenPrefabs: [], spaces: [] },
      },
      followup: {
        version: 'source-shadow-followup-v1',
        projectionFingerprint: '0'.repeat(64),
        evidenceHash: hash('invented static closure'),
        playerCountBinding: 'companyCount',
        enemyPointsBinding: 'poolPoints',
        thresholdEvent: 'INVENTED_THRESHOLD',
        instances: [
          {
            gameObject: 'example.assets:992',
            definition: 'example.assets:993',
            kind: 'threat',
            hasNode: false,
            initializationHash: hash('invented waiting initialization'),
            lifecycleHash: hash('invented waiting lifecycle'),
          },
        ],
        thresholds: [{ source: 'example.assets:994', definition: 'example.assets:993' }],
        deployment: compileSourceDeployment(deployment),
        deploymentText: text('Colloca {count} {enemy}.'),
        explorationNodes: [],
        explorationText: {
          single: text('Colloca il segnalino esplorazione inventato.'),
          plural: text('Colloca i segnalini esplorazione inventati.'),
        },
      },
    },
  };
  const fear = native(0, 'physical', 'FFG.JIME.Actions.DisplayMessage', {
    text: text('Conseguenza inventata dell’esito A1: ogni eroe subisce una paura coperta.'),
    program: {
      profile: 'source-fronts-v1',
      initialCredits: heroIds.map(() => 0),
      limits: heroIds.map(() => ({ kind: 'requires-capability', capability: 'source-derived' })),
      darknessHeroes: [],
      children: heroIds.map((_, hero) => ({
        kind: 'suffer',
        hero,
        face: 'facedown',
        cards: [{ family: 'fear', amount: 1 }],
        prevention: [],
      })),
    },
  });
  pack.definitions.push({
    source: pack.principal,
    initial: 0,
    variables: [
      { name: 'start', type: 'int', value: 0 },
      { name: 'points', type: 'int', value: 0 },
    ],
    handlers: { SCENARIO_BEGIN: 1 },
    deferredHandlers: {},
    states: [
      state(0),
      state(1, [action(0, 'threat', { source: 'example.assets:994', threshold: 20 })], {
        FINISHED: 2,
      }),
      state(
        2,
        [say('Introduzione inventata: ogni eroe effettua Scoperta 3.', 'scout', { scoutCount: 3 })],
        { FINISHED: 3 },
      ),
      state(
        3,
        [
          action(0, 'getStart', { target: local('start') }),
          action(1, 'revealTile', { tile: variable(local('start')) }),
        ],
        { FINISHED: 4 },
      ),
      state(4, [say('Colloca la tessera iniziale inventata.', 'tile')], { FINISHED: 5 }),
      state(5, [say('Collocate gli eroi nello spazio evidenziato inventato.')], { FINISHED: 6 }),
      state(
        6,
        [
          action(0, 'highlight', {
            tile: variable(local('start')),
            spaceIndex: 0,
            randomSpace: 'unity-range-port-v1',
          }),
        ],
        { FINISHED: 7 },
      ),
      state(
        7,
        [
          action(0, 'explore', {
            tile: variable(local('start')),
            noInspiration: false,
            skipIntro: true,
            skipOutro: true,
            skipAdjacentSectionEvent: true,
          }),
        ],
        { FINISHED: 8 },
      ),
      state(
        8,
        [
          native(0, 'switchInt', 'HutongGames.PlayMaker.Actions.IntSwitch', {
            value: variable(global('rangerTile')),
            cases: [{ equals: variable(local('start')), event: 'SAME' }],
          }),
        ],
        { SAME: 10, FINISHED: 9 },
      ),
      state(
        9,
        [
          action(0, 'revealTile', { tile: variable(global('rangerTile')) }),
          action(1, 'explore', {
            tile: variable(global('rangerTile')),
            noInspiration: true,
            skipIntro: true,
            skipOutro: true,
            skipAdjacentSectionEvent: true,
          }),
        ],
        { FINISHED: 10 },
      ),
      state(
        10,
        [
          action(0, 'section', {
            sectionId: 0,
            text: text('Colloca {tile} e il segnalino esplorazione inventato.'),
          }),
        ],
        { FINISHED: 11 },
      ),
      state(
        11,
        [
          native(0, 'multiplyInt', 'HutongGames.PlayMaker.Actions.IntOperator', {
            target: local('points'),
            left: variable(global('companyCount')),
            right: literal(7),
          }),
          native(1, 'spawnRandom', 'FFG.JIME.Actions.SpawnRandomEnemyGroups', {
            points: local('points'),
            text: text('Collocate i nemici inventati.'),
            excludeGameEnemyPoints: false,
            filter: { MustHaveAny: 3, MustHaveAll: 0, ExcludeIfAny: 128 },
            sections: null,
          }),
        ],
        { FINISHED: 12 },
      ),
      state(
        12,
        [
          action(0, 'branchBool', {
            ref: global('inventedWon'),
            trueEvent: 'WIN',
            falseEvent: 'LOSS',
          }),
        ],
        { WIN: 14, LOSS: 13 },
      ),
      state(13, [fear], { FINISHED: 14 }),
      state(14, [say('Inizia il viaggio inventato.')], { FINISHED: 15 }),
      state(
        15,
        [
          action(0, 'objective', {
            id: 0,
            text: text('Obiettivo inventato: raggiungete il sentiero.'),
          }),
        ],
        { FINISHED: 16 },
      ),
      state(16, [action(0, 'release')]),
    ],
  });
  pack.definitions.push({
    source: 'example.assets:993',
    initial: 0,
    variables: [],
    handlers: {},
    deferredHandlers: {},
    states: [state(0, [action(0, 'release')])],
  });
  for (const [n, model] of generator.template.placement.models.entries()) {
    const ranger = n === 0,
      source = ranger ? 'example.assets:996' : 'example.assets:997';
    if (!pack.definitions.some((d) => d.source === source))
      pack.definitions.push({
        source,
        initial: 0,
        variables: [],
        handlers: { REVEALED: 1 },
        deferredHandlers: { 'NODE CLICKED': 'adventure3-later-encounter' },
        states: [
          state(
            0,
            ranger
              ? [
                  native(0, 'delay', 'FFG.Common.Actions.Delay', { seconds: 0.5 }),
                  action(1, 'getTile', { target: global('rangerTile') }),
                  action(2, 'release'),
                ]
              : [],
          ),
          state(
            1,
            [
              say(
                ranger
                  ? 'La raminga inventata indica il sentiero.'
                  : 'Un incontro inventato è rivelato.',
              ),
            ],
            { FINISHED: 2 },
          ),
          state(2, [action(0, 'release')]),
        ],
      });
    pack.manifest.prefabs.push({
      source: model.prefab.source,
      modelSource: model.source,
      encounterId: model.id,
      nodeSource: ranger ? 'example.assets:998' : 'example.assets:999',
      nodeType: 'search',
      sourceNodeType: 0,
      token3DType: 2,
      fsmSource: source,
      initializationHash: hash(['invented initialization', ranger]),
      closureHash: hash(['invented reveal', ranger]),
      inspection: text('Il seguito dell’incontro richiede la propria capacità fonte.'),
      capabilities: ['adventure3-later-encounter'],
    });
  }
  const combat = structuredClone(_source);
  combat.format = 'combat-closure-A3-v1';
  delete combat.shadow;
  delete combat.scriptedGroups;
  combat.files = pack.sources;
  for (const item of combat.items)
    item.model = generator.mapping.items.find((m) => m.catalogId === item.id).source;
  for (const card of departure.campaignSkills)
    if (!combat.definitions.some((d) => d.id === card.id))
      combat.definitions.push({
        id: card.id,
        definitionHash: hash(card),
        originalHash: hash(['invented A3 skill', card.id]),
        locator: 'Invented!A3',
        clauses: 0,
      });
  combat.projectionFingerprint = '0'.repeat(64);
  combat.deploymentFingerprint = compileSourceDeployment(deployment).fingerprint;
  combat.models = compileSourceDeployment(deployment).compiled.models.map((m) => m.source);
  combat.assets = [
    ...deployment.assets.filter(
      (a) => combat.models.includes(a.source) || a.cls === 'EnemyBonusModel',
    ),
    ...combat.assets.filter((a) => a.cls === 'EnemyActivationModel'),
  ];
  pack.manifest.combat = compileCombatClosure(combat);
  const cs = certificates(pack);
  for (const row of pack.manifest.followup.instances) {
    const d = pack.definitions.find((d) => d.source === row.definition),
      c = cs.find((c) => c.source === row.definition);
    row.lifecycleHash = c.lifecycleHash;
    row.initializationHash = hash({
      definition: d.source,
      initial: d.initial,
      variables: d.variables,
      actions: d.states.find((s) => s.index === d.initial).actions,
    });
  }
  for (const c of cs) {
    const d = pack.definitions.find((d) => d.source === c.source);
    c.deferredEdges = Object.entries(d.deferredHandlers ?? {}).map(([event, capability]) => ({
      from: null,
      event,
      to: 50,
      capability,
    }));
    c.handlers = {
      ...c.handlers,
      ...Object.fromEntries(c.deferredEdges.map((e) => [e.event, e.to])),
    };
  }
  const startup = {
    pack,
    certificates: cs,
    roundsCertificate: { instructionHash: hash(pack.manifest.rounds) },
    followupCertificate: { instructionHash: hash(pack.manifest.followup) },
    startupPreparationCertificate: { instructionHash: hash(pack.manifest.startupPreparation) },
  };
  const camp = {
    skills: structuredClone(a1.manifest.campSkills),
    items: structuredClone(a1.manifest.campItems),
    preparation: structuredClone(a1.manifest.campPreparation),
  };
  camp.skills.failureFingerprint = camp.items.failureFingerprint = hash(
    departure.combat.terminal.failure,
  );
  camp.preparation.skillsFingerprint = hash(camp.skills);
  camp.preparation.itemsFingerprint = hash(camp.items);
  const materials = Object.fromEntries(
    [
      'catalogHash',
      'evidenceHash',
      'ownedProductIds',
      'deckCatalog',
      'campaignSkills',
      'fronts',
      'frontsFingerprint',
      'windows',
      'quantities',
    ].map((k) => [k, structuredClone(departure[k])]),
  );
  departure.continuation = {
    ...materials,
    version: 'source-camp-departure-A3-v1',
    target: {
      id: 3,
      model: generator.identity.adventureSource,
      principal: pack.principal,
      name: pack.name,
    },
    preparationHash: hash(camp.preparation),
    heroIds,
    camp,
    generator,
    generatorHash,
    startup,
    startupHash: hash(startup),
  };
  return departure.continuation;
}
