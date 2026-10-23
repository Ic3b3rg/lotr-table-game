// Throwaway interaction study. Values and abilities are synthetic; no session API is used.
import { element } from '../../dom';

type Place = { name: string; x: number; y: number };
type Pending =
  | { kind: 'move'; zone: number }
  | { kind: 'skill'; skill: number }
  | { kind: 'attack' }
  | { kind: 'interact' };
type Mode = 'move' | 'attack' | 'interact';
type Scene = {
  zone: number;
  actions: number;
  travel: number;
  freeStep: number;
  precision: boolean;
  guard: boolean;
  damage: number;
  enemyZone: number;
  enemyHealth: number;
  round: number;
  phase: 'action' | 'shadow' | 'victory';
  used: Set<number>;
  explored: boolean;
  xp: number;
  learned: boolean;
};

const places: Place[] = [
  { name: 'La radura', x: 435, y: 600 },
  { name: 'Il sentiero', x: 660, y: 430 },
  { name: 'Il ponte', x: 985, y: 405 },
  { name: 'Le rovine', x: 1215, y: 285 },
];
const skills = [
  {
    name: 'Passo rapido',
    copy: 'Un passo aggiuntivo, senza spendere un’azione. Effetto dimostrativo, una volta per turno.',
  },
  {
    name: 'Tiro mirato',
    copy: 'Il prossimo attacco infligge un colpo aggiuntivo. Effetto dimostrativo, una volta per turno.',
  },
  {
    name: 'Guardia',
    copy: 'Assorbi un danno della prossima fase Ombra. Effetto dimostrativo, una volta per turno.',
  },
];
function fresh(): Scene {
  return {
    zone: 0,
    actions: 2,
    travel: 0,
    freeStep: 0,
    precision: false,
    guard: false,
    damage: 0,
    enemyZone: 3,
    enemyHealth: 3,
    round: 1,
    phase: 'action',
    used: new Set(),
    explored: false,
    xp: 0,
    learned: false,
  };
}
function place(index: number) {
  const result = places[index];
  if (!result) throw new Error('Zona della prova mancante.');
  return result;
}
const root = element('#prototype');
const stage = element('#stage');
const world = element('#world');
const hero = element<HTMLButtonElement>('#hero');
const enemy = element<HTMLButtonElement>('#enemy');
const heroSprite = element('#hero-sprite');
const enemySprite = element('#enemy-sprite');
const confirm = element<HTMLButtonElement>('#confirm');
const cancel = element<HTMLButtonElement>('#cancel');
const feedback = element('#feedback');
const motion = element<HTMLInputElement>('#reduce-motion');
const characterDialog = element<HTMLDialogElement>('#character-dialog');
const log: string[] = [];
let state = fresh();
let pending: Pending | null = null;
let mode: Mode = 'move';
let ready = false;
let busy = false;
let sound = false;
let audio: AudioContext | null = null;
const camera = { x: 650, y: 480, zoom: 1 };
motion.checked = matchMedia('(prefers-reduced-motion: reduce)').matches;
const reduced = () => motion.checked;

const zoneButtons = places.map((location, index) => {
  const button = document.createElement('button');
  button.className = 'zone-anchor';
  button.id = `zone-${index}`;
  button.style.left = `${location.x}px`;
  button.style.top = `${location.y + 18}px`;
  button.textContent = String(index + 1);
  button.setAttribute('aria-label', `Viaggia: ${location.name}`);
  const label = document.createElement('span');
  label.textContent = location.name;
  button.append(label);
  button.addEventListener('click', () => selectMove(index));
  element('#zone-buttons').append(button);
  return button;
});

