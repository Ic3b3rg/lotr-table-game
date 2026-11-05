import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { runInNewContext } from 'node:vm';

const bundle = buildSync({
  stdin: {
    contents: `export {createEncounterInspection} from './src/client/encounter-inspection';
      export {createExplorationInspection} from './src/client/exploration-inspection';
      export {createGuidedStart} from './src/client/guided-start';
      export {createJourneyMap} from './src/client/journey-map';
      export {createPhysicalControls} from './src/client/physical';
      export {createScenario} from './src/client/scenario';
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
      this.style = { setProperty() {} };
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
    createElementNS: (_namespace, tag) => new Element(tag),
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
    Element,
    ResizeObserver: class {
      observe() {}
    },
    requestAnimationFrame() {},
    matchMedia: () => ({ matches: false }),
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

test('the original guide and map preserve concluded turns without suggesting another turn', () => {
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
  s.mapGeneration = null;
  s.journey.definition = {
    label: 'Mappa inventata',
    width: 100,
    height: 100,
    spaces: [{ id: 'space-invented', label: 'Casella inventata', x: 50, y: 50, hexes: [] }],
    connections: [],
  };
  b.createJourneyMap(async () => {}).update(s, player, {
    heroes: [{ id: hero.heroId, name: { text: 'Eroe inventato' } }],
  });
  assert.match(b.document.querySelector('#map-status').textContent, /turni sono conclusi/);
  assert.doesNotMatch(b.document.querySelector('#map-status').textContent, /Inizia un turno/);
  assert.equal(b.document.querySelector('#map-personal-controls').hidden, true);
});

test('a frozen original phase source guides Shadow, owner scouting and the next round', () => {
  const b = browser(),
    s = session(),
    ui = b.createGuidedStart(async () => {});
  s.scenario.pack.manifest.rounds = { version: 'source-rounds-v1' };
  s.scenario.rounds = { active: 'phase', frames: [{ id: 'phase', stage: 'threat' }] };
  s.round.activeHeroId = null;
  s.round.heroes.forEach((h) => {
    h.turnEnded = true;
    h.rallyDone = false;
  });
  ui.update(s, player, { kind: 'available' });
  assert.match(b.document.querySelector('#start-instruction').textContent, /Ombra/);
  assert.equal(b.document.querySelector('#start-action').href, '#rounds');
  s.round.phase = 'shadow';
  ui.update(s, player, { kind: 'available' });
  assert.match(b.document.querySelector('#start-title').textContent, /Ombra/);
  assert.doesNotMatch(
    b.document.querySelector('#start-instruction').textContent,
    /manuale|non è ancora disponibile/,
  );
  s.round.phase = 'rally';
  ui.update(s, player, { kind: 'available' });
  assert.match(b.document.querySelector('#start-title').textContent, /Riorganizzazione/);
  assert.equal(b.document.querySelector('#start-action').href, '#scouting');
  s.round.heroes.forEach((h) => (h.rallyDone = true));
  ui.update(s, player, { kind: 'available' });
  assert.match(b.document.querySelector('#start-instruction').textContent, /nuovo round/);
  assert.equal(b.document.querySelector('#start-action').href, '#rounds');
});

test('a returned threat attempt guides only its own action turn and yields to the current round phase', () => {
  for (const role of ['retry', 'null-product']) {
    const b = browser(),
      s = session(),
      ui = b.createScenario(async () => {}, {}),
      content = { heroes: [{ id: hero.heroId, name: { text: 'Eroe inventato' } }] };
    s.physical = null;
    s.scenario.completedSetup = [];
    s.scenario.effects = [];
    s.scenario.globals = {};
    s.scenario.pack.manifest.rounds = { version: 'source-rounds-v1' };
    s.scenario.pack.manifest.threatTokens = {
      encounters: [{ role, prefab: s.scenario.instances[0].prefab }],
    };
    s.scenario.play = {
      active: null,
      lore: 0,
      tests: [],
      attempts: [
        {
          id: 'attempt-invented',
          instanceId: s.scenario.instances[0].id,
          heroId: hero.heroId,
          roundId: s.round.id,
          turnId: s.round.turnId,
          returned: true,
        },
      ],
    };
    const update = () => {
      ui.update(s, player, content, { available: false });
      return b.document.querySelector('#scenario-status').textContent;
    };
    assert.match(update(), role === 'retry' ? /nuova azione/ : /Interazione conclusa/);
    s.round.activeHeroId = null;
    s.round.heroes[0].turnEnded = true;
    assert.match(update(), /turni sono conclusi.*Ombra/);
    s.round.phase = 'shadow';
    assert.match(update(), /^Ombra/);
    s.round.phase = 'rally';
    assert.match(update(), /^Riorganizzazione/);
    s.round.phase = 'action';
    s.round.heroes[0].turnEnded = false;
    assert.match(update(), /scegliete il prossimo eroe/);
    s.round.activeHeroId = hero.heroId;
    s.round.id = 'next-round-invented';
    s.round.turnId = 'next-turn-invented';
    assert.match(update(), /Eroe inventato è di turno/);
    assert.doesNotMatch(update(), /segnalino resta|Interazione conclusa/);
  }
});

test('a source scouting request shows only its revealed skill faces with reader access', () => {
  const b = browser(),
    s = session();
  const skill = {
    id: 'skill-invented',
    number: 1,
    kind: 'basic',
    name: { text: 'Carta rivelata' },
    text: { text: 'Testo visibile inventato' },
  };
  s.physical = {
    synthetic: false,
    decks: { damage: 10, fear: 10 },
    heroes: [],
    parents: [],
    cycle: { pending: { type: 'START_RALLY_SCOUT' } },
    active: {
      kind: 'decision',
      mode: 'scout',
      heroId: hero.heroId,
      actorHeroId: hero.heroId,
      actorPlayerId: player.id,
      title: 'Scoperta inventata',
      options: [{ id: 'skill-invented:1', label: 'Carta rivelata' }],
    },
  };
  b.createPhysicalControls(() => {}, { openSkill() {} }).update(s, null, {
    heroes: [],
    skills: [skill],
  });
  assert.equal(b.nodes.filter((n) => n.className === 'physical-card').length, 1);
  assert.ok(b.nodes.some((n) => n.textContent === 'Testo visibile inventato'));
  s.physical.active = null;
  b.createPhysicalControls(() => {}, { openSkill() {} }).update(s, null, {
    heroes: [],
    skills: [skill],
  });
  assert.equal(
    b.document
      .querySelector('#physical-resolution')
      .children.some((n) => n.className?.includes('physical-scout-cards')),
    false,
  );
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
