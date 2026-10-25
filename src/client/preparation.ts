import type { Catalog } from '../shared/catalog';
import type { Player, Session } from '../shared/protocol';
import { definitionId } from '../shared/preparation';
import { action } from './actions';
import { randomIntent, request, RequestError } from './api';
import { cardButton, picture, type CardReader } from './cards';
import { element, text } from './dom';

export function createPreparation(sync: () => Promise<void>, reader: CardReader) {
  const root = element('#company-preparation');
  const error = text('p', '', 'company-error');
  error.setAttribute('role', 'alert');
  error.hidden = true;
  let current: Session | null = null;
  let player: Player | null = null;
  let catalog: Catalog | null = null;
  let rendered = '';
  let dirty = false;
  let forceRender = false;
  let pending: { signature: string; body: object } | null = null;
  async function submit(intent: { type: string; [key: string]: unknown }) {
    if (!current) return;
    await action(async () => {
      error.hidden = true;
      const signature = JSON.stringify({ ...intent, generation: current!.generation });
      if (pending?.signature !== signature)
        pending = {
          signature,
          body: {
            ...intent,
            requestId: randomIntent(),
            generation: current!.generation,
            expectedRevision: current!.revision,
          },
        };
      try {
        await request('/api/commands', pending.body);
        pending = null;
        dirty = false;
        forceRender = true;
        rendered = '';
        await sync();
      } catch (cause) {
        error.textContent =
          cause instanceof RequestError
            ? cause.message
            : 'Il PC non ha risposto. Riprova: la stessa richiesta non verrà applicata due volte.';
        error.hidden = false;
        if (cause instanceof RequestError) {
          pending = null;
          await sync();
        }
      }
    });
  }
  function configuration(hero: NonNullable<Session['preparation']>['heroes'][number]) {
    const content = catalog!;
    const definition = content.heroes.find((entry) => entry.id === hero.heroId)!;
    const section = document.createElement('article');
    section.className = 'company-hero';
    const intro = text('div', '', 'company-hero-intro');
    intro.append(picture(definition.portrait, '', 'company-miniature'));
    const title = document.createElement('div');
    title.append(
      text('h3', definition.name.text),
      text(
        'p',
        `${content.roles.find((entry) => entry.id === hero.roleId)?.name.text ?? 'Ruolo da scegliere'} · ${current!.players.find((entry) => entry.id === hero.playerId)?.name ?? ''}`,
        'company-hero-owner',
      ),
    );
    intro.append(title);
    section.append(intro);
    const inspect = document.createElement('button');
    inspect.type = 'button';
    inspect.className = 'company-link';
    inspect.textContent = 'Caratteristiche e capacità';
    inspect.onclick = () => reader.hero(definition, content, inspect);
    section.append(inspect);
    const gear = text('div', '', 'company-equipment');
    for (const copy of hero.itemCopies) {
      const item = content.items.find((entry) => entry.id === definitionId(copy));
      if (!item) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'equipment-link';
      button.textContent = `${item.name.text} · I`;
      button.onclick = () => reader.card(item, button);
      gear.append(button);
    }
    section.append(gear);
    if (current!.preparation?.status === 'prepared') {
      const prepared = text('div', '', 'prepared-card-area');
      prepared.append(text('h4', 'Carta preparata'));
      for (const copy of hero.prepared) {
        const card = content.skills.find((entry) => entry.id === definitionId(copy));
        if (card) prepared.append(cardButton(card, (button) => reader.card(card, button)));
      }
      const deck = document.createElement('details');
      deck.className = 'deck-summary';
      deck.append(
        text('summary', `Mazzo coperto · ${hero.deckCount} carte`),
        text('p', 'Composizione del mazzo; l’ordine resta coperto.'),
      );
      const list = document.createElement('ul');
      for (const copy of hero.composition.filter((value) => !hero.prepared.includes(value))) {
        const card = content.skills.find((entry) => entry.id === definitionId(copy));
        if (!card) continue;
        const row = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'company-link';
        button.textContent = `${card.name.text} · ${card.number}`;
        button.onclick = () => reader.card(card, button);
        row.append(button);
        list.append(row);
      }
      deck.append(list);
      prepared.append(deck);
      section.append(prepared);
    } else if (player?.id === hero.playerId) {
      const edit = document.createElement('details');
      edit.append(text('summary', `Configura ${definition.name.text}`));
      const form = document.createElement('form');
      const field = (
        name: string,
        options: { value: string; label: string; disabled?: boolean }[],
        selected: string,
      ) => {
        const label = document.createElement('label');
        label.append(text('span', name));
        const select = document.createElement('select');
        select.setAttribute('aria-label', `${name} di ${definition.name.text}`);
        for (const entry of options) {
          const option = document.createElement('option');
          option.value = entry.value;
          option.textContent = entry.label;
          option.disabled = Boolean(entry.disabled);
          select.append(option);
        }
        select.value = selected;
        select.onchange = () => {
          dirty = true;
          pending = null;
        };
        label.append(select);
        form.append(label);
        return select;
      };
      const others = current!.preparation!.heroes.filter((entry) => entry.heroId !== hero.heroId);
      const roles = [
        { value: '', label: 'Scegli un ruolo' },
        ...content.roles.map((role) => ({
          value: role.id,
          label: role.name.text,
          disabled: others.some((entry) => entry.roleId === role.id),
        })),
      ];
      const role = field('Ruolo', roles, hero.roleId ?? '');
      const reserved = new Set(others.flatMap((entry) => entry.itemCopies));
      const choices = (slot: 'hand' | 'armor') => [
        { value: '', label: 'Nessuno' },
        ...content.items
          .filter((item) => item.rank === 1 && item.slot === slot)
          .flatMap((item) =>
            Array.from({ length: item.quantity }, (_, i) => ({
              value: `${item.id}:${i + 1}`,
              label: `${item.name.text}${item.quantity > 1 ? ` · copia ${i + 1}` : ''}${slot === 'hand' ? ` · ${item.hands} ${item.hands === 1 ? 'mano' : 'mani'}` : ''}`,
              disabled: reserved.has(`${item.id}:${i + 1}`),
            })),
          ),
      ];
      const equipped = hero.itemCopies.map((copy) => ({
        copy,
        item: content.items.find((item) => item.id === definitionId(copy))!,
      }));
      const hands = equipped.filter((entry) => entry.item.slot === 'hand');
      const first = field('Prima mano / arma', choices('hand'), hands[0]?.copy ?? '');
      const second = field('Seconda mano', choices('hand'), hands[1]?.copy ?? '');
      const armor = field(
        'Armatura',
        choices('armor'),
        equipped.find((entry) => entry.item.slot === 'armor')?.copy ?? '',
      );
      const updateHands = () => {
        const twoHanded =
          content.items.find((item) => item.id === definitionId(first.value))?.hands === 2;
        if (twoHanded) second.value = '';
        second.disabled = twoHanded;
      };
      first.addEventListener('change', updateHands);
      updateHands();
      const save = document.createElement('button');
      save.className = 'company-action';
      save.type = 'submit';
      save.dataset.write = '';
      save.textContent = `Salva ${definition.name.text}`;
      form.append(save);
      form.onsubmit = (event) => {
        event.preventDefault();
        void submit({
          type: 'CONFIGURE_HERO',
          heroId: hero.heroId,
          roleId: role.value || null,
          itemCopies: [first.value, second.value, armor.value].filter(Boolean),
        });
      };
      edit.append(form);
      section.append(edit);
    }
    return section;
  }
  function render() {
    if (!current || !catalog) {
      root.replaceChildren();
      return;
    }
    const session = current;
    const prepared = session.preparation?.status === 'prepared';
    const heading = text('h3', prepared ? 'La compagnia è pronta.' : 'Prepara la tua compagnia.');
    const description = text(
      'p',
      prepared
        ? 'Eroi e mazzi sono salvati. Prove, movimento e combattimento arriveranno nel prossimo incremento.'
        : player
          ? session.players.length === 1
            ? 'Se giochi da solo, scegli da due a quattro eroi. Ogni eroe avrà il suo mazzo.'
            : 'Scegli un eroe per persona, poi concordate ruoli ed equipaggiamento.'
          : 'Consulta gli eroi o entra al tavolo per scegliere i tuoi.',
      'company-help',
    );
    root.replaceChildren(heading, description, error);
    if (player && !prepared) {
      const form = document.createElement('form');
      form.className = 'hero-selection';
      const fields = document.createElement('fieldset');
      fields.append(text('legend', 'I tuoi eroi'));
      for (const hero of catalog.heroes) {
        const assigned = session.preparation?.heroes.find((entry) => entry.heroId === hero.id);
        const label = document.createElement('label');
        label.className = 'hero-choice';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.name = 'hero';
        box.value = hero.id;
        box.checked = assigned?.playerId === player.id;
        box.disabled = Boolean(assigned && assigned.playerId !== player.id);
        box.onchange = () => {
          dirty = true;
          pending = null;
        };
        label.append(box, text('span', hero.name.text + (box.disabled ? ' · già scelto' : '')));
        fields.append(label);
      }
      form.append(fields);
      const save = document.createElement('button');
      save.type = 'submit';
      save.dataset.write = '';
      save.className = 'company-action';
      save.textContent = 'Salva gli eroi';
      form.append(save);
      form.onsubmit = (event) => {
        event.preventDefault();
        const heroIds = [...new FormData(form).getAll('hero')].map(String);
        void submit({ type: 'SELECT_HEROES', heroIds });
      };
      root.append(form);
    }
    const party = text('div', '', 'company-heroes');
    for (const hero of session.preparation?.heroes ?? []) party.append(configuration(hero));
    root.append(party);
    if (player && !prepared && session.preparation?.heroes.length) {
      const form = document.createElement('form');
      form.className = 'prepare-company';
      const label = document.createElement('label');
      label.className = 'hero-choice';
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.required = true;
      label.append(check, text('span', 'Il gruppo ha concordato eroi, ruoli ed equipaggiamento.'));
      const button = document.createElement('button');
      button.type = 'submit';
      button.dataset.write = '';
      button.className = 'company-action';
      button.textContent = 'Prepara i mazzi della compagnia';
      form.append(
        label,
        button,
        text(
          'p',
          'La prima carta ruolo resterà preparata. Le altre quattordici carte saranno mescolate e salvate.',
          'company-help',
        ),
      );
      form.onsubmit = (event) => {
        event.preventDefault();
        void submit({ type: 'PREPARE_COMPANY', agreed: true });
      };
      root.append(form);
    }
    element('#hero-catalog').hidden = prepared;
  }
  return {
    update(session: Session, identity: Player | null, content: Catalog | null) {
      const next = `${session.generation}:${session.revision}:${identity?.id ?? ''}:${content?.id ?? ''}`;
      if (current?.generation !== session.generation || player?.id !== identity?.id) {
        dirty = false;
        pending = null;
      }
      current = session;
      player = identity;
      catalog = content;
      if (
        rendered !== next &&
        (forceRender || (!dirty && !root.contains(document.activeElement)))
      ) {
        render();
        rendered = next;
        if (forceRender) {
          const heading = root.querySelector('h3');
          if (heading) {
            heading.tabIndex = -1;
            heading.focus({ preventScroll: true });
          }
          forceRender = false;
        }
      }
    },
  };
}
