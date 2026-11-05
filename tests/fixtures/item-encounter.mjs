// All models, graph, text and evidence in this fixture are invented.
import { state, action, text } from './scenario.mjs';
import { native, message, clueCompilerFixture } from './clue-progression.mjs';
import { attachFailure } from './adventure-failure.mjs';
import { certificates } from './exploration.mjs';
import { catalogFixture } from './catalog.mjs';
import { hash } from './map-freeze.mjs';
export function itemPolicy(catalog) {
  const card = catalog.items.find((c) => c.id === 'trinket');
  return {
    id: card.id,
    kind: 'item',
    definitionHash: hash(card),
    source: { sourceId: 'invented', locator: 'invented item front' },
    effects: [{ op: 'fear-facedown-only', depletion: 2 }],
  };
}
export function attachItem(pack, catalog = catalogFixture(), target = null, difficulty = 2) {
  const p = target ?? {
    ...structuredClone(pack.manifest.prefabs[0]),
    source: 'example.assets:47901',
    fsmSource: 'example.assets:77901',
  };
  if (!target) pack.manifest.prefabs.push(p);
  else pack.definitions = pack.definitions.filter((d) => d.source !== p.fsmSource);
  p.inspection = text('Un astuccio inventato incastrato fra le pietre.');
  p.nodeType = 'search';
  p.sourceNodeType = 0;
  const d = {
    source: p.fsmSource,
    initial: 12,
    variables: [],
    handlers: { REVEALED: 10 },
    deferredHandlers: {},
    states: [
      state(10, [message(0, 'Colloca il segnalino inventato.')], { FINISHED: 11 }),
      state(11, [action(0, 'release')], { FINISHED: 12 }),
      state(12, [], { 'NODE CLICKED': 13 }),
      state(
        13,
        [
          native(0, 'confirm', 'FFG.JIME.Actions.DisplayMessageCancelConfirm', {
            text: p.inspection,
            label: text('Apri · 1 azione'),
            cancelLabel: text('Annulla'),
            confirmEvent: 'ENTER',
            cancelEvent: 'LEAVE',
          }),
          native(1, 'modalWait', 'FFG.JIME.Actions.DisplayMessageCancelConfirm', {
            text: text('Una seconda istruzione inventata attende lo stesso popup.'),
            label: text('Superata'),
            cancelLabel: text('Fallita'),
            confirmEvent: 'ENTER',
            cancelEvent: 'LEAVE',
          }),
        ],
        { ENTER: 17, LEAVE: 12 },
      ),
      state(14, [action(0, 'hideNode'), action(1, 'stop')]),
      state(15, [message(0, 'Non si apre. Potrai ritentare pagando una nuova azione.')], {
        FINISHED: 12,
      }),
      state(16, [message(0, 'Hai liberato l’astuccio inventato.')], { FINISHED: 18 }),
      state(
        17,
        [
          native(0, 'sourceTest', 'FFG.JIME.Actions.DisplayMessageCancelConfirm', {
            text: text(`Apri l’astuccio: Saggezza ${difficulty}.`),
            stat: 'wisdom',
            target: difficulty,
            passEvent: 'YES',
            failEvent: 'NO',
          }),
        ],
        { YES: 16, NO: 15 },
      ),
      state(
        18,
        [
          native(0, 'addItem', 'FFG.JIME.Actions.AddItemToInventory', {
            itemModel: 'example.assets:98201',
            text: text(
              'Hai ottenuto l’accessorio inventato. Scegli chi lo ottiene fra te e gli eroi vicini.',
            ),
          }),
        ],
        { FINISHED: 14 },
      ),
    ],
  };
  pack.definitions.push(d);
  const proof = (key) => ({
    assemblyHash: pack.manifest.failure.methods.signal.assemblyHash,
    method: '06009999',
    bodyHash: hash(key),
  });
  pack.manifest.items = {
    version: 'source-item-inventory-v1',
    prefab: p.source,
    prefabHash: hash(p),
    definitionHash: hash(d),
    sourceObjectHash: hash('item graph'),
    lifecycleHash: hash('shared modal lifecycle'),
    sourceCertificateHash: 'a'.repeat(64),
    evidenceHash: hash('invented bounded evidence'),
    ownedProductIds: [0],
    product: { id: 0, source: 'example.assets:98200', objectHash: hash('product') },
    initialInventory: [],
    baseSkillModelIds: pack.manifest.failure.partyBonus.skills.flatMap((s) =>
      s.modelId === null ? [] : [s.modelId],
    ),
    collectorSkillId: 9001,
    titleModel: { source: 'example.assets:98203', modelId: 9002, objectHash: hash('title') },
    modal: { state: 13, owner: 0, waiter: 1 },
    grant: {
      cardId: 'trinket',
      cardHash: hash(catalog.items.find((c) => c.id === 'trinket')),
      model: {
        source: 'example.assets:98201',
        modelId: 9003,
        objectHash: hash('item'),
        type: 2,
        level: 1,
      },
      quantity: 1,
      depletion: 2,
      policyHash: hash(itemPolicy(catalog)),
      upgrade: {
        threshold: 26,
        choices: [{ source: 'example.assets:98202', modelId: 9004, objectHash: hash('upgrade') }],
      },
    },
    roundsFingerprint: hash(pack.manifest.rounds ?? null),
    failureFingerprint: hash(pack.manifest.failure),
    methods: Object.fromEntries(
      [
        'enter',
        'progress',
        'title',
        'titleProgress',
        'upgrade',
        'owned',
        'nonMounts',
        'skill',
        'modalUpdate',
        'modalOpen',
        'modalClose',
        'modalCallback',
        'sequence',
      ].map((k) => [k, proof(k)]),
    ),
  };
  sealItem(pack);
  return pack.manifest.items;
}
export function sealItem(pack) {
  const cap = pack.manifest.items,
    p = pack.manifest.prefabs.find((p) => p.source === cap.prefab);
  cap.prefabHash = hash(p);
  cap.definitionHash = hash(pack.definitions.find((d) => d.source === p.fsmSource));
  cap.roundsFingerprint = hash(pack.manifest.rounds ?? null);
  cap.failureFingerprint = hash(pack.manifest.failure);
  const c = certificates(pack).find((c) => c.source === p.fsmSource);
  cap.sourceObjectHash = c.objectHash;
  cap.lifecycleHash = c.lifecycleHash;
  cap.sourceCertificateHash = hash(c);
}
export function itemCompilation() {
  const pack = clueCompilerFixture();
  attachFailure(pack);
  attachItem(pack);
  return {
    pack,
    certificates: certificates(pack),
    cluesCertificate: { instructionHash: hash(pack.manifest.clues) },
    failureCertificate: { instructionHash: hash(pack.manifest.failure) },
    itemsCertificate: { instructionHash: hash(pack.manifest.items) },
  };
}
