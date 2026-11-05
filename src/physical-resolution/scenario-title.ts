import type { ScenarioTitleGrant } from '../shared/scenario-title';
import { requirePhysicalFamily } from '../physical-content/catalog';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';

/** Quantity, identity and immediate preparation are independent of boon stock. */
export function validateScenarioTitle(raw: unknown, grant: ScenarioTitleGrant) {
  const card = requirePhysicalFamily(raw, 'title').cards.find((c) => c.id === grant.cardId);
  const binding = card?.binding.value;
  invariant(
    card &&
      digest(card) === grant.cardHash &&
      card.quantity.value === 1 &&
      card.copies.length === 1 &&
      binding?.titleModel?.locator === grant.titleModel.source &&
      binding.titleModel.modelId === grant.titleModel.modelId &&
      binding.skillStatus === 'linked' &&
      binding.skillModels.some(
        (s) => s.locator === grant.skillModel.source && s.modelId === grant.skillModel.modelId,
      ) &&
      grant.titleModel.source !== grant.skillModel.source &&
      card.usage.value?.prepareOnGain === 'unless-instructed-otherwise' &&
      card.usage.value.ownership === 'campaign' &&
      card.usage.value.requiresPrepared,
    'Titolo scenario senza carta, copia, modelli e policy verificati corrispondenti.',
  );
  return card;
}
