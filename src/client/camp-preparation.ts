import type { Catalog } from '../shared/catalog';
import type { Session, Player } from '../shared/protocol';
import type { CampPreparationInput } from '../shared/camp-preparation';
import { definitionId } from '../shared/preparation';
import { cardButton, type CardReader } from './cards';
import { text } from './dom';

export function campPreparation(
  session: Session,
  catalog: Catalog,
  player: Player | null,
  reader: CardReader,
  submit: (input: CampPreparationInput) => unknown,
) {
  const root = document.createElement('section'),
    sc = session.scenario!,
    c = sc.conclusion!,
    campaign = c.campaign!,
    prep = campaign.preparation!;
  root.className = 'camp-preparation';
  root.append(
    text('h4', 'Scelte per la prossima avventura'),
    text(
      'p',
      'Ogni proprietario sceglie e conferma il proprio eroe. Potete tornare al campo: le scelte e le conferme ancora valide restano salvate.',
      'company-help',
    ),
    text(
      'p',
      `${prep.heroes.filter((h) => h.confirmedRevision !== null).length} di ${prep.heroes.length} eroi confermati. La partenza non è ancora disponibile.`,
      'test-status',
    ),
  );
  const button = (label: string, input: CampPreparationInput, blocked = false) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'company-action';
    b.textContent = label;
    b.dataset.write = '';
    b.disabled = blocked;
    b.dataset.blocked = String(blocked);
    b.onclick = () => submit(input);
    return b;
  };
  const owned = new Set(
      session.preparation!.heroes.filter((h) => h.playerId === player?.id).map((h) => h.heroId),
    ),
    ordered = [
      ...prep.heroes.filter((h) => owned.has(h.heroId)),
      ...prep.heroes.filter((h) => !owned.has(h.heroId)),
    ];
  for (const selection of ordered) {
    const hero = campaign.heroes.find((h) => h.heroId === selection.heroId)!,
      name = catalog.heroes.find((h) => h.id === hero.heroId)!.name.text,
      ownerId = session.preparation!.heroes.find((h) => h.heroId === hero.heroId)!.playerId,
      owner = session.players.find((p) => p.id === ownerId)!.name,
      mine = player?.id === ownerId,
      recipe = selection.recipe,
      entry = document.createElement('article');
    entry.className = 'campaign-hero';
    entry.dataset.preparationHero = hero.heroId;
    entry.append(
      text('h5', `${name} · ${owner}`),
      text(
        'p',
        selection.confirmedRevision !== null
          ? 'Scelte confermate e salvate.'
          : (recipe.gate ?? `${owner} deve controllare il riepilogo e confermare.`),
        'test-status',
      ),
      text(
        'p',
        `Ruolo: ${catalog.roles.find((r) => r.id === hero.roleId)?.name.text ?? 'da scegliere'}.`,
        'company-help',
      ),
    );
    if (mine) {
      const form = document.createElement('form'),
        label = text('label', `Ruolo per ${name}`),
        select = document.createElement('select'),
        warning = text('p', '', 'company-help'),
        apply = document.createElement('button');
      select.id = `next-role-${hero.heroId}`;
      label.setAttribute('for', select.id);
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = 'Scegli un ruolo';
      empty.disabled = true;
      empty.selected = hero.roleId === null;
      select.append(empty);
      for (const role of catalog.roles) {
        const occupied = campaign.heroes.find(
            (h) => h.heroId !== hero.heroId && h.roleId === role.id,
          ),
          cards = sc.pack.manifest.campPreparation!.cards.filter(
            (c) => c.kind === 'role' && c.ownerId === role.id,
          ),
          unavailable = cards.length !== 3 || cards.some((c) => c.identity !== 'bound'),
          option = document.createElement('option');
        option.value = role.id;
        option.selected = role.id === hero.roleId;
        option.disabled = unavailable;
        option.textContent = `${role.name.text}${unavailable ? ' · identità carte da verificare' : occupied ? ` · libera ${catalog.heroes.find((h) => h.id === occupied.heroId)!.name.text}` : ''}`;
        select.append(option);
      }
      warning.textContent =
        'Scegliendo un ruolo occupato, l’altro eroe resta senza ruolo e deve sceglierne uno. La sua conferma viene annullata; non avviene uno scambio.';
      apply.type = 'submit';
      apply.className = 'company-action';
      apply.dataset.write = '';
      apply.textContent = 'Salva il ruolo';
      form.onsubmit = (e) => {
        e.preventDefault();
        if (select.value)
          submit({ kind: 'camp-select-role', heroId: hero.heroId, roleId: select.value });
      };
      form.append(label, select, warning, apply);
      entry.append(form);
    }
    const accessory = selection.accessory
      ? catalog.items.find((i) => i.id === definitionId(selection.accessory!))
      : null;
    entry.append(
      text(
        'p',
        `Accessorio facoltativo: ${accessory?.name.text ?? 'nessuno'}. La proprietà resta comune; questa è una scelta per il prossimo allestimento.`,
      ),
    );
    if (mine) {
      if (selection.accessory)
        entry.append(
          button('Scegli nessun accessorio · libera la copia', {
            kind: 'camp-accessory',
            heroId: hero.heroId,
            copy: null,
          }),
        );
      for (const item of campaign.inventory ?? []) {
        const holder = prep.heroes.find((h) => h.accessory === item.copy),
          heldName = holder ? catalog.heroes.find((h) => h.id === holder.heroId)!.name.text : null,
          card = catalog.items.find((i) => i.id === item.cardId)!;
        entry.append(
          button(
            `${card.name.text} · ${heldName ? `scelto da ${heldName}` : 'copia disponibile'}`,
            { kind: 'camp-accessory', heroId: hero.heroId, copy: item.copy },
            !!holder,
          ),
        );
      }
      if (!campaign.inventory?.length)
        entry.append(
          text(
            'p',
            'Nessuna copia nell’inventario comune. Puoi confermare senza accessorio.',
            'company-help',
          ),
        );
    }
    const inventory = document.createElement('div');
    inventory.className = 'camp-offers';
    for (const copy of [
      ...recipe.itemCopies,
      ...(selection.accessory ? [selection.accessory] : []),
    ]) {
      const card = catalog.items.find((i) => i.id === definitionId(copy))!;
      inventory.append(cardButton(card, (caller) => reader.card(card, caller)));
    }
    entry.append(
      text('h6', 'Equipaggiamento corrente'),
      inventory,
      text(
        'p',
        `XP disponibili: ${recipe.balances.map((b) => `${catalog.roles.find((r) => r.id === b.roleId)!.name.text} ${b.availableXP}`).join(' · ') || 'nessun saldo in questo ruolo'}. Cambiare ruolo non trasferisce XP.`,
      ),
    );
    const details = document.createElement('details'),
      cards = document.createElement('div');
    cards.className = 'camp-offers';
    details.append(
      text('summary', `Carte previste · ${recipe.cards.length} identità e 1 debolezza futura`),
      text(
        'p',
        'La debolezza sarà una futura pesca comune: nessuna copia o ordine è scelto ora. Le carte non sono ancora mescolate o preparate.',
        'company-help',
      ),
    );
    for (const planned of recipe.cards) {
      const offer = sc.pack.manifest
          .campSkills!.roles.flatMap((r) => r.upgrades)
          .find((o) => o.card.id === planned.cardId),
        card =
          catalog.skills.find((c) => c.id === planned.cardId) ??
          offer?.card ??
          session.physical?.lastStand?.titles.find((t) => t.cardId === planned.cardId)?.skill;
      if (!card) continue;
      const row = document.createElement('div');
      row.append(cardButton(card, (caller) => reader.card(card, caller)));
      if (planned.cardId === recipe.futurePrepared)
        row.append(text('p', 'Ruolo 1 · futura carta preparata.', 'company-help'));
      cards.append(row);
    }
    details.append(cards);
    entry.append(details);
    if (mine) {
      const confirm = button(
        'Conferma le mie scelte',
        { kind: 'camp-confirm', heroId: hero.heroId, summaryHash: selection.summaryHash },
        !!recipe.gate || selection.confirmedRevision !== null,
      );
      confirm.dataset.campConfirm = hero.heroId;
      entry.append(confirm);
    }
    root.append(entry);
  }
  if (player) root.append(button('Torna al campo', { kind: 'camp-return' }));
  const depart = document.createElement('button');
  depart.type = 'button';
  depart.disabled = true;
  depart.className = 'company-action';
  depart.textContent = 'Partenza non ancora disponibile';
  root.append(
    depart,
    text(
      'p',
      'Le scelte possono essere confermate. La prossima avventura attende la propria mappa e le proprie istruzioni prima della partenza.',
      'company-help',
    ),
  );
  return root;
}
