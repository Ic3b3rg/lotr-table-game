import type { Catalog } from '../shared/catalog';
import { definitionId } from '../shared/preparation';
import type { BeforeEffect } from '../shared/interaction-look';
import type { FrontArtifact } from './front-program';
import type { FrontResources } from './front-state';
import { requirePhysicalFamily } from '../physical-content/catalog';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';
import type { PhysicalState } from './model';
import type { Preparation } from '../shared/preparation';

/** An explicit reviewed coverage table, never detection from translated prose. */
export function requireInteractionCoverage(
  artifact: FrontArtifact,
  catalog: Catalog,
  heroIds: string[],
) {
  const coverage = artifact.interactionLook;
  invariant(coverage, 'Copertura prima di interagire non congelata.');
  invariant(
    new Set(coverage.heroes.map((h) => h.heroId)).size === coverage.heroes.length,
    'Copertura eroi duplicata.',
  );
  for (const heroId of heroIds) {
    const entry = coverage.heroes.find((h) => h.heroId === heroId);
    const hero = catalog.heroes.find((h) => h.id === heroId);
    const policies = artifact.policies.filter((p) => p.id === heroId && p.kind === 'hero');
    const looks = policies.flatMap((p) => p.effects).filter((e) => e.op === 'before-interact-look');
    invariant(
      entry &&
        hero &&
        entry.definitionHash === digest(hero) &&
        (entry.capability === 'look' ? looks.length === 1 : looks.length === 0),
      'Capacità prima di interagire assente o diversa dalla definizione corrente.',
    );
  }
}

/** All inputs here are known resources and faceup effects. No deck identity or fate read. */
export function beforeInteractionEffects(
  raw: unknown,
  artifact: FrontArtifact,
  catalog: Catalog,
  resources: FrontResources,
  area: { heroId: string; damage: string[]; fear: string[] },
  faceup: string[],
  threat: boolean,
): BeforeEffect[] {
  const h = resources.preparation.heroes.find((h) => h.heroId === area.heroId)!;
  requireInteractionCoverage(artifact, catalog, [h.heroId]);
  const effects: BeforeEffect[] = [];
  const sources = [
    ...new Set([
      h.heroId,
      ...h.prepared,
      ...h.itemCopies,
      ...(resources.itemCustody ?? []).filter((c) => c.heroId === h.heroId).map((c) => c.copy),
    ]),
  ];
  for (const [n, copy] of sources.entries()) {
    if (resources.depletion.some((d) => d.copy === copy && !d.remaining)) continue;
    const id = copy === h.heroId ? copy : definitionId(copy);
    const policy = artifact.policies.find((p) => p.id === id);
    for (const [index, effect] of (policy?.effects ?? []).entries()) {
      if (effect.op === 'before-interact-look') {
        invariant(copy === h.heroId && policy!.kind === 'hero', 'Look senza policy eroe.');
        effects.push({
          id: `policy:${n}:${index}`,
          kind: 'look',
          label: 'Guarda la carta superiore · premio fato',
        });
      } else if (effect.op === 'before-interact-inspiration')
        effects.push({
          id: `policy:${n}:${index}`,
          kind: 'inspiration',
          label: 'Ottieni 1 ispirazione · effetto garantito',
        });
    }
  }
  const cards = [
    ...requirePhysicalFamily(raw, 'damage').cards,
    ...requirePhysicalFamily(raw, 'fear').cards,
  ];
  for (const [n, copy] of [...area.damage, ...area.fear].entries()) {
    if (!faceup.includes(copy)) continue;
    const card = cards.find((c) => c.copies.some((c) => c.id === copy))!;
    const definition = artifact.definitions.find((d) => d.cardId === card.id)!;
    for (const [index, effect] of definition.persistent.entries()) {
      if (effect.window !== 'before-interact') continue;
      invariant(effect.op === 'mandatory-spend', 'Effetto prima non supportato.');
      if (threat)
        effects.push({
          id: `cost:${n}:${index}`,
          kind: 'spend',
          label: `${card.name.value} · spendi 1 ispirazione`,
        });
    }
  }
  return effects;
}

export function afterKnownEffect(effect: BeforeEffect, inspiration: number, cap: number) {
  return effect.kind === 'spend'
    ? inspiration - 1
    : effect.kind === 'inspiration'
      ? Math.min(cap, inspiration + 1)
      : inspiration;
}

/** A guaranteed completion exists without borrowing any conditional hidden reward. */
export function beforeOrderFeasible(effects: BeforeEffect[], inspiration: number, cap: number) {
  if (inspiration < 0) return false;
  let spends = effects.filter((e) => e.kind === 'spend').length;
  let gains = effects.filter((e) => e.kind === 'inspiration').length;
  while (spends) {
    if (inspiration > 0) {
      inspiration--;
      spends--;
    } else if (gains > 0 && cap > 0) {
      inspiration = Math.min(cap, inspiration + 1);
      gains--;
    } else return false;
  }
  return true;
}

/** One known-resource gate for both the command preflight and common UI offers. */
export function beforeInteractionProblem(
  p: PhysicalState,
  heroId: string,
  threat: boolean,
  preparation?: Preparation,
) {
  try {
    const resources = p.snapshot.resolution?.resources ?? {
      preparation: preparation ?? p.cycle!.seed.preparation!,
      depletion: [],
      boons: [],
    };
    const effects = beforeInteractionEffects(
      p.raw,
      p.fronts!.artifact,
      p.fronts!.catalog,
      resources,
      p.snapshot.areas.find((h) => h.heroId === heroId)!,
      p.snapshot.resolution!.faceup,
      threat,
    );
    const hero = resources.preparation.heroes.find((h) => h.heroId === heroId)!;
    const cap = p.fronts!.catalog.heroes.find((h) => h.id === heroId)!.stats.inspiration;
    if (!beforeOrderFeasible(effects, hero.inspiration, cap))
      return {
        code: 'INTERACTION_HIDDEN_FUNDING',
        message:
          'Gli obblighi prima dell’interazione non hanno un ordine garantito senza dipendere da un premio ancora nascosto. Questa combinazione richiede una regola di prosecuzione verificata. Nessun costo o carta è stato applicato.',
      };
    if (effects.some((e) => e.kind === 'look') && !hero.deck.length && !hero.discard.length)
      return {
        code: 'INTERACTION_CARDLESS',
        message:
          'Non è disponibile alcuna carta nel mazzo o negli scarti per guardare. Questa combinazione richiede una regola verificata. Nessun costo o carta è stato applicato.',
      };
    return null;
  } catch {
    return {
      code: 'INTERACTION_BEFORE_CAPABILITY',
      message:
        'Un effetto attivo prima di interagire richiede una capacità ancora non disponibile. Nessun costo è stato applicato.',
    };
  }
}

export function beforeInteractionAvailability(p: PhysicalState, heroId: string, threat: boolean) {
  const problem = beforeInteractionProblem(p, heroId, threat);
  return { available: !problem, reason: problem?.message ?? null };
}
