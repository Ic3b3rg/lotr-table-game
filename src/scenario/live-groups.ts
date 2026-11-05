import type { State } from '../server/state';
import type { ScenarioPack } from '../shared/scenario';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';

/** Opt in only at the frozen source, never by rewriting a persisted run. */
export function liveGroupRules(state: State) {
  const cap = state.scenario!.pack.manifest.liveGroups;
  return cap ? { groupRules: cap.version } : {};
}

export function validateLiveGroups(pack: ScenarioPack) {
  const cap = pack.manifest.liveGroups;
  if (!cap) return;
  invariant(
    pack.manifest.scope === 'original-encounter-v1' &&
      pack.manifest.rounds &&
      pack.manifest.followup &&
      pack.manifest.failure &&
      cap.roundsFingerprint === digest(pack.manifest.rounds) &&
      cap.followupFingerprint === digest(pack.manifest.followup) &&
      cap.failureFingerprint === digest(pack.manifest.failure),
    'Gruppi attivi senza controller e legami al freeze corrispondenti.',
  );
}
