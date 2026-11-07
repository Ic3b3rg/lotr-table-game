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
  assert.deepEqual(
    b.nodes.filter((n) => n.dataset.preparationHero).map((n) => n.dataset.preparationHero),
    ['hero-1', 'hero-2'],
  );
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
  const second = browser(),
    before = structuredClone(s);
  second.campPreparation(s, catalog, { id: 'p2' }, {}, () => {});
  assert.equal(
    second.nodes.find((n) => n.dataset.preparationHero)?.dataset.preparationHero,
    'hero-2',
    'the phone starts with its owner’s choices before the other heroes',
  );
  assert.deepEqual(
    second.nodes.filter((n) => n.dataset.campConfirm).map((n) => n.dataset.campConfirm),
    ['hero-2'],
  );
  assert.deepEqual(s, before, 'personal ordering does not mutate the shared company');
});

test('attested ready departure requires explicit group order agreement and sends only the native offer', () => {
  const b = browser(),
    s = fixture(),
    calls = [];
  s.campDeparture = {
    available: true,
    reason: 'Tutti pronti',
    fingerprint: 'b'.repeat(64),
    drawOrder: ['hero-1', 'hero-2'],
    target: 'Battaglia inventata',
  };
  b.campPreparation(s, campItemCatalog(), { id: 'p1' }, {}, (input) => calls.push(input));
  const depart = b.nodes.find((n) => n.dataset.campDepart !== undefined),
    agreed = b.nodes.find((n) => n.id === 'camp-departure-agreed');
  assert.ok(depart, 'Native departure control must replace the permanent gate');
  assert.ok(agreed, 'Group order needs a labelled agreement');
  assert.equal(depart.disabled, true);
  agreed.checked = true;
  agreed.onchange();
  assert.equal(depart.disabled, false);
  depart.onclick();
  assert.deepEqual(structuredClone(calls), [
    { kind: 'camp-depart', offerFingerprint: 'b'.repeat(64), agreed: true },
  ]);
});
