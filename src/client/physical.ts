import { decisionForm } from './physical-decisions';
import { bindPhysicalDecision } from '../shared/physical-actions';
import type { Catalog } from '../shared/catalog';
import type { Player, Session } from '../shared/protocol';
import { bindPhysicalAnswer, physicalAllocationProblem } from '../shared/physical-actions';
import { refreshActions } from './actions';
import { element, text } from './dom';
import { STAT_LABELS } from '../shared/skill-tests';
import { compileSourceText } from '../scenario/text';
import { sourceText } from './source-text';
import { cardButton, type CardReader } from './cards';
import { findSkillCard } from '../shared/skill-cards';

const quantities = (damage: number, fear: number) => `${damage} danni e ${fear} paure`;
const gateMessages = {
  'boon-supply-empty':
    'Il beneficio richiesto è esaurito nella riserva verificata. Manca una regola attestata per questa situazione: la continuazione resta salvata.',
  'adventure-loss-consumer-unavailable':
    'La Compagnia ha perso. La conseguenza finale è salvata; il seguito originale dell’avventura non è ancora disponibile.',
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
    'Questo salvataggio si è fermato a un limite effettivo con le regole precedenti. Continua Ultimo Sforzo per salvare la sua istruzione e iniziare la prova. Carte e costi precedenti restano conservati.',
};

