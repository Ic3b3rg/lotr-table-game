// Entirely invented identities, graph, prose, card and quantities. Not source acceptance.
import { state, action, text } from './scenario.mjs';
import {
  clueCompilerFixture,
  native,
  local,
  global,
  literal,
  message,
} from './clue-progression.mjs';
import { attachFailure } from './adventure-failure.mjs';
import { certificates } from './exploration.mjs';
import { hash } from './map-freeze.mjs';
import { lastStandFixture } from './last-stand.mjs';

export function linkedTitle(raw = lastStandFixture().raw) {
  const card =
    raw.cards.find((c) => c.family === 'title' && c.order === 2) ??
    raw.cards.filter((c) => c.family === 'title')[2];
  card.text.value =
    'Quando attacchi nella prova inventata, puoi rimuovere questa abilità dall’avventura per scegliere un modificatore.';
  return {
    cardId: card.id,
    cardHash: hash(card),
    titleModel: {
      source: card.binding.value.titleModel.locator,
      modelId: card.binding.value.titleModel.modelId,
    },
    skillModel: {
      source: card.binding.value.skillModels[0].locator,
      modelId: card.binding.value.skillModels[0].modelId,
    },
    policy: {
      window: 'when-attacking',
      effect: 'choose-attack-modifier',
      cost: 'remove-from-adventure',
    },
    alreadyOwned: 'Il riconoscimento inventato è già della Compagnia.',
  };
}
export function attachLinked(pack, title = linkedTitle()) {
  const template = pack.manifest.prefabs[0];
  if (!pack.sources.some((s) => s.file === 'PlayMaker.dll'))
    pack.sources.push({
      file: 'PlayMaker.dll',
      sha256: pack.manifest.failure.methods.signal.assemblyHash,
    });
  const add = (suffix, variables, handlers, states) => {
    const p = {
      ...structuredClone(template),
      source: `example.assets:46${suffix}`,
      fsmSource: `example.assets:76${suffix}`,
      inspection: text(`Luogo collegato inventato ${suffix}`),
      nodeType: 'search',
      capabilities: ['physical-effects'],
    };
    const d = {
      source: p.fsmSource,
      initial: 10,
      variables,
      handlers,
      deferredHandlers: {},
      states,
    };
    pack.manifest.prefabs.push(p);
    pack.definitions.push(d);
    return { p, d };
  };
  const confirm = native(0, 'confirm', 'FFG.JIME.Actions.DisplayMessageCancelConfirm', {
    text: text('Visita il laboratorio inventato?'),
    label: text('Visita · 1 azione'),
    cancelLabel: text('Chiudi'),
    confirmEvent: 'ENTER',
    cancelEvent: 'BACK',
  });
  const choice = (value, options, cancel = 'LEAVE') =>
    native(0, 'choice', 'FFG.JIME.Actions.DisplayMessageMultipleChoice', {
      text: text(value),
      options,
      cancel: cancel ? { event: cancel, label: text('Allontanati') } : null,
    });
  const test = (stat, target) =>
    native(0, 'sourceTest', 'FFG.JIME.Actions.DisplayMessageCancelConfirm', {
      text: text(`Prova inventata di ${stat}, difficoltà ${target}.`),
      stat,
      target,
      passEvent: 'YES',
      failEvent: 'NO',
    });
  const stop = () => [action(0, 'stop'), action(1, 'hideNode')];
  const visit = add(
    '011',
    [
      { name: 'seen', type: 'bool', value: false },
      { name: 'supplied', type: 'bool', value: false },
      { name: 'recipient', type: 'int', value: 0 },
    ],
    { REVEALED: 11, INVENTED_SUPPLIED: 80 },
    [
      state(10, [], { 'NODE CLICKED': 20 }),
      state(11, [message(0, 'Colloca il laboratorio inventato.')], { FINISHED: 12 }),
      state(12, [action(0, 'release')], { FINISHED: 10 }),
      state(
        20,
        [action(0, 'branchBool', { ref: local('seen'), trueEvent: 'OLD', falseEvent: 'NEW' })],
        { OLD: 60, NEW: 21 },
      ),
      state(21, [confirm], { ENTER: 30, BACK: 10 }),
      state(
        30,
        [
          choice('Puoi studiare un segnale inventato oppure lasciare.', [
            { event: 'STUDY', label: text('Studia il segnale') },
          ]),
        ],
        { STUDY: 31, LEAVE: 40 },
      ),
      state(31, [test('wisdom', 1)], { YES: 32, NO: 33 }),
      state(32, [message(0, 'Ottieni l’ispirazione inventata.', { inspiration: 1 })], {
        FINISHED: 40,
      }),
      state(33, [message(0, 'Il segnale inventato rimane incompleto.')], { FINISHED: 40 }),
      state(
        40,
        [
          action(0, 'flip', { target: local('seen') }),
          action(1, 'broadcast', { event: 'INVENTED_VISITED' }),
          action(2, 'broadcast', { event: 'INVENTED_REVEAL' }),
        ],
        { FINISHED: 10 },
      ),
      state(
        60,
        [
          choice('Ritorno al laboratorio inventato.', [
            {
              event: 'DELIVER',
              label: text('Consegna · 1 azione'),
              requirement: local('supplied'),
              cost: 'interact',
            },
          ]),
        ],
        { DELIVER: 61, LEAVE: 10 },
      ),
      state(61, [action(0, 'addInt', { target: global('inventedThreat'), value: literal(-4) })], {
        FINISHED: 62,
      }),
      state(62, [message(0, 'Il segnale inventato è ripristinato.')], { FINISHED: 63 }),
      state(
        63,
        [
          native(0, 'chooseHero', 'FFG.JIME.Actions.DisplayMessagePlayerChoice', {
            text: text('Scegli chi riceve il riconoscimento inventato.'),
            target: local('recipient'),
          }),
        ],
        { FINISHED: 64 },
      ),
      state(
        64,
        [
          native(0, 'awardTitle', 'FFG.JIME.Actions.AwardTitle', {
            recipient: local('recipient'),
            titleModel: title.titleModel.source,
          }),
        ],
        { FINISHED: 65 },
      ),
      state(65, stop()),
      state(
        80,
        [action(0, 'set', { target: local('supplied'), value: true }), action(1, 'release')],
        { FINISHED: 10 },
      ),
    ],
  );
  const listener = add(
    '012',
    [
      { name: 'notified', type: 'bool', value: false },
      { name: 'tile', type: 'int', value: 0 },
      { name: 'position', type: 'vector', value: [0, 0, 0] },
    ],
    { PRE_REVEAL: 11, INVENTED_REVEAL: 20 },
    [
      state(10, [], { 'NODE CLICKED': 30 }),
      state(
        11,
        [
          action(0, 'branchBool', {
            ref: local('notified'),
            trueEvent: 'READY',
            falseEvent: 'HIDDEN',
          }),
        ],
        { READY: 24, HIDDEN: 12 },
      ),
      state(12, [action(0, 'hideNode'), action(1, 'release')]),
      state(20, [action(0, 'getTile', { target: local('tile') })], { FINISHED: 21 }),
      state(
        21,
        [
          native(0, 'isExplored', 'FFG.JIME.Actions.IsTileExplored', {
            tile: { kind: 'variable', ref: local('tile') },
            trueEvent: 'OPEN',
            falseEvent: 'CLOSED',
          }),
        ],
        { OPEN: 23, CLOSED: 22 },
      ),
      state(
        22,
        [action(0, 'set', { target: local('notified'), value: true }), action(1, 'release')],
        { FINISHED: 10 },
      ),
      state(23, [action(0, 'getPosition', { target: local('position') })], { FINISHED: 24 }),
      state(24, [action(0, 'revealNode'), message(1, 'Colloca il deposito inventato.')], {
        FINISHED: 25,
      }),
      state(25, [action(0, 'release')], { FINISHED: 10 }),
      state(30, [confirm], { ENTER: 31, BACK: 10 }),
      state(
        31,
        [
          choice('Scegli come recuperare il materiale inventato.', [
            { event: 'CLIMB', label: text('Arrampicati · Agilità 2') },
            { event: 'SOLVE', label: text('Risolvi · Ingegno 2') },
          ]),
        ],
        { CLIMB: 32, SOLVE: 35, LEAVE: 10 },
      ),
      state(32, [test('agility', 2)], { YES: 33, NO: 34 }),
      state(33, [message(0, 'Materiale inventato ottenuto.', { inspiration: 1 })], {
        FINISHED: 40,
      }),
      state(
        34,
        [
          message(0, 'Subisci la conseguenza inventata.', {
            consequence: { family: 'damage', amount: 1, face: 'faceup' },
          }),
        ],
        { FINISHED: 40 },
      ),
      state(35, [test('wit', 2)], { YES: 36, NO: 37 }),
      state(36, [message(0, 'Soluzione inventata trovata.', { inspiration: 1 })], { FINISHED: 40 }),
      state(37, [message(0, 'Ritorna al deposito inventato.')], { FINISHED: 10 }),
      state(40, [action(0, 'broadcast', { event: 'INVENTED_SUPPLIED' })], { FINISHED: 41 }),
      state(41, stop()),
    ],
  );
  if (!pack.globals.some((v) => v.name === 'inventedThreat'))
    pack.globals.push({ name: 'inventedThreat', type: 'int', value: 7 });
  const proof = (name) => ({
    assemblyHash: pack.manifest.failure.methods.signal.assemblyHash,
    method: '06009999',
    bodyHash: hash(name),
  });
  pack.manifest.linked = {
    version: 'source-linked-encounters-v1',
    evidenceHash: hash('invented bounded linked evidence'),
    encounters: [visit, listener].map(({ p, d }) => ({
      prefab: p.source,
      definitionHash: hash(d),
    })),
    events: {
      searched: 'INVENTED_VISITED',
      reveal: 'INVENTED_REVEAL',
      returned: 'INVENTED_SUPPLIED',
    },
    threat: {
      definition: visit.d.source,
      state: 61,
      action: 0,
      binding: global('inventedThreat'),
      delta: -4,
    },
    title,
    roundsFingerprint: hash(pack.manifest.rounds ?? null),
    failureFingerprint: hash(pack.manifest.failure),
    methods: Object.fromEntries(
      ['choose', 'award', 'unique', 'threat', 'broadcast', 'sequence'].map((n) => [n, proof(n)]),
    ),
  };
  return pack.manifest.linked;
}
export function sealLinked(pack) {
  const cap = pack.manifest.linked;
  for (const e of cap.encounters)
    e.definitionHash = hash(
      pack.definitions.find(
        (d) => d.source === pack.manifest.prefabs.find((p) => p.source === e.prefab).fsmSource,
      ),
    );
  cap.roundsFingerprint = hash(pack.manifest.rounds ?? null);
  cap.failureFingerprint = hash(pack.manifest.failure);
}
export function linkedCompilation() {
  const pack = clueCompilerFixture();
  attachFailure(pack);
  attachLinked(pack);
  return {
    pack,
    certificates: certificates(pack),
    cluesCertificate: { instructionHash: hash(pack.manifest.clues) },
    failureCertificate: { instructionHash: hash(pack.manifest.failure) },
    linkedCertificate: { instructionHash: hash(pack.manifest.linked) },
  };
}
