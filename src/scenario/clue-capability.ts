import type { ScenarioPack } from '../shared/scenario';
import { invariant } from '../map-freeze/validate';
import { digest } from '../map-freeze/hash';

export function validateClueCapability(pack: ScenarioPack) {
  const cap = pack.manifest.clues;
  if (!cap) return;
  invariant(
    pack.manifest.scope === 'original-encounter-v1',
    'Indizi fuori dal consumer originale.',
  );
  const principal = pack.definitions.find((d) => d.source === pack.principal)!;
  invariant(
    new Set(cap.encounters).size === cap.encounters.length &&
      !cap.encounters.includes(cap.fort.prefab) &&
      !pack.manifest.playablePrefabs!.some(
        (s) => cap.encounters.includes(s) || s === cap.fort.prefab,
      ),
    'Closure degli indizi duplicate o terminale incluso.',
  );
  for (const [ref, type] of [
    [cap.counter, 'int'],
    [cap.fort.tile, 'int'],
    [cap.fort.position, 'vector'],
  ] as const)
    invariant(
      ref.scope === 'global' && pack.globals.some((v) => v.name === ref.name && v.type === type),
      'Binding della missione mancante.',
    );
  invariant(
    principal.handlers[cap.event] !== undefined && !principal.deferredHandlers[cap.event],
    'Ricevitore indizi non compilato.',
  );
  const fort = pack.manifest.prefabs.find((p) => p.source === cap.fort.prefab),
    receiver = pack.definitions.find((d) => d.source === fort?.fsmSource);
  invariant(
    receiver &&
      receiver.handlers[cap.fortEvent] !== undefined &&
      !receiver.deferredHandlers[cap.fortEvent],
    'Ricevitore del covo non compilato.',
  );
  for (const [op, ref] of [
    ['getTile', cap.fort.tile],
    ['getPosition', cap.fort.position],
  ] as const)
    invariant(
      receiver.states.some((s) =>
        s.actions.some((a) => a.op === op && digest(a.target) === digest(ref)),
      ),
      'Binding del covo non inizializzato dalla fonte.',
    );
  for (const source of cap.encounters) {
    const prefab = pack.manifest.prefabs.find((p) => p.source === source),
      d = pack.definitions.find((d) => d.source === prefab?.fsmSource);
    invariant(
      d &&
        d.states.some((s) => s.actions.some((a) => a.op === 'broadcast' && a.event === cap.event)),
      'Indizio senza fonte o evento.',
    );
    const entries = [
      d.handlers['NODE CLICKED'],
      ...d.states.map((s) => s.transitions['NODE CLICKED']),
    ].filter((v) => v !== undefined);
    invariant(
      entries.length > 0 &&
        entries.every((index) => {
          const s = d.states.find((s) => s.index === index);
          return s?.actions.length === 1 && s.actions[0]?.op === 'confirm';
        }),
      'Impegno indizio senza conferma fonte esclusiva.',
    );
  }
  for (const event of [cap.event, cap.fortEvent])
    invariant(
      pack.definitions.every((d) => !d.deferredHandlers[event]),
      'Ricevitore nascosto non compilato.',
    );
}