function say(message: string) {
  feedback.textContent = message;
  log.push(message);
  if (log.length > 30) log.shift();
}
function playable() {
  return ready && !busy && state.phase === 'action';
}
function canMove(zone: number) {
  return (
    playable() &&
    Math.abs(zone - state.zone) === 1 &&
    (state.actions > 0 || state.travel > 0 || state.freeStep > 0)
  );
}
function canAttack() {
  return (
    playable() &&
    state.actions > 0 &&
    state.enemyHealth > 0 &&
    Math.abs(state.zone - state.enemyZone) <= 1
  );
}
function frame(sprite: HTMLElement, index: number, rows: number) {
  sprite.style.backgroundPosition = `${((index % 4) * 100) / 3}% ${rows === 1 ? 0 : Math.floor(index / 4) * 100}%`;
}
function position(actor: HTMLElement, location: Place, size: number) {
  actor.style.left = `${location.x}px`;
  actor.style.top = `${location.y}px`;
  actor.style.height = `${size}px`;
  actor.style.width = `${size * 0.8}px`;
}
function enemyPosition(zone = state.enemyZone): Place {
  const location = place(zone);
  return {
    ...location,
    x: location.x + (zone === state.zone ? 100 : 0),
    y: location.y - (zone === state.zone ? 18 : 0),
  };
}
function cameraTransform() {
  const bounds = stage.getBoundingClientRect();
  const hud = element('.hud').getBoundingClientRect();
  const available = Math.max(200, hud.top - bounds.top - 20);
  const scale = Math.max(bounds.width / 1600, available / 700) * camera.zoom;
  world.style.setProperty('--inverse-scale', String(1 / scale));
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const x = clamp(bounds.width / 2 - camera.x * scale, Math.min(0, bounds.width - 1600 * scale), 0);
  const y = clamp(available / 2 - camera.y * scale, Math.min(0, bounds.height - 1000 * scale), 0);
  return `translate(${x}px,${y}px) scale(${scale})`;
}
function updateCamera(animate = false) {
  const before = world.style.transform;
  const after = cameraTransform();
  world.style.transform = after;
  if (animate && !reduced() && before && before !== after)
    world.animate([{ transform: before }, { transform: after }], {
      duration: 380,
      easing: 'cubic-bezier(.16,1,.3,1)',
    });
}
function focusHero(animate = true) {
  const current = place(state.zone);
  const next = place(Math.min(3, state.zone + 1));
  camera.x = (current.x + next.x) / 2;
  camera.y = (current.y + next.y) / 2;
  updateCamera(animate);
}
function skillButtons() {
  return skills.map((_, index) => element<HTMLButtonElement>(`#skill-${index}`));
}

