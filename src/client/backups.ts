import { BackupPreviewSchema, type Session } from '../shared/protocol';
import { request, RequestError } from './api';
import { action } from './actions';
import { element } from './dom';

export function backupView(sync: () => Promise<void>) {
  let current: Session | null = null;
  let selected: unknown = null;
  const error = element('#backup-error');
  function showError(cause: unknown) {
    error.textContent =
      cause instanceof RequestError
        ? cause.message
        : 'Operazione non completata. Controlla il collegamento e lo stato del tavolo prima di riprovare.';
    error.hidden = false;
  }
  function reset() {
    selected = null;
    element<HTMLInputElement>('#backup-file').value = '';
    element('#restore-preview').hidden = true;
  }
  element('#export-backup').addEventListener('click', () => {
    void action(async () => {
      error.hidden = true;
      try {
        const backup = await request('/api/backups');
        BackupPreviewSchema.parse(backup);
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }),
        );
        const link = document.createElement('a');
        link.href = url;
        link.download = `viaggi-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
        element('#backup-status').textContent =
          'Copia preparata. Conservala nei file del dispositivo.';
      } catch (cause) {
        showError(cause);
      }
    });
  });
  element<HTMLInputElement>('#backup-file').addEventListener('change', async (event) => {
    error.hidden = true;
    selected = null;
    element('#restore-preview').hidden = true;
    if (!(event.target instanceof HTMLInputElement)) return;
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 4_000_000)
        throw new RequestError(
          'TOO_LARGE',
          'La copia supera il limite di 4 MB di questa versione.',
        );
      const data: unknown = JSON.parse(await file.text());
      const parsed = BackupPreviewSchema.safeParse(data);
      if (!parsed.success)
        throw new RequestError(
          'INVALID_BACKUP',
          'Scegli una copia della sessione di questa versione del tavolo.',
        );
      selected = data;
      const state = parsed.data.payload.state;
      const names = state.players.map((player) => player.name).join(', ') || 'nessun partecipante';
      element('#restore-summary').textContent =
        `Copia del ${new Date(state.updatedAt).toLocaleString('it-IT')}. Partecipanti: ${names}.`;
      element('#restore-preview').hidden = false;
    } catch (cause) {
      showError(
        cause instanceof SyntaxError
          ? new RequestError('INVALID_BACKUP', 'Il file non contiene una copia JSON valida.')
          : cause,
      );
    }
  });
  element('#restore-backup').addEventListener('click', () => {
    if (!current || !selected) return;
    const { generation, revision } = current;
    const backup = selected;
    if (
      !confirm(
        'Ripristinare questa copia? Il tavolo attuale sarà sostituito. I giocatori dovranno recuperare il proprio posto con il codice personale.',
      )
    )
      return;
    void action(async () => {
      error.hidden = true;
      try {
        await request('/api/restores', {
          backup,
          generation,
          expectedRevision: revision,
          confirmed: true,
        });
        reset();
        element('#backup-status').textContent =
          'Copia ripristinata. Riprendi il tuo posto con il codice personale.';
        await sync();
      } catch (cause) {
        showError(cause);
        await sync();
      }
    });
  });
  return {
    update(session: Session, allowed: boolean) {
      if (current && current.generation !== session.generation) reset();
      current = session;
      element('#backups').hidden = !allowed;
    },
  };
}
