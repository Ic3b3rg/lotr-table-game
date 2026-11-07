import type { Session, Player } from '../shared/protocol';
import { PrivateLookViewSchema } from '../shared/interaction-look';
import { request } from './api';
import { text } from './dom';

/** Private content never enters the common catalog reader or session model. */
export function createPrivateLook() {
  const dialog = document.createElement('dialog');
  dialog.id = 'private-look-reader';
  dialog.className = 'scenario-node-dialog private-look-reader';
  dialog.setAttribute('aria-labelledby', 'private-look-title');
  document.body.append(dialog);
  let key = '',
    current: { pendingId: string; generation: string; heroId: string } | null = null;
  let caller: HTMLElement | null = null;
  let sequence = 0;
  function clear() {
    sequence++;
    if (dialog.open) dialog.close();
    dialog.replaceChildren();
  }
  dialog.addEventListener('close', () => {
    dialog.replaceChildren();
    if (caller?.isConnected) caller.focus();
  });
  return {
    update(session: Session, player: Player | null) {
      const a = session.physical?.active;
      const pendingId =
        session.scenario?.pending?.kind === 'physical'
          ? session.scenario.pending.id
          : session.physical?.cycle?.pending?.pendingId;
      const owned =
        a?.kind === 'decision' &&
        a.purpose === 'interaction-look' &&
        a.actorPlayerId === player?.id &&
        pendingId;
      const next = owned
        ? `${session.id}:${session.generation}:${player!.id}:${a.runId}:${pendingId}`
        : '';
      if (next !== key) clear();
      key = next;
      current = owned ? { pendingId, generation: session.generation, heroId: a.actorHeroId } : null;
    },
    controls() {
      const wrap = text('div', '', 'private-look-controls');
      const status = text('p', '', 'company-help');
      status.setAttribute('role', 'status');
      const button = text(
        'button',
        'Leggi la carta superiore · solo per te',
        'company-action',
      ) as HTMLButtonElement;
      button.id = 'read-private-look';
      button.type = 'button';
      button.onclick = async () => {
        if (!current) return;
        const expected = key,
          binding = { ...current },
          attempt = ++sequence;
        button.disabled = true;
        status.textContent = 'Caricamento della tua lettura…';
        try {
          const view = PrivateLookViewSchema.parse(
            await request(
              `/api/private/looks/${binding.pendingId}?generation=${binding.generation}`,
            ),
          );
          if (
            key !== expected ||
            sequence !== attempt ||
            !current ||
            view.pendingId !== current.pendingId ||
            view.generation !== current.generation ||
            view.heroId !== current.heroId
          )
            return;
          caller = button;
          const heading = text('h3', view.card.name);
          heading.id = 'private-look-title';
          const close = text('button', 'Chiudi la lettura', 'company-action') as HTMLButtonElement;
          close.type = 'button';
          close.id = 'close-private-look';
          close.onclick = () => dialog.close();
          dialog.replaceChildren(
            heading,
            text('p', `${view.card.success} successi · ${view.card.fate} fato`, 'card-type'),
            text('p', view.card.text, 'card-full-text'),
            text(
              'p',
              view.reward
                ? 'Hai ottenuto 1 ispirazione.'
                : view.card.fate > 0
                  ? 'Sei al limite: nessuna ispirazione aggiunta.'
                  : 'Nessun simbolo fato: nessuna ispirazione aggiunta.',
              'company-help',
            ),
            text(
              'p',
              'La carta resta in cima al mazzo. Chiudere la lettura non annulla l’interazione. Usa Continua l’interazione per proseguire.',
              'company-help',
            ),
            close,
          );
          dialog.showModal();
          close.focus();
          status.textContent = '';
        } catch {
          if (key === expected && sequence === attempt)
            status.textContent =
              'La lettura non è disponibile. Controlla il tuo posto e la richiesta corrente, poi riprova.';
        } finally {
          if (key === expected && sequence === attempt) button.disabled = false;
        }
      };
      wrap.append(button, status);
      return wrap;
    },
  };
}
