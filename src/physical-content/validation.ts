import { cardFacts, PHYSICAL_CONTENT_LIMITS } from './model';
import type { PhysicalPack } from './model';

function fail(message: string): never {
  throw new Error(`Physical input: ${message}`);
}
const unique = (values: (string | number)[], label: string) => {
  if (new Set(values).size !== values.length) fail(`${label}: duplicato.`);
};
const key = (r: { sourceId: string; locator: string }) => `${r.sourceId}\0${r.locator}`;

/** Rejects oversized/non-JSON trees before zod traverses untrusted arrays. */
export function boundPhysicalInput(value: unknown): void {
  let nodes = 0;
  let bytes = 0;
  const ancestors = new Set<object>();
  const visit = (v: unknown, depth: number): void => {
    if (++nodes > PHYSICAL_CONTENT_LIMITS.nodes || depth > PHYSICAL_CONTENT_LIMITS.depth)
      fail('Limite nodi/profondità.');
    if (typeof v === 'string') {
      if (v.length > PHYSICAL_CONTENT_LIMITS.string) fail('Limite stringa.');
      bytes += Buffer.byteLength(JSON.stringify(v));
    } else if (
      v === null ||
      typeof v === 'boolean' ||
      (typeof v === 'number' && Number.isFinite(v))
    )
      bytes += 8;
    else if (typeof v === 'object') {
      if (ancestors.has(v)) fail('Ciclo JSON.');
      if (!Array.isArray(v) && ![Object.prototype, null].includes(Object.getPrototypeOf(v)))
        fail('Richiesto oggetto JSON.');
      ancestors.add(v);
      if (Array.isArray(v) && v.length > PHYSICAL_CONTENT_LIMITS.nodes) fail('Limite array.');
      const entries = Object.getOwnPropertyDescriptors(v);
      if (!Array.isArray(v) && Reflect.ownKeys(entries).length > 64) fail('Limite campi.');
      for (const k of Reflect.ownKeys(entries)) {
        if (Array.isArray(v) && k === 'length') continue;
        if (typeof k !== 'string') fail('Chiave non JSON.');
        if (Array.isArray(v) && (!/^(0|[1-9][0-9]*)$/.test(k) || Number(k) >= v.length))
          fail('Proprietà array non JSON.');
        const descriptor = entries[k];
        if (!descriptor || !('value' in descriptor)) fail('Accessor non JSON.');
        if (!descriptor.enumerable) fail('Campo non enumerabile non JSON.');
        bytes += Buffer.byteLength(k) + 4;
        visit(descriptor.value, depth + 1);
      }
      ancestors.delete(v);
    } else fail('Valore non JSON.');
    if (bytes > PHYSICAL_CONTENT_LIMITS.bytes) fail('Limite byte.');
  };
  visit(value, 0);
}

