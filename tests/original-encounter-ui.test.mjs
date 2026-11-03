import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { runInNewContext } from 'node:vm';

const bundle = buildSync({
  stdin: {
    contents: `export {createEncounterInspection} from './src/client/encounter-inspection';
      export {createExplorationInspection} from './src/client/exploration-inspection';
      export {createGuidedStart} from './src/client/guided-start';
      export {setOnline} from './src/client/actions';`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  write: false,
}).outputFiles[0].text;

function browser() {
  const nodes = [],
    elements = new Map();
  class Element {
    constructor(tag = 'div') {
      this.tag = tag;
      this.children = [];
      this.childNodes = this.children;
      this.dataset = {};
      this.textContent = '';
      this.hidden = false;
      this.disabled = false;
      this.checked = false;
      this.value = '';
      this.classList = { add() {}, toggle() {} };
      nodes.push(this);
    }
    append(...children) {
      this.children.push(...children);
    }
    replaceChildren(...children) {
      this.children.splice(0, this.children.length, ...children);
    }
    get lastElementChild() {
      return this.children.at(-1);
    }
    setAttribute() {}
    removeAttribute() {}
    addEventListener() {}
    focus() {}
    scrollIntoView() {}
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
    body: new Element(),
    createElement: (tag) => new Element(tag),
    createDocumentFragment: () => new Element('fragment'),
    querySelector: (selector) => {
      if (!elements.has(selector)) elements.set(selector, new Element());
      return elements.get(selector);
    },
    querySelectorAll: (selector) =>
      selector === 'button[data-write]'
        ? nodes.filter((n) => n.tag === 'button' && n.dataset.write !== undefined)
        : [],
  };
  document
    .querySelector('#start-progress')
    .append(...Array.from({ length: 6 }, () => new Element()));
  const module = { exports: {} };
  runInNewContext(bundle, {
    module,
    exports: module.exports,
    document,
    HTMLElement: Element,
    location: { pathname: '/join' },
    localStorage: { getItem: () => null, setItem() {} },
    crypto: {}, // The HTTP LAN origin has no SubtleCrypto.
    TextEncoder,
  });
  return { ...module.exports, document, nodes, Element };
}

const player = { id: 'player-invented', name: 'Ada' },
  hero = { heroId: 'hero-invented', playerId: player.id, roleId: 'role-invented', inspiration: 2 };
function session() {
  const instance = {
    id: 'node-invented',
    prefab: 'prefab-invented',
    definition: 'definition-invented',
    state: 0,
    spaceId: 'source-space',
    stopped: false,
    visible: true,
    settled: true,
  };
  return {
    generation: 'generation-invented',
    players: [player],
    group: { expectedPlayers: 1 },
    preparation: { status: 'prepared', heroes: [hero] },
    mapGeneration: { status: 'frozen' },
    encounterFingerprints: { [instance.id]: 'a'.repeat(64) },
    scenario: {
      id: 'scenario-invented',
      phase: 'action',
      pending: null,
      pack: {
        name: 'Avventura inventata',
        manifest: {
          scope: 'original-encounter-v1',
          playablePrefabs: [instance.prefab],
          prefabs: [{ source: instance.prefab, nodeType: 'threat', inspection: [] }],
        },
        definitions: [
          {
            source: instance.definition,
            states: [
              { index: 0, transitions: { 'NODE CLICKED': 1 } },
              { index: 1, actions: [{ op: 'confirm', label: [], text: [] }] },
            ],
          },
        ],
      },
      instances: [instance],
      spaceBindings: [{ sourceId: instance.spaceId, id: 'space-invented' }],
    },
    physical: { cycle: { pending: null, heroes: [] } },
    round: {
      id: 'round-invented',
      number: 1,
      phase: 'action',
      activeHeroId: hero.heroId,
      turnId: 'turn-invented',
      heroes: [{ heroId: hero.heroId, actionsUsed: 1, turnEnded: false }],
    },
    journey: {
      heroes: [{ heroId: hero.heroId, spaceId: 'space-invented' }],
      travel: { remaining: 1 },
    },
  };
}

test('the encounter confirmation submits the host fingerprint without WebCrypto on HTTP LAN', async () => {
  const b = browser(),
    s = session(),
    intents = [];
  const ui = b.createEncounterInspection(new b.Element(), async (intent) => intents.push(intent));
  b.setOnline(true);
  ui.update(s, player);
  ui.open('node-invented');
  const confirm = b.nodes.find((n) => n.id === 'confirm-encounter');
  assert.equal(confirm.disabled, false);
  await confirm.onclick();
  assert.equal(intents.length, 1);
  assert.equal(intents[0].sourceFingerprint, s.encounterFingerprints['node-invented']);
  assert.equal(intents[0].heroId, hero.heroId);
});

test('an ordinary physical continuation retains the owner and decision as the guided next step', () => {
  const b = browser(),
    s = session();
  s.physical.active = { kind: 'decision', actorPlayerId: player.id };
  s.physical.cycle.pending = { type: 'END_TURN' };
  b.createGuidedStart(async () => {}).update(s, player, { kind: 'available' });
  assert.match(b.document.querySelector('#start-title').textContent, /capacità in corso/);
  assert.match(
    b.document.querySelector('#start-instruction').textContent,
    /Ada.*risolve la decisione/,
  );
  assert.equal(b.document.querySelector('#start-action').href, '#scenario');
});

test('the original guide explains the unavailable Shadow after every turn and token have concluded', () => {
  const b = browser(),
    s = session();
  s.round.activeHeroId = null;
  s.round.heroes[0].turnEnded = true;
  s.scenario.instances[0].visible = false;
  s.scenario.instances[0].stopped = true;
  b.createGuidedStart(async () => {}).update(s, player, { kind: 'available' });
  assert.match(b.document.querySelector('#start-title').textContent, /turni sono conclusi/);
  assert.match(
    b.document.querySelector('#start-instruction').textContent,
    /Ombra.*non.*disponibile/,
  );
  assert.doesNotMatch(
    b.document.querySelector('#start-instruction').textContent,
    /Scegliete il prossimo turno|segnalino.*disponibile/,
  );
  assert.equal(b.document.querySelector('#start-action').href, '#scenario');
});

test('exploration remains the guided next step with its owner, paid movement and residual budget', () => {
  const b = browser(),
    s = session();
  s.scenario.explorations = {
    active: 'frame',
    attempts: [
      {
        id: 'frame',
        heroId: hero.heroId,
        playerId: player.id,
        movementCost: 1,
        actionCost: 0,
        movesRemaining: 1,
      },
    ],
  };
  s.scenario.pending = { kind: 'exploration-intro', heroId: hero.heroId, actorPlayerId: player.id };
  b.createGuidedStart(async () => {}).update(s, player, { kind: 'available' });
  assert.match(b.document.querySelector('#start-title').textContent, /Esplora/);
  assert.match(
    b.document.querySelector('#start-instruction').textContent,
    /Ada.*1 movimento.*1.*residu/,
  );
  assert.doesNotMatch(b.document.querySelector('#start-instruction').textContent, /interazione/);
  assert.equal(b.document.querySelector('#start-action').href, '#scenario');
});

test('exploration source inspection cancels freely and commits the host fingerprint with no WebCrypto', async () => {
  const b = browser(),
    s = session(),
    intents = [];
  s.revision = 9;
  s.journey.definition = {
    spaces: [
      { id: 'space-invented', label: 'Origine inventata' },
      { id: 'new-space', label: 'Tessera inventata' },
    ],
    connections: [['space-invented', 'new-space']],
  };
  s.explorationFingerprints = { 'new-space': 'c'.repeat(64) };
  s.scenario.pack.manifest.exploration = { definition: 'template-invented' };
  s.scenario.pack.definitions.push({
    source: 'template-invented',
    handlers: { 'NODE CLICKED': 1 },
    states: [{ index: 1, actions: [{ op: 'confirm', label: [], cancelLabel: [], text: [] }] }],
  });
  const before = structuredClone(s),
    ui = b.createExplorationInspection(new b.Element(), async (intent) => intents.push(intent));
  b.setOnline(true);
  ui.update(s, player, null);
  ui.open('new-space');
  const cancel = b.nodes.find((n) => n.id === 'cancel-exploration'),
    confirm = b.nodes.find((n) => n.id === 'confirm-exploration');
  assert.equal(confirm.disabled, false);
  cancel.onclick();
  assert.equal(intents.length, 0);
  assert.deepEqual(s, before);
  ui.open('new-space');
  await confirm.onclick();
  assert.equal(intents.length, 1);
  assert.equal(intents[0].type, 'EXPLORE_SCENARIO');
  assert.equal(intents[0].sourceFingerprint, s.explorationFingerprints['new-space']);
  assert.equal(intents[0].heroId, hero.heroId);
  assert.equal(intents[0].fromSpaceId, 'space-invented');
  assert.equal(intents[0].destinationSpaceId, 'new-space');
});
