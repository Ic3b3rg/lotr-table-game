import { decisionForm } from './physical-decisions';
import { bindPhysicalDecision } from '../shared/physical-actions';
import type { Catalog } from '../shared/catalog';
import type { Player, Session } from '../shared/protocol';
import { bindPhysicalAnswer, physicalAllocationProblem } from '../shared/physical-actions';
import { refreshActions } from './actions';
import { element, text } from './dom';

const quantities = (damage: number, fear: number) => `${damage} danni e ${fear} paure`;
const gateMessages = {
  'weakness-deck-empty':
    'La riserva comune delle debolezze è vuota. La continuazione resta salvata senza creare copie.',
  'boon-quantity-unconfirmed':
    'Le quantità dei benefici non sono confermate (#57). La conseguenza resta sospesa.',
  'required-deck-empty':
    'Il mazzo necessario è vuoto. La pesca resta sospesa esattamente qui: carte già ricevute e costi sono salvati. Non è disponibile una regola verificata di sostituzione.',
  'faceup-handler-unavailable':
    'Questa istruzione richiede una carta scoperta. La risoluzione dei fronti non è ancora disponibile: nessuna carta di questa istruzione è stata pescata.',
  'effective-limits-unavailable':
    'Una capacità necessaria per determinare i limiti effettivi non è ancora disponibile. La conseguenza resta sospesa prima della pesca.',
  'last-stand-unavailable':
    'È raggiunto un limite effettivo della prova sintetica. Occorre Ultimo Sforzo, ancora non disponibile; la fonte resta sospesa con tutte le carte salvate.',
};

