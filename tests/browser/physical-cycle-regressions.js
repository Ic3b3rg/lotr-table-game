({ phase, rallyAvailable = false, decision = false }) => {
  const visible = (selector) => !!document.querySelector(selector)?.checkVisibility();
  const controls = [
    ...document.querySelectorAll('#physical-resolution input, #physical-resolution select'),
  ];
  const checks = {
    phase: document.body.dataset.phase === phase,
    rallyEntry:
      !rallyAvailable ||
      (visible('#scouting') &&
        visible('#rally-scout') &&
        !document.querySelector('#rally-scout').disabled),
    decision: !decision || visible('#physical-decision-form'),
    noGenericAck: !decision || !visible('#scenario-next'),
    guide: visible('#open-guide'),
    noOverflow: document.documentElement.scrollWidth <= innerWidth,
    labels: controls.every((c) => c.labels.length > 0),
    publicOnly: ![
      'entropy',
      'rngCursor',
      'population',
      'rawSha256',
      'cardHash',
      'originalHash',
    ].some((s) => document.querySelector('#physical-resolution').outerHTML.includes(s)),
  };
  const failed = Object.entries(checks)
    .filter(([, pass]) => !pass)
    .map(([name]) => name);
  if (failed.length) throw Error(`Ordinary physical UI: ${failed.join(', ')}`);
  return checks;
};
