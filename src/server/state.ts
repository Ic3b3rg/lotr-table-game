import { z } from 'zod';
import { IntentIdSchema, PlayerSchema, SessionSchema } from '../shared/protocol';
import { CatalogSchema } from '../shared/catalog';
import { PreparationSchema, PreparedHeroSchema, preparationProblem } from '../shared/preparation';
import { SkillTestSchema, skillTestProblem } from '../shared/skill-tests';
import { ScoutingSchema, scoutingProblem } from '../shared/scouting';
import { RoundSchema, roundProblem } from '../shared/rounds';

const PrivatePlayerSchema = PlayerSchema.extend({
  recoveryHash: z.string().regex(/^[a-f0-9]{64}$/),
  requestId: IntentIdSchema,
});
const BaseStateSchema = SessionSchema.omit({
  catalog: true,
  preparation: true,
  skillTest: true,
  scout: true,
  round: true,
}).extend({
  content: CatalogSchema.nullable(),
  preparation: PreparationSchema.nullable().default(null),
  skillTest: SkillTestSchema.nullable(),
  scout: ScoutingSchema.nullable(),
  round: RoundSchema.nullable(),
  players: z.array(PrivatePlayerSchema).max(5),
});
export const StateSchema = BaseStateSchema.superRefine((state, ctx) => {
  if (state.preparation) {
    const problem = state.content
      ? preparationProblem(
          state.content,
          state.players.map((player) => player.id),
          state.preparation,
          state.skillTest,
          state.scout,
        )
      : 'Catalogo della compagnia assente.';
    if (problem) ctx.addIssue({ code: 'custom', message: problem });
  }
  const testProblem = skillTestProblem(
    state.content,
    state.preparation,
    state.skillTest,
    state.scout,
  );
  if (testProblem) ctx.addIssue({ code: 'custom', message: testProblem });
  const scoutProblem = scoutingProblem(state.content, state.preparation, state.scout);
  if (scoutProblem) ctx.addIssue({ code: 'custom', message: scoutProblem });
  const roundError = roundProblem(state.round, state.preparation, state.skillTest, state.scout);
  if (roundError) ctx.addIssue({ code: 'custom', message: roundError });
  if (state.scout && state.skillTest?.status === 'converting')
    ctx.addIssue({
      code: 'custom',
      message: 'Prova e Scoperta non possono essere aperte insieme.',
    });
  for (const key of ['id', 'recoveryHash', 'requestId'] as const) {
    if (new Set(state.players.map((player) => player[key])).size !== state.players.length)
      ctx.addIssue({ code: 'custom', message: 'Identità duplicate nel salvataggio.' });
  }
  if (state.demo) {
    const valid =
      state.demo.choice === null
        ? state.demo.resolvedBy === null
        : state.players.some((player) => player.id === state.demo?.resolvedBy);
    if (!valid)
      ctx.addIssue({ code: 'custom', message: 'Esito o partecipante della prova non valido.' });
  }
});
export type State = z.infer<typeof StateSchema>;

const LegacyStateSchema = BaseStateSchema.omit({
  content: true,
  preparation: true,
  skillTest: true,
  scout: true,
  round: true,
}).extend({
  schemaVersion: z.literal(1),
});
const VersionTwoStateSchema = BaseStateSchema.omit({
  skillTest: true,
  scout: true,
  round: true,
}).extend({
  schemaVersion: z.literal(2),
  preparation: PreparationSchema.extend({
    heroes: z.array(PreparedHeroSchema.omit({ inspiration: true })).max(5),
  })
    .nullable()
    .default(null),
});
const VersionThreeStateSchema = BaseStateSchema.omit({ scout: true, round: true }).extend({
  schemaVersion: z.literal(3),
  skillTest: SkillTestSchema.omit({ availableCount: true }).nullable(),
});
const VersionFourStateSchema = BaseStateSchema.omit({ round: true }).extend({
  schemaVersion: z.literal(4),
  scout: ScoutingSchema.omit({ roundId: true }).nullable(),
});
export function parseState(raw: unknown): State {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const version = 'schemaVersion' in raw ? raw.schemaVersion : 1;
    if (version === 1) {
      const previous = LegacyStateSchema.parse({ ...raw, schemaVersion: 1 });
      return StateSchema.parse({
        ...previous,
        schemaVersion: 5,
        content: null,
        skillTest: null,
        scout: null,
        round: null,
      });
    }
    if (version === 2) {
      const previous = VersionTwoStateSchema.parse(raw);
      return StateSchema.parse({
        ...previous,
        schemaVersion: 5,
        skillTest: null,
        scout: null,
        round: null,
        preparation: previous.preparation
          ? {
              ...previous.preparation,
              heroes: previous.preparation.heroes.map((hero) => ({ ...hero, inspiration: 0 })),
            }
          : null,
      });
    }
    if (version === 3) {
      const previous = VersionThreeStateSchema.parse(raw);
      return StateSchema.parse({
        ...previous,
        schemaVersion: 5,
        scout: null,
        round: null,
        skillTest: previous.skillTest ? { ...previous.skillTest, availableCount: 14 } : null,
      });
    }
    if (version === 4) {
      const previous = VersionFourStateSchema.parse(raw);
      return StateSchema.parse({
        ...previous,
        schemaVersion: 5,
        round: null,
        scout: previous.scout ? { ...previous.scout, roundId: null } : null,
      });
    }
  }
  return StateSchema.parse(raw);
}
