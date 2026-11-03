import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  inspectPhysicalContent,
  requirePhysicalCatalog,
  requirePhysicalFamily,
} from '../dist/physical-content-library.mjs';
import { physicalPack, withCorrection } from './fixtures/physical-content.mjs';

test('catalogo verificato espone 60 definizioni e 92 copie senza riordinare', () => {
  const p = physicalPack();
  const result = inspectPhysicalContent(p);
  assert.equal(result.status, 'verified');
  assert.deepEqual(
    result.coverage.map(({ family, definitions, copies, complete }) => ({
      family,
      definitions,
      copies,
      complete,
    })),
    [
      { family: 'damage', definitions: 18, copies: 28, complete: true },
      { family: 'fear', definitions: 18, copies: 28, complete: true },
      { family: 'boon', definitions: 3, copies: 15, complete: true },
      { family: 'title', definitions: 21, copies: 21, complete: true },
    ],
  );
  assert.deepEqual(result.catalog, p);
  assert.deepEqual(requirePhysicalCatalog(p), p);
});

test('il risultato è isolato dal chiamante e congelato a ogni profondità', () => {
  const p = physicalPack();
  const before = structuredClone(p);
  const result = inspectPhysicalContent(p);
  assert.deepEqual(p, before);
  assert.notEqual(result.catalog, p);
  assert.throws(() => result.catalog.cards[0].copies.push({ id: 'fake', ordinal: 12 }), TypeError);
  assert.throws(() => {
    result.catalog.cards[0].name.evidence[0].locator = 'changed';
  }, TypeError);
  p.cards[0].name.value = 'Modifica chiamante';
  assert.equal(result.catalog.cards[0].name.value, 'Carta immaginaria damage 1');
  assert.equal(Object.isFrozen(result.coverage[0]), true);
});

test('quantità irrisolta produce solo diagnostico e conserva la completezza delle altre famiglie', () => {
  const p = physicalPack();
  p.cards[0].quantity = {
    ...p.cards[0].quantity,
    value: null,
    status: 'unresolved',
    note: 'Quantità non documentata.',
  };
  p.cards[0].copies = [];
  const r = inspectPhysicalContent(p);
  assert.equal(r.status, 'diagnostic');
  assert.equal('catalog' in r, false);
  assert.equal(r.coverage[0].complete, false);
  assert.equal(r.coverage[1].complete, true);
  assert.ok(r.diagnostics.some((d) => d.cardId === 'invented-damage-1' && d.field === 'quantity'));
  assert.throws(() => requirePhysicalCatalog(p), /diagnostic/i);
});

test('una famiglia mancante non riceve definizioni o copie inventate', () => {
  const p = physicalPack();
  p.cards.splice(36, 3);
  p.cards.forEach((c, i) => {
    c.order = i;
  });
  const r = inspectPhysicalContent(p);
  assert.equal(r.status, 'diagnostic');
  assert.deepEqual(r.coverage[2], {
    family: 'boon',
    definitions: 0,
    copies: 0,
    expectedDefinitions: 3,
    expectedCopies: 15,
    complete: false,
  });
});

