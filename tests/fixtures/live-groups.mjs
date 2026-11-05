// Invented capability evidence; no original acceptance.
import { hash } from './map-freeze.mjs';
export function attachLiveGroups(pack) {
  pack.manifest.liveGroups = {
    version: 'source-live-groups-v1',
    evidenceHash: hash('invented defeat, group order, negation and callback evidence'),
    roundsFingerprint: hash(pack.manifest.rounds),
    followupFingerprint: hash(pack.manifest.followup),
    failureFingerprint: hash(pack.manifest.failure),
  };
  return pack.manifest.liveGroups;
}
