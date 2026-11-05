import type { Catalog } from '../shared/catalog';
import type { Session } from '../shared/protocol';
import type { CardReader } from './cards';
import { element, text } from './dom';

export function createInventory(reader: CardReader) {
  const root = element('#company-inventory');
  let rendered = '';
  return {
    update(session: Session, catalog: Catalog | null) {
      root.hidden = !session.scenario?.pack.manifest.items || !catalog;
      if (root.hidden || !catalog) return;
      const inventory = session.physical?.inventory ?? [];
      const signature = JSON.stringify({
        inventory,
        players: session.players,
        heroes: session.preparation?.heroes,
        catalog: catalog.id,
      });
      if (signature === rendered) return;
      rendered = signature;
      root.replaceChildren(text('h3', 'Inventario della Compagnia'));
      root.append(
        text(
          'p',
          'Gli accessori appartengono alla Compagnia. Durante l’avventura li usa soltanto l’eroe che li ha ottenuti; tornano nell’inventario comune al termine.',
          'company-help',
        ),
      );
      if (!inventory.length) {
        root.append(text('p', 'Non avete ancora ottenuto accessori.', 'company-help'));
        return;
      }
      for (const item of inventory) {
        const card = catalog.items.find((c) => c.id === item.cardId)!;
        const hero = catalog.heroes.find((h) => h.id === item.heroId);
        const player = session.players.find(
          (p) =>
            session.preparation?.heroes.find((h) => h.heroId === item.heroId)?.playerId === p.id,
        );
        const owner = hero
          ? `${hero.name.text} · ${player?.name ?? ''}`
          : 'Inventario comune · da equipaggiare nel prossimo avvio';
        const consumption =
          item.remaining === null
            ? 'Segnalini consumo rimossi al termine dell’avventura.'
            : `${item.remaining} / ${item.capacity} segnalini consumo disponibili`;
        const article = text('article', '', 'company-hero');
        article.dataset.itemCopy = item.copy;
        article.append(
          text('h4', card.name.text),
          text('p', owner, 'company-hero-owner'),
          text('p', consumption, 'company-help'),
        );
        const read = document.createElement('button');
        read.type = 'button';
        read.className = 'company-link';
        read.textContent = `Leggi ${card.name.text}`;
        read.onclick = () => reader.inventoryItem(card, read, owner, consumption);
        article.append(read);
        root.append(article);
      }
    },
  };
}
