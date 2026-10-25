import { CatalogSchema, type Catalog } from '../shared/catalog';
import type { Player, Session } from '../shared/protocol';
import { request } from './api';
import { element, text } from './dom';
import { cardButton, createCardReader, picture } from './cards';

export function createCompany() {
  const reader = createCardReader();
  const status = element('#content-status');
  const heroes = element('#hero-catalog');
  const cards = element('#catalog-cards');
  const filter = element<HTMLSelectElement>('#card-category');
  const search = element<HTMLInputElement>('#card-search');
  let catalog: Catalog | null = null;
  let key = '';
  let loading = false;
  function renderCards() {
    if (!catalog) return;
    const needle = search.value.toLocaleLowerCase('it');
    const list =
      filter.value === 'items'
        ? catalog.items
        : catalog.skills.filter((card) => filter.value === 'all' || card.kind === filter.value);
    const matching = list.filter((card) =>
      `${card.name.text} ${card.text.text}`.toLocaleLowerCase('it').includes(needle),
    );
    cards.replaceChildren(
      ...matching.map((card) => cardButton(card, (button) => reader.card(card, button))),
    );
    element('#catalog-count').textContent = `${matching.length} carte`;
    element('#catalog-empty').hidden = matching.length > 0;
  }
  filter.onchange = renderCards;
  search.oninput = renderCards;
  async function load(session: Session) {
    loading = true;
    const nextKey = `${session.generation}:${session.catalog?.id ?? ''}`;
    try {
      catalog = CatalogSchema.nullable().parse(await request('/api/catalog'));
      if (!catalog) {
        status.textContent = 'Le carte non sono ancora caricate su questo PC.';
        element('#catalog-browser').hidden = true;
        heroes.replaceChildren();
      } else {
        status.textContent = `${catalog.label} · salvato con il tavolo`;
        element('#catalog-browser').hidden = false;
        heroes.replaceChildren(
          ...catalog.heroes.map((hero) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'hero-portrait';
            button.append(
              picture(hero.portrait, '', 'hero-illustration'),
              text('strong', hero.name.text),
              text('span', hero.race.text),
            );
            button.onclick = () => {
              if (catalog) reader.hero(hero, catalog, button);
            };
            return button;
          }),
        );
        renderCards();
      }
      key = nextKey;
    } catch {
      status.textContent =
        'Non riesco a caricare le carte dal PC. Riprovo al prossimo collegamento.';
    } finally {
      loading = false;
    }
  }
  return {
    update(session: Session, _player: Player | null) {
      const nextKey = `${session.generation}:${session.catalog?.id ?? ''}`;
      if (key !== nextKey && !loading) void load(session);
    },
  };
}
