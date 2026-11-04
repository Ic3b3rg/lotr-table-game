// Entirely invented identities, thresholds, operands and text. No original acceptance.
import { scenarioFixture, state, action, text } from './scenario.mjs';
import { hash } from './map-freeze.mjs';
import { certificates } from './exploration.mjs';
import { attachEncounter } from '../original-encounter-helper.mjs';
import { attachRounds } from './source-rounds.mjs';
import { attachFollowup } from './shadow-followup.mjs';
import { attachFailure } from './adventure-failure.mjs';
import { closureFixture } from './combat-closure.mjs';
import { attachActivationSource, attachActivationThreshold } from './shadow-activations.mjs';
import { compileCombatClosure, compileSourceDeployment } from '../../dist/combat-library.mjs';

export function attestThreats(pack) {
  const c = pack.manifest.threatContinuations;
  c.roundsFingerprint = hash(pack.manifest.rounds);
  c.deploymentFingerprint = pack.manifest.followup.deployment.fingerprint;
  c.failureFingerprint = hash(pack.manifest.failure);
  for (const row of c.thresholds) {
    const d = pack.definitions.find((d) => d.source === row.definition);
    d.deferredHandlers ??= {};
    row.definitionHash = hash(d);
  }
}
export function attachThreats(pack, values = [37, 46, 61]) {
  const followup = pack.manifest.followup;
  const previous = pack.manifest.combat.source.shadow.thresholds.at(-1);
  const register = pack.definitions
    .find((d) => d.source === previous.definition)
    .states.flatMap((s) => s.actions)
    .find((a) => a.op === 'threat');
  register.threshold = values[0];
  previous.nextThreshold = values[0];
  const rows = values.map((threshold, n) => ({
    source: n ? `example.assets:${1900 + n}` : previous.nextSource,
    owner: n ? `example.assets:${1920 + n}` : previous.nextOwner,
    definition: `example.assets:${1940 + n}`,
    threshold,
    multiplier: [4, 7, 6][n],
    form: ['spawn-register', 'darkness-spawn-register', 'spawn-terminal'][n],
    evidenceHash: hash(['invented receiver', n]),
  }));
  for (const [n, row] of rows.entries()) {
    const next = rows[n + 1];
    row.next = next
      ? {
          source: next.source,
          owner: next.owner,
          definition: next.definition,
          threshold: next.threshold,
        }
      : null;
    const copy = structuredClone(pack.definitions.find((d) => d.source === previous.definition));
    copy.source = row.definition;
    copy.states.find((s) => s.index === 1).actions[0].right.value = row.multiplier;
    copy.states.find((s) => s.index === 1).actions[1].text = text(
      `Seguito sintetico ${n + 1}: colloca i gruppi offerti.`,
    );
    if (next)
      Object.assign(copy.states.find((s) => s.index === 2).actions[0], {
        source: next.source,
        threshold: next.threshold,
      });
    else {
      copy.states = copy.states.filter((s) => s.index !== 2);
      copy.states.find((s) => s.index === 1).transitions.FINISHED = 3;
    }
    if (n === 1) {
      copy.handlers[followup.thresholdEvent] = 4;
      copy.states.push(
        state(
          4,
          [
            action(0, 'set', {
              target: { scope: 'global', name: pack.manifest.rounds.bindings.darkness },
              value: true,
            }),
          ],
          { FINISHED: 1 },
        ),
      );
    }
    pack.definitions.push(copy);
    followup.instances.push({
      gameObject: row.owner,
      definition: row.definition,
      kind: 'threat',
      hasNode: false,
      initializationHash: hash({
        definition: copy.source,
        initial: copy.initial,
        variables: copy.variables,
        actions: [],
      }),
      lifecycleHash: hash('invented lifecycle'),
    });
    const binding = followup.thresholds.find((t) => t.source === row.source);
    if (binding) binding.definition = row.definition;
    else followup.thresholds.push({ source: row.source, definition: row.definition });
  }
  pack.manifest.threatContinuations = {
    version: 'source-threat-continuations-v1',
    projectionFingerprint: followup.projectionFingerprint,
    evidenceHash: hash('invented threat evidence'),
    methods: {
      controller: { ...pack.manifest.rounds.controller },
      ...Object.fromEntries(
        ['compare', 'register', 'unique', 'callback', 'limit'].map((k) => [
          k,
          {
            assemblyHash: pack.manifest.rounds.controller.assemblyHash,
            method: '06008888',
            bodyHash: hash(k),
          },
        ]),
      ),
    },
    thresholds: rows,
  };
  attestThreats(pack);
  // Keep the combat certificate frozen with its updated next default.
  pack.manifest.combat = compileCombatClosure(pack.manifest.combat.source);
}
export function threatCompilation() {
  const pack = scenarioFixture();
  attachEncounter(pack);
  pack.timers = ['example.assets:803'];
  pack.definitions.push({
    source: pack.timers[0],
    initial: 0,
    variables: [{ name: 'running', type: 'bool', value: true }],
    handlers: {},
    states: [state(0, [action(0, 'release')])],
  });
  const projection = { fingerprint: hash('invented projection'), sections: [], spaces: [] };
  attachRounds(pack, projection);
  attachFollowup(pack, { mapGeneration: { projection } });
  const src = attachActivationSource(closureFixture());
  const deploy = pack.manifest.followup.deployment.source;
  for (const a of src.assets.filter((a) => a.cls !== 'EnemyActivationModel'))
    deploy.assets[deploy.assets.findIndex((x) => x.source === a.source)] = structuredClone(a);
  pack.manifest.followup.deployment = compileSourceDeployment(deploy);
  src.files = deploy.files;
  src.deploymentFingerprint = pack.manifest.followup.deployment.fingerprint;
  src.projectionFingerprint = projection.fingerprint;
  Object.assign(src.shadow.controller, pack.manifest.rounds.controller);
  attachActivationThreshold(src, pack);
  pack.manifest.combat = compileCombatClosure(src);
  attachFailure(pack);
  attachThreats(pack);
  return threatInput(pack);
}
export function threatInput(pack) {
  for (const i of pack.manifest.followup.instances) {
    const d = pack.definitions.find((d) => d.source === i.definition);
    i.lifecycleHash = hash('invented lifecycle');
    i.initializationHash = hash({
      definition: d.source,
      initial: d.initial,
      variables: d.variables,
      actions: d.states.find((s) => s.index === d.initial).actions,
    });
  }
  return {
    pack,
    certificates: certificates(pack),
    ...Object.fromEntries(
      [
        ['rounds', 'rounds'],
        ['followup', 'followup'],
        ['failure', 'failure'],
        ['threatContinuations', 'threatContinuations'],
      ].map(([field, certificate]) => [
        certificate + 'Certificate',
        { instructionHash: hash(pack.manifest[field]) },
      ]),
    ),
    shadowCertificate: { instructionHash: hash(pack.manifest.combat.source.shadow) },
  };
}
