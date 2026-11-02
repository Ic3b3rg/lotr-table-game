() => {
  const checks = [...document.querySelectorAll('#map-viewport .map-space')].map((button) => {
    const rect = button.getBoundingClientRect();
    const x = rect.x + rect.width / 2;
    const y = rect.y + rect.height / 2;
    const target = document.elementFromPoint(x, y)?.closest('.map-space');
    return {
      space: button.dataset.spaceId,
      onScreen: x >= 0 && x <= innerWidth && y >= 0 && y <= innerHeight,
      hit: target?.dataset.spaceId === button.dataset.spaceId,
    };
  });
  if (!checks.length || checks.some((check) => !check.onScreen || !check.hit))
    throw new Error(`Bersagli della mappa: ${JSON.stringify(checks)}`);
  return checks;
};
