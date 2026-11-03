async () => {
  await document.fonts.ready;
  const session = await (await fetch('/api/session')).json();
  const view = session.physical;
  const root = document.querySelector('#physical-resolution');
  const active = view?.active;
  if (!active || active.kind === 'gate') throw Error('A live physical allocation is required.');
  const visible = (e) => e.checkVisibility();
  const checks = {
    synthetic: root.innerText.includes('Prova sintetica P0'),
    consequenceInstruction: document
      .querySelector('#start-instruction')
      .textContent.includes('conseguenza'),
    noWrongTestInstruction: !document
      .querySelector('#start-instruction')
      .textContent.includes('Spirito 1'),
    noGenericAck: !visible(document.querySelector('#scenario-next')),
    noCancel: ![...root.querySelectorAll('button')].some((e) =>
      /annulla|salta/i.test(e.textContent),
    ),
    noTechnicalFlow: !/\b(IR|RNG|frame)\b/.test(root.innerText),
    noPrivateState: !['entropy', 'rngCursor', 'population', 'contentFingerprint', 'rawSha256'].some(
      (key) => JSON.stringify(session).includes(key),
    ),
    noOverflow: document.documentElement.scrollWidth <= innerWidth,
    touchTargets: [...root.querySelectorAll('select, button')]
      .filter(visible)
      .every((e) => e.getBoundingClientRect().height >= 44),
    guideAvailable: visible(document.querySelector('#open-guide')),
    currentCounts: root.innerText.includes(`${view.decks.damage} danni e ${view.decks.fear} paure`),
    labelledControls: [...root.querySelectorAll('select')].every((e) => e.labels.length > 0),
  };
  const failed = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
  if (failed.length) throw new Error(`Physical UI: ${failed.join(', ')}`);
  return { viewport: innerWidth, checks };
};
