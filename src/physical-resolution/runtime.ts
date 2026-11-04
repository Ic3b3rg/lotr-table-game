import { validatePhysicalProgram } from './program';
export { validatePhysicalProgram } from './program';
import { replayFronts } from './front-runtime';
import { validateFrontArtifact } from './front-program';
import { validateBoonArtifact } from './boon-program';
import type { BoonArtifact } from '../shared/boons';
import { validateLastStandArtifact, type LastStandArtifact } from './last-stand-program';
import type { FrontResources } from './front-state';
import type { z } from 'zod';
import type { FrozenFrontsSchema } from './front-state';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  PhysicalInputSchema,
  PhysicalProgramSchema,
  type PhysicalCounts,
  type PhysicalActive,
  type PhysicalProgram,
} from '../shared/physical';
import { requirePhysicalFamily } from '../physical-content/catalog';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';
import {
  PhysicalStateSchema,
  PhysicalBindingSchema,
  PhysicalHeroSchema,
  PhysicalSourceSchema,
  PhysicalEvidenceSchema,
  type PhysicalState,
  type PhysicalSource,
  type PhysicalSnapshot,
  type PhysicalEvidence,
  type PhysicalHero,
} from './model';
import { PhysicalRandom } from './random';

const empty = (): PhysicalCounts => ({ damage: 0, fear: 0 });
const total = (n: PhysicalCounts) => n.damage + n.fear;
export function physicalFamilies(raw: unknown) {
  const damage = requirePhysicalFamily(raw, 'damage'),
    fear = requirePhysicalFamily(raw, 'fear');
  const all = [...damage.cards, ...fear.cards].flatMap((c) => c.copies.map((copy) => copy.id));
  invariant(new Set(all).size === 56, 'Copie fisiche globali non uniche.');
  return { damage, fear };
}
export function replayPhysical(p: Omit<PhysicalState, 'snapshot'>): PhysicalSnapshot {
  if (p.version !== 1) return replayFronts(p);
  invariant(p.runs.length <= 32, 'Budget padri P0 superato.');
  invariant(
    !p.fronts &&
      !p.boons &&
      !p.lastStand &&
      !p.lastStandActivation &&
      p.runs.every((r) => !r.context && r.program.profile === 'synthetic-no-abilities-v1'),
    'Dati fronti in un runtime P0.',
  );
  const families = physicalFamilies(p.raw);
  invariant(digest(families) === p.contentFingerprint, 'Contenuto fisico congelato modificato.');
  invariant(
    new Set(p.heroes.map((h) => h.heroId)).size === p.heroes.length,
    'Eroi fisici duplicati.',
  );
  const rng = new PhysicalRandom(p.entropy);
  const snapshot: PhysicalSnapshot = {
    decks: { damage: [], fear: [] },
    areas: p.heroes.map((h) => ({ heroId: h.heroId, damage: [], fear: [] })),
    credits: [],
    rngCursor: 0,
    random: [],
    parents: [],
    active: null,
  };
  const select = (id: string, population: string[], count: number) => {
    const indices = rng.permutation(population.length).slice(0, count);
    snapshot.random.push({ id, population: [...population], indices });
    return indices.map((n) => population[n]!);
  };
  for (const family of ['damage', 'fear'] as const) {
    const copies = families[family].cards.flatMap((c) => c.copies.map((copy) => copy.id));
    snapshot.decks[family] = select(`initialize:${family}`, copies, copies.length);
  }
  const requestIds = new Set<string>(),
    pendingIds = new Set<string>(),
    sources = new Set<string>(),
    runIds = new Set<string>();
  let previousRevision = -1;
  for (const run of p.runs) {
    invariant(
      !snapshot.active && !sources.has(run.source.effectId) && !runIds.has(run.id),
      'Padre fisico concorrente o duplicato.',
    );
    sources.add(run.source.effectId);
    runIds.add(run.id);
    const pr = run.program;
    invariant(pr.profile === 'synthetic-no-abilities-v1', 'Profilo P0 cambiato.');
    validatePhysicalProgram(pr, p.heroes.length);
    snapshot.credits = [...pr.initialCredits];
    const parent: PhysicalSnapshot['parents'][number] = {
      id: run.id,
      source: run.source.effectId,
      status: 'waiting',
      completedChildren: 0,
      totalChildren: pr.children.length,
      returnCount: 0,
      results: [],
    };
    snapshot.parents.push(parent);
    let answerIndex = 0;
    const read = (active: PhysicalActive) => {
      const a = run.answers[answerIndex];
      if (!a) {
        snapshot.active = active;
        return null;
      }
      invariant(
        a.child === active.child &&
          a.grant === (active.kind === 'prevent' ? active.grant : null) &&
          a.evidence.playerId === active.actorPlayerId &&
          !pendingIds.has(a.evidence.pendingId) &&
          !requestIds.has(`${a.evidence.playerId}:${a.evidence.requestId}`) &&
          a.evidence.revision > previousRevision,
        'Risposta fisica fuori dalla richiesta/actor/cursore.',
      );
      pendingIds.add(a.evidence.pendingId);
      requestIds.add(`${a.evidence.playerId}:${a.evidence.requestId}`);
      previousRevision = a.evidence.revision;
      answerIndex++;
      return a.input;
    };
    const gate = (
      base: Omit<
        Extract<PhysicalActive, { kind: 'gate' }>,
        'kind' | 'reason' | 'family' | 'capability'
      >,
      reason: Extract<PhysicalActive, { kind: 'gate' }>['reason'],
      family: 'damage' | 'fear' | null = null,
      capability: string | null = null,
    ) => {
      snapshot.active = { ...base, kind: 'gate', reason, family, capability };
      parent.status = 'suspended';
    };
    for (const [index, child] of pr.children.entries()) {
      const hero = p.heroes[child.hero]!,
        area = snapshot.areas[child.hero]!;
      const base = {
        runId: run.id,
        child: index,
        heroId: hero.heroId,
        actorHeroId: hero.heroId,
        actorPlayerId: hero.playerId,
      };
      const result: PhysicalSnapshot['parents'][number]['results'][number] = {
        child: index,
        kind: child.kind,
        heroId: hero.heroId,
        prevented: empty(),
        transferred: empty(),
        returned: empty(),
        costs: [],
      };
      if (child.kind === 'suffer') {
        const remaining = empty();
        child.cards.forEach((c) => {
          remaining[c.family] = c.amount;
        });
        if (total(remaining) && child.face !== 'facedown') {
          gate({ ...base, remaining }, 'faceup-handler-unavailable');
          break;
        }
        const limits = pr.limits[child.hero]!;
        if (total(remaining) && limits.kind === 'requires-capability') {
          gate({ ...base, remaining }, 'effective-limits-unavailable', null, limits.capability);
          break;
        }
        for (const [n, g] of child.prevention.entries()) {
          const actor = p.heroes[g.actor]!;
          const eligible =
            total(remaining) > 0 &&
            g.budget > 0 &&
            snapshot.credits[g.actor]! >= g.creditCost &&
            (!g.sameSpace || actor.spaceId === hero.spaceId);
          if (!eligible) continue;
          const input = read({
            ...base,
            kind: 'prevent',
            grant: n,
            authorizationId: g.id,
            actorHeroId: actor.heroId,
            actorPlayerId: actor.playerId,
            budget: g.budget,
            creditCost: g.creditCost,
            remaining: { ...remaining },
          });
          if (!input) break;
          invariant(
            input.kind === 'physical-prevent' &&
              total(input) <= g.budget &&
              input.damage <= remaining.damage &&
              input.fear <= remaining.fear,
            'Allocazione di prevenzione non legale.',
          );
          if (total(input)) {
            snapshot.credits[g.actor]! -= g.creditCost;
            result.costs.push({
              actorHeroId: actor.heroId,
              authorizationId: g.id,
              credits: g.creditCost,
            });
          }
          for (const family of ['damage', 'fear'] as const) {
            result.prevented[family] += input[family];
            remaining[family] -= input[family];
          }
        }
        if (snapshot.active) break;
        for (const c of child.cards) {
          while (remaining[c.family] > 0) {
            const copy = snapshot.decks[c.family].shift();
            if (!copy) {
              gate({ ...base, remaining: { ...remaining } }, 'required-deck-empty', c.family);
              break;
            }
            area[c.family].push(copy);
            remaining[c.family]--;
            result.transferred[c.family]++;
          }
          if (snapshot.active) break;
        }
        // Partial transfers and accepted costs remain evidence at an empty-deck suspension.
        if (snapshot.active) {
          parent.results.push(result);
          break;
        }
      } else {
        const available = empty();
        child.families.forEach((f) => {
          available[f] = area[f].length;
        });
        const maximum = Math.min(child.count, total(available)),
          minimum = child.mode === 'exact' ? maximum : 0;
        let allocation = empty();
        if (
          maximum &&
          (child.mode === 'upTo' || (child.families.length > 1 && maximum < total(available)))
        ) {
          const input = read({
            ...base,
            kind: 'discard',
            available,
            count: maximum,
            minimum,
            families: child.families,
          });
          if (!input) break;
          invariant(
            input.kind === 'physical-discard' &&
              total(input) >= minimum &&
              total(input) <= maximum &&
              input.damage <= available.damage &&
              input.fear <= available.fear,
            'Allocazione di scarto non legale.',
          );
          allocation = { damage: input.damage, fear: input.fear };
        } else {
          let left = maximum;
          for (const family of child.families) {
            allocation[family] = Math.min(left, available[family]);
            left -= allocation[family];
          }
        }
        for (const family of child.families) {
          const n = allocation[family];
          if (!n) continue;
          const selected = select(`${run.id}:${index}:discard:${family}`, area[family], n),
            chosen = new Set(selected);
          area[family] = area[family].filter((copy) => !chosen.has(copy));
          snapshot.decks[family].push(...selected);
          result.returned[family] = selected.length;
        }
      }
      parent.results.push(result);
      parent.completedChildren++;
    }
    invariant(answerIndex === run.answers.length, 'Risposte fisiche oltre il cursore.');
    if (!snapshot.active) {
      for (const [n, h] of p.heroes.entries()) {
        const limit = pr.limits[n]!,
          area = snapshot.areas[n]!;
        const barrier = {
          runId: run.id,
          child: pr.children.length,
          heroId: h.heroId,
          actorHeroId: h.heroId,
          actorPlayerId: h.playerId,
          remaining: empty(),
        };
        if (limit.kind === 'requires-capability' && (area.damage.length || area.fear.length)) {
          gate(barrier, 'effective-limits-unavailable', null, limit.capability);
          break;
        }
        if (limit.kind === 'synthetic-fixed') {
          const family =
            area.damage.length >= limit.damage
              ? 'damage'
              : area.fear.length >= limit.fear
                ? 'fear'
                : null;
          if (family) {
            gate(barrier, 'last-stand-unavailable', family);
            break;
          }
        }
      }
      if (!snapshot.active) {
        parent.status = 'completed';
        parent.returnCount = 1;
      }
    }
  }
  snapshot.rngCursor = rng.cursor;
  return snapshot;
}
export function freezePhysical(
  raw: unknown,
  binding: PhysicalState['binding'],
  heroes: PhysicalHero[],
  entropy = randomBytes(32).toString('hex'),
  rawSha256 = digest(raw),
  fronts?: z.infer<typeof FrozenFrontsSchema>,
  lastStand?: LastStandArtifact,
  boons?: BoonArtifact,
): PhysicalState {
  const families = physicalFamilies(raw);
  if (fronts) validateFrontArtifact(raw, fronts.artifact, fronts.catalog);
  if (boons) {
    invariant(fronts, 'Benefici senza consumer fronti.');
    validateBoonArtifact(raw, boons);
  }
  if (lastStand) {
    invariant(fronts, 'Ultimo Sforzo richiede risorse e fronti verificati.');
    validateLastStandArtifact(raw, lastStand);
  }
  const base = {
    version: fronts ? (2 as const) : (1 as const),
    ...(fronts ? { fronts } : {}),
    ...(boons ? { boons: structuredClone(boons) } : {}),
    ...(lastStand
      ? {
          lastStand: structuredClone(lastStand),
          lastStandActivation: { kind: 'initial-freeze' as const },
        }
      : {}),
    algorithm: 'sha256-counter-rejection-fisher-yates-v1' as const,
    raw: structuredClone(raw),
    rawSha256,
    contentFingerprint: digest(families),
    binding: PhysicalBindingSchema.parse(binding),
    heroes: heroes.map((h) => PhysicalHeroSchema.parse(h)),
    entropy,
    runs: [],
  };
  return PhysicalStateSchema.parse({ ...base, snapshot: replayPhysical(base) });
}
export function openPhysical(
  p: PhysicalState,
  source: PhysicalSource,
  program: PhysicalProgram,
  context?: FrontResources,
  spatial?: PhysicalState['runs'][number]['spatial'],
  runId: string = randomUUID(),
  enableLastStand = true,
) {
  validatePhysical(p);
  validatePhysicalProgram(program, p.heroes.length);
  const copy = structuredClone(p),
    id = runId;
  copy.runs.push({
    id,
    source: PhysicalSourceSchema.parse(source),
    program: PhysicalProgramSchema.parse(program),
    ...(p.boons ? { boonRules: p.boons.fingerprint } : {}),
    // Unmarked, non-spatial version2 runs retain their published replay rules.
    // Ordinary spatial runs already identify the version3 continuation rules.
    ...(p.version === 2 ? { executionRules: 'retained-paid-effects-v1' as const } : {}),
    ...(p.lastStand && enableLastStand
      ? {
          lastStandRules: {
            version: p.lastStand.rules,
            artifactFingerprint: p.lastStand.fingerprint,
          },
        }
      : {}),
    answers: [],
    ...(context ? { context } : {}),
    ...(spatial ? { spatial } : {}),
  });
  copy.snapshot = replayPhysical(copy);
  Object.assign(p, PhysicalStateSchema.parse(copy));
  return id;
}
export function answerPhysical(
  p: PhysicalState,
  runId: string,
  input: unknown,
  evidence: PhysicalEvidence,
  lastStand?: LastStandArtifact,
) {
  validatePhysical(p);
  const q = p.snapshot.active;
  const answer = PhysicalInputSchema.parse(input);
  invariant(
    q &&
      q.runId === runId &&
      (q.kind !== 'gate' ||
        (p.version !== 1 &&
          q.reason === 'last-stand-unavailable' &&
          answer.kind === 'physical-continue-last-stand')),
    'Richiesta fisica non disponibile.',
  );
  const copy = structuredClone(p),
    run = copy.runs.find((r) => r.id === runId)!;
  if (lastStand) {
    invariant(
      answer.kind === 'physical-continue-last-stand' && !copy.lastStand,
      'Freeze Ultimo Sforzo fuori dalla continuazione.',
    );
    validateLastStandArtifact(copy.raw, lastStand);
    copy.lastStand = structuredClone(lastStand);
    copy.lastStandActivation = { kind: 'legacy-continuation', runId };
  }
  run.answers.push({
    ...(q.kind === 'decision' ? { cursor: q.cursor } : {}),
    child: q.child,
    grant: q.kind === 'prevent' ? q.grant : null,
    input: answer,
    evidence: PhysicalEvidenceSchema.parse(evidence),
  });
  copy.snapshot = replayPhysical(copy);
  Object.assign(p, PhysicalStateSchema.parse(copy));
}
export function validatePhysical(raw: unknown): asserts raw is PhysicalState {
  const p = PhysicalStateSchema.parse(raw);
  invariant(
    digest(replayPhysical(p)) === digest(p.snapshot),
    'Stato fisico non coerente con fonte, costi, copie e casualità.',
  );
}
