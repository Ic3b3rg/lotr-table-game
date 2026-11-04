import type { Projection } from '../shared/generated-map';
import { comparisonSort } from '../map-generation/comparison-sort';

/** Re-sort after each reveal, using the frozen source connectivity and source small-sort policy. */
export function sectionOrder(p: Projection, sectionId: number, initiallyVisible: Set<string>) {
  const visible = new Set(initiallyVisible);
  const remaining = p.sections
    .find((s) => s.id === sectionId)!
    .tiles.filter((t) => !visible.has(t.source))
    .map((t) => t.source);
  const order: string[] = [];
  while (remaining.length) {
    const touches = (source: string) =>
      p.spaces
        .filter((s) => s.tileSource === source)
        .some((s) =>
          s.connected.some((id) => visible.has(p.spaces.find((s) => s.id === id)!.tileSource)),
        );
    comparisonSort(remaining, (a, b) => Number(touches(b)) - Number(touches(a)));
    const next = remaining.shift()!;
    order.push(next);
    visible.add(next);
  }
  return order;
}
