// Invented identities, packets and graph indices. No original content.
import { state, action, text } from './scenario.mjs';
import { native, message, clueCompilerFixture } from './clue-progression.mjs';
import { attachFailure } from './adventure-failure.mjs';
import { certificates } from './exploration.mjs';
import { hash } from './map-freeze.mjs';

export function threatTokenCertificates(pack) {
  const result = certificates(pack),
    cap = pack.manifest.threatTokens;
  if (!cap) return result;
  const owner = cap.encounters[1],
    p = pack.manifest.prefabs.find((p) => p.source === owner.prefab),
    c = result.find((c) => c.source === p.fsmSource);
  c.states.push(
    {
      index: 89,
      transitions: { FINISHED: 90 },
      actions: [
        {
          index: 0,
          type: 'FFG.JIME.Actions.DisplayMessage',
          parameterHash: hash('excluded packet'),
          enabled: true,
        },
      ],
    },
    {
      index: 90,
      transitions: { FINISHED: 91, SKIP: 84 },
      actions: [
        {
          index: 0,
          type: 'FFG.JIME.Actions.DisplayMessagePlayerChoice',
          parameterHash: hash('excluded choice'),
          enabled: true,
        },
      ],
    },
    {
      index: 91,
      transitions: { FINISHED: 84 },
      actions: [
        {
          index: 0,
          type: 'FFG.JIME.Actions.ModifyCorruption',
          parameterHash: hash('excluded corruption'),
          enabled: true,
        },
      ],
    },
  );
  const gate = c.states.find((s) => s.index === cap.gate.state);
  gate.transitions = { ...gate.transitions, OWNED: 89 };
  c.deferredEdges = [
    { from: cap.gate.state, event: 'OWNED', to: 89, capability: cap.gate.capability },
  ];
  return result;
}
export function sealThreatTokens(pack) {
  const cap = pack.manifest.threatTokens;
  cap.roundsFingerprint = hash(pack.manifest.rounds ?? null);
  cap.failureFingerprint = hash(pack.manifest.failure);
  for (const owner of cap.encounters) {
    const p = pack.manifest.prefabs.find((p) => p.source === owner.prefab),
      d = pack.definitions.find((d) => d.source === p.fsmSource),
      c = threatTokenCertificates(pack).find((c) => c.source === d.source);
    Object.assign(owner, {
      prefabHash: hash(p),
      definitionHash: hash(d),
      objectHash: c.objectHash,
      lifecycleHash: c.lifecycleHash,
      certificateHash: hash(c),
      admittedStates: d.states.map((s) => s.index),
    });
  }
}
export function attachThreatTokens(pack, targets = []) {
  const template = pack.manifest.prefabs[0];
  if (!pack.globals.some((v) => v.name === 'inventedThreat'))
    pack.globals.push({ name: 'inventedThreat', type: 'int', value: 0 });
  const owners = ['retry', 'null-product'].map((role, n) => {
    const p = targets[n] ?? {
      ...structuredClone(template),
      source: `example.assets:${48110 + n}`,
      fsmSource: `example.assets:${78110 + n}`,
      modelSource: `example.assets:${58110 + n}`,
      nodeSource: `example.assets:${68110 + n}`,
    };
    if (!targets[n]) pack.manifest.prefabs.push(p);
    Object.assign(p, {
      inspection: text(`Segnalino inventato ${role}.`),
      nodeType: 'threat',
      sourceNodeType: 2,
      token3DType: 3,
    });
    pack.definitions = pack.definitions.filter((d) => d.source !== p.fsmSource);
    const d = {
      source: p.fsmSource,
      initial: 82,
      variables: [],
      handlers: { REVEALED: 80 },
      deferredHandlers: {},
      states: [
        state(80, [message(0, 'Colloca il segnalino minaccia inventato.')], { FINISHED: 81 }),
        state(81, [action(0, 'release')], { FINISHED: 82 }),
        state(82, [], { 'NODE CLICKED': 83 }),
        state(
          83,
          [
            native(0, 'confirm', 'FFG.JIME.Actions.DisplayMessageCancelConfirm', {
              text: p.inspection,
              label: text('Cerca · 1 azione'),
              cancelLabel: text('Chiudi'),
              confirmEvent: 'ENTER',
              cancelEvent: 'LEAVE',
            }),
          ],
          { ENTER: 86, LEAVE: 82 },
        ),
        state(84, [action(0, 'hideNode'), action(1, 'stop')]),
        state(
          85,
          [
            message(
              0,
              n ? 'Il premio inventato ispira.' : 'Il premio inventato concede un beneficio.',
              n ? { inspiration: 1 } : { boon: 'determined' },
            ),
            ...(n
              ? []
              : [
                  native(1, 'addInt', 'HutongGames.PlayMaker.Actions.IntAdd', {
                    target: {
                      scope: 'global',
                      name: pack.manifest.rounds?.bindings.threat ?? 'inventedThreat',
                    },
                    value: { kind: 'literal', value: -4 },
                  }),
                ]),
          ],
          { FINISHED: 84 },
        ),
        state(
          86,
          [
            native(0, 'sourceTest', 'FFG.JIME.Actions.DisplayMessageCancelConfirm', {
              text: text(`Prova inventata ${n ? 'Spirito' : 'Saggezza'} 2.`),
              stat: n ? 'spirit' : 'wisdom',
              target: 2,
              passEvent: 'PASS',
              failEvent: 'FAIL',
            }),
          ],
          { PASS: 85, FAIL: n ? 88 : 87 },
        ),
        state(
          87,
          [
            message(
              0,
              n ? 'Una paura dal luogo inventato.' : 'Il luogo inventato rimane in attesa.',
              n ? { consequence: { family: 'fear', amount: 1, face: 'faceup' } } : {},
            ),
          ],
          { FINISHED: n ? 84 : 82 },
        ),
        ...(n
          ? [
              state(
                88,
                [
                  native(0, 'ownsProducts', 'FFG.JIME.OwnsProducts', {
                    products: [null],
                    ownEvent: 'OWNED',
                    missingEvent: 'MISSING',
                  }),
                ],
                { MISSING: 87 },
              ),
            ]
          : []),
      ],
    };
    if (n) d.states.at(-1).deferredTransitions = { OWNED: 'null-product-not-owned' };
    pack.definitions.push(d);
    return {
      role,
      prefab: p.source,
      model: { source: p.modelSource, objectHash: hash(`invented model ${role}`) },
      node: { source: p.nodeSource, objectHash: hash(`invented node ${role}`) },
      excludedStates: n ? [89, 90, 91] : [],
    };
  });
  const proof = (k) => ({
    assemblyHash: pack.manifest.failure.methods.signal.assemblyHash,
    method: '06009999',
    bodyHash: hash(k),
  });
  pack.manifest.threatTokens = {
    version: 'source-threat-tokens-v1',
    evidenceHash: hash('invented source proof'),
    ownedProductIds: [0],
    encounters: owners,
    gate: { state: 88, action: 0, excludedTarget: 89, capability: 'null-product-not-owned' },
    threat: {
      definition: pack.manifest.prefabs.find((p) => p.source === owners[0].prefab).fsmSource,
      state: 85,
      action: 1,
      binding: { scope: 'global', name: pack.manifest.rounds?.bindings.threat ?? 'inventedThreat' },
      delta: -4,
    },
    methods: Object.fromEntries(
      [
        'confirm',
        'cancel',
        'owns',
        'isOwned',
        'add',
        'threat',
        'binding',
        'getThreat',
        'setThreat',
        'hide',
        'release',
        'sequence',
      ].map((k) => [k, proof(k)]),
    ),
  };
  sealThreatTokens(pack);
  return pack.manifest.threatTokens;
}
export function threatTokenCompilation() {
  const pack = clueCompilerFixture();
  attachFailure(pack);
  attachThreatTokens(pack);
  return {
    pack,
    certificates: threatTokenCertificates(pack),
    cluesCertificate: { instructionHash: hash(pack.manifest.clues) },
    failureCertificate: { instructionHash: hash(pack.manifest.failure) },
    threatTokensCertificate: { instructionHash: hash(pack.manifest.threatTokens) },
  };
}
