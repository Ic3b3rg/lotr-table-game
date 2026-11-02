import type { Catalog } from '../shared/catalog';
import type { Player, Session } from '../shared/protocol';
import { definitionId } from '../shared/preparation';
import { STAT_LABELS, type SkillTest } from '../shared/skill-tests';
import { refreshActions } from './actions';
import { createGameActions } from './game-actions';
import { cardButton, type CardReader } from './cards';
import { element, text } from './dom';

export function createSkillTests(sync: () => Promise<void>, reader: CardReader) {
  const root = element('#skill-tests');
  const form = element<HTMLFormElement>('#skill-test-form');
  const heroSelect = element<HTMLSelectElement>('#test-hero');
  const stat = element<HTMLSelectElement>('#test-stat');
  const mode = element<HTMLSelectElement>('#test-mode');
  const context = element<HTMLSelectElement>('#test-context');
  const target = element<HTMLInputElement>('#test-target');
  const modifier = element<HTMLInputElement>('#test-modifier');
  const gain = element<HTMLButtonElement>('#gain-inspiration');
  const start = element<HTMLButtonElement>('#start-skill-test');
  const convert = element<HTMLButtonElement>('#convert-fate');
  const resolve = element<HTMLButtonElement>('#resolve-skill-test');
  const status = element('#skill-test-status');
  const error = element('#skill-test-error');
  let current: Session | null = null;
  let player: Player | null = null;
  let catalog: Catalog | null = null;
  let rosterKey = '';
  let testKey = '';
  let contextKey = '';
  const commands = createGameActions(() => current, sync, root, status, error, updateControls);
  const { submit } = commands;

  function block(button: HTMLButtonElement, value: boolean) {
    button.dataset.blocked = String(value);
  }
  function updateControls() {
    if (!current || !catalog) return;
    const test = current.skillTest;
    const active = test?.status === 'converting';
    const heroId = active ? test.heroId : heroSelect.value;
    const hero = current.preparation?.heroes.find((entry) => entry.heroId === heroId);
    const own = Boolean(hero && hero.playerId === player?.id);
    const definition = catalog.heroes.find((entry) => entry.id === heroId);
    const round = current.round;
    const rally = round?.phase === 'rally';
    const progress = round?.heroes.find((entry) => entry.heroId === heroId);
    const canInteract =
      round?.phase === 'action' &&
      round.activeHeroId === heroId &&
      Boolean(round.turnId) &&
      (progress?.actionsUsed ?? 2) < 2;
    const interaction = Boolean(round) && context.value === 'interaction';
    form.hidden = active || rally || heroSelect.options.length === 0;
    element('#test-context-field').hidden = !round;
    context.options[0]!.disabled = !canInteract;
    element('#test-inspiration-controls').hidden = !own || rally;
    element('#skill-test-buttons').hidden = !active || !own;
    element('#test-target-field').hidden = mode.value === 'count';
    target.disabled = mode.value === 'count';
    element('#test-inspiration').textContent =
      hero && definition
        ? `${definition.name.text} · Ispirazione ${hero.inspiration} / ${definition.stats.inspiration}`
        : '';
    block(
      start,
      Boolean(active) || Boolean(current.scout) || !own || rally || (interaction && !canInteract),
    );
    block(gain, rally || !own || !definition || hero!.inspiration >= definition.stats.inspiration);
    block(convert, !active || !own || hero!.inspiration < 1 || test!.fateRemaining < 1);
    block(resolve, !active || !own);
    start.textContent = interaction
      ? 'Interagisci e rivela · 1 azione'
      : round
        ? 'Rivela per l’effetto · nessuna azione'
        : 'Rivela le carte della prova';
    element('#test-round-help').textContent = rally
      ? 'Durante Riorganizzazione completa Scoperta 2 per ogni eroe.'
      : interaction
        ? canInteract
          ? 'L’interazione consuma un’azione quando riveli le carte, qualunque sia l’esito.'
          : 'Per interagire serve il tuo eroe di turno con almeno un’azione disponibile.'
        : round
          ? 'Usa questa prova soltanto per un effetto già determinato dal gruppo. Non consuma azioni; per un’interazione scegli l’origine corrispondente.'
          : '';
    const selected = catalog.heroes.find((entry) => entry.id === heroSelect.value);
    for (const option of stat.options) {
      const key = option.value as SkillTest['stat'];
      option.textContent = `${STAT_LABELS[key]} · ${selected?.stats[key] ?? 0}`;
    }
    refreshActions();
  }

  form.onsubmit = (event) => {
    event.preventDefault();
    const intent = {
      heroId: heroSelect.value,
      stat: stat.value as SkillTest['stat'],
      modifier: modifier.valueAsNumber,
      target: mode.value === 'count' ? null : target.valueAsNumber,
    };
    const round = current?.round;
    if (round && context.value === 'interaction') {
      if (round.turnId)
        void submit(
          { ...intent, type: 'START_INTERACTION_TEST', roundId: round.id, turnId: round.turnId },
          true,
        );
    } else void submit({ ...intent, type: 'START_SKILL_TEST' }, true);
  };
  form.oninput = () => {
    commands.clear();
    updateControls();
  };
  heroSelect.onchange = updateControls;
  mode.onchange = updateControls;
  gain.onclick = () => {
    const test = current?.skillTest;
    void submit({
      type: 'GAIN_INSPIRATION',
      heroId: test?.status === 'converting' ? test.heroId : heroSelect.value,
    });
  };
  convert.onclick = () => {
    if (current?.skillTest) void submit({ type: 'CONVERT_FATE', testId: current.skillTest.id });
  };
  resolve.onclick = () => {
    if (current?.skillTest)
      void submit({ type: 'RESOLVE_SKILL_TEST', testId: current.skillTest.id }, true);
  };

  return {
    update(session: Session, identity: Player | null, content: Catalog | null) {
      current = session;
      player = identity;
      catalog = content;
      root.hidden = !catalog || session.preparation?.status !== 'prepared';
      if (root.hidden || !catalog) return;
      const mine = session.preparation!.heroes.filter((hero) => hero.playerId === player?.id);
      const nextRoster = `${session.generation}:${player?.id ?? ''}:${mine.map((hero) => hero.heroId).join(',')}`;
      if (rosterKey !== nextRoster) {
        heroSelect.replaceChildren(
          ...mine.map((hero) => {
            const option = document.createElement('option');
            option.value = hero.heroId;
            option.textContent = catalog!.heroes.find(
              (entry) => entry.id === hero.heroId,
            )!.name.text;
            return option;
          }),
        );
        rosterKey = nextRoster;
        commands.clear();
        error.hidden = true;
      }
      const nextContext = `${nextRoster}:${session.round?.id}:${session.round?.phase}:${session.round?.turnId}`;
      if (contextKey !== nextContext) {
        const active = mine.find((hero) => hero.heroId === session.round?.activeHeroId);
        context.value = active ? 'interaction' : 'effect';
        if (active) heroSelect.value = active.heroId;
        contextKey = nextContext;
        commands.clear();
      }
      const test = session.skillTest;
      const nextTest = `${session.generation}:${JSON.stringify(test)}`;
      if (testKey !== nextTest) {
        const result = element('#skill-test-result');
        result.replaceChildren();
        if (test) {
          const hero = catalog.heroes.find((entry) => entry.id === test.heroId)!;
          result.append(text('h4', `${hero.name.text} · ${STAT_LABELS[test.stat]}`));
          const list = text('ul', '', 'test-revealed');
          for (const copy of test.revealed) {
            const card = catalog.skills.find((entry) => entry.id === definitionId(copy))!;
            const row = document.createElement('li');
            const button = cardButton(card, (caller) => reader.card(card, caller));
            button.prepend(
              text('strong', `Successi: ${card.success} · Fato: ${card.fate}`, 'test-symbols'),
            );
            row.append(button);
            list.append(row);
          }
          result.append(list);
          const outcome =
            test.status === 'converting'
              ? 'Scegli se convertire il fato, poi concludi la prova.'
              : test.outcome === 'pass'
                ? 'Prova superata. Le carte sono state scartate.'
                : test.outcome === 'fail'
                  ? 'Prova fallita. Le carte sono state scartate.'
                  : 'Conteggio confermato. Le carte sono state scartate.';
          status.textContent = `${outcome} Successi: ${test.successes} · Fato da convertire: ${test.fateRemaining} · Conversioni: ${test.converted}${test.target === null ? '' : ` · Soglia: ${test.target}`}.`;
        } else {
          status.textContent = 'Nessuna prova in corso.';
        }
        testKey = nextTest;
      }
      element('#skill-test-observer').hidden = mine.length > 0;
      updateControls();
    },
  };
}
