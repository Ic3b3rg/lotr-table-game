import type { Catalog } from '../shared/catalog';
import type { Session, Player, ScenarioCommand } from '../shared/protocol';
import { element, text } from './dom';
import { sourceText } from './source-text';
import { createGameActions } from './game-actions';
import { cardButton, type CardReader } from './cards';

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
    next.hidden = !c || c.stage === 'camp' || !player;
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
        c.stage === 'camp'
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
        (c.stage === 'camp'
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
            `${catalog.heroes.find((h) => h.id === reward.heroId)!.name.text} · ${catalog.roles.find((r) => r.id === reward.roleId)!.name.text}: ${reward.amount} XP disponibili.`,
          ),
        );
      rewards.append(list);
      if (c.bonusLore) rewards.append(sourceText(sc!.pack.manifest.failure!.partyBonus.text));
      const camp = element('#campaign-camp');
      camp.hidden = c.stage !== 'camp';
      if (c.stage !== 'camp') return;
      const destination = sc!.pack.manifest.failure!.next;
      element('#campaign-destination').replaceChildren(
        text('strong', 'Prossima destinazione: '),
        sourceText(destination.name),
        text('p', destination.type === 'battle' ? 'Mappa di battaglia.' : 'Mappa di viaggio.'),
        text(
          'p',
          'La destinazione è salvata. La prossima avventura attende la propria mappa e le proprie istruzioni prima della partenza.',
          'company-help',
        ),
      );
      const heroes = element('#campaign-heroes');
      heroes.replaceChildren();
      for (const h of c.campaign!.heroes) {
        const entry = document.createElement('article');
        entry.className = 'campaign-hero';
        const name = catalog.heroes.find((hero) => hero.id === h.heroId)!.name.text,
          role = catalog.roles.find((r) => r.id === h.roleId);
        entry.append(
          text('h4', name),
          text(
            'p',
            `Pronto nel campo · ruolo per il seguito: ${role?.name.text ?? 'da scegliere'}. XP in questo ruolo: ${c.xp.find((x) => x.heroId === h.heroId && x.roleId === h.roleId)?.amount ?? 0}.`,
          ),
        );
        const xp = c.xp.filter((x) => x.heroId === h.heroId);
        entry.append(
          text(
            'p',
            `Esperienza conservata: ${xp.map((x) => `${catalog!.roles.find((r) => r.id === x.roleId)!.name.text} ${x.amount} XP`).join(', ')}. Nessun XP speso.`,
          ),
        );
        for (const copy of h.itemCopies) {
          const item = catalog.items.find((i) => i.id === copy.slice(0, copy.lastIndexOf(':')))!;
          entry.append(cardButton(item, (button) => reader.card(item, button)));
        }
        if (
          session.preparation!.heroes.find((hero) => hero.heroId === h.heroId)!.playerId ===
          player?.id
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
        heroes.append(entry);
      }
    },
  };
}
