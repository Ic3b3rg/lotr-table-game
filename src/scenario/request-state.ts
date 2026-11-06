import type { State } from '../server/state';
import { HANDOFF_TEXT } from '../shared/scenario';
import { digest } from '../map-freeze/hash';
import { sectionOrder } from './section-order';
import { invariant } from '../map-freeze/validate';
export function validateSourceRequest(state: State) {
  const sc = state.scenario!,
    q = sc.pending;
  if (!q) return;
  const i = sc.instances.find((i) => i.id === q.instanceId)!,
    d = sc.pack.definitions.find((d) => d.source === i.definition)!,
    s = d.states.find((s) => s.index === q.state)!;
  if (q.kind === 'handoff') {
    invariant(
      q.action === -1 &&
        i.kind === 'principal' &&
        s.actions.some((a) => a.op === 'release' && i.completed.includes(a.index)) &&
        digest(q.text) === digest(HANDOFF_TEXT),
      'Handoff fuori dalla fonte.',
    );
    return;
  }
  const a = s.actions.find((a) => a.index === q.action);
  invariant(a, 'Richiesta senza azione.');
  if (
    a.op === 'physical' ||
    (q.kind === 'physical' &&
      sc.pack.manifest.startupPreparation &&
      a.op === 'message' &&
      (a.mode === 'scout' || a.mode === 'spirit'))
  ) {
    const active = state.physical?.snapshot.active;
    invariant(
      q.kind === 'physical' &&
        q.stage === 'ready' &&
        q.tileSource === null &&
        digest(q.text) === digest(a.text) &&
        active &&
        q.heroId === active.actorHeroId &&
        q.actorPlayerId === active.actorPlayerId &&
        q.physical?.parentId === active.runId &&
        q.physical.child === active.child &&
        q.physical.grant === (active.kind === 'prevent' ? active.grant : null) &&
        q.physical.cursor === (active.kind === 'decision' ? active.cursor : undefined),
      'Richiesta fisica diversa dalla finestra fonte.',
    );
    return;
  }
  invariant(!q.physical, 'Cursore fisico su una richiesta estranea.');
  if (a.op === 'message') {
    const kind =
      a.mode === 'scout'
        ? 'scout'
        : a.mode === 'spirit'
          ? 'test'
          : a.mode === 'tile'
            ? 'placement'
            : a.mode === 'objective'
              ? 'objective'
              : 'message';
    invariant(
      q.kind === kind && digest(q.text) === digest(a.text),
      'Tipo/testo richiesta diversi dal packet congelato.',
    );
    const expected =
      kind === 'scout' || kind === 'test'
        ? state.preparation!.heroes.find(
            (h) =>
              !sc.completedSetup.some(
                (c) =>
                  c.kind === kind &&
                  c.heroId === h.heroId &&
                  c.source === `${i.id}:${i.entry}:${a.index}`,
              ),
          )
        : null;
    invariant(q.heroId === (expected?.heroId ?? null), 'Ordine eroi della richiesta incoerente.');
    if (a.mode === 'tile') {
      const effect = sc.effects
        .filter(
          (e) =>
            e.instanceId === i.id &&
            e.entry === i.entry &&
            e.action < a.index &&
            e.op === 'revealTile',
        )
        .at(-1);
      invariant(effect, 'Piazzamento senza RevealTile.');
      const reveal = s.actions.find((a) => a.index === effect.action)!;
      invariant(
        reveal.op === 'revealTile' && state.mapGeneration?.status === 'frozen',
        'Piazzamento senza realizzazione.',
      );
      const p = state.mapGeneration.projection,
        t = reveal.tile,
        hash =
          t.kind === 'start'
            ? p.sections.find((s) => s.id === 0)!.tiles[0]!.hashId
            : t.kind === 'hash'
              ? t.value
              : (t.ref.scope === 'global' ? sc.globals : i.variables)[t.ref.name];
      invariant(
        p.sections.flatMap((s) => s.tiles).find((t) => t.hashId === hash)?.source === q.tileSource,
        'Tessera del piazzamento incoerente.',
      );
    } else invariant(q.tileSource === null, 'Tessera non richiesta dal packet.');
  } else {
    invariant(
      a.op === 'section' &&
        (q.kind === 'placement' || q.kind === 'exploration-markers') &&
        state.mapGeneration?.status === 'frozen',
      'Richiesta non asincrona.',
    );
    const task = sc.tasks.find(
      (t) =>
        t.kind === 'section' &&
        t.instanceId === i.id &&
        t.entry === i.entry &&
        t.action === a.index,
    );
    invariant(task?.kind === 'section', 'Piazzamento sezione senza continuazione.');
    if (q.kind === 'exploration-markers') {
      const cap = sc.pack.manifest.followup!;
      invariant(
        task.markers === 'pending' &&
          !task.remaining?.length &&
          q.tileSource === null &&
          digest(q.text) ===
            digest(
              task.order!.length <= 1 ? cap.explorationText.single : cap.explorationText.plural,
            ),
        'Segnalini senza continuazione fonte.',
      );
      return;
    }
    const tile = task.order
      ? state.mapGeneration.projection.sections
          .flatMap((s) => s.tiles)
          .find((t) => t.source === task.order!.at(-1))
      : state.mapGeneration.projection.sections.find((s) => s.id === a.sectionId)!.tiles[
          task.tileIndex
        ];
    invariant(tile && tile.source === q.tileSource, 'Ordine tessere della richiesta incoerente.');
    const text = a.text.map((t) =>
      t.kind === 'text' ? { ...t, text: t.text.replaceAll('{tile}', tile.code) } : t,
    );
    invariant(digest(text) === digest(q.text), 'Testo piazzamento sezione incoerente.');
  }
}
export function validateMessageLog(state: State) {
  const sc = state.scenario!;
  const visible = new Set<string>();
  const expected = sc.effects.flatMap((e) => {
    const i = sc.instances.find((i) => i.id === e.instanceId)!,
      d = sc.pack.definitions.find((d) => d.source === i.definition)!,
      a = d.states.find((s) => s.index === e.state)!.actions.find((a) => a.index === e.action)!;
    const completed = e.entry < i.entry || (e.entry === i.entry && i.completed.includes(e.action));
    if (a.op === 'revealTile') {
      const effect = sc.pack.definitions
        .find((d) => d.source === i.definition)!
        .states.find((s) => s.index === e.state)!
        .actions.find((x) => x.index === e.action)!;
      if (effect.op === 'revealTile') {
        const p = state.mapGeneration!;
        invariant(p.status === 'frozen', 'Registro senza mappa.');
        const value = effect.tile;
        const hash =
          value.kind === 'start'
            ? p.projection.sections.find((s) => s.id === 0)!.tiles[0]!.hashId
            : value.kind === 'hash'
              ? value.value
              : (value.ref.scope === 'local' ? i.variables : sc.globals)[value.ref.name];
        visible.add(
          p.projection.sections.flatMap((s) => s.tiles).find((t) => t.hashId === hash)!.source,
        );
      }
    }
    if (a.op === 'section' && sc.pack.manifest.followup) {
      invariant(state.mapGeneration?.status === 'frozen', 'Registro senza mappa.');
      const p = state.mapGeneration.projection;
      const order = sectionOrder(p, a.sectionId, visible);
      const task = sc.tasks.find(
        (t) => t.instanceId === i.id && t.entry === e.entry && t.action === e.action,
      );
      const count =
        task?.kind === 'section'
          ? task.tileIndex - (task.markers === 'done' ? 1 : 0)
          : order.length;
      const logs = order.slice(0, count).map((source) => {
        const tile = p.sections.flatMap((s) => s.tiles).find((t) => t.source === source)!;
        visible.add(source);
        return {
          id: `${e.id}:${source}`,
          text: a.text.map((t) =>
            t.kind === 'text' ? { ...t, text: t.text.replaceAll('{tile}', tile.code) } : t,
          ),
        };
      });
      if (completed)
        logs.push({
          id: `${e.id}:markers`,
          text:
            order.length <= 1
              ? sc.pack.manifest.followup.explorationText.single
              : sc.pack.manifest.followup.explorationText.plural,
        });
      return logs;
    }
    return a.op === 'message' && !a.ignoreLog && completed ? [{ id: e.id, text: a.text }] : [];
  });
  invariant(
    digest(sc.messageLog) === digest(expected),
    'Registro messaggi incoerente con IgnoreLog/completamenti.',
  );
}
