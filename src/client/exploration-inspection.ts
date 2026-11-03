import type { Session, Player, Command } from '../shared/protocol';
import type { Catalog } from '../shared/catalog';
import { explorationConfirmation } from '../shared/exploration';
import { adjacent } from '../shared/journey-map';
import { sourceText } from './source-text';
import { refreshActions } from './actions';
import { text } from './dom';

type Intent = Omit<
  Extract<Command, { type: 'EXPLORE_SCENARIO' }>,
  'generation' | 'requestId' | 'expectedRevision'
>;

/** Local source inspection is free; only the bound confirmation enters the tile. */
export function createExplorationInspection(
  root: HTMLElement,
  submit: (intent: Intent) => Promise<unknown>,
) {
  const dialog = document.createElement('dialog');
  dialog.className = 'scenario-node-dialog';
  dialog.setAttribute('aria-label', 'Entra ed esplora la tessera');
  const body = document.createElement('div'),
    info = text('p', '', 'company-help');
  const commit = text('button', '', 'company-action') as HTMLButtonElement,
    close = text('button', '', 'company-action') as HTMLButtonElement;
  commit.type = close.type = 'button';
  commit.id = 'confirm-exploration';
  commit.dataset.write = '';
  close.onclick = () => dialog.close();
  close.id = 'cancel-exploration';
  dialog.append(body, info, commit, close);
  root.append(dialog);
  let session: Session | null = null,
    player: Player | null = null,
    selected = '',
    revision = -1,
    catalog: Catalog | null = null;
  function controls() {
    const s = session,
      sc = s?.scenario,
      round = s?.round,
      j = s?.journey;
    if (!s || !sc || !round || !j) return;
    const hero = s.preparation?.heroes.find((h) => h.heroId === round.activeHeroId),
      position = j.heroes.find((h) => h.heroId === hero?.heroId),
      remaining = j.travel?.remaining ?? 0;
    const allowed =
      !!hero &&
      hero.playerId === player?.id &&
      round.phase === 'action' &&
      !!position &&
      !position.removed &&
      adjacent(j.definition, position.spaceId, selected) &&
      remaining > 0 &&
      !!s.explorationFingerprints[selected] &&
      !sc.pending &&
      !s.physical?.active &&
      !s.physical?.cycle?.pending;
    commit.dataset.blocked = String(!allowed);
    info.textContent =
      `${j.definition.spaces.find((x) => x.id === selected)?.label ?? 'Tessera da esplorare'}. ` +
      (allowed
        ? `${catalog?.heroes.find((h) => h.id === hero!.heroId)?.name.text ?? 'L’eroe di turno'} · agisce ${s.players.find((p) => p.id === hero!.playerId)?.name ?? 'il proprietario'}. Entrare costa 1 movimento del viaggio già pagato; l’esplorazione non costa altre azioni. Dopo l’ingresso restano ${remaining - 1} movimenti. Annullare ora è gratuito.`
        : 'Conferma dal posto dell’eroe di turno, con un movimento disponibile e una casella visibile adiacente. Nessun costo finché non confermi.');
    refreshActions();
  }
  commit.onclick = async () => {
    const s = session,
      sc = s?.scenario,
      round = s?.round,
      j = s?.journey;
    if (!s || !sc || !round?.turnId || !round.activeHeroId || !j || commit.disabled) return;
    const fingerprint = s.explorationFingerprints[selected];
    if (!fingerprint || s.revision !== revision) return;
    const fromSpaceId = j.heroes.find((h) => h.heroId === round.activeHeroId)!.spaceId;
    dialog.close();
    await submit({
      type: 'EXPLORE_SCENARIO',
      scenarioId: sc.id,
      packFingerprint: sc.packFingerprint,
      projectionFingerprint: sc.projectionFingerprint,
      mapId: j.id,
      heroId: round.activeHeroId,
      roundId: round.id,
      turnId: round.turnId,
      fromSpaceId,
      destinationSpaceId: selected,
      sourceFingerprint: fingerprint,
    });
  };
  return {
    open(destination: string) {
      if (!session?.scenario) return;
      const a = explorationConfirmation(session.scenario);
      if (!a) return;
      selected = destination;
      revision = session.revision;
      body.replaceChildren(sourceText(a.text));
      commit.replaceChildren(sourceText(a.label));
      close.replaceChildren(sourceText(a.cancelLabel));
      controls();
      dialog.showModal();
    },
    update(s: Session, p: Player | null, content: Catalog | null) {
      session = s;
      player = p;
      catalog = content;
      if (dialog.open && s.revision !== revision) dialog.close();
      else if (dialog.open) controls();
    },
  };
}
