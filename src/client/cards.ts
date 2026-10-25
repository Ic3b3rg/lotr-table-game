import type {
  Catalog,
  HeroDefinition,
  ItemDefinition,
  LocalizedText,
  SkillDefinition,
} from '../shared/catalog';
import { element, text } from './dom';

export function picture(name: string | undefined, label: string, className: string) {
  const frame = text('div', '', className);
  if (name) {
    const image = document.createElement('img');
    image.src = `/api/content/${encodeURIComponent(name)}`;
    image.alt = label;
    image.loading = 'lazy';
    image.addEventListener('error', () => {
      image.hidden = true;
      frame.classList.add('image-missing');
    });
    frame.append(image);
  } else frame.classList.add('image-missing');
  return frame;
}
export function sourceNotes(values: LocalizedText[], notes: string[] = []) {
  const details = document.createElement('details');
  details.className = 'card-provenance';
  details.append(text('summary', 'Testo e provenienza'));
  for (const value of values) {
    const label =
      value.kind === 'official-it'
        ? 'Italiano originale'
        : value.verified
          ? 'Traduzione verificata'
          : 'Traduzione da verificare';
    details.append(text('p', `${label} · ${value.source}`));
  }
  for (const note of notes) details.append(text('p', note));
  return details;
}
export function cardButton(
  card: SkillDefinition | ItemDefinition,
  open: (caller: HTMLButtonElement) => void,
) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'physical-card';
  const type =
    'rank' in card
      ? `Oggetto · rango ${['', 'I', 'II', 'III'][card.rank]}`
      : `Carta ${card.number} · ${card.kind === 'weakness' ? 'Debolezza' : card.kind === 'basic' ? 'Base' : card.kind === 'hero' ? 'Eroe' : 'Ruolo'}`;
  button.append(text('span', type, 'card-type'), text('strong', card.name.text, 'card-name'));
  if ('image' in card && card.image) button.append(picture(card.image, '', 'item-illustration'));
  button.append(text('span', card.text.text, 'card-excerpt'));
  button.append(text('span', 'Leggi la carta', 'card-read'));
  button.addEventListener('click', () => open(button));
  return button;
}
export function createCardReader() {
  const panel = element('#card-reader');
  const content = element('#card-reader-content');
  const close = element<HTMLButtonElement>('#close-card');
  let caller: HTMLElement | null = null;
  close.onclick = () => {
    panel.hidden = true;
    if (caller?.isConnected) caller.focus();
  };
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close.click();
  });
  function show(title: string, nodes: HTMLElement[], target: HTMLElement) {
    caller = target;
    const heading = text('h3', title);
    heading.id = 'reading-title';
    content.replaceChildren(heading, ...nodes);
    panel.hidden = false;
    panel.focus({ preventScroll: true });
    panel.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'nearest',
    });
  }
  return {
    hero(hero: HeroDefinition, catalog: Catalog, target: HTMLElement) {
      const stats = text('dl', '', 'hero-stats');
      const names = {
        might: 'Forza',
        wisdom: 'Saggezza',
        agility: 'Agilità',
        spirit: 'Spirito',
        wit: 'Ingegno',
        damage: 'Danni',
        fear: 'Paure',
        inspiration: 'Ispirazione',
      };
      for (const [key, label] of Object.entries(names)) {
        const row = document.createElement('div');
        row.append(
          text('dt', label),
          text('dd', String(hero.stats[key as keyof typeof hero.stats])),
        );
        stats.append(row);
      }
      const deck = text('div', '', 'card-grid');
      for (const id of hero.skills) {
        const card = catalog.skills.find((entry) => entry.id === id);
        if (card) deck.append(cardButton(card, (button) => this.card(card, button)));
      }
      show(
        hero.name.text,
        [
          text('p', hero.race.text, 'card-type'),
          stats,
          text('p', hero.ability.text, 'card-full-text'),
          sourceNotes([hero.name, hero.ability]),
          text('h4', 'Le cinque carte eroe'),
          deck,
        ],
        target,
      );
    },
    card(card: SkillDefinition | ItemDefinition, target: HTMLElement) {
      const summary =
        'rank' in card
          ? `Rango ${['', 'I', 'II', 'III'][card.rank]} · ${card.slot === 'armor' ? 'Armatura' : card.slot === 'trinket' ? 'Monile' : `${card.hands} ${card.hands === 1 ? 'mano' : 'mani'}`} · ${card.quantity} ${card.quantity === 1 ? 'copia' : 'copie'}`
          : `Numero ${card.number} · ${card.success} successi · ${card.fate} destino`;
      const nodes = [text('p', summary, 'card-type')];
      if ('image' in card && card.image) nodes.push(picture(card.image, '', 'item-illustration'));
      if (card.traits.length) nodes.push(text('p', card.traits.join(' · '), 'card-traits'));
      if (card.identityStatus === 'candidate')
        nodes.push(
          text('p', 'Associazione candidata · consulta la provenienza.', 'content-caution'),
        );
      nodes.push(
        text('p', card.text.text, 'card-full-text'),
        sourceNotes([card.name, card.text], card.notes),
      );
      show(card.name.text, nodes, target);
    },
  };
}
export type CardReader = ReturnType<typeof createCardReader>;