function render() {
  root.dataset.zone = String(state.zone);
  root.dataset.actions = String(state.actions);
  root.dataset.travel = String(state.travel);
  root.dataset.enemyHealth = String(state.enemyHealth);
  root.dataset.phase = state.phase;
  root.dataset.busy = String(busy);
  root.dataset.xp = String(state.xp);
  root.dataset.learned = String(state.learned);
  element('#phase-name').textContent =
    state.phase === 'shadow'
      ? 'Fase Ombra'
      : state.phase === 'victory'
        ? 'Il viaggio continua'
        : 'Fase Azione';
  element('#round').textContent = `Round ${state.round}`;
  element('#damage').textContent = String(state.damage);
  element('#guard-state').textContent = state.guard ? 'Guardia pronta' : 'Nessuna protezione';
  element('#enemy-health').textContent = `${state.enemyHealth} / 3 · prova`;
  enemy.setAttribute(
    'aria-label',
    `Sentinella: ${state.enemyHealth} colpi rimasti, bersaglio dimostrativo`,
  );
  enemy.classList.toggle('defeated', state.enemyHealth === 0);
  if (!busy) {
    position(hero, place(state.zone), 176 - state.zone * 13);
    position(enemy, enemyPosition(), 151 - state.enemyZone * 6);
    frame(heroSprite, state.phase === 'victory' ? 7 : 4, 2);
    frame(enemySprite, state.enemyHealth === 0 ? 3 : 0, 1);
  }
  hero.disabled = !ready || busy;
  enemy.disabled = !playable() || state.enemyHealth === 0;
  element('#actions-count').textContent =
    `${state.actions} ${state.actions === 1 ? 'azione' : 'azioni'}${state.travel ? ' · 1 passo di viaggio' : ''}${state.freeStep ? ' · 1 passo extra' : ''}`;
  const end = element<HTMLButtonElement>('#end-turn');
  end.disabled = !playable();
  end.textContent = state.actions === 0 ? 'Avvia fase Ombra' : 'Termina turno';
  for (const action of ['move', 'attack', 'interact']) {
    const button = element<HTMLButtonElement>(`#mode-${action}`);
    button.disabled = !playable();
    button.setAttribute('aria-pressed', String(mode === action));
  }
  skillButtons().forEach((button, index) => {
    button.disabled = !playable() || state.used.has(index);
    button.setAttribute(
      'aria-pressed',
      String(pending?.kind === 'skill' && pending.skill === index),
    );
  });
  zoneButtons.forEach((button, index) => {
    button.disabled = !canMove(index);
    button.setAttribute('aria-pressed', String(pending?.kind === 'move' && pending.zone === index));
    const path = document.getElementById(`outline-${index}`);
    path?.classList.toggle('current', index === state.zone);
    path?.classList.toggle('available', canMove(index));
    path?.classList.toggle('selected', pending?.kind === 'move' && pending.zone === index);
  });
  const route = document.getElementById('route');
  if (pending?.kind === 'move') {
    const from = place(state.zone),
      to = place(pending.zone);
    route?.setAttribute(
      'd',
      `M${from.x} ${from.y} Q${(from.x + to.x) / 2} ${Math.min(from.y, to.y) - 15} ${to.x} ${to.y}`,
    );
  } else route?.setAttribute('d', '');
  let title = 'Scegli una destinazione';
  let help = 'Tocca una zona vicina sul terreno.';
  let label = 'Conferma movimento';
  let valid = false;
  if (mode === 'attack') {
    title = 'Scegli il bersaglio';
    help = canAttack()
      ? 'Tocca la sentinella oltre il ponte.'
      : 'Avvicinati al ponte per usare l’arco.';
    label = 'Conferma attacco';
  }
  if (mode === 'interact') {
    title = 'Esamina il guado';
    help =
      state.zone === 2
        ? 'Puoi osservare le pietre del ponte.'
        : 'Raggiungi il ponte per osservare le tracce.';
    label = 'Esamina il ponte';
  }
  if (pending?.kind === 'move') {
    title = place(pending.zone).name;
    help =
      state.travel > 0
        ? 'Secondo movimento del viaggio già iniziato.'
        : state.freeStep > 0
          ? 'Usa il passo extra preparato.'
          : 'Una azione di viaggio, fino a due movimenti.';
    valid = canMove(pending.zone);
  } else if (pending?.kind === 'attack') {
    title = state.precision ? 'Tiro mirato pronto' : 'Arco contro la sentinella';
    help = `${state.precision ? 3 : 2} colpi dimostrativi · 1 azione. Conferma per scoccare.`;
    valid = canAttack();
  } else if (pending?.kind === 'skill') {
    const skill = skills[pending.skill];
    if (skill) {
      title = skill.name;
      help = skill.copy;
      label = `Usa ${skill.name}`;
      valid = playable() && !state.used.has(pending.skill);
    }
  } else if (pending?.kind === 'interact') {
    valid = playable() && state.zone === 2 && state.actions > 0 && !state.explored;
    if (state.explored) help = 'Hai già osservato le tracce in questa prova.';
  }
  if (state.actions === 0 && !state.travel && !state.freeStep && !pending) {
    title = 'Il tuo turno è completo';
    help = 'Avvia la fase Ombra per vedere la risposta del nemico.';
  }
  if (state.phase === 'victory') {
    title = 'Il guado è libero';
    help = 'Apri l’accampamento per provare la crescita dell’eroe.';
  }
  if (busy) {
    title = state.phase === 'shadow' ? 'Le ombre si muovono' : 'L’azione prende vita';
    help = 'Osserva il terreno. L’esito apparirà nella cronaca.';
  }
  element('#action-title').textContent = title;
  element('#action-help').textContent = help;
  confirm.textContent = label;
  confirm.disabled = !valid || busy;
  confirm.hidden = state.phase === 'victory';
  cancel.hidden = !pending || busy || state.phase === 'victory';
  element('#victory').hidden = state.phase !== 'victory' || busy;
  element<HTMLButtonElement>('#restart').disabled = busy;
  renderCharacter();
}

