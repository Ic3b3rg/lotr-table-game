import { createCombat } from './combat';
import { createScenario } from './scenario';
import { createConclusion } from './conclusion';
import type { ScenarioOfferSchema } from '../shared/scenario';
import type { z } from 'zod';
import { CatalogSchema, type Catalog } from '../shared/catalog';
import type { Player, Session } from '../shared/protocol';
import { request } from './api';
import { element, text } from './dom';
import { cardButton, createCardReader, picture } from './cards';
import { createPreparation } from './preparation';
import { createSkillTests } from './skill-tests';
import { createScouting } from './scouting';
import { createRounds } from './rounds';
import { createJourneyMap } from './journey-map';
import { createMapGeneration } from './map-generation';
import type { GenerationOffer } from '../shared/generated-map';

export function createCompany(sync: () => Promise<void>) {
  const reader = createCardReader();
  const scenario = createScenario(sync, reader);
  const conclusion = createConclusion(sync, reader);
  const combat = createCombat(sync, reader);
  const preparation = createPreparation(sync, reader);
  const skillTests = createSkillTests(sync, reader);
  const scouting = createScouting(sync, reader);
  const rounds = createRounds(sync);
  const journeyMap = createJourneyMap(sync);
  const mapGeneration = createMapGeneration(sync);
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
    update(
      session: Session,
      player: Player | null,
      generationOffer: GenerationOffer,
      scenarioOffer: z.infer<typeof ScenarioOfferSchema>,
    ) {
      const nextKey = `${session.generation}:${session.catalog?.id ?? ''}`;
      if (key !== nextKey && !loading) void load(session);
      preparation.update(session, location.pathname === '/join' ? player : null, catalog);
      combat.update(session, location.pathname === '/join' ? player : null, catalog);
      rounds.update(session, location.pathname === '/join' ? player : null, catalog);
      journeyMap.update(session, location.pathname === '/join' ? player : null, catalog);
      skillTests.update(session, location.pathname === '/join' ? player : null, catalog);
      scouting.update(session, location.pathname === '/join' ? player : null, catalog);
      mapGeneration.update(session, location.pathname === '/join' ? player : null, generationOffer);
      scenario.update(
        session,
        location.pathname === '/join' ? player : null,
        catalog,
        scenarioOffer,
      );
      conclusion.update(session, location.pathname === '/join' ? player : null, catalog);
      if (session.scenario) {
        element('#rounds').hidden = session.scenario.phase !== 'action';
        element('#journey-map').hidden = !session.journey;
        element('#scouting').hidden =
          !session.scout && !(session.physical?.cycle && session.round?.phase === 'rally');
        element('#skill-tests').hidden =
          session.scenario.pending?.kind !== 'test' ||
          session.scenario.pending.stage !== 'revealed';
      } else if (session.mapGeneration || generationOffer.kind !== 'legacy')
        for (const id of ['#journey-map', '#rounds', '#skill-tests', '#scouting'])
          element(id).hidden = true;
      if (session.scenario?.conclusion)
        for (const id of [
          '#scenario',
          '#rounds',
          '#journey-map',
          '#scouting',
          '#skill-tests',
          '#combat',
          '#company-preparation',
        ])
          element(id).hidden = true;
    },
  };
}
