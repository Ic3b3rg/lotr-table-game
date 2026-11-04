/** Shared figure materialization for the kernel and source deployments. */
export function createFigures(
  id: string,
  size: number,
  stats: { health: number; armor: number; sorcery: number },
) {
  return Array.from({ length: size }, (_, n) => ({ id: `${id}/figure/${n}`, ...stats }));
}
