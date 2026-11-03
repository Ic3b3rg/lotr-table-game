import type { State } from '../server/state';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';
import { sourceCursor, sourceTile } from './source-cursor';

/** Check both the active continuation and the callback prefix of completed exploration. */
export function validateSourceTasks(state: State) {
  const sc = state.scenario!;
  invariant(state.mapGeneration?.status === 'frozen', 'Continuazione senza realizzazione.');
  const projection = state.mapGeneration.projection;
  const actual = sc.events.filter((e) => e.event === 'PRE_REVEAL' || e.event === 'REVEALED');
  const expected: { event: string; receivers: string[] }[] = [];
  const counts = new Map<string, number>();
  const observed = new Map<string, number>();
  for (const event of actual)
    for (const id of event.receivers) observed.set(id, (observed.get(id) ?? 0) + 1);
  invariant(
    new Set(sc.tasks.map((t) => `${t.instanceId}:${t.entry}:${t.action}`)).size === sc.tasks.length,
    'Continuazioni duplicate.',
  );
  for (const task of sc.tasks) {
    const effect = sc.effects.find(
      (e) => e.instanceId === task.instanceId && e.entry === task.entry && e.action === task.action,
    );
    invariant(effect, 'Continuazione senza entry fonte.');
    const { instance, action, completed } = sourceCursor(state, effect);
    invariant(
      !completed && instance.entry === task.entry && action.op === task.kind,
      'Continuazione fuori dall’azione fonte.',
    );
    if (task.kind === 'section') {
      invariant(
        action.op === 'section' &&
          task.sectionId === action.sectionId &&
          task.tileIndex < projection.sections.find((s) => s.id === task.sectionId)!.tiles.length,
        'Cursore sezione fuori dalla fonte.',
      );
    }
    if (task.kind === 'physical') {
      const parent = state.physical?.snapshot.parents.find((p) => p.id === task.parentId);
      invariant(
        action.op === 'physical' &&
          parent &&
          parent.source === effect.id &&
          parent.status !== 'completed' &&
          parent.returnCount === 0,
        'Continuazione fisica non legata al padre sospeso.',
      );
    }
  }
  for (const effect of sc.effects) {
    const { action, instance, completed } = sourceCursor(state, effect);
    if (action.op !== 'explore') continue;
    const tile = sourceTile(state, instance, action.tile);
    const spaces = projection.spaces
      .filter((s) => s.tileSource === tile.source)
      .sort((a, b) => a.index - b.index);
    const task = sc.tasks.find(
      (t) => t.instanceId === instance.id && t.entry === effect.entry && t.action === effect.action,
    );
    invariant(
      completed ? !task : task?.kind === 'explore',
      'Esplorazione senza continuazione coerente.',
    );
    if (task) {
      invariant(task.kind === 'explore', 'Tipo continuazione esplorazione incoerente.');
      invariant(
        task.tileSource === tile.source && task.spaceIndex < spaces.length,
        'Cursore casella fuori dalla fonte.',
      );
      const node = sc.instances.find((i) => i.spaceId === spaces[task.spaceIndex]!.id);
      invariant(
        task.waiting === null ||
          (task.stage !== 'pre' &&
            task.waiting === node?.id &&
            actual.some(
              (e) =>
                e.event === (task.stage === 'revealed' ? 'PRE_REVEAL' : 'REVEALED') &&
                e.receivers.includes(task.waiting!),
            )),
        'Attesa esplorazione non legata al callback corrente.',
      );
    }
    for (const [index, space] of spaces.entries()) {
      const node = sc.instances.find((i) => i.kind === 'encounter' && i.spaceId === space.id);
      if (!node) continue;
      const definition = sc.pack.definitions.find((d) => d.source === node.definition)!;
      for (const event of ['PRE_REVEAL', 'REVEALED']) {
        const visited =
          !task ||
          (task.kind === 'explore' &&
            (index < task.spaceIndex ||
              (index === task.spaceIndex &&
                (event === 'PRE_REVEAL' ? task.stage !== 'pre' : task.stage === 'next'))));
        if (!visited || definition.handlers[event] === undefined) continue;
        if (node.stopped && (counts.get(node.id) ?? 0) === (observed.get(node.id) ?? 0)) continue;
        expected.push({ event, receivers: [node.id] });
        counts.set(node.id, (counts.get(node.id) ?? 0) + 1);
      }
    }
  }
  invariant(
    digest(expected) === digest(actual.map(({ event, receivers }) => ({ event, receivers }))),
    'Callback di esplorazione omessi o fuori dall’ordine fonte.',
  );
  for (const node of sc.instances.filter(
    (i) => i.kind === 'encounter' && !i.stopped && i.processing !== 0,
  ))
    invariant(
      sc.tasks.some((t) => t.kind === 'explore' && t.waiting === node.id),
      'ProcessingState senza continuazione del nodo.',
    );
}
