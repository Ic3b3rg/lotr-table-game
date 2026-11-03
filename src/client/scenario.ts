import type { Catalog } from '../shared/catalog';
import type { Player, Session } from '../shared/protocol';
import type { ScenarioOfferSchema } from '../shared/scenario';
import type { z } from 'zod';
import { definitionId } from '../shared/preparation';
import { element, text } from './dom';
import { sourceText } from './source-text';
import { createGameActions } from './game-actions';
import { cardButton, type CardReader } from './cards';
import { refreshActions } from './actions';
import { createPhysicalControls } from './physical';
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
    resultsKey = '';
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
  });
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
    next.hidden = !q || !own || openCards || q.kind === 'physical';
    next.textContent =
      q?.kind === 'scout'
        ? 'Rivela Scoperta 2'
        : q?.kind === 'test'
          ? 'Rivela per Spirito 1'
          : q?.kind === 'handoff'
            ? 'Inizia la Fase di Azione'
            : q?.kind === 'placement'
              ? 'Conferma il piazzamento'
              : q?.kind === 'objective'
                ? 'Conferma l’obiettivo'
                : 'Continua';
    const hero = catalog?.heroes.find((h) => h.id === q?.heroId),
      actor = current.players.find((p) => p.id === q?.actorPlayerId);
    const active = current.round?.activeHeroId;
    const activeHero = catalog?.heroes.find((h) => h.id === active);
    const message = !sc
      ? (offer?.reason ?? 'Controllo del materiale dell’avventura…')
      : q?.kind === 'physical'
        ? current.physical?.active?.kind === 'gate'
          ? 'La conseguenza è sospesa. Carte e costi sono salvati; consulta il motivo qui sotto.'
          : `${actor?.name ?? 'Il proprietario indicato'} risolve la decisione qui sotto. La fonte riprende dopo le conseguenze.`
        : q?.heroId
          ? `${hero?.name.text ?? 'L’eroe indicato'} · agisce ${actor?.name ?? 'il suo proprietario'}. ${openCards ? 'Completa le carte rivelate qui sotto.' : 'Rivela le carte richieste.'}`
          : q
            ? 'Un partecipante conferma per il gruppo.'
            : activeHero
              ? `Avvio completato · ${activeHero.name.text} è di turno. Apri la mappa per viaggiare.`
              : 'Avvio completato · scegliete il prossimo eroe di turno.';
    if (status.textContent !== message) status.textContent = message;
    root.dataset.request = q?.id ?? '';
    root.dataset.kind = q?.kind ?? '';
    element('#scenario-cards-link').hidden = !openCards;
    element<HTMLAnchorElement>('#scenario-cards-link').href =
      q?.kind === 'scout' ? '#scouting' : '#skill-tests';
    element('#scenario-turn-link').hidden = sc?.phase !== 'action';
    const turnLink = element<HTMLAnchorElement>('#scenario-turn-link');
    turnLink.textContent = active ? 'Apri la mappa del turno' : 'Scegli il prossimo turno';
    turnLink.href = active ? '#journey-map' : '#rounds';
    element('#scenario-limit').hidden = sc?.phase !== 'action';
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
        const objective = element('#scenario-objective');
        objective.replaceChildren(...(sc?.objective ? [sourceText(sc.objective.text)] : []));
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
            const card = content?.skills.find((s) => s.id === definitionId(copy));
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
      element('#scenario-results-details').hidden = !sc?.completedSetup.length;
      controls();
    },
  };
}