export function createPhysicalControls(
  submit: (
    intent: ReturnType<typeof bindPhysicalAnswer> | ReturnType<typeof bindPhysicalDecision>,
  ) => void,
  reader?: CardReader,
) {
  const root = element('#physical-resolution');
  let key = '',
    current: Session | null = null;
  return {
    update(session: Session, player: Player | null, catalog: Catalog | null) {
      current = session;
      const view = session.physical,
        q = session.scenario?.pending;
      root.hidden =
        !view || (!!session.scenario?.pack.manifest.followup && !!q && q.kind !== 'physical');
      const nextKey = `${session.generation}:${player?.id}:${catalog?.id}:${JSON.stringify(view)}:${q?.id}`;
      if (key === nextKey) return;
      key = nextKey;
      root.replaceChildren();
      if (!view) return;
      const name = (id: string) => catalog?.heroes.find((h) => h.id === id)?.name.text ?? 'Eroe';
      const startup =
        session.scenario?.phase === 'setup' && !!session.scenario.pack.manifest.startupPreparation;
      root.append(
        text(
          'p',
          startup
            ? `${view.synthetic ? 'Avvio sintetico · dati inventati. ' : ''}Scoperte, prove e capacità di preparazione si risolvono qui. Ogni proprietario decide per il proprio eroe; l’avvio prosegue dopo gli effetti.`
            : !view.synthetic
              ? session.round?.phase === 'shadow'
                ? 'Ogni proprietario risolve le prove e le conseguenze dell’Ombra indicate qui sotto. Gli altri giocatori attendono; la fase riprende dopo tutti gli eroi.'
                : 'Le conseguenze e le prove dell’incontro usano le carte della Compagnia. Completa l’istruzione indicata; il turno conserva azioni e movimenti residui.'
              : view.lastStand
                ? 'Prova sintetica P2 · fonte inventata; carte e Ultimo Sforzo seguono il contenuto verificato. Gli incontri originali non sono abilitati.'
                : view.fronts
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
        const status = view.lastStand?.heroes.find((s) => s.heroId === h.heroId);
        if (status)
          row.append(
            text(
              'span',
              status.defeated
                ? 'Sconfitto · figura rimossa'
                : `Prossimo Ultimo Sforzo: difficoltà ${status.difficulty}`,
              'company-help',
            ),
          );
        row.append(
          text('span', `${h.facedown.damage} danni coperti`, 'physical-back damage-back'),
          text('span', `${h.facedown.fear} paure coperte`, 'physical-back fear-back'),
        );
        areas.append(row);
      }
      root.append(areas);
      if (view.boons) {
        const section = document.createElement('details');
        section.className = 'physical-boons';
        section.append(text('summary', 'Benefici e riserva'));
        section.append(
          text(
            'p',
            view.boons.stock === 'verified'
              ? 'Le copie disponibili provengono dalla riserva verificata. Ogni eroe può possedere un solo beneficio per tipo.'
              : view.boons.stock === 'unverified'
                ? 'Le quantità della riserva sono ancora da verificare. Le acquisizioni restano in attesa; potete leggere le tre carte.'
                : 'Questo salvataggio conserva le regole precedenti: le acquisizioni dei benefici non sono disponibili.',
            'company-help',
          ),
        );
        const cards = text('div', '', 'card-grid');
        for (const boon of view.boons.definitions) {
          const row = text('div', '', 'physical-area');
          const button = text('button', `Leggi ${boon.name}`, 'physical-card') as HTMLButtonElement;
          button.type = 'button';
          button.onclick = () => reader?.boon(boon, button);
          row.append(
            button,
            text(
              'p',
              boon.available === null
                ? 'Disponibilità da verificare'
                : `${boon.available} ${boon.available === 1 ? 'copia disponibile' : 'copie disponibili'}`,
              'company-help',
            ),
          );
          const held = view.boons.held.filter((b) => b.kind === boon.kind);
          for (const b of held)
            row.append(
              text('p', `${name(b.heroId)} · scoperto · ${b.sourceLabel}`, 'company-help'),
            );
          cards.append(row);
        }
        section.append(cards);
        root.append(section);
      }
      if (view.sourceTest) {
        const t = view.sourceTest;
        root.append(
          text(
            'h4',
            `Prova ${session.combat?.current ? 'di combattimento' : session.round?.phase === 'shadow' ? 'dell’Ombra' : 'dell’incontro'} · ${name(t.heroId)} · ${STAT_LABELS[t.stat]}${t.target === null ? ' · conta i successi' : ` ${t.target}`}`,
          ),
        );
        const cards = text('ul', '', 'physical-test-cards');
        for (const c of t.cards) {
          const row = text('li', `${c.success} successi · ${c.fate} fati`),
            card =
              catalog?.skills.find((skill) => skill.id === c.skillId) ??
              session.physical?.lastStand?.titles.find((title) => title.skill.id === c.skillId)
                ?.skill;
          if (card && reader) row.prepend(cardButton(card, (caller) => reader.card(card, caller)));
          else row.prepend(text('span', c.name));
          cards.append(row);
        }
        const status = text(
          'p',
          `${t.successes} successi · ${t.fateRemaining} fati disponibili.`,
          'physical-test-total',
        );
        status.setAttribute('role', 'status');
        root.append(cards, status);
      }
      if (view.attackTest) {
        const attack = view.attackTest;
        root.append(
          text(
            'h4',
            `Attacco di ${name(attack.heroId)} · ${attack.stage === 'spending' ? 'spendi i successi' : 'prova e capacità'}`,
          ),
        );
        const tally = text(
          'p',
          `${attack.successes} successi totali · ${attack.spent} spesi · ${attack.remaining} disponibili. Anteprima: ${attack.hits} colpi, inclusi ${attack.addedHits} aggiunti dalle capacità.`,
          'physical-test-total',
        );
        tally.setAttribute('role', 'status');
        root.append(tally);
        const slots = document.createElement('ul');
        slots.className = 'combat-slots';
        for (const slot of attack.slots)
          slots.append(
            text(
              'li',
              `${slot.label}${attack.allocations.some((a) => a.slotId === slot.id) ? ' · pagato' : ''}`,
            ),
          );
        root.append(slots);
      }
      if (view.lastStand) {
        const lastStand = view.lastStand;
        if (lastStand.terminal) {
          const loss = text(
            'p',
            lastStand.terminal.timing === 'no-active-heroes'
              ? 'Nessun eroe è rimasto attivo: la Compagnia ha perso. La perdita è salvata; il seguito dell’avventura non è ancora disponibile.'
              : 'È iniziata la Fase di Ombra dopo una sconfitta: la Compagnia ha perso. La perdita è salvata; il seguito dell’avventura non è ancora disponibile.',
            'physical-warning',
          );
          loss.setAttribute('role', 'status');
          root.append(loss);
        } else if (lastStand.lossAtNextShadow)
          root.append(
            text(
              'p',
              'Una sconfitta è registrata. Gli eroi rimasti possono ancora proseguire; all’inizio della prossima Fase di Ombra la Compagnia perderà.',
              'physical-warning',
            ),
          );
        for (const s of lastStand.selections.slice(-5)) {
          const article = text('article', '', 'physical-last-stand');
          article.append(
            text(
              'h4',
              `Ultimo Sforzo ${s.family === 'damage' ? 'danni' : 'paure'} · ${name(s.heroId)}`,
            ),
          );
          const instruction = text('p', '', 'physical-front-text');
          instruction.append(sourceText(compileSourceText(s.instruction.replaceAll('\\n', '\n'))));
          article.append(
            instruction,
            text(
              'p',
              `${STAT_LABELS[s.stat]} · difficoltà affrontata ${s.difficulty}`,
              'physical-test-target',
            ),
          );
          if (s.outcome) {
            const outcome = text(
              'p',
              s.outcome === 'pass'
                ? `Ultimo Sforzo superato con ${s.successes} successi. ${s.returned} carte coperte restituite; ${s.inspiration} ispirazione ottenuta. La fonte prosegue.`
                : `Ultimo Sforzo fallito${s.forcedFailure ? ': le sole carte scoperte raggiungono un limite effettivo' : `: ${s.successes} successi`}. ${name(s.heroId)} è sconfitto.`,
              'physical-outcome',
            );
            outcome.setAttribute('role', 'status');
            article.append(outcome);
          }
          root.append(article);
        }
        if (lastStand.test) {
          const test = lastStand.test,
            list = document.createElement('ul');
          list.className = 'physical-test-cards';
          for (const c of test.cards)
            list.append(text('li', `${c.name} · ${c.success} successi · ${c.fate} fati`));
          const status = text(
            'p',
            `${test.successes} successi · ${test.fateRemaining} fati disponibili · difficoltà ${test.difficulty}`,
            'physical-test-total',
          );
          status.setAttribute('role', 'status');
          root.append(list, status);
          if (test.forcedFailure)
            root.append(
              text(
                'p',
                'Le sole carte scoperte raggiungono un limite effettivo: questa prova non può essere superata. I successi non annullano il divieto.',
                'physical-warning',
              ),
            );
        }
        for (const t of lastStand.titles) {
          const article = text('article', '', 'physical-title');
          article.append(
            text('h4', `${t.name} · ${name(t.heroId)}`),
            text('p', t.text, 'physical-front-text'),
            text(
              'p',
              t.removed
                ? 'Rimosso dall’avventura · proprietà conservata per la campagna'
                : t.pending
                  ? 'Titolo ottenuto · completa il limite delle carte preparate'
                  : t.prepared
                    ? 'Preparato · si usa soltanto nella sua finestra e pagando il suo costo'
                    : 'Proprietà conservata · abilità non preparata',
              'company-help',
            ),
          );
          root.append(article);
        }
      }
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
        const purpose = active.kind === 'decision' ? active.purpose : undefined;
        root.append(
          text(
            'h4',
            purpose === 'group-order'
              ? 'Ordine dei superstiti'
              : purpose === 'negation'
                ? `Negazione per ${name(active.heroId)}`
                : active.kind === 'prevent'
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
            purpose === 'group-order'
              ? `Il gruppo concorda l’ordine. ${actor?.name ?? 'Il proprietario indicato'} registra la scelta con ${name(active.actorHeroId)}; il proprietario dell’eroe scelto risolve la sua prova e le conseguenze. Dopo tutti i superstiti riprende la fonte.`
              : purpose === 'negation'
                ? `${actor?.name ?? 'Il proprietario indicato'} nega per ${name(active.heroId)} e risolve il residuo. Poi prosegue l’ordine dei superstiti e riprende la fonte.`
                : `Agisce ${actor?.name ?? 'il proprietario'} con ${name(active.actorHeroId)}.`,
            'physical-actor',
          ),
        );
        if (active.kind === 'gate') {
          root.append(text('p', gateMessages[active.reason], 'company-help'));
          if (
            active.reason === 'last-stand-unavailable' &&
            view.fronts &&
            player?.id === active.actorPlayerId
          ) {
            const button = text(
              'button',
              'Continua Ultimo Sforzo',
              'company-action',
            ) as HTMLButtonElement;
            button.type = 'button';
            button.id = 'physical-continue-last-stand';
            button.dataset.write = '';
            button.onclick = () => {
              if (current)
                submit(
                  bindPhysicalDecision(current, {
                    kind: 'physical-continue-last-stand',
                    rules: 'source-last-stand-v1',
                  }),
                );
            };
            root.append(button);
          }
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
          if (active.mode === 'scout' && catalog && reader) {
            const cards = text('ul', '', 'physical-scout-cards test-revealed');
            for (const option of active.options) {
              const card = findSkillCard(
                catalog,
                option.id,
                view.lastStand?.titles.map((t) => t.skill),
              );
              if (!card) continue;
              const row = text('li', '');
              row.append(cardButton(card, (caller) => reader.card(card, caller)));
              cards.append(row);
            }
            root.append(cards);
          }
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
              `${['group-test', 'group-suffer', 'darkness'].includes(r.kind) ? 'Fonte collettiva · totali tra gli eroi' : view.fronts ? `Fonte per ${name(r.heroId)} · totali tra gli eroi` : name(r.heroId)} · ${quantities(r.prevented.damage, r.prevented.fear)} prevenuti; ${quantities(r.transferred.damage, r.transferred.fear)} ricevuti${view.fronts ? '' : ' coperti'}; ${quantities(r.returned.damage, r.returned.fear)} restituiti sotto i mazzi.`,
            ),
          );
        results.append(list);
        root.append(results);
      }
    },
  };
}
