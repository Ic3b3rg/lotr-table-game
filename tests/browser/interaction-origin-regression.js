async () => {
  const state = await (await fetch('/api/session')).json();
  const checks = {
    activeTurn: state.round.phase === 'action' && Boolean(state.round.activeHeroId),
    interactionSelected: document.querySelector('#test-context').value === 'interaction',
    activeHeroSelected: document.querySelector('#test-hero').value === state.round.activeHeroId,
    actionCostVisible: document.querySelector('#start-skill-test').textContent.includes('1 azione'),
  };
  const failed = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);
  if (failed.length) throw new Error(`Collegamento Interagisci: ${failed.join(', ')}`);
  return checks;
};
