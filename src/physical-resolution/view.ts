import type { PhysicalState } from './model';
import type { PhysicalView } from '../shared/physical';
import { requirePhysicalFamily } from '../physical-content/catalog';
import { frontToken } from './front-runtime';
import { cycleRequest } from './cycle-request';
import { travelMoves } from './effects';

/** Hidden identities and random state never enter the ordinary public projection. */
export function physicalView(p: PhysicalState | null): PhysicalView | null {
  if (!p) return null;
  const up = new Set(p.snapshot.resolution?.faceup ?? []);
  const view: PhysicalView = {
    synthetic: true,
    decks: { damage: p.snapshot.decks.damage.length, fear: p.snapshot.decks.fear.length },
    heroes: p.snapshot.areas.map((h) => ({
      heroId: h.heroId,
      facedown: {
        damage: h.damage.filter((c) => !up.has(c)).length,
        fear: h.fear.filter((c) => !up.has(c)).length,
      },
    })),
    active: structuredClone(p.snapshot.active),
    parents: structuredClone(p.snapshot.parents),
  };
  if (p.version !== 1) {
    view.cycle = {
      pending: cycleRequest(p),
      heroes: p.heroes.map((h) => ({ heroId: h.heroId, travelMoves: travelMoves(p, h.heroId) })),
    };
    const cards = [
      ...requirePhysicalFamily(p.raw, 'damage').cards,
      ...requirePhysicalFamily(p.raw, 'fear').cards,
    ];
    const card = (copy: string) => cards.find((c) => c.copies.some((x) => x.id === copy))!;
    view.fronts = p.snapshot.areas.flatMap((h) =>
      [...h.damage, ...h.fear]
        .filter((c) => up.has(c))
        .map((copy) => ({
          token: frontToken(p.entropy, copy),
          heroId: h.heroId,
          family: card(copy).family as 'damage' | 'fear',
          name: card(copy).name.value,
          text: card(copy).text.value,
          persistent: p
            .fronts!.artifact.definitions.find((d) => d.cardId === card(copy).id)!
            .persistent.map(
              () => 'Effetto attivo finché questa carta resta scoperta. Vedi il testo del fronte.',
            ),
        })),
    );
    const current = [...p.snapshot.resolution!.frames]
      .reverse()
      .find((f) => f.copy && up.has(f.copy));
    view.current = current?.copy
      ? {
          heroId: current.heroId,
          family: card(current.copy).family as 'damage' | 'fear',
          name: card(current.copy).name.value,
          text: card(current.copy).text.value,
          step:
            p.snapshot.active?.kind === 'decision'
              ? p.snapshot.active.title
              : 'La fonte attende il completamento di questa carta.',
        }
      : null;
  }
  return view;
}
