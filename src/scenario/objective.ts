import type { ScenarioAction, VariableRef } from '../shared/scenario';
import { invariant } from '../map-freeze/validate';

/** A source objective snapshots its bound arguments when its action enters. */
export function objectiveText(
  action: Extract<ScenarioAction, { op: 'objective' }>,
  read: (ref: VariableRef) => unknown,
) {
  const values = (action.bindings ?? []).map((binding) => {
    const value = read(binding.ref);
    invariant(
      typeof value === 'number' && Number.isInteger(value),
      'Argomento obiettivo non intero.',
    );
    return { placeholder: binding.placeholder, value: String(value) };
  });
  return structuredClone(action.text).map((token) =>
    token.kind === 'text'
      ? {
          ...token,
          text: values.reduce(
            (text, binding) => text.replaceAll(binding.placeholder, binding.value),
            token.text,
          ),
        }
      : token,
  );
}
