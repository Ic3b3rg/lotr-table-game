import type { Session, Player } from '../shared/protocol';
import type { Catalog } from '../shared/catalog';
import { definitionId } from '../shared/preparation';
import { STAT_LABELS } from '../shared/skill-tests';
import { element, text } from './dom';
import { createGameActions } from './game-actions';
import { cardButton, type CardReader } from './cards';
import { sourceText } from './source-text';
import { compileSourceText } from '../scenario/text';
import { refreshActions } from './actions';

export function createCombat(sync: () => Promise<void>, reader: CardReader) {
  const root = element('#combat'),
    status = element('#combat-status'),
    body = element('#combat-body');
  let current: Session | null = null,
    player: Player | null = null,
    catalog: Catalog | null = null,
    key = '';
  const commands = createGameActions(() => current, sync, root, status, element('#combat-error'));
  const name = (heroId: string) =>
    catalog?.heroes.find((h) => h.id === heroId)?.name.text ?? 'Eroe';
  return {
    update(session: Session, identity: Player | null, content: Catalog | null) {
      current = session;
      player = identity;
      catalog = content;
      root.hidden = !session.combat;
      const view = session.combat;
      if (!view || !catalog) return;
      const nextKey = `${session.generation}:${player?.id}:${JSON.stringify(view)}:${session.round?.heroes.map((h) => h.actionsUsed)}`;
      if (key === nextKey) return;
      key = nextKey;
      body.replaceChildren();
      commands.clear();
      const active = view.current,
        q = view.pending;
      const actor = q?.actorPlayerId ?? session.physical?.active?.actorPlayerId;
      status.textContent = active
        ? `${name(active.heroId)} · ${active.kind === 'provocation' ? 'Provocazione' : 'Attacco'} contro ${active.name}. ${actor ? `Agisce ${session.players.find((p) => p.id === actor)?.name ?? 'il proprietario indicato'}.` : ''} ${active.returnLabel}`
        : view.last
          ? `${view.last.kind === 'provocation' ? 'Provocazione' : 'Attacco'} di ${name(view.last.heroId)} completato${view.last.hits === null ? '' : `: ${view.last.hits} colpi`}. ${view.last.returnLabel}`
          : 'Scegli bersaglio e armi, controlla gli slot, poi conferma. Le scelte prima della conferma sono gratuite.';
      if (active) {
        const heading = text(
          'h4',
          `${active.kind === 'provocation' ? 'Rispondi alla provocazione' : 'Attacco in corso'} · ${active.name}`,
        );
        body.append(heading);
        if (active.instruction) {
          const p = text('p', '', 'combat-instruction');
          p.append(sourceText(compileSourceText(active.instruction.replaceAll('\\n', '\n'))));
          body.append(p);
        }
        if (active.packet)
          body.append(
            text(
              'p',
              active.packet.executed
                ? `Attacco nemico: ${active.packet.damage} danni e ${active.packet.fear} paure. Risolvi la negazione e le conseguenze con le tue carte.`
                : 'Il nemico è fuori portata: il contrattacco non viene eseguito.',
              'combat-summary',
            ),
          );
        if (active.applied)
          body.append(
            text(
              'p',
              `${active.applied.hits} colpi applicati una sola volta · ${active.applied.removed.length} figure sconfitte.${active.applied.suppressed.length ? ' Un’immunità ha impedito il modificatore; i colpi pagati restano applicati.' : ''}`,
              'combat-summary',
            ),
          );
        if (session.physical?.active) {
          const link = text(
            'a',
            'Apri le carte e la conseguenza corrente',
            'company-link',
          ) as HTMLAnchorElement;
          link.href = '#physical-resolution';
          body.append(link);
        }
      }
      if (q) {
        body.append(text('p', q.title, 'company-help'));
        if (q.actorPlayerId === player?.id) {
          const fields = document.createElement('fieldset');
          fields.className = 'combat-choices';
          fields.append(text('legend', 'Il prossimo passo'));
          for (const option of q.options) {
            const b = text('button', option.label, 'company-action') as HTMLButtonElement;
            b.type = 'button';
            b.dataset.write = '';
            b.dataset.combatChoice = option.id;
            if (option.unavailable) {
              b.dataset.blocked = 'true';
              b.title = option.unavailable;
              fields.append(text('p', option.unavailable, 'company-help'));
            }
            b.onclick = () =>
              void commands.submit(
                {
                  type: 'COMBAT_INPUT',
                  combatId: q.combatId,
                  pendingId: q.id,
                  sourceFingerprint: q.sourceFingerprint,
                  choice: option.id,
                },
                true,
              );
            fields.append(b);
          }
          body.append(fields);
        } else
          body.append(
            text(
              'p',
              `In attesa di ${session.players.find((p) => p.id === q.actorPlayerId)?.name ?? 'chi controlla l’eroe'}. La scelta e il ritorno sono salvati.`,
              'physical-waiting',
            ),
          );
      }
      const offers = view.attacks.filter(
        (o) =>
          session.preparation?.heroes.find((h) => h.heroId === o.heroId)?.playerId === player?.id,
      );
      if (!offers.length) {
        if (!active)
          body.append(
            text(
              'p',
              session.round?.activeHeroId
                ? `Agisce ${name(session.round.activeHeroId)}. Per attaccare serve un gruppo vivo a portata di un’arma equipaggiata.`
                : 'L’attacco è disponibile durante il turno di un eroe vivo.',
              'company-help',
            ),
          );
        refreshActions();
        return;
      }
      const heroId = offers[0]!.heroId,
        progress = session.round!.heroes.find((h) => h.heroId === heroId)!,
        grant = view.grant;
      const details = document.createElement('details');
      details.id = 'combat-setup';
      const summary = text(
        'summary',
        grant ? 'Attacco concesso · nessuna azione' : 'Attacca · 1 azione',
      );
      details.append(summary);
      const form = document.createElement('form');
      form.id = 'combat-form';
      const fields = document.createElement('fieldset');
      fields.append(text('legend', `${name(heroId)} · prepara l’attacco`));
      const choose = (label: string, id: string) => {
        const wrap = text('label', label),
          select = document.createElement('select');
        select.id = id;
        wrap.append(select);
        fields.append(wrap);
        return select;
      };
      const target = choose('Bersaglio vivo a portata', 'combat-target');
      const ids = [...new Set(offers.map((o) => o.groupId))];
      for (const id of ids) {
        const o = offers.find((o) => o.groupId === id)!;
        const option = text(
          'option',
          `${o.name} · ${o.figures} ${o.figures === 1 ? 'figura' : 'figure'}`,
        ) as HTMLOptionElement;
        option.value = id;
        target.append(option);
      }
      const weapons = choose('Armi equipaggiate e caratteristica comune', 'combat-weapons');
      const replace = choose('Prima della prova', 'combat-replacement');
      const normal = text('option', 'Usa la caratteristica delle armi') as HTMLOptionElement;
      normal.value = '';
      replace.append(normal);
      for (const o of view.replacements.filter((o) => o.heroId === heroId)) {
        const option = text(
          'option',
          `Scarta ${catalog.skills.find((s) => s.id === definitionId(o.copy))!.name.text}: ${STAT_LABELS[o.stat]}${o.inspiration ? ` e ${o.inspiration} ispirazione` : ''}`,
        ) as HTMLOptionElement;
        option.value = o.copy;
        replace.append(option);
      }
      const preview = text('div', '', 'combat-preview'),
        notice = text('p', '', 'company-help'),
        list = text('ul', '', 'combat-slots');
      preview.append(notice, list);
      const confirm = text(
        'button',
        grant ? 'Conferma l’attacco concesso e rivela' : 'Paga 1 azione e rivela le carte',
        'company-action',
      ) as HTMLButtonElement;
      confirm.type = 'submit';
      confirm.id = 'combat-confirm';
      confirm.dataset.write = '';
      const cancel = text('button', 'Annulla · nessun costo', 'text-button') as HTMLButtonElement;
      cancel.type = 'button';
      cancel.id = 'combat-cancel';
      cancel.onclick = () => {
        details.open = false;
        summary.focus();
      };
      let selected = offers[0]!;
      function renderPreview() {
        const options = offers.filter((o) => o.groupId === target.value);
        selected = options[Number(weapons.value) || 0]!;
        list.replaceChildren();
        const used = [...new Set(selected.itemCopies)];
        for (const copy of used) {
          const card = catalog!.items.find((i) => i.id === definitionId(copy))!;
          const row = text('li', '', 'combat-weapon-card');
          row.append(cardButton(card, (caller) => reader.card(card, caller)));
          list.append(row);
        }
        for (const slot of selected.slots) list.append(text('li', slot.label));
        const actualStat =
          view!.replacements.find((o) => o.copy === replace.value)?.stat ?? selected.stat;
        notice.textContent =
          selected.reason ??
          `${STAT_LABELS[actualStat]} · costo ${grant ? 'la capacità indicata, senza azioni' : '1 azione'}. Ogni successo paga una sola spesa; ogni slot della singola copia si usa al massimo una volta. Puoi confermare anche zero colpi.`;
        confirm.dataset.blocked = String(
          !!selected.reason || (!grant && progress.actionsUsed >= 2),
        );
        refreshActions();
      }
      function renderWeapons() {
        weapons.replaceChildren();
        offers
          .filter((o) => o.groupId === target.value)
          .forEach((o, n) => {
            const option = text(
              'option',
              `${o.itemCopies.map((copy) => catalog!.items.find((i) => i.id === definitionId(copy))!.name.text).join(' + ')} · ${STAT_LABELS[o.stat]}`,
            ) as HTMLOptionElement;
            option.value = String(n);
            weapons.append(option);
          });
        renderPreview();
      }
      target.onchange = renderWeapons;
      weapons.onchange = renderPreview;
      replace.onchange = renderPreview;
      form.onsubmit = (e) => {
        e.preventDefault();
        if (!selected.reason)
          void commands.submit(
            {
              type: 'START_ATTACK',
              roundId: current!.round!.id,
              turnId: current!.round!.turnId!,
              heroId,
              groupId: selected.groupId,
              itemCopies: selected.itemCopies,
              stat: selected.stat,
              replaceCopy: replace.value || null,
              grantId: grant?.id ?? null,
            },
            true,
          );
      };
      form.append(fields, preview, confirm, cancel);
      details.append(form);
      body.append(details);
      renderWeapons();
      refreshActions();
    },
  };
}
