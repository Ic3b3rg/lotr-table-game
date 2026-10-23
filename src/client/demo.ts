import type { Command, Player, Session } from '../shared/protocol';
import { request, randomIntent, RequestError } from './api';
import { action } from './actions';
import { element } from './dom';

export function demoView(sync: () => Promise<void>) {
  let session: Session | null = null;
  let pending: Command | null = null;
  const error = element('#demo-error');
  async function send(command: Command) {
    await action(async () => {
      error.hidden = true;
      const sameIntent =
        pending &&
        JSON.stringify({ ...pending, requestId: '' }) ===
          JSON.stringify({ ...command, requestId: '' });
      pending = sameIntent ? pending : command;
      try {
        await request('/api/commands', pending);
        pending = null;
        await sync();
        element('#demo-status').focus();
      } catch (cause) {
        error.textContent =
          cause instanceof RequestError
            ? cause.message
            : 'Conferma non ricevuta. Attendi la riconnessione e riprova la stessa scelta.';
        error.hidden = false;
        if (cause instanceof RequestError) pending = null;
        await sync();
      }
    });
  }
  element('#new-demo').addEventListener('click', () => {
    if (session)
      void send({
        requestId: randomIntent(),
        generation: session.generation,
        type: 'OPEN_DEMO',
        expectedDemoId: session.demo?.id ?? null,
      });
  });
  element<HTMLFormElement>('#demo-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const choice = event.submitter instanceof HTMLButtonElement ? event.submitter.value : null;
    if (
      session?.demo &&
      (choice === 'A' || choice === 'B') &&
      element<HTMLInputElement>('#agreed').checked
    ) {
      void send({
        requestId: randomIntent(),
        generation: session.generation,
        type: 'RESOLVE_DEMO',
        demoId: session.demo.id,
        choice,
        agreed: true,
      });
    }
  });
  return {
    update(current: Session, player: Player | null) {
      if (current.demo?.id !== session?.demo?.id)
        element<HTMLInputElement>('#agreed').checked = false;
      if (session?.generation !== current.generation) pending = null;
      session = current;
      const demo = current.demo;
      element('#demo-controls').hidden = !player;
      element('#new-demo').hidden = Boolean(demo && demo.choice === null);
      element('#demo-form').hidden = !demo || demo.choice !== null;
      const confirmedBy =
        current.players.find((item) => item.id === demo?.resolvedBy)?.name ?? 'un compagno';
      element('#demo-status').textContent = !demo
        ? 'Pronti a provare il collegamento.'
        : demo.choice === null
          ? 'Il tavolo attende il segnale concordato.'
          : `Segnale ${demo.choice} registrato da ${confirmedBy}.`;
      element('#demo-help').textContent = player
        ? 'Accordatevi al tavolo; uno di voi può registrare la scelta dal telefono.'
        : 'Entra dal telefono o dalla vista personale per inviare un segnale condiviso.';
    },
  };
}