/** Checks consistency only; evidence locators are data, never read or fetched. */
export function validatePhysicalPack(p: PhysicalPack): void {
  unique(
    p.sources.map((s) => s.id),
    'Fonte',
  );
  unique(
    p.cards.map((c) => c.id),
    'Carta',
  );
  unique(
    p.errata.map((e) => e.id),
    'Erratum',
  );
  const sources = new Map(p.sources.map((s) => [s.id, s]));
  const corrections = new Map(p.errata.map((e) => [e.id, e]));
  const requireSource = (r: { sourceId: string }) =>
    sources.get(r.sourceId) ?? fail(`Fonte inesistente: ${r.sourceId}.`);
  const aliasOwners = new Map<string, string>();
  const titleModels: string[] = [];
  const skillModels: string[] = [];
  const numbers: number[] = [];
  const allCopies = p.cards.flatMap((c) => c.copies.map((copy) => copy.id));
  if (allCopies.length > PHYSICAL_CONTENT_LIMITS.copies) fail('Limite copie.');
  unique(allCopies, 'ID copia');
  unique([...p.cards.map((c) => c.id), ...allCopies], 'ID definizione/copia');

  for (const [i, c] of p.cards.entries()) {
    if (c.order !== i) fail(`${c.id}: ordine non contiguo.`);
    for (const [field, f] of cardFacts(c)) {
      if (f.status !== 'verified' && !f.note.trim()) fail(`${c.id}.${field}: manca motivo.`);
      unique(f.evidence.map(key), `${c.id}.${field} prove`);
      unique(f.errataIds, `${c.id}.${field} errata`);
      for (const r of f.evidence) requireSource(r);
      for (const id of f.errataIds) {
        const e = corrections.get(id);
        if (!e || e.cardId !== c.id || !e.fields.includes(field))
          fail(`${c.id}.${field}: erratum non corrispondente.`);
        if (!f.evidence.some((r) => key(r) === key(e.reference)))
          fail(`${c.id}.${field}: manca prova correzione.`);
      }
    }
    const normalize = (s: string) => s.normalize('NFKC').trim().toLocaleLowerCase('it');
    unique(c.aliases.value.map(normalize), `${c.id} alias`);
    for (const name of [c.name.value, ...c.aliases.value]) {
      const alias = `${c.family}:${normalize(name)}`;
      const prior = aliasOwners.get(alias);
      if (prior && prior !== c.id) fail(`${c.id}: alias ambiguo con ${prior}.`);
      aliasOwners.set(alias, c.id);
    }
    const q = c.quantity.value;
    if (q === null) {
      if (c.quantity.status === 'verified' || c.copies.length)
        fail(`${c.id}: quantità ignota con attestazione/copie.`);
    } else if (c.copies.length !== q) fail(`${c.id}: copie diverse dalla quantità.`);
    if (c.copies.some((copy, index) => copy.ordinal !== index + 1))
      fail(`${c.id}: ordinale copia non contiguo.`);
    if (c.printing.value.type !== c.family) fail(`${c.id}: tipo stampa discordante.`);
    unique(c.printing.value.traits, `${c.id} tratti`);
    unique(
      c.printing.value.icons.map((icon) => icon.symbol),
      `${c.id} icone`,
    );
    unique(c.mechanics.symbols.value, `${c.id} simboli`);
    for (const field of ['timing', 'targets', 'duration', 'operations'] as const) {
      const f = c.mechanics[field];
      if (f.status === 'verified' && !f.value.length)
        fail(`${c.id}: ${field} meccanico verificato ma vuoto.`);
    }
    const title = c.family === 'title';
    if (title) {
      if (c.printing.status === 'verified' && c.printing.value.number === null)
        fail(`${c.id}: numero titolo assente.`);
      if (c.printing.value.number !== null) numbers.push(c.printing.value.number);
      if (c.quantity.status === 'verified' && q !== 1)
        fail(`${c.id}: un titolo ha una sola copia.`);
    } else if (c.printing.value.number !== null) fail(`${c.id}: numero stampato non applicabile.`);

    for (const f of [c.front, c.back]) {
      if (f.status === 'verified' && f.value.orientation === 'unknown')
        fail(`${c.id}: orientamento ignoto verificato.`);
    }
    const back = c.back.value.kind;
    const expectedBack = title
      ? 'skill-back'
      : c.family === 'boon'
        ? 'boon-back'
        : `${c.family}-back`;
    if (back !== expectedBack && !(back === 'unknown' && c.back.status !== 'verified'))
      fail(`${c.id}: retro incoerente.`);

    for (const f of [c.name, c.text]) {
      if (f.original) {
        const s = requireSource(f.original.reference);
        if (s.language !== f.original.language && s.language !== 'mul')
          fail(`${c.id}: lingua originale discordante.`);
      }
      if (f.origin === 'working-translation' && f.status === 'verified') {
        if (!f.original || f.original.language !== 'en' || !f.comparison)
          fail(`${c.id}: traduzione senza confronto/originale EN.`);
        if (!f.evidence.some((r) => key(r) === key(f.original!.reference)))
          fail(`${c.id}: originale non citato.`);
      }
      if (f.status === 'verified' && f.origin !== 'working-translation') {
        const kinds =
          f.origin === 'app-localization'
            ? ['app-localization']
            : [
                'official-rules',
                'official-corrected-card',
                'official-errata',
                'original-card-image',
              ];
        if (
          !f.evidence.some((r) => {
            const s = requireSource(r);
            return s.language === 'it' && kinds.includes(s.kind);
          })
        )
          fail(`${c.id}: origine IT senza fonte IT appropriata.`);
      }
    }

    const u = c.usage.value;
    if (title && c.usage.status === 'verified' && !u.acquisitionNotes.length)
      fail(`${c.id}: mancano istruzioni di acquisizione.`);
    if (
      u.requiresPrepared !== title ||
      u.ownership !== (title ? 'campaign' : 'adventure') ||
      u.acquire !== (title ? 'app-instruction' : c.family === 'boon' ? 'supply' : 'suffer') ||
      u.prepareOnGain !== (title ? 'unless-instructed-otherwise' : 'not-applicable') ||
      u.removedUntil !== (title ? 'next-adventure' : 'not-applicable') ||
      u.initialFace !== (title || c.family === 'boon' ? 'faceup' : 'instruction')
    )
      fail(`${c.id}: uso famiglia incoerente.`);

    const b = c.binding.value;
    if (!title && b !== null) fail(`${c.id}: binding titolo non applicabile.`);
    if (title && !b && c.binding.status === 'verified') fail(`${c.id}: TitleModel assente.`);
    if (b) {
      for (const m of [b.titleModel, ...b.skillModels]) {
        if (requireSource(m).kind !== 'app-model')
          fail(`${c.id}: binding non proviene da modello.`);
      }
      titleModels.push(key(b.titleModel));
      skillModels.push(...b.skillModels.map(key));
      if ((b.skillStatus === 'linked') !== b.skillModels.length > 0)
        fail(`${c.id}: stato binding discordante.`);
      if (b.skillStatus === 'absent-in-checked-base' && !c.binding.note.trim())
        fail(`${c.id}: assenza binding senza perimetro.`);
    }
  }
  unique(numbers, 'Numero titolo');
  unique(titleModels, 'TitleModel');
  unique(skillModels, 'SkillModel titolo');

  for (const e of p.errata) {
    const c = p.cards.find((card) => card.id === e.cardId);
    if (!c) fail(`${e.id}: carta correzione inesistente.`);
    if (!['official-errata', 'official-corrected-card'].includes(requireSource(e.reference).kind))
      fail(`${e.id}: fonte correzione non ufficiale.`);
    if (e.original) requireSource(e.original.reference);
    if (e.disposition === 'applied' && !e.original) fail(`${e.id}: originale non conservato.`);
    unique(e.fields, `${e.id} campi`);
    for (const field of e.fields) {
      const f = cardFacts(c).find(([name]) => name === field)![1];
      if (!f.errataIds.includes(e.id)) fail(`${e.id}: correzione non collegata dal campo.`);
      if (e.disposition === 'applied' && f.value === e.original?.text)
        fail(`${e.id}: testo originale ancora attivo.`);
    }
  }
}
