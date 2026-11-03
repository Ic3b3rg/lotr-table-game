// Entirely invented content. Counts exercise the base profile, not real cards.
const ref = (sourceId = 'invented-workbook', locator = 'Sheet!A2') => ({ sourceId, locator });
export const fact = (value, evidence = [ref()]) => ({
  value,
  status: 'verified',
  evidence,
  errataIds: [],
  note: '',
});

const text = (value) => ({
  ...fact(value),
  language: 'it',
  origin: 'working-translation',
  original: { text: 'Discard this invented card.', language: 'en', reference: ref() },
  comparison: {
    numbers: 'Nessun numero.',
    symbols: 'Nessun simbolo.',
    costs: 'Nessun costo.',
    targets: 'Questa carta.',
    conditions: 'Nessuna condizione.',
    timing: 'Risoluzione corrente.',
    duration: 'Istantanea.',
    operations: 'Scartare questa carta.',
  },
});

export function physicalPack() {
  const cards = [];
  for (const [family, count] of [
    ['damage', 18],
    ['fear', 18],
    ['boon', 3],
    ['title', 21],
  ]) {
    for (let n = 1; n <= count; n++) {
      const id = `invented-${family}-${n}`;
      const quantity =
        family === 'boon' ? 5 : ['damage', 'fear'].includes(family) && n === 1 ? 11 : 1;
      cards.push({
        id,
        family,
        order: cards.length,
        name: text(`Carta immaginaria ${family} ${n}`),
        aliases: fact([`Imaginary ${family} ${n}`]),
        quantity: fact(quantity),
        copies: Array.from({ length: quantity }, (_, i) => ({
          id: `${id}-copy-${i + 1}`,
          ordinal: i + 1,
        })),
        printing: fact({
          type: family,
          number: family === 'title' ? n : null,
          rank: null,
          traits: [],
          icons: family === 'title' ? [{ symbol: 'fate', count: 1 }] : [],
        }),
        front: fact({ kind: 'rules', orientation: 'portrait' }),
        back: fact({
          kind: family === 'boon' ? 'boon-back' : `${family === 'title' ? 'skill' : family}-back`,
          orientation: 'portrait',
        }),
        text: text('Scarta questa carta immaginaria.'),
        mechanics: {
          timing: fact(['Risoluzione corrente.']),
          conditions: fact([]),
          costs: fact([]),
          targets: fact(['Questa carta.']),
          duration: fact(['Istantanea.']),
          operations: fact(['Scartare questa carta.']),
          values: fact([]),
          symbols: fact([]),
        },
        usage: fact({
          acquire: family === 'title' ? 'app-instruction' : family === 'boon' ? 'supply' : 'suffer',
          initialFace: family === 'title' || family === 'boon' ? 'faceup' : 'instruction',
          requiresPrepared: family === 'title',
          prepareOnGain: family === 'title' ? 'unless-instructed-otherwise' : 'not-applicable',
          ownership: family === 'title' ? 'campaign' : 'adventure',
          removedUntil: family === 'title' ? 'next-adventure' : 'not-applicable',
          acquisitionNotes: family === 'title' ? ['Istruzione dello scenario immaginario.'] : [],
        }),
        binding: fact(
          family === 'title'
            ? {
                titleModel: { sourceId: 'invented-models', locator: `TitleModel:${n}`, modelId: n },
                nameKey: `INVENTED_TITLE_${n}`,
                skillModels: [
                  {
                    sourceId: 'invented-models',
                    locator: `SkillModel:${100 + n}`,
                    modelId: 100 + n,
                  },
                ],
                skillStatus: 'linked',
              }
            : null,
        ),
      });
    }
  }
  return {
    formatVersion: 1,
    profile: 'base-physical-v1',
    language: 'it',
    sources: [
      {
        id: 'invented-workbook',
        kind: 'workbook',
        language: 'en',
        edition: 'Invented 1',
        uri: 'urn:invented:workbook',
        sha256: 'a'.repeat(64),
      },
      {
        id: 'invented-models',
        kind: 'app-model',
        language: 'none',
        edition: 'Invented 1',
        uri: 'urn:invented:models',
        sha256: 'b'.repeat(64),
      },
      {
        id: 'invented-errata',
        kind: 'official-errata',
        language: 'it',
        edition: 'Invented 2',
        uri: 'urn:invented:errata',
        sha256: 'c'.repeat(64),
      },
    ],
    cards,
    errata: [],
  };
}

export function withCorrection() {
  const p = physicalPack();
  const c = p.cards.at(-1);
  c.text.errataIds = ['invented-fix'];
  c.text.evidence.push(ref('invented-errata', 'p.1'));
  p.errata.push({
    id: 'invented-fix',
    cardId: c.id,
    fields: ['text'],
    reference: ref('invented-errata', 'p.1'),
    disposition: 'applied',
    original: { reference: ref(), text: 'Keep this invented card.' },
    note: 'Correzione inventata controllata.',
  });
  return p;
}
