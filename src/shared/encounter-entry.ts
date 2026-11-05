import type { ScenarioPack, ScenarioInstance, ScenarioAction } from './scenario';

type EntryAction = Extract<ScenarioAction, { op: 'confirm' | 'choice' }>;
/** Inspection reads only the source's boolean dispatch; it never enters a state. */
export function encounterEntry(
  pack: ScenarioPack,
  instance: ScenarioInstance,
  globals: ScenarioInstance['variables'],
): { state: number; action: EntryAction } | null {
  const d = pack.definitions.find((d) => d.source === instance.definition);
  const current = d?.states.find((s) => s.index === instance.state);
  let index = current?.transitions['NODE CLICKED'] ?? d?.handlers['NODE CLICKED'];
  const visited = new Set<number>();
  while (d && index !== undefined && !visited.has(index)) {
    visited.add(index);
    const s = d.states.find((s) => s.index === index);
    if (!s || s.actions.length !== 1) return null;
    const a = s.actions[0]!;
    if (a.op === 'confirm' || a.op === 'choice') return { state: s.index, action: a };
    if (a.op !== 'branchBool') return null;
    const v = (a.ref.scope === 'local' ? instance.variables : globals)[a.ref.name];
    if (typeof v !== 'boolean') return null;
    index = s.transitions[v ? a.trueEvent : a.falseEvent];
  }
  return null;
}
export function encounterOptions(
  action: Extract<ScenarioAction, { op: 'choice' }>,
  instance: ScenarioInstance,
  globals: ScenarioInstance['variables'],
) {
  return action.options.filter(
    (o) =>
      !o.requirement ||
      (o.requirement.scope === 'local' ? instance.variables : globals)[o.requirement.name] === true,
  );
}
