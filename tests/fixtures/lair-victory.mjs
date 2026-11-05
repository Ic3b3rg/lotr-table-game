// Invented graph, text, quantities and identities; never original acceptance.
import { state, action, text } from './scenario.mjs';
import {
  native,
  local,
  global,
  literal,
  variable,
  message,
  clueCompilerFixture,
} from './clue-progression.mjs';
import { attachFailure } from './adventure-failure.mjs';
import { certificates } from './exploration.mjs';
import { hash } from './map-freeze.mjs';

export function sealLair(pack) {
  const cap = pack.manifest.lair;
  const fort = pack.manifest.prefabs.find((p) => p.source === cap.prefab);
  cap.definitionHash = hash(pack.definitions.find((d) => d.source === fort.fsmSource));
  cap.principalHash = hash(pack.definitions.find((d) => d.source === pack.principal));
  cap.cluesFingerprint = hash(pack.manifest.clues);
  cap.failureFingerprint = hash(pack.manifest.failure);
}
export function attachLair(pack) {
  if (!pack.manifest.failure) {
    attachFailure(pack);
    const main = pack.definitions.find((d) => d.source === pack.principal);
    const added = main.states.slice(-4);
    for (const s of added) {
      s.index += 100;
      for (const event of Object.keys(s.transitions)) s.transitions[event] += 100;
    }
    main.handlers[pack.manifest.failure.event] += 100;
  }
  pack.globals.find((v) => v.name === 'inventedWon').value = false;
  const count = pack.manifest.followup?.playerCountBinding ?? 'inventedPartySize';
  if (!pack.globals.some((v) => v.name === count))
    pack.globals.push({ name: count, type: 'int', value: 3 });
  const prefab = pack.manifest.clues.fort.prefab;
  const fort = pack.manifest.prefabs.find((p) => p.source === prefab);
  const d = pack.definitions.find((d) => d.source === fort.fsmSource);
  d.variables.push(
    { name: 'progress', type: 'int', value: 0 },
    { name: 'difficulty', type: 'int', value: 0 },
  );
  d.states.find((s) => s.index === 0).transitions['NODE CLICKED'] = 101;
  for (const s of d.states)
    if (s.actions.some((a) => a.op === 'release')) s.transitions.FINISHED = 0;
  const init = [
    native(0, 'set', 'HutongGames.PlayMaker.Actions.SetIntValue', {
      target: local('difficulty'),
      value: 2,
    }),
    action(1, 'addInt', { target: local('difficulty'), value: variable(global(count)) }),
  ];
  if (d.handlers.PRE_REVEAL !== undefined) {
    const before = d.states.find((s) => s.index === d.handlers.PRE_REVEAL);
    before.actions = [...init, ...before.actions.map((a) => ({ ...a, index: a.index + 2 }))];
  } else {
    d.handlers.PRE_REVEAL = 109;
    d.states.push(state(109, init, { FINISHED: 0 }));
  }
  const confirm = (value) =>
    native(0, 'confirm', 'FFG.JIME.Actions.DisplayMessageCancelConfirm', {
      text: text(value),
      label: text('Cerca il passaggio'),
      cancelLabel: text('Annulla'),
      confirmEvent: 'GO',
      cancelEvent: 'CANCEL',
    });
  d.states.push(
    state(101, [confirm('Ingresso del rifugio inventato: cerca un passaggio.')], {
      GO: 102,
      CANCEL: 0,
    }),
    state(
      102,
      [
        native(0, 'challenge', 'FFG.JIME.Actions.DisplayMessageChallenge', {
          text: text('Studia il percorso inventato. Effettua una prova di Arguzia.'),
          stat: 'wit',
          sum: local('progress'),
          bounds: [
            { maximum: local('difficulty'), event: 'LOW' },
            { maximum: 9, event: 'HIGH' },
          ],
        }),
      ],
      { LOW: 103, HIGH: 104 },
    ),
    state(
      103,
      [message(0, 'Il passaggio inventato non è ancora pronto. Il progresso resta salvato.')],
      { FINISHED: 107 },
    ),
    state(104, [message(0, 'Passaggio inventato trovato: il gruppo vince e raggiunge il campo.')], {
      FINISHED: 105,
    }),
    state(105, [native(0, 'endGame', 'FFG.JIME.Actions.EndGame', { success: true })], {
      FINISHED: 106,
    }),
    state(106, [action(0, 'hideNode'), action(1, 'stop')]),
    state(107, [], { 'NODE CLICKED': 108 }),
    state(108, [confirm('Riprendi la ricerca inventata. Il progresso precedente è conservato.')], {
      GO: 102,
      CANCEL: 107,
    }),
  );
  const main = pack.definitions.find((d) => d.source === pack.principal);
  main.handlers.INVENTED_VICTORY = 90;
  main.deferredHandlers ??= {};
  const failureReward = main.states.find(
    (s) =>
      s.index ===
      main.states.find((s) => s.index === main.handlers[pack.manifest.failure.event]).transitions
        .FINISHED,
  );
  main.states.push(
    state(
      90,
      [
        action(0, 'set', { target: global('inventedWon'), value: true }),
        native(1, 'awardXP', 'FFG.JIME.Actions.AwardXP', { amount: 6 }),
        native(2, 'lore', 'FFG.JIME.Actions.AddLore', { amount: 3 }),
      ],
      { FINISHED: failureReward.transitions.FINISHED },
    ),
  );
  pack.manifest.lair = {
    version: 'source-lair-victory-v1',
    prefab,
    event: 'INVENTED_VICTORY',
    evidenceHash: hash('invented bounded lair evidence'),
    definitionHash: hash(d),
    principalHash: hash(main),
    cluesFingerprint: hash(pack.manifest.clues),
    failureFingerprint: hash(pack.manifest.failure),
    methods: Object.fromEntries(
      ['end', 'challenge', 'sum'].map((name) => [
        name,
        {
          assemblyHash: pack.manifest.failure.methods.signal.assemblyHash,
          method: '06009999',
          bodyHash: hash(name),
        },
      ]),
    ),
  };
  return pack.manifest.lair;
}
export function lairCompilation() {
  const pack = clueCompilerFixture();
  attachLair(pack);
  return {
    pack,
    certificates: certificates(pack),
    cluesCertificate: { instructionHash: hash(pack.manifest.clues) },
    failureCertificate: { instructionHash: hash(pack.manifest.failure) },
    lairCertificate: { instructionHash: hash(pack.manifest.lair) },
  };
}
