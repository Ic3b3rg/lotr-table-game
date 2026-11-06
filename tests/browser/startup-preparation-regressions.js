async () => {
  const s = await (await fetch('/api/session')).json();
  const q = s.scenario?.pending,
    root = document.querySelector('#physical-resolution');
  if (!s.scenario?.pack.manifest.startupPreparation || q?.kind !== 'physical')
    throw Error('An attested startup decision is required.');
  const visible = (e) => !!e && e.checkVisibility();
  const checks = {
    startupGuidance: document.querySelector('#scenario-status').textContent.includes('avvio'),
    noGenericAck: !visible(document.querySelector('#scenario-next')),
    guideAvailable: visible(document.querySelector('#open-guide')),
    noOverflow: document.documentElement.scrollWidth <= innerWidth,
    labelledControls: [...root.querySelectorAll('select,input')].every((e) => e.labels.length > 0),
    noFreeProgram: !root.querySelector('textarea,input[type=number]'),
    noPrivateState:
      ![
        'entropy',
        'rngCursor',
        'population',
        'rawSha256',
        'cardHash',
        'originalHash',
        'invented-fear-',
      ].some((key) => JSON.stringify(s.physical).includes(key)) &&
      !['entropy', 'rngCursor', 'population', 'originalHash', 'invented-fear-'].some((key) =>
        JSON.stringify(s).includes(key),
      ),
    noCancelEffect: ![...root.querySelectorAll('button')].some((b) =>
      /annulla|salta/i.test(b.textContent),
    ),
    savedParent: s.scenario.tasks.some(
      (t) => t.kind === 'startup' && t.parentId === q.physical.parentId,
    ),
  };
  const failed = Object.entries(checks)
    .filter(([, pass]) => !pass)
    .map(([key]) => key);
  if (failed.length) throw Error(`Startup UI: ${failed.join(', ')}`);
  return { viewport: innerWidth, checks };
};
