import { createHash } from 'node:crypto';
import type { CampDepartureCapability } from '../shared/camp-departure';
import type { DeployedGroup } from '../shared/deployment';
import { compileSourceDeployment, meetsEnemyFilter } from '../combat/deployment-compiler';
import { assignGroupTokens } from '../combat/deployment';
import { createFigures } from '../combat/figures';
import { verifyBattleMapArtifact } from '../battle-map';
import { invariant } from '../map-freeze/validate';

const f = Math.fround;
/** #120 / pinned 0x06001125, 1129–112e. Source choices, independent RNG; no Unity parity. */
export function generateBattleDeployment(
  cap: CampDepartureCapability,
  heroes: number,
  entropy: string,
) {
  invariant(
    cap.spawnPolicy === 'source-spawn-points-v1' &&
      heroes >= 2 &&
      heroes <= 5 &&
      /^[a-f0-9]{64}$/.test(entropy),
    'Fonte/casualità spawn battaglia non valida.',
  );
  const a = compileSourceDeployment(cap.deployment).compiled;
  const map = verifyBattleMapArtifact(cap.board, { artifactFingerprint: cap.boardFingerprint });
  const layout = map.compiled.layouts.find((l) => l.id === map.compiled.selectedAlternative)!;
  const points = cap.instructions.filter((i) => i.op === 'spawn');
  invariant(
    points.length === 3 && a.eliteBanners.length === 6 && a.normalBanners.length === 6,
    'Punti o riserva stendardi non attestati.',
  );
  const budgets = points.map((p) => p.perHero * heroes),
    finished = points.map(() => false),
    pending: DeployedGroup[][] = points.map(() => []),
    creation: DeployedGroup[] = [];
  const attempts = points.map((_, n) => ({
    effectId: `battle:${cap.instructions.indexOf(points[n]!)}`,
    groups: [] as string[],
    remaining: 0,
    reason: null as 'no-budget' | 'no-eligible-model' | null,
    draws: [] as { kind: string; population: string[]; value: number; cursor: number }[],
  }));
  let cursor = 0,
    sequence = 0,
    point = 0;
  const word = () =>
    createHash('sha256')
      .update(`battle-spawn-points-v1:${entropy}:${cursor++}`)
      .digest()
      .readUInt32BE(0);
  const pick = <T>(kind: string, values: T[], id: (value: T) => string): T => {
    invariant(
      values.length > 0 && values.length <= 1000,
      'Popolazione spawn vuota o oltre limite.',
    );
    let index = 0;
    if (values.length > 1) {
      const bound = 0x100000000 - (0x100000000 % values.length);
      let accepted = false;
      for (let n = 0; n < 128; n++) {
        const value = word();
        if (value < bound) {
          index = value % values.length;
          accepted = true;
          break;
        }
      }
      invariant(accepted, 'Budget casualità spawn superato.');
    }
    const selected = values[index]!;
    // GetRandomElement does not draw for a singleton. Its choice still has a trace.
    const owner = kind === 'spawn-point' ? Number(selected) : point;
    attempts[owner]!.draws.push({ kind, population: values.map(id), value: index, cursor });
    return selected;
  };
  const randomize = (groups: DeployedGroup[]) => {
    for (let n = 0; n < groups.length; n++) {
      const chosen = pick(
        'group-order',
        groups.map((_, n) => n),
        String,
      );
      [groups[n], groups[chosen]] = [groups[chosen]!, groups[n]!];
    }
  };
  const model = (g: DeployedGroup) => a.models.find((m) => m.source === g.source)!;
  const bonus = (source: string) => a.bonuses.find((b) => b.source === source)!;
  const cost = (rows: { size: number; points: number }[], n: number) =>
    rows.find((r) => r.size === n)?.points ?? -1;
  const total = (source: string) =>
    creation.filter((g) => g.source === source).reduce((n, g) => n + g.figures.length, 0) +
    cap.reserved.filter((r) => r.source === source).reduce((n, r) => n + r.count, 0);
  const eligible = () =>
    a.models.filter(
      (m) =>
        meetsEnemyFilter(m.traits, points[point]!.filter) &&
        cost(m.costs, 1) <= budgets[point]! &&
        total(m.source) < m.capacity,
    );
  const withBonuses = (groups: DeployedGroup[]) => groups.filter((g) => g.bonuses.length).length;
  const addBonus = () => {
    const mayBecomeElite = withBonuses(creation) < 6 - cap.reservedEliteBanners;
    for (const g of pending[point]!) {
      if ((!g.bonuses.length && !mayBecomeElite) || g.bonuses.length >= a.maxBonusCount) continue;
      const choices = model(g)
        .bonuses.map(bonus)
        .filter(
          (b) =>
            !b.unsupported &&
            !g.bonuses.includes(b.source) &&
            cost(b.costs, g.figures.length) >= 0 &&
            cost(b.costs, g.figures.length) <= budgets[point]! &&
            !g.bonuses.some((ref) => !!(bonus(ref).traits & b.traits)),
        );
      if (!choices.length) continue;
      const b = pick('bonus', choices, (b) => b.source);
      g.bonuses.push(b.source);
      for (const unit of g.figures) {
        unit.health += b.health;
        unit.armor += b.armor;
        unit.sorcery += b.sorcery;
      }
      budgets[point]! -= cost(b.costs, g.figures.length);
      return true;
    }
    return false;
  };
  const addFigure = () => {
    for (const g of pending[point]!) {
      const m = model(g),
        size = g.figures.length;
      if (size >= m.maximum || total(m.source) >= m.capacity) continue;
      const price =
        cost(m.costs, size + 1) -
        cost(m.costs, size) +
        g.bonuses.reduce(
          (n, b) => n + cost(bonus(b).costs, size + 1) - cost(bonus(b).costs, size),
          0,
        );
      if (price > budgets[point]!) continue;
      g.figures.push({ ...g.figures[0]!, id: `${g.id}/figure/${size}` });
      budgets[point]! -= price;
      return true;
    }
    return false;
  };
  for (let guard = 0; ; guard++) {
    const live = points.map((_, n) => n).filter((n) => budgets[n]! > 0 && !finished[n]);
    if (!live.length) break;
    invariant(guard < 1000, 'Budget esecuzione spawn battaglia superato.');
    point = pick('spawn-point', live, String);
    const choices = eligible(),
      groups = pending[point]!;
    let newGroup = !groups.length;
    if (!newGroup) {
      let groupWeight = choices.length ? f(f(heroes * heroes) / f(groups.length)) : 0;
      const bonusWeight = f(
        f(f(heroes * heroes) / f(heroes + withBonuses(groups))) * f(a.preferences.bonus),
      );
      let figureWeight = f(f(heroes + 3) * f(a.preferences.figure));
      const selected = f(f(word() / 0xffffffff) * f(f(groupWeight + bonusWeight) + figureWeight));
      attempts[point]!.draws.push({
        kind: 'weight',
        population: ['group', 'bonus', 'figure'],
        value: selected,
        cursor,
      });
      randomize(groups);
      if (selected < groupWeight) newGroup = true;
      else if (selected < f(groupWeight + bonusWeight)) {
        if (!addBonus()) {
          groupWeight = choices.length ? f(groupWeight + f(bonusWeight / 2)) : 0;
          figureWeight = choices.length ? f(figureWeight + f(bonusWeight / 2)) : 1;
          newGroup = selected < groupWeight || !addFigure();
        }
      } else if (!addFigure()) {
        groupWeight = choices.length ? f(groupWeight + f(figureWeight / 2)) : 0;
        newGroup = selected < groupWeight || !addBonus();
      }
    }
    if (newGroup) {
      if (!choices.length) finished[point] = true;
      else {
        const m = pick('model', choices, (m) => m.source),
          anchor = layout.placements.find((p) => p.id === points[point]!.anchor)!,
          id = `battle-spawn/group/${sequence++}`;
        const g: DeployedGroup = {
          id,
          source: m.source,
          bonuses: [],
          tokenId: -1,
          exhausted: false,
          logic: null,
          placed: false,
          spaceId: anchor.cell!,
          tileSource: cap.target.model,
          position: [...anchor.position],
          figures: createFigures(id, 1, m.stats),
        };
        groups.push(g);
        creation.push(g);
        budgets[point]! -= cost(m.costs, 1);
      }
    }
  }
  // Reservation reduces elite capacity; the source allocates remaining IDs in order.
  assignGroupTokens(
    { ...a, eliteBanners: a.eliteBanners.slice(0, 6 - cap.reservedEliteBanners) },
    [],
    creation,
  );
  for (const [n, groups] of pending.entries()) {
    attempts[n]!.groups = groups.map((g) => g.id);
    attempts[n]!.remaining = budgets[n]!;
    attempts[n]!.reason = budgets[n] === 0 ? 'no-budget' : 'no-eligible-model';
  }
  return { groups: pending.flat(), attempts, cursor };
}
