import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { runInNewContext } from 'node:vm';
test('a pending preparation trigger can render before the battle board is revealed, then show heroes and walls', () => {
  const nodes = [];
  class Element {
    constructor(tag) {
      Object.assign(this, {
        tag,
        dataset: {},
        children: [],
        style: { setProperty() {} },
        classList: { toggle() {} },
        clientWidth: 320,
        clientHeight: 200,
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
  }
  const byId = new Map(),
    document = {
      body: new Element('body'),
      querySelector(selector) {
        if (!byId.has(selector)) byId.set(selector, new Element('div'));
        return byId.get(selector);
      },
      createElement: (tag) => new Element(tag),
      createElementNS: (ns, tag) => new Element(tag),
    };
  const code = buildSync({
      stdin: {
        resolveDir: process.cwd(),
        contents: "export {createMapBoard} from './src/client/map-board';",
      },
      bundle: true,
      write: false,
      platform: 'browser',
      format: 'cjs',
    }).outputFiles[0].text,
    module = { exports: {} };
  runInNewContext(code, {
    module,
    exports: module.exports,
    document,
    Element,
    ResizeObserver: class {
      observe() {}
    },
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame: () => {},
  });
  const board = module.exports.createMapBoard(() => {}),
    hero = { heroId: 'invented-hero', spaceId: 'invented-cell' },
    catalog = { heroes: [{ id: hero.heroId, name: { text: 'Eroe inventato' } }] },
    definition = { width: 400, height: 200, spaces: [], connections: [] };
  board.draw(definition, [hero], catalog);
  assert.doesNotThrow(() => board.update([hero], null, ''));
  assert.equal(nodes.find((n) => n.dataset.heroId === hero.heroId).hidden, true);
  board.draw(
    {
      ...definition,
      spaces: [
        {
          id: hero.spaceId,
          label: 'Casella inventata',
          x: 100,
          y: 100,
          hexes: [
            {
              polygon: [
                { x: 0, y: 0 },
                { x: 200, y: 0 },
                { x: 200, y: 200 },
                { x: 0, y: 200 },
              ],
            },
          ],
        },
      ],
      walls: [{ id: 'wall', a: { x: 200, y: 0 }, b: { x: 200, y: 200 } }],
    },
    [hero],
    catalog,
  );
  board.update([hero], hero.heroId, '');
  assert.equal(nodes.filter((n) => n.dataset.heroId === hero.heroId).at(-1).hidden, false);
  const drawing = nodes.filter((n) => n.tag === 'svg').at(-1);
  assert.equal(
    drawing.children.at(-1).class,
    'map-wall',
    'Walls must remain visible above the filled cells',
  );
});
