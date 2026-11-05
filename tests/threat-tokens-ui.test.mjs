import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { threatTokenCompilation } from './fixtures/threat-tokens.mjs';
const bundle = buildSync({
  stdin: {
    contents: `export {createEncounterInspection} from './src/client/encounter-inspection'; export {setOnline} from './src/client/actions'`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'cjs',
}).outputFiles[0].text;
function browser() {
  const nodes = [];
  class Element {
    constructor(tag = 'div') {
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
    append(...children) {
      this.children.push(...children);
    }
    replaceChildren(...children) {
      this.children = children;
    }
    setAttribute() {}
    getClientRects() {
      return [{}];
    }
    showModal() {
      this.open = true;
    }
    close() {
      this.open = false;
    }
  }
  const document = {
    createElement: (tag) => new Element(tag),
    createDocumentFragment: () => new Element('fragment'),
    querySelectorAll: () => nodes.filter((n) => n.dataset.write !== undefined),
  };
  const module = { exports: {} };
  runInNewContext(bundle, {
    module,
    exports: module.exports,
    document,
    HTMLElement: Element,
    crypto: {},
  });
  return { ...module.exports, Element, nodes };
}
test('both threat inspections close freely, expose one paid commitment, and respect owner and space without WebCrypto', async () => {
  for (const index of [0, 1]) {
    const b = browser(),
      pack = threatTokenCompilation().pack,
      cap = pack.manifest.threatTokens,
      p = pack.manifest.prefabs.find((p) => p.source === cap.encounters[index].prefab),
      i = {
        id: 'invented-token',
        definition: p.fsmSource,
        prefab: p.source,
        state: 82,
        variables: {},
        spaceId: 'source',
        visible: true,
        settled: true,
        stopped: false,
      };
    const actor = { id: 'invented-owner' },
      hero = { heroId: 'invented-hero', playerId: actor.id, inspiration: 2 };
    const s = {
      scenario: {
        id: 'invented-scenario',
        phase: 'action',
        pack,
        globals: {},
        instances: [i],
        spaceBindings: [{ sourceId: 'source', id: 'space' }],
        pending: null,
      },
      encounterFingerprints: { [i.id]: 'a'.repeat(64) },
      preparation: { heroes: [hero] },
      physical: { cycle: { heroes: [] } },
      round: {
        id: 'round',
        turnId: 'turn',
        phase: 'action',
        activeHeroId: hero.heroId,
        heroes: [{ heroId: hero.heroId, actionsUsed: 0 }],
      },
      journey: { heroes: [{ heroId: hero.heroId, spaceId: 'space' }], travel: { remaining: 1 } },
    };
    const intents = [],
      ui = b.createEncounterInspection(new b.Element(), async (c) => intents.push(c));
    b.setOnline(true);
    ui.update(s, actor);
    ui.open(i.id);
    const commit = b.nodes.find((n) => n.id === 'confirm-encounter'),
      dialog = b.nodes.find((n) => n.tag === 'dialog'),
      close = b.nodes.find((n) => n.tag === 'button' && n.id !== 'confirm-encounter'),
      before = structuredClone(s);
    close.onclick();
    assert.equal(dialog.open, false);
    assert.deepEqual(s, before);
    assert.deepEqual(intents, []);
    ui.open(i.id);
    assert.equal(commit.hidden, false);
    assert.equal(commit.disabled, false);
    await commit.onclick();
    assert.equal(intents.length, 1);
    assert.equal(intents[0].sourceFingerprint, s.encounterFingerprints[i.id]);
    assert.equal(intents[0].choiceEvent, undefined);
    ui.update(s, { id: 'foreign-owner' });
    ui.open(i.id);
    assert.equal(commit.disabled, true);
    close.onclick();
    assert.deepEqual(s, before);
    s.journey.heroes[0].spaceId = 'elsewhere';
    ui.update(s, actor);
    ui.open(i.id);
    assert.equal(commit.disabled, true);
    close.onclick();
    assert.equal(intents.length, 1);
  }
});
