async () => {
  await document.fonts.ready;
  const state = await (await fetch('/api/session')).json();
  const root = document.querySelector('#scouting');
  const fields = [...root.querySelectorAll('#scout-cards select')];
  const read = () =>
    [...root.querySelectorAll('#scout-cards select')].map((s) => [s.dataset.copy, s.value]);
  const values = read();
  const focus = document.activeElement;
  await new Promise((r) => setTimeout(r, 1300));
  const visible = (el) => el.getClientRects().length > 0;
  const checks = {
    pendingScout: Boolean(state.scout) && !root.hidden,
    stableChoices: JSON.stringify(values) === JSON.stringify(read()),
    stableNodes: fields.every(
      (field, i) => field === root.querySelectorAll('#scout-cards select')[i],
    ),
    stableFocus: focus === document.activeElement,
    noOverflow: document.documentElement.scrollWidth <= innerWidth,
    touchTargets: [...root.querySelectorAll('button,input,select')]
      .filter(visible)
      .every((el) => el.getBoundingClientRect().height >= 44),
    revealedCards: root.querySelectorAll('.scout-card').length === state.scout?.revealed.length,
    hiddenOrder: state.preparation.heroes.every((hero) => !('deck' in hero)),
    copiesConserved: state.preparation.heroes.every(
      (hero) => new Set(hero.composition).size === 15,
    ),
    testBlocked: document.querySelector('#start-skill-test').disabled,
    sharedReadOnly:
      location.pathname !== '/' ||
      (document.querySelector('#scout-start-form').hidden &&
        document.querySelector('#scout-choice-form').hidden &&
        fields.length === 0),
  };
  const failed = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);
  if (failed.length) throw new Error(`Scoperta: ${failed.join(', ')}`);
  return { width: innerWidth, checks };
};
