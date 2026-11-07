import { campPreparation } from './camp-preparation';
import { campItemInventory } from './camp-items';
import type { Catalog } from '../shared/catalog';
import type { Session, Player, ScenarioCommand } from '../shared/protocol';
import { element, text } from './dom';
import { sourceText } from './source-text';
import { createGameActions } from './game-actions';
import type { CardReader } from './cards';
import { campSkillShop } from './camp-skills';

export function createConclusion(sync: () => Promise<void>, reader: CardReader) {
  const root = element('#campaign'),
    status = element('#campaign-status'),
    next = element<HTMLButtonElement>('#campaign-next');
  let session: Session | null = null,
    player: Player | null = null,
    catalog: Catalog | null = null,
    key = '';
  const commands = createGameActions(
    () => session,
    sync,
    root,
    status,
    element('#campaign-error'),
    controls,
  );
  function submit(input: Extract<ScenarioCommand, { type: 'SCENARIO_INPUT' }>['input']) {
    const sc = session!.scenario!,
      q = sc.pending!;
    return commands.submit(
      {
        type: 'SCENARIO_INPUT',
        scenarioId: sc.id,
        packFingerprint: sc.packFingerprint,
        projectionFingerprint: sc.projectionFingerprint,
        pendingId: q.id,
        sourceFingerprint: q.fingerprint,
        heroId: null,
        input,
      },
      true,
    );
  }
  next.onclick = () => {
    void submit({ kind: 'ack' });
  };
  function controls() {
    const c = session?.scenario?.conclusion;
    root.hidden = !c;
    next.hidden = !c || ['camp', 'camp-preparation'].includes(c.stage) || !player;
    next.textContent =
      c?.stage === 'conclusion'
        ? 'Continua per il gruppo'
        : c?.stage === 'campaign-map'
          ? 'Leggi il seguito'
          : 'Entra nel campo';
  }
  return {
    update(current: Session, identity: Player | null, content: Catalog | null) {
      session = current;
      player = identity;
      catalog = content;
      controls();
      const sc = session.scenario,
        c = sc?.conclusion;
      if (!c || !catalog) return;
      root.dataset.request = sc!.pending!.id;
      const stage = `${session.generation}:${c.id}:${c.stage}`;
      if (root.dataset.stage !== stage) {
        root.dataset.stage = stage;
        if (document.activeElement?.closest('#rounds, #scenario, #combat, #journey-map'))
          queueMicrotask(() => status.focus());
      }
      const changed = `${session.generation}:${session.revision}:${player?.id}`;
      if (key === changed) return;
      key = changed;
      element('#campaign-title').textContent =
        c.stage === 'camp-preparation'
          ? 'Prepara la prossima avventura'
          : c.stage === 'camp'
            ? 'Il primo campo'
            : c.stage === 'conclusion'
              ? c.outcome === 'victory'
                ? 'L’avventura è vinta'
                : 'L’avventura termina in una sconfitta'
              : 'Il cammino della compagnia';
      status.textContent =
        (c.outcome === 'victory'
          ? 'La ricerca del passaggio è riuscita: la compagnia ha vinto. I risultati e i premi sono salvati.'
          : 'kind' in c.cause && c.cause.kind === 'threat'
            ? `La minaccia ${c.cause.before} → ${c.cause.after} ha raggiunto il limite ${c.cause.limit}: la compagnia perde ${c.timing === 'threat-start' ? 'prima degli effetti della prossima Ombra' : 'dopo aver completato le soglie raggiunte'}.`
            : c.timing === 'shadow-start'
              ? 'Un eroe è stato sconfitto: la compagnia perde all’inizio della prossima Ombra.'
              : 'Non restano eroi attivi: la compagnia perde subito.') +
        (c.stage === 'camp-preparation'
          ? session.campDeparture?.available
            ? ' Tutti hanno confermato. Concordate l’ordine di pesca e partite dalla preparazione.'
            : ' Ogni proprietario controlla e conferma le proprie scelte. La preparazione indica il prossimo passo per partire.'
          : c.stage === 'camp'
            ? ' Il campo è salvato. Ogni proprietario può scegliere il ruolo del proprio eroe per il seguito.'
            : player
              ? ' Un partecipante conferma per il gruppo; gli altri leggono e attendono.'
              : ' Un partecipante prosegue dalla propria vista personale.');
      element('#campaign-message').replaceChildren(sourceText(sc!.pending!.text));
      const rewards = element('#campaign-rewards');
      rewards.replaceChildren(
        text(
          'p',
          c.xp.length
            ? 'Premi già applicati, una sola volta. Cambiare ruolo nel campo conserva l’esperienza nel ruolo premiato.'
            : 'Leggete la conclusione. I premi verranno applicati al passaggio indicato dalla storia.',
          'company-help',
        ),
        text('p', `Sapienza della compagnia: ${sc!.play!.lore}.`, 'test-status'),
      );
      const list = document.createElement('ul');
      for (const reward of c.xp)
        list.append(
          text(
            'li',
            `${catalog.heroes.find((h) => h.id === reward.heroId)!.name.text} · ${catalog.roles.find((r) => r.id === reward.roleId)!.name.text}: ${reward.amount} XP ricevuti.`,
          ),
        );
      rewards.append(list);
      if (c.bonusLore) rewards.append(sourceText(sc!.pack.manifest.failure!.partyBonus.text));
      const camp = element('#campaign-camp');
      camp.hidden = !['camp', 'camp-preparation'].includes(c.stage);
      if (camp.hidden) return;
      const destination = sc!.pack.manifest.failure!.next;
      element('#campaign-destination').replaceChildren(
        text('strong', 'Prossima destinazione: '),
        sourceText(destination.name),
        text('p', destination.type === 'battle' ? 'Mappa di battaglia.' : 'Mappa di viaggio.'),
        text(
          'p',
          sc!.pack.manifest.campDeparture
            ? 'La destinazione è salvata. Confermate le scelte di ogni eroe; la preparazione mostra quando potete partire insieme.'
            : 'La destinazione è salvata. La prossima avventura attende la propria mappa e le proprie istruzioni prima della partenza.',
          'company-help',
        ),
      );
      const heroes = element('#campaign-heroes');
      heroes.replaceChildren();
      if (c.stage === 'camp-preparation') {
        heroes.append(campPreparation(session, catalog, player, reader, (input) => submit(input)));
        return;
      }
      const start = document.createElement('button');
      start.type = 'button';
      start.className = 'company-action';
      start.dataset.write = '';
      start.textContent = 'Scegli ruoli e accessori per il seguito';
      start.disabled = !player || !sc!.pack.manifest.campPreparation;
      start.dataset.blocked = String(start.disabled);
      start.onclick = () => {
        void submit({ kind: 'camp-prepare' });
      };
      heroes.append(start);
      if (!sc!.pack.manifest.campPreparation)
        heroes.append(
          text(
            'p',
            'Questo salvataggio conserva il campo. La preparazione successiva richiede le identità delle carte disponibili prima dell’avvio.',
            'company-help',
          ),
        );

      for (const h of c.campaign!.heroes) {
        const entry = document.createElement('article');
        entry.className = 'campaign-hero';
        const name = catalog.heroes.find((hero) => hero.id === h.heroId)!.name.text,
          role = catalog.roles.find((r) => r.id === h.roleId);
        entry.append(
          text('h4', name),
          text(
            'p',
            `Pronto nel campo · ruolo per il seguito: ${role?.name.text ?? 'da scegliere'}. XP disponibili in questo ruolo: ${c.campaign!.training?.balances.find((x) => x.heroId === h.heroId && x.roleId === h.roleId)?.availableXP ?? c.xp.find((x) => x.heroId === h.heroId && x.roleId === h.roleId)?.amount ?? 0}.`,
          ),
        );
        const xp = c.xp.filter((x) => x.heroId === h.heroId);
        entry.append(
          text(
            'p',
            `Premi storici conservati: ${xp.map((x) => `${catalog!.roles.find((r) => r.id === x.roleId)!.name.text} ${x.amount} XP`).join(', ')}.`,
          ),
        );
        entry.append(
          campItemInventory(session, catalog, h.heroId, player, reader, (input) => submit(input)),
        );
        if (
          session.preparation!.heroes.find((hero) => hero.heroId === h.heroId)!.playerId ===
            player?.id &&
          !sc!.pack.manifest.campPreparation
        ) {
          const form = document.createElement('form'),
            label = document.createElement('label'),
            select = document.createElement('select'),
            button = document.createElement('button');
          button.textContent = 'Scegli il ruolo';
          button.className = 'company-action';
          label.textContent = `Ruolo per ${name}`;
          select.id = `camp-role-${h.heroId}`;
          label.htmlFor = select.id;
          for (const r of catalog.roles) {
            const option = document.createElement('option');
            option.value = r.id;
            option.textContent = r.name.text;
            option.selected = r.id === h.roleId;
            select.append(option);
          }
          button.type = 'submit';
          button.dataset.write = '';
          form.append(label, select, button);
          form.onsubmit = (e) => {
            e.preventDefault();
            void submit({ kind: 'camp-role', heroId: h.heroId, roleId: select.value });
          };
          entry.append(form);
        }
        entry.append(
          campSkillShop(session, catalog, h.heroId, player, reader, (input) => submit(input)),
        );
        heroes.append(entry);
      }
      heroes.append(
        campItemInventory(session, catalog, null, player, reader, (input) => submit(input)),
      );
    },
  };
}
