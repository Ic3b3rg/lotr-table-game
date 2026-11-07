import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { catalogFixture } from './fixtures/catalog.mjs';
test('a purchased campaign copy revealed by the physical kernel has a readable card outside the fixed initial catalog', () => {
  const nodes = [];
  class Element {
    constructor(tag) {
      Object.assign(this, {
        tag,
        children: [],
        dataset: {},
        classList: { toggle() {} },
        style: { setProperty() {} },
        textContent: '',
      });
      nodes.push(this);
    }
    append(...children) {
      this.children.push(...children);
    }
    replaceChildren(...children) {
      this.children = children;
    }
    setAttribute(key, value) {
      this[key] = value;
    }
    addEventListener(key, value) {
      this[key] = value;
    }
  }
  const root = new Element('section'),
    document = { querySelector: () => root, createElement: (tag) => new Element(tag) };
  const code = buildSync({
      stdin: {
        resolveDir: process.cwd(),
        contents: "export {createPhysicalControls} from './src/client/physical';",
      },
      bundle: true,
      write: false,
      platform: 'browser',
      format: 'cjs',
    }).outputFiles[0].text,
    module = { exports: {} };
  runInNewContext(code, { module, exports: module.exports, document, queueMicrotask: () => {} });
  const catalog = catalogFixture(),
    card = { ...structuredClone(catalog.skills[0]), id: 'invented-purchased', kind: 'purchased' },
    read = [];
  const active = {
    kind: 'decision',
    mode: 'scout',
    heroId: 'hero-1',
    actorHeroId: 'hero-1',
    actorPlayerId: 'owner',
    title: 'Scoperta 3 inventata',
    options: [{ id: card.id + ':1', label: card.name.text }],
  };
  const session = {
    players: [{ id: 'owner', name: 'Ada inventata' }],
    scenario: {
      phase: 'setup',
      pack: { manifest: {} },
      battle: {},
      pending: { id: 'invented', kind: 'physical' },
    },
    preparation: { episode: { skills: [card] } },
    physical: {
      synthetic: false,
      decks: { damage: 28, fear: 28 },
      heroes: [],
      active,
      parents: [],
      fronts: [],
    },
  };
  module.exports
    .createPhysicalControls(() => {}, { card: (card) => read.push(card) })
    .update(session, null, catalog);
  const buttons = nodes.filter((n) => n.className === 'physical-card');
  assert.equal(buttons.length, 1);
  buttons[0].click();
  assert.equal(read[0].id, card.id);
  assert.equal(catalog.skills.length, 74);
  assert.ok(!catalog.skills.some((c) => c.id === card.id));
});
