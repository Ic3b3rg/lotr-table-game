import { createHash } from 'node:crypto';
import { digest } from '../map-freeze/hash';
import {
  CombatClosureArtifactSchema,
  CombatClosureSourceSchema,
  AttackModifierSchema,
} from '../shared/combat';
import { bounded, check, integer, list, object, stat, unique } from './model';
export const modifierBits = {
  pierce: 1,
  smite: 2,
  lethal: 4,
  sunder: 8,
  stun: 16,
  cleave: 32,
} as const;
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

/** The second closure extends the native compiler; reviewed prose policies remain source-bound data. */
export function compileCombatClosure(raw: unknown) {
  bounded(raw);
  const source = CombatClosureSourceSchema.parse(raw);
  unique(source.models, 'Modello combattimento');
  unique(
    source.assets.map((a) => a.source),
    'Asset combattimento',
  );
  unique(
    source.texts.map((t) => t.key),
    'Testo combattimento',
  );
  unique(
    source.additions.map((a) => a.key),
    'Aggiunta combattimento',
  );
  unique(
    source.items.map((i) => i.id),
    'Oggetto combattimento',
  );
  unique(
    source.definitions.map((d) => d.id),
    'Definizione compagnia',
  );
  unique(
    source.clauses.map((c) => `${c.cardId}:${c.clause}`),
    'Clausola compagnia',
  );
  const assets = new Map(source.assets.map((a) => [a.source, a]));
  for (const a of assets.values()) {
    check(
      source.files.some((f) => f.file === a.source.split(':')[0]),
      'File asset assente.',
    );
    check(digest(a.data) === a.dataHash, 'Campi combattimento alterati.');
  }
  const asset = (ref: string, cls: string) => {
    const a = assets.get(ref);
    check(a?.cls === cls, 'Dipendenza combattimento assente.');
    return a;
  };
  const pointer = (from: string, raw: unknown) => {
    const p = object(raw);
    check(
      p.m_FileID === 0 && Number.isSafeInteger(p.m_PathID) && p.m_PathID !== 0,
      'Puntatore non chiuso.',
    );
    return `${from.split(':')[0]}:${p.m_PathID}`;
  };
  for (const t of source.texts) {
    check(
      source.files.some((f) => f.file === t.file),
      'Fonte testo assente.',
    );
    check(sha(t.value) === t.sha256, 'Testo alterato.');
  }
  const text = (raw: unknown) => {
    const t = source.texts.find((t) => t.key === raw);
    check(t, 'Testo istruzione mancante.');
    return t;
  };
  for (const a of source.additions)
    check(text(a.key).sha256 === a.textHash, 'Policy aggiunta non legata al testo.');
  const bonusRefs: string[] = [];
  const instructionRefs: string[] = [];
  const models = source.models.map((ref) => {
    const d = asset(ref, 'EnemyModel').data;
    const maximum = integer(d.MaxUnitCount, 'Massimo gruppo', 1, 3);
    const instructions = list(d.Activations).map((p, order) => {
      const refI = pointer(ref, p);
      instructionRefs.push(refI);
      const i = asset(refI, 'EnemyActivationModel').data;
      const minimum = integer(i.MinGroupSize, 'Minimo istruzione', 1, 3);
      const max = integer(i.MaxGroupSize, 'Massimo istruzione', minimum, 3);
      const flavor = text(i.KeyAttackFlavor);
      const icons = [
        ['\uf464', 'might'],
        ['\uf463', 'agility'],
        ['\uf462', 'spirit'],
        ['\uf460', 'wisdom'],
        ['\uf472', 'wit'],
      ] as const;
      const stats = icons.filter(
        ([icon, s]) => flavor.value.includes(icon) || flavor.value.includes(`[${s}]`),
      );
      check(stats.length === 1, 'Caratteristica negazione ambigua.');
      const damage = list(i.Damage).map((r) => {
        const row = object(r);
        return {
          size: integer(row.Size, 'Dimensione importi', 1, maximum),
          damage: integer(row.Physical, 'Danni', 0, 56),
          fear: integer(row.Fear, 'Paure', 0, 56),
        };
      });
      unique(
        damage.map((r) => r.size),
        'Dimensione importi',
      );
      const extra = i.KeyAttackAdditionalEffect;
      check(typeof extra === 'string', 'Chiave aggiunta assente.');
      const addition = extra ? source.additions.find((a) => a.key === extra) : null;
      check(!extra || addition, 'Aggiunta non compilata.');
      return {
        source: refI,
        order,
        minimum,
        maximum: max,
        negate: stat.parse(stats[0]![1]),
        damage,
        text: flavor,
        addition: addition ?? null,
        dataHash: asset(refI, 'EnemyActivationModel').dataHash,
      };
    });
    check(instructions.length > 0, 'Pool vuoto.');
    unique(
      instructions.map((i) => i.source),
      'Istruzione modello',
    );
    const bonuses = list(d.Bonuses).map((p) => pointer(ref, p));
    for (const b of bonuses) {
      asset(b, 'EnemyBonusModel');
      if (!bonusRefs.includes(b)) bonusRefs.push(b);
    }
    const special = list(d.SpecialActivations ?? []).map((p) => pointer(ref, p));
    special.forEach((s) => asset(s, 'EnemyActivationModel'));
    return {
      source: ref,
      maximum,
      ranged: !!(integer(d.Traits, 'Tratti', 0, 2147483647) & 1024),
      bonuses,
      instructions,
      special,
    };
  });
  const bonuses = bonusRefs.map((ref) => {
    const d = asset(ref, 'EnemyBonusModel').data;
    const mask = integer(d.BlocksModifiers, 'Immunità modificatori', 0, 63);
    return {
      source: ref,
      traits: integer(d.Traits, 'Tratti bonus', 0, 4095),
      blocked: AttackModifierSchema.options.filter((m) => mask & modifierBits[m]),
      damage: integer(d.Physical, 'Bonus danni', 0, 56),
      fear: integer(d.Fear, 'Bonus paure', 0, 56),
      ranged: !!(integer(d.Traits, 'Tratti bonus', 0, 4095) & 2048),
      languageEligible: !object(d.UnsupportedLanguage).Italian,
    };
  });
  check(
    source.assets.filter((a) => a.cls === 'EnemyModel').length === models.length,
    'Modelli omessi o estranei.',
  );
  check(
    source.assets.filter((a) => a.cls === 'EnemyBonusModel').length === bonuses.length,
    'Bonus omessi o estranei.',
  );
  const allInstructions = new Set([...instructionRefs, ...models.flatMap((m) => m.special)]);
  check(
    source.assets
      .filter((a) => a.cls === 'EnemyActivationModel')
      .every((a) => allInstructions.has(a.source)),
    'Istruzione estranea.',
  );
  check(
    source.additions.every((a) =>
      models.some((m) => m.instructions.some((i) => i.addition?.key === a.key)),
    ),
    'Policy estranea.',
  );
  const items = source.items.map((row) => {
    const slots =
      row.stat === null
        ? []
        : row.body
            .split(/\r?\n/)
            .filter((s) => s.trim())
            .map((line, index) => {
              const match =
                /^([1-9][0-9]*) Success(?:es)?: ([0-9]+) hits?(?:, (pierce|stun))?$/.exec(
                  line.trim(),
                );
              check(match, 'Slot arma fuori dalla closure.');
              return {
                id: `${row.id}/slot/${index}`,
                cost: integer(Number(match[1]), 'Costo slot', 1, 100),
                hits: integer(Number(match[2]), 'Colpi slot', 0, 1000),
                modifiers: match[3] ? [AttackModifierSchema.parse(match[3])] : [],
                locator: `${row.locator}/line/${index + 1}`,
              };
            });
    check(slots.length <= 16, 'Troppi slot.');
    return {
      id: row.id,
      model: row.model,
      definitionHash: row.definitionHash,
      stat: row.stat,
      ranged: row.ranged,
      slots,
    };
  });
  for (const d of source.definitions) {
    const clauses = source.clauses.filter((c) => c.cardId === d.id);
    check(
      clauses.length === d.clauses &&
        clauses.every(
          (c, n) =>
            c.clause === n &&
            c.definitionHash === d.definitionHash &&
            c.originalHash === d.originalHash,
        ),
      'Clausole omesse o non legate alla definizione.',
    );
  }
  check(
    source.clauses.every((c) => source.definitions.some((d) => d.id === c.cardId)),
    'Clausola estranea.',
  );
  const compiled = { models, bonuses, items, clauses: source.clauses, heroes: source.heroes };
  return {
    version: 'combat-closure-v1' as const,
    source,
    compiled,
    fingerprint: digest({ source, compiled }),
  };
}
export type CombatClosure = ReturnType<typeof compileCombatClosure>;
export function verifyCombatClosure(raw: unknown): CombatClosure {
  bounded(raw);
  const artifact = CombatClosureArtifactSchema.parse(raw);
  const expected = compileCombatClosure(artifact.source);
  check(digest(artifact) === digest(expected), 'Artefatto combattimento non derivato dalla fonte.');
  return expected;
}
