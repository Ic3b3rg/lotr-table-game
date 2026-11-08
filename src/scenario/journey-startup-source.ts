import {
  JourneyDepartureCapabilitySchema,
  type CampDepartureCapability,
} from '../shared/camp-departure';
import { ScenarioPackSchema, type ScenarioPack } from '../shared/scenario';
import type { Projection } from '../shared/generated-map';
import { parseGeneratorPack } from '../map-freeze/pack';
import { compileScenarioPack } from './compiler';
import { FrontArtifactSchema } from '../physical-resolution/front-program';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';
import { verifySourceDeployment } from '../combat/deployment-compiler';
import { plus, turn } from '../map-assembly/physical';
import { compileCombatClosure } from '../combat/compiler';

/** This decoder owns the prospective recipe; the client never supplies any of it. */
export function validateJourneyDepartureSource(raw: unknown) {
  const s = JourneyDepartureCapabilitySchema.parse(raw);
  invariant(
    digest(s.generator) === s.generatorHash && digest(s.startup) === s.startupHash,
    'Ricetta viaggio diversa dalla fonte prospettica.',
  );
  const generator = parseGeneratorPack(s.generator),
    startup = compileScenarioPack(s.startup);
  const pack = startup.pack,
    cap = pack.manifest.journeyStartup;
  invariant(
    generator.identity.adventureId === 3 &&
      generator.identity.adventureSource === s.target.model &&
      pack.identity.adventureId === 3 &&
      pack.identity.adventureSource === s.target.model &&
      pack.principal === s.target.principal &&
      cap &&
      cap.generatorHash === s.generatorHash &&
      digest(cap.heroIds) === digest(s.heroIds) &&
      pack.manifest.startupPreparation &&
      pack.manifest.followup &&
      pack.manifest.combat?.source.format === 'combat-closure-A3-v1' &&
      !pack.manifest.combat.source.shadow &&
      pack.manifest.rounds?.version === 'source-rounds-v1',
    'Closure viaggio3, compagnia o modello non corrispondenti.',
  );
  invariant(
    s.preparationHash === digest(s.camp.preparation) &&
      s.camp.preparation.skillsFingerprint === digest(s.camp.skills) &&
      s.camp.preparation.itemsFingerprint === digest(s.camp.items) &&
      [
        s.camp.skills.catalogFingerprint,
        s.camp.items.catalogFingerprint,
        s.camp.preparation.catalogFingerprint,
        generator.catalog.fingerprint,
        s.deckCatalog.fingerprint,
      ].every((h) => h === s.catalogHash),
    'Materiali del secondo campo discontinui.',
  );
  invariant(
    new Set(s.heroIds).size === s.heroIds.length &&
      !pack.manifest.campDeparture &&
      !pack.manifest.battleStartup &&
      !pack.manifest.failure &&
      !pack.manifest.playablePrefabs?.length,
    'Autorità viaggio3 ricorsiva o con consumer successivi.',
  );
  const principal = pack.definitions.find((d) => d.source === pack.principal)!;
  const selection = generator.template.selection,
    geometry = generator.template.geometry,
    placement = generator.template.placement;
  invariant(
    !selection.custom.length &&
      digest(selection.requiredConnections) ===
        digest([
          [0, 1],
          [1, 3],
          [1, 4],
          [1, 5],
          [1, 6],
          [1, 2],
        ]) &&
      selection.sections.every(
        (section, n) =>
          section.index === n &&
          section.allowedTileSets === (n < 2 ? 8 : 3) &&
          section.minimumSpaces === 2 &&
          section.maximumSpaces === (n === 1 ? 4 : 3) &&
          section.ignorePlayerScaling === n > 1 &&
          section.relativeSizeFactor === (n === 0 ? Math.fround(0.15) : 0.5) &&
          !section.start &&
          !section.required.length &&
          !section.traitRequirements.length,
      ) &&
      geometry.sections.every(
        (section, n) =>
          section.tileClumpFactor === 1 && section.sectionClumpFactor === (n < 2 ? 1 : 0),
      ) &&
      placement.sections.every(
        (section, n) =>
          !section.tileEncounters?.length &&
          section.randomFillPercent ===
            [
              Math.fround(0.605),
              Math.fround(0.605),
              Math.fround(0.6),
              0.5,
              Math.fround(0.6),
              0.5,
              Math.fround(0.6),
            ][n],
      ) &&
      digest(geometry.mapPosition) === digest([-11.240086555480957, 0.9968953132629395, 0]) &&
      digest(geometry.cornerCos) ===
        digest([
          0.8660253882408142, 0, -0.8660253882408142, -0.8660253882408142, 0, 0.8660253882408142,
        ]) &&
      digest(geometry.cornerSin) === digest([0.5, 1, 0.5, -0.5, -1, -0.5]),
    'Ricetta, ordine o posa viaggio3 diversi dalla fonte.',
  );
  invariant(
    placement.models.every((model) =>
      pack.manifest.prefabs.some(
        (p) =>
          p.source === model.prefab.source &&
          p.modelSource === model.source &&
          p.encounterId === model.id,
      ),
    ) &&
      geometry.tiles.every((tile) =>
        tile.hexes.every((hex) => hex.render?.polygon.length === 6 && hex.render.uv.length === 6),
      ),
    'Closure degli incontri possibili o geometria viaggio3 incompleta.',
  );
  invariant(
    new Set(cap.explorationNodes.map((n) => n.source)).size === cap.explorationNodes.length &&
      new Set(cap.explorationNodes.map((n) => n.tileSource)).size === cap.explorationNodes.length &&
      geometry.tiles.every((t) => cap.explorationNodes.some((n) => n.tileSource === t.source)),
    'Segnalini esplorazione viaggio3 senza identità/posa fonte.',
  );
  const actions = principal.states.flatMap((state) => state.actions),
    rounds = pack.manifest.rounds!,
    spawn = actions.filter((a) => a.op === 'spawnRandom'),
    multiply = actions.filter((a) => a.op === 'multiplyInt'),
    thresholds = actions.filter((a) => a.op === 'threat');
  invariant(
    !pack.timers.length &&
      rounds.threat.limit === 68 &&
      spawn.length === 1 &&
      spawn[0]!.op === 'spawnRandom' &&
      digest(spawn[0]!.filter) === digest({ MustHaveAny: 3, MustHaveAll: 0, ExcludeIfAny: 128 }) &&
      multiply.length === 1 &&
      multiply[0]!.op === 'multiplyInt' &&
      multiply[0]!.right.kind === 'literal' &&
      multiply[0]!.right.value === 7 &&
      thresholds.length === 1 &&
      thresholds[0]!.op === 'threat' &&
      thresholds[0]!.threshold === 20 &&
      cap.reserved.length === 1 &&
      cap.reserved[0]!.count === 3 &&
      new Set(cap.resetBindings).size === cap.resetBindings.length &&
      cap.resetBindings.every((name) => pack.globals.some((v) => v.name === name)) &&
      !cap.resetBindings.includes(cap.previousOutcomeBinding),
    'Contatori, riserve o startup viaggio3 non corrispondenti.',
  );
  const deployment = verifySourceDeployment(pack.manifest.followup!.deployment),
    adventure = deployment.source.assets.find((a) => a.source === s.target.model)!;
  invariant(
    adventure &&
      adventure.data.BonusPref === 1 &&
      adventure.data.FigurePref === 1 &&
      digest(adventure.data.GlobalEnemyFilter) ===
        digest({ MustHaveAny: 0, MustHaveAll: 0, ExcludeIfAny: 0 }) &&
      cap.reserved.every((r) => deployment.compiled.models.some((m) => m.source === r.source)),
    'Deployment viaggio3 senza pool o riserve fonte.',
  );
  invariant(
    principal.handlers.SCENARIO_BEGIN !== undefined &&
      principal.handlers[cap.roundStartEvent] === undefined &&
      principal.states
        .flatMap((s) => s.actions)
        .filter((a) => a.op === 'highlight' && a.randomSpace).length === 1 &&
      principal.states
        .flatMap((s) => s.actions)
        .filter((a) => a.op === 'message' && a.mode === 'scout' && a.scoutCount === 3).length === 1,
    'Ingresso, Scoperta o collocazione viaggio3 incompleti.',
  );
  invariant(
    pack.globals.some((v) => v.name === cap.previousOutcomeBinding && v.type === 'bool') &&
      pack.globals.some((v) => v.name === cap.rangerTileBinding && v.type === 'int') &&
      pack.manifest.prefabs.some((p) => p.source === cap.rangerPrefab),
    'Raminga o esito precedente senza binding fonte.',
  );
  for (const d of pack.definitions)
    for (const state of d.states)
      for (const a of state.actions)
        if (a.op === 'physical') {
          invariant(
            a.origin.type === 'FFG.JIME.Actions.DisplayMessage' &&
              a.program.profile === 'source-fronts-v1' &&
              a.program.children.length === s.heroIds.length &&
              a.program.children.every(
                (c, n) =>
                  c.kind === 'suffer' &&
                  c.hero === n &&
                  c.face === 'facedown' &&
                  c.cards.length === 1 &&
                  c.cards[0]!.family === 'fear' &&
                  c.cards[0]!.amount === 1,
              ),
            'Conseguenza iniziale viaggio3 diversa dal messaggio fonte.',
          );
        }
  return { s, generator, startup, fronts: FrontArtifactSchema.parse(s.fronts), board: null };
}

