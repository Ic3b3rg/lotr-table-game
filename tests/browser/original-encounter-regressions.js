// Read-only checks for a real source-bound encounter pending in the browser.
// Pass the current GET /api/session observation; do not create or alter state.
(session) => {
  const errors = [];
  const test = session.physical?.sourceTest;
  if (test) {
    const cards = [
      ...document.querySelectorAll('#physical-resolution .physical-test-cards button'),
    ];
    if (cards.length !== test.cards.length)
      errors.push('Every revealed source-test card must open its reader.');
    for (const card of test.cards)
      if (!cards.some((button) => button.textContent.includes(card.name)))
        errors.push(`The revealed card ${card.name} is missing from the reader controls.`);
  }
  if (session.scenario?.pending?.kind === 'choice') {
    const buttons = [...document.querySelectorAll('#scenario-message button')];
    if (buttons.some((button) => /annulla|cancel/i.test(button.textContent)))
      errors.push('A mandatory source choice must remain open.');
  }
  const progress = document.querySelector('#scenario-play-progress')?.textContent ?? '';
  for (const hero of session.preparation?.heroes ?? [])
    if (progress.includes(hero.heroId))
      errors.push('Progress must name the hero after the catalog loads.');
  if (document.documentElement.scrollWidth > innerWidth)
    errors.push('The encounter must fit the viewport.');
  return errors;
};
