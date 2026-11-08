import type { Catalog } from '../shared/catalog';
import type { ScenarioPack } from '../shared/scenario';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';

export function validateCampPreparationCapability(pack: ScenarioPack) {
  const cap = pack.manifest.campPreparation;
  if (!cap) return;
  const skills = pack.manifest.campSkills,
    items = pack.manifest.campItems;
  const unique = (values: unknown[]) => new Set(values).size === values.length;
  invariant(
    (pack.manifest.scope === 'original-encounter-v1' ||
      (pack.manifest.scope === 'battle-combat-v1' &&
        pack.manifest.battleStartup?.continuation !== undefined &&
        digest(pack.manifest.campDeparture) ===
          digest(pack.manifest.battleStartup.continuation))) &&
      skills &&
      items &&
      cap.skillsFingerprint === digest(skills) &&
      cap.itemsFingerprint === digest(items) &&
      cap.catalogFingerprint === skills.catalogFingerprint &&
      cap.catalogFingerprint === items.catalogFingerprint &&
      Object.values(cap.methods).every(
        (m) => m.assemblyHash === pack.manifest.failure!.methods.xp.assemblyHash,
      ),
    'Preparazione senza inventari, catalogo e controller fonte corrispondenti.',
  );
  invariant(
    unique(cap.cards.map((c) => c.cardId)) &&
      unique(cap.sources.map((s) => s.id)) &&
      unique(cap.cards.map((c) => `${c.kind}:${c.ownerId}:${c.number}`)) &&
      cap.cards.filter((c) => c.kind === 'basic').length === 6 &&
      cap.cards.filter((c) => c.kind === 'hero').length === 30 &&
      cap.cards.filter((c) => c.kind === 'role').length === 18 &&
      cap.cards.every(
        (c) =>
          (c.kind === 'basic' ? c.ownerId === null : c.ownerId !== null) &&
          c.number <= { basic: 6, hero: 5, role: 3 }[c.kind] &&
          (c.kind !== 'role' || skills.roles.some((r) => r.id === c.ownerId)) &&
          c.evidence.every((e) => cap.sources.some((s) => s.id === e.sourceId)),
      ),
    'Identità, categorie o provenienze della preparazione incomplete.',
  );
}

export function validateCampPreparationCatalog(pack: ScenarioPack, catalog: Catalog) {
  const cap = pack.manifest.campPreparation;
  if (!cap) return;
  invariant(
    cap.catalogFingerprint === digest(catalog) &&
      cap.cards.every((binding) => {
        const card = catalog.skills.find((c) => c.id === binding.cardId);
        return (
          card &&
          digest(card) === binding.cardHash &&
          card.kind === binding.kind &&
          card.ownerId === binding.ownerId &&
          card.number === binding.number
        );
      }),
    'Identità della preparazione diverse dal catalogo congelato.',
  );
}
