import { createHash } from 'node:crypto';
import { StateSchema, EpisodeArchiveSchema, type State, type EpisodeArchive } from './state';
import type { CycleState } from '../shared/physical-cycle';
import type { Receipt } from '../shared/protocol';
import { CommandSchema } from '../shared/protocol';
import {
  EpisodeBoundarySchema,
  type CampDepartureInput,
  type EpisodeBoundary,
} from '../shared/camp-departure';
import { activateJourneyEpisode } from './journey-episode';
import type { CampDeckArtifact } from '../camp-decks/decks';
import { beginCampDeparture, validateCampDepartureSource } from '../scenario/camp-departure';
import { createBattleScenario, pumpBattleStartup } from '../scenario/battle-startup';
import { freezePhysical } from '../physical-resolution/runtime';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';
import { cycleUUID } from '../physical-resolution/cycle-request';
import { executeEpisodeIntent } from './physical-cycle';
import { scenarioReceiptProblem } from '../scenario/validate';
import { initialCombat } from '../combat/controller';

/** Game domain only: no session, authentication, recovery or receipt-table copies. */
export function archiveDomain(state: State): EpisodeArchive {
  return structuredClone(
    EpisodeArchiveSchema.parse(
      Object.fromEntries(
        Object.keys(EpisodeArchiveSchema.shape)
          .filter((key) => Object.prototype.hasOwnProperty.call(state, key))
          .map((key) => [key, Reflect.get(state, key)]),
      ),
    ),
  );
}
export function archivedState(state: State): State {
  invariant(
    state.episodes && state.episodes.length >= 1 && state.episodes.length <= 2,
    'Episodio archiviato assente.',
  );
  const work = { ...state };
  for (const key of Object.keys(EpisodeArchiveSchema.shape)) Reflect.deleteProperty(work, key);
  Object.assign(work, structuredClone(state.episodes.at(-1)!));
  if (state.episodes.length > 1) work.episodes = structuredClone(state.episodes.slice(0, -1));
  else delete work.episodes;
  return work;
}
export function activateEpisode(
  state: State,
  actor: { playerId: string; requestId: string; pendingId: string; sourceFingerprint: string },
  input: CampDepartureInput,
  source: ReturnType<typeof validateCampDepartureSource> & {
    deckSource: CampDeckArtifact['source'];
  },
  seed: string,
  decks: CampDeckArtifact,
) {
  if (source.s.version === 'source-camp-departure-A3-v1')
    return activateJourneyEpisode(
      state,
      actor,
      input,
      source.s,
      source.fronts,
      seed,
      decks,
      source.deckSource,
    );
  const prospective = source.s.continuation !== undefined;
  const archived = archiveDomain(state),
    cap = source.s,
    c = archived.scenario!.conclusion!,
    campaign = c.campaign!,
    sourceFingerprint = digest(cap),
    archiveFingerprint = digest(archived);
  const id = cycleUUID({ kind: 'episode2', archiveFingerprint, sourceFingerprint, seed });
  const balances = structuredClone(campaign.training!);
  for (const h of campaign.heroes)
    if (!balances.balances.some((b) => b.heroId === h.heroId && b.roleId === h.roleId))
      balances.balances.push({ heroId: h.heroId, roleId: h.roleId!, availableXP: 0 });
  const { scenario, geometry } = createBattleScenario(
    cap,
    id,
    archived.scenario!.play!.lore,
    balances,
    archived.scenario!,
    archived.physical!.snapshot.lastStand?.selections.filter((s) => s.outcome === 'fail').length ??
      0,
  );
  const weakness = new Set(
    cap.deckCatalog.cards.filter((c) => c.kind === 'weakness').flatMap((c) => c.copies),
  );
  const preparation: NonNullable<State['preparation']> = {
    status: 'prepared',
    episode: {
      version: 'camp-departure-v1',
      sourceFingerprint,
      skills: structuredClone(cap.campaignSkills),
      heroes: decks.materialized.heroes.map((h) => ({
        heroId: h.heroId,
        accessory: source.deckSource.choices.find((c) => c.heroId === h.heroId)!.accessory,
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
  const journey = {
    id,
    definition: geometry.definition,
    heroes: preparation.heroes.map((h) => ({
      heroId: h.heroId,
      spaceId: geometry.definition.startSpaceId,
    })),
    travel: null,
  };
  const round = {
    id: cycleUUID({ scenario: id, round: 1 }),
    number: 1,
    phase: 'action' as const,
    shadowStep: null,
    activeHeroId: null,
    turnId: null,
    heroes: preparation.heroes.map((h) => ({
      heroId: h.heroId,
      actionsUsed: 0,
      turnEnded: false,
      rallyDone: false,
    })),
  };
  const legacyReceipt = {
    version: 'camp-departure-v1' as const,
    archivedEpisodeId: archived.scenario!.id,
    episodeId: id,
    archiveFingerprint,
    sourceFingerprint,
    deckSourceFingerprint: decks.sourceFingerprint,
    deckArtifactFingerprint: decks.artifactFingerprint,
    boardArtifactFingerprint: source.board!.artifactFingerprint,
    realizationFingerprint: decks.realizationFingerprint,
    drawOrder: [...source.deckSource.drawOrder],
  };
  const receipt = prospective
    ? {
        ...legacyReceipt,
        version: 'camp-departure-v2' as const,
        episodeNumber: 2 as const,
        chainFingerprint: digest([archived]),
      }
    : legacyReceipt;
  const boundary: EpisodeBoundary = EpisodeBoundarySchema.parse({
    version: prospective ? 'camp-departure-v2' : 'camp-departure-v1',
    ...(prospective ? { generation: state.generation, chainFingerprint: digest([archived]) } : {}),
    ...actor,
    expectedRevision: state.revision,
    input: structuredClone(input),
    entropy: seed,
    archiveFingerprint,
    receipt,
  });
  const old = archived.physical!;
  const physical = freezePhysical(
    old.raw,
    {
      scenarioId: id,
      packFingerprint: scenario.packFingerprint,
      projectionFingerprint: scenario.projectionFingerprint,
    },
    preparation.heroes.map((h) => ({
      heroId: h.heroId,
      playerId: h.playerId,
      spaceId: journey.definition.startSpaceId,
    })),
    digest({ stream: 'episode2-physical-v1', seed }),
    old.rawSha256,
    {
      artifact: source.fronts,
      catalog: state.content!,
      ...(cap.campaignSkills.length ? { campaignSkills: structuredClone(cap.campaignSkills) } : {}),
    },
    old.lastStand,
    old.boons,
    {
      version: 'camp-departure-v1',
      titles: structuredClone(old.snapshot.lastStand?.titles ?? []).map((t) => ({
        ...t,
        removed: false,
        pending: false,
      })),
    },
  );
  physical.version = 3;
  physical.episode = {
    version: 'camp-departure-v1',
    titles: structuredClone(old.snapshot.lastStand?.titles ?? []).map((t) => ({
      ...t,
      removed: false,
      pending: false,
    })),
  };
  physical.cycle = {
    version: prospective ? 4 : 3,
    seed: {
      departure: boundary,
      revision: state.revision + 1,
      round,
      journey: structuredClone(journey),
      preparation: structuredClone(preparation),
    },
    records: [],
    pending: null,
  };
  Object.assign(state, {
    episodes: [archived],
    scenario,
    physical,
    preparation,
    journey,
    round: null,
    skillTest: null,
    scout: null,
    mapGeneration: null,
  });
  delete state.combat;
  if (cap.combat) state.combat = initialCombat(state);
  state.scenario!.commands.push({
    playerId: actor.playerId,
    requestId: actor.requestId,
    pendingId: actor.pendingId,
    source: actor.sourceFingerprint,
    kind: 'camp-depart',
    revision: state.revision + 1,
  });
  pumpBattleStartup(state);
  return receipt;
}
function boundaryReceipt(state: State, b: EpisodeBoundary): Receipt {
  return {
    requestId: b.requestId,
    type: 'SCENARIO_INPUT',
    appliedRevision: b.expectedRevision + 1,
    scenarioId: b.receipt.episodeId,
    pendingId: b.pendingId,
    source: b.sourceFingerprint,
    kind: 'camp-depart',
    phase: 'setup',
    departure: structuredClone(b.receipt),
  };
}
type Proof = { work: State; receipts: Receipt[] };
const proofs = new Map<string, { records: string; value: Proof }>();
/** Both epochs are replayed from frozen sources, never from mutually agreeing output hashes. */
export function replayEpisode(state: State, cycle: CycleState): Proof {
  invariant(
    (cycle.version === 3 || cycle.version === 4) &&
      cycle.seed.departure &&
      state.episodes &&
      (cycle.version === 3
        ? state.episodes.length === 1 && cycle.seed.departure.version === 'camp-departure-v1'
        : cycle.seed.departure.version === 'camp-departure-v2' &&
          state.episodes.length === cycle.seed.departure.receipt.episodeNumber - 1 &&
          digest(state.episodes) === cycle.seed.departure.chainFingerprint),
    'Origine episodio2 mancante.',
  );
  const b = cycle.seed.departure,
    archive = state.episodes!.at(-1)!,
    context = digest({
      archives: state.episodes,
      boundary: b,
      players: state.players.map((p) => p.id),
    }),
    proof = proofs.get(context);
  let result: Proof;
  if (
    proof &&
    proof.value.receipts.length <= cycle.records.length &&
    proof.records === digest(cycle.records.slice(0, proof.value.receipts.length))
  )
    result = structuredClone(proof.value);
  else {
    const work = archivedState(state);
    if (b.version === 'camp-departure-v2') work.generation = b.generation;
    StateSchema.parse(work);
    invariant(
      b.expectedRevision === work.revision && digest(archive) === b.archiveFingerprint,
      'Confine non continuo con l’episodio archiviato.',
    );
    const q = work.scenario!.pending;
    invariant(
      q &&
        q.id === b.pendingId &&
        q.fingerprint === b.sourceFingerprint &&
        work.players.some((p) => p.id === b.playerId),
      'Partenza senza richiesta o attore fonte.',
    );
    const receipt = beginCampDeparture(
      work,
      {
        playerId: b.playerId,
        requestId: b.requestId,
        pendingId: b.pendingId,
        sourceFingerprint: b.sourceFingerprint,
      },
      b.input,
      work.scenario!.pack.manifest.campDeparture,
      () => b.entropy,
    );
    invariant(
      digest(receipt) === digest(b.receipt),
      'Ricevuta/composizione partenza non ricostruita.',
    );
    invariant(
      digest(work.physical!.cycle!.seed) === digest(cycle.seed),
      'Origine autonoma episodio2 modificata.',
    );
    work.revision = b.expectedRevision + 1;
    result = { work, receipts: [] };
  }
  for (const record of cycle.records.slice(result.receipts.length)) {
    invariant(
      cycle.version === 4 ? !!record.generation : record.generation === undefined,
      'Generation del comando fuori dalla propria versione.',
    );
    if (record.generation && record.generation !== result.work.generation) {
      invariant(
        record.intent.expectedRevision > result.work.revision,
        'Generation modificata senza un confine amministrativo.',
      );
      result.work.generation = record.generation;
    }
    invariant(
      record.intent.expectedRevision >= result.work.revision,
      'Ordine episodio2 modificato.',
    );
    result.work.revision = record.intent.expectedRevision;
    const ledger = result.work.physical!.cycle!;
    result.receipts.push(executeEpisodeIntent(result.work, ledger, record));
    ledger.records.push(structuredClone(record));
    result.work.physical!.cycle = ledger;
    result.work.revision++;
  }
  proofs.delete(context);
  proofs.set(context, { records: digest(cycle.records), value: structuredClone(result) });
  if (proofs.size > 3) proofs.delete(proofs.keys().next().value!);
  return result;
}
const keys = [
  'content',
  'scenario',
  'physical',
  'preparation',
  'round',
  'journey',
  'skillTest',
  'scout',
  'combat',
  'mapGeneration',
  'group',
  'episodes',
] as const;
export function applyEpisodeDomain(state: State, work: State) {
  for (const key of keys) {
    if (work[key] === undefined) delete state[key];
    else Object.assign(state, { [key]: structuredClone(work[key]) });
  }
}
export function validateEpisodeState(state: State) {
  const cycle = state.physical?.cycle;
  if (cycle?.version !== 3 && cycle?.version !== 4) {
    invariant(
      !state.episodes &&
        !state.preparation?.episode &&
        !state.scenario?.battle &&
        !state.physical?.episode &&
        !state.scenario?.pack.manifest.battleStartup,
      'Forme episodio2 fuori dal ledger della partenza.',
    );
    return;
  }
  const { work } = replayEpisode(state, cycle);
  for (const key of keys)
    invariant(
      digest(work[key] ?? null) === digest(state[key] ?? null),
      `Episodio2 non riconciliato: ${key}.`,
    );
}
function intentFingerprint(command: unknown) {
  const { requestId: _, generation: __, ...intent } = CommandSchema.parse(command);
  return createHash('sha256').update(JSON.stringify(intent)).digest('hex');
}
export function validateEpisodeReceipts(
  state: State,
  commands: { playerId: string; requestId: string; fingerprint?: string; receipt: Receipt }[],
) {
  const cycle = state.physical!.cycle!,
    b = cycle.seed.departure!,
    archive = archivedState(state);
  const old = commands.filter((c) => c.receipt.appliedRevision <= archive.revision);
  const problem = scenarioReceiptProblem(archive, old);
  invariant(!problem, problem ?? 'Ricevute episodio1 mancanti.');
  const q = archive.scenario!.pending!,
    command = {
      type: 'SCENARIO_INPUT',
      requestId: b.requestId,
      generation: state.generation,
      expectedRevision: b.expectedRevision,
      scenarioId: archive.scenario!.id,
      packFingerprint: archive.scenario!.packFingerprint,
      projectionFingerprint: archive.scenario!.projectionFingerprint,
      pendingId: q.id,
      sourceFingerprint: q.fingerprint,
      heroId: null,
      input: b.input,
    };
  const stored = commands.find((c) => c.playerId === b.playerId && c.requestId === b.requestId);
  invariant(
    stored &&
      stored.fingerprint === intentFingerprint(command) &&
      digest(stored.receipt) === digest(boundaryReceipt(state, b)),
    'Ricevuta del confine episodio incoerente.',
  );
  const { receipts } = replayEpisode(state, cycle),
    active = commands.filter((c) => c.receipt.appliedRevision > b.expectedRevision + 1);
  invariant(active.length === cycle.records.length, 'Ricevute episodio2 incomplete.');
  cycle.records.forEach((r, n) => {
    const stored = active.find((c) => c.playerId === r.playerId && c.requestId === r.requestId);
    invariant(
      stored &&
        stored.fingerprint ===
          intentFingerprint({
            ...r.intent,
            requestId: r.requestId,
            generation: state.generation,
          }) &&
        digest(stored.receipt) === digest(receipts[n]),
      'Intento/ricevuta episodio2 modificati.',
    );
  });
}