function renderCharacter() {
  element('#sheet-damage').textContent = String(state.damage);
  element('#sheet-xp').textContent = String(state.xp);
  element('#growth-title').textContent = state.learned
    ? 'Difesa salda acquisita.'
    : state.phase === 'victory'
      ? 'Una nuova possibilità.'
      : 'La crescita comincia dal viaggio.';
  element('#growth-copy').textContent = state.learned
    ? 'L’abilità è ora nel repertorio dimostrativo dell’eroe. Questa è la sensazione di crescita che porteremo al catalogo reale.'
    : state.phase === 'victory'
      ? 'Hai ottenuto 1 esperienza nella prova. Puoi spenderla per vedere una nuova abilità aggiunta al personaggio.'
      : 'Libera il guado per provare l’accampamento e acquisire un’abilità dimostrativa.';
  const learn = element<HTMLButtonElement>('#learn');
  learn.hidden = state.phase !== 'victory' || state.learned;
  learn.disabled = state.xp < 1 || busy;
}
function selectMove(zone: number) {
  if (!canMove(zone)) return;
  mode = 'move';
  pending = { kind: 'move', zone };
  render();
}
function selectAttack() {
  if (!playable() || state.enemyHealth === 0) return;
  mode = 'attack';
  pending = canAttack() ? { kind: 'attack' } : null;
  if (!canAttack()) say('Raggiungi il ponte: da lì l’arco può colpire la sentinella.');
  render();
}

async function animate(node: HTMLElement, frames: Keyframe[], duration: number) {
  // https://developer.mozilla.org/en-US/docs/Web/API/Element/animate
  await node.animate(frames, {
    duration: reduced() ? 1 : duration,
    easing: 'cubic-bezier(.2,.75,.3,1)',
  }).finished;
}
function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, reduced() ? 1 : ms));
}
async function moveActor(actor: HTMLElement, from: Place, to: Place, walking: boolean) {
  const start = performance.now();
  const duration = reduced() ? 1 : Math.max(700, Math.hypot(to.x - from.x, to.y - from.y) * 3.2);
  if (walking) heroSprite.style.transform = to.x < from.x ? 'scaleX(-1)' : '';
  await new Promise<void>((resolve) => {
    function tick(now: number) {
      const t = reduced() ? 1 : Math.min(1, (now - start) / duration);
      actor.style.left = `${from.x + (to.x - from.x) * t}px`;
      actor.style.top = `${from.y + (to.y - from.y) * t}px`;
      if (walking) frame(heroSprite, Math.floor((now - start) / 140) % 4, 2);
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    }
    requestAnimationFrame(tick);
  });
  if (walking) {
    heroSprite.style.transform = '';
    frame(heroSprite, 4, 2);
  }
}
async function floating(message: string, location: Place, hurt = false) {
  const node = document.createElement('span');
  node.className = `floating${hurt ? ' hurt' : ''}`;
  node.textContent = message;
  node.style.left = `${location.x - 22}px`;
  node.style.top = `${location.y - 150}px`;
  element('#effects').append(node);
  await animate(
    node,
    [
      { transform: 'translateY(0)', opacity: 1 },
      { transform: 'translateY(-65px)', opacity: 0 },
    ],
    1000,
  );
  node.remove();
}
function tone(type: 'move' | 'bow' | 'hit' | 'win') {
  if (!sound) return;
  try {
    audio ??= new AudioContext();
    void audio.resume();
    const oscillator = audio.createOscillator(),
      gain = audio.createGain();
    const now = audio.currentTime;
    const frequency = type === 'bow' ? 320 : type === 'hit' ? 90 : type === 'win' ? 520 : 185;
    oscillator.type = type === 'hit' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      frequency * (type === 'win' ? 1.5 : 0.45),
      now + 0.22,
    );
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.07, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.32);
  } catch {
    sound = false;
  }
}
async function shoot(from: Place, to: Place) {
  const arrow = document.createElement('span');
  arrow.className = 'arrow';
  const start = { x: from.x + 30, y: from.y - 95 },
    end = { x: to.x - 15, y: to.y - 80 };
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  arrow.style.left = `${start.x}px`;
  arrow.style.top = `${start.y}px`;
  arrow.style.transform = `rotate(${angle}rad)`;
  element('#effects').append(arrow);
  await animate(
    arrow,
    [
      { transform: `translate(0,0) rotate(${angle}rad)`, opacity: 1 },
      {
        transform: `translate(${end.x - start.x}px,${end.y - start.y}px) rotate(${angle}rad)`,
        opacity: 1,
      },
    ],
    360,
  );
  arrow.remove();
}

