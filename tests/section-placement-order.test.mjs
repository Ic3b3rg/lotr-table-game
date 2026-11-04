import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sectionOrder } from '../dist/scenario-library.mjs';

test('section placement re-evaluates source connectivity after each tile without changing the frozen order', () => {
  const p = {
    sections: [
      {
        id: 2,
        tiles: [{ source: 'invented:a' }, { source: 'invented:b' }, { source: 'invented:c' }],
      },
    ],
    spaces: [
      { id: 'start', tileSource: 'invented:start', connected: ['c'] },
      { id: 'a', tileSource: 'invented:a', connected: ['b'] },
      { id: 'b', tileSource: 'invented:b', connected: ['a', 'c'] },
      { id: 'c', tileSource: 'invented:c', connected: ['start', 'b'] },
    ],
    movementGraph: { edges: [] },
  };
  const before = structuredClone(p);
  assert.deepEqual(sectionOrder(p, 2, new Set(['invented:start'])), [
    'invented:c',
    'invented:b',
    'invented:a',
  ]);
  assert.deepEqual(p, before);
});
