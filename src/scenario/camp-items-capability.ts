import type { Catalog } from '../shared/catalog';
import type { ScenarioPack } from '../shared/scenario';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';

export function validateCampItemsCapability(pack: ScenarioPack) {
  const cap = pack.manifest.campItems;
  if (!cap) return;
  const unique = (values: unknown[]) => new Set(values).size === values.length;
  invariant(
    (pack.manifest.scope === 'original-encounter-v1' ||
      (pack.manifest.scope === 'battle-combat-v1' &&
        pack.manifest.battleStartup?.continuation !== undefined &&
        digest(pack.manifest.campDeparture) ===
          digest(pack.manifest.battleStartup.continuation))) &&
      pack.manifest.failure &&
      cap.failureFingerprint === digest(pack.manifest.failure) &&
      Object.values(cap.methods).every(
        (m) => m.assemblyHash === pack.manifest.failure!.methods.xp.assemblyHash,
      ),
    'Miglioramenti oggetti senza conclusione e controller fonte corrispondenti.',
  );
  invariant(
    unique(cap.sources.map((s) => s.id)) &&
      unique(cap.cards.map((c) => c.cardId)) &&
      unique(cap.cards.map((c) => c.model.source)) &&
      unique(cap.cards.map((c) => c.model.modelId)) &&
      unique(cap.product.items.map((i) => i.source)) &&
      cap.product.items.length === cap.cards.length,
    'Identità o quantità del campo duplicate o incomplete.',
  );
  for (const card of cap.cards) {
    invariant(
      cap.product.items.some(
        (i) => i.source === card.model.source && i.quantity === card.quantity,
      ) &&
        card.model.source !== cap.product.source &&
        unique(card.model.upgrades) &&
        card.model.upgrades.every((source) => {
          const next = cap.cards.find((c) => c.model.source === source);
          return !next || next.model.level === card.model.level + 1;
        }) &&
        Object.values(card.evidence).every((refs) =>
          refs.every((e) => cap.sources.some((s) => s.id === e.sourceId)),
        ),
      'Copie, ranghi, legami o provenienza degli oggetti incoerenti.',
    );
  }
  const items = pack.manifest.items;
  if (items) {
    const grant = cap.cards.find((c) => c.cardId === items.grant.cardId);
    invariant(
      cap.product.id === items.product.id &&
        cap.product.source === items.product.source &&
        cap.product.objectHash === items.product.objectHash &&
        grant &&
        grant.cardHash === items.grant.cardHash &&
        grant.quantity === items.grant.quantity &&
        grant.model.source === items.grant.model.source &&
        grant.model.modelId === items.grant.model.modelId &&
        grant.model.objectHash === items.grant.model.objectHash &&
        grant.model.upgradeCost === items.grant.upgrade.threshold &&
        digest(grant.model.upgrades) === digest(items.grant.upgrade.choices.map((c) => c.source)) &&
        items.grant.upgrade.choices.every((c) =>
          cap.cards.some(
            (next) =>
              next.model.source === c.source &&
              next.model.modelId === c.modelId &&
              next.model.objectHash === c.objectHash,
          ),
        ),
      'Miglioramenti diversi dall’accessorio e inventario già certificati.',
    );
  }
}

export function validateCampItemsCatalog(pack: ScenarioPack, catalog: Catalog) {
  const cap = pack.manifest.campItems;
  if (!cap) return;
  invariant(
    cap.catalogFingerprint === digest(catalog) && cap.cards.length === catalog.items.length,
    'Oggetti del campo diversi dal catalogo congelato.',
  );
  for (const entry of cap.cards) {
    const card = catalog.items.find((c) => c.id === entry.cardId);
    const successors = entry.model.upgrades.flatMap((source) =>
      cap.cards.filter((c) => c.model.source === source).map((c) => c.cardId),
    );
    invariant(
      card &&
        digest(card) === entry.cardHash &&
        card.identityStatus === 'confirmed' &&
        card.name.verified &&
        card.text.verified &&
        card.quantity === entry.quantity &&
        card.rank === entry.model.level &&
        card.slot === ['hand', 'armor', 'trinket'][entry.model.type] &&
        card.hands === (entry.model.type === 0 ? (entry.model.twoHanded ? 2 : 1) : 0) &&
        digest(card.upgrades) === digest(successors),
      'Carta, simboli o alternative diversi dai campi fonte degli oggetti.',
    );
  }
}