async function perform() {
  if (!playable() || !pending) return;
  const action = pending;
  if (action.kind === 'move' && !canMove(action.zone)) return;
  if (action.kind === 'attack' && !canAttack()) return;
  if (action.kind === 'skill' && state.used.has(action.skill)) return;
  if (action.kind === 'interact' && (state.zone !== 2 || state.actions < 1 || state.explored))
    return;
  busy = true;
  pending = null;
  render();
  try {
    if (action.kind === 'move') {
      const from = place(state.zone),
        to = place(action.zone);
      if (state.travel > 0) state.travel--;
      else if (state.freeStep > 0) state.freeStep--;
      else {
        state.actions--;
        state.travel = 1;
      }
      camera.x = (from.x + to.x) / 2;
      camera.y = (from.y + to.y) / 2;
      updateCamera(true);
      tone('move');
      await moveActor(hero, from, to, true);
      state.zone = action.zone;
      say(`Aragorn raggiunge ${to.name.toLowerCase()}.`);
    } else if (action.kind === 'skill') {
      state.used.add(action.skill);
      if (action.skill === 0) state.freeStep++;
      if (action.skill === 1) state.precision = true;
      if (action.skill === 2) state.guard = true;
      tone('move');
      await floating(skills[action.skill]?.name ?? 'Abilità', place(state.zone));
      say(`${skills[action.skill]?.name ?? 'Abilità'} pronta: effetto dimostrativo preparato.`);
    } else if (action.kind === 'attack') {
      state.actions--;
      state.travel = 0;
      const hits = state.precision ? 3 : 2;
      state.precision = false;
      frame(heroSprite, 5, 2);
      tone('bow');
      await wait(250);
      await shoot(place(state.zone), enemyPosition());
      state.enemyHealth = Math.max(0, state.enemyHealth - hits);
      frame(enemySprite, 1, 1);
      tone('hit');
      await Promise.all([
        floating(`−${hits}`, enemyPosition(), true),
        animate(enemySprite, [{ filter: 'brightness(1.7)' }, { filter: 'brightness(1)' }], 380),
      ]);
      say(`L’arco colpisce: ${hits} colpi dimostrativi. Sentinella: ${state.enemyHealth} rimasti.`);
      if (state.enemyHealth === 0) {
        state.phase = 'victory';
        state.xp = 1;
        frame(enemySprite, 3, 1);
        frame(heroSprite, 7, 2);
        tone('win');
        say('Il guado è libero. Ottieni 1 esperienza di prova: visita l’accampamento.');
      }
    } else {
      state.actions--;
      state.travel = 0;
      state.explored = true;
      say('Tra le pietre del ponte trovi tracce dirette alle rovine.');
      element<HTMLDialogElement>('#story-dialog').showModal();
    }
  } finally {
    busy = false;
    render();
    if (state.phase !== 'victory') focusHero();
  }
}

async function endTurn() {
  if (!playable()) return;
  busy = true;
  pending = null;
  state.phase = 'shadow';
  state.travel = 0;
  render();
  const banner = element('#phase-banner');
  banner.textContent = 'La fase Ombra';
  banner.hidden = false;
  await wait(700);
  banner.hidden = true;
  const from = enemyPosition();
  const next =
    state.enemyZone > state.zone
      ? state.enemyZone - 1
      : state.enemyZone < state.zone
        ? state.enemyZone + 1
        : state.enemyZone;
  if (next !== state.enemyZone) {
    frame(enemySprite, 2, 1);
    await moveActor(enemy, from, enemyPosition(next), false);
    state.enemyZone = next;
    say('La sentinella avanza verso Aragorn.');
  }
  if (state.enemyZone === state.zone) {
    frame(enemySprite, 2, 1);
    await wait(260);
    frame(heroSprite, 6, 2);
    tone('hit');
    if (state.guard) {
      state.guard = false;
      await floating('Protetto', place(state.zone));
      say('Guardia assorbe il danno della sentinella.');
    } else {
      state.damage++;
      await floating('1 danno', place(state.zone), true);
      say('Aragorn subisce 1 danno dimostrativo.');
    }
  }
  state.phase = 'action';
  state.round++;
  state.actions = 2;
  state.freeStep = 0;
  state.guard = false;
  state.used.clear();
  busy = false;
  say(`Round ${state.round}: Aragorn può agire di nuovo.`);
  render();
  focusHero();
}

