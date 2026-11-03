// Entirely invented parameters, identities, text and card rows.
import { createHash } from 'node:crypto';
import { generatorFixture, hash } from './map-freeze.mjs';
import { catalogFixture } from './catalog.mjs';
import {
  parseGeneratorPack,
  deriveContext,
  runGenerationAttempt,
} from '../../dist/map-freeze-library.mjs';
export const sha = (text) => createHash('sha256').update(text).digest('hex');
const ptr = (source) => ({ m_FileID: 0, m_PathID: Number(source.split(':')[1]) });
export const literal = (value) => ({ kind: 'literal', value });
export const asset = (source, cls, data) => ({
  source,
  cls,
  objectHash: hash(['raw', source]),
  dataHash: hash(data),
  data,
});
let frozen;
export function combatFixture() {
  if (!frozen) {
    const content = catalogFixture();
    const preparation = {
      status: 'prepared',
      heroes: [
        {
          heroId: 'hero-2',
          playerId: '00000000-0000-4000-8000-000000000002',
          roleId: 'role-2',
          itemCopies: ['sword:1', 'rare-armor:1'],
        },
      ],
      weaknessDeck: [],
    };
    const input = generatorFixture(content);
    for (const tile of input.template.selection.standard) tile.spaces = tile.spaces.slice(0, 1);
    for (const tile of input.template.geometry.tiles) {
      tile.spaces = tile.spaces.slice(0, 1);
      tile.spaces[0].serializedConnectedSpaces = [];
      for (const hex of tile.hexes) hex.space = 0;
    }
    for (const section of input.template.selection.sections) {
      section.minimumSpaces = 2;
      section.maximumSpaces = 2;
    }
    const pack = parseGeneratorPack(input);
    const context = deriveContext(pack, { content, preparation });
    frozen = runGenerationAttempt(pack, context, {
      requestedSeed: 1,
      seed: 1,
      attempt: 0,
      incoming: pack.template.selection.incoming,
      attempts: [],
    }).projection;
  }
  const projection = structuredClone(frozen),
    tile = projection.sections[0].tiles[0];
  const spaces = projection.spaces.filter((s) => s.tileSource === tile.source);
  const file = tile.source.split(':')[0],
    ref = (n) => `${file}:${n}`;
  const enemy = ref(900001),
    instructions = [ref(900010), ref(900011), ref(900012)];
  const fsm = ref(900100),
    logicGO = ref(900200),
    logic = ref(900201),
    yieldable = ref(900202),
    logicFSM = ref(900203),
    positionGO = ref(900300);
  const spawn = {
    Message: { Key: 'invented-spawn', Inserts: [] },
    GroupToSpawn: ptr(enemy),
    SpecifySize: literal(true),
    GroupSize: literal(2),
    IgnoreCost: literal(false),
    AdditionalPoints: literal(9),
    RandomBonuses: literal(false),
    Bonuses: [],
    Logic: literal(ptr(logicGO)),
    SpawnPosition: literal(ptr(positionGO)),
    FocusCamera: true,
    Succeeded: { kind: 'event', name: 'OK' },
    Failed: { kind: 'event', name: 'NO' },
  };
  const assets = [
    asset(enemy, 'EnemyModel', {
      _id: 91,
      IsNamed: 0,
      IsUnique: 0,
      MaxUnitCount: 3,
      MaxUnitsInPlay: 6,
      Costs: [
        { Num: 1, Cost: 5 },
        { Num: 2, Cost: 9 },
        { Num: 3, Cost: 12 },
      ],
      LinkedEnemyId: 0,
      Traits: 0,
      Armor: 1,
      Health: 4,
      Sorcery: 1,
      Activations: instructions.map(ptr),
      SpecialActivations: [],
    }),
    ...instructions.map((id, n) =>
      asset(id, 'EnemyActivationModel', {
        _id: 100 + n,
        KeyActivation: 'invented-activation',
        KeyAltActivation: 'invented-alt',
        KeyInterruptActivation: 'invented-interrupt',
        KeyAttackFlavor: `invented-${n}`,
        KeyAttackAdditionalEffect: n === 1 ? 'invented-add' : '',
        MinGroupSize: n === 2 ? 2 : 1,
        MaxGroupSize: 3,
        Damage: [1, 2, 3].map((Size) => ({ Size, Physical: Size + n, Fear: n })),
      }),
    ),
    asset(logicGO, 'GameObject', {
      m_Component: [logic, yieldable, logicFSM].map((s) => ({ component: ptr(s) })),
    }),
    asset(logic, 'EnemyLogic', {
      m_GameObject: ptr(logicGO),
      Id: 0,
      Enemy: { m_FileID: 0, m_PathID: 0 },
    }),
    asset(yieldable, 'IYieldableComponent', {
      m_GameObject: ptr(logicGO),
      Fsm: { m_FileID: 0, m_PathID: 0 },
    }),
    asset(logicFSM, 'PlayMakerFSM', { m_GameObject: ptr(logicGO) }),
    asset(positionGO, 'GameObject', { m_Component: [{ component: ptr(tile.source) }] }),
    asset(tile.source, 'Tile', {
      m_GameObject: ptr(positionGO),
      Model: ptr(tile.modelSource),
      Spaces: spaces.map((s) => ptr(s.source)),
    }),
    ...spaces.map((s) => asset(s.source, 'TileSpace', { Tile: { m_FileID: 0, m_PathID: 0 } })),
    ...projection.context.heroes[0].items.map((i) =>
      asset(i.source, 'ItemModel', {
        _id: i.id,
        Type: i.catalogId === 'sword' ? 0 : 1,
        Is2Handed: 0,
        Level: 1,
      }),
    ),
  ];
  return {
    format: 'combat-source-v1',
    manifest: {
      scope: 'first-combat-kernel-v1',
      difficulty: 'normal',
      enemy,
      spawns: [{ source: fsm, state: 0, action: 0 }],
      files: [
        {
          file,
          sha256: projection.provenance.files.find((s) => s.file === file).sha256,
          externals: [],
        },
      ],
      mechanics: ['spawn-budget-v1', 'figure-hits-v1', 'counterattack-v1'].map((capability) => ({
        capability,
        file,
        locator: `invented:${capability}`,
        sha256: hash(capability),
      })),
    },
    projection,
    assets,
    globals: [],
    fsms: [
      {
        source: fsm,
        objectHash: hash('fsm raw'),
        start: 'invented-start',
        variables: [],
        handlers: {},
        deferredStates: [],
        states: [
          {
            index: 0,
            name: 'invented-start',
            transitions: { OK: 1, NO: 1 },
            actions: [
              {
                index: 0,
                type: 'FFG.JIME.Actions.SpawnEnemyGroup',
                enabled: true,
                parameterHash: hash(spawn),
                parameters: spawn,
              },
            ],
          },
          { index: 1, name: 'invented-return', transitions: {}, actions: [] },
        ],
      },
      {
        source: logicFSM,
        objectHash: hash('logic raw'),
        start: 'idle',
        variables: [],
        handlers: { DEFEATED: 1 },
        deferredStates: [],
        states: [
          { index: 0, name: 'idle', transitions: {}, actions: [] },
          { index: 1, name: 'done', transitions: {}, actions: [] },
        ],
      },
    ],
    items: projection.context.heroes[0].items.map((i, n) => ({
      id: i.catalogId,
      model: i.source,
      file,
      locator: `InventedSheet!${n + 1}`,
      cells: {
        B: '2',
        C: i.catalogId === 'sword' ? 'Weapon' : 'Armor',
        G: i.catalogId === 'sword' ? 'Might' : '-',
        I: i.catalogId === 'sword' ? '1' : '-',
        K:
          i.catalogId === 'sword'
            ? '1 Success: 2 hits\n1 Success: 2 hits\n2 Success: 5 hits, pierce\n2 Success: 3 hits, stun'
            : 'Invented support, owned by another consumer.',
      },
      ranged: false,
    })),
    texts: [0, 1, 2]
      .map((n) => ({
        key: `invented-${n}`,
        file,
        locator: `invented:${n}`,
        value: `Invented negate [might] instruction ${n}`,
        sha256: sha(`Invented negate [might] instruction ${n}`),
      }))
      .concat([
        {
          key: 'invented-add',
          file,
          locator: 'invented:add',
          value: 'Invented conditional benefit',
          sha256: sha('Invented conditional benefit'),
        },
      ]),
    additions: [
      {
        key: 'invented-add',
        textHash: sha('Invented conditional benefit'),
        operation: {
          kind: 'gain-boon',
          boon: 'emboldened',
          condition: 'damage-positive',
          window: 'enemy-attack-physical-result',
        },
      },
    ],
  };
}
export function rehashAsset(a) {
  a.dataHash = hash(a.data);
}
