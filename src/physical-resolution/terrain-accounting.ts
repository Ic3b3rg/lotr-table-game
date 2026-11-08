import type { BattleTestTerrainContext, TerrainTestView } from '../shared/battle-test-terrain';
import { invariant } from '../map-freeze/validate';

export type FateIcon = { id: string; copy: string; state: 'free' | 'converted' | 'spent' };
type Symbols = { success: number; fate: number };
export class TerrainAccounting {
  private readonly used = new Set<string>();
  private payment: TerrainTestView['fire'] = null;
  private readonly tokens;
  constructor(
    context: BattleTestTerrainContext,
    spaceId: string,
    private readonly kind: 'attack' | 'negate',
    private readonly symbols: (copy: string) => Symbols,
    private readonly name: (copy: string) => string,
    readonly token: (copy: string) => string,
  ) {
    invariant(
      new Set(context.tokens.map((t) => t.anchor)).size === context.tokens.length,
      'Terreno duplicato.',
    );
    this.tokens = context.tokens.filter((t) => t.spaceId === spaceId);
  }
  boulders(fate: number) {
    return this.kind === 'negate' && fate > 0
      ? this.tokens
          .filter((t) => t.kind === 'rock' && !this.used.has(t.anchor))
          .map((t) => ({
            id: `terrain:boulder:${t.anchor}`,
            label: `Masso ${t.anchor} nella tua casella: converti 1 fato gratis · 0 ispirazione · una volta per questa prova`,
          }))
      : [];
  }
  useBoulder(id: string, fate: number) {
    invariant(
      this.boulders(fate).some((o) => o.id === id),
      'Masso già usato o senza fato disponibile.',
    );
    this.used.add(id.slice('terrain:boulder:'.length));
  }
  fire(cards: string[], icons: FateIcon[], successes: number, spent = 0) {
    if (this.kind !== 'attack' || this.payment || !this.tokens.some((t) => t.kind === 'fire'))
      return [];
    return cards.flatMap((copy) => {
      const printed = this.symbols(copy),
        converted = icons.filter((i) => i.copy === copy && i.state === 'converted').length;
      // A spent fate cannot pay a second effect. Already-paid item costs must be
      // backed wholly by surviving successes; pooled success allocations can rebind.
      if (
        !printed.fate ||
        icons.some((i) => i.copy === copy && i.state === 'spent') ||
        successes - printed.success - converted < spent
      )
        return [];
      return (['pierce', 'smite'] as const).map((modifier) => ({
        id: `terrain:fire:${this.token(copy)}:${modifier}`,
        label: `Falò nella tua casella: scarta ${this.name(copy)} · copia ${this.token(copy).slice(0, 8)} per ${modifier === 'pierce' ? 'Perforante' : 'Punizione'} · escludi tutti i suoi ${printed.success} successi e ${printed.fate} fati`,
        copy,
        modifier,
      }));
    });
  }
  pay(id: string, cards: string[], icons: FateIcon[], successes: number, spent = 0) {
    const choice = this.fire(cards, icons, successes, spent).find((o) => o.id === id);
    invariant(choice, 'Copia falò estranea, già pagata o con icone già spese.');
    const printed = this.symbols(choice.copy);
    this.payment = {
      copy: this.token(choice.copy),
      name: this.name(choice.copy),
      modifier: choice.modifier,
      excludedSuccess: printed.success,
      excludedFate: printed.fate,
    };
    return choice.copy;
  }
  modifiers() {
    return this.payment ? [this.payment.modifier] : [];
  }
  excludes(copy: string) {
    return this.payment?.copy === this.token(copy);
  }
  view(fate: number): TerrainTestView {
    return {
      kind: this.kind,
      tokens: this.tokens.map(({ anchor, kind }) => ({ anchor, kind })),
      bouldersUsed: [...this.used],
      freeRemaining: Math.min(fate, this.boulders(fate).length),
      fire: this.payment,
    };
  }
}
