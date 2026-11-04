import { createHash } from 'node:crypto';
import { digest } from '../../dist/map-freeze-library.mjs';
import { deploymentSource } from './source-deployment.mjs';
import { compileSourceDeployment } from '../../dist/combat-library.mjs';
export const sha = (s) => createHash('sha256').update(s).digest('hex');
export function closureFixture() {
  const deployment = deploymentSource();
  const m = deployment.assets.find((a) => a.source === 'fixture.assets:10');
  m.data.Activations = [50, 51].map((m_PathID) => ({ m_FileID: 0, m_PathID }));
  m.data.SpecialActivations = [];
  m.dataHash = digest(m.data);
  const bonus = deployment.assets.find((a) => a.cls === 'EnemyBonusModel');
  bonus.data.BlocksModifiers = 16;
  bonus.data.Physical = 1;
  bonus.dataHash = digest(bonus.data);
  const asset = (source, cls, data) => ({
    source,
    cls,
    data,
    objectHash: sha(source),
    dataHash: digest(data),
  });
  const text = (key, value) => ({
    key,
    value,
    file: 'fixture.assets',
    locator: key,
    sha256: sha(value),
  });
  return {
    format: 'combat-closure-v1',
    evidenceHash: sha('invented evidence'),
    projectionFingerprint: sha('invented projection'),
    deploymentFingerprint: compileSourceDeployment(deployment).fingerprint,
    files: deployment.files,
    models: ['fixture.assets:10'],
    assets: [
      m,
      bonus,
      ...[50, 51].map((n, index) =>
        asset(`fixture.assets:${n}`, 'EnemyActivationModel', {
          _id: index,
          MinGroupSize: index ? 2 : 1,
          MaxGroupSize: 3,
          KeyAttackFlavor: `instruction-${n}`,
          KeyAttackAdditionalEffect: index ? 'extra' : '',
          Damage: [
            { Size: 1, Physical: 2, Fear: 1 },
            { Size: 2, Physical: 3, Fear: 2 },
            { Size: 3, Physical: 4, Fear: 3 },
          ],
        }),
      ),
    ],
    texts: [
      text('instruction-50', 'Invented blow. [might] negates.'),
      text('instruction-51', 'Invented blow. [spirit] negates.'),
      text('extra', 'Invented extra consequence.'),
    ],
    additions: [
      {
        key: 'extra',
        textHash: sha('Invented extra consequence.'),
        predicate: 'damage-positive',
        window: 'condition-known',
        effect: { op: 'discard-inspiration', amount: 1 },
      },
    ],
    items: [
      {
        id: 'invented-weapon',
        model: 'fixture.assets:90',
        definitionHash: sha('invented weapon'),
        originalHash: sha('invented row'),
        file: 'fixture.assets',
        locator: 'Invented!K1',
        ranged: false,
        stat: 'might',
        body: '1 Success: 2 hits\n2 Successes: 3 hits, stun',
      },
    ],
    clauses: [],
    heroes: [],
    definitions: [],
  };
}
export function groupFixture() {
  return {
    id: 'invented-group',
    source: 'fixture.assets:10',
    bonuses: ['fixture.assets:30'],
    tokenId: 4,
    exhausted: false,
    logic: null,
    placed: true,
    spaceId: 'invented-space',
    tileSource: 'fixture.assets:40',
    position: [0, 0, 0],
    attackReduction: 0,
    figures: [0, 1].map((n) => ({ id: `invented-figure-${n}`, health: 4, armor: 1, sorcery: 0 })),
  };
}
