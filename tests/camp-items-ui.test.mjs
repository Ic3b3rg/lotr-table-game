import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { campItemCatalog, attachCampItems } from './fixtures/camp-items.mjs';
import { campCompilation } from './fixtures/camp-skills.mjs';

function browser() {
  const bundle = buildSync({
    stdin: {
      contents:
        "export {campItemInventory} from './src/client/camp-items'; export {setOnline} from './src/client/actions';",
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
      Object.assign(this, {
        tag,
        children: [],
        dataset: {},
        textContent: '',
        hidden: false,
        disabled: false,
      });
      nodes.push(this);
    }
    append(...values) {
      this.children.push(...values);
    }
    replaceChildren(...values) {
      this.children = values;
    }
    addEventListener(name, callback) {
      this[name] = callback;
    }
    setAttribute(name, value) {
      this[name] = value;
    }
    focus() {
      this.focused = true;
    }
  }
  const module = { exports: {} };
  runInNewContext(bundle, {
    module,
    exports: module.exports,
    document: {
      createElement: (tag) => new Element(tag),
      querySelectorAll: () =>
        nodes.filter((n) => n.tag === 'button' && n.dataset.write !== undefined),
    },
  });
  return { ...module.exports, nodes };
}
function fixture() {
  const catalog = campItemCatalog(),
    pack = campCompilation().pack;
  attachCampItems(pack, catalog);
  return {
    catalog,
    session: {
      players: [
        { id: 'owner-1', name: 'Prima persona' },
        { id: 'owner-2', name: 'Seconda persona' },
      ],
      preparation: {
        heroes: [
          { heroId: 'hero-1', playerId: 'owner-1' },
          { heroId: 'hero-2', playerId: 'owner-2' },
        ],
      },
      scenario: {
        pack,
        play: { lore: 3 },
        conclusion: {
          stage: 'camp',
          campaign: {
            heroes: [
              { heroId: 'hero-1', itemCopies: ['sword:1', 'armor:1'] },
              { heroId: 'hero-2', itemCopies: ['sword:2', 'armor:2'] },
            ],
            inventory: [],
          },
        },
      },
    },
  };
}
test('camp item UI reads alternatives freely, requires explicit confirmation, and cancel returns focus without sending an intent', async () => {
  const b = browser(),
    f = fixture(),
    intents = [],
    readings = [];
  b.campItemInventory(
    f.session,
    f.catalog,
    'hero-1',
    { id: 'owner-1' },
    { campItem: (...args) => readings.push(args) },
    async (input) => {
      intents.push(input);
      return true;
    },
  );
  b.setOnline(true);
  const choice = b.nodes.find((n) => n.dataset.campUpgrade === 'advanced:1');
  assert.equal(choice.disabled, false);
  const card = b.nodes.find((n) => n.className === 'physical-card');
  card.click();
  assert.equal(readings.length, 1);
  choice.onclick();
  assert.equal(intents.length, 0);
  const cancel = b.nodes.find((n) => n.dataset.campCancel === 'sword:1');
  cancel.onclick();
  assert.equal(intents.length, 0);
  assert.equal(choice.focused, true);
  choice.onclick();
  const confirm = b.nodes.find((n) => n.dataset.campConfirm === 'sword:1');
  await confirm.onclick();
  assert.deepEqual(JSON.parse(JSON.stringify(intents)), [
    { kind: 'camp-item', heroId: 'hero-1', copy: 'sword:1', upgrade: 'advanced:1' },
  ]);
  assert.ok(b.nodes.some((n) => n.textContent.includes('3') && n.textContent.includes('Sapienza')));
});
