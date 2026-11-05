import type { Catalog } from '../shared/catalog';
import type { ScenarioPack } from '../shared/scenario';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';

export function validateCampCapability(pack: ScenarioPack) {
  const cap = pack.manifest.campSkills;
  if (!cap) return;
  invariant(
    pack.manifest.scope === 'original-encounter-v1' &&
      pack.manifest.failure &&
      cap.failureFingerprint === digest(pack.manifest.failure),
    'Campo senza conclusione fonte corrispondente.',
  );
  invariant(
    Object.values(cap.methods).every(
      (m) => m.assemblyHash === pack.manifest.failure!.methods.xp.assemblyHash,
    ),
    'Controller del campo diverso dalla fonte della conclusione.',
  );
  const unique = (values: unknown[]) => new Set(values).size === values.length;
  invariant(
    unique(cap.roles.map((r) => r.id)) &&
      unique(cap.roles.map((r) => r.source)) &&
      unique(cap.roles.map((r) => r.modelId)) &&
      unique(cap.sources.map((s) => s.id)),
    'Identità fonte del campo duplicate.',
  );
  const offers = cap.roles.flatMap((r) => r.upgrades);
  invariant(
    unique(offers.map((o) => o.card.id)) && unique(offers.map((o) => o.copy)),
    'Copie del campo duplicate.',
  );
  const coreSources = new Set(cap.roles.flatMap((r) => r.core.map((m) => m.source)));
  const allModels = new Map<string, number>();
  for (const role of cap.roles) {
    invariant(
      unique(role.core.map((m) => m.source)) &&
        role.core.every((m) => m.cost === 0 && m.roleSource === role.source),
      'Carte iniziali del ruolo incoerenti.',
    );
    const models = role.upgrades.flatMap((o) => o.models);
    invariant(
      new Set(models.map((m) => m.source)).size === role.upgrades.length,
      'Inventario UpgradeSkills incompleto.',
    );
    for (const offer of role.upgrades) {
      invariant(
        offer.copy === `${offer.card.id}:1` &&
          offer.card.ownerId === role.id &&
          offer.card.number !== null &&
          offer.card.number > 3 &&
          offer.card.name.verified &&
          offer.card.text.verified &&
          (offer.card.identityStatus === 'confirmed' || offer.card.notes.length > 0),
        'Identità della carta acquistabile incoerente.',
      );
      invariant(
        offer.models.every(
          (m) =>
            !coreSources.has(m.source) && m.roleSource === role.source && m.cost === offer.cost,
        ),
        'Prezzo o ruolo della carta diverso dai campi fonte.',
      );
      invariant(
        Object.values(offer.evidence).every((refs) =>
          refs.every((e) => cap.sources.some((s) => s.id === e.sourceId)),
        ),
        'Provenienza del campo assente.',
      );
      if (offer.binding === 'exact')
        invariant(offer.models.length === 1, 'Binding individuale ambiguo.');
      else {
        const peers = role.upgrades.filter(
          (o) => o.binding === 'equivalent-set' && digest(o.models) === digest(offer.models),
        );
        invariant(
          offer.models.length === 2 &&
            peers.length === 2 &&
            peers.every(
              (o) =>
                o.cost === offer.cost &&
                o.originalText === offer.originalText &&
                digest(o.mechanics) === digest(offer.mechanics) &&
                o.card.success === offer.card.success &&
                o.card.fate === offer.card.fate &&
                digest(o.card.traits) === digest(offer.card.traits) &&
                o.card.identityStatus === 'candidate' &&
                o.card.notes.length > 0,
            ),
          'Associazione d’insieme non attestata.',
        );
      }
      for (const m of offer.models) {
        const count = (allModels.get(m.source) ?? 0) + 1;
        allModels.set(m.source, count);
        invariant(
          count <= (offer.binding === 'exact' ? 1 : 2),
          'Modello duplicato senza associazione d’insieme.',
        );
      }
    }
  }
}

export function validateCampCatalog(pack: ScenarioPack, catalog: Catalog) {
  const cap = pack.manifest.campSkills;
  if (!cap) return;
  const existing = new Set(
    [...catalog.heroes, ...catalog.roles, ...catalog.skills, ...catalog.items].map((c) => c.id),
  );
  invariant(
    cap.catalogFingerprint === digest(catalog) &&
      cap.roles.every((r) => catalog.roles.some((c) => c.id === r.id)) &&
      cap.roles.every((r) => r.upgrades.every((o) => !existing.has(o.card.id))),
    'Catalogo del campo diverso dal catalogo congelato.',
  );
}
