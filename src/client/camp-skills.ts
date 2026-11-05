import type { Catalog } from '../shared/catalog';
import type { Session, Player } from '../shared/protocol';
import type { CampSkillInput } from '../shared/camp-skills';
import type { CardReader } from './cards';
import { cardButton } from './cards';
import { text } from './dom';

export function campSkillShop(
  session: Session,
  catalog: Catalog,
  heroId: string,
  player: Player | null,
  reader: CardReader,
  submit: (input: CampSkillInput) => unknown,
) {
  const root = document.createElement('section');
  root.className = 'camp-skills';
  root.dataset.campHero = heroId;
  const sc = session.scenario!,
    c = sc.conclusion!,
    cap = sc.pack.manifest.campSkills;
  if (!cap || !c.campaign?.training) {
    root.append(
      text(
        'p',
        'Gli acquisti di abilità richiedono carte verificate prima dell’avvio. Questo campo conserva i propri premi e confini.',
        'company-help',
      ),
    );
    return root;
  }
  const hero = c.campaign.heroes.find((h) => h.heroId === heroId)!,
    heroName = catalog.heroes.find((h) => h.id === heroId)!.name.text,
    ownerId = session.preparation!.heroes.find((h) => h.heroId === heroId)!.playerId,
    ownerName = session.players.find((p) => p.id === ownerId)!.name,
    mine = player?.id === ownerId,
    balances = c.campaign.training.balances.filter((b) => b.heroId === heroId);
  root.append(
    text('h5', `Abilità di ${heroName}`),
    text(
      'p',
      mine
        ? 'Leggi una carta, poi acquista o vendi. Il saldo cambia nel ruolo della carta; il premio storico rimane salvato.'
        : `${ownerName} gestisce questo eroe dal proprio dispositivo. Puoi leggere le carte e seguire le variazioni.`,
      'company-help',
    ),
  );
  for (const balance of balances) {
    const role = cap.roles.find((r) => r.id === balance.roleId)!,
      roleName = catalog.roles.find((r) => r.id === role.id)!.name.text,
      group = document.createElement('details');
    group.className = 'camp-role-skills';
    group.open = mine;
    group.dataset.campRole = role.id;
    group.append(text('summary', `${roleName} · ${balance.availableXP} XP disponibili`));
    const cards = document.createElement('div');
    cards.className = 'camp-offers';
    for (const offer of role.upgrades) {
      const row = document.createElement('article'),
        button = document.createElement('button'),
        holder = c.campaign.heroes.find((h) => h.skillCopies!.includes(offer.copy)),
        owned = holder === hero,
        operation = owned ? 'sell' : 'buy',
        holderName = holder ? catalog.heroes.find((h) => h.id === holder.heroId)!.name.text : null,
        reason = holderName
          ? `Posseduta da ${holderName}.`
          : balance.availableXP < offer.cost
            ? `Servono ${offer.cost} XP in ${roleName}; disponibili ${balance.availableXP}.`
            : `Disponibile · dopo l’acquisto: ${balance.availableXP - offer.cost} XP in ${roleName}.`;
      row.className = 'camp-offer';
      row.dataset.campCopy = offer.copy;
      row.append(
        cardButton(offer.card, (caller) =>
          reader.campSkill(
            offer,
            caller,
            heroName,
            roleName,
            `${reason} Saldo: ${balance.availableXP} XP.`,
          ),
        ),
        text('p', `${offer.cost} XP · ${roleName}`, 'camp-price'),
        text('p', reason, 'camp-availability'),
      );
      button.type = 'button';
      button.className = 'company-action';
      button.dataset.write = '';
      button.dataset.campOperation = operation;
      button.disabled =
        !mine || c.stage !== 'camp' || (!owned && (!!holder || balance.availableXP < offer.cost));
      button.dataset.blocked = String(button.disabled);
      button.textContent = owned ? `Vendi · +${offer.cost} XP` : `Acquista · −${offer.cost} XP`;
      button.setAttribute(
        'aria-label',
        `${owned ? 'Vendi' : 'Acquista'} ${offer.card.name.text} per ${heroName}, ${offer.cost} XP in ${roleName}`,
      );
      button.onclick = () =>
        submit({ kind: 'camp-skill', heroId, roleId: role.id, copy: offer.copy, operation });
      row.append(button);
      cards.append(row);
    }
    group.append(cards);
    root.append(group);
  }
  return root;
}
