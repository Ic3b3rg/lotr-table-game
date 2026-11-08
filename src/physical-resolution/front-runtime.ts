import { validatePhysicalProgram } from './program';
import { TerrainAccounting, type FateIcon } from './terrain-accounting';
import { preparationProblem } from '../shared/preparation';
import { createHash } from 'node:crypto';
import { requirePhysicalFamily, type PhysicalCard } from '../physical-content/catalog';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';
import { definitionId } from '../shared/preparation';
import type { PhysicalCounts, PhysicalInput, PhysicalActive } from '../shared/physical';
import type { PhysicalState, PhysicalSnapshot, PhysicalEvidence } from './model';
import { PhysicalRandom } from './random';
import {
  validateFrontArtifact,
  type FrontOp,
  type PersistentOp,
  type PolicyEffect,
} from './front-program';
import { FrontResourcesSchema, type FrontResources } from './front-state';
import { canResolveAlternative } from './front-feasibility';
import { LastStandRuntime, type LastStandReaction } from './last-stand-runtime';
import { validateLastStandArtifact } from './last-stand-program';
import { STAT_LABELS } from '../shared/skill-tests';
import { validateBoonArtifact } from './boon-program';
import { boonAvailability, boonAcquisitionProblems, validateBoonCustody } from './boon-stock';
import { boonProgramProblems } from './boon-continuation';
import { validateScenarioTitle } from './scenario-title';
import { validateItemGrant } from './item-inventory';
import type { ScenarioTitleGrant } from '../shared/scenario-title';
import { AttackModifierSchema } from '../shared/combat';
import type { BoonKind } from '../shared/boons';
import { BoonKindSchema } from '../shared/combat';
import {
  beforeInteractionEffects,
  beforeOrderFeasible,
  afterKnownEffect,
} from './interaction-look';
import type {
  AttackTestChild,
  CompanyClause,
  AttackOutcome,
  CombatAddition,
  CombatPhysicalContext,
} from '../shared/combat';

type Family = 'damage' | 'fear';
type Decision = Extract<PhysicalActive, { kind: 'decision' }>;
type Offer = {
  id: string;
  actor: number;
  copy: string;
  e: PolicyEffect;
  n: number;
  families: Family[];
  cost: string;
};
type Run = PhysicalState['runs'][number];
type Hero = FrontResources['preparation']['heroes'][number];
const empty = (): PhysicalCounts => ({ damage: 0, fear: 0 });
const total = (c: PhysicalCounts) => c.damage + c.fear;
const paused = Symbol('physical-front-paused');
export const frontToken = (entropy: string, copy: string) =>
  createHash('sha256').update(`physical-public-front:${entropy}:${copy}`).digest('hex');

