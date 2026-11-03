import { readFileSync, statSync } from 'node:fs';
import { ScenarioPackSchema, type ScenarioPack } from '../shared/scenario';
import type { Projection } from '../shared/generated-map';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';
export function parseScenarioPack(raw: unknown) {
  const pack = ScenarioPackSchema.parse(raw);
  const definitions = new Map(pack.definitions.map((d) => [d.source, d]));
  invariant(definitions.size === pack.definitions.length, 'FSM duplicate.');
  invariant(
    definitions.has(pack.principal) && pack.timers.every((t) => definitions.has(t)),
    'FSM mancante.',
  );
  const globals = new Map(pack.globals.map((v) => [v.name, v]));
  const checkVariables = (variables: typeof pack.globals) => {
    invariant(
      new Set(variables.map((v) => v.name)).size === variables.length,
      'Variabili duplicate.',
    );
    for (const v of variables)
      invariant(
        v.type === 'int'
          ? Number.isInteger(v.value)
          : v.type === 'bool'
            ? typeof v.value === 'boolean'
            : Array.isArray(v.value),
        'Tipo variabile incoerente.',
      );
  };
  checkVariables(pack.globals);
  for (const d of pack.definitions) {
    checkVariables(d.variables);
    const locals = new Map(d.variables.map((v) => [v.name, v]));
    const indices = new Set(d.states.map((s) => s.index));
    invariant(
      indices.size === d.states.length && indices.has(d.initial),
      'Stato iniziale non valido.',
    );
    invariant(
      Object.values(d.handlers).every((s) => indices.has(s)),
      'Handler senza stato.',
    );
    for (const s of d.states) {
      invariant(
        Object.values(s.transitions).every((t) => indices.has(t)),
        'Transizione senza stato.',
      );
      invariant(
        new Set(s.actions.map((a) => a.index)).size === s.actions.length,
        'Azioni duplicate.',
      );
      invariant(
        s.actions.every((a, i) => !i || a.index > s.actions[i - 1]!.index),
        'Ordine azioni non valido.',
      );
      for (const a of s.actions) {
        const refs = [
          ...('target' in a ? [a.target] : []),
          ...('ref' in a ? [a.ref] : []),
          ...('tile' in a && a.tile.kind === 'variable' ? [a.tile.ref] : []),
          ...(a.op === 'addInt' && a.value.kind === 'variable' ? [a.value.ref] : []),
        ];
        for (const ref of refs)
          invariant(
            (ref.scope === 'local' ? locals : globals).has(ref.name),
            'Binding variabile assente.',
          );
      }
    }
  }
  invariant(
    new Set(pack.manifest.prefabs.map((p) => p.source)).size === pack.manifest.prefabs.length,
    'Prefab duplicati.',
  );
  for (const p of pack.manifest.prefabs)
    invariant(definitions.has(p.fsmSource), 'Closure prefab mancante.');
  return { pack, fingerprint: digest(pack) };
}
export function loadScenarioPack(path: string) {
  invariant(statSync(path).size <= 4_000_000, 'Pacchetto scenario troppo grande.');
  return parseScenarioPack(JSON.parse(readFileSync(path, 'utf8')));
}
export function validateScenarioBinding(pack: ScenarioPack, p: Projection) {
  invariant(
    pack.identity.adventureSource === p.context.adventureSource &&
      pack.identity.adventureId === p.context.adventureId &&
      pack.identity.language === p.context.language,
    'Scenario/source mismatch.',
  );
  const files = new Map(pack.sources.map((f) => [f.file, f.sha256]));
  for (const f of p.provenance.files)
    if (files.has(f.file)) invariant(files.get(f.file) === f.sha256, 'Source hash mismatch.');
  const principal = pack.definitions.find((d) => d.source === pack.principal)!;
  const startupSources = new Set(
    principal.states.flatMap((s) =>
      s.actions.flatMap((a) => {
        if (a.op !== 'explore') return [];
        const target = a.tile;
        const startVariable =
          target.kind === 'variable' &&
          principal.states.some((s) =>
            s.actions.some(
              (x) =>
                x.op === 'getStart' &&
                x.target.scope === target.ref.scope &&
                x.target.name === target.ref.name,
            ),
          );
        const hash =
          target.kind === 'start' || startVariable
            ? p.sections.find((s) => s.id === 0)!.tiles[0]!.hashId
            : target.kind === 'hash'
              ? target.value
              : (target.ref.scope === 'local' ? principal.variables : pack.globals).find(
                  (v) => v.name === target.ref.name,
                )?.value;
        const tile = p.sections.flatMap((s) => s.tiles).find((t) => t.hashId === hash);
        invariant(tile, 'Tessera startup non disponibile.');
        return [tile.source];
      }),
    ),
  );
  for (const a of p.assignments) {
    const m = pack.manifest.prefabs.find((m) => m.source === a.prefab.source);
    if (m && startupSources.has(p.spaces.find((s) => s.id === a.spaceId)!.tileSource)) {
      const d = pack.definitions.find((d) => d.source === m.fsmSource)!;
      invariant(
        !d.deferredHandlers.PRE_REVEAL && !d.deferredHandlers.REVEALED,
        'Prefab reveal non certificato per questa realizzazione.',
      );
    }
  }
  for (const a of p.assignments)
    invariant(
      pack.manifest.prefabs.some(
        (m) =>
          m.source === a.prefab.source &&
          m.modelSource === a.modelSource &&
          m.encounterId === a.encounterId,
      ),
      'Prefab non certificato per questa realizzazione.',
    );
}