const invalidCases = [
  [
    'localizzatore di prova vuoto',
    (p) => {
      p.cards[0].name.evidence[0].locator = '   ';
      p.cards[0].name.original.reference.locator = '   ';
    },
  ],
  [
    'URI fonte bianco',
    (p) => {
      p.sources[0].uri = ' ';
    },
  ],
  [
    'edizione bianca invece di ignota esplicita',
    (p) => {
      p.sources[0].edition = ' ';
    },
  ],
  [
    'versione sconosciuta',
    (p) => {
      p.formatVersion = 2;
    },
  ],
  [
    'certificato in input',
    (p) => {
      p.status = 'verified';
    },
  ],
  [
    'campo carta sconosciuto',
    (p) => {
      p.cards[0].verified = true;
    },
  ],
  [
    'tipo quantità errato',
    (p) => {
      p.cards[0].quantity.value = '11';
    },
  ],
  [
    'fonte duplicata',
    (p) => {
      p.sources.push(structuredClone(p.sources[0]));
    },
  ],
  [
    'ID carta duplicato',
    (p) => {
      p.cards[1].id = p.cards[0].id;
    },
  ],
  [
    'ordine alterato',
    (p) => {
      p.cards[0].order = 1;
    },
  ],
  [
    'alias ambiguo normalizzato',
    (p) => {
      p.cards[1].aliases.value = ['  IMAGINARY DAMAGE 1  '];
    },
  ],
  [
    'alias duplicato nella carta',
    (p) => {
      p.cards[0].aliases.value.push('Imaginary damage 1');
    },
  ],
  [
    'fonte campo inesistente',
    (p) => {
      p.cards[0].mechanics.costs.evidence[0].sourceId = 'absent';
    },
  ],
  [
    'prova duplicata',
    (p) => {
      p.cards[0].name.evidence.push(structuredClone(p.cards[0].name.evidence[0]));
    },
  ],
  [
    'copia globale duplicata',
    (p) => {
      p.cards[1].copies[0].id = p.cards[0].copies[0].id;
    },
  ],
  [
    'copia mancante',
    (p) => {
      p.cards[0].copies.pop();
    },
  ],
  [
    'ordinale copia alterato',
    (p) => {
      p.cards[0].copies[0].ordinal = 2;
    },
  ],
  [
    'quantità nulla verificata',
    (p) => {
      p.cards[0].quantity.value = null;
      p.cards[0].copies = [];
    },
  ],
  [
    'copie di quantità ignota',
    (p) => {
      p.cards[0].quantity.value = null;
      p.cards[0].quantity.status = 'unresolved';
      p.cards[0].quantity.note = 'Ignoto';
    },
  ],
  [
    'famiglia stampa incoerente',
    (p) => {
      p.cards[0].printing.value.type = 'fear';
    },
  ],
  [
    'numero titolo ripetuto',
    (p) => {
      p.cards.at(-1).printing.value.number = 1;
    },
  ],
  [
    'numero titolo mancante verificato',
    (p) => {
      p.cards.at(-1).printing.value.number = null;
    },
  ],
  [
    'numero inventato su danno',
    (p) => {
      p.cards[0].printing.value.number = 1;
    },
  ],
  [
    'lingua non italiana',
    (p) => {
      p.cards[0].name.language = 'en';
    },
  ],
  [
    'traduzione senza originale',
    (p) => {
      p.cards[0].text.original = null;
    },
  ],
  [
    'traduzione senza confronto',
    (p) => {
      p.cards[0].text.comparison = null;
    },
  ],
  [
    'origine IT attribuita al workbook EN',
    (p) => {
      p.cards[0].text.origin = 'original-it';
    },
  ],
  [
    'origine app attribuita al workbook',
    (p) => {
      p.cards[0].name.origin = 'app-localization';
    },
  ],
  [
    'lingua originale discordante',
    (p) => {
      p.cards[0].text.original.language = 'it';
    },
  ],
  [
    'fonte originale inesistente',
    (p) => {
      p.cards[0].text.original.reference.sourceId = 'absent';
    },
  ],
  [
    'testo bianco verificato',
    (p) => {
      p.cards[0].text.value = '   ';
    },
  ],
  [
    'retro incoerente',
    (p) => {
      p.cards[0].back.value.kind = 'fear-back';
    },
  ],
  [
    'orientamento sconosciuto verificato',
    (p) => {
      p.cards[0].front.value.orientation = 'unknown';
    },
  ],
  [
    'irrisolto senza motivo',
    (p) => {
      p.cards[0].text.status = 'unresolved';
    },
  ],
  [
    'titolo senza binding',
    (p) => {
      p.cards.at(-1).binding.value = null;
    },
  ],
  [
    'modello titolo condiviso per errore',
    (p) => {
      p.cards.at(-1).binding.value.titleModel = structuredClone(
        p.cards.at(-2).binding.value.titleModel,
      );
    },
  ],
  [
    'skill assente mascherata da linked',
    (p) => {
      p.cards.at(-1).binding.value.skillModels = [];
    },
  ],
  [
    'skill inventata su assenza esplicita',
    (p) => {
      p.cards.at(-1).binding.value.skillStatus = 'absent-in-checked-base';
    },
  ],
  [
    'binding fonte non modello',
    (p) => {
      p.cards.at(-1).binding.value.titleModel.sourceId = 'invented-workbook';
    },
  ],
  [
    'titolo non preparato su acquisizione',
    (p) => {
      p.cards.at(-1).usage.value.prepareOnGain = 'not-applicable';
    },
  ],
  [
    'titolo con effetto senza preparazione',
    (p) => {
      p.cards.at(-1).usage.value.requiresPrepared = false;
    },
  ],
  [
    'erratum non dichiarato',
    (p) => {
      p.cards[0].text.errataIds = ['absent'];
    },
  ],
];
for (const [name, mutate] of invalidCases)
  test(`rifiuta ${name}`, () => {
    const p = physicalPack();
    mutate(p);
    assert.throws(() => inspectPhysicalContent(p));
  });

