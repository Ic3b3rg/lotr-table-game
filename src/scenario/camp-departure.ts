import type { State } from '../server/state';
import type { CampDeckSource } from '../camp-decks/model';
import {
  CampDepartureCapabilitySchema,
  CampDepartureInputSchema,
  type CampDepartureCapability,
  type CampDepartureOffer,
  type CampDepartureInput,
} from '../shared/camp-departure';
import { campDeckCapability, materializeCampDecks, verifyCampDeckArtifact } from '../camp-decks';
import { verifyBattleMapArtifact } from '../battle-map';
import { compileSourceDeployment } from '../combat/deployment-compiler';
import { FrontArtifactSchema, validateFrontArtifact } from '../physical-resolution/front-program';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';
import { boundPhysicalInput } from '../physical-content/validation';
import { definitionId } from '../shared/preparation';
import { physicalTitleSkills } from '../physical-resolution/title-skills';
import { ApiError } from '../server/errors';
import { archiveDomain, activateEpisode } from '../server/episode-state';
import { validateBattleCombatSource } from './battle-combat';
import { validateBattleRoundsSource, battleRoundsPack } from './battle-rounds';

let sourceCache: { key: string; result: ReturnType<typeof compileDepartureSource> } | undefined;
/** Never opens paths, programs or seeds supplied by a caller. Cache only complete content, not headers. */
export function validateCampDepartureSource(raw: unknown) {
  boundPhysicalInput(raw);
  const key = digest(raw);
  if (sourceCache?.key !== key) sourceCache = { key, result: compileDepartureSource(raw) };
  return structuredClone(sourceCache.result);
}
function compileDepartureSource(raw: unknown) {
  const s = CampDepartureCapabilitySchema.parse(raw);
  const board = verifyBattleMapArtifact(s.board, { artifactFingerprint: s.boardFingerprint });
  const layout = board.compiled.layouts.find((l) => l.id === board.compiled.selectedAlternative)!;
  invariant(
    layout.cells.length === 10 &&
      layout.geometricEdges.length === 19 &&
      layout.walkableEdges.length === 16 &&
      layout.walls.length === 3 &&
      layout.placements.length === 13,
    'Topologia battaglia2 incompleta.',
  );
  invariant(board.source.model.record === s.target.model, 'Modello2 diverso dal tabellone.');
  const ops = s.instructions.map((i) => i.op);
  invariant(
    digest(ops) ===
      digest([
        'threshold',
        'board',
        'heroes',
        'scout',
        'loss-weakness',
        'terrain',
        'terrain',
        'terrain',
        'message',
        'spawn',
        'spawn',
        'spawn',
        'marker',
        'marker',
        'objective',
        'handoff',
      ]),
    'Ordine principal2 non attestato.',
  );
  const terrains = s.instructions.filter((i) => i.op === 'terrain');
  invariant(
    digest(terrains.map((i) => i.kinds)) ===
      digest([
        ['bush', 'bush'],
        ['wall', 'wall', 'wall'],
        ['fire', 'rock'],
      ]),
    'Gruppi terreno2 incompleti.',
  );
  invariant(
    digest(s.instructions.filter((i) => i.op === 'spawn').map((i) => i.perHero)) ===
      digest([4, 6, 5]),
    'Budget spawn2 non attestati.',
  );
  invariant(
    digest(s.instructions.filter((i) => i.op === 'marker').map((i) => [i.kind, i.lore])) ===
      digest([
        ['threat', 0],
        ['search', 2],
      ]),
    'Ingresso minaccia/ricerca2 incoerente.',
  );
  const used: string[] = [];
  for (const i of s.instructions) {
    const anchors = 'anchors' in i ? i.anchors : 'anchor' in i ? [i.anchor] : [];
    for (const [n, anchor] of anchors.entries()) {
      const p = layout.placements.find((p) => p.id === anchor);
      invariant(p && !used.includes(anchor), 'Piazzamento mancante o duplicato.');
      used.push(anchor);
      invariant(
        i.op === 'terrain'
          ? i.kinds[n] === 'wall'
            ? p.kind === 'wall'
            : p.kind === 'terrain'
          : i.op === 'spawn'
            ? p.kind === 'spawn'
            : i.op === 'heroes'
              ? p.kind === 'hero'
              : i.op === 'marker' && p.kind === i.kind,
        'Tipo di ancora diverso dall’istruzione.',
      );
    }
  }
  invariant(used.length === 13, 'Ancore startup2 non interamente consumate.');
  const spawn = s.instructions.filter((i) => i.op === 'spawn');
  invariant(
    digest(spawn.map((i) => i.filter)) ===
      digest([
        { MustHaveAny: 1024, MustHaveAll: 0, ExcludeIfAny: 136 },
        { MustHaveAny: 0, MustHaveAll: 0, ExcludeIfAny: 136 },
        { MustHaveAny: 0, MustHaveAll: 0, ExcludeIfAny: 136 },
      ]),
    'Filtri dei punti spawn2 non attestati.',
  );
  invariant(
    digest(spawn.map((i) => i.anchor)) === digest(layout.spawnOrder),
    'Ordine dei punti spawn modificato.',
  );
  const deployment = compileSourceDeployment(s.deployment);
  invariant(
    deployment.source.adventure === s.target.model,
    'Modello deployment diverso dall’avventura2.',
  );
  const adventure = deployment.source.assets.find((a) => a.source === deployment.source.adventure)!;
  invariant(
    digest(adventure.data.GlobalEnemyFilter) ===
      digest({ MustHaveAny: 0, MustHaveAll: 0, ExcludeIfAny: 0 }),
    'Filtro globale dell’avventura2 diverso dalla fonte.',
  );
  invariant(
    deployment.compiled.eliteBanners.length === 6 &&
      deployment.compiled.normalBanners.length === 6 &&
      s.reservedEliteBanners <= 6,
    'Riserva stendardi non attestata.',
  );
  for (const m of [...deployment.compiled.models, ...deployment.compiled.bonuses])
    invariant(
      m.costs.every((row, n) => n === 0 || row.points >= m.costs[n - 1]!.points),
      'Progressione costi spawn non attestata.',
    );
  for (const model of deployment.compiled.models) {
    invariant(
      model.costs.every((row, n) => row.size === n + 1),
      'Costi modello spawn incompleti.',
    );
    for (const source of model.bonuses) {
      const bonus = deployment.compiled.bonuses.find((b) => b.source === source)!;
      if (bonus.unsupported) continue; // The source excludes these for the selected language.
      invariant(
        new Set(bonus.costs.map((row) => row.size)).size === bonus.costs.length &&
          model.costs.every((row) => bonus.costs.some((cost) => cost.size === row.size)),
        'Costi bonus spawn incompleti o duplicati.',
      );
    }
  }
  if (s.combat) validateBattleCombatSource(s);
  if (s.battleRounds) {
    validateBattleRoundsSource(s);
    battleRoundsPack(s);
  }
  invariant(digest(deployment) === s.deploymentHash, 'Closure deployment2 modificata.');
  invariant(
    digest(
      s.deployment.products.map(
        (ref) => s.deployment.assets.find((a) => a.source === ref)!.data._id,
      ),
    ) === digest(s.ownedProductIds),
    'Pool prodotti diverso dalla proprietà attestata.',
  );
  invariant(
    s.reserved.every((r) =>
      s.deployment.assets.some((a) => a.source === r.source && a.cls === 'EnemyModel'),
    ),
    'Riserva nemici senza modello.',
  );
  invariant(
    new Set(s.windows.map((w) => w.cardId)).size === s.windows.length,
    'Finestre carta duplicate.',
  );
  return { s, board, layout, deployment, fronts: FrontArtifactSchema.parse(s.fronts) };
}

