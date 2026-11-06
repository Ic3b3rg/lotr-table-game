import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { campItemCatalog, addGroupCampCards } from './fixtures/camp-items.mjs';

test('the shared inventory panel and reader follow the effective common camp replacement while the concluded episode stays historical', () => {
  const catalog = campItemCatalog();
  addGroupCampCards(catalog);
  class Element {
    constructor(tag) {
      Object.assign(this, { tag, children: [], dataset: {}, textContent: '' });
    }
    append(...children) {
      this.children.push(...children);
    }
    replaceChildren(...children) {
      this.children = children;
    }
  }
  const root = new Element('section'),
    module = { exports: {} },
    bundle = buildSync({
      stdin: {
        contents: "export {createInventory} from './src/client/inventory';",
        resolveDir: process.cwd(),
      },
      bundle: true,
      write: false,
      platform: 'browser',
      format: 'cjs',
    }).outputFiles[0].text;
  runInNewContext(bundle, {
    module,
    exports: module.exports,
    document: { querySelector: () => root, createElement: (tag) => new Element(tag) },
  });
  const reads = [],
    inventory = module.exports.createInventory({ inventoryItem: (...args) => reads.push(args) }),
    session = {
      players: [],
      preparation: { heroes: [] },
      physical: {
        inventory: [
          { copy: 'trinket:1', cardId: 'trinket', heroId: null, remaining: null, capacity: 2 },
        ],
      },
      scenario: {
        pack: { manifest: { items: {} } },
        conclusion: {
          campaign: { inventory: [{ copy: 'trinket:1', cardId: 'trinket', modelId: 9003 }] },
        },
      },
    },
    episode = structuredClone(session.physical);
  inventory.update(session, catalog);
  session.scenario.conclusion.campaign.inventory = [
    { copy: 'invented-trinket-2:1', cardId: 'invented-trinket-2', modelId: 9004 },
  ];
  const before = structuredClone(session);
  inventory.update(session, catalog);
  const article = root.children.find((n) => n.dataset.itemCopy);
  assert.equal(article.dataset.itemCopy, 'invented-trinket-2:1');
  assert.equal(article.children[0].textContent, 'Accessorio comune migliorato inventato');
  article.children.find((n) => n.tag === 'button').onclick();
  assert.equal(reads[0][0].id, 'invented-trinket-2');
  assert.match(reads[0][2], /Inventario comune/);
  assert.match(reads[0][3], /rimossi al termine/);
  assert.deepEqual(session, before);
  assert.deepEqual(session.physical, episode);
});