export function createPhysicalControls(
  submit: (
    intent: ReturnType<typeof bindPhysicalAnswer> | ReturnType<typeof bindPhysicalDecision>,
  ) => void,
) {
  const root = element('#physical-resolution');
  let key = '',
    current: Session | null = null;
  return {
    update(session: Session, player: Player | null, catalog: Catalog | null) {
      current = session;
      const view = session.physical,
        q = session.scenario?.pending;
      root.hidden = !view;
      const nextKey = `${session.generation}:${player?.id}:${catalog?.id}:${JSON.stringify(view)}:${q?.id}`;
      if (key === nextKey) return;
      key = nextKey;
      root.replaceChildren();
      if (!view) return;
      const name = (id: string) => catalog?.heroes.find((h) => h.id === id)?.name.text ?? 'Eroe';
      root.append(
        text(
          'p',
          view.fronts
            ? 'Prova sintetica P1 · fonte inventata; i fronti seguono il contenuto verificato. Gli incontri originali non sono abilitati.'
            : 'Prova sintetica P0 · parametri e crediti inventati. Gli incontri originali non sono abilitati.',
          'physical-notice',
        ),
      );
      const common = text(
        'p',
        `Mazzi comuni · ${quantities(view.decks.damage, view.decks.fear)} ancora nei mazzi.`,
        'company-help',
      );
      root.append(common);
      const areas = text('ul', '', 'physical-areas');
      for (const h of view.heroes) {
        const row = text('li', '', 'physical-area');
        row.append(text('strong', name(h.heroId)));
        row.append(
          text('span', `${h.facedown.damage} danni coperti`, 'physical-back damage-back'),
          text('span', `${h.facedown.fear} paure coperte`, 'physical-back fear-back'),
        );
        areas.append(row);
      }
      root.append(areas);
      for (const front of view.fronts ?? []) {
        const article = text('article', '', 'physical-front');
        article.append(
          text('h4', `${name(front.heroId)} · ${front.name}`),
          text('p', front.text, 'physical-front-text'),
        );
        for (const effect of front.persistent) article.append(text('p', effect, 'company-help'));
        root.append(article);
      }
      if (view.current)
        root.append(
          text(
            'p',
            `Carta in risoluzione: ${view.current.name}. ${view.current.step}`,
            'company-help',
          ),
        );

      const active = view.active;
      if (active) {
        const actor = session.players.find((p) => p.id === active.actorPlayerId);
        root.append(
          text(
            'h4',
            active.kind === 'prevent'
              ? `Prevenzione per ${name(active.heroId)}`
              : active.kind === 'discard'
                ? `Scarto per ${name(active.heroId)}`
                : active.kind === 'decision'
                  ? `Decisione per ${name(active.heroId)}`
                  : `Conseguenza sospesa per ${name(active.heroId)}`,
          ),
        );
        root.append(
          text(
            'p',
            `Agisce ${actor?.name ?? 'il proprietario'} con ${name(active.actorHeroId)}.`,
            'physical-actor',
          ),
        );
        if (active.kind === 'gate') {
          root.append(text('p', gateMessages[active.reason], 'company-help'));
          if (active.reason === 'required-deck-empty')
            root.append(
              text(
                'p',
                `Restano da subire ${quantities(active.remaining.damage, active.remaining.fear)}.`,
                'company-help',
              ),
            );
        } else if (active.kind === 'decision') {
          root.append(text('p', active.title, 'company-help'));
          if (
            player?.id === active.actorPlayerId &&
            (q?.kind === 'physical' || view.cycle?.pending)
          ) {
            const form = decisionForm(active, session, catalog, (input) => {
              if (current) submit(bindPhysicalDecision(current, input));
            });
            root.append(form);
            queueMicrotask(() => {
              if (form.isConnected && !document.querySelector('dialog[open]')) {
                const legend = form.querySelector('legend');
                if (legend) {
                  legend.tabIndex = -1;
                  legend.focus({ preventScroll: true });
                }
              }
            });
          } else
            root.append(
              text(
                'p',
                `In attesa di ${actor?.name ?? 'chi controlla l’eroe'}. Carta, scelta e residui sono salvati.`,
                'physical-waiting',
              ),
            );
        } else {
          root.append(
            text(
              'p',
              active.kind === 'prevent'
                ? `${name(active.heroId)} deve subire ${quantities(active.remaining.damage, active.remaining.fear)} coperte. La fonte concede fino a ${active.budget} prevenzioni; puoi lasciarle inutilizzate. Costo se ne usi almeno una: ${active.creditCost} credito di prova. Non è un’abilità originale di Protezione.`
                : `Scarta ${active.minimum === active.count ? active.count : `fino a ${active.count}`} carte coperte. Scegli soltanto quanti danni e paure: le copie vengono estratte casualmente e restituite sotto il loro mazzo.`,
              'company-help',
            ),
          );
          if (player?.id === active.actorPlayerId && q?.kind === 'physical') {
            const form = document.createElement('form'),
              fields = document.createElement('fieldset');
            form.id = 'physical-form';
            fields.append(
              text(
                'legend',
                active.kind === 'prevent'
                  ? 'Ripartisci la prevenzione concessa'
                  : 'Ripartisci le carte da scartare',
              ),
            );
            const selects: HTMLSelectElement[] = [];
            const available = active.kind === 'prevent' ? active.remaining : active.available;
            const max = active.kind === 'prevent' ? active.budget : active.count;
            for (const [family, label] of [
              ['damage', 'Danni'],
              ['fear', 'Paure'],
            ] as const) {
              const wrap = text('label', label),
                select = document.createElement('select');
              select.id = `physical-${family}`;
              for (let n = 0; n <= Math.min(max, available[family]); n++) {
                const option = document.createElement('option');
                option.value = String(n);
                option.textContent = String(n);
                select.append(option);
              }
              wrap.append(select);
              fields.append(wrap);
              selects.push(select);
            }
            const choice = text('p', '', 'company-help');
            choice.id = 'physical-choice';
            choice.setAttribute('role', 'status');
            const button = text(
              'button',
              active.kind === 'prevent'
                ? 'Applica l’allocazione e continua'
                : 'Scarta casualmente e continua',
              'company-action',
            ) as HTMLButtonElement;
            button.type = 'submit';
            button.dataset.write = '';
            const values = () => ({
              damage: Number(selects[0]!.value),
              fear: Number(selects[1]!.value),
            });
            const controls = () => {
              const counts = values(),
                problem = physicalAllocationProblem(active, counts);
              button.dataset.blocked = String(!!problem);
              choice.textContent =
                problem ??
                (active.kind === 'prevent'
                  ? `Subirai ${quantities(active.remaining.damage - counts.damage, active.remaining.fear - counts.fear)} coperte. Costo: ${counts.damage + counts.fear ? active.creditCost : 0} crediti. Poi la fonte continua automaticamente.`
                  : `${quantities(counts.damage, counts.fear)} torneranno sotto i rispettivi mazzi. Poi riprende la fonte.`);
              refreshActions();
            };
            selects.forEach((select) => {
              select.onchange = controls;
            });
            form.onsubmit = (e) => {
              e.preventDefault();
              if (current && !physicalAllocationProblem(active, values()))
                submit(bindPhysicalAnswer(current, values()));
            };
            form.append(fields, choice, button);
            root.append(form);
            controls();
          } else
            root.append(
              text(
                'p',
                `In attesa di ${actor?.name ?? 'chi controlla l’eroe'}. La conseguenza e il passo successivo sono salvati.`,
                'physical-waiting',
              ),
            );
        }
      }
      for (const parent of view.parents) {
        const results = text('details', '', 'physical-results');
        results.append(
          text(
            'summary',
            parent.status === 'completed'
              ? `Conseguenza completata · ${parent.completedChildren} istruzioni risolte. La fonte ha ripreso.`
              : `${parent.completedChildren} di ${parent.totalChildren} istruzioni risolte · la fonte attende.`,
          ),
        );
        const list = document.createElement('ul');
        for (const r of parent.results)
          list.append(
            text(
              'li',
              `${view.fronts ? `Fonte per ${name(r.heroId)} · totali tra gli eroi` : name(r.heroId)} · ${quantities(r.prevented.damage, r.prevented.fear)} prevenuti; ${quantities(r.transferred.damage, r.transferred.fear)} ricevuti${view.fronts ? '' : ' coperti'}; ${quantities(r.returned.damage, r.returned.fear)} restituiti sotto i mazzi.`,
            ),
          );
        results.append(list);
        root.append(results);
      }
    },
  };
}
