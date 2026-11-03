import { scenarioMapView } from '../shared/scenario-map';
import { createEncounterInspection } from './encounter-inspection';
import type { Catalog } from '../shared/catalog';
import { adjacent, JourneyPlanSchema, type JourneyPlan } from '../shared/journey-map';
import type { Player, Session } from '../shared/protocol';
import { refreshActions } from './actions';
import { request } from './api';
import { element, text } from './dom';
import { createGameActions } from './game-actions';
import { createMapBoard } from './map-board';

export function createJourneyMap(sync: () => Promise<void>) {
  const root = element('#journey-map');
  const status = element('#map-status');
  const select = element<HTMLSelectElement>('#map-destination');
  const agreed = element<HTMLInputElement>('#map-agreed');
  const start = element<HTMLButtonElement>('#start-travel');
  const move = element<HTMLButtonElement>('#move-hero');
  let current: Session | null = null;
  let player: Player | null = null;
  let catalog: Catalog | null = null;
  let plan: JourneyPlan | null = null;
  let planKey = '';
  let loading = false;
  let mapKey = '';
  let contextKey = '';
  let positionsKey = '';
  const commands = createGameActions(
    () => current,
    sync,
    root,
    status,
    element('#map-error'),
    controls,
  );
  const inspection = createEncounterInspection(root, async (intent) => {
    const done = await commands.submit(intent);
    if (done) element('#scenario-status').focus();
    return done;
  });
  const tokens = element('#map-nodes');
  const board = createMapBoard((id) => {
    select.value = id;
    commands.clear();
    controls();
  });

  function controls() {
    if (!current || !catalog) return;
    const journey = current.journey;
    const round = current.round;
    const pending = Boolean(
      current.scenario?.pending ||
        current.physical?.active ||
        current.physical?.lastStand?.terminal ||
        current.scout ||
        current.skillTest?.status === 'converting',
    );
    const active = current.preparation?.heroes.find((hero) => hero.heroId === round?.activeHeroId);
    const own = Boolean(active && active.playerId === player?.id && round?.phase === 'action');
    const progress = round?.heroes.find((hero) => hero.heroId === active?.heroId);
    const position = journey?.heroes.find((hero) => hero.heroId === active?.heroId);
    const remaining = journey?.travel?.remaining ?? 0;
    const grant =
      current.physical?.cycle?.heroes.find((h) => h.heroId === active?.heroId)?.travelMoves ?? 2;
    start.textContent = `Inizia viaggio · 1 azione, ${grant} ${grant === 1 ? 'movimento' : 'movimenti'}`;
    element('#map-view').hidden = !journey;
    element('#map-open-form').hidden = Boolean(journey) || !plan || !player;
    const beforeTurns =
      !round ||
      (round.phase === 'action' &&
        !round.activeHeroId &&
        round.heroes.every((hero) => !hero.turnEnded && hero.actionsUsed === 0));
    element<HTMLButtonElement>('#map-open').dataset.blocked = String(
      !agreed.checked || pending || !beforeTurns,
    );
    element('#map-title').textContent =
      journey?.definition.label ?? plan?.definition.label ?? 'La mappa del viaggio';
    element('#map-personal-controls').hidden = !journey || !own;
    start.dataset.blocked = String(
      !own || !journey || pending || (progress?.actionsUsed ?? 2) >= 2,
    );
    const destination = journey?.definition.spaces.find((space) => space.id === select.value);
    const view = scenarioMapView(current);
    const explorationBlocked = !!destination && !!view?.unexplored.includes(destination.id);
    const canMove =
      !explorationBlocked &&
      Boolean(
        position &&
          destination &&
          journey &&
          adjacent(journey.definition, position.spaceId, destination.id),
      );
    move.dataset.blocked = String(!own || pending || remaining < 1 || !canMove);
    element('#map-budget').textContent =
      `Azioni disponibili: ${2 - (progress?.actionsUsed ?? 0)} · Movimenti del viaggio: ${remaining}`;
    const origin = journey?.definition.spaces.find((space) => space.id === position?.spaceId);
    element('#map-preview').textContent = !destination
      ? 'Seleziona una casella prima di confermare il movimento.'
      : explorationBlocked
        ? 'Questa tessera è da esplorare. La sua esplorazione fonte non è ancora disponibile: nessun movimento viene consumato.'
        : canMove
          ? `${origin!.label} → ${destination.label}. Il movimento usa un residuo del viaggio; non consuma un’altra azione.`
          : 'La destinazione deve essere adiacente alla posizione attuale, attraverso un collegamento valido.';
    let message = !journey
      ? plan
        ? beforeTurns
          ? 'Il tratto è disponibile. Concordate insieme la collocazione iniziale.'
          : 'Potete aprire il tratto all’inizio di un round, prima dei turni.'
        : loading
          ? 'Caricamento della mappa…'
          : 'La mappa non è ancora caricata su questo PC.'
      : pending
        ? 'Concludi le carte rivelate: il viaggio rimane salvato.'
        : own
          ? `${catalog.heroes.find((hero) => hero.id === active!.heroId)!.name.text} · ${origin!.label} · ${remaining} ${remaining === 1 ? 'movimento disponibile' : 'movimenti disponibili'}.`
          : round?.activeHeroId
            ? 'Il proprietario dell’eroe di turno conferma i movimenti dalla vista personale.'
            : 'Le posizioni sono salvate. Inizia un turno nella Fase di Azione per viaggiare.';
    if (status.textContent !== message) status.textContent = message;
    if (journey) board.update(journey.heroes, round?.activeHeroId ?? null, select.value);
    refreshActions();
  }

  async function load(generation: string) {
    loading = true;
    try {
      const next = JourneyPlanSchema.nullable().parse(await request('/api/journey-map-plan'));
      if (current?.generation === generation) {
        plan = next;
        planKey = generation;
      }
    } catch {
      planKey = '';
    } finally {
      loading = false;
      controls();
    }
  }
  agreed.oninput = () => {
    commands.clear();
    controls();
  };
  select.onchange = () => {
    commands.clear();
    controls();
  };
  element<HTMLFormElement>('#map-open-form').onsubmit = (event) => {
    event.preventDefault();
    if (plan && agreed.checked) {
      void commands
        .submit({
          type: 'OPEN_JOURNEY_MAP',
          planId: plan.definition.id,
          planHash: plan.hash,
          agreed: true,
        })
        .then(() => {
          if (current?.journey && element('#map-error').hidden) element('#map-viewport').focus();
        });
    }
  };
  start.onclick = () => {
    const round = current?.round;
    const journey = current?.journey;
    if (journey && round?.turnId && round.activeHeroId)
      void commands.submit(
        {
          type: 'START_TRAVEL',
          mapId: journey.id,
          roundId: round.id,
          turnId: round.turnId,
          heroId: round.activeHeroId,
        },
        true,
      );
  };
  element<HTMLFormElement>('#map-move-form').onsubmit = (event) => {
    event.preventDefault();
    const journey = current?.journey;
    const round = current?.round;
    const position = journey?.heroes.find((hero) => hero.heroId === round?.activeHeroId);
    if (journey && round?.turnId && position)
      void commands.submit(
        {
          type: 'MOVE_HERO',
          mapId: journey.id,
          roundId: round.id,
          turnId: round.turnId,
          heroId: position.heroId,
          fromSpaceId: position.spaceId,
          destinationSpaceId: select.value,
        },
        true,
      );
  };
  return {
    update(session: Session, identity: Player | null, content: Catalog | null) {
      current = session;
      player = identity;
      inspection.update(session, identity);
      catalog = content;
      root.hidden = !content || session.preparation?.status !== 'prepared';
      if (root.hidden || !catalog) return;
      if (!session.journey && planKey !== session.generation && !loading)
        void load(session.generation);
      const view = scenarioMapView(session);
      element('#map-scope').textContent = session.scenario
        ? 'La mappa mostra soltanto le tessere rivelate dal copione. Le tessere tratteggiate sono ancora da esplorare. Le posizioni degli eroi e i collegamenti provengono dalla mappa salvata.'
        : 'Tratto verificato in orientamento canonico. Generazione della mappa completa, esplorazione, nemici ed eventi dell’avventura seguiranno.';
      const nextMap = `${session.generation}:${session.journey?.id}:${JSON.stringify(session.scenario?.tiles)}:${session.scenario?.instances
        .filter((i) => i.visible)
        .map((i) => i.id)
        .join(',')}`;
      if (mapKey !== nextMap) {
        mapKey = nextMap;
        agreed.checked = false;
        if (session.journey) {
          element('#map-view').hidden = false;
          const visibleDefinition = view?.definition ?? session.journey.definition;
          board.draw(
            visibleDefinition,
            session.journey.heroes,
            catalog,
            new Set(view?.unexplored ?? []),
          );
          tokens.replaceChildren(
            ...(view?.nodes ?? []).map((n) => {
              const b = text(
                'button',
                `${n.content.nodeType === 'person' ? 'Persona' : n.content.nodeType === 'threat' ? 'Minaccia' : 'Ricerca'} · ${visibleDefinition.spaces.find((s) => s.id === n.spaceId)!.label}`,
                'map-node',
              ) as HTMLButtonElement;
              b.type = 'button';
              b.onclick = () => {
                inspection.open(n.instanceId);
              };
              return b;
            }),
          );
          select.replaceChildren(
            ...[
              '',
              ...(view?.definition ?? session.journey.definition).spaces.map((space) => space.id),
            ].map((id) => {
              const option = document.createElement('option');
              option.value = id;
              option.textContent =
                session.journey!.definition.spaces.find((space) => space.id === id)?.label ??
                'Scegli una casella sulla mappa';
              return option;
            }),
          );
        }
      }
      const nextContext = `${nextMap}:${identity?.id}:${session.round?.id}:${session.round?.phase}:${session.round?.turnId}:${session.journey?.heroes.find((hero) => hero.heroId === session.round?.activeHeroId)?.spaceId}`;
      if (contextKey !== nextContext) {
        select.value = '';
        agreed.checked = false;
        commands.clear();
        contextKey = nextContext;
      }
      const nextPositions = `${nextMap}:${JSON.stringify(session.journey?.heroes)}`;
      if (positionsKey !== nextPositions) {
        element('#map-positions').replaceChildren(
          ...(session.journey?.heroes ?? []).map((hero) =>
            text(
              'li',
              `${catalog!.heroes.find((entry) => entry.id === hero.heroId)!.name.text} · ${hero.removed ? 'Sconfitto · figura rimossa' : session.journey!.definition.spaces.find((space) => space.id === hero.spaceId)!.label}`,
            ),
          ),
        );
        positionsKey = nextPositions;
      }
      controls();
    },
  };
}
