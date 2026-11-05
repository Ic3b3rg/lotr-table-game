import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { missionCompilation } from './fixtures/mission-combat.mjs';
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
test('the mission inspection exposes all three source commitments and cancel is free for every observer', async () => {
  const b = browser(),
    pack = missionCompilation().pack,
    cap = pack.manifest.firstCombat,
    p = pack.manifest.prefabs.find((p) => p.source === cap.prefab),
    i = {
      id: 'invented-person',
      definition: p.fsmSource,
      prefab: p.source,
      state: 0,
      variables: {},
      spaceId: 'source',
      visible: true,
      settled: true,
      stopped: false,
    },
    actor = { id: 'invented-owner' },
    hero = { heroId: 'invented-hero', playerId: actor.id, inspiration: 2 },
    s = {
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
  const choices = () =>
    b.nodes
      .find((n) => n.id === 'encounter-choices')
      .children.filter((n) => n.dataset.encounterChoice && !n.hidden && !n.disabled);
  assert.deepEqual(
    choices()
      .map((n) => n.dataset.encounterChoice)
      .sort(),
    ['PUSH', 'SLIP', 'TALK'],
  );
  const before = structuredClone(s);
  for (const event of ['PUSH', 'SLIP', 'TALK']) {
    ui.open(i.id);
    await choices()
      .find((n) => n.dataset.encounterChoice === event)
      .onclick();
    assert.equal(intents.at(-1).choiceEvent, event);
    assert.equal(intents.at(-1).heroId, hero.heroId);
    assert.equal(intents.at(-1).sourceFingerprint, s.encounterFingerprints[i.id]);
  }
  assert.deepEqual(s, before);
  ui.open(i.id);
  b.nodes
    .find((n) => n.tag === 'button' && n.id !== 'confirm-encounter' && !n.dataset.encounterChoice)
    .onclick();
  assert.equal(b.nodes.find((n) => n.tag === 'dialog').open, false);
  assert.equal(intents.length, 3);
  assert.deepEqual(s, before);
  ui.update(s, { id: 'invented-observer' });
  ui.open(i.id);
  assert.equal(choices().length, 0);
  assert.deepEqual(s, before);
});