element<HTMLButtonElement>('#mode-move').addEventListener('click', () => {
  if (!playable()) return;
  mode = 'move';
  pending = null;
  render();
});
element<HTMLButtonElement>('#mode-attack').addEventListener('click', selectAttack);
element<HTMLButtonElement>('#mode-interact').addEventListener('click', () => {
  if (!playable()) return;
  mode = 'interact';
  pending = { kind: 'interact' };
  render();
});
enemy.addEventListener('click', selectAttack);
skillButtons().forEach((button, index) =>
  button.addEventListener('click', () => {
    if (!playable() || state.used.has(index)) return;
    pending = { kind: 'skill', skill: index };
    render();
  }),
);
confirm.addEventListener('click', () => void perform());
cancel.addEventListener('click', () => {
  pending = null;
  render();
});
element('#end-turn').addEventListener('click', () => void endTurn());
function openCharacter() {
  renderCharacter();
  characterDialog.showModal();
}
hero.addEventListener('click', openCharacter);
element('#character-open').addEventListener('click', openCharacter);
element('#camp-open').addEventListener('click', openCharacter);
element('#learn').addEventListener('click', () => {
  if (state.phase !== 'victory' || state.xp < 1 || state.learned || busy) return;
  state.xp--;
  state.learned = true;
  tone('win');
  say('Difesa salda entra nel repertorio dimostrativo di Aragorn.');
  render();
});
document
  .querySelectorAll<HTMLButtonElement>('[data-close]')
  .forEach((button) => button.addEventListener('click', () => button.closest('dialog')?.close()));
element('#history-open').addEventListener('click', () => {
  const list = element('#history-list');
  list.replaceChildren();
  for (const message of log) {
    const li = document.createElement('li');
    li.textContent = message;
    list.append(li);
  }
  element<HTMLDialogElement>('#history-dialog').showModal();
});
element('#help-open').addEventListener('click', () =>
  element<HTMLDialogElement>('#help-dialog').showModal(),
);
element('#sound').addEventListener('click', () => {
  sound = !sound;
  element('#sound').setAttribute('aria-pressed', String(sound));
  element('#sound span').textContent = sound ? 'Audio acceso' : 'Audio spento';
  tone('move');
});
motion.addEventListener('change', () => document.body.classList.toggle('reduced', reduced()));
element('#zoom-in').addEventListener('click', () => {
  camera.zoom = Math.min(1.75, camera.zoom + 0.15);
  updateCamera(true);
});
element('#zoom-out').addEventListener('click', () => {
  camera.zoom = Math.max(0.8, camera.zoom - 0.15);
  updateCamera(true);
});
element('#center').addEventListener('click', () => {
  camera.zoom = 1;
  focusHero();
});
element('#restart').addEventListener('click', () => {
  if (busy) return;
  document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach((dialog) => dialog.close());
  state = fresh();
  pending = null;
  mode = 'move';
  log.length = 0;
  camera.zoom = 1;
  say('Aragorn è pronto. Seleziona il sentiero per iniziare.');
  render();
  focusHero();
});

let drag: { x: number; y: number; cameraX: number; cameraY: number; scale: number } | null = null;
stage.addEventListener('pointerdown', (event) => {
  if ((event.target instanceof Element && event.target.closest('button')) || busy) return;
  const width = world.getBoundingClientRect().width;
  drag = {
    x: event.clientX,
    y: event.clientY,
    cameraX: camera.x,
    cameraY: camera.y,
    scale: width / 1600,
  };
  stage.setPointerCapture(event.pointerId);
  stage.classList.add('dragging');
});
stage.addEventListener('pointermove', (event) => {
  if (!drag) return;
  camera.x = drag.cameraX - (event.clientX - drag.x) / drag.scale;
  camera.y = drag.cameraY - (event.clientY - drag.y) / drag.scale;
  updateCamera();
});
function stopDrag() {
  drag = null;
  stage.classList.remove('dragging');
}
stage.addEventListener('pointerup', stopDrag);
stage.addEventListener('pointercancel', stopDrag);
new ResizeObserver(() => updateCamera()).observe(stage);
new ResizeObserver(() => updateCamera()).observe(element('.hud'));
document.body.classList.toggle('reduced', reduced());
render();
focusHero(false);
const images = ['terrain', 'ranger', 'sentinel', 'portrait', 'direction-comp'].map(async (name) => {
  const image = new Image();
  image.src = `/assets/${name}.png`;
  await image.decode();
});
void Promise.all([...images, document.fonts.ready])
  .then(() => {
    ready = true;
    element('#loading').hidden = true;
    say('Aragorn è pronto. Seleziona il sentiero per iniziare.');
    render();
    focusHero(false);
  })
  .catch(() => {
    element('#loading').textContent = 'Una risorsa non è caricata. Ricarica la pagina.';
  });
