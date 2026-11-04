import type { State } from '../server/state';
import type { ScenarioPack } from '../shared/scenario';
import { verifyCombatClosure } from './compiler';
import { definitionId } from '../shared/preparation';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';

/** The closure is frozen against every owned definition, including later preparations. */
export function validateCombatParty(state: State, pack: ScenarioPack) {
  if (!pack.manifest.combat) return;
  const a = verifyCombatClosure(pack.manifest.combat),
    catalog = state.content!,
    preparation = state.preparation!;
  const ids = [
    ...new Set(
      preparation.heroes.flatMap((h) => [...h.deck, ...h.discard, ...h.prepared].map(definitionId)),
    ),
  ];
  invariant(
    a.source.definitions.length === ids.length &&
      ids.every((id) =>
        a.source.definitions.some(
          (d) =>
            d.id === id && d.definitionHash === digest(catalog.skills.find((c) => c.id === id)),
        ),
      ),
    'Definizioni possedute non interamente congelate.',
  );
  const items = [...new Set(preparation.heroes.flatMap((h) => h.itemCopies.map(definitionId)))];
  invariant(
    a.compiled.items.length === items.length &&
      items.every((id) =>
        a.compiled.items.some(
          (i) =>
            i.id === id &&
            i.definitionHash === digest(catalog.items.find((c) => c.id === id)) &&
            i.ranged === catalog.items.find((c) => c.id === id)!.ranged &&
            (i.stat === null || catalog.items.find((c) => c.id === id)!.slot === 'hand'),
        ),
      ),
    'Oggetti posseduti non riconciliati con le armi congelate.',
  );
  invariant(
    a.compiled.heroes.length === preparation.heroes.length &&
      preparation.heroes.every((h) =>
        a.compiled.heroes.some(
          (c) =>
            c.heroId === h.heroId &&
            c.definitionHash === digest(catalog.heroes.find((c) => c.id === h.heroId)),
        ),
      ),
    'Capacità eroe non interamente congelate.',
  );
  invariant(state.mapGeneration?.status === 'frozen', 'Compagnia senza mappa congelata.');
  for (const h of state.mapGeneration.projection.context.heroes)
    for (const item of h.items)
      invariant(
        a.source.items.some((i) => i.id === item.catalogId && i.model === item.source),
        'Modello oggetto non legato all’equipaggiamento.',
      );
}