export function projectCampDeckSource(state: State, cap: CampDepartureCapability): CampDeckSource {
  const sc = state.scenario!,
    c = sc.conclusion!,
    campaign = c.campaign!,
    prep = campaign.preparation!,
    roster = state.preparation!.heroes;
  const fingerprint = digest(archiveDomain(state));
  const skills = new Set(
    cap.deckCatalog.cards
      .filter((c) => ['basic', 'hero', 'role', 'purchased'].includes(c.kind))
      .flatMap((c) => c.copies),
  );
  const inventory: CampDeckSource['campaign']['inventory'] = [];
  for (const h of campaign.heroes) {
    for (const copy of h.skillCopies ?? [])
      if (cap.deckCatalog.cards.some((c) => c.kind === 'purchased' && c.copies.includes(copy)))
        inventory.push({ copy, kind: 'purchased', ownerId: h.heroId });
    for (const copy of h.titleCopies) inventory.push({ copy, kind: 'title', ownerId: h.heroId });
    for (const copy of h.itemCopies) inventory.push({ copy, kind: 'item', ownerId: h.heroId });
  }
  for (const i of campaign.inventory ?? [])
    inventory.push({ copy: i.copy, kind: 'accessory', ownerId: null });
  const weak = new Set(
    cap.deckCatalog.cards.filter((c) => c.kind === 'weakness').flatMap((c) => c.copies),
  );
  const oldWeaknesses: CampDeckSource['oldWeaknesses'] = [];
  const add = (
    cards: string[],
    zone: CampDeckSource['oldWeaknesses'][number]['zone'],
    heroId: string | null,
    playerId: string | null,
  ) => {
    for (const copy of cards)
      if (weak.has(copy))
        oldWeaknesses.push({ copy, heroId, playerId, zone, episodeFingerprint: fingerprint });
  };
  add(state.preparation!.weaknessDeck, 'reserve', null, null);
  for (const h of roster) {
    for (const zone of ['deck', 'discard', 'prepared'] as const)
      add(h[zone], zone, h.heroId, h.playerId);
    add(
      state
        .physical!.snapshot.resolution!.revealed.filter((r) => r.heroId === h.heroId)
        .flatMap((r) => r.cards),
      'revealed',
      h.heroId,
      h.playerId,
    );
  }
  return {
    format: 'camp-decks-source-v1',
    revision: state.revision,
    catalog: structuredClone(cap.deckCatalog),
    capability: {
      version: 'source-camp-preparation-v1',
      catalogFingerprint: cap.catalogHash,
      evidenceHash: sc.pack.manifest.campPreparation!.evidenceHash,
      cards: structuredClone(sc.pack.manifest.campPreparation!.cards),
    },
    originalRoster: roster.map((h) => ({
      heroId: h.heroId,
      playerId: h.playerId,
      initialRoleId: h.roleId!,
    })),
    episode: { id: sc.id, fingerprint, outcome: c.outcome === 'victory' ? 'win' : 'loss' },
    drawOrder: roster.map((h) => h.heroId),
    campaign: {
      heroes: campaign.heroes.map((h) => ({
        heroId: h.heroId,
        roleId: h.roleId,
        skillCopies: (h.skillCopies ?? []).filter((copy) => skills.has(copy)),
        titleCopies: [...h.titleCopies],
        itemCopies: [...h.itemCopies],
        balances: campaign
          .training!.balances.filter((b) => b.heroId === h.heroId)
          .map(({ roleId, availableXP }) => ({ roleId, availableXP })),
        provenance: {
          inspiration: roster.find((r) => r.heroId === h.heroId)!.inspiration,
          previousRole: roster.find((r) => r.heroId === h.heroId)!.roleId,
        },
      })),
      inventory,
      provenance: { inventoryHash: digest(campaign), episodeHash: c.episodeHash },
    },
    oldWeaknesses,
    choices: structuredClone(prep.heroes),
  };
}
function preflight(state: State, raw: unknown) {
  const c = state.scenario?.conclusion;
  invariant(
    c?.stage === 'camp-preparation' && c.campaign?.preparation && c.campaign.training,
    'Confermate le scelte dalla preparazione del campo.',
  );
  invariant(
    !state.episodes && state.physical?.cycle?.version === 2,
    'Partenza fuori dal primo campo verificato.',
  );
  const source = validateCampDepartureSource(raw),
    { s, fronts } = source,
    sc = state.scenario!;
  invariant(
    digest(raw) === digest(sc.pack.manifest.campDeparture),
    'Fonte partenza diversa dal freeze A1.',
  );
  invariant(
    s.catalogHash === digest(state.content) &&
      s.deckCatalog.fingerprint === s.catalogHash &&
      s.preparationHash === digest(sc.pack.manifest.campPreparation),
    'Catalogo o capacità preparazione cambiati.',
  );
  invariant(
    c.nextAdventureId === s.target.id && c.campaign.next?.source === s.target.model,
    'Destinazione diversa dalla campagna.',
  );
  invariant(
    s.quantities.status === 'invented' && s.quantities.values.every((n) => n !== null),
    'Quantità57 non verificate: partenza bloccata prima di carte, reset ed entropia.',
  );
  invariant(
    c.campaign.preparation.heroes.every(
      (h) => h.confirmedRevision !== null && h.summaryHash === digest(h.recipe) && !h.recipe.gate,
    ),
    'Ogni proprietario deve confermare il riepilogo corrente.',
  );
  if (c.outcome === 'failure')
    invariant(
      new Set(state.preparation!.heroes.map((h) => h.playerId)).size ===
        state.preparation!.heroes.length,
      'Il messaggio EN dopo sconfitta richiede un proprietario per eroe; contesto multihero non attestato.',
    );
  validateFrontArtifact(state.physical!.raw, fronts, state.content!, s.campaignSkills);
  invariant(fronts.fingerprint === s.frontsFingerprint, 'Fronti partenza non corrispondenti.');
  const purchases = sc.pack.manifest
      .campSkills!.roles.flatMap((r) => r.upgrades)
      .map((o) => o.card),
    titles = physicalTitleSkills(state.physical);
  for (const card of s.campaignSkills)
    invariant(
      [...purchases, ...titles].some((c) => digest(c) === digest(card)) ||
        !c.campaign.heroes.some(
          (h) =>
            h.titleCopies.some((copy) => definitionId(copy) === card.id) ||
            h.skillCopies?.some((copy) => definitionId(copy) === card.id),
        ),
      'Carta posseduta senza fonte campagna.',
    );
  const cards = state.content!.skills;
  for (const row of s.deckCatalog.cards) {
    const definition =
      cards.find((c) => c.id === row.id) ??
      purchases.find((c) => c.id === row.id) ??
      titles.find((c) => c.id === row.id);
    if (definition)
      invariant(
        digest(definition) === row.definitionHash,
        'Identità/hash della composizione diversa dalla fonte.',
      );
  }
  const deckSource = projectCampDeckSource(state, s);
  const capability = campDeckCapability(deckSource);
  invariant(
    capability.enabled,
    'La composizione dei mazzi richiede identità o conferme verificate.',
  );
  const selected = [
    ...new Set(
      deckSource.choices
        .flatMap((h) => [
          ...h.recipe.cards.map((c) => c.cardId),
          ...h.recipe.itemCopies.map(definitionId),
          ...(h.accessory ? [definitionId(h.accessory)] : []),
        ])
        .concat(s.deckCatalog.cards.filter((c) => c.kind === 'weakness').map((c) => c.id)),
    ),
  ];
  for (const choice of deckSource.choices.filter((h) => h.accessory)) {
    const policy = fronts.policies.find((p) => p.id === definitionId(choice.accessory!));
    invariant(
      policy?.kind === 'item' &&
        policy.effects.filter((e) => e.op === 'fear-facedown-only').length === 1,
      'Custodia/consumo dell’accessorio non attestati prima della partenza: ' +
        choice.accessory +
        '.',
    );
  }
  for (const cardId of selected) {
    const d =
        state.content!.skills.find((c) => c.id === cardId) ??
        state.content!.items.find((c) => c.id === cardId) ??
        s.campaignSkills.find((c) => c.id === cardId),
      w = s.windows.find((w) => w.cardId === cardId),
      p = fronts.policies.find((p) => p.id === cardId);
    invariant(
      d &&
        w &&
        w.definitionHash === digest(d) &&
        w.prepare !== 'requires-content' &&
        w.setup !== 'requires-content',
      'Finestra di preparazione/allestimento non attestata: ' + cardId + '.',
    );
    invariant(
      w.policyHash === null
        ? w.prepare === 'none' && w.setup === 'none' && !p
        : !!p && w.policyHash === digest(p),
      'Policy della carta diversa dalla finestra attestata: ' + cardId + '.',
    );
    invariant(
      !p ||
        (p.kind === ('rank' in d ? 'item' : 'skill') &&
          (!p.effects.some((e) => e.op.startsWith('after-setup-')) || p.kind === 'item') &&
          (!p.effects.some((e) => e.op.startsWith('after-prepare-')) || p.kind === 'skill')),
      'Consumer della finestra non disponibile per questa carta: ' + cardId + '.',
    );
    invariant(
      w.prepare ===
        (p?.effects.some((e) => e.op.startsWith('after-prepare-')) ? 'supported' : 'none') &&
        w.setup ===
          (p?.effects.some((e) => e.op.startsWith('after-setup-')) ? 'supported' : 'none'),
      'Finestre della policy diverse dalla capacità attestata: ' + cardId + '.',
    );
  }
  return { ...source, deckSource };
}
export function campDepartureOffer(
  state: State,
  source: unknown = state.scenario?.pack.manifest.campDeparture,
): CampDepartureOffer {
  const base = {
    available: false,
    reason: 'La partenza richiede le proprie fonti verificate prima dell’avvio.',
    fingerprint: null,
    drawOrder: state.preparation?.heroes.map((h) => h.heroId) ?? [],
    target: null,
  };
  if (!source) return base;
  try {
    const p = preflight(state, source);
    return {
      ...base,
      available: true,
      reason: 'Tutti pronti. Concordate l’ordine indicato e partite insieme.',
      target: p.s.target.name,
      fingerprint: digest({
        revision: state.revision,
        source: digest(p.s),
        deckSource: p.deckSource,
      }),
    };
  } catch (e) {
    return { ...base, reason: e instanceof Error ? e.message : base.reason };
  }
}
export function beginCampDeparture(
  state: State,
  actor: { playerId: string; requestId: string; pendingId: string; sourceFingerprint: string },
  input: CampDepartureInput,
  source: unknown,
  entropy: () => string,
) {
  input = CampDepartureInputSchema.parse(input);
  if (!state.preparation?.heroes.some((h) => h.playerId === actor.playerId))
    throw new ApiError(
      403,
      'NOT_HERO_OWNER',
      'La partenza richiede un proprietario della compagnia.',
    );
  const pending = state.scenario?.pending;
  if (!pending || pending.id !== actor.pendingId || pending.fingerprint !== actor.sourceFingerprint)
    throw new ApiError(409, 'STALE_SCENARIO_REQUEST', 'La richiesta del campo è cambiata.');
  const offer = campDepartureOffer(state, source);
  if (!offer.available || input.offerFingerprint !== offer.fingerprint)
    throw new ApiError(409, 'CAMP_DEPARTURE_GATED', offer.reason);
  const p = preflight(state, source);
  const seed = entropy();
  invariant(/^[a-f0-9]{64}$/.test(seed), 'Entropia partenza non valida.');
  const material = materializeCampDecks(p.deckSource, { seed });
  invariant(material.format === 'camp-decks-artifact-v1', 'Composizione partenza gated.');
  const decks = verifyCampDeckArtifact(material, { sourceFingerprint: digest(p.deckSource) });
  return activateEpisode(state, actor, input, p, seed, decks);
}
