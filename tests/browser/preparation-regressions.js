// Real-browser acceptance probes, not part of the Node HTTP suite.
// Load as a classic script in DevTools. For stale tests use catalogFixture(),
// one recovered participant owning hero-1 and hero-2 in a draft company.
// Reload the page between rejectStalePreparation(false) and (true).
// These call the real host; run only against a disposable test data directory.

async function rejectStalePreparation(
  confirmCompany = false,
  heroNumber = 1,
  requireVisibleRecovery = false,
) {
  const role = document.querySelector(`[aria-label="Ruolo di Eroe ${heroNumber}"]`);
  const hand = document.querySelector(`[aria-label="Prima mano / arma di Eroe ${heroNumber}"]`);
  if (!role || !hand) throw new Error('Form missing');
  let form;
  if (confirmCompany) {
    form = document.querySelector('.prepare-company');
    const check = form.querySelector('input');
    check.focus();
    check.click();
  } else {
    role.closest('details').open = true;
    hand.value = heroNumber === 1 ? 'bow:1' : 'shield:1';
    hand.dispatchEvent(new Event('change', { bubbles: true }));
    form = role.form;
  }
  const observed = new Promise((resolve) => {
    const timer = setTimeout(() => {
      watcher.disconnect();
      resolve(false);
    }, 4000);
    const watcher = new MutationObserver(() => {
      watcher.disconnect();
      clearTimeout(timer);
      resolve(true);
    });
    watcher.observe(document.querySelector('#players'), { childList: true });
  });
  const before = await (await fetch('/api/session')).json();
  const heroId = `hero-${heroNumber}`;
  const original = before.preparation.heroes.find((h) => h.heroId === heroId);
  const targetRole = ['role-6', 'role-5', 'role-4'].find(
    (id) => !before.preparation.heroes.some((h) => h.roleId === id),
  );
  const mutation = await fetch('/api/commands', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'CONFIGURE_HERO',
      heroId,
      roleId: targetRole,
      itemCopies: original.itemCopies,
      requestId: crypto.randomUUID(),
      generation: before.generation,
      expectedRevision: before.revision,
    }),
  });
  if (mutation.status !== 200) throw new Error('Competing change failed');
  if (!(await observed)) throw new Error('Polling did not update');
  let resolveStatus;
  const responseStatus = new Promise((resolve) => {
    resolveStatus = resolve;
  });
  const native = window.fetch;
  window.fetch = async (...args) => {
    const response = await native(...args);
    if (args[0] === '/api/commands') resolveStatus(response.status);
    return response;
  };
  try {
    form.querySelector('button[type="submit"]').scrollIntoView({ block: 'center' });
    form.requestSubmit();
    const status = await responseStatus;
    const after = await (await native('/api/session')).json();
    const hero = after.preparation.heroes.find((h) => h.heroId === heroId);
    if (status !== 409 || hero.roleId !== targetRole || after.preparation.status !== 'draft')
      throw new Error(`Stale form overwrote current choice: status=${status}, role=${hero.roleId}`);
    for (let frame = 0; frame < 120; frame++) {
      if (!document.querySelector('.company-error').hidden) break;
      await new Promise(requestAnimationFrame);
    }
    await new Promise(requestAnimationFrame);
    const error = document.querySelector('.company-error');
    const recovery = [...document.querySelectorAll('#company-preparation button')].find(
      (button) => button.textContent === 'Ricarica le scelte',
    );
    const bounds = error.getBoundingClientRect();
    const recoveryBounds = recovery.getBoundingClientRect();
    const feedback = {
      top: bounds.top,
      bottom: bounds.bottom,
      recoveryBottom: recoveryBounds.bottom,
      viewportHeight: innerHeight,
      focused: document.activeElement === error,
      inputPreserved: confirmCompany || hand.value === (heroNumber === 1 ? 'bow:1' : 'shield:1'),
    };
    if (
      requireVisibleRecovery &&
      (bounds.top < 0 ||
        recoveryBounds.bottom > innerHeight ||
        !feedback.focused ||
        !feedback.inputPreserved)
    )
      throw new Error(`Recovery is not visible and focused: ${JSON.stringify(feedback)}`);
    return {
      status,
      role: hero.roleId,
      equipment: hero.itemCopies,
      staleFormRejected: true,
      companyStillDraft: after.preparation.status === 'draft',
      feedback,
    };
  } finally {
    window.fetch = native;
  }
}

function restoreNestedCardFocus() {
  const caller = document.querySelector('.company-hero .company-link');
  caller.click();
  document.querySelector('#card-reader .physical-card').click();
  document.querySelector('#close-card').click();
  if (document.activeElement !== caller)
    throw new Error('Nested card lost the original focus target');
  return { nestedFocusRestored: true };
}
