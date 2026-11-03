import type { Scenario } from '../shared/scenario';
import { invariant } from '../map-freeze/validate';

/** Reconcile hidden/processing/stopped flags with source events and action-entry evidence. */
export function validateInstanceFlags(sc: Scenario) {
  const defs = new Map(sc.pack.definitions.map((d) => [d.source, d]));
  const flags = new Map(
    sc.instances.map((i) => [
      i.id,
      { visible: false, processing: i.kind === 'principal' ? 1 : 0, stopped: false },
    ]),
  );
  const lastEntry = new Map(
    sc.instances.map((i) => {
      const d = defs.get(i.definition)!;
      let state = d.initial,
        entry = 0;
      const seen = new Set<number>();
      while (true) {
        const s = d.states.find((s) => s.index === state)!;
        invariant(!seen.has(state), 'Initialization ciclica.');
        seen.add(state);
        if (s.transitions.FINISHED === undefined || s.actions.some((a) => a.op === 'stop')) break;
        state = s.transitions.FINISHED;
        entry++;
      }
      return [i.id, entry];
    }),
  );
  const before = new Map<number, { receiver: string; event: string }[]>();
  for (const event of sc.events) {
    for (const id of event.receivers) {
      const i = sc.instances.find((i) => i.id === id);
      invariant(i, 'Receiver senza istanza.');
      const d = defs.get(i.definition)!;
      let target = d.handlers[event.event];
      invariant(target !== undefined, 'Evento senza handler globale compilato.');
      const seen = new Set<number>();
      while (!d.states.find((s) => s.index === target)!.actions.length) {
        invariant(!seen.has(target), 'Handler vuoto ciclico.');
        seen.add(target);
        const next = d.states.find((s) => s.index === target)!.transitions.FINISHED;
        invariant(next !== undefined, 'Handler senza effetto di completamento.');
        target = next;
      }
      const position = sc.effects.findIndex(
        (e) => e.instanceId === id && e.state === target && e.entry > lastEntry.get(id)!,
      );
      invariant(position >= 0, 'Evento senza entry del ricevitore.');
      lastEntry.set(id, sc.effects[position]!.entry);
      const list = before.get(position) ?? [];
      list.push({ receiver: id, event: event.event });
      before.set(position, list);
    }
  }
  sc.effects.forEach((e, ordinal) => {
    for (const event of before.get(ordinal) ?? []) {
      const f = flags.get(event.receiver)!;
      invariant(!f.stopped, 'FSM stopped ha ricevuto un evento.');
      if (event.event === 'PRE_REVEAL' || event.event === 'REVEALED') f.processing = 1;
      if (event.event === 'REVEALED') f.visible = true;
    }
    const f = flags.get(e.instanceId)!;
    if (e.op === 'release') f.processing = 0;
    if (e.op === 'stop') f.stopped = true;
    if (e.op === 'revealNode') f.visible = true;
    if (e.op === 'hideNode') f.visible = false;
  });
  for (const i of sc.instances) {
    const f = flags.get(i.id)!;
    const d = defs.get(i.definition)!;
    const s = d.states.find((s) => s.index === i.state)!;
    invariant(
      i.settled ===
        (i.stopped ||
          (s.actions.every((a) => i.completed.includes(a.index)) &&
            s.transitions.FINISHED === undefined &&
            d.handlers.FINISHED === undefined)),
      'Settled non coerente con il completamento della fonte.',
    );
    invariant(
      i.visible === f.visible && i.processing === f.processing && i.stopped === f.stopped,
      'Visibilità/ProcessingState/stopped non coerenti con eventi ed effetti.',
    );
  }
}
