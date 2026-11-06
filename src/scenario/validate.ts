import { validateCampPreparationCatalog } from './camp-preparation-capability';
import { validateCampItemsCatalog } from './camp-items-capability';
import { validateCampPreparationState } from './camp-preparation';
import { validateCampItemsState } from './camp-items';
import { initialCombat } from '../combat/controller';
import { validateCampState } from './camp-skills';
import { validateCampCatalog } from './camp-capability';
import { validateFirstCombatState } from './first-combat';
import { objectiveText } from './objective';
import { sectionOrder } from './section-order';
import { validateSourcePlayReceipts } from './play-receipts';
import { validateSourceRequest, validateMessageLog } from './request-state';
import { validatePreparedRewards } from './prepared-effects';
import { validateInstanceFlags } from './instance-state';
import { validateSourceHistory } from './source-history';
import { validateSourceTasks } from './task-state';
import type { State } from '../server/state';
import type { Receipt } from '../shared/protocol';
import type { ScenarioInstance, VariableRef } from '../shared/scenario';
import { findSkillCard } from '../shared/skill-cards';
import { physicalTitleSkills } from '../physical-resolution/title-skills';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';
import { parseScenarioPack, validateScenarioBinding } from './pack';
import { projectionToJourney } from './geometry';
import { validateScenarioPhysical, validatePhysicalReceipts } from './physical';
import { validatePhysicalCycle, validateCycleReceipts } from '../server/physical-cycle';

