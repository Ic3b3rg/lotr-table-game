import type { ScenarioPack } from '../shared/scenario';
import type { CombatClosure } from '../combat/compiler';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';

/** Certify the bounded continuation against its owner, bindings and source actions. */
export function validateShadowCapability(pack: ScenarioPack, combat: CombatClosure) {
  const shadow = combat.source.shadow;
  if (!shadow) return;
  const rounds = pack.manifest.rounds!,
    followup = pack.manifest.followup!;
  const {
    normalDifficulty: _normal,
    enemyPointsPerHero: _points,
    difficultyEvidenceHash: _difficulty,
    ...controller
  } = shadow.controller;
  invariant(
    digest(controller) === digest(rounds.controller),
    'Controller attivazioni estraneo alla fase.',
  );
  for (const threshold of shadow.thresholds) {
    const instance = followup.instances.find((i) => i.definition === threshold.definition);
    invariant(
      instance?.kind === 'threat' &&
        instance.gameObject === threshold.owner &&
        followup.thresholds.some(
          (t) => t.source === threshold.source && t.definition === threshold.definition,
        ),
      'Soglia senza owner statico certificato.',
    );
    const d = pack.definitions.find((d) => d.source === threshold.definition)!;
    const entry = d.states.find((s) => s.index === d.handlers[followup.thresholdEvent]);
    const multiply = entry?.actions[0],
      spawn = entry?.actions[1];
    invariant(
      d.states.length === 4 &&
        entry?.actions.length === 2 &&
        multiply?.op === 'multiplyInt' &&
        multiply.left.kind === 'variable' &&
        multiply.left.ref.scope === 'global' &&
        multiply.left.ref.name === followup.playerCountBinding &&
        multiply.right.kind === 'literal' &&
        multiply.right.value === threshold.multiplier &&
        spawn?.op === 'spawnRandom' &&
        digest(spawn.points) === digest(multiply.target) &&
        !spawn.excludeGameEnemyPoints &&
        !spawn.trial &&
        !spawn.suffering &&
        spawn.sections === null &&
        Object.values(spawn.filter).every((n) => n === 0),
      'Budget o popolazione della soglia non corrispondenti alla fonte.',
    );
    const registration = d.states.find((s) => s.index === entry!.transitions.FINISHED);
    const next = registration?.actions[0];
    invariant(
      registration?.actions.length === 1 &&
        next?.op === 'threat' &&
        next.source === threshold.nextSource &&
        next.threshold === threshold.nextThreshold &&
        followup.thresholds.some(
          (t) =>
            t.source === threshold.nextSource &&
            (t.definition === null ||
              pack.manifest.threatContinuations?.thresholds.some(
                (r) =>
                  r.source === t.source &&
                  r.definition === t.definition &&
                  r.owner === threshold.nextOwner &&
                  r.threshold === threshold.nextThreshold,
              )),
        ),
      'Registrazione successiva della soglia non certificata.',
    );
    const finish = d.states.find((s) => s.index === registration!.transitions.FINISHED);
    invariant(
      finish?.actions.length === 2 &&
        finish.actions[0]?.op === 'hideNode' &&
        finish.actions[1]?.op === 'stop' &&
        d.states.find((s) => s.index === d.initial)?.actions.length === 0,
      'Seguito della soglia privo di chiusura fonte.',
    );
    invariant(
      pack.definitions.some((d) =>
        d.states.some((s) =>
          s.actions.some(
            (a) =>
              a.op === 'threat' &&
              a.source === threshold.source &&
              a.threshold === threshold.threshold,
          ),
        ),
      ),
      'Default iniziale della soglia non certificato.',
    );
  }
}
