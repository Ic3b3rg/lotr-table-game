import type { Session, Player, Command } from '../shared/protocol';
import type { ScenarioInstance } from '../shared/scenario';
import type { Catalog } from '../shared/catalog';
import { encounterEntry, encounterOptions } from '../shared/encounter-entry';
import { playableScenarioPrefab } from '../shared/clues';
import { sourceText } from './source-text';
import { text } from './dom';
import { refreshActions } from './actions';

type Intent = Omit<
  Extract<Command, { type: 'INTERACT_SCENARIO' }>,
  'generation' | 'requestId' | 'expectedRevision'
>;
export function createEncounterInspection(
  root: HTMLElement,
  submit: (intent: Intent) => Promise<unknown>,
) {
  const dialog = document.createElement('dialog');
  dialog.className = 'scenario-node-dialog';
  dialog.setAttribute('aria-label', 'Ispeziona il segnalino');
  const body = document.createElement('div'),
    info = text('p', '', 'company-help'),
    commit = text('button', '', 'company-action') as HTMLButtonElement,
    close = text('button', 'Annulla · chiudi ispezione', 'company-action') as HTMLButtonElement;
  commit.type = 'button';
  commit.dataset.write = '';
  commit.id = 'confirm-encounter';
  close.type = 'button';
  close.onclick = () => dialog.close();
  dialog.append(body, info, commit, close);
  root.append(dialog);
  let session: Session | null = null,
    player: Player | null = null,
    catalog: Catalog | null = null,
    selected: string | null = null;
  const node = () => session?.scenario?.instances.find((i) => i.id === selected);
  const confirmation = (i: ScenarioInstance) =>
    encounterEntry(session!.scenario!.pack, i, session!.scenario!.globals)?.action;
  function controls() {
    const sc = session?.scenario,
      i = node();
    if (!sc || !i) return;
    const m = sc.pack.manifest.prefabs.find((m) => m.source === i.prefab)!,
      a = confirmation(i),
      option =
        a?.op === 'choice'
          ? encounterOptions(a, i, sc.globals).find((o) => o.cost === 'interact')
          : null,
      round = session!.round,
      hero = session!.preparation?.heroes.find((h) => h.heroId === round?.activeHeroId),
      progress = round?.heroes.find((h) => h.heroId === hero?.heroId),
      position = session!.journey?.heroes.find((h) => h.heroId === hero?.heroId),
      space = sc.spaceBindings.find((b) => b.sourceId === i.spaceId)?.id;
    const cost =
      m.nodeType === 'threat'
        ? (session!.physical?.cycle?.heroes.find((h) => h.heroId === hero?.heroId)
            ?.interactInspiration ?? 0)
        : 0;
    const supported =
      sc.pack.manifest.scope === 'original-encounter-v1' &&
      playableScenarioPrefab(sc.pack, i.prefab!) &&
      !!a;
    const allowed =
      supported &&
      sc.phase === 'action' &&
      !!hero &&
      hero.playerId === player?.id &&
      round?.phase === 'action' &&
      position?.spaceId === space &&
      !position?.removed &&
      (progress?.actionsUsed ?? 2) < 2 &&
      (hero?.inspiration ?? 0) >= cost &&
      !sc.pending &&
      !session!.physical?.active &&
      i.visible &&
      !i.stopped &&
      i.settled &&
      !!session!.encounterFingerprints[i.id];
    commit.dataset.blocked = String(!allowed);
    commit.hidden = !supported || (a?.op === 'choice' && !option);
    commit.replaceChildren(
      ...(a?.op === 'confirm' ? [sourceText(a.label)] : option ? [sourceText(option.label)] : []),
    );
    body.replaceChildren(sourceText(a?.text ?? m.inspection));
    const remaining = session!.journey?.travel?.remaining ?? 0;
    info.textContent = !supported
      ? sc.pack.manifest.clues?.fort.prefab === i.prefab
        ? 'Il covo è individuato. L’interazione finale e la conclusione dell’avventura richiedono ancora i loro effetti. Ispezionare e annullare è gratuito; nessuna azione viene consumata.'
        : 'Ispezionare e annullare è gratuito. Questo segnalino richiede effetti ancora in sviluppo.'
      : a?.op === 'choice' && !option
        ? 'Questo luogo attende ciò che serve per proseguire. Leggere e allontanarsi è gratuito; la Compagnia può tornare più tardi.'
        : allowed
          ? `${catalog?.heroes.find((h) => h.id === hero?.heroId)?.name.text ?? 'Eroe di turno'} · conferma: 1 azione${cost ? ` e ${cost} ispirazione richiesta dalle carte attive` : ``}. Movimenti del viaggio conservati: ${remaining}. Le prove e le scelte sono la continuazione dell’interazione.`
          : sc.pending
            ? 'Completa la richiesta dell’avventura. L’ispezione è gratuita.'
            : !hero
              ? 'Inizia il turno di un eroe e raggiungi questa casella. L’ispezione è gratuita.'
              : hero.playerId !== player?.id
                ? 'Conferma dal posto del proprietario dell’eroe di turno.'
                : position?.spaceId !== space
                  ? 'Raggiungi questa casella prima di confermare. L’ispezione è gratuita.'
                  : hero.inspiration < cost
                    ? `Le carte attive richiedono ${cost} ispirazione prima di interagire.`
                    : 'Questo eroe ha concluso le azioni disponibili.';
    if (!i.visible && dialog.open) dialog.close();
    refreshActions();
  }
  commit.onclick = async () => {
    const s = session,
      sc = s?.scenario,
      i = node(),
      round = s?.round;
    if (!s || !sc || !i || !round?.turnId || !round.activeHeroId || commit.disabled) return;
    const sourceFingerprint = s.encounterFingerprints[i.id];
    if (!sourceFingerprint) return;
    const a = confirmation(i);
    const option =
      a?.op === 'choice'
        ? encounterOptions(a, i, sc.globals).find((o) => o.cost === 'interact')
        : null;
    if (a?.op === 'choice' && !option) return;
    dialog.close();
    await submit({
      type: 'INTERACT_SCENARIO',
      scenarioId: sc.id,
      packFingerprint: sc.packFingerprint,
      projectionFingerprint: sc.projectionFingerprint,
      instanceId: i.id,
      heroId: round.activeHeroId,
      roundId: round.id,
      turnId: round.turnId,
      sourceFingerprint,
      ...(option ? { choiceEvent: option.event } : {}),
    });
  };
  return {
    open(instanceId: string) {
      selected = instanceId;
      const i = node();
      if (!i || !session?.scenario) return;
      const m = session.scenario.pack.manifest.prefabs.find((m) => m.source === i.prefab)!;
      body.replaceChildren(sourceText(confirmation(i)?.text ?? m.inspection));
      controls();
      dialog.showModal();
    },
    update(s: Session, p: Player | null, content: Catalog | null = null) {
      session = s;
      player = p;
      catalog = content;
      if (dialog.open) controls();
    },
  };
}
