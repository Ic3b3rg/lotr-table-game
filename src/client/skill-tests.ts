import type { Catalog } from '../shared/catalog';
import type { Player, Session, SkillTestCommand } from '../shared/protocol';
import { definitionId } from '../shared/preparation';
import { STAT_LABELS, type SkillTest } from '../shared/skill-tests';
import { action, refreshActions } from './actions';
import { randomIntent, request, RequestError } from './api';
import { cardButton, type CardReader } from './cards';
import { element, text } from './dom';

type Intent<C = SkillTestCommand> = C extends SkillTestCommand
  ? Omit<C, 'requestId' | 'generation' | 'expectedRevision'>
  : never;

export function createSkillTests(sync: () => Promise<void>, reader: CardReader) {
  const root = element('#skill-tests');
  const form = element<HTMLFormElement>('#skill-test-form');
  const heroSelect = element<HTMLSelectElement>('#test-hero');
  const stat = element<HTMLSelectElement>('#test-stat');
  const mode = element<HTMLSelectElement>('#test-mode');
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
  let pending: { signature: string; body: object } | null = null;

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
    form.hidden = active || heroSelect.options.length === 0;
    element('#test-inspiration-controls').hidden = !own;
    element('#skill-test-buttons').hidden = !active || !own;
    element('#test-target-field').hidden = mode.value === 'count';
    target.disabled = mode.value === 'count';
    element('#test-inspiration').textContent =
      hero && definition
        ? `${definition.name.text} · Ispirazione ${hero.inspiration} / ${definition.stats.inspiration}`
        : '';
    block(start, Boolean(active) || !own);
    block(gain, !own || !definition || hero!.inspiration >= definition.stats.inspiration);
    block(convert, !active || !own || hero!.inspiration < 1 || test!.fateRemaining < 1);
    block(resolve, !active || !own);
    const selected = catalog.heroes.find((entry) => entry.id === heroSelect.value);
    for (const option of stat.options) {
      const key = option.value as SkillTest['stat'];
      option.textContent = `${STAT_LABELS[key]} · ${selected?.stats[key] ?? 0}`;
    }
    refreshActions();
  }

  async function submit(intent: Intent, focusResult = false) {
    if (!current) return;
    const caller = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    let completed = false;
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
        await sync();
        completed = true;
      } catch (cause) {
        error.textContent =
          cause instanceof RequestError
            ? cause.message
            : 'Il PC non ha risposto. Riprova: la stessa richiesta verrà applicata una sola volta.';
        error.hidden = false;
        if (cause instanceof RequestError) {
          pending = null;
          await sync();
        }
        error.focus();
      }
    });
    if (completed) {
      if (
        focusResult ||
        !caller?.isConnected ||
        (caller instanceof HTMLButtonElement && caller.disabled)
      )
        status.focus();
      else caller.focus({ preventScroll: true });
    }
  }
  form.onsubmit = (event) => {
    event.preventDefault();
    void submit(
      {
        type: 'START_SKILL_TEST',
        heroId: heroSelect.value,
        stat: stat.value as SkillTest['stat'],
        modifier: modifier.valueAsNumber,
        target: mode.value === 'count' ? null : target.valueAsNumber,
      },
      true,
    );
  };
  form.oninput = () => {
    pending = null;
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
        pending = null;
        error.hidden = true;
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
