// Entirely invented identities, names, quantities and values. Not acceptance89/33.
import { frontFixture, hash } from './physical-fronts.mjs';
export function boonFixture(verified = true) {
  const f = frontFixture();
  const cards = f.raw.cards.filter((c) => c.family === 'boon');
  const kinds = ['determined', 'emboldened', 'hidden'];
  const effects = [
    [{ op: 'exchange-test-cards' }],
    [
      { op: 'add-hits', valueIndex: 0 },
      { op: 'discard-on-suffer', families: ['damage', 'fear'] },
      { op: 'discard-at-end-turn', condition: 'no-nearby-enemies' },
    ],
    [
      { op: 'prevent-all-before-test', family: 'damage' },
      { op: 'add-success', valueIndex: 0 },
    ],
  ];
  cards.forEach((c, i) => {
    c.name.value = `Favore sintetico ${i + 1}`;
    c.text.value = `Programma immaginario ${i + 1}, senza testo originale.`;
    c.mechanics.values.value = i
      ? [{ label: 'Valore inventato', value: i + 3, unit: 'punti' }]
      : [];
    c.mechanics.symbols.value = ['damage', 'fear', 'success'];
    if (verified) {
      const quantity = [2, 4, 9][i];
      c.quantity = { ...c.quantity, value: quantity, status: 'verified', note: '' };
      c.copies = Array.from({ length: quantity }, (_, n) => ({
        id: `${c.id}-copy-${n + 1}`,
        ordinal: n + 1,
      }));
    }
  });
  const input = {
    version: 'source-boons-v1',
    rules: [
      { sourceId: 'invented-workbook', locator: 'Invented rules: supply, duplicates, return' },
    ],
    definitions: cards.map((c, i) => ({
      cardId: c.id,
      kind: kinds[i],
      cardHash: hash(c),
      originalHash: hash(c.text.original),
      mechanicsHash: hash(c.mechanics),
      usageHash: hash(c.usage),
      source: c.text.original.reference,
      effects: effects[i],
    })),
  };
  return { ...f, boonInput: input };
}
