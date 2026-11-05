import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { catalogFixture } from './fixtures/catalog.mjs';
import { campCompilation } from './fixtures/camp-skills.mjs';

function browser() {
  const bundle = buildSync({
    stdin: {
      contents:
        "export {campSkillShop} from './src/client/camp-skills'; export {setOnline, refreshActions} from './src/client/actions';",
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
    addEventListener(name, callback) {
      this[name] = callback;
    }
    setAttribute(name, value) {
      this[name] = value;
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
    HTMLElement: Element,
  });
  return { ...module.exports, nodes };
}
function fixture() {
  const catalog = catalogFixture(),
    pack = campCompilation().pack;
  return {
    catalog,
    session: {
      players: [
        { id: 'owner-1', name: 'Persona uno' },
        { id: 'owner-2', name: 'Persona due' },
      ],
      preparation: {
        heroes: [
          { heroId: 'hero-1', playerId: 'owner-1' },
          { heroId: 'hero-2', playerId: 'owner-2' },
        ],
      },
      scenario: {
        pack,
        conclusion: {
          stage: 'camp',
          campaign: {
            heroes: [
              { heroId: 'hero-1', roleId: 'role-2', skillCopies: [] },
              { heroId: 'hero-2', roleId: 'role-3', skillCopies: [] },
            ],
            training: {
              balances: [
                { heroId: 'hero-1', roleId: 'role-1', availableXP: 2 },
                { heroId: 'hero-2', roleId: 'role-1', availableXP: 4 },
              ],
            },
          },
        },
      },
    },
  };
}
test('camp UI offers a real bound purchase, reader price and role balance; other devices and shared PC only observe', () => {
  for (const player of [{ id: 'owner-1' }, { id: 'owner-2' }, null]) {
    const b = browser(),
      f = fixture(),
      intents = [],
      readings = [];
    b.campSkillShop(
      f.session,
      f.catalog,
      'hero-1',
      player,
      { campSkill: (...args) => readings.push(args) },
      (input) => intents.push(input),
    );
    b.setOnline(true);
    const buttons = b.nodes.filter((n) => n.dataset.campOperation === 'buy');
    assert.equal(buttons.length, 9);
    assert.equal(buttons[0].disabled, player?.id !== 'owner-1');
    assert.equal(buttons[1].disabled, true, 'insufficient role XP');
    const reader = b.nodes.find((n) => n.className === 'physical-card');
    reader.click();
    assert.equal(readings.length, 1);
    assert.equal(readings[0][0].cost, 2);
    if (player?.id === 'owner-1') {
      buttons[0].onclick();
      assert.deepEqual(JSON.parse(JSON.stringify(intents)), [
        {
          kind: 'camp-skill',
          heroId: 'hero-1',
          roleId: 'role-1',
          copy: 'invented-upgrade-1-4:1',
          operation: 'buy',
        },
      ]);
    }
    assert.ok(b.nodes.some((n) => n.textContent.includes('2 XP')));
  }
});
test('UI uses whole company ownership and offers sale only for the real holder, even after role change', () => {
  const b = browser(),
    f = fixture();
  f.session.scenario.conclusion.campaign.heroes[1].skillCopies.push('invented-upgrade-1-4:1');
  b.campSkillShop(f.session, f.catalog, 'hero-1', { id: 'owner-1' }, {}, () => {});
  assert.equal(b.nodes.find((n) => n.dataset.campOperation === 'buy').disabled, true);
  assert.ok(b.nodes.some((n) => n.textContent.includes('Eroe 2')));
  const holder = browser();
  holder.campSkillShop(f.session, f.catalog, 'hero-2', { id: 'owner-2' }, {}, () => {});
  assert.equal(holder.nodes.find((n) => n.dataset.campOperation === 'sell').disabled, false);
});
