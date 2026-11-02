async () => {
  await document.fonts.ready;
  const state = await (await fetch('/api/session')).json();
  const me = await (await fetch('/api/me')).json();
  const root = document.querySelector('#journey-map');
  const destination = document.querySelector('#map-destination');
  const selected = destination.value;
  const focus = document.activeElement;
  const camera = document.querySelector('.map-camera');
  const transform = camera.style.transform;
  const nodes = [...root.querySelectorAll('.map-space, .map-actor')];
  await new Promise((resolve) => setTimeout(resolve, 1300));
  const journey = state.journey;
  const active = state.preparation.heroes.find((hero) => hero.heroId === state.round?.activeHeroId);
  const position = journey.heroes.find((hero) => hero.heroId === active?.heroId);
  const own =
    location.pathname === '/join' &&
    active?.playerId === me.player?.id &&
    state.round?.phase === 'action';
  const adjacent = journey.definition.connections.some(
    ([a, b]) =>
      (a === position?.spaceId && b === selected) || (b === position?.spaceId && a === selected),
  );
  const pending = Boolean(state.scout || state.skillTest?.status === 'converting');
  const allowed = own && !pending && journey.travel?.remaining > 0 && adjacent;
  const visible = (el) => el.getClientRects().length > 0;
  const checks = {
    mapVisible: !root.hidden && !document.querySelector('#map-view').hidden,
    realSpaces: root.querySelectorAll('.map-space').length === journey.definition.spaces.length,
    positions: journey.heroes.every((hero) =>
      [...root.querySelectorAll('.map-actor')].some(
        (actor) => actor.dataset.heroId === hero.heroId && actor.dataset.spaceId === hero.spaceId,
      ),
    ),
    stableNodes: nodes.every((node) => node.isConnected),
    stableSelection: selected === destination.value,
    stableFocus: focus === document.activeElement,
    stableCamera: transform === camera.style.transform,
    noOverflow: document.documentElement.scrollWidth <= innerWidth,
    touchTargets: [...root.querySelectorAll('button,input,select,summary')]
      .filter(visible)
      .every(
        (el) =>
          (el.type === 'checkbox' ? el.closest('label') : el).getBoundingClientRect().height >= 44,
      ),
    sharedReadOnly:
      location.pathname !== '/' ||
      (document.querySelector('#map-open-form').hidden &&
        document.querySelector('#map-personal-controls').hidden),
    movementGuard: document.querySelector('#move-hero').disabled === !allowed,
    reducedMotion:
      !matchMedia('(prefers-reduced-motion: reduce)').matches ||
      [...root.querySelectorAll('.map-actor')].every((actor) =>
        getComputedStyle(actor)
          .transitionDuration.split(',')
          .every((value) => parseFloat(value) === 0),
      ),
    imageReady: !journey.definition.image || document.querySelector('#map-image-note').hidden,
  };
  const failed = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);
  if (failed.length) throw new Error(`Viaggio: ${failed.join(', ')}`);
  return {
    width: innerWidth,
    round: state.round?.number ?? null,
    remaining: journey.travel?.remaining ?? 0,
    checks,
  };
};
