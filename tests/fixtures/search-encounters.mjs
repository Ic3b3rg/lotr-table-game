// Entirely invented programs, objects, packets and pre-startup context.
import { state, action, text } from './scenario.mjs';
import { native, message, clueCompilerFixture } from './clue-progression.mjs';
import { attachFailure } from './adventure-failure.mjs';
import { certificates } from './exploration.mjs';
import { hash } from './map-freeze.mjs';

export function attachSearches(pack, targets = []) {
  const template = pack.manifest.prefabs[0];
  const owners = ['choice', 'challenge'].map((role, n) => {
    const p = targets[n] ?? {
      ...structuredClone(template),
      source: `example.assets:${48010 + n}`,
      fsmSource: `example.assets:${78010 + n}`,
      nodeSource: `example.assets:${68010 + n}`,
      modelSource: `example.assets:${58010 + n}`,
    };
    if (!targets[n]) pack.manifest.prefabs.push(p);
    pack.definitions = pack.definitions.filter((d) => d.source !== p.fsmSource);
    Object.assign(p, {
      inspection: text(`Un luogo inventato per ${role}.`),
      nodeType: 'search',
      sourceNodeType: 0,
      token3DType: 2,
    });
    const d = {
      source: p.fsmSource,
      initial: 32,
      variables: [{ name: 'tally', type: 'int', value: 0 }],
      handlers: { REVEALED: 30 },
      deferredHandlers: {},
      states: [
        state(30, [message(0, 'Colloca il segnalino di prova inventato.')], { FINISHED: 31 }),
        state(31, [action(0, 'release')], { FINISHED: 32 }),
        state(32, [], { 'NODE CLICKED': 33 }),
        state(
          33,
          [
            native(0, 'confirm', 'FFG.JIME.Actions.DisplayMessageCancelConfirm', {
              text: p.inspection,
              label: text('Esamina · 1 azione'),
              cancelLabel: text('Chiudi'),
              confirmEvent: 'ENTER',
              cancelEvent: 'LEAVE',
            }),
          ],
          { ENTER: 36, LEAVE: 32 },
        ),
        state(34, [action(0, 'hideNode'), action(1, 'stop')]),
      ],
    };
    if (!n)
      d.states.push(
        state(
          35,
          [
            message(0, 'Una Scoperta concessa dal luogo inventato.', {
              recovery: { kind: 'scout', count: 2 },
            }),
          ],
          { FINISHED: 34 },
        ),
        state(
          36,
          [
            native(0, 'choice', 'FFG.JIME.Actions.DisplayMessageCancelConfirm', {
              text: text('Scegli uno dei due effetti inventati già pagati.'),
              options: [
                { event: 'RESTORE', label: text('Allevia una ferita') },
                { event: 'STUDY', label: text('Studia il sentiero') },
              ],
              cancel: null,
            }),
          ],
          { RESTORE: 37, STUDY: 35 },
        ),
        state(
          37,
          [
            message(0, 'Scarta una carta fisica attraverso il consumer.', {
              recovery: { kind: 'discard-physical', count: 1 },
            }),
          ],
          { FINISHED: 34 },
        ),
      );
    else
      d.states.push(
        state(35, [message(0, 'Il luogo inventato concede ispirazione.', { inspiration: 1 })], {
          FINISHED: 34,
        }),
        state(
          36,
          [
            native(0, 'challenge', 'FFG.JIME.Actions.DisplayMessageChallenge', {
              text: text('Prova inventata di Saggezza: conta i successi.'),
              stat: 'wisdom',
              sum: { scope: 'local', name: 'tally' },
              bounds: [
                { maximum: 0, event: 'ZERO' },
                { maximum: 1, event: 'ONE' },
                { maximum: 2, event: 'MANY' },
              ],
            }),
          ],
          { ZERO: 35, ONE: 37, MANY: 38 },
        ),
        state(
          37,
          [
            message(0, 'Disponi le due carte inventate senza prepararle.', {
              recovery: { kind: 'look', count: 2 },
            }),
          ],
          { FINISHED: 34 },
        ),
        state(
          38,
          [
            message(0, 'Scegli una Scoperta oppure una preparazione dagli scarti.', {
              recovery: { kind: 'scout-or-prepare', count: 2 },
            }),
          ],
          { FINISHED: 34 },
        ),
      );
    d.states.sort((a, b) => a.index - b.index);
    pack.definitions.push(d);
    return {
      role,
      prefab: p.source,
      model: { source: p.modelSource, objectHash: hash(`model-${role}`) },
      node: { source: p.nodeSource, objectHash: hash(`node-${role}`) },
    };
  });
  const proof = (key) => ({
    assemblyHash: pack.manifest.failure.methods.signal.assemblyHash,
    method: '06009999',
    bodyHash: hash(key),
  });
  pack.manifest.searches = {
    version: 'source-search-encounters-v1',
    evidenceHash: hash('invented bounded source'),
    ownedProductIds: [0],
    encounters: owners,
    roundsFingerprint: hash(pack.manifest.rounds ?? null),
    failureFingerprint: hash(pack.manifest.failure),
    methods: Object.fromEntries(
      ['confirm', 'cancel', 'challenge', 'sum', 'sequence', 'hide', 'release'].map((k) => [
        k,
        proof(k),
      ]),
    ),
  };
  sealSearches(pack);
  return pack.manifest.searches;
}
export function sealSearches(pack) {
  const cap = pack.manifest.searches;
  cap.roundsFingerprint = hash(pack.manifest.rounds ?? null);
  cap.failureFingerprint = hash(pack.manifest.failure);
  for (const owner of cap.encounters) {
    const p = pack.manifest.prefabs.find((p) => p.source === owner.prefab),
      d = pack.definitions.find((d) => d.source === p.fsmSource),
      c = certificates(pack).find((c) => c.source === d.source);
    Object.assign(owner, {
      prefabHash: hash(p),
      definitionHash: hash(d),
      objectHash: c.objectHash,
      lifecycleHash: c.lifecycleHash,
      certificateHash: hash(c),
    });
  }
}
export function searchCompilation() {
  const pack = clueCompilerFixture();
  attachFailure(pack);
  attachSearches(pack);
  return {
    pack,
    certificates: certificates(pack),
    cluesCertificate: { instructionHash: hash(pack.manifest.clues) },
    failureCertificate: { instructionHash: hash(pack.manifest.failure) },
    searchesCertificate: { instructionHash: hash(pack.manifest.searches) },
  };
}
