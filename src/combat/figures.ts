/** Shared figure materialization for the kernel and source deployments. */
export function createFigures(
  id: string,
  size: number,
  stats: { health: number; armor: number; sorcery: number },
) {
  return Array.from({ length: size }, (_, n) => ({ id: `${id}/figure/${n}`, ...stats }));
}

/** Shared hit application: defenses absorb temporarily on each figure in source order. */
export function resolveFigureHits(
  figures: { id: string; health: number; armor: number; sorcery: number }[],
  hits: number,
  pierce: boolean,
  smite = false,
) {
  const wasAlive = figures.some((f) => f.health > 0);
  const removed: string[] = [];
  let residual = hits,
    applied = 0;
  for (const f of figures) {
    if (!f.health) continue;
    if (!pierce) residual -= Math.min(residual, f.armor);
    if (!smite) residual -= Math.min(residual, f.sorcery);
    const suffered = Math.min(residual, f.health);
    f.health -= suffered;
    residual -= suffered;
    applied += suffered;
    if (!f.health) {
      f.armor = 0;
      f.sorcery = 0;
      removed.push(f.id);
    }
  }
  return {
    removed,
    unusedHits: residual,
    applied,
    defeated: wasAlive && figures.every((f) => f.health === 0),
  };
}