/** Reconstruct all descendants from source, frozen resources and accepted decisions. */
export function replayFronts(p: Omit<PhysicalState, 'snapshot'>): PhysicalSnapshot {
  return new FrontReplay(p).replay();
}
class FrontReplay {
  private readonly lastStand;
  private readonly rng;
  private readonly cards = new Map<string, PhysicalCard>();
  private readonly faceup = new Set<string>();
  private readonly scenarioTitles = new Map<string, ScenarioTitleGrant>();
  private readonly s: PhysicalSnapshot;
  private readonly seenRequests = new Set<string>();
  private readonly seenPending = new Set<string>();
  private previousRevision = -1;
  private run!: Run;
  private child = 0;
  private answer = 0;
  private directOutcome: AttackOutcome | null = null;
  private result!: PhysicalSnapshot['parents'][number]['results'][number];
  constructor(private readonly p: Omit<PhysicalState, 'snapshot'>) {
    invariant(p.version !== 1 && p.fronts, 'Runtime fronti senza freeze versione2.');
    validateFrontArtifact(p.raw, p.fronts.artifact, p.fronts.catalog, p.fronts.campaignSkills);
    if (p.boons) validateBoonArtifact(p.raw, p.boons);
    invariant(!p.fronts.campaignSkills || p.episode, 'Carte campagna fuori dall’origine episodio.');
    this.rng = new PhysicalRandom(p.entropy, p.episode ? 201 : 56);
    this.s = {
      decks: { damage: [], fear: [] },
      areas: p.heroes.map((h) => ({ heroId: h.heroId, damage: [], fear: [] })),
      credits: [],
      rngCursor: 0,
      random: [],
      parents: [],
      active: null,
      resolution: {
        ...(p.boons ? { boonEvents: [] } : {}),
        resources: null,
        faceup: [],
        frames: [],
        revealed: [],
        history: [],
        operations: 0,
      },
    };
    const families = {
      damage: requirePhysicalFamily(p.raw, 'damage'),
      fear: requirePhysicalFamily(p.raw, 'fear'),
    };
    invariant(digest(families) === p.contentFingerprint, 'Famiglie fisiche cambiate.');
    for (const family of ['damage', 'fear'] as const) {
      for (const card of families[family].cards)
        for (const copy of card.copies) this.cards.set(copy.id, card as PhysicalCard);
      const population = families[family].cards.flatMap((c) => c.copies.map((c) => c.id));
      this.s.decks[family] = this.random(`initialize:${family}`, population, population.length);
    }
    invariant(
      !!p.lastStand === !!p.lastStandActivation,
      'Attivazione Ultimo Sforzo senza freeze o viceversa.',
    );
    if (p.lastStand) validateLastStandArtifact(p.raw, p.lastStand);
    this.lastStand = new LastStandRuntime(p, this.s, {
      choose: (...args) => this.choose(...args),
      ask: (hero, path, title, options) =>
        this.ask(hero, path, {
          mode: 'choose',
          title,
          options,
          minimum: 1,
          maximum: 1,
          remaining: empty(),
        }),
      test: (hero, stat, path) => this.test(hero, stat, path, false, true),
      limits: (hero) => this.limits(hero),
      upCount: (hero, family) =>
        this.s.areas[hero]![family].filter((c) => this.faceup.has(c)).length,
      returnCovered: (hero, family) => {
        const copies = this.s.areas[hero]![family].filter((c) => !this.faceup.has(c));
        copies.forEach((copy) => this.discard(copy, hero));
        return copies.length;
      },
      reward: (hero) => {
        const previous = this.hero(hero).inspiration;
        this.inspiration(hero);
        return this.hero(hero).inspiration - previous;
      },
      award: (hero, id, source, path) => this.awardTitle(hero, id, source, path),
    });
  }
  private get r() {
    return this.s.resolution!;
  }
  private get resources() {
    invariant(this.r.resources, 'Risorse fronti non inizializzate.');
    return this.r.resources;
  }
  private hero(n: number) {
    return this.resources.preparation.heroes[n]!;
  }
  private boonName(kind: BoonKind) {
    const id = this.p.boons!.definitions.find((d) => d.kind === kind)!.cardId;
    return (this.p.raw as { cards: { id: string; name: { value: string } }[] }).cards.find(
      (c) => c.id === id,
    )!.name.value;
  }
  private boonEffects(hero: number) {
    return (this.resources.boonCustody ?? [])
      .filter((b) => b.heroId === this.hero(hero).heroId)
      .flatMap((b) =>
        this.p
          .boons!.definitions.find((d) => d.kind === b.kind)!
          .effects.map((effect) => ({ ...b, effect })),
      );
  }
  private nearbyEnemy(hero: number) {
    const spatial = this.run.spatial;
    invariant(spatial?.enemies, 'Fine turno senza posizioni nemiche congelate.');
    const from = spatial.heroes[hero]!.spaceId;
    return spatial.enemies.some(
      (e) =>
        e.spaceId === from ||
        spatial.connections.some(
          ([a, b]) => (a === from && b === e.spaceId) || (b === from && a === e.spaceId),
        ),
    );
  }
  private returnBoon(hero: number, copyId: string, path: string, reason: string) {
    const held = this.resources.boonCustody!;
    const b = held.find((b) => b.copyId === copyId && b.heroId === this.hero(hero).heroId);
    invariant(b, 'Scarto senza custodia del beneficio.');
    this.r.boonEvents!.push({
      operation: 'discard',
      copyId,
      heroId: b.heroId,
      kind: b.kind,
      source: path,
      reason,
    });
    this.resources.boonCustody = held.filter((h) => h.copyId !== copyId);
    this.resources.boons = this.resources.boons.filter(
      (h) => h.heroId !== b.heroId || h.kind !== b.kind,
    );
  }
  private gainBoon(hero: number, kind: BoonKind | null, path: string) {
    const a = this.p.boons;
    if (!a?.runtimeReady) this.gate(hero, 'boon-quantity-unconfirmed');
    const held = this.resources.boonCustody!;
    const kinds = kind ? [kind] : BoonKindSchema.options;
    for (const k of kinds)
      if (
        !held.some((b) => b.heroId === this.hero(hero).heroId && b.kind === k) &&
        boonAvailability(a, held, k).status === 'verified-empty'
      )
        this.gate(hero, 'boon-supply-empty', empty(), null, 'boon-supply-exhaustion-rule');
    const selected = this.choose(
      hero,
      `${path}/kind`,
      'La fonte concede un beneficio: scegli quale acquisire dalla riserva.',
      kinds.map((k) => ({
        id: k,
        label: `${this.boonName(k)}${held.some((b) => b.heroId === this.hero(hero).heroId && b.kind === k) ? ' · già posseduto, nessuna seconda copia' : ''}`,
      })),
    ) as BoonKind;
    const previous = held.find((b) => b.heroId === this.hero(hero).heroId && b.kind === selected);
    if (previous) {
      this.r.boonEvents!.push({
        operation: 'duplicate',
        copyId: previous.copyId,
        heroId: previous.heroId,
        kind: selected,
        source: path,
        reason: 'already-held',
      });
      return;
    }
    const copyId = boonAvailability(a, held, selected).copies[0];
    invariant(copyId, 'Riserva senza copia risolta.');
    held.push({
      copyId,
      heroId: this.hero(hero).heroId,
      kind: selected,
      face: 'faceup',
      source: path,
    });
    this.resources.boons.push({ heroId: this.hero(hero).heroId, kind: selected });
    this.r.boonEvents!.push({
      operation: 'gain',
      copyId,
      heroId: this.hero(hero).heroId,
      kind: selected,
      source: path,
      reason: 'source-grant',
    });
  }
  private titleRestProblems(hero: number, copy: string, kind: BoonKind, returns: string[]) {
    const missing = boonAcquisitionProblems(
      this.p.boons,
      this.resources.boonCustody ?? [],
      [kind],
      [this.hero(hero).heroId],
    );
    if (missing.length || this.run.program.profile !== 'source-fronts-v1') return missing;
    const context = structuredClone(this.resources),
      held = context.boonCustody!,
      heroId = this.hero(hero).heroId;
    if (!held.some((b) => b.heroId === heroId && b.kind === kind)) {
      const copyId = boonAvailability(this.p.boons, held, kind).copies[0];
      invariant(copyId, 'Preflight del titolo senza copia disponibile.');
      held.push({ copyId, heroId, kind, face: 'faceup', source: 'title-rest-preflight' });
    }
    context.boonCustody = held.filter((b) => !returns.includes(b.copyId));
    context.boons = context.boonCustody.map(({ heroId, kind }) => ({ heroId, kind }));
    const h = context.preparation.heroes[hero]!;
    h.prepared = h.prepared.filter((c) => c !== copy);
    h.discard = h.discard.filter((c) => c !== copy);
    return boonProgramProblems(
      { ...this.p, snapshot: this.s },
      { ...this.run.program, children: this.run.program.children.slice(this.child + 1) },
      context,
      this.run.spatial,
    );
  }
  private get artifact() {
    return this.p.fronts!.artifact;
  }
  private get catalog() {
    return this.p.fronts!.catalog;
  }
  private get skills() {
    return [...this.catalog.skills, ...(this.p.fronts!.campaignSkills ?? [])];
  }
  private random(id: string, population: string[], n: number) {
    const indices = this.rng.permutation(population.length).slice(0, n);
    this.s.random.push({ id, population: [...population], indices });
    return indices.map((i) => population[i]!);
  }
  private deckRandom(id: string, population: string[], n: number) {
    const order = this.random(id, population, n);
    return this.p.episode ? order.reverse() : order;
  }
  private tick() {
    invariant(++this.r.operations <= 100000, 'Budget esecuzione fronti superato.');
  }
  private frame<T>(
    path: string,
    hero: number,
    copy: string | null,
    step: string,
    remaining: number,
    f: () => T,
  ): T {
    this.tick();
    invariant(
      this.r.frames.length < 128 && path.length <= 3000,
      'Profondità continuazione superata.',
    );
    this.r.frames.push({ path, heroId: this.p.heroes[hero]!.heroId, copy, step, remaining });
    const value = f();
    this.r.frames.pop();
    return value;
  }
  private base(hero: number) {
    const h = this.p.heroes[hero]!;
    return {
      runId: this.run.id,
      child: this.child,
      heroId: h.heroId,
      actorHeroId: h.heroId,
      actorPlayerId: h.playerId,
    };
  }
  private ask(
    hero: number,
    path: string,
    q: Omit<
      Decision,
      'kind' | 'runId' | 'child' | 'heroId' | 'actorHeroId' | 'actorPlayerId' | 'cursor'
    >,
    recipient = hero,
  ): PhysicalInput {
    this.tick();
    const active: Decision = {
      ...this.base(hero),
      heroId: this.p.heroes[recipient]!.heroId,
      kind: 'decision',
      cursor: digest({ run: this.run.id, path, q }),
      ...q,
    };
    return this.read(active);
  }
  private read(active: PhysicalActive): PhysicalInput {
    const answer = this.run.answers[this.answer];
    if (!answer) {
      this.s.active = active;
      throw paused;
    }
    const e = answer.evidence;
    invariant(
      answer.cursor === (active.kind === 'decision' ? active.cursor : undefined) &&
        answer.child === this.child &&
        answer.grant === null &&
        e.playerId === active.actorPlayerId &&
        e.revision > this.previousRevision &&
        !this.seenRequests.has(`${e.playerId}:${e.requestId}`) &&
        !this.seenPending.has(e.pendingId),
      'Risposta fronti fuori da actor/cursore.',
    );
    this.previousRevision = e.revision;
    this.seenRequests.add(`${e.playerId}:${e.requestId}`);
    this.seenPending.add(e.pendingId);
    this.r.history.push({ runId: this.run.id, answer: this.answer++, active });
    return answer.input;
  }
  private choose(
    hero: number,
    path: string,
    title: string,
    options: { id: string; label: string; unavailable?: string }[],
    recipient = hero,
    purpose?: Decision['purpose'],
  ) {
    invariant(options.length > 0, 'Scelta senza alternative lecite.');
    if (options.length === 1 && !options[0]!.unavailable) return options[0]!.id;
    const input = this.ask(
      hero,
      path,
      {
        ...(purpose ? { purpose } : {}),
        mode: 'choose',
        title,
        options,
        minimum: 1,
        maximum: 1,
        remaining: empty(),
      },
      recipient,
    );
    invariant(
      input.kind === 'physical-choice' &&
        options.some((o) => o.id === input.option && !o.unavailable),
      'Alternativa non disponibile.',
    );
    return input.option;
  }
  private select(
    hero: number,
    path: string,
    title: string,
    options: { id: string; label: string }[],
    minimum: number,
    maximum = minimum,
  ) {
    if (!maximum) return [];
    if (minimum === options.length && maximum === minimum) return options.map((o) => o.id);
    const input = this.ask(hero, path, {
      mode: 'select',
      title,
      options,
      minimum,
      maximum,
      remaining: empty(),
    });
    invariant(
      input.kind === 'physical-select' &&
        input.ids.length >= minimum &&
        input.ids.length <= maximum &&
        new Set(input.ids).size === input.ids.length &&
        input.ids.every((id) => options.some((o) => o.id === id)),
      'Selezione non legale.',
    );
    return input.ids;
  }
  private gate(
    hero: number,
    reason: Extract<PhysicalActive, { kind: 'gate' }>['reason'],
    remaining = empty(),
    family: Family | null = null,
    capability: string | null = null,
  ): never {
    this.s.active = {
      ...this.base(hero),
      kind: 'gate',
      reason,
      remaining: { ...remaining },
      family,
      capability,
    };
    this.s.parents.at(-1)!.status = 'suspended';
    throw paused;
  }
  private policy(
    hero: number,
    resources = this.resources,
  ): { copy: string; effect: PolicyEffect; effectIndex: number }[] {
    if (!this.lastStand.active(hero)) return [];
    const h = resources.preparation.heroes[hero]!,
      sources = [
        h.heroId,
        ...h.prepared,
        ...h.itemCopies,
        ...(resources.itemCustody ?? []).filter((c) => c.heroId === h.heroId).map((c) => c.copy),
      ];
    const policies = sources.flatMap((copy) => {
      if (resources.depletion.some((d) => d.copy === copy && d.remaining === 0)) return [];
      const id = copy === h.heroId ? copy : definitionId(copy);
      return (this.artifact.policies.find((p) => p.id === id)?.effects ?? []).map(
        (effect, effectIndex) => ({
          copy,
          effect,
          effectIndex,
        }),
      );
    });
    if (this.combat)
      for (const copy of h.prepared) {
        for (const clause of this.combat.clauses.filter((c) => c.cardId === definitionId(copy))) {
          const e = clause.effect;
          const effect: PolicyEffect | null =
            e.op === 'guard'
              ? { op: 'guard', n: e.n }
              : e.op === 'convert-all'
                ? { op: 'convert-all', noPrintedSuccess: e.noPrintedSuccess, scout: 0 }
                : e.op === 'convert-one-then-scout'
                  ? { op: 'convert-one-scout', scout: 1 }
                  : null;
          if (
            effect &&
            !policies.some((p) => p.copy === copy && digest(p.effect) === digest(effect))
          )
            policies.push({ copy, effect, effectIndex: 100 + clause.clause });
        }
      }
    return policies;
  }
  private get combat(): CombatPhysicalContext | null {
    return this.run.program.profile === 'source-fronts-v1'
      ? (this.run.program.combat ?? null)
      : null;
  }
  private company(hero: number, window: CompanyClause['window']) {
    if (!this.combat || !this.lastStand.active(hero)) return [];
    return this.hero(hero).prepared.flatMap((copy) =>
      this.combat!.clauses.filter(
        (c) => c.cardId === definitionId(copy) && c.window === window,
      ).map((clause) => ({ copy, clause, id: `company:${clause.clause}:${copy}` })),
    );
  }
  private payPrepared(hero: number, copy: string) {
    const h = this.hero(hero),
      index = h.prepared.indexOf(copy);
    invariant(index >= 0, 'La copia da pagare non è preparata.');
    h.prepared.splice(index, 1);
    h.discard.push(copy);
  }
  private beforeTest(
    hero: number,
    stat: keyof typeof STAT_LABELS,
    path: string,
    preselected?: string | null,
  ) {
    const offers = this.company(hero, 'before-test').filter(
      (c) => c.clause.effect.op === 'replace-stat',
    );
    let selected = preselected;
    if (preselected === undefined && offers.length)
      selected = this.choose(
        hero,
        `${path}/before-test`,
        'Prima della prova puoi sostituire la caratteristica pagando la carta indicata.',
        [
          { id: 'keep', label: `Usa ${STAT_LABELS[stat]}` },
          ...offers.map((o) => ({
            id: o.copy,
            label: `Scarta ${this.skillName(o.copy)}: usa ${STAT_LABELS[o.clause.effect.op === 'replace-stat' ? o.clause.effect.stat : stat]}`,
          })),
        ],
      );
    if (!selected || selected === 'keep') return stat;
    const offer = offers.find((o) => o.copy === selected);
    invariant(offer?.clause.effect.op === 'replace-stat', 'Sostituzione prova non disponibile.');
    this.payPrepared(hero, offer.copy);
    for (let n = 0; n < offer.clause.effect.inspiration; n++) this.inspiration(hero);
    return offer.clause.effect.stat;
  }
  private afterStrike(hero: number, path: string) {
    const hook = this.combat?.heroes.find(
      (h) => h.heroId === this.hero(hero).heroId && h.effect === 'after-strike-scout-once',
    );
    if (!hook) return;
    const key = `${hook.heroId}:after-strike-scout-once`;
    if (
      this.resources.combatUses?.some(
        (u) => u.roundId === this.combat!.roundId && u.heroId === hook.heroId && u.effectId === key,
      )
    )
      return;
    if (
      this.choose(
        hero,
        `${path}/hero-reaction`,
        'Dopo Assalto puoi usare la tua capacità una volta per round.',
        [
          { id: 'keep', label: 'Conserva la capacità per questo round' },
          { id: 'scout', label: 'Usa la capacità: Scoperta 1' },
        ],
      ) === 'scout'
    ) {
      (this.resources.combatUses ??= []).push({
        roundId: this.combat!.roundId,
        heroId: hook.heroId,
        effectId: key,
      });
      this.scout(hero, 1, `${path}/hero-scout`);
    }
  }
  private afterTest(hero: number, path: string) {
    const unavailable = this.company(hero, 'after-test').filter(
      (o) => o.clause.effect.op === 'requires-capability',
    );
    if (!unavailable.length) return;
    const options = [
      { id: 'close', label: 'Prosegui dopo la prova' },
      ...unavailable.map((o) => ({
        id: o.id,
        label: `${this.skillName(o.copy)} · beneficio non disponibile`,
        unavailable: this.p.boons?.runtimeReady
          ? 'Il seguito completo di questa capacità non è incluso nel salvataggio. Nessuna carta viene scartata.'
          : 'La riserva dei benefici non è ancora verificata. Nessuna carta viene scartata.',
      })),
    ];
    const input = this.ask(hero, `${path}/after-test`, {
      mode: 'choose',
      title: 'Dopo la prova: le carte rivelate sono state scartate.',
      options,
      minimum: 1,
      maximum: 1,
      remaining: empty(),
    });
    invariant(
      input.kind === 'physical-choice' && input.option === 'close',
      'Capacità opzionale non disponibile prima del costo.',
    );
  }
  private persist(hero: number): { copy: string; effect: PersistentOp }[] {
    if (!this.lastStand.active(hero)) return [];
    const a = this.s.areas[hero]!;
    return [...a.damage, ...a.fear]
      .filter((c) => this.faceup.has(c))
      .flatMap((copy) =>
        this.artifact.definitions
          .find((d) => d.cardId === this.cards.get(copy)!.id)!
          .persistent.map((effect) => ({ copy, effect })),
      );
  }
  private cannotPreventDamage(hero: number) {
    return this.persist(hero).some(({ effect }) => effect.op === 'prohibit');
  }
  private limits(hero: number) {
    const d = this.catalog.heroes.find((d) => d.id === this.hero(hero).heroId)!;
    const limits = { damage: d.stats.damage, fear: d.stats.fear };
    for (const { effect: e } of this.policy(hero))
      if (e.op === 'limits') {
        limits.damage += e.damage;
        limits.fear += e.fear;
      }
    return limits;
  }
  private nearby(a: number, b: number) {
    if (!this.lastStand.active(a) || !this.lastStand.active(b)) return false;
    const heroes = this.run.spatial?.heroes ?? this.p.heroes;
    const from = heroes[a]!.spaceId,
      to = heroes[b]!.spaceId;
    return (
      a !== b &&
      (from === to ||
        !!this.run.spatial?.connections.some(
          ([x, y]) => (x === from && y === to) || (y === from && x === to),
        ))
    );
  }
  private scope(hero: number, scope: string) {
    return this.p.heroes.flatMap((_, n) =>
      this.lastStand.active(n) &&
      (scope === 'self'
        ? n === hero
        : scope === 'each-other-hero-any-distance'
          ? n !== hero
          : scope === 'self-and-each-nearby'
            ? n === hero || this.nearby(hero, n)
            : this.nearby(hero, n))
        ? [n]
        : [],
    );
  }
  private ordered(
    hero: number,
    path: string,
    targets: number[],
    f: (n: number, path: string) => void,
    activeOnly = this.liveGroups,
  ) {
    let left = targets.filter((n) => !activeOnly || this.lastStand.active(n));
    while (left.length) {
      const actor = activeOnly && !this.lastStand.active(hero) ? left[0]! : hero;
      const selected = Number(
        this.choose(
          actor,
          `${path}/order-${left.length}`,
          'Scegli l’eroe da risolvere per primo.',
          left.map((n) => ({
            id: String(n),
            label: this.catalog.heroes.find((h) => h.id === this.hero(n).heroId)!.name.text,
          })),
          actor,
          this.liveGroups ? 'group-order' : undefined,
        ),
      );
      left.splice(left.indexOf(selected), 1);
      f(selected, `${path}/hero-${selected}`);
      if (activeOnly) left = left.filter((n) => this.lastStand.active(n));
    }
  }
  private get liveGroups() {
    return (
      this.run.program.profile === 'source-fronts-v1' &&
      this.run.program.groupRules === 'source-live-groups-v1'
    );
  }
  /** One complete recipient source, including fronts, precedes the next group choice. */
  private settleCollective(reactions: LastStandReaction[] = []) {
    if (!this.liveGroups) return;
    invariant(this.run.lastStandRules, 'Gruppi attivi senza regole Ultimo Sforzo congelate.');
    this.lastStand.settle(this.run, reactions);
    const terminal = this.s.lastStand?.terminal;
    if (terminal)
      this.gate(
        this.p.heroes.findIndex((h) => h.heroId === terminal.heroId),
        'adventure-loss-consumer-unavailable',
      );
  }
  private darknessReactions(hero: number, suffered: number, index: number, path: string) {
    const result = this.result;
    return this.eventEffects(hero, 'after-darkness-suffering-batch', suffered).map(
      (effect, n): LastStandReaction => ({
        id: `darkness:${index}:${hero}:${n}`,
        hero,
        label: `Risolvi ${this.cards.get(effect.copy)!.name.value}`,
        available: () =>
          this.faceup.has(effect.copy) &&
          this.lastStand.active(effect.owner) &&
          this.lastStand.active(hero),
        resolve: () => {
          this.result = result;
          this.eventEffect(hero, effect, `${path}/darkness-${hero}/trigger-${n}`, false);
        },
      }),
    );
  }
  private down(copy: string) {
    this.faceup.delete(copy);
  }
  private discard(copy: string, hero: number) {
    const card = this.cards.get(copy)!;
    if (
      this.faceup.has(copy) &&
      this.persist(hero).some(
        ({ effect: e }) => e.op === 'replace-discard' && e.family === card.family,
      )
    ) {
      this.down(copy);
      return;
    }
    const family = card.family as Family,
      area = this.s.areas[hero]![family];
    invariant(area.includes(copy), 'Scarto fuori dall’area.');
    area.splice(area.indexOf(copy), 1);
    this.faceup.delete(copy);
    this.s.decks[family].push(copy);
    this.result.returned[family]++;
  }
  private front(hero: number, copy: string, path: string) {
    if (!this.s.areas[hero]![this.cards.get(copy)!.family as Family].includes(copy)) return;
    this.faceup.add(copy);
    const d = this.artifact.definitions.find((d) => d.cardId === this.cards.get(copy)!.id)!;
    this.frame(path, hero, copy, 'front', 1, () => {
      for (const [n, op] of d.body.entries()) this.operation(hero, copy, op, `${path}/${n}`);
    });
  }
  private eligibleTrinkets(hero: number, other = false, resources = this.resources) {
    return resources.preparation.heroes.flatMap((h, n) =>
      this.lastStand.active(n) && (other ? n !== hero : n === hero)
        ? [
            ...h.itemCopies,
            ...(resources.itemCustody ?? [])
              .filter((c) => c.heroId === h.heroId)
              .map((c) => c.copy),
          ]
            .filter(
              (c) =>
                this.catalog.items.find((i) => i.id === definitionId(c))?.slot === 'trinket' &&
                resources.depletion.some((d) => d.copy === c && d.remaining > 0),
            )
            .map((copy) => ({ hero: n, copy }))
        : [],
    );
  }
  private deplete(hero: number, path: string, other = false) {
    const options = this.eligibleTrinkets(hero, other);
    if (!options.length) return false;
    const selected = this.choose(
      hero,
      path,
      'Scegli il monile da consumare, senza attivarne l’effetto.',
      options.map(({ copy, hero: n }) => ({
        id: copy,
        label: `${this.catalog.heroes.find((h) => h.id === this.hero(n).heroId)!.name.text}: ${this.catalog.items.find((i) => i.id === definitionId(copy))!.name.text}`,
      })),
    );
    const owner = options.find((o) => o.copy === selected)!.hero;
    // A different phone accepts its own mandatory resource selection.
    if (owner !== hero)
      this.select(
        owner,
        `${path}/owner`,
        'Consuma il monile indicato.',
        [
          {
            id: selected,
            label: this.catalog.items.find((i) => i.id === definitionId(selected))!.name.text,
          },
        ],
        1,
      );
    this.resources.depletion.find((d) => d.copy === selected)!.remaining--;
    return true;
  }
  private feasible(hero: number, op: FrontOp): boolean {
    return canResolveAlternative(op, {
      hero,
      resources: this.resources,
      condition: (condition) => this.condition(hero, condition),
      ignoresLoss: (resources) =>
        this.policy(hero, resources).some(
          ({ effect }) => effect.op === 'ignore-card-resource-loss',
        ),
      trinkets: (resources, other) => this.eligibleTrinkets(hero, other, resources),
    });
  }
  private condition(
    hero: number,
    condition: 'self-space-in-darkness' | 'exists-nearby-hero-excluding-self',
  ) {
    return condition === 'self-space-in-darkness'
      ? this.run.program.profile === 'source-fronts-v1' &&
          this.run.program.darknessHeroes.includes(hero)
      : this.scope(hero, 'each-nearby-excluding-self').length > 0;
  }
  private operation(hero: number, copy: string, op: FrontOp, path: string): void {
    this.frame(path, hero, copy, op.op, 0, () => {
      switch (op.op) {
        case 'keep-faceup':
          return;
        case 'self-flip-down':
          this.down(copy);
          return;
        case 'discard-self':
          this.discard(copy, hero);
          return;
        case 'suffer':
          this.ordered(hero, path, this.scope(hero, op.hero), (target, p) =>
            this.suffer(
              target,
              [{ family: op.family, amount: op.n }],
              op.face === 'down' ? 'facedown' : 'faceup',
              p,
            ),
          );
          return;
        case 'flip-random':
          this.ordered(hero, path, this.scope(hero, op.hero), (target, p) =>
            this.flip(target, op.family, op.n, p),
          );
          return;
        case 'discard-inspiration':
          if (!this.policy(hero).some(({ effect: e }) => e.op === 'ignore-card-resource-loss'))
            this.hero(hero).inspiration -=
              op.n === 'all'
                ? this.hero(hero).inspiration
                : Math.min(op.n, this.hero(hero).inspiration);
          return;
        case 'discard-prepared': {
          if (this.policy(hero).some(({ effect: e }) => e.op === 'ignore-card-resource-loss'))
            return;
          const h = this.hero(hero),
            n = Math.min(op.n, h.prepared.length);
          const ids = this.select(
            hero,
            path,
            `Scarta ${n} carte preparate. Questo scarto non attiva Protezione.`,
            h.prepared.map((id) => ({ id, label: this.skillName(id) })),
            n,
          );
          h.prepared = h.prepared.filter((id) => !ids.includes(id));
          h.discard.push(...ids);
          return;
        }
        case 'discard-boons':
          if (this.p.boons)
            for (const b of [...this.resources.boonCustody!].filter(
              (b) => b.heroId === this.hero(hero).heroId,
            ))
              this.returnBoon(hero, b.copyId, path, 'source-discard');
          this.resources.boons = this.resources.boons.filter(
            (b) => b.heroId !== this.hero(hero).heroId,
          );
          return;
        case 'deplete':
          this.deplete(hero, path);
          return;
        case 'deplete-or-if-impossible':
          if (!this.deplete(hero, path, true))
            this.operation(hero, copy, op.fallback, `${path}/fallback`);
          return;
        case 'gain-weakness': {
          const weakness = this.resources.preparation.weaknessDeck.shift();
          if (!weakness) this.gate(hero, 'weakness-deck-empty');
          const h = this.hero(hero);
          h.deck = this.deckRandom(
            `${path}/weakness-shuffle`,
            [...h.deck, weakness],
            h.deck.length + 1,
          );
          return;
        }
        case 'conditional': {
          if (this.condition(hero, op.condition))
            this.operation(hero, copy, op.then, `${path}/then`);
          return;
        }
        case 'choose-alternative': {
          const options = op.branches.flatMap((b, n) =>
            this.feasible(hero, b) ? [{ id: String(n), label: this.opLabel(b) }] : [],
          );
          const selected = Number(
            this.choose(hero, path, 'Scegli una conseguenza interamente eseguibile.', options),
          );
          this.operation(hero, copy, op.branches[selected]!, `${path}/branch-${selected}`);
          return;
        }
        case 'simultaneous': {
          const left = op.parts.map((_, n) => n);
          while (left.length) {
            const n = Number(
              this.choose(
                hero,
                `${path}/order-${left.length}`,
                'Scegli l’ordine degli effetti simultanei.',
                left.map((n) => ({ id: String(n), label: this.opLabel(op.parts[n]!) })),
              ),
            );
            left.splice(left.indexOf(n), 1);
            this.operation(hero, copy, op.parts[n]!, `${path}/part-${n}`);
          }
          return;
        }
      }
    });
  }
  private opLabel(op: FrontOp): string {
    switch (op.op) {
      case 'suffer':
        return `Subisci ${op.n} ${op.family === 'damage' ? 'danni' : 'paure'} ${op.face === 'down' ? 'coperti' : 'scoperti'}`;
      case 'discard-prepared':
        return `Scarta ${op.n} carte preparate`;
      case 'deplete':
        return 'Consuma un monile';
      case 'flip-random':
        return `Gira ${op.n} ${op.family === 'damage' ? 'danni' : 'paure'} scoperti`;
      default:
        return 'Risolvi l’altro effetto della carta';
    }
  }
  private skillName(copy: string) {
    return (
      this.skills.find((s) => s.id === definitionId(copy))?.name.text ??
      this.titleCard(copy)!.name.value
    );
  }
  private titleCard(copy: string) {
    const id = definitionId(copy);
    if (!this.p.lastStand?.titles.some((t) => t.cardId === id) && !this.scenarioTitles.has(id))
      return undefined;
    return requirePhysicalFamily(this.p.raw, 'title').cards.find((c) => c.id === id);
  }
  private skillSymbols(copy: string) {
    const skill = this.skills.find((s) => s.id === definitionId(copy));
    if (skill) return skill;
    const title = this.titleCard(copy);
    invariant(title, 'Carta della prova senza definizione verificata.');
    const icons = title.printing.value.icons;
    return {
      success: icons.find((i) => i.symbol === 'success')?.count ?? 0,
      fate: icons.find((i) => i.symbol === 'fate')?.count ?? 0,
    };
  }
  private awardTitle(hero: number, cardId: string, source: string, path: string) {
    const state = this.s.lastStand!,
      h = this.hero(hero),
      copy = `${cardId}:1`;
    invariant(
      !state.titles.some((t) => t.cardId === cardId),
      'Titolo già posseduto dalla Compagnia.',
    );
    const ownership = { heroId: h.heroId, cardId, copy, source, removed: false, pending: true };
    state.titles.push(ownership);
    const prepared = [...h.prepared, copy];
    const discarded =
      prepared.length > 4
        ? this.select(
            hero,
            `${path}/prepared-limit`,
            `Titolo ottenuto: ${this.skillName(copy)}. Scegli una carta preparata da scartare per il limite quattro.`,
            prepared.map((id) => ({ id, label: this.skillName(id) })),
            1,
          )[0]!
        : null;
    h.prepared = prepared.filter((c) => c !== discarded);
    if (discarded) h.discard.push(discarded);
    ownership.pending = false;
    // These titles have no after-preparation ability. Their own windows apply later.
  }
  private titleEffects(hero: number) {
    const h = this.hero(hero);
    return (this.s.lastStand?.titles ?? []).flatMap((t) =>
      this.lastStand.active(hero) &&
      t.heroId === h.heroId &&
      !t.removed &&
      !t.pending &&
      h.prepared.includes(t.copy)
        ? (this.p
            .lastStand!.titles.find((d) => d.cardId === t.cardId)
            ?.effects.map((effect, index) => ({ copy: t.copy, effect, index })) ?? [])
        : [],
    );
  }
  private removeTitle(hero: number, copy: string) {
    const t = this.s.lastStand!.titles.find(
      (t) => t.copy === copy && t.heroId === this.hero(hero).heroId,
    )!;
    const h = this.hero(hero);
    invariant(
      t && !t.removed && !t.pending && h.prepared.includes(copy),
      'Titolo non preparato o già rimosso.',
    );
    h.prepared.splice(h.prepared.indexOf(copy), 1);
    t.removed = true;
  }
  private flip(hero: number, family: Family, n: number, path: string) {
    const selected = this.random(
      `${path}/select`,
      this.s.areas[hero]![family].filter((c) => !this.faceup.has(c)),
      n,
    );
    for (const [index, copy] of selected.entries())
      this.frame(
        `${path}/selected-${index}`,
        hero,
        copy,
        'flip-selected',
        selected.length - index,
        () => {
          if (this.s.areas[hero]![family].includes(copy) && !this.faceup.has(copy))
            this.front(hero, copy, `${path}/front-${index}`);
        },
      );
  }
  private physicalSelection(
    hero: number,
    families: Family[],
    face: 'up' | 'down' | 'any',
    path: string,
    n: number,
    upTo = false,
    turnDown = false,
  ) {
    const options = families.flatMap((family) =>
      this.s.areas[hero]![family].flatMap((copy) =>
        this.faceup.has(copy) && face !== 'down'
          ? [
              {
                id: frontToken(this.p.entropy, copy),
                label: `${this.cards.get(copy)!.name.value} · ${family === 'damage' ? 'danno' : 'paura'} scoperto`,
              },
            ]
          : [],
      ),
    );
    if (face !== 'up')
      for (const family of families) {
        const count = this.s.areas[hero]![family].filter((c) => !this.faceup.has(c)).length;
        for (let k = 0; k < count; k++)
          options.push({
            id: `down:${family}:${k}`,
            label: `${family === 'damage' ? 'Danno' : 'Paura'} coperto casuale ${k + 1}`,
          });
      }
    const maximum = Math.min(n, options.length);
    const selected = this.select(
      hero,
      path,
      turnDown
        ? 'Scegli la carta scoperta da girare coperta.'
        : 'Scegli le scoperte identificabili e le coperte casuali da scartare.',
      options,
      upTo ? 0 : maximum,
      maximum,
    );
    for (const family of families) {
      const down = selected.filter((id) => id.startsWith(`down:${family}:`)).length;
      const random = down
        ? this.random(
            `${path}/discard-${family}`,
            this.s.areas[hero]![family].filter((c) => !this.faceup.has(c)),
            down,
          )
        : [];
      const up = this.s.areas[hero]![family].filter(
        (copy) => this.faceup.has(copy) && selected.includes(frontToken(this.p.entropy, copy)),
      );
      for (const copy of [...up, ...random])
        if (turnDown) this.down(copy);
        else this.discard(copy, hero);
    }
  }
  private inspiration(hero: number) {
    const h = this.hero(hero),
      cap = this.catalog.heroes.find((x) => x.id === h.heroId)!.stats.inspiration;
    h.inspiration = Math.min(cap, h.inspiration + 1);
  }
  private afterGuard(actor: number, paidEffects: PolicyEffect[] = []) {
    this.p.heroes.forEach((_, owner) => {
      if (owner === actor || this.nearby(owner, actor))
        for (const { effect } of this.policy(owner))
          if (effect.op === 'after-guard-inspiration') this.inspiration(actor);
    });
    for (const effect of paidEffects)
      if (effect.op === 'after-guard-inspiration') this.inspiration(actor);
  }
  private afterPrepare(hero: number, copy: string, path: string) {
    const effects =
      this.artifact.policies.find((p) => p.kind === 'skill' && p.id === definitionId(copy))
        ?.effects ?? [];
    for (const [n, e] of effects.entries()) {
      if (e.op === 'after-prepare-inspiration') this.inspiration(hero);
      if (e.op === 'after-prepare-scout') {
        invariant(this.p.episode, 'Scoperta di preparazione fuori dall’origine battaglia.');
        this.scout(hero, e.count, `${path}/prepare-scout-${n}`);
      }
      if (e.op === 'after-prepare-flip-fear')
        this.physicalSelection(
          hero,
          ['fear'],
          'up',
          this.run.spatial ||
            (this.run.program.profile === 'source-fronts-v1' && this.run.program.startupRules)
            ? `${path}/effect-${n}`
            : `${path}/prepare-flip`,
          1,
          false,
          true,
        );
    }
  }
  private endTurn(hero: number, path: string) {
    // End-of-turn effects and optional Rest share a timing window. Recheck live
    // availability after every descendant; an imposed discard never activates Rest.
    const effects = this.persist(hero).filter(({ effect: e }) => e.window === 'end-own-turn');
    const left = effects.map((_, n) => n);
    const boonEnds = this.boonEffects(hero).filter(
      ({ effect }) => effect.op === 'discard-at-end-turn',
    );
    const boonLeft = boonEnds.filter(() => !this.nearbyEnemy(hero)).map((b) => b.copyId);
    let closed = false,
      step = 0;
    while (left.length || boonLeft.length || !closed) {
      const rests = closed
        ? []
        : this.policy(hero).filter(
            ({ copy, effect: e }) => e.op === 'rest' && this.hero(hero).prepared.includes(copy),
          );
      const titleRests = closed
        ? []
        : this.titleEffects(hero).filter((t) => t.effect.op === 'rest');
      const options = [
        ...boonLeft
          .filter((copy) => this.resources.boonCustody?.some((b) => b.copyId === copy))
          .map((copy) => ({
            id: `boon-end:${copy}`,
            label: `Scarta ${this.boonName(boonEnds.find((b) => b.copyId === copy)!.kind)}: nessun nemico vicino`,
          })),
        ...left
          .filter((n) => this.faceup.has(effects[n]!.copy))
          .map((n) => ({
            id: `effect:${n}`,
            label: `Risolvi ${this.cards.get(effects[n]!.copy)!.name.value}`,
          })),
        ...rests.map(({ copy, effect: e, effectIndex }) => ({
          id: `rest:${effectIndex}:${copy}`,
          label: `Riposo ${e.op === 'rest' ? e.n : 0} · scarta ${this.skillName(copy)}`,
        })),
        ...titleRests.map(({ copy, effect: e, index }) => {
          const missing =
            e.op === 'rest' ? this.titleRestProblems(hero, copy, e.after.boon, boonLeft) : [];
          return {
            id: `title-rest:${index}:${copy}`,
            label: `Riposo ${e.op === 'rest' ? e.n : 0} · ${this.skillName(copy)}${this.p.boons ? ' · poi rimuovi il titolo e acquisisci il beneficio' : ' · seguito con beneficio da verificare'}`,
            ...(this.p.boons && missing.length
              ? {
                  unavailable: missing.includes('boon-quantities-57')
                    ? 'La riserva dei benefici non è ancora verificata. Titolo e Riposo restano intatti.'
                    : 'La riserva non copre questo effetto e il suo seguito. Titolo e Riposo restano intatti.',
                }
              : {}),
          };
        }),
        ...(!closed && (rests.length || titleRests.length)
          ? [{ id: 'close-rest', label: 'Non usare altro Riposo' }]
          : []),
      ];
      if (!options.length) break;
      const selected = this.choose(
        hero,
        `${path}/window-${step++}`,
        'Fine turno: scegli quale capacità risolvere. Il turno resta aperto fino al termine.',
        options,
      );
      if (selected === 'close-rest') {
        closed = true;
        continue;
      }
      if (selected.startsWith('boon-end:')) {
        const copy = selected.slice('boon-end:'.length);
        boonLeft.splice(boonLeft.indexOf(copy), 1);
        this.returnBoon(hero, copy, `${path}/window-${step}`, 'end-turn-no-nearby-enemies');
        continue;
      }
      if (selected.startsWith('title-rest:')) {
        // Acquisition is independent; this use needs the still-unconfirmed supply.
        // Gate the whole activation before discarding its prepared cost or resting.
        if (!this.p.boons)
          this.gate(hero, 'boon-quantity-unconfirmed', empty(), null, 'P4:title-rest-boon');
        const title = titleRests.find((t) => selected === `title-rest:${t.index}:${t.copy}`)!;
        invariant(
          title.effect.op === 'rest' &&
            !this.titleRestProblems(hero, title.copy, title.effect.after.boon, boonLeft).length,
          'Seguito del Riposo non disponibile prima del costo.',
        );
        this.payPrepared(hero, title.copy);
        this.physicalSelection(
          hero,
          ['damage', 'fear'],
          'down',
          `${path}/title-rest-${step}`,
          title.effect.n,
          true,
        );
        const effects = this.eventEffects(hero, 'after-rest', 0);
        const remaining = ['title', ...effects.map((_, i) => String(i))];
        while (remaining.length) {
          const next = this.choose(
            hero,
            `${path}/after-title-rest-${step}-${remaining.length}`,
            'Dopo Riposo: scegli l’ordine degli effetti obbligatori.',
            remaining.map((id) => ({
              id,
              label:
                id === 'title'
                  ? 'Rimuovi il titolo e acquisisci il beneficio'
                  : this.cards.get(effects[Number(id)]!.copy)!.name.value,
            })),
          );
          remaining.splice(remaining.indexOf(next), 1);
          if (next === 'title') {
            const ownership = this.s.lastStand!.titles.find((t) => t.copy === title.copy)!;
            const h = this.hero(hero),
              at = h.discard.indexOf(title.copy);
            invariant(!ownership.removed && at >= 0, 'Titolo di Riposo già rimosso o senza costo.');
            h.discard.splice(at, 1);
            ownership.removed = true;
            this.gainBoon(hero, title.effect.after.boon, `${path}/title-rest-${step}/benefit`);
          } else
            this.eventEffect(
              hero,
              effects[Number(next)]!,
              `${path}/title-rest-${step}/effect-${next}`,
              false,
            );
        }
        continue;
      }
      if (selected.startsWith('effect:')) {
        const n = Number(selected.slice(7));
        left.splice(left.indexOf(n), 1);
        const { copy, effect: e } = effects[n]!;
        if (!this.faceup.has(copy)) continue;
        if (e.op === 'self-flip-down') this.down(copy);
        else if (e.op === 'suffer')
          this.suffer(hero, [{ family: e.family, amount: e.n }], 'faceup', `${path}/effect-${n}`);
      } else {
        const ability = rests.find(
          ({ copy, effectIndex }) => selected === `rest:${effectIndex}:${copy}`,
        )!;
        invariant(ability.effect.op === 'rest', 'Riposo senza policy.');
        const h = this.hero(hero);
        h.prepared.splice(h.prepared.indexOf(ability.copy), 1);
        h.discard.push(ability.copy);
        this.physicalSelection(
          hero,
          ['damage', 'fear'],
          'down',
          `${path}/rest-${step}`,
          ability.effect.n,
          true,
        );
        this.event(hero, 'after-rest', `${path}/after-rest-${step}`, false, 0);
      }
    }
  }
  private suffer(
    hero: number,
    cards: { family: Family; amount: number }[],
    face: 'facedown' | 'faceup',
    path: string,
    negate?: 'might' | 'wisdom' | 'agility' | 'spirit' | 'wit',
    direct = false,
  ) {
    return this.frame(
      path,
      hero,
      null,
      'suffer',
      cards.reduce((n, c) => n + c.amount, 0),
      () => {
        let suffered = 0;
        const remaining = empty();
        for (const c of cards) remaining[c.family] = c.amount;
        if (direct && this.p.boons)
          for (const b of this.boonEffects(hero)) {
            if (b.effect.op !== 'prevent-all-before-test') continue;
            const family = b.effect.family;
            const n = family === 'damage' && this.cannotPreventDamage(hero) ? 0 : remaining[family];
            remaining[family] -= n;
            this.result.prevented[family] += n;
            this.directOutcome!.prevented[family] += n;
            this.returnBoon(hero, b.copyId, `${path}/before-test`, 'before-attacked-test');
          }
        if (negate && (total(remaining) || (direct && this.p.boons))) {
          const allowed = [negate];
          if (
            ['wisdom', 'spirit', 'wit'].includes(negate) &&
            this.policy(hero).some(({ effect: e }) => e.op === 'negate-might')
          )
            allowed.push('might');
          const stat = this.choose(
            hero,
            `${path}/stat`,
            'Scegli la caratteristica concessa per negare.',
            [...new Set(allowed)].map((id) => ({ id, label: id })),
          ) as typeof negate;
          const successes = this.test(hero, stat, `${path}/test`, true);
          if (successes) {
            const cannotDamage = this.cannotPreventDamage(hero);
            const input = this.ask(hero, `${path}/negate`, {
              ...(this.liveGroups ? { purpose: 'negation' as const } : {}),
              mode: 'allocate',
              title: `Assegna fino a ${successes} successi, una sola volta. Puoi subire volontariamente.`,
              options: [],
              minimum: 0,
              maximum: successes,
              remaining: { damage: cannotDamage ? 0 : remaining.damage, fear: remaining.fear },
            });
            invariant(
              input.kind === 'physical-allocate' &&
                input.ability === null &&
                total(input) <= successes &&
                input.damage <= remaining.damage &&
                input.fear <= remaining.fear &&
                (!cannotDamage || !input.damage),
              'Negazione non legale.',
            );
            if (direct && this.directOutcome) {
              this.directOutcome.negated.damage += input.damage;
              this.directOutcome.negated.fear += input.fear;
            }
            remaining.damage -= input.damage;
            remaining.fear -= input.fear;
            this.result.prevented.damage += input.damage;
            this.result.prevented.fear += input.fear;
          }
        }
        const used = new Set<string>();
        let window = 0,
          faceFear = face;
        while (total(remaining)) {
          this.tick();
          const cannotDamage = this.cannotPreventDamage(hero);
          const offers = this.p.heroes
            .flatMap((_, actor) =>
              this.policy(actor).flatMap<Offer>(({ copy, effect: e, effectIndex }) => {
                const id = `${actor}:${effectIndex}:${copy}`,
                  self = actor === hero,
                  same =
                    (this.run.spatial?.heroes ?? this.p.heroes)[actor]!.spaceId ===
                    (this.run.spatial?.heroes ?? this.p.heroes)[hero]!.spaceId;
                if (used.has(id)) return [];
                if (e.op === 'guard' && same && this.hero(actor).prepared.includes(copy))
                  return [
                    {
                      id,
                      actor,
                      copy,
                      e,
                      n: e.n,
                      families: ['damage', 'fear'] as Family[],
                      cost: 'Scarta la copia preparata',
                    },
                  ];
                if (!self) return [];
                if (e.op === 'paid-prevent' && this.hero(hero).inspiration > 0)
                  return [
                    {
                      id,
                      actor,
                      copy,
                      e,
                      n: e.n,
                      families: ['damage', 'fear'] as Family[],
                      cost: 'Spendi 1 ispirazione',
                    },
                  ];
                if (e.op === 'facedown-prevent' && face === 'facedown' && !used.has(id))
                  return [
                    {
                      id,
                      actor,
                      copy,
                      e,
                      n: e.n,
                      families: (e.family === 'any' ? ['damage', 'fear'] : ['damage']) as Family[],
                      cost: 'Una volta per questo ammontare coperto',
                    },
                  ];
                if (
                  (e.op === 'fear-facedown' || (e.op === 'fear-facedown-only' && self)) &&
                  !used.has(id) &&
                  remaining.fear &&
                  this.resources.depletion.some((d) => d.copy === copy && d.remaining > 0)
                )
                  return [
                    {
                      id,
                      actor,
                      copy,
                      e,
                      n: 1,
                      families: ['fear'] as Family[],
                      cost:
                        e.op === 'fear-facedown-only'
                          ? 'Consuma 1 segnalino: subisci tutte le paure coperte'
                          : 'Consuma 1 segnalino del monile',
                    },
                  ];
                return [];
              }),
            )
            .filter((o) =>
              o.families.some(
                (f) =>
                  remaining[f] > 0 &&
                  (f !== 'damage' || (!cannotDamage && !this.cannotPreventDamage(o.actor))),
              ),
            );
          if (!offers.length) break;
          const selected = this.choose(
            hero,
            `${path}/window-${window}`,
            'Scegli una capacità disponibile oppure subisci il residuo.',
            [
              { id: 'close', label: `Subisci ${remaining.damage} danni e ${remaining.fear} paure` },
              ...offers.map((o) => ({
                id: o.id,
                label: `${this.catalog.heroes.find((h) => h.id === this.hero(o.actor).heroId)!.name.text} · ${o.copy.includes(':') ? (this.skills.find((s) => s.id === definitionId(o.copy))?.name.text ?? this.catalog.items.find((i) => i.id === definitionId(o.copy))?.name.text) : o.copy} · ${o.cost}`,
              })),
            ],
          );
          if (selected === 'close') break;
          const offer = offers.find((o) => o.id === selected)!;
          if (offer.e.op === 'fear-facedown-only') {
            this.resources.depletion.find((d) => d.copy === offer.copy)!.remaining--;
            faceFear = 'facedown';
            used.add(offer.id);
            continue;
          }
          const available = {
            damage:
              !cannotDamage &&
              !this.cannotPreventDamage(offer.actor) &&
              offer.families.includes('damage')
                ? remaining.damage
                : 0,
            fear: offer.families.includes('fear') ? remaining.fear : 0,
          };
          const input = this.ask(
            offer.actor,
            `${path}/activation-${window++}`,
            {
              mode: 'allocate',
              title: `Prevenzione per ${this.catalog.heroes.find((h) => h.id === this.hero(hero).heroId)!.name.text}: fino a ${offer.n}. ${offer.cost}.`,
              options: [{ id: offer.id, label: offer.cost }],
              minimum: 0,
              maximum: offer.n,
              remaining: available,
            },
            hero,
          );
          invariant(
            input.kind === 'physical-allocate' &&
              input.ability === offer.id &&
              total(input) <= offer.n &&
              input.damage <= available.damage &&
              input.fear <= available.fear,
            'Prevenzione non legale.',
          );
          if (!total(input)) {
            used.add(offer.id);
            break;
          }
          if (offer.e.op === 'guard') {
            const h = this.hero(offer.actor);
            const paidEffects = this.policy(offer.actor)
              .filter((p) => p.copy === offer.copy)
              .map((p) => p.effect);
            h.prepared.splice(h.prepared.indexOf(offer.copy), 1);
            h.discard.push(offer.copy);
            this.afterGuard(
              offer.actor,
              this.run.executionRules || this.run.spatial ? paidEffects : [],
            );
          } else if (offer.e.op === 'paid-prevent') this.hero(hero).inspiration--;
          else if (offer.e.op === 'fear-facedown') {
            this.resources.depletion.find((d) => d.copy === offer.copy)!.remaining--;
            faceFear = 'facedown';
          } else used.add(offer.id);
          if (direct && this.directOutcome) {
            this.directOutcome.prevented.damage += input.damage;
            this.directOutcome.prevented.fear += input.fear;
          }
          remaining.damage -= input.damage;
          remaining.fear -= input.fear;
          this.result.prevented.damage += input.damage;
          this.result.prevented.fear += input.fear;
        }
        for (const c of cards)
          while (remaining[c.family] > 0) {
            this.frame(
              `${path}/${c.family}-${remaining[c.family]}`,
              hero,
              null,
              'draw',
              remaining[c.family],
              () => {
                const copy = this.s.decks[c.family].shift();
                if (!copy) this.gate(hero, 'required-deck-empty', remaining, c.family);
                this.s.areas[hero]![c.family].push(copy);
                remaining[c.family]--;
                this.result.transferred[c.family]++;
                if (this.directOutcome && !this.directOutcome.sealed) {
                  if (direct) this.directOutcome.suffered[c.family]++;
                  else
                    this.directOutcome.childSources.push({
                      source: path,
                      recipientHeroId: this.hero(hero).heroId,
                      family: c.family,
                      amount: 1,
                    });
                }
                suffered++;
                for (const b of this.boonEffects(hero))
                  if (b.effect.op === 'discard-on-suffer' && b.effect.families.includes(c.family))
                    this.returnBoon(
                      hero,
                      b.copyId,
                      `${path}/suffer-${c.family}`,
                      'actually-suffered',
                    );
                if ((c.family === 'fear' ? faceFear : face) === 'faceup')
                  this.front(hero, copy, `${path}/front-${this.r.operations}`);
              },
            );
          }
        return suffered;
      },
    );
  }
  private reveal(hero: number, count: number, path: string) {
    const h = this.hero(hero),
      cards: string[] = [];
    for (let i = 0; i < count; i++) {
      if (!h.deck.length && h.discard.length) {
        h.deck = this.deckRandom(`${path}/refill-${i}`, h.discard, h.discard.length);
        h.discard = [];
      }
      const copy = this.p.episode ? h.deck.pop() : h.deck.shift();
      if (!copy) break;
      cards.push(copy);
      if (!h.deck.length && h.discard.length) {
        h.deck = this.deckRandom(`${path}/post-refill-${i}`, h.discard, h.discard.length);
        h.discard = [];
      }
    }
    return cards;
  }
  private scout(hero: number, count: number, path: string, rally = false, prepare = true) {
    return this.frame(path, hero, null, 'scout', count, () => {
      const h = this.hero(hero),
        cards = this.reveal(hero, count, path);
      if (!cards.length) return [];
      this.r.revealed.push({ heroId: h.heroId, cards: [...cards] });
      const input = this.ask(hero, `${path}/arrange`, {
        ...(!prepare ? { scoutPrepareAllowed: false as const } : {}),
        ...(this.run.spatial
          ? {
              scoutTopAllowed:
                !rally ||
                !this.persist(hero).some(({ effect: e }) => e.op === 'prohibit-scout-top'),
            }
          : {}),
        mode: 'scout',
        title: prepare
          ? `Scoperta ${count}: prepara al massimo una carta e ordina le altre.`
          : `Guarda ${count} carte: disponile in cima o in fondo al mazzo.`,
        options: cards.map((id) => ({ id, label: this.skillName(id) })),
        minimum: 0,
        maximum: cards.length,
        remaining: empty(),
      });
      invariant(input.kind === 'physical-scout', 'Scoperta richiede una disposizione.');
      invariant(
        prepare || (!input.prepare && !input.discard),
        'Questa disposizione non concede preparazione o scarto.',
      );
      const assigned = [...(input.prepare ? [input.prepare] : []), ...input.top, ...input.bottom];
      invariant(
        assigned.length === cards.length &&
          new Set(assigned).size === assigned.length &&
          assigned.every((c) => cards.includes(c)),
        'Carte Scoperta non conservate.',
      );
      invariant(
        !rally ||
          !input.top.length ||
          !this.persist(hero).some(({ effect: e }) => e.op === 'prohibit-scout-top'),
        'La carta scoperta vieta il ritorno in cima.',
      );
      const prepared = [...h.prepared, ...(input.prepare ? [input.prepare] : [])];
      invariant(
        prepared.length > 4 === Boolean(input.discard) &&
          (!input.discard || prepared.includes(input.discard)),
        'Limite preparate non rispettato.',
      );
      h.prepared = prepared.filter((c) => c !== input.discard);
      if (input.discard) h.discard.push(input.discard);
      h.deck = this.p.episode
        ? [...input.bottom].reverse().concat(h.deck, [...input.top].reverse())
        : [...input.top, ...h.deck, ...input.bottom];
      this.r.revealed.pop();
      if (
        input.prepare &&
        (this.run.spatial ||
          (this.run.program.profile === 'source-fronts-v1' && this.run.program.startupRules) ||
          h.prepared.includes(input.prepare))
      )
        this.afterPrepare(hero, input.prepare, path);
      return cards;
    });
  }
  private prepareDiscard(hero: number, path: string) {
    const h = this.hero(hero),
      copy = this.select(
        hero,
        `${path}/select`,
        'Scegli una carta dagli scarti da preparare.',
        h.discard.map((id) => ({ id, label: this.skillName(id) })),
        Math.min(1, h.discard.length),
      )[0];
    if (!copy) return;
    h.discard.splice(h.discard.indexOf(copy), 1);
    const prepared = [...h.prepared, copy],
      discarded =
        prepared.length > 4
          ? this.select(
              hero,
              `${path}/prepared-limit`,
              'Scegli una carta preparata da scartare per il limite quattro.',
              prepared.map((id) => ({ id, label: this.skillName(id) })),
              1,
            )[0]!
          : null;
    h.prepared = prepared.filter((id) => id !== discarded);
    if (discarded) h.discard.push(discarded);
    if (this.run.spatial || h.prepared.includes(copy)) this.afterPrepare(hero, copy, path);
  }
  private test(
    hero: number,
    stat: 'might' | 'wisdom' | 'agility' | 'spirit' | 'wit',
    path: string,
    negate = false,
    lastStand = false,
    sourceTarget?: number | null,
    attack?: AttackTestChild,
    setup?: PhysicalSnapshot['parents'][number]['results'][number]['setup'],
  ): number {
    return this.frame(path, hero, null, 'test', 0, () => {
      const visibleSource = sourceTarget !== undefined || (!!this.combat && !lastStand);
      const terrainContext = this.run.spatial?.testTerrain;
      const terrain =
        terrainContext &&
        (attack || negate) &&
        !lastStand &&
        terrainContext.tokens.some(
          (t) =>
            t.spaceId === this.run.spatial!.heroes[hero]!.spaceId &&
            t.kind === (attack ? 'fire' : 'rock'),
        )
          ? new TerrainAccounting(
              terrainContext,
              this.run.spatial!.heroes[hero]!.spaceId,
              attack ? 'attack' : 'negate',
              (copy) => this.skillSymbols(copy),
              (copy) => this.skillName(copy),
              (copy) => frontToken(this.p.entropy, `${this.run.id}:${path}:${copy}`),
            )
          : undefined;
      stat = this.beforeTest(hero, stat, path, attack?.replaceCopy);
      const h = this.hero(hero),
        definition = this.catalog.heroes.find((h) => h.id === this.hero(hero).heroId)!;
      const modifier =
        this.persist(hero).reduce(
          (n, { effect: e }) =>
            n + (e.op === 'stat-modifier' || (attack && e.op === 'test-reveal-modifier') ? e.n : 0),
          0,
        ) +
        this.policy(hero).reduce(
          (n, { effect: e }) => n + (e.op === 'stat' && e.stat === stat ? e.n : 0),
          0,
        );
      const cards = this.reveal(hero, Math.max(1, definition.stats[stat] + modifier), path);
      if (setup) setup.revealed = [...cards];
      this.r.revealed.push({ heroId: h.heroId, cards: [...cards] });
      let successes = cards.reduce((n, c) => n + this.skillSymbols(c).success, 0),
        fate = cards.reduce((n, c) => n + this.skillSymbols(c).fate, 0),
        n = 0,
        spentTrigger = false,
        addedHits = attack
          ? [...this.persist(hero), ...this.boonEffects(hero)].reduce(
              (n, { effect: e }) => n + (e.op === 'add-hits' ? e.n : 0),
              0,
            )
          : 0;
      const declinedTitles = new Set<string>();
      let printed = successes;
      successes += this.persist(hero).reduce(
        (n, { effect: e }) => n + (e.op === 'add-success' && e.stats.includes(stat) ? e.n : 0),
        0,
      );
      if (negate)
        successes += this.policy(hero).reduce(
          (n, { effect: e }) => n + (e.op === 'negate-bonus' ? e.n : 0),
          0,
        );
      // New boon runs retain fate identity. Replacing a card removes its converted
      // symbols, while inspiration and independently paid abilities stay paid.
      let bonusSuccesses = successes - printed,
        serial = 0;
      let icons: FateIcon[] = [];
      const identityAccounting = !!this.p.boons || !!terrain;
      const addIcons = (copies: string[]) => {
        for (const copy of copies)
          if (!terrain?.excludes(copy))
            for (let i = 0; i < this.skillSymbols(copy).fate; i++)
              icons.push({
                id: `fate:${serial++}:${terrain ? terrain.token(copy) : copy}`,
                copy,
                state: 'free',
              });
      };
      if (identityAccounting) addIcons(cards);
      const useFates = (count: number, state: 'converted' | 'spent', suffix: string) => {
        if (!identityAccounting) return;
        const free = icons.filter((i) => i.state === 'free');
        const chosen = this.select(
          hero,
          `${path}/${suffix}`,
          'Scegli le icone fato da usare: le altre restano disponibili.',
          free.map((i) => ({ id: i.id, label: `${this.skillName(i.copy)} · fato` })),
          count,
        );
        for (const id of chosen) icons.find((i) => i.id === id)!.state = state;
      };
      const updateTest = () => {
        if (identityAccounting) {
          printed = cards.reduce(
            (n, c) => n + (terrain?.excludes(c) ? 0 : this.skillSymbols(c).success),
            0,
          );
          successes =
            printed + bonusSuccesses + icons.filter((i) => i.state === 'converted').length;
          fate = icons.filter((i) => i.state === 'free').length;
        }
        if (attack)
          this.r.attackTest = {
            heroId: h.heroId,
            groupId: attack.groupId,
            stage: 'converting',
            slots: attack.slots,
            successes,
            spent: 0,
            remaining: successes,
            addedHits,
            hits: addedHits,
            allocations: [],
          };
        if (visibleSource)
          this.r.sourceTest = {
            ...(terrain ? { terrain: terrain.view(fate) } : {}),
            heroId: h.heroId,
            stat,
            target: sourceTarget ?? null,
            successes,
            fateRemaining: fate,
            cards: cards.map((c) => ({
              ...(terrain ? { copy: terrain.token(c) } : {}),
              ...(terrain?.excludes(c) ? { excluded: true as const } : {}),
              skillId: definitionId(c),
              name: this.skillName(c),
              success: this.skillSymbols(c).success,
              fate: this.skillSymbols(c).fate,
            })),
          };
        if (!lastStand) return;
        this.s.lastStand!.test = {
          heroId: h.heroId,
          stat,
          difficulty: this.s.lastStand!.selections.at(-1)!.difficulty,
          successes,
          fateRemaining: fate,
          forcedFailure: (['damage', 'fear'] as const).some(
            (f) =>
              this.s.areas[hero]![f].filter((c) => this.faceup.has(c)).length >=
              this.limits(hero)[f],
          ),
          cards: cards.map((c) => ({
            name: this.skillName(c),
            success: this.skillSymbols(c).success,
            fate: this.skillSymbols(c).fate,
          })),
        };
      };
      const payFire = (id: string, spent = 0) => {
        const copy = terrain!.pay(id, cards, icons, successes, spent);
        cards.splice(cards.indexOf(copy), 1);
        icons = icons.filter((i) => i.copy !== copy);
        h.discard.push(copy);
        this.r.revealed.at(-1)!.cards = [...cards];
        updateTest();
      };
      while (true) {
        updateTest();
        const titleHelp = lastStand
          ? this.p.heroes.flatMap((_, owner) =>
              owner === hero || this.nearby(owner, hero)
                ? this.titleEffects(owner).flatMap((t) =>
                    t.effect.op === 'last-stand-success' && !declinedTitles.has(t.copy)
                      ? [{ ...t, owner, id: `title-help:${owner}:${t.index}:${t.copy}` }]
                      : [],
                  )
                : [],
            )
          : [];
        const abilities = this.policy(hero).filter(
          ({ effect: e }) =>
            (e.op === 'convert-all' && fate > 0 && (!e.noPrintedSuccess || !printed)) ||
            (e.op === 'convert-one-scout' && fate > 0) ||
            (e.op === 'convert-pair-alone' &&
              fate >= 2 &&
              !this.scope(hero, 'each-nearby-excluding-self').length),
        );
        const company = this.company(hero, 'test-convert').filter(
          (o) => o.clause.effect.op === 'add-success' && o.clause.effect.stat === stat,
        );
        if (attack)
          company.push(
            ...this.company(hero, 'attack-test').filter((o) => o.clause.effect.op === 'strike'),
          );
        const options = [
          ...(terrain?.boulders(fate) ?? []),
          ...(terrain?.fire(cards, icons, successes).map(({ id, label }) => ({ id, label })) ?? []),
          ...this.boonEffects(hero)
            .filter(
              (b) =>
                (attack && b.effect.op === 'add-success') || b.effect.op === 'exchange-test-cards',
            )
            .map((b) => ({
              id: `boon:${b.copyId}:${b.effect.op}`,
              label:
                b.effect.op === 'exchange-test-cards'
                  ? `Scarta ${this.boonName(b.kind)}: scegli quante carte della prova sostituire`
                  : `Scarta ${this.boonName(b.kind)}: aggiungi ${b.effect.op === 'add-success' ? b.effect.n : 0} successi all’attacco`,
            })),
          ...company.map((o) => ({
            id: o.id,
            label: `Scarta ${this.skillName(o.copy)}: ${o.clause.effect.op === 'strike' ? `Assalto ${o.clause.effect.n}` : `aggiungi ${o.clause.effect.op === 'add-success' ? o.clause.effect.n : 0} successo`}`,
          })),
          {
            id: 'resolve',
            label: `Concludi la prova: ${successes} successi, ${fate} fati non spesi`,
          },
          ...(fate && h.inspiration
            ? [{ id: 'inspiration', label: 'Spendi 1 ispirazione per convertire 1 fato' }]
            : []),
          ...abilities.map(({ copy, effect: e }) => ({
            id: copy,
            label:
              e.op === 'convert-all' || e.op === 'convert-one-scout'
                ? `Scarta ${this.skillName(copy)}: ${e.op === 'convert-all' ? 'converti tutti i fati' : 'converti 1 fato'}${e.scout ? `, poi Scoperta ${e.scout}` : ''}`
                : 'Spendi 2 fati per 1 successo',
          })),
          ...titleHelp.map((t) => ({
            id: t.id,
            label: `${this.skillName(t.copy)} · rimuovi dall’avventura per aggiungere ${t.effect.op === 'last-stand-success' ? t.effect.n : 0} successi`,
          })),
        ];
        const title = `Prova: ${cards.map((c) => this.skillName(c)).join(', ')}. ${successes} successi.`;
        const decisionPath = `${path}/convert-${n++}`;
        let selected: string;
        if (lastStand || visibleSource) {
          const input = this.ask(hero, decisionPath, {
            ...(terrain ? { purpose: 'terrain-test' as const } : {}),
            mode: 'choose',
            title,
            options,
            minimum: 1,
            maximum: 1,
            remaining: empty(),
          });
          invariant(
            input.kind === 'physical-choice' && options.some((o) => o.id === input.option),
            'Conversione non disponibile.',
          );
          selected = input.option;
        } else selected = this.choose(hero, decisionPath, title, options);
        if (selected === 'resolve') break;
        if (selected.startsWith('terrain:fire:')) {
          payFire(selected);
          continue;
        }
        if (selected.startsWith('terrain:boulder:')) {
          terrain!.useBoulder(selected, fate);
          useFates(1, 'converted', `boulder-fate-${n}`);
          continue;
        }
        const boon = this.boonEffects(hero).find(
          (b) => selected === `boon:${b.copyId}:${b.effect.op}`,
        );
        if (boon?.effect.op === 'add-success') {
          this.returnBoon(hero, boon.copyId, `${path}/convert-${n}`, 'attack-success');
          successes += boon.effect.n;
          bonusSuccesses += boon.effect.n;
          continue;
        }
        if (boon?.effect.op === 'exchange-test-cards') {
          this.returnBoon(hero, boon.copyId, `${path}/convert-${n}`, 'test-exchange');
          const selected = this.select(
            hero,
            `${path}/exchange-${n}`,
            'Scarta un qualsiasi numero di carte dalla prova e rivela altrettante carte.',
            cards.map((copy) => ({
              id: copy,
              label: `${this.skillName(copy)}${icons.some((i) => i.copy === copy && i.state === 'converted') ? ' · fato già convertito' : ''}`,
            })),
            0,
            cards.length,
          );
          const kept = cards.filter((c) => !selected.includes(c));
          cards.splice(0, cards.length, ...kept);
          icons = icons.filter((i) => !selected.includes(i.copy));
          h.discard.push(...selected);
          const additional = this.reveal(hero, selected.length, `${path}/exchange-${n}`);
          invariant(
            additional.length === selected.length,
            'Sostituzione senza pari numero di carte.',
          );
          cards.push(...additional);
          addIcons(additional);
          this.r.revealed.at(-1)!.cards = [...cards];
          continue;
        }
        const prepared = company.find((o) => o.id === selected);
        if (prepared) {
          this.payPrepared(hero, prepared.copy);
          if (prepared.clause.effect.op === 'add-success') {
            successes += prepared.clause.effect.n;
            bonusSuccesses += prepared.clause.effect.n;
          } else if (prepared.clause.effect.op === 'strike') {
            addedHits += prepared.clause.effect.n;
            updateTest();
            this.afterStrike(hero, `${path}/strike-${n}`);
          }
          continue;
        }
        const help = titleHelp.find((t) => t.id === selected);
        if (help) {
          if (
            help.owner !== hero &&
            this.choose(
              help.owner,
              `${path}/title-consent-${n}`,
              `Puoi aiutare ${this.catalog.heroes.find((h) => h.id === this.hero(hero).heroId)!.name.text} rimuovendo ${this.skillName(help.copy)}.`,
              [
                { id: 'use', label: 'Rimuovi il titolo e aggiungi i successi' },
                { id: 'keep', label: 'Conserva il titolo' },
              ],
              hero,
            ) === 'keep'
          ) {
            declinedTitles.add(help.copy);
            continue;
          }
          invariant(help.effect.op === 'last-stand-success', 'Aiuto senza capacità Ultimo Sforzo.');
          this.removeTitle(help.owner, help.copy);
          successes += help.effect.n;
          bonusSuccesses += help.effect.n;
          continue;
        }
        if (selected === 'inspiration') {
          if (setup) setup.converted++;
          useFates(1, 'converted', `inspiration-fate-${n}`);
          h.inspiration--;
          fate--;
          successes++;
          updateTest();
          if (
            !spentTrigger &&
            this.policy(hero).some(({ effect: e }) => e.op === 'after-test-spend-inspiration')
          ) {
            const targets = this.scope(hero, 'each-nearby-excluding-self');
            if (targets.length) {
              const target = Number(
                this.choose(
                  hero,
                  `${path}/spend-trigger`,
                  'Un eroe vicino ottiene 1 ispirazione.',
                  targets.map((id) => ({
                    id: String(id),
                    label: this.catalog.heroes.find((x) => x.id === this.hero(id).heroId)!.name
                      .text,
                  })),
                ),
              );
              this.inspiration(target);
            }
            spentTrigger = true;
          }
        } else {
          const ability = abilities.find((a) => a.copy === selected)!;
          if (ability.effect.op === 'convert-pair-alone') {
            useFates(2, 'spent', `spent-fates-${n}`);
            fate -= 2;
            successes++;
            bonusSuccesses++;
          } else if (
            ability.effect.op === 'convert-all' ||
            ability.effect.op === 'convert-one-scout'
          ) {
            useFates(
              ability.effect.op === 'convert-all' ? fate : 1,
              'converted',
              `ability-fates-${n}`,
            );
            h.prepared.splice(h.prepared.indexOf(selected), 1);
            h.discard.push(selected);
            const converted = ability.effect.op === 'convert-all' ? fate : 1;
            if (setup) setup.converted += converted;
            successes += converted;
            fate -= converted;
            updateTest();
            if (ability.effect.scout)
              this.scout(hero, ability.effect.scout, `${path}/conversion-scout-${n}`);
          }
        }
      }
      if (attack)
        this.spendAttackSlots(
          hero,
          attack,
          successes,
          addedHits,
          `${path}/slots`,
          terrain
            ? {
                options: (spent) =>
                  terrain
                    .fire(cards, icons, successes, spent)
                    .map(({ id, label }) => ({ id, label })),
                pay: payFire,
                successes: () => successes,
                modifiers: () => terrain.modifiers(),
              }
            : undefined,
        );
      this.r.revealed.pop();
      h.discard.push(...cards);
      if (
        (this.p.boons ||
          (this.run.program.profile === 'source-fronts-v1' &&
            this.run.program.immediateSkillReset)) &&
        !h.deck.length &&
        h.discard.length
      ) {
        h.deck = this.deckRandom(`${path}/after-test-refill`, h.discard, h.discard.length);
        h.discard = [];
      }
      if (this.combat) this.afterTest(hero, path);
      if (attack) this.r.attackTest = null;
      if (lastStand) this.s.lastStand!.test = null;
      if (visibleSource) this.r.sourceTest = null;
      return successes;
    });
  }
  private spendAttackSlots(
    hero: number,
    attack: AttackTestChild,
    successes: number,
    addedHits: number,
    path: string,
    terrain?: {
      options: (spent: number) => { id: string; label: string }[];
      pay: (id: string, spent: number) => void;
      successes: () => number;
      modifiers: () => ('pierce' | 'smite')[];
    },
  ) {
    invariant(
      new Set(attack.slots.map((s) => s.id)).size === attack.slots.length,
      'Slot duplicati.',
    );
    const allocations: NonNullable<typeof this.result.attack>['allocations'] = [];
    let spent = 0,
      hits = addedHits;
    const modifiers: NonNullable<typeof this.result.attack>['modifiers'] = [];
    let terrainDecisions = 0;
    while (true) {
      if (terrain) successes = terrain.successes();
      this.r.attackTest = {
        heroId: this.hero(hero).heroId,
        groupId: attack.groupId,
        stage: 'spending',
        slots: attack.slots,
        successes,
        spent,
        remaining: successes - spent,
        addedHits,
        hits,
        allocations: structuredClone(allocations),
      };
      const choices = attack.slots.filter(
        (s) => !allocations.some((a) => a.slotId === s.id) && s.cost <= successes - spent,
      );
      const titleOffers = (this.s.lastStand?.titles ?? []).flatMap((t) =>
        t.heroId === this.hero(hero).heroId &&
        !t.removed &&
        !t.pending &&
        this.hero(hero).prepared.includes(t.copy) &&
        this.scenarioTitles.has(t.cardId)
          ? AttackModifierSchema.options.map((modifier) => ({
              id: `title-modifier:${t.copy}:${modifier}`,
              copy: t.copy,
              modifier,
              label: `${this.skillName(t.copy)} · rimuovi dall’avventura: ${
                (
                  {
                    pierce: 'Perforare',
                    smite: 'Punire',
                    lethal: 'Letale',
                    sunder: 'Squarciare',
                    stun: 'Stordire',
                    cleave: 'Fendere',
                  } as const
                )[modifier]
              }`,
            }))
          : [],
      );
      const decisionPath = terrain
        ? `${path}/${allocations.length}/${modifiers.length}/${terrainDecisions}`
        : this.scenarioTitles.size
          ? `${path}/${allocations.length}/${modifiers.length}`
          : `${path}/${allocations.length}`;
      const input = this.ask(hero, decisionPath, {
        mode: 'choose',
        title: `${successes - spent} successi disponibili; ${spent} spesi. Anteprima: ${hits} colpi. Ogni slot può essere pagato una sola volta.`,
        options: [
          ...(terrain?.options(spent) ?? []),
          { id: 'apply', label: `Conferma ${hits} colpi e prosegui` },
          ...choices.map((s) => ({
            id: `slot:${s.id}`,
            label: `${s.label} · spendi ${s.cost} successi`,
          })),
          ...titleOffers.map(({ id, label }) => ({ id, label })),
        ],
        minimum: 1,
        maximum: 1,
        remaining: empty(),
      });
      invariant(input.kind === 'physical-choice', 'Scelta slot richiesta.');
      if (input.option === 'apply') break;
      if (input.option.startsWith('terrain:fire:') && terrain) {
        terrain.pay(input.option, spent);
        terrainDecisions++;
        continue;
      }
      const title = titleOffers.find((o) => o.id === input.option);
      if (title) {
        this.removeTitle(hero, title.copy);
        modifiers.push(title.modifier);
        continue;
      }
      const slot = choices.find((s) => `slot:${s.id}` === input.option);
      invariant(slot, 'Slot già speso/estraneo o successi insufficienti.');
      allocations.push({
        slotId: slot.id,
        successes: Array.from({ length: slot.cost }, (_, n) => spent + n),
      });
      spent += slot.cost;
      hits += slot.hits;
      modifiers.push(...slot.modifiers);
    }
    this.result.attack = {
      successes,
      addedHits,
      allocations,
      unspent: successes - spent,
      hits,
      modifiers: [...new Set([...modifiers, ...(terrain?.modifiers() ?? [])])],
    };
  }
  private additionEligible(hero: number, addition: CombatAddition, outcome: AttackOutcome) {
    const p = addition.predicate;
    return (
      p === 'always' ||
      (p === 'damage-positive' && outcome.suffered.damage > 0) ||
      (p === 'fear-positive' && outcome.suffered.fear > 0) ||
      (p === 'zero-damage-and-fear' && !total(outcome.suffered)) ||
      (p === 'recipient-in-darkness' && this.condition(hero, 'self-space-in-darkness'))
    );
  }
  private addition(hero: number, addition: CombatAddition, outcome: AttackOutcome, path: string) {
    if (!this.additionEligible(hero, addition, outcome)) return;
    const e = addition.effect;
    const dummy = '';
    switch (e.op) {
      case 'discard-prepared':
        this.operation(hero, dummy, { op: 'discard-prepared', hero: 'self', n: e.amount }, path);
        break;
      case 'discard-inspiration':
        this.operation(hero, dummy, { op: 'discard-inspiration', hero: 'self', n: e.amount }, path);
        break;
      case 'gain-inspiration':
        for (let n = 0; n < e.amount; n++) this.inspiration(hero);
        break;
      case 'gain-weakness':
        for (let n = 0; n < e.amount; n++)
          this.operation(
            hero,
            dummy,
            {
              op: 'gain-weakness',
              hero: 'self',
              n: 1,
              destination: 'shuffle-into-current-skill-deck',
            },
            `${path}/${n}`,
          );
        break;
      case 'flip-random':
        this.flip(hero, e.family, e.amount, path);
        break;
      case 'suffer':
        this.suffer(hero, [{ family: e.family, amount: e.amount }], e.face, path);
        break;
      case 'lose-boon-or-weakness': {
        const boon = this.resources.boons.findIndex(
          (b) => b.heroId === this.hero(hero).heroId && b.kind === e.boon,
        );
        if (boon >= 0) {
          if (this.p.boons)
            this.returnBoon(
              hero,
              this.resources.boonCustody!.find(
                (b) => b.heroId === this.hero(hero).heroId && b.kind === e.boon,
              )!.copyId,
              path,
              'source-loss',
            );
          else this.resources.boons.splice(boon, 1);
        } else
          this.operation(
            hero,
            dummy,
            {
              op: 'gain-weakness',
              hero: 'self',
              n: 1,
              destination: 'shuffle-into-current-skill-deck',
            },
            `${path}/known-absent-fallback`,
          );
        break;
      }
      case 'gain-boon':
        this.gainBoon(hero, e.boon, path);
        break;
      case 'move-pair-toward-threat':
        throw new Error('Movimento aggiuntivo richiede il ritorno del controller.');
    }
  }
  private eventEffects(hero: number, event: string, sufferedFear: number) {
    return this.p.heroes.flatMap((_, owner) =>
      this.persist(owner)
        .filter(
          ({ effect: e }) =>
            e.window === event &&
            (event === 'after-darkness-suffering-batch'
              ? (owner === hero || this.nearby(owner, hero)) && sufferedFear > 0
              : owner === hero),
        )
        .map((e) => ({ ...e, owner })),
    );
  }
  private event(hero: number, event: string, path: string, threat: boolean, sufferedFear: number) {
    if (
      event === 'before-interact' &&
      this.run.program.profile === 'source-fronts-v1' &&
      this.run.program.interactionLookRules
    ) {
      if (this.run.program.interactionBefore !== 'already-completed')
        this.beforeInteraction(hero, path, threat);
      return;
    }
    const effects = this.eventEffects(hero, event, sufferedFear);
    const left = effects.map((_, n) => n);
    while (left.length) {
      const n = Number(
        this.choose(
          hero,
          `${path}/order-${left.length}`,
          'Scegli quale effetto simultaneo risolvere.',
          left.map((n) => ({ id: String(n), label: this.cards.get(effects[n]!.copy)!.name.value })),
        ),
      );
      left.splice(left.indexOf(n), 1);
      this.eventEffect(hero, effects[n]!, `${path}/trigger-${n}`, threat, `${path}/optional-${n}`);
    }
    if (event === 'rally-scout') this.scout(hero, 2, `${path}/rally`, true);
  }
  private beforeInteraction(hero: number, path: string, threat: boolean) {
    const h = this.hero(hero),
      cap = this.catalog.heroes.find((d) => d.id === h.heroId)!.stats.inspiration;
    const left = beforeInteractionEffects(
      this.p.raw,
      this.artifact,
      this.catalog,
      this.resources,
      this.s.areas[hero]!,
      [...this.faceup],
      threat,
    );
    invariant(beforeOrderFeasible(left, h.inspiration, cap), 'Obblighi prima non garantiti.');
    invariant(
      !left.some((e) => e.kind === 'look') || h.deck.length + h.discard.length > 0,
      'Nessuna carta disponibile per guardare.',
    );
    const window = (this.r.interactionWindow = {
      runId: this.run.id,
      child: this.child,
      heroId: h.heroId,
      remaining: left,
      completed: [] as string[],
      activeEffect: null as string | null,
    });
    while (left.length) {
      const choice = this.choose(
        hero,
        `${path}/before-order-${left.length}`,
        'Il gruppo concorda l’ordine degli effetti prima dell’interazione.',
        left.map((e) => ({
          id: e.id,
          label: e.label,
          ...(!beforeOrderFeasible(
            left.filter((x) => x !== e),
            afterKnownEffect(e, h.inspiration, cap),
            cap,
          )
            ? { unavailable: 'Questo ordine non garantisce il pagamento degli obblighi.' }
            : {}),
        })),
        hero,
        'interaction-order',
      );
      const effect = left.find((e) => e.id === choice)!;
      window.activeEffect = effect.id;
      if (effect.kind === 'look') {
        this.frame(`${path}/look`, hero, null, 'private-look', 1, () => {
          if (!h.deck.length) {
            h.deck = this.deckRandom(`${path}/look-reset`, h.discard, h.discard.length);
            h.discard = [];
          }
          const copy = this.p.episode ? h.deck.at(-1)! : h.deck[0]!;
          invariant(copy, 'Nessuna carta disponibile per guardare.');
          const card = this.skills.find((s) => s.id === definitionId(copy))!;
          invariant(card, 'Carta guardata senza definizione congelata.');
          const before = h.inspiration;
          if (card.fate > 0) this.inspiration(hero);
          (this.r.privateLooks ??= []).push({
            runId: this.run.id,
            child: this.child,
            heroId: h.heroId,
            copy,
            skillId: card.id,
            fate: card.fate,
            reward: h.inspiration - before,
          });
          const input = this.ask(hero, `${path}/look-continue`, {
            purpose: 'interaction-look',
            mode: 'choose',
            title:
              'Guarda la carta superiore sul tuo dispositivo. La carta resta al suo posto; il premio è già calcolato.',
            options: [{ id: 'continue', label: 'Continua l’interazione' }],
            minimum: 1,
            maximum: 1,
            remaining: empty(),
          });
          invariant(
            input.kind === 'physical-choice' && input.option === 'continue',
            'Il look richiede la continuazione della stessa interazione.',
          );
        });
      } else if (effect.kind === 'spend') {
        invariant(h.inspiration > 0, 'Costo prima non pagabile.');
        h.inspiration--;
      } else this.inspiration(hero);
      left.splice(left.indexOf(effect), 1);
      window.completed.push(effect.id);
      window.activeEffect = null;
    }
    delete this.r.interactionWindow;
  }
  private eventEffect(
    hero: number,
    { copy, effect: e, owner }: { copy: string; effect: PersistentOp; owner: number },
    path: string,
    threat: boolean,
    optionalPath = `${path}/optional`,
  ) {
    if (!this.faceup.has(copy) || !this.lastStand.active(owner) || !this.lastStand.active(hero))
      return;
    if (e.op === 'self-flip-down') this.down(copy);
    if (e.op === 'suffer')
      this.suffer(
        e.hero === 'self' ? owner : hero,
        [{ family: e.family, amount: e.n }],
        'faceup',
        path,
      );
    if (e.op === 'mandatory-spend' && threat) {
      if (!this.hero(hero).inspiration)
        throw new Error('Interazione non pagabile: nessun costo o effetto è stato applicato.');
      this.hero(hero).inspiration--;
    }
    if (
      e.op === 'optional-self-discard' &&
      this.resources.boons.some(
        (b) => b.heroId === this.hero(owner).heroId && b.kind === 'emboldened',
      )
    )
      if (
        this.choose(owner, optionalPath, 'Puoi scartare questa carta.', [
          { id: 'keep', label: 'Conserva la carta' },
          { id: 'discard', label: 'Scarta la carta' },
        ]) === 'discard'
      )
        this.discard(copy, owner);
  }
  replay() {
    const sources = new Set<string>(),
      runIds = new Set<string>();
    for (const [runIndex, run] of this.p.runs.entries()) {
      invariant(
        !this.s.active && !sources.has(run.source.effectId) && !runIds.has(run.id),
        'Padri fronti duplicati o concorrenti.',
      );
      invariant(
        run.program.profile === 'source-fronts-v1' &&
          run.program.initialCredits.every((n) => n === 0) &&
          run.program.children.every((c) => c.kind !== 'suffer' || !c.prevention.length),
        'I crediti sintetici non pagano capacità originali.',
      );
      validatePhysicalProgram(run.program, this.p.heroes.length);
      for (const child of run.program.children)
        if (child.kind === 'scenario-item') {
          invariant(
            this.p.version === 3 && run.lastStandRules && run.spatial,
            'Oggetto senza causa scenario e consumer corrente.',
          );
          validateItemGrant(this.catalog, this.artifact, child.grant);
        } else if (child.kind === 'scenario-title') {
          invariant(
            this.p.version === 3 && run.lastStandRules && run.spatial,
            'Acquisizione titolo senza causa scenario e consumer corrente.',
          );
          validateScenarioTitle(this.p.raw, child.grant);
          this.scenarioTitles.set(child.grant.cardId, child.grant);
        }
      sources.add(run.source.effectId);
      runIds.add(run.id);
      this.run = run;
      invariant(
        run.boonRules === this.p.boons?.fingerprint,
        'Regole benefici introdotte dopo il freeze o modificate.',
      );
      this.answer = 0;
      const activation = this.p.lastStandActivation;
      const cutover =
        activation?.kind === 'legacy-continuation'
          ? this.p.runs.findIndex((r) => r.id === activation.runId)
          : -1;
      const required =
        activation?.kind === 'initial-freeze' || (cutover >= 0 && runIndex > cutover);
      invariant(
        !!run.lastStandRules === required,
        'Versione Ultimo Sforzo diversa dal confine di attivazione.',
      );
      if (run.lastStandRules)
        invariant(
          this.p.lastStand &&
            run.lastStandRules.version === this.p.lastStand.rules &&
            run.lastStandRules.artifactFingerprint === this.p.lastStand.fingerprint,
          'Regole Ultimo Sforzo modificate.',
        );
      if (run.spatial)
        invariant(
          (this.p.version === 3 || !!this.p.boons) &&
            digest(run.spatial.heroes.map(({ heroId, playerId }) => ({ heroId, playerId }))) ===
              digest(this.p.heroes.map(({ heroId, playerId }) => ({ heroId, playerId }))),
          'Contesto spaziale di un’altra compagnia o versione.',
        );
      invariant(
        run.program.profile !== 'source-fronts-v1' ||
          !run.program.deferFrontier ||
          !!run.program.combat,
        'Frontiera differita senza capacità.',
      );
      if (run.program.profile === 'source-fronts-v1' && run.program.combat) {
        const combat = run.program.combat;
        for (const clause of combat.clauses)
          invariant(
            digest(this.skills.find((s) => s.id === clause.cardId)) === clause.definitionHash,
            'Clausola senza carta fonte congelata.',
          );
        for (const hero of combat.heroes)
          invariant(
            digest(this.catalog.heroes.find((h) => h.id === hero.heroId)) === hero.definitionHash,
            'Capacità eroe senza fonte congelata.',
          );
      }
      const context = FrontResourcesSchema.parse(run.context);
      invariant(
        !!context.preparation.episode === !!this.p.episode,
        'Composizione campagna in un’origine storica.',
      );
      invariant(
        this.p.boons || context.boonCustody === undefined,
        'Copie beneficio in un pack storico.',
      );
      invariant(
        context.preparation.heroes.length === this.p.heroes.length &&
          context.preparation.heroes.every(
            (h, n) =>
              h.heroId === this.p.heroes[n]!.heroId && h.playerId === this.p.heroes[n]!.playerId,
          ),
        'Risorse di un’altra compagnia.',
      );
      if (this.r.resources)
        invariant(digest(context) === digest(this.r.resources), 'Risorse non continue fra fonti.');
      if (!this.r.resources) {
        invariant(
          !preparationProblem(
            this.catalog,
            [...new Set(this.p.heroes.map((h) => h.playerId))],
            context.preparation,
          ),
          'Risorse iniziali senza conservazione della compagnia.',
        );
        invariant(
          !context.depletion.length &&
            !context.boons.length &&
            (!context.itemCustody?.length || !!this.p.episode),
          'Acquisizioni di accessori e benefici richiedono un consumer fonte dedicato.',
        );
      }
      this.r.resources = structuredClone(context);
      if (this.p.boons) {
        this.r.resources.boonCustody ??= [];
        validateBoonCustody(
          this.p.boons,
          this.r.resources.boonCustody,
          this.p.heroes.map((h) => h.heroId),
        );
        invariant(
          digest(this.r.resources.boons) ===
            digest(this.r.resources.boonCustody.map(({ heroId, kind }) => ({ heroId, kind }))),
          'Custodia e vista benefici discordanti.',
        );
      }
      this.s.credits = [...run.program.initialCredits];
      const parent: PhysicalSnapshot['parents'][number] = {
        id: run.id,
        source: run.source.effectId,
        status: 'waiting',
        completedChildren: 0,
        totalChildren: run.program.children.length,
        returnCount: 0,
        results: [],
      };
      this.s.parents.push(parent);
      const reactions: LastStandReaction[] = [];
      try {
        for (const [index, child] of run.program.children.entries()) {
          invariant(child.hero < this.p.heroes.length, 'Eroe fonte assente.');
          this.child = index;
          this.result = {
            child: index,
            kind: child.kind,
            heroId: this.p.heroes[child.hero]!.heroId,
            prevented: empty(),
            transferred: empty(),
            returned: empty(),
            costs: [],
          };
          parent.results.push(this.result);
          const path = `${run.id}/${index}`;
          const collective =
            child.kind === 'group-suffer' ||
            (this.liveGroups &&
              (child.kind === 'group-test' ||
                child.kind === 'darkness' ||
                child.kind === 'rally-reset'));
          if (
            !this.lastStand.active(child.hero) &&
            !collective &&
            child.kind !== 'scenario-title' &&
            child.kind !== 'scenario-item'
          ) {
            parent.completedChildren++;
            continue;
          }
          switch (child.kind) {
            case 'battle-loss-weakness': {
              invariant(
                this.p.episode && this.resources.preparation.episode,
                'Debolezza2 fuori dall’episodio.',
              );
              const copy = this.resources.preparation.weaknessDeck.pop();
              invariant(copy, 'Riserva debolezze esaurita.');
              this.hero(child.hero).deck.unshift(copy);
              break;
            }
            case 'battle-equipment': {
              invariant(
                this.p.episode && this.resources.preparation.episode,
                'Allestimento2 fuori dall’episodio.',
              );
              const h = this.hero(child.hero),
                accessory = this.resources.preparation.episode.heroes.find(
                  (h) => h.heroId === this.hero(child.hero).heroId,
                )!.accessory;
              for (const copy of [...h.itemCopies, ...(accessory ? [accessory] : [])]) {
                const effects =
                  this.artifact.policies.find(
                    (p) => p.kind === 'item' && p.id === definitionId(copy),
                  )?.effects ?? [];
                for (const [n, e] of effects.entries()) {
                  if (
                    child.window === 'initialize' &&
                    (e.op === 'fear-facedown' || e.op === 'fear-facedown-only')
                  ) {
                    invariant(
                      !this.resources.depletion.some((d) => d.copy === copy),
                      'Consumo iniziale duplicato.',
                    );
                    this.resources.depletion.push({ copy, remaining: e.depletion });
                  }
                  if (child.window === 'after-setup' && e.op === 'after-setup-inspiration')
                    this.inspiration(child.hero);
                  if (child.window === 'after-setup' && e.op === 'after-setup-scout')
                    this.scout(child.hero, e.count, `${path}/equipment-${copy}-${n}`);
                }
              }
              break;
            }
            case 'prepared':
              invariant(
                this.hero(child.hero).prepared.includes(child.copy),
                'Trigger senza copia preparata.',
              );
              this.afterPrepare(child.hero, child.copy, path);
              break;
            case 'startup-scout': {
              invariant(
                child.count === undefined || this.p.episode,
                'Scoperta3 fuori dall’origine battaglia.',
              );
              const input = this.ask(child.hero, `${path}/reveal`, {
                mode: 'choose',
                title: `Scoperta iniziale ${child.count ?? 2}`,
                options: [{ id: 'reveal', label: 'Rivela le carte di Scoperta' }],
                minimum: 1,
                maximum: 1,
                remaining: empty(),
              });
              invariant(
                input.kind === 'physical-choice' && input.option === 'reveal',
                'Scoperta iniziale senza reveal.',
              );
              const revealed = this.scout(child.hero, child.count ?? 2, `${path}/scout`);
              this.result.setup = { revealed, converted: 0, outcome: null, reward: 0 };
              break;
            }
            case 'startup-test': {
              const input = this.ask(child.hero, `${path}/reveal`, {
                mode: 'choose',
                title: 'Prova iniziale di Spirito · difficoltà 1',
                options: [{ id: 'reveal', label: 'Rivela le carte della prova' }],
                minimum: 1,
                maximum: 1,
                remaining: empty(),
              });
              invariant(
                input.kind === 'physical-choice' && input.option === 'reveal',
                'Prova iniziale senza reveal.',
              );
              const setup = {
                revealed: [] as string[],
                converted: 0,
                outcome: null as 'pass' | 'fail' | null,
                reward: 0,
              };
              this.result.setup = setup;
              const successes = this.test(
                child.hero,
                'spirit',
                `${path}/test`,
                false,
                false,
                1,
                undefined,
                setup,
              );
              this.result.successes = successes;
              setup.outcome = successes >= 1 ? 'pass' : 'fail';
              if (setup.outcome === 'pass') {
                const before = this.hero(child.hero).inspiration;
                this.inspiration(child.hero);
                setup.reward = this.hero(child.hero).inspiration - before;
              }
              break;
            }
            case 'source-boon':
              invariant(
                this.p.version === 3 && run.lastStandRules && run.spatial,
                'Beneficio senza causa scenario corrente.',
              );
              this.gainBoon(child.hero, child.boon, `${path}/source-boon`);
              break;
            case 'scenario-item': {
              validateItemGrant(this.catalog, this.artifact, child.grant);
              const custody = (this.resources.itemCustody ??= []);
              if (custody.some((c) => c.modelId === child.grant.model.modelId)) break;
              invariant(
                !custody.length && this.p.heroes.length >= 2,
                'Inventario non ammesso o titolo senza consumer.',
              );
              const copy = `${child.grant.cardId}:1`,
                owner = this.hero(child.hero).heroId;
              invariant(
                !this.resources.depletion.some((d) => d.copy === copy) &&
                  !this.resources.preparation.heroes.some((h) => h.itemCopies.includes(copy)),
                'Copia oggetto già assegnata.',
              );
              const entry = {
                copy,
                cardId: child.grant.cardId,
                modelId: child.grant.model.modelId,
                heroId: owner,
                source: run.source.effectId,
              };
              custody.push(entry);
              this.resources.depletion.push({ copy, remaining: child.grant.depletion });
              const recipients = this.p.heroes.flatMap((h, n) =>
                this.lastStand.active(n) && (n === child.hero || this.nearby(child.hero, n))
                  ? [
                      {
                        id: h.heroId,
                        label: `${this.catalog.heroes.find((d) => d.id === h.heroId)!.name.text} · ottiene ed equipaggia l’accessorio`,
                      },
                    ]
                  : [],
              );
              invariant(recipients.length > 0, 'Nessun eroe può ottenere l’oggetto.');
              const choice = this.ask(child.hero, `${path}/gain-item`, {
                mode: 'choose',
                title: child.message,
                options: recipients,
                minimum: 1,
                maximum: 1,
                remaining: empty(),
              });
              invariant(
                choice.kind === 'physical-choice' && recipients.some((o) => o.id === choice.option),
                'Destinatario oggetto non vicino o non attivo.',
              );
              entry.heroId = choice.option;
              break;
            }
            case 'scenario-title':
              invariant(this.s.lastStand, 'Titolo senza custodia fisica inizializzata.');
              if (this.s.lastStand.titles.some((t) => t.cardId === child.grant.cardId)) {
                const response = this.ask(child.hero, `${path}/already-owned`, {
                  mode: 'choose',
                  title: child.grant.alreadyOwned,
                  options: [{ id: 'ack', label: 'Continua' }],
                  minimum: 1,
                  maximum: 1,
                  remaining: empty(),
                });
                invariant(
                  response.kind === 'physical-choice' && response.option === 'ack',
                  'Titolo già ottenuto senza conferma del messaggio fonte.',
                );
              } else
                this.awardTitle(child.hero, child.grant.cardId, `${path}/scenario-title`, path);
              break;
            case 'last-stand-one':
              invariant(
                this.combat &&
                  run.program.profile === 'source-fronts-v1' &&
                  run.program.deferFrontier &&
                  run.lastStandRules,
                'Obbligo P2 senza frontiera autorevole.',
              );
              this.lastStand.settle(run, [], { hero: child.hero, family: child.family }, true);
              break;
            case 'combat-addition':
              invariant(
                this.combat && child.outcome.sealed,
                'Aggiunta prima della chiusura della fonte.',
              );
              this.addition(child.hero, child.addition, child.outcome, path);
              break;
            case 'pay-attack-grant': {
              const clause = this.combat?.clauses.find(
                (c) =>
                  c.cardId === definitionId(child.copy) &&
                  c.window === 'after-attack-after-counterattack' &&
                  c.effect.op === 'granted-attack' &&
                  digest(c) === child.clauseHash,
              );
              invariant(
                clause?.effect.op === 'granted-attack' &&
                  this.lastStand.active(child.recipient) &&
                  this.nearby(child.hero, child.recipient),
                'Concessione senza costo, destinatario o fonte legali.',
              );
              this.payPrepared(child.hero, child.copy);
              for (let n = 0; n < clause.effect.inspiration; n++) this.inspiration(child.hero);
              break;
            }
            case 'attack-test':
              invariant(this.combat, 'Attacco senza finestre congelate.');
              this.result.successes = this.test(
                child.hero,
                child.stat,
                `${path}/attack-test`,
                false,
                false,
                null,
                child,
              );
              break;
            case 'enemy-attack': {
              invariant(
                this.combat &&
                  !child.outcome.sealed &&
                  !total(child.outcome.negated) &&
                  !total(child.outcome.prevented) &&
                  !total(child.outcome.suffered) &&
                  !child.outcome.childSources.length,
                'Esito nemico senza origine intatta.',
              );
              const outcome = structuredClone(child.outcome);
              this.result.enemyOutcome = outcome;
              this.directOutcome = outcome;
              this.suffer(
                child.hero,
                [
                  { family: 'damage', amount: outcome.offered.damage },
                  { family: 'fear', amount: outcome.offered.fear },
                ],
                'faceup',
                path,
                child.negate,
                true,
              );
              outcome.sealed = true;
              this.directOutcome = null;
              if (child.addition && this.additionEligible(child.hero, child.addition, outcome)) {
                const addition = child.addition,
                  result = this.result;
                const reaction = {
                  id: `addition:${index}`,
                  hero: child.hero,
                  label: 'Risolvi la conseguenza aggiuntiva dell’attacco',
                  available: () => this.lastStand.active(child.hero),
                  resolve: () => {
                    this.result = result;
                    this.addition(child.hero, addition, outcome, `${path}/addition`);
                  },
                };
                if (run.lastStandRules) reactions.push(reaction);
                else reaction.resolve();
              }
              break;
            }
            case 'darkness': {
              invariant(
                run.spatial &&
                  run.lastStandRules &&
                  this.p.version === 3 &&
                  new Set(child.heroes).size === child.heroes.length &&
                  child.heroes.every(
                    (n) =>
                      run.program.profile === 'source-fronts-v1' &&
                      run.program.darknessHeroes.includes(n),
                  ),
                'Oscurità senza contesto fonte e regole fisiche.',
              );
              const batches: { hero: number; suffered: number }[] = [];
              this.ordered(child.hero, `${path}/darkness`, child.heroes, (hero, orderPath) => {
                const suffered = this.suffer(
                  hero,
                  [{ family: 'fear', amount: child.amount }],
                  child.face,
                  orderPath,
                  child.negate,
                );
                if (this.liveGroups)
                  this.settleCollective(this.darknessReactions(hero, suffered, index, path));
                else batches.push({ hero, suffered });
              });
              for (const batch of batches)
                reactions.push(...this.darknessReactions(batch.hero, batch.suffered, index, path));
              break;
            }
            case 'inspiration':
              invariant(
                run.spatial && run.lastStandRules && this.p.version === 3,
                'Ricompensa fuori dal consumer fonte corrente.',
              );
              this.inspiration(child.hero);
              break;
            case 'group-suffer': {
              this.ordered(
                child.hero,
                `${path}/group-suffer`,
                child.heroes,
                (hero, orderPath) => {
                  this.suffer(
                    hero,
                    [{ family: child.family, amount: child.amount }],
                    child.face,
                    orderPath,
                    child.negate,
                  );
                  this.settleCollective();
                },
                true,
              );
              break;
            }
            case 'group-test': {
              this.result.tests = [];
              this.ordered(child.hero, `${path}/group-test`, child.heroes, (hero, orderPath) => {
                this.r.sourceTest = null;
                const input = this.ask(hero, `${orderPath}/reveal`, {
                  mode: 'choose',
                  title: `${STAT_LABELS[child.stat]} · difficoltà ${child.target}`,
                  options: [{ id: 'reveal', label: 'Rivela le carte della prova' }],
                  minimum: 1,
                  maximum: 1,
                  remaining: empty(),
                });
                invariant(
                  input.kind === 'physical-choice' && input.option === 'reveal',
                  'La prova fonte richiede il reveal.',
                );
                const successes = this.test(
                  hero,
                  child.stat,
                  `${orderPath}/source-test`,
                  false,
                  false,
                  child.target,
                );
                const outcome = successes >= child.target ? 'pass' : 'fail';
                this.result.tests!.push({
                  heroId: this.p.heroes[hero]!.heroId,
                  successes,
                  outcome,
                });
                if (outcome === 'fail')
                  this.suffer(
                    hero,
                    [{ family: child.failure.family, amount: child.failure.amount }],
                    child.failure.face,
                    `${orderPath}/failure`,
                  );
                this.settleCollective();
              });
              break;
            }
            case 'test': {
              this.r.sourceTest = null;
              const input = this.ask(child.hero, `${path}/reveal`, {
                mode: 'choose',
                title: `${STAT_LABELS[child.stat]}${child.target === null ? ' · conta i successi' : ` · difficoltà ${child.target}`}`,
                options: [{ id: 'reveal', label: 'Rivela le carte della prova' }],
                minimum: 1,
                maximum: 1,
                remaining: empty(),
              });
              invariant(
                input.kind === 'physical-choice' && input.option === 'reveal',
                'La prova fonte richiede il reveal.',
              );
              this.result.successes = this.test(
                child.hero,
                child.stat,
                `${path}/source-test`,
                false,
                false,
                child.target,
              );
              break;
            }
            case 'end-turn':
              this.endTurn(child.hero, path);
              break;
            case 'rally-reset':
              for (const [n, h] of this.resources.preparation.heroes.entries()) {
                if (!this.lastStand.active(n)) continue;
                h.deck = this.deckRandom(
                  `${path}/rally-${n}`,
                  [...h.deck, ...h.discard],
                  h.deck.length + h.discard.length,
                );
                h.discard = [];
              }
              break;
            case 'rally-scout':
              this.scout(child.hero, child.count, path, true);
              break;
            case 'suffer':
              this.suffer(child.hero, child.cards, child.face, path, child.negate);
              break;
            case 'flip':
              this.flip(child.hero, child.family, child.count, path);
              break;
            case 'turn-down':
              this.physicalSelection(
                child.hero,
                [child.family],
                'up',
                path,
                child.count,
                false,
                true,
              );
              break;
            case 'discard':
              this.physicalSelection(
                child.hero,
                child.families,
                'any',
                path,
                child.count,
                child.mode === 'upTo',
              );
              break;
            case 'search-recovery': {
              const effect = child.effect;
              const hero = this.hero(child.hero);
              if (!hero.deck.length && hero.discard.length) {
                hero.deck = this.deckRandom(
                  `${path}/skill-reset`,
                  hero.discard,
                  hero.discard.length,
                );
                hero.discard = [];
              }
              if (effect.kind === 'discard-physical')
                this.physicalSelection(child.hero, ['damage', 'fear'], 'any', path, effect.count);
              else if (effect.kind === 'scout-or-prepare') {
                const input = this.ask(child.hero, `${path}/effect`, {
                  mode: 'choose',
                  title: `Scegli: Scoperta ${effect.count} oppure prepara una carta dagli scarti.`,
                  options: [
                    { id: 'scout', label: `Scoperta ${effect.count}` },
                    { id: 'prepare-discard', label: 'Prepara una carta dagli scarti' },
                  ],
                  minimum: 1,
                  maximum: 1,
                  remaining: empty(),
                });
                invariant(
                  input.kind === 'physical-choice' &&
                    ['scout', 'prepare-discard'].includes(input.option),
                  'Conseguenza ricerca senza scelta fonte.',
                );
                if (input.option === 'scout') this.scout(child.hero, effect.count, `${path}/scout`);
                else this.prepareDiscard(child.hero, `${path}/prepare-discard`);
              } else this.scout(child.hero, effect.count, path, false, effect.kind === 'scout');
              break;
            }
            case 'scout':
              this.scout(child.hero, child.count, path);
              break;
            case 'event':
              if (run.lastStandRules && child.event === 'after-darkness-suffering-batch') {
                const result = this.result;
                for (const [n, effect] of this.eventEffects(
                  child.hero,
                  child.event,
                  child.sufferedFear,
                ).entries())
                  reactions.push({
                    id: `reaction:${index}:${n}`,
                    hero: child.hero,
                    label: `Risolvi ${this.cards.get(effect.copy)!.name.value}`,
                    available: () =>
                      this.faceup.has(effect.copy) &&
                      this.lastStand.active(effect.owner) &&
                      this.lastStand.active(child.hero),
                    resolve: () => {
                      this.result = result;
                      this.eventEffect(child.hero, effect, `${path}/trigger-${n}`, child.threat);
                    },
                  });
              } else this.event(child.hero, child.event, path, child.threat, child.sufferedFear);
              break;
          }
          parent.completedChildren++;
        }
        this.child = run.program.children.length;
        let lastStandEnabled = !!run.lastStandRules;
        if (!lastStandEnabled)
          for (let hero = 0; hero < this.p.heroes.length; hero++) {
            const limits = this.limits(hero);
            const family = (['damage', 'fear'] as const).find(
              (f) => this.s.areas[hero]![f].length >= limits[f],
            );
            if (!family) continue;
            const active: PhysicalActive = {
              ...this.base(hero),
              kind: 'gate',
              reason: 'last-stand-unavailable',
              remaining: empty(),
              family,
              capability: 'P2:last-stand',
            };
            if (!run.answers[this.answer])
              this.gate(hero, 'last-stand-unavailable', empty(), family, 'P2:last-stand');
            const input = this.read(active);
            invariant(
              input.kind === 'physical-continue-last-stand' && this.p.lastStand,
              'Il pending storico richiede una continuazione P2 esplicita e verificata.',
            );
            lastStandEnabled = true;
            break;
          }
        if (
          lastStandEnabled &&
          !(run.program.profile === 'source-fronts-v1' && run.program.deferFrontier)
        ) {
          for (const [hero, limit] of run.program.limits.entries())
            if (
              limit.kind === 'requires-capability' &&
              limit.capability !== 'source-derived' &&
              (this.s.areas[hero]!.damage.length || this.s.areas[hero]!.fear.length)
            )
              this.gate(hero, 'effective-limits-unavailable', empty(), null, limit.capability);
          this.lastStand.settle(
            run.lastStandRules
              ? run
              : {
                  ...run,
                  lastStandRules: {
                    version: 'source-last-stand-v1',
                    artifactFingerprint: this.p.lastStand!.fingerprint,
                  },
                },
            reactions,
          );
          if (this.s.lastStand?.terminal)
            this.gate(
              this.p.heroes.findIndex((h) => h.heroId === this.s.lastStand!.terminal!.heroId),
              'adventure-loss-consumer-unavailable',
            );
        }
        parent.status = 'completed';
        parent.returnCount = 1;
      } catch (e) {
        if (e !== paused) throw e;
      }
      invariant(this.answer === run.answers.length, 'Risposte oltre la continuazione fonte.');
    }
    this.r.faceup = [...this.faceup];
    this.s.rngCursor = this.rng.cursor;
    return this.s;
  }
}
