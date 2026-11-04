import type { PhysicalState } from './model';
import type { PhysicalView } from '../shared/physical';
import { requirePhysicalFamily } from '../physical-content/catalog';
import { frontToken } from './front-runtime';
import { cycleRequest } from './cycle-request';
import { travelMoves, persistentEffects } from './effects';
import { physicalTitleSkills } from './title-skills';
import type { PhysicalCard } from '../physical-content/catalog';
import { boonAvailability } from './boon-stock';

/** Hidden identities and random state never enter the ordinary public projection. */
export function physicalView(p: PhysicalState | null, original = false): PhysicalView | null {
  if (!p) return null;
  const up = new Set(p.snapshot.resolution?.faceup ?? []);
  const view: PhysicalView = {
    synthetic: !original && p.cycle?.version !== 2,
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
  const boonCards = (p.raw as { cards: PhysicalCard[] }).cards.filter(
    (c) => c.family === 'boon' && c.name.status === 'verified' && c.text.status === 'verified',
  );
  if (boonCards.length) {
    const held = p.snapshot.resolution?.resources?.boonCustody ?? [];
    view.boons = {
      stock:
        p.boons?.stock.status ??
        (boonCards.some((c) => c.quantity.value === null || c.quantity.status !== 'verified')
          ? 'unverified'
          : 'unavailable'),
      definitions: boonCards.map((card, i) => {
        const d = p.boons?.definitions.find((d) => d.cardId === card.id);
        return {
          kind: d?.kind ?? `entry-${i}`,
          name: card.name.value,
          text: card.text.value,
          available: d ? boonAvailability(p.boons, held, d.kind).available : null,
        };
      }),
      held: held.map((b) => {
        const card = boonCards.find(
          (c) => c.id === p.boons!.definitions.find((d) => d.kind === b.kind)!.cardId,
        )!;
        const run = p.runs.find((r) => b.source.startsWith(`${r.id}/`));
        return {
          copyId: b.copyId,
          heroId: b.heroId,
          kind: b.kind,
          name: card.name.value,
          text: card.text.value,
          sourceLabel: b.source.includes('/title-rest-')
            ? 'Conseguito dopo Riposo con un titolo'
            : run?.source.instanceId === 'combat-controller'
              ? `Conseguenza dell’attacco nemico · round ${run.source.state}`
              : 'Concessione della fonte corrente',
        };
      }),
    };
  }
  if (view.active?.kind === 'decision')
    for (const option of view.active.options) {
      if (option.id.startsWith('title-rest:') && !p.boons)
        option.unavailable =
          'Il seguito del titolo richiede la riserva verificata dei benefici. Nessun Riposo o costo è stato applicato.';
    }
  const ls = p.snapshot.lastStand;
  if (ls) {
    const terminal = p.cycle?.terminal ?? ls.terminal;
    const titleCards = requirePhysicalFamily(p.raw, 'title').cards;
    const titleSkills = physicalTitleSkills(p);
    view.lastStand = {
      test: structuredClone(ls.test),
      heroes: structuredClone(ls.heroes),
      selections: ls.selections.map(
        ({ id: _, sourceFingerprint: __, instructionId, instructionHash: ___, ...s }) => ({
          ...structuredClone(s),
          instruction: p
            .lastStand!.instructions.find((i) => i.id === instructionId)!
            .text.replace('{0}', String(s.difficulty)),
        }),
      ),
      titles: ls.titles.map(({ source: _, ...t }) => ({
        ...t,
        name: titleCards.find((c) => c.id === t.cardId)!.name.value,
        text: titleCards.find((c) => c.id === t.cardId)!.text.value,
        skill: titleSkills.find((c) => c.id === t.cardId)!,
        prepared: !!p.snapshot.resolution?.resources?.preparation.heroes
          .find((h) => h.heroId === t.heroId)
          ?.prepared.includes(t.copy),
      })),
      lossAtNextShadow: !!ls.lossDue && !terminal,
      terminal: terminal ? (({ instructionHash: _, ...rest }) => rest)(terminal) : null,
    };
  }
  if (p.version !== 1) {
    if (p.snapshot.resolution!.attackTest !== undefined)
      view.attackTest = structuredClone(p.snapshot.resolution!.attackTest);
    if (p.snapshot.resolution!.sourceTest !== undefined)
      view.sourceTest = structuredClone(p.snapshot.resolution!.sourceTest);
    view.cycle = {
      pending: cycleRequest(p),
      heroes: p.heroes.map((h) => ({
        heroId: h.heroId,
        travelMoves: travelMoves(p, h.heroId),
        ...(!view.synthetic
          ? {
              interactInspiration: persistentEffects(p, h.heroId).reduce(
                (n, e) =>
                  n + (e.op === 'mandatory-spend' && e.window === 'before-interact' ? e.n : 0),
                0,
              ),
            }
          : {}),
      })),
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
