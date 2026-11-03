import type { PhysicalState } from './model';
import type { TitleSkillDefinition } from '../shared/skill-cards';
import { requirePhysicalFamily } from '../physical-content/catalog';

/** Only campaign-owned cards enter ordinary skill consumers, never raw mappings. */
export function physicalTitleSkills(p: PhysicalState | null): TitleSkillDefinition[] {
  const ownedTitles = p?.snapshot.lastStand?.titles ?? [];
  if (!p || !ownedTitles.length) return [];
  const cards = requirePhysicalFamily(p.raw, 'title').cards;
  return ownedTitles.map((owned) => {
    const card = cards.find((c) => c.id === owned.cardId)!;
    const localized = (field: typeof card.name) => ({
      text: field.value!,
      kind:
        field.origin === 'working-translation' ? ('translated' as const) : ('official-it' as const),
      source: field.evidence.map((e) => e.locator).join(' · '),
      verified: field.status === 'verified',
    });
    const printing = card.printing.value!;
    return {
      id: card.id,
      kind: 'title',
      name: localized(card.name),
      text: localized(card.text),
      quantity: card.quantity.value!,
      identityStatus: 'confirmed',
      notes: [],
      ownerId: null,
      number: printing.number,
      success: printing.icons
        .filter((i) => i.symbol === 'success')
        .reduce((n, i) => n + i.count, 0),
      fate: printing.icons.filter((i) => i.symbol === 'fate').reduce((n, i) => n + i.count, 0),
      traits: [...printing.traits],
    };
  });
}
