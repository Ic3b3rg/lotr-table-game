import type { PreparedHero } from '../shared/preparation';
import { shuffled } from './shuffle';

export function refillEmptyDeck(hero: PreparedHero) {
  if (hero.deck.length === 0 && hero.discard.length > 0) {
    hero.deck = shuffled(hero.discard);
    hero.discard = [];
  }
}

export function revealCards(hero: PreparedHero, count: number) {
  const revealed: string[] = [];
  for (let i = 0; i < count; i++) {
    refillEmptyDeck(hero);
    const copy = hero.deck.shift();
    if (!copy) break;
    revealed.push(copy);
    refillEmptyDeck(hero);
  }
  return revealed;
}
