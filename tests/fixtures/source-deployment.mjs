import { hash } from './map-freeze.mjs';
import { digest } from '../../dist/map-freeze-library.mjs';

// Invented native records. No game model or identity/effect mapping.
export function deploymentSource() {
  const asset = (source, cls, data) => ({
    source,
    cls,
    data,
    objectHash: hash(source),
    dataHash: digest(data),
  });
  const model = (id, extra = {}) => ({
    _id: id,
    IsUnique: 0,
    IsNamed: 0,
    LinkedEnemyId: -1,
    MaxUnitCount: 3,
    MaxUnitsInPlay: 6,
    Traits: 4,
    Costs: [
      { Num: 1, Cost: 5 },
      { Num: 2, Cost: 9 },
      { Num: 3, Cost: 13 },
    ],
    Health: 4,
    Armor: 1,
    Sorcery: 0,
    Bonuses: [{ m_FileID: 0, m_PathID: 30 }],
    KeySingular: `EXAMPLE_${id}`,
    KeyPlural: `EXAMPLES_${id}`,
    ...extra,
  });
  return {
    version: 'source-deployment-v1',
    files: [{ file: 'fixture.assets', sha256: hash('file') }],
    products: ['fixture.assets:1'],
    adventure: 'fixture.assets:2',
    language: 'Italian',
    mechanics: {
      assemblyHash: hash('assembly'),
      method: '06001234',
      bodyHash: hash('body'),
      maxBonusCount: 2,
      normalBanners: [1, 2, 3],
      eliteBanners: [4, 5, 6],
    },
    assets: [
      asset('fixture.assets:1', 'ProductModel', {
        _id: 0,
        Enemies: [10, 11, 12].map((m_PathID) => ({ m_FileID: 0, m_PathID })),
      }),
      asset('fixture.assets:2', 'AdventureModel', {
        GlobalEnemyFilter: { MustHaveAny: 0, MustHaveAll: 0, ExcludeIfAny: 8 },
        BonusPref: 1,
        FigurePref: 1,
      }),
      asset('fixture.assets:10', 'EnemyModel', model(10)),
      asset('fixture.assets:11', 'EnemyModel', model(11, { Traits: 8 })),
      asset('fixture.assets:12', 'EnemyModel', model(12, { IsUnique: 1 })),
      asset('fixture.assets:30', 'EnemyBonusModel', {
        _id: 30,
        KeyName: 'EXAMPLE_BONUS',
        KeyDescription: 'EXAMPLE_RULE',
        Costs: [
          { Num: 1, Cost: 2 },
          { Num: 2, Cost: 3 },
          { Num: 3, Cost: 4 },
        ],
        Health: 1,
        Armor: 0,
        Sorcery: 1,
        Physical: 1,
        Fear: 0,
        Traits: 2,
        BlocksModifiers: 4,
        UnsupportedLanguage: { Italian: 0 },
      }),
    ],
    texts: {
      EXAMPLE_10: 'Sentinella di prova',
      EXAMPLES_10: 'Sentinelle di prova',
      EXAMPLE_BONUS: 'Bonus di prova',
      EXAMPLE_RULE: 'Regola inventata.',
    },
  };
}

export function deploymentContext(extra = {}) {
  return {
    id: 'deployment-example',
    entropy: hash('deployment-entropy'),
    cursor: 0,
    heroes: 3,
    threat: 18,
    limit: 70,
    points: 16,
    enemyPoints: 0,
    excludeGameEnemyPoints: false,
    filter: { MustHaveAny: 0, MustHaveAll: 0, ExcludeIfAny: 0 },
    sections: null,
    reserved: [],
    inPlay: [],
    spaces: [
      {
        id: 'example-space-a',
        sectionId: 0,
        tileSource: 'fixture.assets:40',
        position: [1, 2, 0],
        connected: ['example-space-b'],
        outside: true,
      },
      {
        id: 'example-space-b',
        sectionId: 0,
        tileSource: 'fixture.assets:40',
        position: [2, 3, 0],
        connected: ['example-space-a'],
        outside: true,
      },
    ],
    ...extra,
  };
}
