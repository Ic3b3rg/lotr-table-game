import type { State } from '../server/state';
import { HANDOFF_TEXT, type Scenario, type ScenarioRequest } from '../shared/scenario';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';
import { sourceCursor, sourceTile } from './source-cursor';
import { physicalHistory } from './physical';
import type { PhysicalEvidence } from '../physical-resolution/model';

type Request = Omit<ScenarioRequest, 'id' | 'fingerprint'>;
type Completion = Scenario['completedSetup'][number];
type Expected = {
  request: Request;
  kind: string;
  completion?: Completion;
  evidence?: PhysicalEvidence;
};

/** Derive consumed requests from source entries, completed services and the current cursor. */
export function validateSourceHistory(state: State) {
  const sc = state.scenario!;
  invariant(state.mapGeneration?.status === 'frozen', 'Cronologia senza realizzazione.');
  const projection = state.mapGeneration.projection;
  const expected: Expected[] = [];
  const visible = new Set<string>();
  for (const effect of sc.effects) {
    const { instance, action, completed } = sourceCursor(state, effect);
    const base = {
      instanceId: instance.id,
      state: effect.state,
      entry: effect.entry,
      action: effect.action,
      heroId: null,
      actorPlayerId: null,
      stage: 'ready' as const,
      tileSource: null,
    };
    const current =
      sc.pending?.instanceId === instance.id &&
      sc.pending.entry === effect.entry &&
      sc.pending.action === effect.action
        ? sc.pending
        : null;
    if (action.op === 'physical') expected.push(...physicalHistory(state, effect));
    if (action.op === 'revealTile') visible.add(sourceTile(state, instance, action.tile).source);
    if (action.op === 'section') {
      const task = sc.tasks.find(
        (t) =>
          t.instanceId === instance.id && t.entry === effect.entry && t.action === effect.action,
      );
      invariant(!task || task.kind === 'section', 'Cronologia sezione senza continuazione.');
      const tiles = projection.sections.find((s) => s.id === action.sectionId)!.tiles;
      const end = task?.kind === 'section' ? task.tileIndex : tiles.length;
      for (const [index, tile] of tiles.entries()) {
        if (index < end && !visible.has(tile.source))
          expected.push({
            kind: 'ack',
            request: {
              ...base,
              kind: 'placement',
              tileSource: tile.source,
              text: action.text.map((t) =>
                t.kind === 'text' ? { ...t, text: t.text.replaceAll('{tile}', tile.code) } : t,
              ),
            },
          });
        if (index < end || current?.tileSource === tile.source) visible.add(tile.source);
      }
    }
    if (action.op !== 'message') continue;
    if (action.mode === 'scout' || action.mode === 'spirit') {
      const kind = action.mode === 'scout' ? 'scout' : 'test';
      const heroes = state.preparation!.heroes;
      const completions = sc.completedSetup.filter((c) => c.source === effect.id);
      invariant(
        (completed ? completions.length === heroes.length : completions.length < heroes.length) &&
          completions.every((c, n) => c.kind === kind && c.heroId === heroes[n]?.heroId),
        'Completamenti fuori dall’ordine fonte degli eroi.',
      );
      const append = (hero: (typeof heroes)[number], conversions: number, done?: Completion) => {
        const request: Request = {
          ...base,
          kind,
          text: action.text,
          heroId: hero.heroId,
          actorPlayerId: hero.playerId,
        };
        expected.push({ kind: `${kind}-reveal`, request });
        for (let n = 0; n < conversions; n++)
          expected.push({ kind: 'convert', request: { ...request, stage: 'revealed' } });
        if (done)
          expected.push({
            kind: `${kind}-resolve`,
            request: { ...request, stage: 'revealed' },
            completion: done,
          });
      };
      completions.forEach((c, n) => append(heroes[n]!, c.converted, c));
      if (current?.stage === 'revealed')
        append(heroes[completions.length]!, kind === 'test' ? state.skillTest!.converted : 0);
    } else if (completed) {
      let tileSource: string | null = null;
      if (action.mode === 'tile') {
        const previous = sc.effects
          .filter(
            (e) =>
              e.instanceId === instance.id &&
              e.entry === effect.entry &&
              e.action < effect.action &&
              e.op === 'revealTile',
          )
          .at(-1);
        invariant(previous, 'Piazzamento storico senza RevealTile.');
        const reveal = sourceCursor(state, previous).action;
        invariant(reveal.op === 'revealTile', 'Azione di piazzamento incoerente.');
        tileSource = sourceTile(state, instance, reveal.tile).source;
      }
      expected.push({
        kind: 'ack',
        request: {
          ...base,
          kind:
            action.mode === 'tile'
              ? 'placement'
              : action.mode === 'objective'
                ? 'objective'
                : 'message',
          tileSource,
          text: action.text,
        },
      });
    }
  }
  if (sc.phase === 'action') {
    const principal = sc.instances.find((i) => i.kind === 'principal')!;
    expected.push({
      kind: 'ack',
      request: {
        instanceId: principal.id,
        state: principal.state,
        entry: principal.entry,
        action: -1,
        kind: 'handoff',
        text: HANDOFF_TEXT,
        heroId: null,
        actorPlayerId: null,
        stage: 'ready',
        tileSource: null,
      },
    });
  }
  const start = sc.commands[0];
  invariant(
    start?.kind === 'start' &&
      start.source === 'SCENARIO_BEGIN' &&
      start.pendingId === null &&
      sc.commands.length === expected.length + 1,
    'Cronologia richieste fonte incompleta.',
  );
  const consumed = new Set<string>();
  expected.forEach(({ request, kind, completion, evidence }, n) => {
    const record = sc.commands[n + 1]!;
    invariant(
      record.kind === kind &&
        record.pendingId !== null &&
        !consumed.has(record.pendingId) &&
        record.pendingId !== sc.pending?.id &&
        record.revision > sc.commands[n]!.revision &&
        (request.actorPlayerId === null || record.playerId === request.actorPlayerId) &&
        record.source === digest({ scenarioId: sc.id, ...request, id: record.pendingId }) &&
        (!completion || completion.requestId === record.pendingId) &&
        (!evidence ||
          (record.requestId === evidence.requestId &&
            record.pendingId === evidence.pendingId &&
            record.revision === evidence.revision &&
            record.source === evidence.sourceFingerprint &&
            record.playerId === evidence.playerId)),
      'Cronologia non legata a richiesta, cursore o eroe fonte.',
    );
    consumed.add(record.pendingId);
  });
}
