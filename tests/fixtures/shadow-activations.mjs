import { digest } from '../../dist/map-freeze-library.mjs';
import { sha } from './combat-closure.mjs';

// Invented policy and locators; no original card or activation text.
export function attachActivationSource(source, tileSources = []) {
  const text = (key, value) => ({
    key,
    value,
    file: source.files[0].file,
    locator: key,
    sha256: sha(value),
  });
  source.texts.push(
    text('primary', 'Advance: attack {0}, or the nearest reachable hero.'),
    text('alternative', 'Advance toward the nearest hero.'),
    text('interrupted', 'Resume toward the nearest hero.'),
  );
  const instructions = source.assets.filter((a) => a.cls === 'EnemyActivationModel');
  for (const asset of instructions) {
    Object.assign(asset.data, {
      KeyActivation: 'primary',
      KeyAltActivation: 'alternative',
      KeyInterruptActivation: 'interrupted',
    });
    asset.dataHash = digest(asset.data);
  }
  source.shadow = {
    version: 'source-shadow-activations-v1',
    activationOverride: -1,
    companyFingerprint: digest({
      items: source.items,
      definitions: source.definitions,
      clauses: source.clauses,
      heroes: source.heroes,
    }),
    controller: {
      assemblyHash: sha('invented assembly'),
      method: '06000100',
      bodyHash: sha('invented controller'),
      normalDifficulty: 0,
      enemyPointsPerHero: 0,
      difficultyEvidenceHash: sha('invented normal difficulty'),
    },
    beforeUnexhaust: 'EXAMPLE_BEFORE_UNEXHAUST',
    terrain: {
      tiles: tileSources.map((source) => ({ source, evidenceHash: sha(source) })),
      forbiddenPrefabs: [],
      evidenceHash: sha('invented terrain'),
    },
    instructions: instructions.map((a) => ({
      source: a.source,
      movement: 1,
      alternativeMovement: 2,
      alternativeDestination: 'hero',
      evidenceHash: sha(['invented policy', a.source].join(':')),
    })),
    thresholds: [],
  };
  return source;
}

export function attachActivationThreshold(source, pack) {
  const prior = pack.definitions.find((d) => d.source === 'example.assets:811');
  const register = prior.states.find((s) => s.index === 2).actions[0];
  register.threshold = 25;
  const definition = structuredClone(prior);
  definition.source = 'example.assets:814';
  definition.handlers = { EXAMPLE_THRESHOLD: 1 };
  const entry = definition.states.find((s) => s.index === 1);
  entry.actions[0].right.value = 9;
  delete entry.actions[1].trial;
  const next = definition.states.find((s) => s.index === 2).actions[0];
  next.source = 'example.assets:1001';
  next.threshold = 60;
  pack.definitions.push(definition);
  const followup = pack.manifest.followup;
  followup.instances.push({
    gameObject: 'example.assets:815',
    definition: definition.source,
    kind: 'threat',
    hasNode: false,
    initializationHash: sha('invented init'),
    lifecycleHash: sha('invented lifecycle'),
  });
  followup.thresholds.find((t) => t.source === register.source).definition = definition.source;
  followup.thresholds.push({ source: next.source, definition: null });
  source.shadow.thresholds.push({
    source: register.source,
    owner: 'example.assets:815',
    definition: definition.source,
    threshold: 25,
    multiplier: 9,
    nextSource: next.source,
    nextOwner: 'example.assets:816',
    nextThreshold: 60,
    evidenceHash: sha('invented threshold'),
  });
}
