import { DeploymentSourceSchema } from '../shared/deployment';
import { digest } from '../map-freeze/hash';
import { bounded, check, integer, list, object, unique } from './model';

export function compileSourceDeployment(raw: unknown) {
  bounded(raw);
  const source = DeploymentSourceSchema.parse(raw);
  unique(
    source.assets.map((a) => a.source),
    'Asset deployment',
  );
  const assets = new Map(source.assets.map((a) => [a.source, a]));
  for (const a of assets.values()) {
    check(
      source.files.some((f) => f.file === a.source.split(':')[0]),
      'File deployment assente.',
    );
    check(digest(a.data) === a.dataHash, 'Campi deployment alterati.');
  }
  const asset = (ref: string, cls: string) => {
    const a = assets.get(ref);
    check(a?.cls === cls, 'Dipendenza deployment mancante.');
    return a;
  };
  const pointer = (from: string, raw: unknown) => {
    const p = object(raw);
    check(
      p.m_FileID === 0 && Number.isSafeInteger(p.m_PathID) && p.m_PathID !== 0,
      'Puntatore deployment non chiuso.',
    );
    return `${from.split(':')[0]}:${p.m_PathID}`;
  };
  const adventure = asset(source.adventure, 'AdventureModel').data;
  const modelSources: string[] = [];
  for (const product of source.products) {
    const p = asset(product, 'ProductModel');
    for (const ref of list(p.data.Enemies)) {
      const key = pointer(product, ref);
      if (!modelSources.includes(key)) modelSources.push(key);
      asset(key, 'EnemyModel');
    }
  }
  check(
    source.assets.filter((a) => a.cls === 'EnemyModel').length === modelSources.length,
    'Pool deployment incompleto o estraneo.',
  );
  const filter = object(adventure.GlobalEnemyFilter);
  for (const k of ['MustHaveAny', 'MustHaveAll', 'ExcludeIfAny'])
    integer(filter[k], 'Filtro', 0, 2147483647);
  const eligible = modelSources.filter((s) => {
    const d = asset(s, 'EnemyModel').data;
    return !d.IsUnique && meetsEnemyFilter(integer(d.Traits, 'Traits', 0, 2147483647), filter);
  });
  const costs = (raw: unknown) =>
    list(raw).map((r) => {
      const row = object(r);
      return {
        size: integer(row.Num, 'Dimensione costo', 1, 3),
        points: integer(row.Cost, 'Costo', 1),
      };
    });
  const text = (key: unknown) => {
    check(
      typeof key === 'string' && typeof source.texts[key] === 'string',
      'Testo deployment mancante.',
    );
    return source.texts[key]!;
  };
  const bonusSources: string[] = [];
  const models = eligible.map((s) => {
    const d = asset(s, 'EnemyModel').data;
    const maximum = integer(d.MaxUnitCount, 'Massimo gruppo', 1, 3);
    check(
      integer(d.LinkedEnemyId, 'Modello collegato', -1) <= 0,
      'Disponibilità collegata non chiusa.',
    );
    const table = costs(d.Costs);
    unique(
      table.map((c) => c.size),
      'Costo modello',
    );
    check(table.length === maximum, 'Costo modello incompleto.');
    const bonuses = list(d.Bonuses).map((p) => pointer(s, p));
    unique(bonuses, 'Bonus modello');
    bonuses.forEach((b) => {
      if (!bonusSources.includes(b)) bonusSources.push(b);
    });
    return {
      source: s,
      modelId: integer(d._id, 'ID modello', 1),
      maximum,
      capacity: integer(d.MaxUnitsInPlay, 'Disponibilità', 1),
      costs: table,
      traits: integer(d.Traits, 'Traits', 0, 2147483647),
      bonuses,
      name: text(d.KeySingular),
      plural: text(d.KeyPlural),
      stats: {
        health: integer(d.Health, 'Salute', 1),
        armor: integer(d.Armor, 'Armatura'),
        sorcery: integer(d.Sorcery, 'Stregoneria'),
      },
    };
  });
  const bonuses = bonusSources.map((s) => {
    const d = asset(s, 'EnemyBonusModel').data;
    return {
      source: s,
      costs: costs(d.Costs),
      name: text(d.KeyName),
      text: text(d.KeyDescription),
      unsupported: !!object(d.UnsupportedLanguage)[source.language],
      traits: integer(d.Traits, 'Traits bonus', 0, 2147483647),
      blocks: integer(d.BlocksModifiers, 'Blocchi', 0, 2147483647),
      health: integer(d.Health, 'Salute bonus'),
      armor: integer(d.Armor, 'Armatura bonus'),
      sorcery: integer(d.Sorcery, 'Stregoneria bonus'),
      physical: integer(d.Physical, 'Danni bonus'),
      fear: integer(d.Fear, 'Paure bonus'),
    };
  });
  check(
    source.assets.filter((a) => a.cls === 'EnemyBonusModel').length === bonuses.length,
    'Closure bonus incompleta o estranea.',
  );
  const preferences = { bonus: Number(adventure.BonusPref), figure: Number(adventure.FigurePref) };
  check(
    Object.values(preferences).every((v) => Number.isFinite(v) && v >= 0 && v <= 100),
    'Preferenza deployment invalida.',
  );
  for (const ids of [source.mechanics.normalBanners, source.mechanics.eliteBanners])
    unique(ids, 'Banner');
  const compiled = { models, bonuses, preferences, ...source.mechanics };
  return { version: source.version, source, compiled, fingerprint: digest({ source, compiled }) };
}
export type DeploymentArtifact = ReturnType<typeof compileSourceDeployment>;
/** Native EnemyModel.AreLinked is symmetric; the named variant shares the ordinary figures. */
export function linkedEnemySources(
  source: DeploymentArtifact['source'],
  left: string,
  right: string,
) {
  const a = source.assets.find((a) => a.source === left && a.cls === 'EnemyModel')?.data,
    b = source.assets.find((a) => a.source === right && a.cls === 'EnemyModel')?.data;
  check(
    a && b && [a._id, a.LinkedEnemyId, b._id, b.LinkedEnemyId].every(Number.isSafeInteger),
    'Identità o disponibilità collegata assente.',
  );
  return left === right || a._id === b.LinkedEnemyId || b._id === a.LinkedEnemyId;
}
export function verifySourceDeployment(raw: unknown): DeploymentArtifact {
  bounded(raw);
  const a = object(raw),
    result = compileSourceDeployment(a.source);
  check(digest(result) === digest(raw), 'Deployment diverso dalla fonte compilata.');
  return result;
}
export function meetsEnemyFilter(traits: number, f: Record<string, unknown>) {
  const any = Number(f.MustHaveAny),
    all = Number(f.MustHaveAll),
    exclude = Number(f.ExcludeIfAny);
  return !(traits & exclude) && (!all || (traits & all) === all) && (!any || !!(traits & any));
}
