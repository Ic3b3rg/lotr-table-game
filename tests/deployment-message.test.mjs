import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deploymentText } from '../dist/scenario-library.mjs';
import { compileSourceDeployment } from '../dist/combat-library.mjs';
import { deploymentSource } from './fixtures/source-deployment.mjs';
import { text } from './fixtures/scenario.mjs';

test('deployment packet inserts the plural model name and leaves modifiers in the group tracker', () => {
  const deployment = compileSourceDeployment(deploymentSource()),
    model = deployment.compiled.models[0],
    bonus = deployment.compiled.bonuses[0];
  const group = {
    id: 'invented-group',
    source: model.source,
    bonuses: [bonus.source],
    tokenId: 0,
    exhausted: false,
    logic: null,
    placed: true,
    spaceId: 'invented-space',
    tileSource: 'fixture.assets:400',
    position: [0, 0, 0],
    figures: [0, 1].map((n) => ({ id: `invented-figure-${n}`, ...model.stats })),
  };
  const state = {
    scenario: {
      pack: {
        manifest: { followup: { deployment, deploymentText: text('Colloca {count} {enemy}.') } },
      },
      enemies: { groups: [group] },
    },
  };
  const result = deploymentText(state, group.id)
    .map((t) => t.text ?? '')
    .join('');
  assert.equal(result, `Colloca 2 ${model.plural}.`);
  assert.deepEqual(group.bonuses, [bonus.source]);
});