/** Rebuild the second camp from authority frozen before the NEW A2 origin. */
export function secondCampPack(
  departure: CampDepartureCapability,
  pack: ScenarioPack,
): ScenarioPack {
  if (departure.continuation === undefined) return pack;
  const { s } = validateJourneyDepartureSource(departure.continuation);
  invariant(
    departure.battleRounds &&
      pack.manifest.failure &&
      pack.manifest.failure.next.id === 3 &&
      pack.manifest.failure.next.source === s.target.model &&
      s.camp.skills.failureFingerprint === digest(pack.manifest.failure) &&
      s.camp.items.failureFingerprint === digest(pack.manifest.failure),
    'Secondo campo non legato al termine A2 prospettico.',
  );
  return ScenarioPackSchema.parse({
    ...pack,
    manifest: {
      ...pack.manifest,
      campDeparture: s,
      campSkills: s.camp.skills,
      campItems: s.camp.items,
      campPreparation: s.camp.preparation,
    },
  });
}

/** Only realization bindings change; source instructions and their certificates remain immutable. */
export function bindJourneyStartup(
  s: ReturnType<typeof validateJourneyDepartureSource>['s'],
  p: Projection,
) {
  const input = structuredClone(s.startup);
  const pack = ScenarioPackSchema.parse(input.pack);
  invariant(pack.manifest.rounds && pack.manifest.followup, 'Template viaggio incompleto.');
  pack.manifest.rounds.projectionFingerprint = p.fingerprint;
  pack.manifest.rounds.darkness.spaces = p.spaces.map((space) => ({
    id: space.id,
    source: space.source,
    hasDarkness: space.hasDarkness,
    evidenceHash: digest({ space: space.source, hasDarkness: space.hasDarkness }),
  }));
  pack.manifest.followup.projectionFingerprint = p.fingerprint;
  if (pack.manifest.combat) {
    const combat = structuredClone(pack.manifest.combat.source);
    combat.projectionFingerprint = p.fingerprint;
    pack.manifest.combat = compileCombatClosure(combat);
  }
  pack.manifest.followup.explorationNodes = p.sections.flatMap((section) =>
    section.tiles.map((tile) => {
      const node = pack.manifest.journeyStartup!.explorationNodes.find(
        (n) => n.tileSource === tile.source,
      )!;
      return {
        ...node,
        position: plus(turn(node.position, tile.compositeRotation), tile.worldPosition),
      };
    }),
  );
  input.pack = pack;
  input.roundsCertificate = { instructionHash: digest(pack.manifest.rounds) };
  input.followupCertificate = { instructionHash: digest(pack.manifest.followup) };
  return compileScenarioPack(input);
}
