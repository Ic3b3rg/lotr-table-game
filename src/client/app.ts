import { ScenarioOfferSchema } from '../shared/scenario';
import { HostSchema, IdentitySchema, SessionSchema, type Session } from '../shared/protocol';
import { element, text } from './dom';
import { request } from './api';
import { setOnline } from './actions';
import { personalView } from './personal';
import { demoView } from './demo';
import { backupView } from './backups';
import { createCompany } from './company';
import { createGuidedStart } from './guided-start';
import { GenerationOfferSchema } from '../shared/generated-map';

const personal = location.pathname === '/join';
element('#personal').hidden = !personal;
element('#invitation').hidden = personal;
document.body.classList.toggle('personal-mode', personal);
let revision = -1;
let generation = '';
let refreshing: Promise<void> | null = null;
let invitationUpdatedAt = 0;
const personalController = personal ? personalView(sync) : null;
const demoController = demoView(sync);
const backupController = backupView(sync);
const companyController = createCompany(() => sync(true));
const guidedController = createGuidedStart(() => sync(true));

function renderSession(session: Session) {
  if (generation === session.generation && revision === session.revision) return;
  generation = session.generation;
  revision = session.revision;
  const expected = session.group?.expectedPlayers;
  element('#count').textContent = expected
    ? `${session.players.length} / ${expected}`
    : `${session.players.length} presenti`;
  element('#saved').textContent =
    `Salvato sul PC · ${new Date(session.updatedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
  const rows = Array.from({ length: expected ?? session.players.length }, (_, index) => {
    const player = session.players[index];
    const row = text('li', '', `player${player ? '' : ' empty'}`);
    row.append(
      text('span', player?.name.slice(0, 1).toLocaleUpperCase('it-IT') ?? '✧', 'player-avatar'),
    );
    const description = document.createElement('div');
    description.append(
      text('span', player?.name ?? 'Posto libero', 'player-name'),
      text('span', player ? 'Giocatore al tavolo' : 'In attesa di un giocatore', 'player-detail'),
    );
    row.append(description, text('span', String(index + 1).padStart(2, '0'), 'slot-number'));
    return row;
  });
  element('#players').replaceChildren(...rows);
}

function setConnection(value: boolean) {
  setOnline(value);
  const status = element('#connection');
  const message = value ? 'Collegato al PC' : 'Collegamento interrotto · riprovo…';
  if (status.textContent !== message) status.textContent = message;
  status.classList.toggle('offline', !value);
}

function sync(fresh = false): Promise<void> {
  if (fresh && refreshing) return refreshing.then(() => sync());
  refreshing ??= (async () => {
    try {
      const session = SessionSchema.parse(await request('/api/session'));
      const me = IdentitySchema.parse(await request('/api/me'));
      const generationOffer = GenerationOfferSchema.parse(
        await request('/api/map-generation-plan'),
      );
      if (
        !personal &&
        (generation !== session.generation || Date.now() - invitationUpdatedAt > 15_000)
      ) {
        await invitation();
        invitationUpdatedAt = Date.now();
      }
      const scenarioOffer = ScenarioOfferSchema.parse(await request('/api/scenario-plan'));
      renderSession(session);
      companyController.update(session, me.player, generationOffer, scenarioOffer);
      personalController?.update(session, me.player);
      guidedController.update(session, me.player, generationOffer);
      demoController.update(session, personal ? me.player : null);
      backupController.update(session, me.canManageBackups);
      const requestedSession = new URL(location.href).searchParams.get('session');
      if (personal && requestedSession && requestedSession !== session.id) {
        element('#notice').textContent =
          'Questo QR appartiene a un’altra sessione. Inquadra il QR corrente sul PC.';
        element('#notice').hidden = false;
        setConnection(false);
      } else {
        setConnection(true);
      }
    } catch {
      setConnection(false);
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}
async function poll() {
  await sync();
  setTimeout(poll, 1000);
}

async function invitation() {
  try {
    const host = HostSchema.parse(await request('/api/host'));
    element('#no-network').textContent = host.isLoopbackOnly
      ? 'L’host è avviato solo su questo PC. Consulta le istruzioni di avvio per abilitare il collegamento dei telefoni.'
      : 'Collega il PC alla rete Wi-Fi o Ethernet per mostrare il QR.';
    const select = element<HTMLSelectElement>('#address');
    const previous = select.value;
    select.replaceChildren(
      ...host.addresses.map((item) => {
        const option = document.createElement('option');
        option.value = item.address;
        option.textContent = item.label;
        return option;
      }),
    );
    if (host.addresses.some((item) => item.address === previous)) select.value = previous;
    const update = () => {
      const address = host.addresses.find((item) => item.address === select.value);
      element('#no-network').hidden = Boolean(address);
      element('#qr').hidden = !address;
      select.disabled = !address;
      if (address) {
        element<HTMLImageElement>('#qr').src =
          `/api/qr?address=${encodeURIComponent(address.address)}&session=${encodeURIComponent(address.joinUrl)}`;
        const link = element<HTMLAnchorElement>('#join-url');
        link.href = address.joinUrl;
        link.textContent = address.joinUrl;
      }
    };
    select.onchange = update;
    update();
  } catch {
    element('#no-network').hidden = false;
    element('#qr').hidden = true;
  }
}
void poll();
