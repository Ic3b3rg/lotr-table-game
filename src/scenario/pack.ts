import { readFileSync, statSync } from 'node:fs';
import { ScenarioPackSchema, type ScenarioPack } from '../shared/scenario';
import type { Projection } from '../shared/generated-map';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';
import { validateSourceHandler } from './handlers';
export function parseScenarioPack(raw: unknown) {
  const pack = ScenarioPackSchema.parse(raw);
  const original = pack.manifest.scope === 'original-encounter-v1';
  invariant(
    original === !!pack.manifest.playablePrefabs,
    'Manifest originale incompleto o estraneo.',
  );
  const definitions = new Map(pack.definitions.map((d) => [d.source, d]));
  const exploration = pack.manifest.exploration;
  if (exploration) {
    invariant(original, 'Esplorazione fuori dal consumer originale.');
    invariant(
      new Set(exploration.tiles.map((t) => t.source)).size === exploration.tiles.length,
      'Tessere esplorabili duplicate.',
    );
    const d = definitions.get(exploration.definition),
      waiting = d?.states.find((s) => s.index === d.initial),
      click = d?.states.find((s) => s.index === d.handlers['NODE CLICKED']),
      confirm = click?.actions[0],
      enter =
        confirm?.op === 'confirm'
          ? d?.states.find((s) => s.index === click!.transitions[confirm.confirmEvent])
          : null,
      get = enter?.actions[0],
      explore = enter?.actions[1],
      finish = d?.states.find((s) => s.index === enter?.transitions.FINISHED);
    invariant(
      d &&
        d.states.length === 4 &&
        Object.keys(d.handlers).length === 1 &&
        waiting?.actions.length === 0 &&
        Object.keys(waiting.transitions).length === 0 &&
        click?.actions.length === 1 &&
        confirm?.op === 'confirm' &&
        click.transitions[confirm.cancelEvent] === d.initial &&
        enter?.actions.length === 2 &&
        get?.op === 'getTile' &&
        get.target.scope === 'local' &&
        d.variables.some((v) => v.name === get.target.name && v.type === 'int' && v.value === -1) &&
        explore?.op === 'explore' &&
        explore.tile.kind === 'variable' &&
        digest(explore.tile.ref) === digest(get.target) &&
        !explore.skipIntro &&
        !explore.noInspiration &&
        !explore.skipOutro &&
        explore.skipAdjacentSectionEvent === false &&
        finish?.actions.length === 2 &&
        finish.actions[0]?.op === 'hideNode' &&
        finish.actions[1]?.op === 'stop',
      'Template esplorazione incompleto o non certificato.',
    );
    const principal = definitions.get(pack.principal)!,
      { event, variable } = exploration.adjacent;
    invariant(!principal.deferredHandlers[event], 'Evento adiacente con receiver non compilato.');
    invariant(
      principal.handlers[event] === undefined
        ? variable === null
        : variable?.scope === 'local' &&
            principal.variables.some((v) => v.name === variable.name && v.type === 'int'),
      'Binding/handler adiacente incoerenti.',
    );
  }
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
        validateSourceHandler(a);
        if (a.op === 'explore' && (!a.skipIntro || !a.skipOutro))
          invariant(
            d.source === exploration?.definition,
            'Esplorazione senza presentazione certificata.',
          );
        if (
          ['confirm', 'sourceTest', 'challenge', 'choice', 'nullProduct', 'lore'].includes(a.op) ||
          (a.op === 'message' && a.consequence)
        )
          invariant(
            original &&
              ((a.op === 'confirm' && d.source === pack.manifest.exploration?.definition) ||
                pack.manifest.prefabs.some(
                  (p) =>
                    pack.manifest.playablePrefabs!.includes(p.source) && p.fsmSource === d.source,
                )),
            'Istruzione incontro fuori dal manifest chiuso.',
          );
        const events =
          a.op === 'confirm'
            ? [a.confirmEvent, a.cancelEvent]
            : a.op === 'sourceTest'
              ? [a.passEvent, a.failEvent]
              : a.op === 'challenge'
                ? a.bounds.map((b) => b.event)
                : a.op === 'choice'
                  ? [...a.options, ...(a.cancel ? [a.cancel] : [])].map((o) => o.event)
                  : a.op === 'nullProduct'
                    ? [a.falseEvent]
                    : [];
        invariant(
          events.every((e) => s.transitions[e] !== undefined),
          'Ramo incontro senza transizione fonte.',
        );
        if (a.op === 'physical')
          invariant(
            pack.manifest.scope ===
              (a.program.profile === 'source-fronts-v1'
                ? 'synthetic-physical-p1'
                : 'synthetic-physical-p0') &&
              pack.name.toLocaleLowerCase('it-IT').includes('sintetic') &&
              d.source === pack.principal &&
              s.actions.length === 1 &&
              a.origin.parameterHash === digest(a.program),
            'Programma fisico richiede fonte sintetica esplicita, esclusiva e parametri corrispondenti.',
          );
        const refs = [
          ...('target' in a && typeof a.target === 'object' ? [a.target] : []),
          ...('ref' in a ? [a.ref] : []),
          ...(a.op === 'challenge' ? [a.sum] : []),
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
  for (const p of pack.manifest.prefabs.filter((p) => p.progress)) {
    const d = definitions.get(p.fsmSource)!;
    invariant(
      original && pack.manifest.playablePrefabs!.includes(p.source),
      'Progressi fuori dalla closure giocabile.',
    );
    const progress = p.progress!;
    invariant(
      progress.firstPass.scope === 'local' &&
        progress.total.scope === 'local' &&
        d.variables.some((v) => v.name === progress.firstPass.name && v.type === 'bool') &&
        d.variables.some((v) => v.name === progress.total.name && v.type === 'int') &&
        d.states.some((s) =>
          s.actions.some(
            (a) =>
              a.op === 'challenge' && a.sum.name === progress.total.name && a.sum.scope === 'local',
          ),
        ),
      'Progressi non legati alle variabili fonte.',
    );
  }
  for (const source of pack.manifest.playablePrefabs ?? []) {
    const p = pack.manifest.prefabs.find((p) => p.source === source);
    invariant(p, 'Prefab giocabile assente.');
    const d = definitions.get(p.fsmSource)!;
    const clickTarget =
      d.handlers['NODE CLICKED'] ??
      d.states.find((s) => s.transitions['NODE CLICKED'] !== undefined)?.transitions[
        'NODE CLICKED'
      ];
    const click = d.states.find((s) => s.index === clickTarget);
    invariant(
      click?.actions.length === 1 && click.actions[0]?.op === 'confirm',
      'Ingresso incontro senza conferma fonte esclusiva.',
    );
  }
  return { pack, fingerprint: digest(pack) };
}
export function loadScenarioPack(path: string) {
  invariant(statSync(path).size <= 4_000_000, 'Pacchetto scenario troppo grande.');
  return parseScenarioPack(JSON.parse(readFileSync(path, 'utf8')));
}
export function validateScenarioBinding(pack: ScenarioPack, p: Projection) {
  invariant(
    (pack.manifest.exploration?.tiles ?? []).every((t) =>
      p.sections.some((s) => s.tiles.some((x) => x.source === t.source)),
    ),
    'Capacità esplorazione di un’altra realizzazione.',
  );
  invariant(
    pack.identity.adventureSource === p.context.adventureSource &&
      pack.identity.adventureId === p.context.adventureId &&
      pack.identity.language === p.context.language,
    'Scenario/source mismatch.',
  );
  const files = new Map(pack.sources.map((f) => [f.file, f.sha256]));
  invariant(files.size === pack.sources.length, 'Source file duplicate.');
  for (const source of [
    p.context.adventureSource,
    ...p.assignments.flatMap((a) => [a.modelSource, a.prefab.source]),
  ]) {
    const file = source.split(':')[0]!;
    const expected = p.provenance.files.find((f) => f.file === file);
    invariant(
      expected && files.get(file) === expected.sha256,
      'Source hash mancante o incoerente.',
    );
  }
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
