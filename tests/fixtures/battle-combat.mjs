// Entirely invented finite authority, identities, graph, clauses and terminal amounts.
import { compileCombatClosure, compileSourceDeployment } from '../../dist/combat-library.mjs';
import { closureFixture, sha } from './combat-closure.mjs';
import { action, state, text } from './scenario.mjs';
import { native } from './clue-progression.mjs';
import { certificates } from './exploration.mjs';
import { hash } from './map-freeze.mjs';

export function attachBattleCombat(
  pack,
  frozen,
  catalog,
  edit = () => {},
  { singleFigureGroups = false } = {},
) {
  const departure = pack.manifest.campDeparture,
    src = closureFixture(),
    deployment = departure.deployment;
  const instructions = src.assets.filter((a) => a.cls === 'EnemyActivationModel');
  if (singleFigureGroups)
    for (const i of instructions) {
      i.data.MinGroupSize = 1;
      i.data.MaxGroupSize = 1;
      i.data.Damage = i.data.Damage.filter((r) => r.Size === 1);
      i.dataHash = hash(i.data);
    }
  for (const m of deployment.assets.filter((a) => a.cls === 'EnemyModel' && !a.data.IsUnique)) {
    if (singleFigureGroups) {
      m.data.MaxUnitCount = 1;
      m.data.Costs = [{ Num: 1, Cost: 5 }];
    }
    m.data.Activations = instructions.map((a) => ({
      m_FileID: 0,
      m_PathID: Number(a.source.split(':')[1]),
    }));
    m.data.SpecialActivations = [];
    m.dataHash = hash(m.data);
  }
  departure.deploymentHash = hash(compileSourceDeployment(deployment));
  const deployed = compileSourceDeployment(deployment);
  src.models = deployed.compiled.models.map((m) => m.source);
  src.assets = [
    ...deployment.assets.filter(
      (a) => src.models.includes(a.source) || a.cls === 'EnemyBonusModel',
    ),
    ...instructions,
  ];
  src.files = deployment.files;
  src.projectionFingerprint = departure.boardFingerprint;
  src.deploymentFingerprint = deployed.fingerprint;
  src.items = catalog.items.map((i, n) => ({
    id: i.id,
    model: `fixture.assets:${900 + n}`,
    definitionHash: hash(i),
    originalHash: hash(['invented', i.id]),
    file: 'fixture.assets',
    locator: 'Invented!weapon',
    ranged: i.ranged,
    stat: i.slot === 'hand' ? 'might' : null,
    body: '1 Success: 1 hit\n2 Successes: 2 hits',
  }));
  src.definitions = catalog.skills.map((s) => ({
    id: s.id,
    definitionHash: hash(s),
    originalHash: hash(['invented', s.id]),
    locator: 'Invented!skill',
    clauses: 0,
  }));
  src.heroes = catalog.heroes
    .filter((h) => frozen.preparation.heroes.some((p) => p.heroId === h.id))
    .map((h) => ({
      heroId: h.id,
      definitionHash: hash(h),
      originalHash: hash(['invented', h.id]),
      locator: 'Invented!hero',
      effect: 'rally-extra-card',
    }));
  const definition = {
    source: departure.target.principal,
    initial: 0,
    variables: [],
    handlers: { EXAMPLE_BATTLE_FAILURE: 18 },
    deferredHandlers: {},
    states: [
      state(0, [action(0, 'release')]),
      state(
        18,
        [
          action(0, 'message', {
            mode: 'ordinary',
            text: text('Termine della battaglia inventata.'),
            ignoreLog: false,
          }),
        ],
        { FINISHED: 11 },
      ),
      state(
        11,
        [
          action(0, 'message', {
            mode: 'ordinary',
            text: text('La compagnia inventata si ritira.'),
            ignoreLog: false,
          }),
        ],
        { FINISHED: 14 },
      ),
      state(
        14,
        [
          action(0, 'message', {
            mode: 'ordinary',
            text: text('Ricevete i premi inventati indicati dalla fonte.'),
            ignoreLog: false,
          }),
          action(1, 'set', { target: { scope: 'global', name: 'battleWon' }, value: false }),
          native(2, 'lore', 'FFG.JIME.Actions.AddLore', { amount: 1 }),
          native(3, 'awardXP', 'FFG.JIME.Actions.AwardXP', { amount: 3 }),
        ],
        { FINISHED: 12 },
      ),
      state(
        12,
        [
          native(0, 'nextAdventure', 'FFG.JIME.Actions.SetNextAdventure', {
            source: 'example.assets:990',
            id: 18,
          }),
          native(1, 'proceed', 'FFG.JIME.Actions.ProceedToNextGame', {}),
        ],
        { FINISHED: 13 },
      ),
      state(13, [action(0, 'stop')]),
    ],
  };
  const failure = structuredClone(pack.manifest.failure);
  failure.event = 'EXAMPLE_BATTLE_FAILURE';
  failure.next = {
    ...failure.next,
    source: 'example.assets:990',
    id: 18,
    type: 'journey',
    name: text('Terza destinazione inventata'),
    location: text('Luogo inventato'),
    story: text('Racconto inventato'),
  };
  failure.partyBonus.skills = src.definitions.map((d, n) => ({ cardId: d.id, modelId: n + 1 }));
  const terminal = {
    definition,
    certificate: certificates({ definitions: [definition] })[0],
    failure,
    globals: [
      { name: 'battleWon', type: 'bool', value: false },
      { name: 'battleDarkness', type: 'bool', value: false },
      { name: 'battleDarknessOverride', type: 'string', value: '' },
    ],
  };
  departure.combat = {
    version: 'source-battle-combat-v1',
    evidenceHash: hash('invented battle closure'),
    boardFingerprint: departure.boardFingerprint,
    deploymentFingerprint: deployed.fingerprint,
    model: {
      source: departure.target.model,
      objectHash: deployment.assets.find((a) => a.source === departure.target.model).objectHash,
    },
    adventure: {
      source: 'example.assets:982',
      objectHash: hash('invented adventure component'),
      gameObject: 'example.assets:984',
      model: departure.target.model,
      initialDarkness: [],
      initialDifficult: [],
      initialFortified: [],
    },
    principal: {
      source: departure.target.principal,
      objectHash: terminal.certificate.objectHash,
      gameObject: 'example.assets:984',
    },
    combat: compileCombatClosure(src),
    darkness: {
      disabled: false,
      global: 'battleDarkness',
      override: 'battleDarknessOverride',
      intrinsic: false,
      initialTokens: [],
    },
    threats: [
      { source: 'example.assets:983', objectHash: hash('invented threat'), anchor: 'danger' },
    ],
    terrain: departure.instructions.flatMap((i) =>
      i.op === 'terrain'
        ? i.anchors.map((anchor, n) => ({
            anchor,
            kind: i.kinds[n],
            sourceHash: sha('invented terrain rule'),
            locator: 'Invented!terrain',
            window: {
              bush: 'end-turn-optional',
              wall: 'adjacency',
              fire: 'attack-gated',
              rock: 'negate-gated',
            }[i.kinds[n]],
          }))
        : [],
    ),
    terminal,
  };
  edit(departure, src, pack, frozen, catalog);
  departure.combat.combat = compileCombatClosure(src);
  return departure.combat;
}
