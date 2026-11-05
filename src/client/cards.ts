import type { CampItemCard } from '../shared/camp-items';
import type {
  Catalog,
  HeroDefinition,
  ItemDefinition,
  LocalizedText,
  SkillDefinition,
} from '../shared/catalog';
import { element, text } from './dom';
import type { TitleSkillDefinition } from '../shared/skill-cards';
import type { CampSkillOffer } from '../shared/camp-skills';
type Card = SkillDefinition | TitleSkillDefinition | ItemDefinition;

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
export function cardButton(card: Card, open: (caller: HTMLButtonElement) => void) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'physical-card';
  const type =
    'rank' in card
      ? `Oggetto · rango ${['', 'I', 'II', 'III'][card.rank]}`
      : `${card.number === null ? '' : `Carta ${card.number} · `}${card.kind === 'title' ? 'Titolo' : card.kind === 'weakness' ? 'Debolezza' : card.kind === 'basic' ? 'Base' : card.kind === 'hero' ? 'Eroe' : 'Ruolo'}`;
  button.append(text('span', type, 'card-type'), text('strong', card.name.text, 'card-name'));
  if ('image' in card && card.image) button.append(picture(card.image, '', 'item-illustration'));
  if (card.identityStatus === 'candidate')
    button.append(text('span', 'Associazione candidata', 'card-verification'));
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
    const target = caller?.isConnected ? caller : element('#journey-title');
    if (target === element('#journey-title')) target.tabIndex = -1;
    target.focus();
  };
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close.click();
  });
  function show(title: string, nodes: HTMLElement[], target: HTMLElement) {
    if (!panel.contains(target)) caller = target;
    const heading = text('h3', title);
    heading.id = 'reading-title';
    content.replaceChildren(heading, ...nodes);
    panel.hidden = false;
    panel.scrollTop = 0;
    panel.focus({ preventScroll: true });
    requestAnimationFrame(() => {
      if (!panel.hidden) panel.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
  }
  return {
    campItem(
      entry: CampItemCard,
      card: ItemDefinition,
      target: HTMLElement,
      holder: string,
      lore: number,
    ) {
      show(
        card.name.text,
        [
          text(
            'p',
            `${holder} · rango ${['', 'I', 'II', 'III'][card.rank]} · ${card.quantity} ${card.quantity === 1 ? 'copia' : 'copie'}`,
            'card-type',
          ),
          text(
            'p',
            card.slot === 'trinket'
              ? 'Accessorio della Compagnia'
              : card.slot === 'armor'
                ? 'Armatura personale'
                : `Equipaggiamento personale · ${card.hands} ${card.hands === 1 ? 'mano' : 'mani'}`,
            'card-type',
          ),
          text(
            'p',
            `Requisito per migliorare questa carta: ${entry.model.upgradeCost} Sapienza. Valore condiviso corrente: ${lore}. La Sapienza non si spende.`,
            'company-help',
          ),
          text('p', card.traits.join(' · '), 'card-traits'),
          text('p', card.text.text, 'card-full-text'),
          text(
            'p',
            'Leggere è gratuito. Scegli l’alternativa e conferma dal campo. Le capacità delle carte migliorate attendono le rispettive finestre del seguito.',
            'company-help',
          ),
          sourceNotes([card.name, card.text], card.notes),
        ],
        target,
      );
    },
    campSkill(
      offer: CampSkillOffer,
      target: HTMLElement,
      hero: string,
      role: string,
      availability: string,
    ) {
      const card = offer.card;
      show(
        card.name.text,
        [
          text('p', `${hero} · ${role} · ${offer.cost} XP`, 'card-type'),
          text(
            'p',
            `Numero ${card.number} · ${card.success} successi · ${card.fate} destino · una copia`,
            'card-type',
          ),
          text('p', card.traits.join(' · '), 'card-traits'),
          text('p', availability, 'company-hero-owner'),
          text('p', card.text.text, 'card-full-text'),
          text(
            'p',
            'Lettura gratuita. Acquista o vendi dal campo. Le capacità si usano soltanto nelle rispettive finestre di avventura, quando disponibili.',
            'company-help',
          ),
          sourceNotes([card.name, card.text], card.notes),
        ],
        target,
      );
    },
    boon(card: { name: string; text: string }, target: HTMLElement) {
      show(
        card.name,
        [
          text('p', 'Beneficio · carta scoperta, separata dalle abilità preparate', 'card-type'),
          text('p', card.text, 'card-full-text'),
          text(
            'p',
            'Quando viene scartato, il beneficio torna alla propria riserva.',
            'company-help',
          ),
        ],
        target,
      );
    },
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
    inventoryItem(card: ItemDefinition, target: HTMLElement, owner: string, consumption: string) {
      show(
        card.name.text,
        [
          text(
            'p',
            `Accessorio · rango ${['', 'I', 'II', 'III'][card.rank]} · proprietà della Compagnia`,
            'card-type',
          ),
          text('p', owner, 'company-hero-owner'),
          text('p', consumption, 'company-help'),
          text('p', card.text.text, 'card-full-text'),
          text(
            'p',
            'Consumare rimuove un segnalino disponibile. La capacità si usa nella finestra indicata sulla carta; non richiede un’azione salvo istruzione esplicita. Durante questa avventura l’accessorio resta all’eroe che lo ha ottenuto.',
            'company-help',
          ),
          sourceNotes([card.name, card.text], card.notes),
        ],
        target,
      );
    },
    card(card: Card, target: HTMLElement) {
      const summary =
        'rank' in card
          ? `Rango ${['', 'I', 'II', 'III'][card.rank]} · ${card.slot === 'armor' ? 'Armatura' : card.slot === 'trinket' ? 'Monile' : `${card.hands} ${card.hands === 1 ? 'mano' : 'mani'}`} · ${card.quantity} ${card.quantity === 1 ? 'copia' : 'copie'}`
          : `${card.number === null ? '' : `Numero ${card.number} · `}${card.success} successi · ${card.fate} destino`;
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
