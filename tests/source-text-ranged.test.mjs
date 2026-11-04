import test from 'node:test';
import assert from 'node:assert/strict';
import { compileSourceText } from '../dist/scenario-library.mjs';

test('activation text renders the ranged symbol as a semantic icon without retaining private-use glyphs', () => {
  assert.deepEqual(compileSourceText('[i]\uf471[/i] Invented instruction.'), [
    { kind: 'icon', name: 'ranged' },
    { kind: 'text', text: ' Invented instruction.', style: 'plain' },
  ]);
  assert.throws(() => compileSourceText('\ueeee'), /Unknown source icon/);
});
