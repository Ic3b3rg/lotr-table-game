import type { Catalog } from '../shared/catalog';
import type { Player, Session } from '../shared/protocol';
import type { ScenarioOfferSchema } from '../shared/scenario';
import type { z } from 'zod';
import { findSkillCard } from '../shared/skill-cards';
import { element, text } from './dom';
import { sourceText } from './source-text';
import { createGameActions } from './game-actions';
import { cardButton, type CardReader } from './cards';
import { refreshActions } from './actions';
import { createPhysicalControls } from './physical';
import { STAT_LABELS } from '../shared/skill-tests';
export function createScenario(sync: () => Promise<void>, reader: CardReader) {
  const root = element('#scenario'),
    status = element('#scenario-status'),
    body = element('#scenario-message');
  const start = element<HTMLFormElement>('#scenario-start-form'),
    agreed = element<HTMLInputElement>('#scenario-agreed'),
    next = element<HTMLButtonElement>('#scenario-next');
  let current: Session | null = null,
    player: Player | null = null,
    catalog: Catalog | null = null,
    offer: z.infer<typeof ScenarioOfferSchema> | null = null,
    key = '',
    resultsKey = '',
    progressKey = '';
  const commands = createGameActions(
    () => current,
    sync,
    root,
    status,
    element('#scenario-error'),
    controls,
  );
  const physical = createPhysicalControls((intent) => {
    void commands.submit(intent, true);
  }, reader);
  function controls() {
    if (!current) return;
    const sc = current.scenario,
      q = sc?.pending;
    root.hidden = !sc && current.mapGeneration?.status !== 'frozen';
    start.hidden = !!sc || !offer?.available || !player;
    element<HTMLButtonElement>('#scenario-start').dataset.blocked = String(
      !agreed.checked || !offer?.available,
    );
    const own = !!player && (!q?.actorPlayerId || q.actorPlayerId === player.id);
    const openCards = !!q && (q.kind === 'scout' || q.kind === 'test') && q.stage === 'revealed';
    next.hidden = !q || !own || openCards || q.kind === 'physical' || q.kind === 'choice';
    next.textContent =
      q?.kind === 'scout'
        ? 'Rivela Scoperta 2'
        : q?.kind === 'test'
          ? 'Rivela per Spirito 1'
          : q?.kind === 'handoff'
            ? 'Inizia la Fase di Azione'
            : q?.kind === 'placement' ||
                q?.kind === 'deployment' ||
                q?.kind === 'exploration-markers'
              ? 'Conferma il piazzamento'
              : q?.kind === 'objective'
                ? 'Conferma l’obiettivo'
                : 'Continua';
    const hero = catalog?.heroes.find((h) => h.id === q?.heroId),
      actor = current.players.find((p) => p.id === q?.actorPlayerId);
    const active = current.round?.activeHeroId;
    const activeHero = catalog?.heroes.find((h) => h.id === active);
    const turnsEnded =
      sc?.pack.manifest.scope === 'original-encounter-v1' &&
      current.round?.heroes.every((h) => h.turnEnded);
    const sourcePhases = !!sc?.pack.manifest.rounds;
    const explorer = sc?.explorations?.attempts.find((a) => a.id === sc.explorations?.active);
    const message = !sc
      ? (offer?.reason ?? 'Controllo del materiale dell’avventura…')
      : current.physical?.cycle?.pending
        ? `${current.players.find((p) => p.id === current!.physical!.active?.actorPlayerId)?.name ?? 'Il proprietario indicato'} completa la capacità qui sotto. Il comando ordinario riprende soltanto dopo tutti i figli.`
        : q?.kind === 'physical'
          ? current.physical?.active?.kind === 'gate'
            ? 'La conseguenza è sospesa. Carte e costi sono salvati; consulta il motivo qui sotto.'
            : `${actor?.name ?? 'Il proprietario indicato'} risolve la decisione qui sotto. La fonte riprende dopo le conseguenze.`
          : q?.kind === 'choice'
            ? `${actor?.name ?? 'Il proprietario indicato'} sceglie come proseguire. L’azione è già pagata; la scelta è obbligatoria.`
            : q && explorer
              ? `${actor?.name ?? 'Il proprietario indicato'} continua l’esplorazione con ${hero?.name.text ?? 'l’eroe di turno'}. L’ingresso ha usato 1 movimento, senza altre azioni. Movimenti residui: ${current.journey?.travel?.remaining ?? 0}. Segui l’istruzione qui sotto.`
              : q?.heroId
                ? `${hero?.name.text ?? 'L’eroe indicato'} · agisce ${actor?.name ?? 'il suo proprietario'}. ${openCards ? 'Completa le carte rivelate qui sotto.' : 'Rivela le carte richieste.'}`
                : q
                  ? 'Un partecipante conferma per il gruppo.'
                  : activeHero
                    ? `Avvio completato · ${activeHero.name.text} è di turno. Apri la mappa per viaggiare.`
                    : sourcePhases && current.round?.phase === 'rally'
                      ? 'Riorganizzazione · ogni proprietario completa Scoperta. Il nuovo round attende tutti gli eroi.'
                      : sourcePhases && current.round?.phase === 'shadow'
                        ? 'Ombra · leggete il prossimo passo nella sezione del round.'
                        : sourcePhases && turnsEnded
                          ? 'I turni sono conclusi. Il gruppo può iniziare l’Ombra nella sezione del round.'
                          : turnsEnded
                            ? 'I turni sono conclusi. I progressi sono salvati; la Fase di Ombra originale non è ancora disponibile.'
                            : 'Avvio completato · scegliete il prossimo eroe di turno.';
    if (status.textContent !== message) status.textContent = message;
    root.dataset.request = q?.id ?? '';
    root.dataset.kind = q?.kind ?? '';
    element('#scenario-cards-link').hidden = !openCards;
    element<HTMLAnchorElement>('#scenario-cards-link').href =
      q?.kind === 'scout' ? '#scouting' : '#skill-tests';
    element('#scenario-turn-link').hidden = sc?.phase !== 'action';
    const turnLink = element<HTMLAnchorElement>('#scenario-turn-link');
    turnLink.hidden ||= !!turnsEnded && !sourcePhases;
    turnLink.textContent = active
      ? 'Apri la mappa del turno'
      : sourcePhases && turnsEnded
        ? 'Apri il round'
        : 'Scegli il prossimo turno';
    turnLink.href = active ? '#journey-map' : '#rounds';
    element('#scenario-limit').hidden = sc?.phase !== 'action';
    if (current.physical?.cycle)
      element('#scenario-limit').textContent =
        'Turni, viaggio e Riorganizzazione usano gli effetti attivi. Gli incontri originali, il combattimento e l’Ombra originale restano da implementare; le conferme Ombra della fonte sintetica sono manuali.';
    if (sc?.pack.manifest.scope === 'original-encounter-v1')
      element('#scenario-limit').textContent = sc.pack.manifest.exploration
        ? 'Puoi esplorare le tessere abilitate e rivelarne i segnalini. Il segnalino iniziale è giocabile; gli altri incontri, combattimento, Ombra e seguito dell’avventura richiedono ancora i loro effetti.'
        : 'Il segnalino iniziale certificato è giocabile. Ulteriori incontri ed esplorazioni, combattimento, Ombra e seguito dell’avventura richiedono ancora i loro effetti.';
    if (sourcePhases)
      element('#scenario-limit').textContent =
        'Il passaggio senza nemici a Ombra e Riorganizzazione è disponibile. Altri incontri, combattimento ed eventi successivi mantengono i propri limiti: l’avventura completa è ancora in sviluppo.';
    if (sc?.pack.manifest.followup)
      element('#scenario-limit').textContent =
        'Il seguito del timer e i piazzamenti obbligatori della minaccia sono disponibili. I gruppi apparsi attendono la prossima Ombra: non si attivano in questa fase. Combattimento, provocazione, successive attivazioni e altri incontri conservano i propri limiti.';
    if (current.combat)
      element('#scenario-limit').textContent = sc?.pack.manifest.combat?.source.shadow
        ? 'Attacchi, provocazioni e attivazioni dell’Ombra usano carte, capacità e conseguenze reali. Seguite le richieste fino alle Scoperte e al prossimo turno. L’avventura completa è ancora in sviluppo.'
        : 'Attacchi e provocazioni usano carte, capacità e conseguenze reali. Le successive attivazioni dell’Ombra e il seguito dell’avventura richiedono ancora i loro effetti.';
    refreshActions();
  }
  agreed.oninput = () => {
    commands.clear();
    controls();
  };
  start.onsubmit = (e) => {
    e.preventDefault();
    if (offer?.packFingerprint && offer.projectionFingerprint && agreed.checked)
      void commands.submit(
        {
          type: 'START_SCENARIO',
          packFingerprint: offer.packFingerprint,
          projectionFingerprint: offer.projectionFingerprint,
          agreed: true,
        },
        true,
      );
  };
  next.onclick = () => {
    const sc = current?.scenario,
      q = sc?.pending;
    if (!sc || !q) return;
    void commands.submit(
      {
        type: 'SCENARIO_INPUT',
        scenarioId: sc.id,
        packFingerprint: sc.packFingerprint,
        projectionFingerprint: sc.projectionFingerprint,
        pendingId: q.id,
        sourceFingerprint: q.fingerprint,
        heroId: q.heroId,
        input: {
          kind: q.kind === 'scout' ? 'scout-reveal' : q.kind === 'test' ? 'test-reveal' : 'ack',
        },
      },
      true,
    );
  };
  return {
    update(
      session: Session,
      identity: Player | null,
      content: Catalog | null,
      plan: z.infer<typeof ScenarioOfferSchema>,
    ) {
      current = session;
      player = identity;
      catalog = content;
      offer = plan;
      physical.update(session, identity, content);
      const sc = session.scenario,
        q = sc?.pending,
        nextKey = `${session.generation}:${sc?.id}:${q?.id}:${identity?.id}`;
      element('#scenario-title').textContent = sc?.pack.name ?? plan.name ?? 'Avvia l’avventura';
      if (key !== nextKey) {
        agreed.checked = false;
        commands.clear();
        element('#scenario-error').hidden = true;
        body.replaceChildren(...(q ? [sourceText(q.text)] : []));
        if (q?.kind === 'deployment') {
          const task = sc!.tasks.find(
            (t) =>
              t.kind === 'spawnRandom' &&
              t.instanceId === q.instanceId &&
              t.entry === q.entry &&
              t.action === q.action,
          );
          const attempt =
            task?.kind === 'spawnRandom'
              ? sc!.enemies!.attempts.find((a) => a.effectId === task.effectId)
              : null;
          const group =
            task?.kind === 'spawnRandom'
              ? sc!.enemies!.groups.find((g) => g.id === attempt?.groups[task.groupIndex])
              : null;
          const space = session.journey?.definition.spaces.find(
            (s) => s.id === sc!.spaceBindings.find((b) => b.sourceId === group?.spaceId)?.id,
          );
          if (space)
            body.append(
              text(
                'p',
                `Posizione del gruppo: ${space.label}. Il segnalino sulla mappa indica questa casella.`,
                'company-help',
              ),
            );
        }
        if (q?.kind === 'choice' && (!q.actorPlayerId || q.actorPlayerId === identity?.id)) {
          const fields = document.createElement('fieldset'),
            legend = text('legend', 'Scegli come proseguire');
          fields.append(legend);
          for (const o of q.options ?? []) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'company-action';
            b.dataset.write = '';
            b.dataset.event = o.event;
            b.append(sourceText(o.label));
            b.onclick = () =>
              void commands.submit(
                {
                  type: 'SCENARIO_INPUT',
                  scenarioId: sc!.id,
                  packFingerprint: sc!.packFingerprint,
                  projectionFingerprint: sc!.projectionFingerprint,
                  pendingId: q.id,
                  sourceFingerprint: q.fingerprint,
                  heroId: q.heroId,
                  input: { kind: 'choice', event: o.event },
                },
                true,
              );
            fields.append(b);
          }
          body.append(fields);
        }
        const objective = element('#scenario-objective');
        objective.replaceChildren(
          ...(sc?.objective
            ? [
                text('strong', 'Obiettivo attuale: '),
                sourceText(sc.objective.text),
                ...(sc.pack.manifest.followup && sc.objective.id > 0
                  ? [
                      text(
                        'p',
                        'Per seguire la missione, consulta sempre l’obiettivo attuale qui sopra.',
                        'company-help',
                      ),
                    ]
                  : []),
              ]
            : []),
        );
        objective.hidden = !sc?.objective;
        key = nextKey;
      }
      const results = element('#scenario-results');
      const nextResults = `${session.generation}:${content?.id}:${JSON.stringify(sc?.completedSetup)}`;
      if (resultsKey !== nextResults) {
        resultsKey = nextResults;
        results.replaceChildren();
        for (const c of sc?.completedSetup ?? []) {
          const row = document.createElement('li'),
            hero = content?.heroes.find((h) => h.id === c.heroId);
          const details = document.createElement('details'),
            summary = document.createElement('summary');
          summary.textContent = `${hero?.name.text ?? c.heroId} · ${c.kind === 'scout' ? 'Scoperta 2 completata' : `Spirito 1 ${c.outcome === 'pass' ? 'superata' : 'fallita'} · ${c.converted} conversioni · +${c.reward} ispirazione`}`;
          details.append(summary);
          const cards = text('ul', '', 'scenario-result-cards');
          for (const copy of c.revealed) {
            const card = content
              ? findSkillCard(
                  content,
                  copy,
                  session.physical?.lastStand?.titles.map((t) => t.skill),
                )
              : undefined;
            const li = document.createElement('li');
            if (card) li.append(cardButton(card, (caller) => reader.card(card, caller)));
            else li.textContent = copy;
            cards.append(li);
          }
          details.append(cards);
          row.append(details);
          results.append(row);
        }
      }
      const progress = element('#scenario-play-progress');
      progress.hidden = !sc?.play;
      const nextProgress = JSON.stringify([
        session.generation,
        content?.id,
        sc?.play,
        sc?.instances.map((i) => [i.id, i.variables, i.stopped]),
        session.round?.heroes,
        session.journey?.travel,
      ]);
      if (sc?.play && progressKey !== nextProgress) {
        progressKey = nextProgress;
        const summary = [];
        for (const source of sc.pack.manifest.playablePrefabs ?? []) {
          const m = sc.pack.manifest.prefabs.find((p) => p.source === source)!,
            i = sc.instances.find((i) => i.prefab === source);
          if (i && m.progress)
            summary.push(
              text(
                'p',
                `${i.stopped ? 'Segnalino concluso' : 'Ricerca disponibile'} · ${i.variables[m.progress.firstPass.name] ? 'Primo controllo superato per la Compagnia' : 'Primo controllo da superare'} · Successi accumulati: ${i.variables[m.progress.total.name]}.`,
                'company-help',
              ),
            );
        }
        const attempt = sc.play.attempts.find((a) => a.id === sc.play!.active);
        if (attempt)
          summary.push(
            text(
              'p',
              `Interazione di ${content?.heroes.find((h) => h.id === attempt.heroId)?.name.text ?? 'un eroe'} · 1 azione pagata · ${2 - (session.round?.heroes.find((h) => h.heroId === attempt.heroId)?.actionsUsed ?? 0)} azioni disponibili · ${session.journey?.travel?.remaining ?? 0} movimenti residui.`,
              'company-help',
            ),
          );
        else if (sc.play.attempts.at(-1)?.interrupted === 'hero-defeated')
          summary.push(text('p', 'Interazione terminata: l’eroe è sconfitto.', 'company-help'));
        summary.push(text('p', `Sapienza ottenuta: ${sc.play.lore}.`, 'company-help'));
        for (const t of sc.play.tests.slice(-5))
          summary.push(
            text(
              'p',
              `${content?.heroes.find((h) => h.id === t.heroId)?.name.text ?? t.heroId} · ${STAT_LABELS[t.stat]}${t.target === null ? '' : ` ${t.target}`} · ${t.successes} successi${t.total === null ? '' : ` · totale condiviso ${t.total}`}.`,
              'company-help',
            ),
          );
        progress.replaceChildren(...summary);
      }
      element('#scenario-results-details').hidden = !sc?.completedSetup.length;
      controls();
    },
  };
}
