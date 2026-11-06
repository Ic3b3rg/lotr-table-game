import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { campItemCatalog } from './fixtures/camp-items.mjs';
import { preparationCompilation } from './fixtures/camp-preparation.mjs';

function browser() {
  const code = buildSync({
    stdin: {
      contents: "export {campPreparation} from './src/client/camp-preparation';",
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'cjs',
  }).outputFiles[0].text;
  const nodes = [];
  class Element {
    constructor(tag) {
      Object.assign(this, { tag, children: [], dataset: {}, textContent: '', disabled: false });
      nodes.push(this);
    }
    append(...children) {
      this.children.push(...children);
    }
    setAttribute(name, value) {
      this[name] = value;
    }
    addEventListener(name, callback) {
      this[name] = callback;
    }
    focus() {
      this.focused = true;
    }
  }
  const module = { exports: {} };
  runInNewContext(code, {
    module,
    exports: module.exports,
    document: { createElement: (tag) => new Element(tag) },
  });
  return { ...module.exports, nodes };
}
function fixture() {
  const pack = preparationCompilation().pack;
  const heroes = [1, 2].map((n) => ({
    heroId: `hero-${n}`,
    roleId: `role-${n}`,
    itemCopies: [`sword:${n}`],
    titleCopies: [],
  }));
  return {
    players: [
      { id: 'p1', name: 'Prima' },
      { id: 'p2', name: 'Seconda' },
    ],
    preparation: {
      heroes: [
        { heroId: 'hero-1', playerId: 'p1' },
        { heroId: 'hero-2', playerId: 'p2' },
      ],
    },
    scenario: {
      pack,
      conclusion: {
        stage: 'camp-preparation',
        campaign: {
          heroes,
          inventory: [],
          preparation: {
            heroes: heroes.map((h) => ({
              heroId: h.heroId,
              accessory: null,
              summaryHash: 'a'.repeat(64),
              confirmedRevision: null,
              recipe: {
                roleId: h.roleId,
                cards: [],
                futurePrepared: null,
                weakness: { count: 1, source: 'future-common-draw' },
                itemCopies: h.itemCopies,
                balances: [],
                gate: null,
              },
            })),
          },
        },
      },
    },
  };
}
test('preparation presents personal ownership and occupied-role consequences; anonymous view cannot write', () => {
  const b = browser(),
    s = fixture(),
    catalog = campItemCatalog();
  b.campPreparation(s, catalog, null, {}, () => {});
  assert.equal(b.nodes.filter((n) => n.dataset.write !== undefined).length, 0);
  assert.ok(b.nodes.some((n) => n.textContent.includes('Prima')));
  const own = browser();
  own.campPreparation(s, catalog, { id: 'p1' }, {}, () => {});
  assert.equal(own.nodes.filter((n) => n.dataset.campConfirm !== undefined).length, 1);
  assert.ok(own.nodes.some((n) => n.textContent.includes('senza ruolo')));
  assert.ok(
    own.nodes.some((n) => n.textContent.includes('debolezza') && n.textContent.includes('futura')),
  );
  assert.ok(
    own.nodes.some(
      (n) => n.textContent.includes('partenza') && n.textContent.includes('disponibile'),
    ),
  );
});
