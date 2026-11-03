import type { GenerationOffer } from '../shared/generated-map';
import type { Player, Session } from '../shared/protocol';
import { element } from './dom';
import { refreshActions } from './actions';
import { createGameActions } from './game-actions';

export function createMapGeneration(sync: () => Promise<void>) {
  const root = element('#adventure-generation'),
    status = element('#generation-status');
  const form = element<HTMLFormElement>('#generation-form'),
    agreed = element<HTMLInputElement>('#generation-agreed');
  const resume = element<HTMLButtonElement>('#generation-resume');
  let current: Session | null = null,
    player: Player | null = null,
    offer: GenerationOffer | null = null,
    key = '';
  const commands = createGameActions(
    () => current,
    sync,
    root,
    status,
    element('#generation-error'),
    controls,
  );
  function controls() {
    if (!current) return;
    const g = current.mapGeneration,
      visible = Boolean(g || offer?.kind !== 'legacy');
    root.hidden = current.preparation?.status !== 'prepared' || !visible;
    const frozen = g?.status === 'frozen',
      running = offer?.running ?? false;
    root.setAttribute('aria-busy', String(running));
    const ready = offer?.kind === 'ready';
    form.hidden = !ready || !player;
    resume.hidden = !player || !offer?.canResume;
    element<HTMLButtonElement>('#generation-create').dataset.blocked = String(
      !ready || !agreed.checked,
    );
    element('#generation-title').textContent = frozen
      ? 'La mappa è salvata'
      : g
        ? 'Creazione della mappa'
        : 'Create la mappa dell’avventura';
    const message = frozen
      ? 'La mappa e gli incontri di questa compagnia sono salvati sul PC. L’avvio dell’avventura è ancora da completare.'
      : (offer?.message ?? 'Collegamento al PC…');
    if (status.textContent !== message) status.textContent = message;
    element('#generation-observer').hidden = Boolean(player) || frozen || !ready;
    element('#generation-result').hidden = !frozen;
    const progress = element('#generation-progress');
    progress.hidden = !g;
    [...progress.children].forEach((node, i) => {
      const done = frozen || i === 0,
        active = running && i === 1;
      node.classList.toggle('step-done', done);
      if (active || (frozen && i === 2)) node.setAttribute('aria-current', 'step');
      else node.removeAttribute('aria-current');
    });
    element('#generation-startup').hidden = !frozen;
    refreshActions();
  }
  agreed.oninput = () => {
    commands.clear();
    controls();
  };
  form.onsubmit = (event) => {
    event.preventDefault();
    if (agreed.checked && offer?.packFingerprint && offer.contextFingerprint)
      void commands.submit(
        {
          type: 'GENERATE_ADVENTURE_MAP',
          packFingerprint: offer.packFingerprint,
          contextFingerprint: offer.contextFingerprint,
          agreed: true,
        },
        true,
      );
  };
  resume.onclick = () => {
    if (offer?.canResume && offer.jobId && offer.packFingerprint && offer.contextFingerprint)
      void commands.submit(
        {
          type: 'RESUME_ADVENTURE_MAP',
          jobId: offer.jobId,
          packFingerprint: offer.packFingerprint,
          contextFingerprint: offer.contextFingerprint,
          agreed: true,
        },
        true,
      );
  };
  return {
    update(session: Session, identity: Player | null, plan: GenerationOffer) {
      current = session;
      player = identity;
      offer = plan;
      const next = `${session.generation}:${identity?.id}:${plan.packFingerprint}:${plan.contextFingerprint}:${plan.jobId}`;
      if (next !== key) {
        key = next;
        agreed.checked = false;
        commands.clear();
      }
      controls();
    },
  };
}
