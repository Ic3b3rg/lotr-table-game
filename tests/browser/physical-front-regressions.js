async () => {
  const session = await (await fetch('/api/session')).json();
  const root = document.querySelector('#physical-resolution');
  const active = session.physical?.active;
  if (active?.kind !== 'decision') throw Error('A P1 decision is required.');
  const visible = (e) => e.checkVisibility();
  const checks = {
    decisionIsNotSuspension: ![...root.querySelectorAll('h4')].some((e) =>
      e.textContent.includes('Conseguenza sospesa'),
    ),
    instructionDescribesDecision: document
      .querySelector('#start-instruction')
      .textContent.includes('decisione'),
    noGenericAck: !visible(document.querySelector('#scenario-next')),
    noCancel: ![...root.querySelectorAll('button')].some((e) =>
      /annulla|salta/i.test(e.textContent),
    ),
    noTechnicalFlow: !/\b(IR|RNG|frame)\b/.test(root.innerText),
    noPrivateState: ![
      'entropy',
      'rngCursor',
      'population',
      'rawSha256',
      'cardHash',
      'originalHash',
    ].some((key) => JSON.stringify(session).includes(key)),
    noOverflow: document.documentElement.scrollWidth <= innerWidth,
    labelledControls: [...root.querySelectorAll('select,input')].every((e) => e.labels.length > 0),
    guideAvailable: visible(document.querySelector('#open-guide')),
    nativeDecision: !!document.querySelector('#physical-decision-form'),
  };
  const failed = Object.entries(checks)
    .filter(([, pass]) => !pass)
    .map(([name]) => name);
  if (failed.length) throw Error(`P1 UI: ${failed.join(', ')}`);
  return { viewport: innerWidth, checks };
};
