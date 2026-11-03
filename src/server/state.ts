import { scenarioStateProblem } from '../scenario/validate';
import { PhysicalStateSchema } from '../physical-resolution/model';
import { z } from 'zod';
import { IntentIdSchema, PlayerSchema, SessionSchema } from '../shared/protocol';
import { CatalogSchema } from '../shared/catalog';
import { PreparationSchema, PreparedHeroSchema, preparationProblem } from '../shared/preparation';
import { SkillTestSchema, skillTestProblem } from '../shared/skill-tests';
import { ScoutingSchema, scoutingProblem } from '../shared/scouting';
import { physicalTitleSkills } from '../physical-resolution/title-skills';
import { RoundSchema, roundProblem } from '../shared/rounds';
import { journeyProblem } from '../shared/journey-map';
import { groupProblem } from '../shared/group';
import { generationStateProblem } from './generation-state';

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
  physical: PhysicalStateSchema.nullable().default(null),
});
export const StateSchema = BaseStateSchema.superRefine((state, ctx) => {
  const scenarioError = scenarioStateProblem(state);
  if (scenarioError) ctx.addIssue({ code: 'custom', message: scenarioError });
  const generationError = generationStateProblem(state);
  if (generationError) ctx.addIssue({ code: 'custom', message: generationError });
  const groupError = groupProblem(state.group, state.players.length, state.preparation);
  if (groupError) ctx.addIssue({ code: 'custom', message: groupError });
  if (state.group && state.round && !state.journey)
    ctx.addIssue({
      code: 'custom',
      message: 'Un gruppo configurato richiede la mappa prima dei round.',
    });
  if (state.preparation) {
    const problem = state.content
      ? preparationProblem(
          state.content,
          state.players.map((player) => player.id),
          state.preparation,
          state.skillTest,
          state.scout,
          state.physical && state.physical.version !== 1
            ? {
                held: state.physical.snapshot.resolution!.revealed,
                titles: state.physical.snapshot.lastStand?.titles ?? [],
              }
            : undefined,
        )
      : 'Catalogo della compagnia assente.';
    if (problem) ctx.addIssue({ code: 'custom', message: problem });
  }
  const testProblem = skillTestProblem(
    state.content,
    state.preparation,
    state.skillTest,
    state.scout,
    state.physical?.snapshot.resolution?.revealed,
    physicalTitleSkills(state.physical),
  );
  if (testProblem) ctx.addIssue({ code: 'custom', message: testProblem });
  const scoutProblem = scoutingProblem(state.content, state.preparation, state.scout);
  if (scoutProblem) ctx.addIssue({ code: 'custom', message: scoutProblem });
  const roundError = roundProblem(
    state.round,
    state.preparation,
    state.skillTest,
    state.scout,
    state.journey,
  );
  if (roundError) ctx.addIssue({ code: 'custom', message: roundError });
  const journeyError = journeyProblem(state.journey, state.preparation, state.round);
  if (journeyError) ctx.addIssue({ code: 'custom', message: journeyError });
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

const HistoricalBaseStateSchema = BaseStateSchema.extend({
  skillTest: SkillTestSchema.extend({ availableCount: z.int().min(1).max(15) }).nullable(),
});
const VersionTenStateSchema = HistoricalBaseStateSchema.omit({ physical: true }).extend({
  schemaVersion: z.literal(10),
});
const VersionNineStateSchema = HistoricalBaseStateSchema.omit({
  scenario: true,
  physical: true,
}).extend({
  schemaVersion: z.literal(9),
});
const PreviousStateSchema = HistoricalBaseStateSchema.omit({
  mapGeneration: true,
  scenario: true,
  physical: true,
});
const VersionEightStateSchema = PreviousStateSchema.extend({ schemaVersion: z.literal(8) });
const LegacyStateSchema = PreviousStateSchema.omit({
  content: true,
  preparation: true,
  skillTest: true,
  scout: true,
  round: true,
  journey: true,
  group: true,
}).extend({
  schemaVersion: z.literal(1),
});
const VersionTwoStateSchema = PreviousStateSchema.omit({
  skillTest: true,
  scout: true,
  round: true,
  journey: true,
  group: true,
}).extend({
  schemaVersion: z.literal(2),
  preparation: PreparationSchema.extend({
    heroes: z.array(PreparedHeroSchema.omit({ inspiration: true })).max(5),
  })
    .nullable()
    .default(null),
});
const VersionThreeStateSchema = PreviousStateSchema.omit({
  scout: true,
  round: true,
  journey: true,
  group: true,
}).extend({
  schemaVersion: z.literal(3),
  skillTest: SkillTestSchema.omit({ availableCount: true }).nullable(),
});
const VersionFourStateSchema = PreviousStateSchema.omit({
  round: true,
  journey: true,
  group: true,
}).extend({
  schemaVersion: z.literal(4),
  scout: ScoutingSchema.omit({ roundId: true }).nullable(),
});
const VersionFiveStateSchema = PreviousStateSchema.omit({ journey: true, group: true }).extend({
  schemaVersion: z.literal(5),
});
const VersionSixStateSchema = PreviousStateSchema.omit({ group: true }).extend({
  schemaVersion: z.literal(6),
});
const VersionSevenStateSchema = PreviousStateSchema.extend({ schemaVersion: z.literal(7) });
export function parseState(raw: unknown): State {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const version = 'schemaVersion' in raw ? raw.schemaVersion : 1;
    if (typeof version === 'number' && version <= 13) {
      const physical = 'physical' in raw ? raw.physical : null;
      if (
        physical &&
        typeof physical === 'object' &&
        ('lastStand' in physical ||
          ('snapshot' in physical &&
            physical.snapshot &&
            typeof physical.snapshot === 'object' &&
            'lastStand' in physical.snapshot))
      )
        throw new Error('Regole Ultimo Sforzo non valide per uno schema storico.');
    }
    if (typeof version === 'number' && version <= 14) {
      const old = raw as Record<string, unknown>;
      const sc = old.scenario as {
        pack?: { manifest?: { scope?: string } };
        play?: unknown;
      } | null;
      const physical = old.physical as { cycle?: { version?: number } } | null;
      if (
        sc?.pack?.manifest?.scope === 'original-encounter-v1' ||
        sc?.play ||
        physical?.cycle?.version === 2
      )
        throw new Error('Consumer originale non valido per uno schema storico.');
    }
    if (version === 14) {
      const previous = BaseStateSchema.extend({ schemaVersion: z.literal(14) }).parse(raw);
      return StateSchema.parse({ ...previous, schemaVersion: 15 });
    }
    if (version === 13) {
      const previous = HistoricalBaseStateSchema.extend({ schemaVersion: z.literal(13) }).parse(
        raw,
      );
      return StateSchema.parse({ ...previous, schemaVersion: 15 });
    }
    if (version === 12) {
      const previous = HistoricalBaseStateSchema.extend({ schemaVersion: z.literal(12) }).parse(
        raw,
      );
      if (previous.physical?.version === 3 || previous.physical?.cycle)
        throw new Error('Ledger ordinario non valido per schema12.');
      return StateSchema.parse({ ...previous, schemaVersion: 15 });
    }
    if (version === 11) {
      const legacy = HistoricalBaseStateSchema.extend({ schemaVersion: z.literal(11) }).parse(raw);
      if (legacy.physical && legacy.physical.version !== 1)
        throw new Error('Runtime fronti non valido per schema11.');
      return StateSchema.parse({ ...legacy, schemaVersion: 15 });
    }
    if (version === 10)
      return StateSchema.parse({
        ...VersionTenStateSchema.parse(raw),
        schemaVersion: 15,
        physical: null,
      });
    if (version === 9)
      return StateSchema.parse({
        ...VersionNineStateSchema.parse(raw),
        schemaVersion: 15,
        scenario: null,
      });
    if (version === 8)
      return StateSchema.parse({
        ...VersionEightStateSchema.parse(raw),
        schemaVersion: 15,
        scenario: null,
        mapGeneration: null,
      });
    if (version === 7)
      return StateSchema.parse({
        ...VersionSevenStateSchema.parse(raw),
        schemaVersion: 15,
        scenario: null,
        mapGeneration: null,
      });
    if (version === 6) {
      return StateSchema.parse({
        ...VersionSixStateSchema.parse(raw),
        schemaVersion: 15,
        scenario: null,
        mapGeneration: null,
        group: null,
      });
    }
    if (version === 5) {
      const previous = VersionFiveStateSchema.parse(raw);
      return StateSchema.parse({
        ...previous,
        schemaVersion: 15,
        scenario: null,
        mapGeneration: null,
        group: null,
        journey: null,
      });
    }
    if (version === 1) {
      const previous = LegacyStateSchema.parse({ ...raw, schemaVersion: 1 });
      return StateSchema.parse({
        ...previous,
        schemaVersion: 15,
        scenario: null,
        mapGeneration: null,
        group: null,
        journey: null,
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
        schemaVersion: 15,
        scenario: null,
        mapGeneration: null,
        group: null,
        journey: null,
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
        schemaVersion: 15,
        scenario: null,
        mapGeneration: null,
        group: null,
        journey: null,
        scout: null,
        round: null,
        skillTest: previous.skillTest ? { ...previous.skillTest, availableCount: 14 } : null,
      });
    }
    if (version === 4) {
      const previous = VersionFourStateSchema.parse(raw);
      return StateSchema.parse({
        ...previous,
        schemaVersion: 15,
        scenario: null,
        mapGeneration: null,
        group: null,
        journey: null,
        round: null,
        scout: previous.scout ? { ...previous.scout, roundId: null } : null,
      });
    }
  }
  return StateSchema.parse(raw);
}