export function scenarioStateProblem(state: State): string | null {
  try {
    const sc = state.scenario;
    if (!sc) return state.physical || state.combat ? 'Consumer fisico senza scenario fonte.' : null;
    if (state.content) {
      validateCampCatalog(sc.pack, state.content);
      validateCampItemsCatalog(sc.pack, state.content);
      validateCampPreparationCatalog(sc.pack, state.content);
    }
    validateCampItemsState(state);
    validateCampPreparationState(state);
    validateCampState(state);
    validateFirstCombatState(state);
    if (state.combat) {
      invariant(
        sc.pack.manifest.combat,
        'Controller combattimento fuori dalla capacità congelata.',
      );
      if (!state.physical?.cycle)
        invariant(
          digest(state.combat) === digest(initialCombat(state)),
          'Controller introdotto dopo il confine iniziale.',
        );
    }
    if (state.physical?.cycle?.version === 2) {
      validatePhysicalCycle(state);
      return null;
    }
    invariant(
      state.mapGeneration?.status === 'frozen' &&
        state.preparation?.status === 'prepared' &&
        state.content,
      'Scenario senza realizzazione/compagnia.',
    );
    const p = state.mapGeneration.projection,
      parsed = parseScenarioPack(sc.pack);
    invariant(
      parsed.fingerprint === sc.packFingerprint && p.fingerprint === sc.projectionFingerprint,
      'Fingerprint scenario cambiato.',
    );
    validateScenarioBinding(sc.pack, p);
    const start = p.sections.find((s) => s.id === 0)!.tiles[0]!,
      startSpace = p.spaces.find((s) => s.tileSource === start.source && s.index === 1)!;
    invariant(startSpace, 'Spaces[1] assente.');
    const geometry = projectionToJourney(p, startSpace.id, sc.pack.name);
    invariant(
      digest(sc.spaceBindings) === digest(geometry.bindings),
      'Binding geometria cambiato.',
    );
    if (state.journey) invariant(state.journey.id === sc.id, 'Identità consumer mappa incoerente.');
    if (state.journey)
      invariant(
        digest(state.journey.definition) === digest(geometry.definition),
        'Consumer geometrico cambiato.',
      );
    const expected = [
      {
        id: 'principal',
        kind: 'principal',
        definition: sc.pack.principal,
        prefab: null,
        spaceId: null,
      },
      ...sc.pack.timers.map((t, n) => ({
        id: `timer-${n}`,
        kind: 'timer',
        definition: t,
        prefab: null,
        spaceId: null,
      })),
      ...(sc.pack.manifest.followup?.instances ?? []).map((row) => ({
        id: `static:${row.gameObject}`,
        kind: row.kind,
        definition: row.definition,
        prefab: null,
        spaceId: null,
      })),
      ...p.spawnOrder.map((spaceId) => {
        const a = p.assignments.find((a) => a.spaceId === spaceId)!,
          m = sc.pack.manifest.prefabs.find((m) => m.source === a.prefab.source)!;
        return {
          id: `node:${spaceId}`,
          kind: 'encounter',
          definition: m.fsmSource,
          prefab: a.prefab.source,
          spaceId,
        };
      }),
    ];
    invariant(
      digest(
        sc.instances.map(({ id, kind, definition, prefab, spaceId }) => ({
          id,
          kind,
          definition,
          prefab,
          spaceId,
        })),
      ) === digest(expected),
      'Istanze/spawn order incoerenti.',
    );
    const globals = Object.fromEntries(
      sc.pack.globals.map((v) => [v.name, structuredClone(v.value)]),
    );
    if (sc.pack.manifest.followup)
      globals[sc.pack.manifest.followup.playerCountBinding] = state.preparation.heroes.length;
    const locals = new Map(
      sc.instances.map((i) => [
        i.id,
        Object.fromEntries(
          sc.pack.definitions
            .find((d) => d.source === i.definition)!
            .variables.map((v) => [v.name, structuredClone(v.value)]),
        ),
      ]),
    );
    const store = (i: ScenarioInstance, ref: VariableRef) =>
      ref.scope === 'global' ? globals : locals.get(i.id)!;
    const visibleTiles = new Set<string>(),
      explored = new Set<string>();
    let objective = null;
    invariant(
      new Set(sc.effects.map((e) => e.id)).size === sc.effects.length,
      'Effetti duplicati.',
    );
    for (const effect of sc.effects) {
      const i = sc.instances.find((i) => i.id === effect.instanceId),
        d = sc.pack.definitions.find((d) => d.source === i?.definition);
      const s = d?.states.find((s) => s.index === effect.state),
        a = s?.actions.find((a) => a.index === effect.action);
      invariant(
        i &&
          a &&
          a.op === effect.op &&
          effect.id === `${i.id}:${effect.entry}:${a.index}` &&
          effect.entry <= i.entry,
        'Effetto fuori dalla fonte.',
      );
      const set = (
        ref: VariableRef,
        value: string | number | boolean | [number, number, number],
      ) => {
        const values = store(i, ref);
        invariant(
          ref.name in values && typeof values[ref.name] === typeof value,
          'Tipo effetto variabile.',
        );
        values[ref.name] = value;
      };
      const tile = (v: Extract<typeof a, { op: 'revealTile' }>['tile']) => {
        const hash =
          v.kind === 'start'
            ? start.hashId
            : v.kind === 'hash'
              ? v.value
              : store(i, v.ref)[v.ref.name];
        const found = p.sections.flatMap((s) => s.tiles).find((t) => t.hashId === hash);
        invariant(found, 'Tile effetto assente.');
        return found;
      };
      switch (a.op) {
        case 'set':
          set(a.target, structuredClone(a.value));
          break;
        case 'flip':
          invariant(typeof store(i, a.target)[a.target.name] === 'boolean', 'Flip di non-bool.');
          set(a.target, !store(i, a.target)[a.target.name]);
          break;
        case 'getStart':
          set(a.target, start.hashId);
          break;
        case 'getTile':
        case 'getPosition': {
          const space = p.spaces.find((s) => s.id === i.spaceId);
          invariant(space, 'Effetto senza Space.');
          const t = p.sections.flatMap((s) => s.tiles).find((t) => t.source === space.tileSource)!;
          set(a.target, a.op === 'getTile' ? t.hashId : structuredClone(space.nodePosition));
          break;
        }
        case 'addInt': {
          const value =
              a.value.kind === 'literal' ? a.value.value : store(i, a.value.ref)[a.value.ref.name],
            previous = store(i, a.target)[a.target.name];
          invariant(
            typeof previous === 'number' && typeof value === 'number',
            'IntAdd non numerico.',
          );
          set(a.target, (previous + value) | 0);
          break;
        }
        case 'revealTile':
          visibleTiles.add(tile(a.tile).source);
          break;
        case 'explore':
          invariant(visibleTiles.has(tile(a.tile).source), 'Esplorazione prima del reveal.');
          explored.add(tile(a.tile).source);
          break;
        case 'section': {
          const task = sc.tasks.find(
            (t) => t.instanceId === i.id && t.entry === effect.entry && t.action === a.index,
          );
          const tiles = p.sections.find((s) => s.id === a.sectionId)!.tiles;
          const count =
            task?.kind === 'section'
              ? task.tileIndex + (sc.pending?.tileSource ? 1 : 0)
              : tiles.length;
          if (sc.pack.manifest.followup) {
            const order = sectionOrder(p, a.sectionId, visibleTiles);
            const prefix = order.slice(0, Math.min(count, order.length));
            if (task?.kind === 'section')
              invariant(
                digest(task.order) === digest(prefix),
                'Ordine ricalcolato dei piazzamenti incoerente.',
              );
            prefix.forEach((source) => visibleTiles.add(source));
          } else tiles.slice(0, count).forEach((t) => visibleTiles.add(t.source));
          break;
        }
        case 'objective':
          objective = { id: a.id, text: objectiveText(a, (ref) => store(i, ref)[ref.name]) };
          break;
      }
    }
    invariant(digest(globals) === digest(sc.globals), 'Effetti globali incoerenti.');
    for (const i of sc.instances) {
      const d = sc.pack.definitions.find((d) => d.source === i.definition)!,
        s = d.states.find((s) => s.index === i.state);
      invariant(
        s && digest(locals.get(i.id)) === digest(i.variables),
        'Stato/binding locale incoerente.',
      );
      for (const list of [i.started, i.completed])
        invariant(
          new Set(list).size === list.length &&
            list.every((index) => s.actions.some((a) => a.index === index)),
          'Cursore azioni incoerente.',
        );
      invariant(
        i.completed.every((n) => i.started.includes(n)),
        'Completamento prima di entry.',
      );
      invariant(
        i.started.every((action) =>
          sc.effects.some(
            (e) =>
              e.instanceId === i.id &&
              e.entry === i.entry &&
              e.action === action &&
              e.state === i.state,
          ),
        ),
        'Entry senza effetto.',
      );
      for (const a of s.actions.filter(
        (a) => i.started.includes(a.index) && !i.completed.includes(a.index),
      ))
        invariant(
          (sc.pending?.instanceId === i.id &&
            sc.pending.entry === i.entry &&
            sc.pending.action === a.index) ||
            sc.tasks.some(
              (t) => t.instanceId === i.id && t.entry === i.entry && t.action === a.index,
            ),
          'Azione sospesa senza continuazione.',
        );
    }
    const tiles = p.sections
      .flatMap((s) => s.tiles)
      .map((t) => ({
        source: t.source,
        visible: visibleTiles.has(t.source),
        explored: explored.has(t.source),
      }));
    invariant(
      digest(tiles) === digest(sc.tiles) && digest(objective) === digest(sc.objective),
      'Visibilità/esplorazione/obiettivo senza effetto fonte.',
    );
    const thresholdEffects = sc.effects.flatMap((e) => {
      const a = sc.pack.definitions
        .find((d) => d.source === sc.instances.find((i) => i.id === e.instanceId)!.definition)!
        .states.find((s) => s.index === e.state)!
        .actions.find((a) => a.index === e.action)!;
      return a.op === 'threat' ? [{ source: a.source, threshold: a.threshold }] : [];
    });
    invariant(
      digest(sc.threats) ===
        digest(
          thresholdEffects.filter((t, n, all) => all.findIndex((x) => x.source === t.source) === n),
        ),
      'Threshold incoerenti.',
    );
    const ids = state.preparation.heroes.map((h) => h.heroId);
    invariant(
      new Set(sc.completedSetup.map((c) => `${c.kind}:${c.heroId}`)).size ===
        sc.completedSetup.length,
      'Setup ripetuto.',
    );
    for (const c of sc.completedSetup) {
      const hero = state.preparation.heroes.find((h) => h.heroId === c.heroId);
      invariant(hero, 'Eroe setup assente.');
      const effect = sc.effects.find((e) => e.id === c.source),
        a =
          effect &&
          sc.pack.definitions
            .find(
              (d) => d.source === sc.instances.find((i) => i.id === effect.instanceId)!.definition,
            )!
            .states.find((s) => s.index === effect.state)!
            .actions.find((a) => a.index === effect.action);
      invariant(
        a?.op === 'message' && a.mode === (c.kind === 'scout' ? 'scout' : 'spirit'),
        'Completamento non legato al copione.',
      );
      const own = [
        ...hero.deck,
        ...hero.discard,
        ...hero.prepared,
        ...(state.physical?.snapshot.lastStand?.titles
          .filter((t) => t.heroId === hero.heroId)
          .map((t) => t.copy) ?? []),
        ...(state.physical?.snapshot.resolution?.revealed
          .filter((h) => h.heroId === hero.heroId)
          .flatMap((h) => h.cards) ?? []),
        ...(state.scout?.heroId === hero.heroId ? state.scout.revealed : []),
        ...(state.skillTest?.status === 'converting' && state.skillTest.heroId === hero.heroId
          ? state.skillTest.revealed
          : []),
      ];
      invariant(
        new Set(c.revealed).size === c.revealed.length &&
          c.revealed.every((copy) => own.includes(copy)),
        'Carte setup senza proprietà.',
      );
      if (c.kind === 'scout')
        invariant(
          c.revealed.length === 2 && c.converted === 0 && c.outcome === null && c.reward === 0,
          'Scoperta setup non valida.',
        );
      else {
        const cards = c.revealed.map(
          (copy) => findSkillCard(state.content!, copy, physicalTitleSkills(state.physical))!,
        );
        const successes = cards.reduce((n, s) => n + s.success, c.converted),
          fate = cards.reduce((n, s) => n + s.fate, 0);
        invariant(
          c.converted <= fate &&
            c.outcome === (successes >= 1 ? 'pass' : 'fail') &&
            (c.outcome === 'pass' || c.reward === 0),
          'Esito/reward setup non valido.',
        );
      }
    }
    if (sc.pack.manifest.followup) {
      const nodes = sc.pack.manifest.followup.explorationNodes;
      invariant(
        digest(sc.explorationMarkers) ===
          digest(
            nodes.map((n) => ({
              source: n.source,
              tileSource: n.tileSource,
              visible:
                sc.tiles.some((t) => t.source === n.tileSource && t.visible && !t.explored) &&
                sc.effects.some((e) => {
                  const a = sc.pack.definitions
                    .find(
                      (d) =>
                        d.source === sc.instances.find((i) => i.id === e.instanceId)!.definition,
                    )!
                    .states.find((s) => s.index === e.state)!
                    .actions.find((a) => a.index === e.action)!;
                  const task = sc.tasks.find(
                    (t) =>
                      t.instanceId === e.instanceId && t.entry === e.entry && t.action === e.action,
                  );
                  return (
                    a.op === 'section' &&
                    p.sections
                      .find((s) => s.id === a.sectionId)!
                      .tiles.some((t) => t.source === n.tileSource) &&
                    (!task || (task.kind === 'section' && task.markers !== 'unrevealed'))
                  );
                }),
            })),
          ),
        'Visibilità dei segnalini senza reveal fonte.',
      );
    }
    validateInstanceFlags(sc);
    validateSourceTasks(state);
    validateScenarioPhysical(state);
    validatePreparedRewards(state);
    validateSourceRequest(state);
    validateMessageLog(state);
    const q = sc.pending;
    if (q) {
      const { fingerprint, ...data } = q;
      invariant(
        fingerprint === digest({ scenarioId: sc.id, ...data }),
        'Fingerprint richiesta cambiato.',
      );
      const i = sc.instances.find((i) => i.id === q.instanceId);
      invariant(
        i && i.state === q.state && i.entry === q.entry,
        'Richiesta fuori dallo stato fonte.',
      );
      if (q.heroId) {
        const h = state.preparation.heroes.find((h) => h.heroId === q.heroId);
        invariant(
          h &&
            h.playerId === q.actorPlayerId &&
            (q.kind === 'scout' || q.kind === 'test' || q.kind === 'physical'),
          'Actor/hero richiesta incoerente.',
        );
      } else
        invariant(
          q.actorPlayerId === null &&
            q.kind !== 'scout' &&
            q.kind !== 'test' &&
            q.kind !== 'physical',
          'Richiesta per eroe senza binding.',
        );
      if (q.kind !== 'handoff')
        invariant(
          i.started.includes(q.action) && !i.completed.includes(q.action),
          'Richiesta su azione conclusa.',
        );
      if (q.kind === 'scout')
        invariant(
          q.stage === 'revealed'
            ? state.scout?.heroId === q.heroId &&
                !state.scout.roundId &&
                state.scout.count === 2 &&
                !state.scout.resetBefore
            : !state.scout,
          'Scoperta non legata alla richiesta.',
        );
      else invariant(!state.scout, 'Scoperta fuori copione.');
      if (q.kind === 'test' && q.stage === 'revealed')
        invariant(
          state.skillTest?.heroId === q.heroId &&
            state.skillTest.status === 'converting' &&
            state.skillTest.stat === 'spirit' &&
            state.skillTest.target === 1 &&
            state.skillTest.modifier === 0,
          'Prova non legata alla richiesta.',
        );
      else invariant(state.skillTest?.status !== 'converting', 'Prova fuori copione.');
    }
    if (sc.phase === 'action' || q?.kind === 'handoff') {
      invariant(
        sc.objective?.id === 0 &&
          sc.completedSetup.length === ids.length * 2 &&
          sc.instances[0]!.processing === 0 &&
          !sc.tasks.length,
        'Handoff prima del completamento setup.',
      );
    }
    const handoffRound = state.physical?.cycle?.seed.round ?? state.round;
    invariant(
      sc.phase === 'action'
        ? sc.handoffCount === 1 &&
            !q &&
            !!state.round &&
            handoffRound?.number === 1 &&
            handoffRound.phase === 'action' &&
            !!state.journey
        : sc.handoffCount === 0 && !state.round && !!q,
      'Fase scenario incoerente.',
    );
    invariant(new Set(sc.events.map((e) => e.id)).size === sc.events.length, 'Eventi duplicati.');
    invariant(
      sc.events.every(
        (e) =>
          new Set(e.receivers).size === e.receivers.length &&
          e.receivers.every((id) => sc.instances.some((i) => i.id === id)),
      ),
      'Receiver assente.',
    );
    invariant(
      new Set(sc.commands.map((c) => `${c.playerId}:${c.requestId}`)).size === sc.commands.length &&
        sc.commands.filter((c) => c.kind === 'start').length === 1,
      'Registro scenario incoerente.',
    );
    invariant(
      sc.commands.every(
        (c) => state.players.some((p) => p.id === c.playerId) && c.revision <= state.revision,
      ),
      'Autore/revisione scenario incoerenti.',
    );
    validateSourceHistory(state);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Scenario non valido.';
  }
}
export function scenarioReceiptProblem(
  state: State,
  commands: { playerId: string; requestId: string; fingerprint?: string; receipt: Receipt }[],
): string | null {
  const records = commands.filter(
      (c) => c.receipt.type === 'START_SCENARIO' || c.receipt.type === 'SCENARIO_INPUT',
    ),
    sc = state.scenario;
  if (state.physical?.cycle?.version === 2) {
    try {
      validateCycleReceipts(state, commands);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Ledger originale non valido.';
    }
  }
  if (!sc) return records.length ? 'Ricevuta scenario senza consumer.' : null;
  if (records.length !== sc.commands.length) return 'Registro scenario incompleto.';
  for (const c of sc.commands) {
    const r = records.find(
      (r) => r.playerId === c.playerId && r.requestId === c.requestId,
    )?.receipt;
    if (
      !r ||
      (r.type !== 'START_SCENARIO' && r.type !== 'SCENARIO_INPUT') ||
      r.type !== (c.kind === 'start' ? 'START_SCENARIO' : 'SCENARIO_INPUT') ||
      r.appliedRevision !== c.revision ||
      r.scenarioId !== sc.id ||
      r.pendingId !== c.pendingId ||
      r.source !== c.source ||
      r.kind !== c.kind ||
      r.kind === 'camp-skill' ||
      r.kind === 'camp-item' ||
      [
        'camp-prepare',
        'camp-select-role',
        'camp-accessory',
        'camp-confirm',
        'camp-return',
      ].includes(r.kind) ||
      r.preparation !== undefined ||
      r.item !== undefined ||
      r.skill !== undefined
    )
      return 'Ricevuta scenario incoerente.';
  }
  try {
    validateSourcePlayReceipts(state, commands);
    validatePhysicalReceipts(state, commands);
  } catch (e) {
    return e instanceof Error ? e.message : 'Ricevute consumer non valide.';
  }
  return null;
}