test('anomalia di binding circoscritta rimane esplicita senza eliminare il titolo', () => {
  const p = physicalPack();
  const c = p.cards.at(-1);
  c.binding.value.skillModels = [];
  c.binding.value.skillStatus = 'absent-in-checked-base';
  c.binding.note = 'Assenza verificata nel perimetro inventato.';
  const r = inspectPhysicalContent(p);
  assert.equal(r.status, 'verified');
  assert.equal(r.catalog.cards.length, 60);
  assert.deepEqual(r.catalog.cards.at(-1).binding.value.skillModels, []);
  assert.deepEqual(r.anomalies, [
    { cardId: c.id, field: 'binding', message: 'Assenza verificata nel perimetro inventato.' },
  ]);
});

test('correzione ufficiale collega identità, campo, prova e originale preservato', () => {
  const p = withCorrection();
  const r = inspectPhysicalContent(p);
  assert.equal(r.status, 'verified');
  assert.equal(r.catalog.errata[0].original.text, 'Keep this invented card.');
  assert.deepEqual(r.catalog.cards.at(-1).text.errataIds, ['invented-fix']);
});

for (const [name, mutate] of [
  [
    'carta errata sbagliata',
    (p) => {
      p.errata[0].cardId = p.cards[0].id;
    },
  ],
  [
    'campo errata sbagliato',
    (p) => {
      p.errata[0].fields = ['name'];
    },
  ],
  [
    'fonte errata non ufficiale',
    (p) => {
      p.errata[0].reference.sourceId = 'invented-workbook';
    },
  ],
  [
    'prova correzione assente dal campo',
    (p) => {
      p.cards.at(-1).text.evidence.pop();
    },
  ],
  [
    'correzione non collegata dal campo',
    (p) => {
      p.cards.at(-1).text.errataIds = [];
    },
  ],
  [
    'originale applicato non conservato',
    (p) => {
      p.errata[0].original = null;
    },
  ],
])
  test(`rifiuta ${name}`, () => {
    const p = withCorrection();
    mutate(p);
    assert.throws(() => inspectPhysicalContent(p));
  });

test('un conflitto esplicito resta diagnostico anche se i conteggi coincidono', () => {
  const p = physicalPack();
  p.cards[0].text.status = 'conflict';
  p.cards[0].text.note = 'Due fonti divergono.';
  const r = inspectPhysicalContent(p);
  assert.equal(r.status, 'diagnostic');
  assert.ok(r.diagnostics.some((d) => d.code === 'conflict' && d.cardId === p.cards[0].id));
  assert.equal(r.coverage[0].copies, 28);
});

test('simbolo accessorio e segnalino consumo restano distinti nelle annotazioni', () => {
  const p = physicalPack();
  p.cards[0].mechanics.symbols.value = ['trinket', 'depletion'];
  const r = requirePhysicalCatalog(p);
  assert.deepEqual(r.cards[0].mechanics.symbols.value, ['trinket', 'depletion']);
});

for (const field of ['timing', 'targets', 'duration', 'operations'])
  test(`rifiuta ${field} meccanico vuoto dichiarato verificato`, () => {
    const p = physicalPack();
    p.cards[0].mechanics[field].value = [];
    assert.throws(() => requirePhysicalCatalog(p));
  });

test('conserva separatamente istruzioni di acquisizione e capacità del titolo', () => {
  const p = physicalPack();
  p.cards
    .at(-1)
    .usage.value.acquisitionNotes.push('Dopo una prova immaginaria di difficoltà almeno 4.');
  const r = requirePhysicalCatalog(p);
  assert.equal(
    r.cards.at(-1).usage.value.acquisitionNotes[1],
    'Dopo una prova immaginaria di difficoltà almeno 4.',
  );
  assert.equal(r.cards.at(-1).text.value, 'Scarta questa carta immaginaria.');
  p.cards.at(-1).usage.value.acquisitionNotes = [];
  assert.throws(() => requirePhysicalCatalog(p));
});

test('accetta i limiti esatti di testo e fonti preservando spazi e ordine', () => {
  const p = physicalPack();
  p.cards[0].text.value = ` ${'a'.repeat(16382)} `;
  for (let i = 3; i < 128; i++) p.sources.push({ ...p.sources[0], id: `invented-source-${i}` });
  const r = requirePhysicalCatalog(p);
  assert.equal(r.cards[0].text.value.length, 16384);
  assert.equal(r.cards[0].text.value[0], ' ');
  assert.equal(r.sources.length, 128);
});

