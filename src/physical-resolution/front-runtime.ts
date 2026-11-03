import { validatePhysicalProgram } from './program';
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
import { LastStandRuntime } from './last-stand-runtime';
import { validateLastStandArtifact } from './last-stand-program';

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
  private readonly s: PhysicalSnapshot;
  private readonly seenRequests = new Set<string>();
  private readonly seenPending = new Set<string>();
  private previousRevision = -1;
  private run!: Run;
  private child = 0;
  private answer = 0;
  private result!: PhysicalSnapshot['parents'][number]['results'][number];
  constructor(private readonly p: Omit<PhysicalState, 'snapshot'>) {
    invariant(p.version !== 1 && p.fronts, 'Runtime fronti senza freeze versione2.');
    validateFrontArtifact(p.raw, p.fronts.artifact, p.fronts.catalog);
    this.rng = new PhysicalRandom(p.entropy);
    this.s = {
      decks: { damage: [], fear: [] },
      areas: p.heroes.map((h) => ({ heroId: h.heroId, damage: [], fear: [] })),
      credits: [],
      rngCursor: 0,
      random: [],
      parents: [],
      active: null,
      resolution: {
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
  private get artifact() {
    return this.p.fronts!.artifact;
  }
  private get catalog() {
    return this.p.fronts!.catalog;
  }
  private random(id: string, population: string[], n: number) {
    const indices = this.rng.permutation(population.length).slice(0, n);
    this.s.random.push({ id, population: [...population], indices });
    return indices.map((i) => population[i]!);
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
    const answer = this.run.answers[this.answer];
    if (!answer) {
      this.s.active = active;
      throw paused;
    }
    const e = answer.evidence;
    invariant(
      answer.cursor === active.cursor &&
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
    options: { id: string; label: string }[],
  ) {
    invariant(options.length > 0, 'Scelta senza alternative lecite.');
    if (options.length === 1) return options[0]!.id;
    const input = this.ask(hero, path, {
      mode: 'choose',
      title,
      options,
      minimum: 1,
      maximum: 1,
      remaining: empty(),
    });
    invariant(
      input.kind === 'physical-choice' && options.some((o) => o.id === input.option),
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
    const h = resources.preparation.heroes[hero]!,
      sources = [h.heroId, ...h.prepared, ...h.itemCopies];
    return sources.flatMap((copy) => {
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
  }
  private persist(hero: number): { copy: string; effect: PersistentOp }[] {
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
      (
        scope === 'self'
          ? n === hero
          : scope === 'each-other-hero-any-distance'
            ? n !== hero
            : scope === 'self-and-each-nearby'
              ? n === hero || this.nearby(hero, n)
              : this.nearby(hero, n)
      )
        ? [n]
        : [],
    );
  }
  private ordered(
    hero: number,
    path: string,
    targets: number[],
    f: (n: number, path: string) => void,
  ) {
    const left = [...targets];
    while (left.length) {
      const selected = Number(
        this.choose(
          hero,
          `${path}/order-${left.length}`,
          'Scegli l’eroe da risolvere per primo.',
          left.map((n) => ({
            id: String(n),
            label: this.catalog.heroes.find((h) => h.id === this.hero(n).heroId)!.name.text,
          })),
        ),
      );
      left.splice(left.indexOf(selected), 1);
      f(selected, `${path}/hero-${selected}`);
    }
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
      (other ? n !== hero : n === hero)
        ? h.itemCopies
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
          h.deck = this.random(
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
      this.catalog.skills.find((s) => s.id === definitionId(copy))?.name.text ??
      this.titleCard(copy)!.name.value
    );
  }
  private titleCard(copy: string) {
    const id = definitionId(copy);
    if (!this.p.lastStand?.titles.some((t) => t.cardId === id)) return undefined;
    return requirePhysicalFamily(this.p.raw, 'title').cards.find((c) => c.id === id);
  }
  private skillSymbols(copy: string) {
    const skill = this.catalog.skills.find((s) => s.id === definitionId(copy));
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
      if (e.op === 'after-prepare-flip-fear')
        this.physicalSelection(
          hero,
          ['fear'],
          'up',
          this.run.spatial ? `${path}/effect-${n}` : `${path}/prepare-flip`,
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
    let closed = false,
      step = 0;
    while (left.length || !closed) {
      const rests = closed
        ? []
        : this.policy(hero).filter(
            ({ copy, effect: e }) => e.op === 'rest' && this.hero(hero).prepared.includes(copy),
          );
      const options = [
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
        ...(!closed && rests.length ? [{ id: 'close-rest', label: 'Non usare altro Riposo' }] : []),
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
  ) {
    this.frame(
      path,
      hero,
      null,
      'suffer',
      cards.reduce((n, c) => n + c.amount, 0),
      () => {
        const remaining = empty();
        for (const c of cards) remaining[c.family] = c.amount;
        if (negate && total(remaining)) {
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
                  e.op === 'fear-facedown' &&
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
                      cost: 'Consuma 1 segnalino del monile',
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
                label: `${this.catalog.heroes.find((h) => h.id === this.hero(o.actor).heroId)!.name.text} · ${o.copy.includes(':') ? (this.catalog.skills.find((s) => s.id === definitionId(o.copy))?.name.text ?? this.catalog.items.find((i) => i.id === definitionId(o.copy))?.name.text) : o.copy} · ${o.cost}`,
              })),
            ],
          );
          if (selected === 'close') break;
          const offer = offers.find((o) => o.id === selected)!;
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
                if ((c.family === 'fear' ? faceFear : face) === 'faceup')
                  this.front(hero, copy, `${path}/front-${this.r.operations}`);
              },
            );
          }
      },
    );
  }
  private reveal(hero: number, count: number, path: string) {
    const h = this.hero(hero),
      cards: string[] = [];
    for (let i = 0; i < count; i++) {
      if (!h.deck.length && h.discard.length) {
        h.deck = this.random(`${path}/refill-${i}`, h.discard, h.discard.length);
        h.discard = [];
      }
      const copy = h.deck.shift();
      if (!copy) break;
      cards.push(copy);
      if (!h.deck.length && h.discard.length) {
        h.deck = this.random(`${path}/post-refill-${i}`, h.discard, h.discard.length);
        h.discard = [];
      }
    }
    return cards;
  }
  private scout(hero: number, count: number, path: string, rally = false) {
    this.frame(path, hero, null, 'scout', count, () => {
      const h = this.hero(hero),
        cards = this.reveal(hero, count, path);
      if (!cards.length) return;
      this.r.revealed.push({ heroId: h.heroId, cards: [...cards] });
      const input = this.ask(hero, `${path}/arrange`, {
        ...(this.run.spatial
          ? {
              scoutTopAllowed:
                !rally ||
                !this.persist(hero).some(({ effect: e }) => e.op === 'prohibit-scout-top'),
            }
          : {}),
        mode: 'scout',
        title: `Scoperta ${count}: prepara al massimo una carta e ordina le altre.`,
        options: cards.map((id) => ({ id, label: this.skillName(id) })),
        minimum: 0,
        maximum: cards.length,
        remaining: empty(),
      });
      invariant(input.kind === 'physical-scout', 'Scoperta richiede una disposizione.');
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
      h.deck = [...input.top, ...h.deck, ...input.bottom];
      this.r.revealed.pop();
      if (input.prepare && (this.run.spatial || h.prepared.includes(input.prepare)))
        this.afterPrepare(hero, input.prepare, path);
    });
  }
  private test(
    hero: number,
    stat: 'might' | 'wisdom' | 'agility' | 'spirit' | 'wit',
    path: string,
    negate = false,
    lastStand = false,
  ): number {
    return this.frame(path, hero, null, 'test', 0, () => {
      const h = this.hero(hero),
        definition = this.catalog.heroes.find((h) => h.id === this.hero(hero).heroId)!;
      const modifier =
        this.persist(hero).reduce(
          (n, { effect: e }) => n + (e.op === 'stat-modifier' ? e.n : 0),
          0,
        ) +
        this.policy(hero).reduce(
          (n, { effect: e }) => n + (e.op === 'stat' && e.stat === stat ? e.n : 0),
          0,
        );
      const cards = this.reveal(hero, Math.max(1, definition.stats[stat] + modifier), path);
      this.r.revealed.push({ heroId: h.heroId, cards: [...cards] });
      let successes = cards.reduce((n, c) => n + this.skillSymbols(c).success, 0),
        fate = cards.reduce((n, c) => n + this.skillSymbols(c).fate, 0),
        n = 0,
        spentTrigger = false;
      const printed = successes;
      successes += this.persist(hero).reduce(
        (n, { effect: e }) => n + (e.op === 'add-success' && e.stats.includes(stat) ? e.n : 0),
        0,
      );
      if (negate)
        successes += this.policy(hero).reduce(
          (n, { effect: e }) => n + (e.op === 'negate-bonus' ? e.n : 0),
          0,
        );
      while (true) {
        const abilities = this.policy(hero).filter(
          ({ effect: e }) =>
            (e.op === 'convert-all' && fate > 0 && (!e.noPrintedSuccess || !printed)) ||
            (e.op === 'convert-one-scout' && fate > 0) ||
            (e.op === 'convert-pair-alone' &&
              fate >= 2 &&
              !this.scope(hero, 'each-nearby-excluding-self').length),
        );
        const options = [
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
        ];
        const title = `Prova: ${cards.map((c) => this.skillName(c)).join(', ')}. ${successes} successi.`;
        const decisionPath = `${path}/convert-${n++}`;
        let selected: string;
        if (lastStand) {
          const input = this.ask(hero, decisionPath, {
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
        if (selected === 'inspiration') {
          h.inspiration--;
          fate--;
          successes++;
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
            fate -= 2;
            successes++;
          } else if (
            ability.effect.op === 'convert-all' ||
            ability.effect.op === 'convert-one-scout'
          ) {
            h.prepared.splice(h.prepared.indexOf(selected), 1);
            h.discard.push(selected);
            const converted = ability.effect.op === 'convert-all' ? fate : 1;
            successes += converted;
            fate -= converted;
            if (ability.effect.scout)
              this.scout(hero, ability.effect.scout, `${path}/conversion-scout-${n}`);
          }
        }
      }
      this.r.revealed.pop();
      h.discard.push(...cards);
      return successes;
    });
  }
  private event(hero: number, event: string, path: string, threat: boolean, sufferedFear: number) {
    const effects = this.p.heroes.flatMap((_, owner) =>
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
      const { copy, effect: e, owner } = effects[n]!;
      if (!this.faceup.has(copy)) continue;
      if (e.op === 'self-flip-down') this.down(copy);
      if (e.op === 'suffer')
        this.suffer(
          e.hero === 'self' ? owner : hero,
          [{ family: e.family, amount: e.n }],
          'faceup',
          `${path}/trigger-${n}`,
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
          this.choose(owner, `${path}/optional-${n}`, 'Puoi scartare questa carta.', [
            { id: 'keep', label: 'Conserva la carta' },
            { id: 'discard', label: 'Scarta la carta' },
          ]) === 'discard'
        )
          this.discard(copy, owner);
    }
    if (event === 'rally-scout') this.scout(hero, 2, `${path}/rally`, true);
  }
  replay() {
    const sources = new Set<string>(),
      runIds = new Set<string>();
    for (const run of this.p.runs) {
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
      sources.add(run.source.effectId);
      runIds.add(run.id);
      this.run = run;
      this.answer = 0;
      if (run.spatial)
        invariant(
          this.p.version === 3 &&
            digest(run.spatial.heroes.map(({ heroId, playerId }) => ({ heroId, playerId }))) ===
              digest(this.p.heroes.map(({ heroId, playerId }) => ({ heroId, playerId }))),
          'Contesto spaziale di un’altra compagnia o versione.',
        );
      const context = FrontResourcesSchema.parse(run.context);
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
          !context.depletion.length && !context.boons.length,
          'Acquisizioni di accessori e benefici richiedono un consumer fonte dedicato.',
        );
      }
      this.r.resources = structuredClone(context);
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
          switch (child.kind) {
            case 'end-turn':
              this.endTurn(child.hero, path);
              break;
            case 'rally-reset':
              for (const [n, h] of this.resources.preparation.heroes.entries()) {
                h.deck = this.random(
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
            case 'scout':
              this.scout(child.hero, child.count, path);
              break;
            case 'event':
              this.event(child.hero, child.event, path, child.threat, child.sufferedFear);
              break;
          }
          parent.completedChildren++;
        }
        this.child = run.program.children.length;
        if (run.lastStandRules) {
          this.lastStand.settle(run);
          if (this.s.lastStand?.terminal) this.gate(0, 'adventure-loss-consumer-unavailable');
        } else
          for (let hero = 0; hero < this.p.heroes.length; hero++) {
            const limits = this.limits(hero);
            for (const family of ['damage', 'fear'] as const)
              if (this.s.areas[hero]![family].length >= limits[family])
                this.gate(hero, 'last-stand-unavailable', empty(), family, 'P2:last-stand');
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
