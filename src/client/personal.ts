import { JoinSchema, type Player, type Session } from '../shared/protocol';
import type { z } from 'zod';
import { randomIntent, request, RequestError } from './api';
import { action } from './actions';
import { element } from './dom';

export function personalView(sync: () => Promise<void>) {
  let generation = '';
  let pendingJoin: z.infer<typeof JoinSchema> | null = null;
  let previousPlayer: string | null = null;
  const error = element('#form-error');
  const showError = (cause: unknown) => {
    error.textContent =
      cause instanceof RequestError
        ? cause.message
        : 'Collegamento interrotto. Attendi la riconnessione e riprova la stessa richiesta.';
    error.hidden = false;
  };
  element<HTMLFormElement>('#join-form').addEventListener('submit', (event) => {
    event.preventDefault();
    void action(async () => {
      error.hidden = true;
      pendingJoin ??= {
        name: element<HTMLInputElement>('#player-name').value.trim(),
        requestId: randomIntent(),
        recoveryCode: randomIntent(),
        generation,
      };
      const code = element<HTMLInputElement>('#my-code');
      code.value = pendingJoin.recoveryCode.match(/.{4}/g)?.join('-') ?? pendingJoin.recoveryCode;
      element('#recovery-note').hidden = false;
      try {
        await request('/api/players', pendingJoin);
        pendingJoin = null;
        await sync();
        element('#personal-title').focus();
      } catch (cause) {
        showError(cause);
        if (cause instanceof RequestError) pendingJoin = null;
      }
    });
  });
  element<HTMLFormElement>('#recover-form').addEventListener('submit', (event) => {
    event.preventDefault();
    void action(async () => {
      error.hidden = true;
      try {
        await request('/api/recover', {
          recoveryCode: element<HTMLInputElement>('#recover-code').value,
          generation,
        });
        element<HTMLInputElement>('#recover-code').value = '';
        element<HTMLDetailsElement>('#recover-details').open = false;
        await sync();
        element('#personal-title').focus();
      } catch (cause) {
        showError(cause);
      }
    });
  });
  element<HTMLInputElement>('#my-code').addEventListener('click', (event) => {
    if (event.target instanceof HTMLInputElement) event.target.select();
  });
  return {
    update(session: Session, player: Player | null) {
      if (generation && generation !== session.generation) {
        pendingJoin = null;
        element('#recovery-note').hidden = true;
        element<HTMLInputElement>('#my-code').value = '';
        element('#notice').textContent =
          'La sessione è cambiata. Recupera il tuo posto con il codice personale.';
        element('#notice').hidden = false;
      }
      generation = session.generation;
      const full = Boolean(
        session.group && session.players.length >= session.group.expectedPlayers,
      );
      const prepared = session.preparation?.status === 'prepared';
      element('#join-form').hidden = Boolean(player) || full || prepared;
      element('#joined').hidden = !player;
      element('#recover-details').hidden = Boolean(player);
      element('#personal-title').textContent = player
        ? 'Il tuo posto è pronto.'
        : full || prepared
          ? 'Riprendi il tuo posto.'
          : 'Come ti chiami?';
      element('#personal-next').textContent = player
        ? 'Il passo attuale qui sopra indica cosa fare adesso. Conserva il codice se è ancora visibile qui sotto.'
        : full || prepared
          ? 'Il gruppo è già al tavolo. Usa il codice personale ricevuto al primo ingresso; non serve un nuovo giocatore.'
          : 'Ogni persona entra da un browser o dispositivo diverso.';
      element('#welcome').textContent = player?.name ?? '';
      if (previousPlayer && !player) element('#recovery-note').hidden = true;
      previousPlayer = player?.id ?? null;
    },
  };
}
