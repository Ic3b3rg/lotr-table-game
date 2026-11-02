async () => {
  await document.fonts.ready;
  const state = await (await fetch('/api/session')).json();
  const root = document.querySelector('#rounds');
  const fields = [
    ...document.querySelectorAll(
      '#rounds input, #rounds select, #skill-test-form input, #skill-test-form select, #scout-cards select',
    ),
  ];
  const values = fields.map((field) => [field.value, field.checked]);
  const focus = document.activeElement;
  await new Promise((resolve) => setTimeout(resolve, 1300));
  const visible = (el) => el.getClientRects().length > 0;
  const shared = location.pathname === '/';
  const round = state.round;
  const inRally = round.phase === 'rally';
  const checks = {
    visibleRound:
      !root.hidden &&
      document.querySelector('#round-title').textContent.includes(`Round ${round.number}`),
    progress: root.querySelectorAll('#round-heroes li').length === round.heroes.length,
    stableFields: fields.every(
      (field, i) =>
        field.isConnected && field.value === values[i][0] && field.checked === values[i][1],
    ),
    stableFocus: document.activeElement === focus,
    noOverflow: document.documentElement.scrollWidth <= innerWidth,
    touchTargets: [
      ...document.querySelectorAll(
        '#rounds button, #rounds select, #rounds input, #rounds a, #skill-test-form button, #scout-start-form button',
      ),
    ]
      .filter(visible)
      .every(
        (el) =>
          (el.type === 'checkbox' ? el.closest('label') : el).getBoundingClientRect().height >= 44,
      ),
    hiddenOrder: state.preparation.heroes.every((hero) => !('deck' in hero)),
    sharedReadOnly:
      !shared ||
      (document.querySelector('#round-form').hidden &&
        document.querySelector('#round-turn-controls').hidden &&
        document.querySelector('#skill-test-form').hidden &&
        document.querySelector('#scout-start-form').hidden &&
        document.querySelector('#scout-choice-form').hidden),
    rallyGuards:
      !inRally ||
      (document.querySelector('#skill-test-form').hidden &&
        document.querySelector('#scout-discard-controls').hidden &&
        document.querySelector('#start-scout').hidden),
    pendingTurnGuard:
      (!state.scout && state.skillTest?.status !== 'converting') ||
      document.querySelector('#round-end-turn').disabled,
    currentTurnControls:
      shared ||
      round.phase !== 'action' ||
      Boolean(round.activeHeroId) ||
      !round.heroes.some((hero) => !hero.turnEnded) ||
      !document.querySelector('#round-hero').disabled,
  };
  const failed = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);
  if (failed.length) throw new Error(`Round: ${failed.join(', ')}`);
  return { width: innerWidth, phase: round.phase, checks };
};
