import { createHash } from 'node:crypto';
import {
  verifySourceDeployment,
  meetsEnemyFilter,
  type DeploymentArtifact,
} from './deployment-compiler';
import { check } from './model';
import { createFigures } from './figures';
import type { DeployedGroup } from '../shared/deployment';

type Space = {
  id: string;
  sectionId: number;
  tileSource: string;
  position: [number, number, number];
  connected: string[];
  outside: boolean;
};
export type DeploymentContext = {
  id: string;
  entropy: string;
  cursor: number;
  heroes: number;
  threat: number;
  limit: number;
  points: number;
  enemyPoints: number;
  excludeGameEnemyPoints: boolean;
  filter: { MustHaveAny: number; MustHaveAll: number; ExcludeIfAny: number };
  sections: number[] | null;
  reserved: { source: string; count: number }[];
  inPlay: DeployedGroup[];
  spaces: Space[];
};
const f = Math.fround;
/** Source selection algorithm with an independent, journaled stream; not Unity RNG parity. */
export function generateDeployment(raw: DeploymentArtifact, context: DeploymentContext) {
  const { compiled: a } = verifySourceDeployment(raw);
  const c = structuredClone(context);
  check(
    /^[a-f0-9]{64}$/.test(c.entropy) && Number.isInteger(c.cursor),
    'Entropia deployment invalida.',
  );
  const groups: DeployedGroup[] = [],
    draws: { kind: string; population: string[]; value: number; cursor: number }[] = [];
  let remaining = c.points + (c.excludeGameEnemyPoints ? 0 : c.enemyPoints),
    cursor = c.cursor;
  const initial = remaining;
  const word = () =>
    createHash('sha256')
      .update(`source-deployment-v1:${c.entropy}:${cursor++}`)
      .digest()
      .readUInt32BE(0);
  const pick = <T>(kind: string, values: T[], key: (v: T) => string): T => {
    check(
      values.length > 0 && values.length <= 1000,
      'Popolazione deployment vuota o fuori limite.',
    );
    const bound = 0x100000000 - (0x100000000 % values.length);
    for (let n = 0; n < 128; n++) {
      const value = word();
      if (value >= bound) continue;
      const index = value % values.length;
      draws.push({ kind, population: values.map(key), value: index, cursor });
      return values[index]!;
    }
    throw new Error('Budget casuale deployment superato.');
  };
  const shuffle = <T>(kind: string, values: T[], key: (v: T) => string) => {
    for (let n = values.length - 1; n > 0; n--) {
      const selected = pick(kind, values.slice(0, n + 1), key),
        j = values.indexOf(selected);
      [values[n], values[j]] = [values[j]!, values[n]!];
    }
  };
  const model = (g: DeployedGroup) => a.models.find((m) => m.source === g.source)!;
  const bonus = (ref: string) => a.bonuses.find((b) => b.source === ref)!;
  const cost = (table: { size: number; points: number }[], size: number) =>
    table.find((r) => r.size === size)?.points ?? -1;
  const units = (source: string) =>
    [...c.inPlay, ...groups]
      .filter((g) => g.source === source)
      .reduce((n, g) => n + g.figures.filter((f) => f.health > 0).length, 0) +
    c.reserved.filter((r) => r.source === source).reduce((n, r) => n + r.count, 0);
  const eligible = () =>
    a.models.filter(
      (m) =>
        meetsEnemyFilter(m.traits, c.filter) &&
        cost(m.costs, 1) <= remaining &&
        units(m.source) < m.capacity,
    );
  const spaces = c.spaces.filter((s) => !c.sections || c.sections.includes(s.sectionId));
  const result = (reason: 'no-budget' | 'no-space' | 'no-eligible-model' | null) => ({
    groups,
    remaining,
    cursor,
    draws,
    reason,
  });
  if (remaining <= 0) return result('no-budget');
  if (!spaces.length) return result('no-space');
  if (!eligible().length) return result('no-eligible-model');
  let created = 0;
  const spawn = () => {
    const m = pick('model', eligible(), (m) => m.source),
      id = `${c.id}/group/${created++}`;
    remaining -= cost(m.costs, 1);
    groups.push({
      id,
      source: m.source,
      bonuses: [],
      tokenId: -1,
      exhausted: false,
      logic: null,
      placed: false,
      spaceId: '',
      tileSource: spaces[0]!.tileSource,
      position: [0, 0, 0],
      figures: createFigures(id, 1, m.stats),
    });
  };
  const addBonus = () => {
    const elites = [...c.inPlay, ...groups].filter((g) => g.bonuses.length).length;
    for (const g of groups) {
      if (
        (!g.bonuses.length && elites >= a.eliteBanners.length) ||
        g.bonuses.length >= a.maxBonusCount
      )
        continue;
      const choices = model(g)
        .bonuses.map(bonus)
        .filter(
          (b) =>
            !b.unsupported &&
            !g.bonuses.includes(b.source) &&
            cost(b.costs, g.figures.length) >= 0 &&
            cost(b.costs, g.figures.length) <= remaining &&
            !g.bonuses.some((ref) => !!(bonus(ref).traits & b.traits)),
        );
      if (!choices.length) continue;
      const b = pick('bonus', choices, (b) => b.source);
      g.bonuses.push(b.source);
      for (const figure of g.figures) {
        figure.health += b.health;
        figure.armor += b.armor;
        figure.sorcery += b.sorcery;
      }
      remaining -= cost(b.costs, g.figures.length);
      return true;
    }
    return false;
  };
  const addFigure = () => {
    for (const g of groups) {
      const m = model(g),
        size = g.figures.length;
      if (size >= m.maximum || units(m.source) >= m.capacity) continue;
      const points =
        cost(m.costs, size + 1) -
        cost(m.costs, size) +
        g.bonuses.reduce(
          (n, ref) => n + cost(bonus(ref).costs, size + 1) - cost(bonus(ref).costs, size),
          0,
        );
      if (points > remaining) continue;
      const first = g.figures[0]!;
      g.figures.push({ ...first, id: `${g.id}/figure/${size}` });
      remaining -= points;
      return true;
    }
    return false;
  };
  spawn();
  const spentTarget = f(
    f(0.7) + f(f(1 - f(0.7)) * f(Math.min(1, Math.max(0, f(c.threat / c.limit))))),
  );
  for (let n = 0; remaining > 0; n++) {
    check(n < 1000, 'Budget di selezione deployment superato.');
    const available = eligible().length > 0;
    let groupWeight = available
      ? f(f(c.heroes * c.heroes) / f(groups.length + c.inPlay.length))
      : 0;
    const bonusWeight = f(
      f(
        f(c.heroes * c.heroes) /
          f(c.heroes + [...c.inPlay, ...groups].filter((g) => g.bonuses.length).length),
      ) * f(a.preferences.bonus),
    );
    let figureWeight = f(f(c.heroes + 3) * f(a.preferences.figure));
    const selected = f(f(word() / 0xffffffff) * f(f(groupWeight + bonusWeight) + figureWeight));
    draws.push({
      kind: 'weight',
      population: ['group', 'bonus', 'figure'],
      value: selected,
      cursor,
    });
    shuffle('group-order', groups, (g) => g.id);
    let newGroup = selected < groupWeight;
    if (!newGroup && selected < f(groupWeight + bonusWeight)) {
      if (!addBonus()) {
        groupWeight = available ? f(groupWeight + f(bonusWeight / 2)) : 0;
        figureWeight = available ? f(figureWeight + f(bonusWeight / 2)) : 1;
        newGroup = selected < groupWeight || !addFigure();
      }
    } else if (!newGroup && !addFigure()) {
      groupWeight = available ? f(groupWeight + f(figureWeight / 2)) : 0;
      newGroup = selected < groupWeight || !addBonus();
    }
    if (newGroup) {
      if (!available) break;
      spawn();
    }
    if (f(1 - f(remaining / initial)) > spentTarget) break;
  }
  assignGroupTokens(a, c.inPlay, groups);
  shuffle('space-order', spaces, (s) => s.id);
  const placed: DeployedGroup[] = [];
  for (const g of groups) {
    const s =
      spaces.find(
        (s) =>
          s.outside && !placed.some((p) => p.spaceId === s.id || s.connected.includes(p.spaceId)),
      ) ?? pick('space-fallback', spaces, (s) => s.id);
    g.spaceId = s.id;
    g.tileSource = s.tileSource;
    g.position = [...s.position];
    placed.push(g);
  }
  return result(null);
}

/** Shared source banner allocation for generated and source-fixed groups. */
export function assignGroupTokens(
  a: DeploymentArtifact['compiled'],
  inPlay: DeployedGroup[],
  groups: DeployedGroup[],
) {
  const used = inPlay.map((g) => g.tokenId);
  const normals = a.normalBanners.filter((id) => !used.includes(id)),
    elites = a.eliteBanners.filter((id) => !used.includes(id));
  const assigned = [...inPlay];
  for (const g of groups) {
    const ids = g.bonuses.length ? elites : normals;
    if (
      g.bonuses.length ||
      assigned.some((old) => old.source === g.source && !old.bonuses.length)
    ) {
      check(ids.length, 'Banner deployment esauriti.');
      g.tokenId = ids.shift()!;
    }
    assigned.push(g);
  }
}
