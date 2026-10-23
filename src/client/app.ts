import { HostSchema, IdentitySchema, SessionSchema, type Session } from '../shared/protocol';
import { element, text } from './dom';
import { request } from './api';
import { setOnline } from './actions';
import { personalView } from './personal';

const personal = location.pathname === '/join';
element('#personal').hidden = !personal;
element('#invitation').hidden = personal;
let revision = -1;
let generation = '';
let refreshing: Promise<void> | null = null;
const personalController = personal ? personalView(sync) : null;

function renderSession(session: Session) {
  if (generation === session.generation && revision === session.revision) return;
  generation = session.generation;
  revision = session.revision;
  element('#count').textContent = `${session.players.length} / 5`;
  element('#saved').textContent = `Salvato sul PC · ${new Date(session.updatedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
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
  setOnline(value);
  const status = element('#connection');
  status.textContent = value ? 'Collegato al PC' : 'Collegamento interrotto · riprovo…';
  status.classList.toggle('offline', !value);
}

function sync(): Promise<void> {
  refreshing ??= (async () => {
    try {
      const session = SessionSchema.parse(await request('/api/session'));
      const me = personalController ? IdentitySchema.parse(await request('/api/me')) : null;
      renderSession(session);
      personalController?.update(session, me?.player ?? null);
      const requestedSession = new URL(location.href).searchParams.get('session');
      if (personal && requestedSession && requestedSession !== session.id) {
        element('#notice').textContent = 'Questo QR appartiene a un’altra sessione. Inquadra il QR corrente sul PC.';
        element('#notice').hidden = false;
        setConnection(false);
      } else { setConnection(true); }
    } catch { setConnection(false); }
    finally { refreshing = null; }
  })();
  return refreshing;
}
async function poll() { await sync(); setTimeout(poll, 1000); }

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
void poll();
if (!personal) void invitation();
