import type { Catalog } from '../shared/catalog';
import type { Session, Player } from '../shared/protocol';
import type { CampItemInput } from '../shared/camp-items';
import { definitionId } from '../shared/preparation';
import { cardButton, type CardReader } from './cards';
import { text } from './dom';

export function campItemInventory(
  session: Session,
  catalog: Catalog,
  heroId: string | null,
  player: Player | null,
  reader: CardReader,
  submit: (input: CampItemInput) => Promise<boolean | undefined>,
) {
  const root = document.createElement('section');
  root.className = 'camp-items';
  root.dataset.campInventory = heroId ?? 'group';
  const sc = session.scenario!,
    c = sc.conclusion!,
    cap = sc.pack.manifest.campItems,
    campaign = c.campaign!,
    hero = campaign.heroes.find((h) => h.heroId === heroId),
    owner = session.preparation!.heroes.find((h) => h.heroId === heroId)?.playerId,
    ownerName = session.players.find((p) => p.id === owner)?.name,
    holder =
      heroId === null
        ? 'Compagnia'
        : `${catalog.heroes.find((h) => h.id === heroId)!.name.text} · ${ownerName}`,
    mine = heroId === null ? player !== null : player?.id === owner,
    copies = heroId === null ? (campaign.inventory ?? []).map((i) => i.copy) : hero!.itemCopies,
    all = [
      ...campaign.heroes.flatMap((h) => h.itemCopies),
      ...(campaign.inventory ?? []).map((i) => i.copy),
    ];
  root.append(
    text(
      heroId === null ? 'h4' : 'h5',
      heroId === null ? 'Accessori della Compagnia' : 'Equipaggiamento personale',
    ),
    text(
      'p',
      `${holder} · Sapienza condivisa: ${sc.play!.lore}. Migliorare non spende Sapienza o XP.`,
      'company-help',
    ),
  );
  if (!copies.length)
    root.append(text('p', 'Nessun accessorio nell’inventario comune.', 'company-help'));
  if (!cap)
    root.append(
      text(
        'p',
        'I miglioramenti richiedono oggetti verificati prima dell’avvio. Puoi leggere le carte di questo campo.',
        'company-help',
      ),
    );
  for (const copy of copies) {
    const card = catalog.items.find((i) => i.id === definitionId(copy))!,
      entry = cap?.cards.find((i) => i.cardId === card.id),
      successors = entry
        ? cap!.cards.filter((i) => entry.model.upgrades.includes(i.model.source))
        : [],
      row = document.createElement('article');
    row.className = 'camp-item';
    row.dataset.campItem = copy;
    row.append(
      cardButton(card, (caller) =>
        entry
          ? reader.campItem(entry, card, caller, holder, sc.play!.lore)
          : reader.card(card, caller),
      ),
    );
    if (!entry) {
      root.append(row);
      continue;
    }
    const sufficient = sc.play!.lore >= entry.model.upgradeCost,
      reason = !successors.length
        ? 'Rango massimo per i prodotti base: nessun miglioramento successivo disponibile.'
        : !sufficient
          ? `Servono ${entry.model.upgradeCost} Sapienza; la Compagnia ne ha ${sc.play!.lore}.`
          : `Requisito raggiunto: ${entry.model.upgradeCost} Sapienza, disponibili ${sc.play!.lore}.`;
    row.append(
      text('p', reason, 'camp-availability'),
      text(
        'p',
        mine
          ? heroId === null
            ? 'Concordate l’alternativa per la Compagnia, poi una persona conferma.'
            : 'Scegli un’alternativa, poi conferma la sostituzione.'
          : heroId === null
            ? 'Un partecipante conferma dal proprio telefono; questa vista osserva.'
            : `${ownerName} conferma dal proprio dispositivo. Puoi leggere le alternative.`,
        'company-help',
      ),
    );
    if (entry.model.upgrades.some((source) => !cap!.cards.some((i) => i.model.source === source)))
      row.append(
        text(
          'p',
          'Gli avanzamenti di altri prodotti attendono il proprio materiale.',
          'company-help',
        ),
      );
    const confirmation = document.createElement('div'),
      summary = text('p', '', 'camp-replacement'),
      waiting = text('p', '', 'camp-waiting'),
      confirm = document.createElement('button'),
      cancel = document.createElement('button');
    confirmation.className = 'camp-item-confirmation';
    confirmation.hidden = true;
    waiting.setAttribute('role', 'status');
    confirm.type = cancel.type = 'button';
    confirm.textContent = 'Conferma la sostituzione';
    cancel.textContent = 'Annulla';
    confirm.className = cancel.className = 'company-action';
    confirm.dataset.write = '';
    confirm.dataset.campConfirm = copy;
    cancel.dataset.campCancel = copy;
    confirm.disabled = true;
    confirm.dataset.blocked = 'true';
    let selected: { copy: string; caller: HTMLButtonElement } | null = null;
    cancel.onclick = () => {
      confirmation.hidden = true;
      confirm.disabled = true;
      confirm.dataset.blocked = 'true';
      selected?.caller.focus();
      selected = null;
    };
    confirm.onclick = async () => {
      if (!selected) return;
      waiting.textContent =
        'Attendo il salvataggio sul PC. La sostituzione sarà confermata una sola volta.';
      const completed = await submit({ kind: 'camp-item', heroId, copy, upgrade: selected.copy });
      if (!completed)
        waiting.textContent =
          'Controlla lo stato aggiornato e scegli nuovamente l’alternativa disponibile.';
    };
    const alternatives = document.createElement('details');
    alternatives.className = 'camp-item-alternatives';
    alternatives.append(text('summary', `Alternative del rango successivo · ${successors.length}`));
    for (const next of successors) {
      const upgraded = catalog.items.find((i) => i.id === next.cardId)!,
        offer = document.createElement('article');
      offer.className = 'camp-offer';
      offer.append(
        cardButton(upgraded, (caller) =>
          reader.campItem(next, upgraded, caller, holder, sc.play!.lore),
        ),
      );
      for (let n = 1; n <= next.quantity; n++) {
        const upgradedCopy = `${next.cardId}:${n}`,
          choice = document.createElement('button'),
          held = all.includes(upgradedCopy);
        choice.type = 'button';
        choice.className = 'company-action';
        choice.textContent = held
          ? `Copia ${n} già posseduta`
          : `Scegli questa alternativa · copia ${n}`;
        choice.dataset.campUpgrade = upgradedCopy;
        choice.disabled = !mine || !sufficient || held || c.stage !== 'camp';
        choice.dataset.blocked = String(choice.disabled);
        // Local selection is free, but cannot become writable after a connection refresh.
        choice.dataset.write = '';
        choice.onclick = () => {
          selected = { copy: upgradedCopy, caller: choice };
          summary.textContent = `${holder}: ${card.name.text} (rango ${card.rank}) → ${upgraded.name.text} (rango ${upgraded.rank}). Requisito: ${entry.model.upgradeCost} Sapienza, valore corrente ${sc.play!.lore}. La copia precedente torna alla riserva. Sapienza e XP restano invariati.`;
          waiting.textContent = 'Leggi e conferma, oppure annulla senza modificare l’inventario.';
          confirmation.hidden = false;
          confirm.disabled = false;
          confirm.dataset.blocked = 'false';
          confirm.focus();
        };
        offer.append(choice);
      }
      alternatives.append(offer);
    }
    confirmation.append(summary, waiting, confirm, cancel);
    row.append(alternatives, confirmation);
    root.append(row);
  }
  root.append(
    text(
      'p',
      'Le carte migliorate sono conservate per il seguito. Le loro capacità si usano soltanto nelle rispettive finestre delle prossime avventure, quando disponibili.',
      'company-help',
    ),
  );
  return root;
}
