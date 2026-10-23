import { HostSchema, SessionSchema, type Session } from '../shared/protocol';
import { element, text } from './dom';

const personal = location.pathname === '/join';
element('#personal').hidden = !personal;
element('#invitation').hidden = personal;
let connected = false;
let revision = -1;

async function request(path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(path, {
    ...(body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(5000),
  });
  const result: unknown = await response.json();
  if (!response.ok) {
    const message = typeof result === 'object' && result !== null && 'error' in result && typeof result.error === 'object' && result.error !== null && 'message' in result.error ? String(result.error.message) : 'Il PC non ha completato la richiesta.';
    throw new Error(message);
  }
  return result;
}

function renderSession(session: Session) {
  if (revision === session.revision) return;
  revision = session.revision;
  element('#count').textContent = `${session.players.length} / 5`;
  element('#saved').textContent = `Aggiornato alle ${new Date(session.updatedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
  const rows = Array.from({ length: 5 }, (_, index) => {
    const player = session.players[index];
    const row = text('li', '', `player${player ? '' : ' empty'}`);
    row.append(text('span', player?.name.slice(0, 1).toLocaleUpperCase('it-IT') ?? '✧', 'player-avatar'));
    const description = document.createElement('div');
    description.append(text('span', player?.name ?? 'Posto libero', 'player-name'), text('span', player ? 'Nella compagnia' : 'In attesa di un compagno', 'player-detail'));
    row.append(description, text('span', String(index + 1).padStart(2, '0'), 'slot-number'));
    return row;
  });
  element('#players').replaceChildren(...rows);
}

function setConnection(value: boolean) {
  connected = value;
  const status = element('#connection');
  status.textContent = value ? 'Collegato al PC' : 'Collegamento interrotto · riprovo…';
  status.classList.toggle('offline', !value);
  element<HTMLButtonElement>('#join-form button').disabled = !value;
}

async function refresh() {
  try { renderSession(SessionSchema.parse(await request('/api/session'))); setConnection(true); }
  catch { setConnection(false); }
  finally { setTimeout(refresh, 1000); }
}

element<HTMLFormElement>('#join-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!connected) return;
  const error = element('#form-error');
  error.hidden = true;
  const button = element<HTMLButtonElement>('#join-form button');
  button.disabled = true;
  try {
    await request('/api/players', { name: element<HTMLInputElement>('#player-name').value });
    element('#join-form').hidden = true;
    element('#joined').hidden = false;
    element('#personal-title').textContent = 'Benvenuto al tavolo.';
    element('#welcome').textContent = element<HTMLInputElement>('#player-name').value;
  } catch (cause) {
    error.textContent = cause instanceof Error ? cause.message : 'Ingresso non riuscito.';
    error.hidden = false;
  } finally { button.disabled = !connected; }
});

async function invitation() {
  try {
    const host = HostSchema.parse(await request('/api/host'));
    const select = element<HTMLSelectElement>('#address');
    select.replaceChildren(...host.addresses.map(item => {
      const option = document.createElement('option'); option.value = item.address; option.textContent = item.label; return option;
    }));
    const update = () => {
      const address = host.addresses.find(item => item.address === select.value);
      element('#no-network').hidden = Boolean(address);
      element('#qr').hidden = !address;
      select.disabled = !address;
      if (address) {
        element<HTMLImageElement>('#qr').src = `/api/qr?address=${encodeURIComponent(address.address)}`;
        const link = element<HTMLAnchorElement>('#join-url'); link.href = address.joinUrl; link.textContent = address.joinUrl;
      }
    };
    select.addEventListener('change', update);
    update();
  } catch { element('#no-network').hidden = false; }
}
void refresh();
if (!personal) void invitation();
