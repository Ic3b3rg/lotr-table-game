// Entirely invented graph, identities, prose and evidence. Product IDs are the explicit contract.
import { state, action, text } from './scenario.mjs';
import { native, message, clueCompilerFixture } from './clue-progression.mjs';
import { attachFailure } from './adventure-failure.mjs';
import { certificates } from './exploration.mjs';
import { hash } from './map-freeze.mjs';

export function attachBaseProducts(pack, target = null, difficulty = 2) {
  const modelFile = pack.sources[0].file;
  const p = target ?? {
    ...structuredClone(pack.manifest.prefabs[0]),
    source: 'example.assets:47801',
    fsmSource: 'example.assets:77801',
  };
  if (!target) pack.manifest.prefabs.push(p);
  else pack.definitions = pack.definitions.filter((d) => d.source !== p.fsmSource);
  p.inspection = text('Una lanterna inventata abbandonata lungo il sentiero.');
  p.nodeType = 'search';
  p.sourceNodeType = 0;
  const d = {
    source: p.fsmSource,
    initial: 10,
    variables: [],
    handlers: { REVEALED: 21 },
    deferredHandlers: {},
    states: [
      state(10, [], { 'NODE CLICKED': 31 }),
      state(21, [message(0, 'Colloca il segnalino della lanterna inventata.')], { FINISHED: 22 }),
      state(22, [action(0, 'release')], { FINISHED: 10 }),
      state(
        31,
        [
          native(0, 'confirm', 'FFG.JIME.Actions.DisplayMessageCancelConfirm', {
            text: p.inspection,
            label: text('Esamina la lanterna · 1 azione'),
            cancelLabel: text('Annulla'),
            confirmEvent: 'ENTER',
            cancelEvent: 'LEAVE',
          }),
        ],
        { ENTER: 41, LEAVE: 10 },
      ),
      state(71, [action(0, 'hideNode'), action(1, 'stop')]),
      state(
        51,
        [
          message(0, 'La luce inventata si spegne. Puoi scattare 1. Rimuovi il segnalino.', {
            sprint: 1,
          }),
        ],
        { FINISHED: 71 },
      ),
      state(
        41,
        [
          native(0, 'sourceTest', 'FFG.JIME.Actions.DisplayMessageCancelConfirm', {
            text: text(`Decifra la lanterna inventata: Saggezza ${difficulty}.`),
            stat: 'wisdom',
            target: difficulty,
            passEvent: 'SOLVED',
            failEvent: 'UNSOLVED',
          }),
        ],
        { SOLVED: 61, UNSOLVED: 51 },
      ),
      state(
        61,
        [message(0, 'Il segnale inventato è chiaro: ottieni 1 ispirazione.', { inspiration: 1 })],
        { FINISHED: 91 },
      ),
      {
        ...state(
          91,
          [
            native(0, 'ownsProducts', 'FFG.JIME.OwnsProducts', {
              products: [`${modelFile}:92105`],
              ownEvent: 'EXTRA',
              missingEvent: 'BASE',
            }),
          ],
          { BASE: 71 },
        ),
        deferredTransitions: { EXTRA: 'outside-approved-base-products' },
      },
    ],
  };
  pack.definitions.push(d);
  if (!pack.globals.some((v) => v.name === 'inventedChain'))
    pack.globals.push({ name: 'inventedChain', type: 'int', value: 7 });
  const proof = (name) => ({
    assemblyHash: pack.manifest.failure.methods.signal.assemblyHash,
    method: '06009999',
    bodyHash: hash(name),
  });
  pack.manifest.baseProducts = {
    version: 'source-base-products-v1',
    prefab: p.source,
    definitionHash: hash(d),
    prefabHash: hash(p),
    sourceObjectHash: hash(d.source),
    lifecycleHash: hash('invented lifecycle'),
    sourceCertificateHash: 'a'.repeat(64),
    evidenceHash: hash('invented bounded product evidence'),
    ownedProductIds: [0],
    models: [0, 5].map((id) => ({
      id,
      source: `${modelFile}:${92100 + id}`,
      objectHash: hash(`model${id}`),
    })),
    gate: {
      state: 91,
      action: 0,
      excludedTarget: 81,
      capability: 'outside-approved-base-products',
    },
    excludedStates: [81, 82, 83, 84, 85],
    roundsFingerprint: hash(pack.manifest.rounds ?? null),
    failureFingerprint: hash(pack.manifest.failure),
    methods: Object.fromEntries(
      ['owns', 'isOwned', 'product', 'compare', 'add', 'confirm', 'cancel', 'hide', 'release'].map(
        (n) => [n, proof(n)],
      ),
    ),
  };
  sealBaseProducts(pack);
  return pack.manifest.baseProducts;
}
export function baseCertificates(pack) {
  const rows = structuredClone(certificates(pack)),
    cap = pack.manifest.baseProducts;
  if (!cap) return rows;
  const p = pack.manifest.prefabs.find((p) => p.source === cap.prefab),
    c = rows.find((c) => c.source === p.fsmSource);
  c.states.find((s) => s.index === cap.gate.state).transitions.EXTRA = cap.gate.excludedTarget;
  c.deferredEdges = [
    {
      from: cap.gate.state,
      event: 'EXTRA',
      to: cap.gate.excludedTarget,
      capability: cap.gate.capability,
    },
  ];
  for (const [n, index] of cap.excludedStates.entries())
    c.states.push({
      index,
      transitions: n < 4 ? { FINISHED: cap.excludedStates[n + 1] } : { FINISHED: 71 },
      actions: [
        {
          index: 0,
          type: [
            'HutongGames.PlayMaker.Actions.IntAdd',
            'HutongGames.PlayMaker.Actions.IntCompare',
            'FFG.JIME.Actions.IsTitleEarned',
            'FFG.JIME.Actions.DisplayMessagePlayerChoice',
            'FFG.JIME.Actions.AwardTitle',
          ][n],
          parameterHash: hash(`invented excluded${n}`),
          enabled: true,
        },
      ],
    });
  return rows;
}
export function sealBaseProducts(pack) {
  const cap = pack.manifest.baseProducts,
    p = pack.manifest.prefabs.find((p) => p.source === cap.prefab);
  cap.definitionHash = hash(pack.definitions.find((d) => d.source === p.fsmSource));
  cap.prefabHash = hash(p);
  cap.roundsFingerprint = hash(pack.manifest.rounds ?? null);
  cap.failureFingerprint = hash(pack.manifest.failure);
  cap.sourceCertificateHash = hash(baseCertificates(pack).find((c) => c.source === p.fsmSource));
}
export function baseCompilation() {
  const pack = clueCompilerFixture();
  attachFailure(pack);
  attachBaseProducts(pack);
  return {
    pack,
    certificates: baseCertificates(pack),
    cluesCertificate: { instructionHash: hash(pack.manifest.clues) },
    failureCertificate: { instructionHash: hash(pack.manifest.failure) },
    baseProductsCertificate: { instructionHash: hash(pack.manifest.baseProducts) },
  };
}
