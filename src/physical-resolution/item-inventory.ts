import type { Catalog } from '../shared/catalog';
import type { ItemGrant } from '../shared/item-inventory';
import type { FrontArtifact } from './front-program';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';
export function validateItemGrant(catalog: Catalog, artifact: FrontArtifact, grant: ItemGrant) {
  const card = catalog.items.find((c) => c.id === grant.cardId),
    policy = artifact.policies.find((p) => p.kind === 'item' && p.id === grant.cardId);
  invariant(
    card &&
      card.identityStatus === 'confirmed' &&
      card.slot === 'trinket' &&
      card.rank === 1 &&
      card.quantity === grant.quantity &&
      digest(card) === grant.cardHash &&
      policy &&
      digest(policy) === grant.policyHash &&
      policy.definitionHash === grant.cardHash &&
      policy.effects.length === 1 &&
      policy.effects[0]?.op === 'fear-facedown-only' &&
      policy.effects[0].depletion === grant.depletion,
    'Oggetto senza carta, quantità e capacità stampata certificate.',
  );
  return card;
}
