async () => {
  await document.fonts.ready;
  const session = await (await fetch('/api/session')).json();
  const root = document.querySelector('#skill-tests');
  const form = document.querySelector('#skill-test-form');
  const read = () => [...form.querySelectorAll('input, select')].map((input) => input.value);
  const values = read();
  const focused = document.activeElement;
  await new Promise((resolve) => setTimeout(resolve, 1300));
  const visible = (element) => element.getClientRects().length > 0;
  const checks = {
    preparedCompany: session.preparation?.status === 'prepared' && !root.hidden,
    stableForm: form === document.querySelector('#skill-test-form'),
    stableChoices: JSON.stringify(values) === JSON.stringify(read()),
    stableFocus: focused === document.activeElement,
    noOverflow: document.documentElement.scrollWidth <= innerWidth,
    touchTargets: [...root.querySelectorAll('input, select, button')]
      .filter(visible)
      .every((element) => element.getBoundingClientRect().height >= 44),
    hiddenOrder: session.preparation.heroes.every((hero) => !('deck' in hero)),
    revealedCards:
      root.querySelectorAll('.test-revealed li').length ===
      (session.skillTest?.revealed.length ?? 0),
    matchingSuccesses:
      !session.skillTest ||
      document
        .querySelector('#skill-test-status')
        .textContent.includes(`Successi: ${session.skillTest.successes}`),
    sharedReadOnly:
      location.pathname !== '/' ||
      (form.hidden &&
        document.querySelector('#skill-test-buttons').hidden &&
        document.querySelector('#test-inspiration-controls').hidden),
  };
  const failed = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
  if (failed.length) throw new Error(`Prove abilità: ${failed.join(', ')}`);
  return { viewport: innerWidth, checks };
};
