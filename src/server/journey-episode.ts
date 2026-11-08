import type { State } from './state';
import type { CampDepartureInput, JourneyDepartureCapability } from '../shared/camp-departure';
import { EpisodeBoundarySchema } from '../shared/camp-departure';
import type { CampDeckArtifact } from '../camp-decks/decks';
import type { FrontArtifact } from '../physical-resolution/front-program';
import { archiveDomain } from './episode-state';
import {
  validateJourneyDepartureSource,
  bindJourneyStartup,
} from '../scenario/journey-startup-source';
import { deriveContext } from '../map-freeze/pack';
import { runGenerationAttempt } from '../map-freeze/pipeline';
import type { Projection, AttemptRecord } from '../shared/generated-map';
import { projectionToJourney } from '../scenario/geometry';
import { beginScenario } from '../scenario/runtime';
import { SourceRandom } from '../map-generation/primitives';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';
import { cycleUUID } from '../physical-resolution/cycle-request';
import { newRound } from './rounds';
import { ApiError } from './errors';
import { initialCombat } from '../combat/controller';

/** The third origin uses the existing generator, scenario executor and physical ledger. */
export function activateJourneyEpisode(
  state: State,
  actor: { playerId: string; requestId: string; pendingId: string; sourceFingerprint: string },
  input: CampDepartureInput,
  cap: JourneyDepartureCapability,
  fronts: FrontArtifact,
  entropy: string,
  decks: CampDeckArtifact,
  deckSource: CampDeckArtifact['source'],
) {
  invariant(
    state.schemaVersion === 36 &&
      state.episodes?.length === 1 &&
      state.physical?.cycle?.version === 4,
    'Viaggio3 senza i due prefissi prospettici.',
  );
  const checked = validateJourneyDepartureSource(cap),
    archived = archiveDomain(state),
    campaign = archived.scenario!.conclusion!.campaign!,
    weakness = new Set(
      cap.deckCatalog.cards.filter((c) => c.kind === 'weakness').flatMap((c) => c.copies),
    ),
    sourceFingerprint = digest(cap),
    archiveFingerprint = digest(archived),
    archives = [...structuredClone(state.episodes), archived],
    chainFingerprint = digest(archives),
    id = cycleUUID({ kind: 'episode3', chainFingerprint, sourceFingerprint, entropy });
  const preparation: NonNullable<State['preparation']> = {
    status: 'prepared',
    episode: {
      version: 'camp-departure-v1',
      sourceFingerprint,
      skills: structuredClone(cap.campaignSkills),
      heroes: decks.materialized.heroes.map((h) => ({
        heroId: h.heroId,
        accessory: deckSource.choices.find((c) => c.heroId === h.heroId)!.accessory,
        copies: [...h.prepared, ...h.deck].filter((c) => !weakness.has(c)),
      })),
    },
    weaknessDeck: [...decks.materialized.weaknessPool.reserve].reverse(),
    heroes: decks.materialized.heroes.map((h) => ({
      heroId: h.heroId,
      playerId: h.playerId,
      roleId: h.roleId,
      itemCopies: [...campaign.heroes.find((c) => c.heroId === h.heroId)!.itemCopies],
      inspiration: 0,
      prepared: [...h.prepared],
      deck: [...h.deck].reverse(),
      discard: [],
    })),
  };
  const originPreparation = structuredClone(preparation),
    generator = checked.generator;
  const context = deriveContext(generator, {
    content: state.content,
    preparation,
    groupItemCatalogIds: (campaign.inventory ?? []).map((i) => i.cardId),
  });
  const oldMap = state.episodes[0]!.mapGeneration;
  invariant(oldMap?.status === 'frozen', 'Storia generata A1 assente.');
  Object.assign(context, structuredClone(oldMap.projection.history));
  const requestedSeed = Buffer.from(
    digest({ stream: 'journey3-map-v1', entropy }),
    'hex',
  ).readInt32LE(0);
  let incoming = generator.template.selection.incoming;
  const attempts: AttemptRecord[] = [];
  let projection: Projection | undefined;
  for (let attempt = 0; attempt < 64; attempt++) {
    const result = runGenerationAttempt(generator, context, {
      requestedSeed,
      seed: (requestedSeed + attempt) | 0,
      attempt,
      incoming,
      attempts,
    });
    if (result.status === 'frozen') {
      projection = result.projection;
      break;
    }
    if (!result.retry)
      throw new ApiError(
        409,
        'ADVENTURE3_GENERATION_GATED',
        'La ricetta di viaggio si è fermata al proprio limite. Nessuna partenza o carta è stata applicata.',
      );
    incoming = result.incoming;
    attempts.push(result.record);
  }
  if (!projection)
    throw new ApiError(
      409,
      'ADVENTURE3_GENERATION_GATED',
      'La generazione ha raggiunto il limite di tentativi. La Compagnia resta al campo.',
    );
  const parsed = bindJourneyStartup(cap, projection),
    start = projection.sections[0]!.tiles[0]!,
    spaces = projection.spaces
      .filter((s) => s.tileSource === start.source)
      .sort((a, b) => a.index - b.index),
    seed = Buffer.from(
      digest({ stream: 'journey3-unity-range-port-v1', entropy }),
      'hex',
    ).readInt32LE(0),
    random = new SourceRandom(seed),
    startSpaceIndex = random.nextInt(0, spaces.length),
    geometry = projectionToJourney(projection, spaces[startSpaceIndex]!.id, cap.target.name),
    journey = {
      id,
      definition: geometry.definition,
      travel: null,
      heroes: preparation.heroes.map((h) => ({
        heroId: h.heroId,
        spaceId: geometry.definition.startSpaceId,
      })),
    };
  const balances = structuredClone(campaign.training!.balances);
  for (const h of preparation.heroes)
    if (!balances.some((b) => b.heroId === h.heroId && b.roleId === h.roleId))
      balances.push({ heroId: h.heroId, roleId: h.roleId!, availableXP: 0 });
  const carried = archived.scenario!.battle!.campaign;
  const oldPhysical = state.physical;
  const titles = structuredClone(oldPhysical.snapshot.lastStand?.titles ?? []).map((t) => ({
    ...t,
    removed: false,
    pending: false,
  }));
  Object.assign(state, {
    episodes: archives,
    preparation,
    round: null,
    journey: null,
    skillTest: null,
    scout: null,
    scenario: null,
    physical: null,
    mapGeneration: { status: 'frozen', id, projection, requests: [] },
  });
  delete state.combat;
  beginScenario(
    state,
    parsed,
    {
      raw: oldPhysical.raw,
      rawSha256: oldPhysical.rawSha256,
      fronts,
      lastStand: oldPhysical.lastStand,
      boons: oldPhysical.boons,
    },
    {
      id,
      physical: {
        entropy: digest({ stream: 'episode3-physical-v1', entropy }),
        campaignSkills: structuredClone(cap.campaignSkills),
        episode: { version: 'camp-departure-v1', titles },
      },
      state: {
        version: 'source-journey-startup-A3-v1',
        sourceFingerprint,
        stage: 'initial',
        runId: null,
        startSpaceIndex,
        startSpaceDraw: {
          policy: 'unity-range-port-v1',
          seed,
          maximum: spaces.length,
          value: startSpaceIndex,
        },
        campaign: {
          lore: archived.scenario!.play!.lore,
          completedAdventureIds: [...archived.scenario!.conclusion!.completedAdventureIds],
          balances,
          lastStandsFailed:
            carried.lastStandsFailed +
            (oldPhysical.snapshot.lastStand?.selections.filter((s) => s.outcome === 'fail')
              .length ?? 0),
          inventoryHash: digest(campaign),
          globals: {
            ...structuredClone(carried.globals),
            ...structuredClone(archived.scenario!.globals),
          },
          ownership: {
            heroes: campaign.heroes.map((h) => ({
              heroId: h.heroId,
              roleId: h.roleId,
              itemCopies: [...h.itemCopies],
              titleCopies: [...h.titleCopies],
              purchasedCopies: (h.skillCopies ?? []).filter((copy) =>
                cap.deckCatalog.cards.some(
                  (c) => c.kind === 'purchased' && c.copies.includes(copy),
                ),
              ),
            })),
            inventory: structuredClone(campaign.inventory ?? []),
          },
        },
      },
    },
  );
  if (parsed.pack.manifest.combat) state.combat = initialCombat(state);
  const receipt = {
    version: 'camp-departure-v2' as const,
    episodeNumber: 3 as const,
    chainFingerprint,
    archivedEpisodeId: archived.scenario!.id,
    episodeId: id,
    archiveFingerprint,
    sourceFingerprint,
    deckSourceFingerprint: decks.sourceFingerprint,
    deckArtifactFingerprint: decks.artifactFingerprint,
    boardArtifactFingerprint: projection.fingerprint,
    realizationFingerprint: decks.realizationFingerprint,
    drawOrder: [...deckSource.drawOrder],
  };
  const boundary = EpisodeBoundarySchema.parse({
    version: 'camp-departure-v2',
    ...actor,
    generation: state.generation,
    expectedRevision: state.revision,
    input: structuredClone(input),
    entropy,
    archiveFingerprint,
    chainFingerprint,
    receipt,
  });
  const round = newRound(state, 1);
  round.id = cycleUUID({ scenario: id, round: 1 });
  state.physical!.version = 3;
  state.physical!.cycle = {
    version: 4,
    seed: {
      departure: boundary,
      revision: state.revision + 1,
      round,
      journey,
      preparation: originPreparation,
    },
    records: [],
    pending: null,
  };
  state.scenario!.commands.push({
    playerId: actor.playerId,
    requestId: actor.requestId,
    pendingId: actor.pendingId,
    source: actor.sourceFingerprint,
    kind: 'camp-depart',
    revision: state.revision + 1,
  });
  return receipt;
}
