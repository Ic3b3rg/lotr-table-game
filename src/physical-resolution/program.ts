import { PhysicalProgramSchema, type PhysicalProgram } from '../shared/physical';
import { invariant } from '../map-freeze/validate';

export function validatePhysicalProgram(program: PhysicalProgram, count: number) {
  PhysicalProgramSchema.parse(program);
  invariant(
    program.initialCredits.length === count && program.limits.length === count,
    'Stati sintetici non legati alla compagnia.',
  );
  if (program.profile === 'source-fronts-v1') {
    invariant(
      program.initialCredits.every((n) => n === 0) &&
        program.limits.every(
          (l) => l.kind === 'requires-capability' && l.capability === 'source-derived',
        ) &&
        new Set(program.darknessHeroes).size === program.darknessHeroes.length &&
        program.darknessHeroes.every((h) => h < count),
      'Crediti sintetici su fonte P1.',
    );
    for (const c of program.children)
      invariant(
        c.hero < count &&
          (c.kind !== 'suffer' ||
            (!c.prevention.length &&
              new Set(c.cards.map((x) => x.family)).size === c.cards.length)) &&
          (c.kind !== 'discard' || new Set(c.families).size === c.families.length),
        'Fonte P1 non valida.',
      );
    return;
  }
  for (const child of program.children) {
    invariant(child.hero < count, 'Destinatario fonte assente.');
    if (child.kind === 'suffer') {
      invariant(
        new Set(child.cards.map((c) => c.family)).size === child.cards.length,
        'Tipi ripetuti nella fonte.',
      );
      invariant(
        new Set(child.prevention.map((g) => g.id)).size === child.prevention.length &&
          child.prevention.every((g) => g.actor < count),
        'Concessioni fonte non valide.',
      );
    } else
      invariant(new Set(child.families).size === child.families.length, 'Tipi scarto ripetuti.');
  }
}