test('rifiuta proprietà extra degli array invece di perderle durante la copia', () => {
  const p = physicalPack();
  p.cards.certificate = 'invented';
  assert.throws(() => inspectPhysicalContent(p));
});

test('rifiuta proprietà non enumerabili invece di ignorarle', () => {
  const p = physicalPack();
  Object.defineProperty(p.cards[0], 'certificate', { value: 'invented' });
  assert.throws(() => inspectPhysicalContent(p));
});

test('rifiuta accessor prima di eseguirli', () => {
  const p = physicalPack();
  let reads = 0;
  Object.defineProperty(p.cards[0], 'name', {
    enumerable: true,
    get() {
      reads++;
      throw new Error('getter executed');
    },
  });
  assert.throws(() => inspectPhysicalContent(p), /Accessor/);
  assert.equal(reads, 0);
});

test('rifiuta un indice array ereditato senza eseguire il getter', () => {
  const p = physicalPack();
  const card = p.cards[0];
  let reads = 0;
  const prototype = Object.create(Array.prototype);
  Object.defineProperty(prototype, '0', {
    get() {
      reads++;
      return card;
    },
  });
  delete p.cards[0];
  Object.setPrototypeOf(p.cards, prototype);
  assert.throws(() => inspectPhysicalContent(p), /JSON/);
  assert.equal(reads, 0);
});

for (const model of ['titleModel', 'skillModels'])
  test(`rifiuta ${model} condiviso fra carte anche con localizzatori distinti`, () => {
    const p = physicalPack();
    const previous = p.cards.at(-2).binding.value;
    const current = p.cards.at(-1).binding.value;
    const priorModel = model === 'titleModel' ? previous.titleModel : previous.skillModels[0];
    const currentModel = model === 'titleModel' ? current.titleModel : current.skillModels[0];
    currentModel.modelId = priorModel.modelId;
    assert.throws(() => inspectPhysicalContent(p), /duplicato/);
    assert.throws(() => requirePhysicalFamily(p, 'title'), /duplicato/);
  });

test('identità modello distinte per fonte e tipo rimangono consumabili', () => {
  const p = physicalPack();
  p.sources.push({ ...p.sources[1], id: 'invented-other-models' });
  const previous = p.cards.at(-2).binding.value;
  const current = p.cards.at(-1).binding.value;
  current.titleModel.sourceId = 'invented-other-models';
  current.titleModel.modelId = previous.titleModel.modelId;
  current.skillModels[0].modelId = previous.titleModel.modelId;
  const result = requirePhysicalFamily(p, 'title');
  assert.equal(result.cards.length, 21);
  assert.equal(result.cards.at(-1).binding.value.titleModel.sourceId, 'invented-other-models');
  assert.equal(result.cards.at(-1).binding.value.skillModels[0].modelId, 20);
});

test('export della singola famiglia verificata rimane consumabile in presenza di una famiglia irrisolta', () => {
  const p = physicalPack();
  p.cards[36].quantity = {
    ...p.cards[36].quantity,
    value: null,
    status: 'unresolved',
    note: 'Copie non note.',
  };
  p.cards[36].copies = [];
  const r = requirePhysicalFamily(p, 'title');
  assert.equal(r.profile, 'base-physical-family-v1');
  assert.equal(r.status, 'verified');
  assert.equal(r.family, 'title');
  assert.equal(r.cards.length, 21);
  assert.equal(r.cards[0].id, 'invented-title-1');
  assert.equal(Object.isFrozen(r.cards[0].text), true);
  assert.throws(() => requirePhysicalFamily(p, 'boon'), /diagnostic/i);
  assert.throws(() => requirePhysicalFamily(p, 'other'));
});

test('limiti di stringhe, cardinalità, nodi, profondità e input ciclico sono verificati prima dello schema', () => {
  for (const mutate of [
    (p) => {
      p.cards[0].text.value = 'a'.repeat(16385);
    },
    (p) => {
      p.cards = Array(101).fill(p.cards[0]);
    },
    (p) => {
      p.sources = Array(129).fill(p.sources[0]);
    },
    (p) => {
      p.extra = p;
    },
    (p) => {
      p.extra = Array(100001).fill(0);
    },
    (p) => {
      p.extra = Array.from({ length: 600 }, () => 'a'.repeat(16384));
    },
    (p) => {
      p.extra = Array.from({ length: 25 }).reduce((v) => [v], 0);
    },
  ]) {
    const p = physicalPack();
    mutate(p);
    assert.throws(() => inspectPhysicalContent(p));
  }
});
