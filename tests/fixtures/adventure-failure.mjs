// Invented models, narrative, amounts and bindings. Never original acceptance.
import { state, text, action } from './scenario.mjs';
import { native } from './clue-progression.mjs';
import { hash } from './map-freeze.mjs';
import { catalogFixture } from './catalog.mjs';
export function attachFailure(pack) {
  const d = pack.definitions.find((d) => d.source === pack.principal);
  pack.globals.push({ name: 'inventedWon', type: 'bool', value: true });
  d.handlers.EXAMPLE_FAILURE = 70;
  d.states.push(
    state(
      70,
      [
        action(0, 'message', {
          mode: 'ordinary',
          text: text('Conclusione inventata'),
          ignoreLog: false,
        }),
      ],
      { FINISHED: 71 },
    ),
    state(
      71,
      [
        action(0, 'message', { mode: 'ordinary', text: text('Premi inventati'), ignoreLog: false }),
        action(1, 'set', { target: { scope: 'global', name: 'inventedWon' }, value: false }),
        native(2, 'awardXP', 'FFG.JIME.Actions.AwardXP', { amount: 7 }),
        native(3, 'lore', 'FFG.JIME.Actions.AddLore', { amount: 5 }),
      ],
      { FINISHED: 72 },
    ),
    state(
      72,
      [
        native(0, 'nextAdventure', 'FFG.JIME.Actions.SetNextAdventure', {
          source: 'example.assets:980',
          id: 42,
        }),
        native(1, 'proceed', 'FFG.JIME.Actions.ProceedToNextGame', {}),
      ],
      { FINISHED: 73 },
    ),
    state(73, [action(0, 'stop')]),
  );
  pack.manifest.failure = {
    version: 'source-adventure-failure-v1',
    event: 'EXAMPLE_FAILURE',
    evidenceHash: hash('invented failure evidence'),
    methods: Object.fromEntries(
      ['signal', 'next', 'proceed', 'reset', 'loader', 'map', 'camp', 'xp'].map((k) => [
        k,
        { assemblyHash: hash('assembly'), method: '06009999', bodyHash: hash(k) },
      ]),
    ),
    next: {
      source: 'example.assets:980',
      id: 42,
      modelHash: hash('model'),
      type: 'battle',
      name: text('Destinazione inventata'),
      location: text('Luogo inventato'),
      story: text('Racconto inventato'),
      restArea: 0,
    },
    partyBonus: {
      requiredSkillId: 888,
      amount: 2,
      text: text('Bonus inventato'),
      skills: catalogFixture().skills.map((s, n) => ({ cardId: s.id, modelId: n + 1 })),
    },
  };
  return pack.manifest.failure;
}
