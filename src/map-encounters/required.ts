import { EncounterState } from './state';
import { firstFit, firstPending, remember, rollback, tryCollection } from './placement';

export function seedRequired(s: EncounterState): void {
  s.stage = 'required-section';
  for (const section of s.input.placement.sections) {
    s.sectionCursor = section.index;
    if (section.sectionEncounterSources === null) continue;
    s.clearSearch(true);
    const sources = section.sectionEncounterSources;
    while (
      !sources.every((source) =>
        s.spaces.some(
          (v) => v.sectionId === section.index && v.encounterId === s.models.get(source)!.id,
        ),
      )
    ) {
      s.tick('section-iteration');
      const space = tryCollection(s, sources, section.index, {
        stage: s.stage,
        sectionId: section.index,
        groupSource: null,
      });
      if (space) remember(s, space);
      else if (s.history.length) rollback(s);
      else s.fail('section-requirement');
    }
  }
  s.stage = 'required-adventure';
  s.sectionCursor = null;
  const sources = s.input.placement.adventureEncounterSources;
  if (sources === null) return;
  s.clearSearch(true);
  while (!sources.every((source) => s.has(s.models.get(source)!.id))) {
    s.tick('adventure-iteration');
    const source = firstPending(s, sources);
    // The coroutine repeats its completion check if every ID is invalid.
    if (source === null) {
      s.emit('adventure-no-candidate', {});
      continue;
    }
    s.emit('set-candidate', { modelSource: source });
    const space = firstFit(s, source, { stage: s.stage, sectionId: null, groupSource: null });
    if (space) remember(s, space);
    else if (s.history.length) rollback(s);
    else s.fail('adventure-requirement');
  }
}
