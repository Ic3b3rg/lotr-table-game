import { scenarioStateProblem } from '../scenario/validate';
import { ScenarioSchema } from '../shared/scenario';
import { PhysicalStateSchema } from '../physical-resolution/model';
import { z } from 'zod';
import { CombatStateSchema } from '../shared/combat-controller';
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
  scenario: true,
  catalog: true,
  combat: true,
  preparation: true,
  skillTest: true,
  scout: true,
  round: true,
  encounterFingerprints: true,
  explorationFingerprints: true,
}).extend({
  scenario: ScenarioSchema.nullable().default(null),
  content: CatalogSchema.nullable(),
  combat: CombatStateSchema.optional(),
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
function hasBaseProductForms(raw: object) {
  type ScenarioForms = {
    pack?: {
      manifest?: { baseProducts?: unknown };
      definitions?: { states?: { actions?: { op?: string; sprint?: unknown }[] }[] }[];
    };
    pending?: { kind?: string };
    tasks?: { kind?: string }[];
    explorations?: { attempts?: { sprintOrigin?: unknown }[] };
  };
  type CombatForms = {
    operation?: { origin?: { kind?: string } };
    operations?: { origin?: { kind?: string } }[];
  };
  const old = raw as {
    scenario?: ScenarioForms;
    combat?: CombatForms;
    physical?: {
      cycle?: {
        seed?: { scenario?: ScenarioForms; combat?: CombatForms };
        records?: { intent?: { input?: { kind?: string } } }[];
      };
    };
  };
  // Variable dictionaries and event names are data, even when they share these names.
  return (
    [old.scenario, old.physical?.cycle?.seed?.scenario].some(
      (sc) =>
        sc?.pack?.manifest?.baseProducts !== undefined ||
        sc?.pack?.definitions?.some((d) =>
          d.states?.some((s) =>
            s.actions?.some(
              (a) => a.op === 'ownsProducts' || (a.op === 'message' && a.sprint !== undefined),
            ),
          ),
        ) ||
        sc?.pending?.kind === 'sprint' ||
        sc?.tasks?.some((t) => t.kind === 'sprint') ||
        sc?.explorations?.attempts?.some((a) => a.sprintOrigin !== undefined),
    ) ||
    [old.combat, old.physical?.cycle?.seed?.combat].some(
      (combat) =>
        combat?.operation?.origin?.kind === 'source-sprint' ||
        combat?.operations?.some((op) => op.origin?.kind === 'source-sprint'),
    ) ||
    old.physical?.cycle?.records?.some((r) => r.intent?.input?.kind === 'source-sprint')
  );
}
function hasItemForms(raw: object) {
  type ScenarioForms = {
    pack?: {
      manifest?: { items?: unknown };
      definitions?: {
        states?: { actions?: { op?: string; program?: { children?: { kind?: string }[] } }[] }[];
      }[];
    };
    conclusion?: { campaign?: { inventory?: unknown } };
  };
  type PhysicalForms = {
    fronts?: { artifact?: { policies?: { effects?: { op?: string }[] }[] } };
    snapshot?: { resolution?: { resources?: { itemCustody?: unknown } } };
    runs?: { context?: { itemCustody?: unknown }; program?: { children?: { kind?: string }[] } }[];
  };
  const old = raw as {
    scenario?: ScenarioForms;
    physical?: PhysicalForms & {
      cycle?: { seed?: { scenario?: ScenarioForms; physical?: PhysicalForms } };
    };
  };
  const seed = old.physical?.cycle?.seed;
  return (
    [old.scenario, seed?.scenario].some(
      (sc) =>
        sc?.pack?.manifest?.items !== undefined ||
        sc?.conclusion?.campaign?.inventory !== undefined ||
        sc?.pack?.definitions?.some((d) =>
          d.states?.some((s) =>
            s.actions?.some(
              (a) =>
                a.op === 'addItem' ||
                a.op === 'modalWait' ||
                a.program?.children?.some((c) => c.kind === 'scenario-item'),
            ),
          ),
        ),
    ) ||
    [old.physical, seed?.physical].some(
      (p) =>
        p?.snapshot?.resolution?.resources?.itemCustody !== undefined ||
        p?.runs?.some(
          (r) =>
            r.context?.itemCustody !== undefined ||
            r.program?.children?.some((c) => c.kind === 'scenario-item'),
        ) ||
        p?.fronts?.artifact?.policies?.some((p) =>
          p.effects?.some((e) => e.op === 'fear-facedown-only'),
        ),
    )
  );
}
function hasFirstCombatForms(raw: object) {
  type Program = { children?: { kind?: string }[] };
  type ScenarioForms = {
    firstCombat?: unknown;
    effects?: { op?: string }[];
    pack?: {
      manifest?: { firstCombat?: unknown };
      definitions?: {
        states?: { actions?: { op?: string; boon?: unknown; program?: Program }[] }[];
      }[];
    };
    pending?: { kind?: string };
    tasks?: { kind?: string }[];
    enemies?: { groups?: { removed?: unknown }[] };
  };
  type PhysicalForms = {
    runs?: { program?: Program }[];
    snapshot?: { parents?: { results?: { kind?: string }[] }[] };
  };
  const old = raw as {
    scenario?: ScenarioForms;
    physical?: PhysicalForms & {
      cycle?: { seed?: { scenario?: ScenarioForms; physical?: PhysicalForms } };
    };
  };
  const seed = old.physical?.cycle?.seed;
  const program = (p: Program | undefined) => p?.children?.some((c) => c.kind === 'source-boon');
  return (
    [old.scenario, seed?.scenario].some(
      (sc) =>
        sc?.firstCombat !== undefined ||
        sc?.pack?.manifest?.firstCombat !== undefined ||
        sc?.pending?.kind === 'source-attack' ||
        sc?.tasks?.some((t) => t.kind === 'spawnFixed') ||
        sc?.effects?.some((e) => e.op === 'spawnFixed' || e.op === 'removeEnemies') ||
        sc?.enemies?.groups?.some((g) => g.removed !== undefined) ||
        sc?.pack?.definitions?.some((d) =>
          d.states?.some((s) =>
            s.actions?.some(
              (a) =>
                a.op === 'spawnFixed' ||
                a.op === 'removeEnemies' ||
                (a.op === 'message' && a.boon !== undefined) ||
                program(a.program),
            ),
          ),
        ),
    ) ||
    [old.physical, seed?.physical].some(
      (p) =>
        p?.runs?.some((r) => program(r.program)) ||
        p?.snapshot?.parents?.some((p) => p.results?.some((r) => r.kind === 'source-boon')),
    )
  );
}
export function parseState(raw: unknown): State {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const version = 'schemaVersion' in raw ? raw.schemaVersion : 1;
    if (typeof version === 'number' && version <= 23 && hasFirstCombatForms(raw))
      throw new Error('Forme del primo scontro non valide per uno schema storico.');
    if (version === 23) {
      const previous = BaseStateSchema.extend({ schemaVersion: z.literal(23) }).parse(raw);
      return StateSchema.parse({ ...previous, schemaVersion: 24 });
    }
    if (typeof version === 'number' && version <= 22 && hasItemForms(raw))
      throw new Error('Oggetti e inventario non validi per uno schema storico.');
    if (version === 22) {
      const previous = BaseStateSchema.extend({ schemaVersion: z.literal(22) }).parse(raw);
      return StateSchema.parse({ ...previous, schemaVersion: 24 });
    }
    if (typeof version === 'number' && version <= 21 && hasBaseProductForms(raw))
      throw new Error('Prodotti base e Scatto non validi per uno schema storico.');
    if (version === 21) {
      const previous = BaseStateSchema.extend({ schemaVersion: z.literal(21) }).parse(raw);
      return StateSchema.parse({ ...previous, schemaVersion: 24 });
    }
    if (typeof version === 'number' && version <= 20) {
      type OldScenario = {
        pack?: {
          manifest?: { linked?: unknown };
          definitions?: {
            states?: {
              actions?: {
                op?: string;
                options?: { cost?: unknown; requirement?: unknown }[];
              }[];
            }[];
          }[];
        };
        pending?: { kind?: string };
        play?: { attempts?: { entryChoice?: unknown }[] };
      };
      const old = raw as {
        scenario?: OldScenario;
        physical?: {
          runs?: { program?: { children?: { kind?: string }[] } }[];
          cycle?: {
            records?: { intent?: { choiceEvent?: unknown; input?: { kind?: string } } }[];
            seed?: {
              scenario?: OldScenario;
              combat?: {
                operation?: { origin?: { choiceEvent?: unknown } };
                operations?: { origin?: { choiceEvent?: unknown } }[];
              };
            };
          };
        };
        combat?: {
          operation?: { origin?: { choiceEvent?: unknown } };
          operations?: { origin?: { choiceEvent?: unknown } }[];
        };
      };
      for (const sc of [old.scenario, old.physical?.cycle?.seed?.scenario])
        if (
          sc?.pack?.manifest?.linked !== undefined ||
          sc?.pending?.kind === 'hero-choice' ||
          sc?.play?.attempts?.some((a) => a.entryChoice !== undefined) ||
          sc?.pack?.definitions?.some((d) =>
            d.states?.some((s) =>
              s.actions?.some(
                (a) =>
                  a.op === 'chooseHero' ||
                  a.op === 'awardTitle' ||
                  (a.op === 'choice' &&
                    a.options?.some((o) => o.cost !== undefined || o.requirement !== undefined)),
              ),
            ),
          )
        )
          throw new Error('Incontri collegati e titolo non validi per uno schema storico.');
      if (
        old.physical?.runs?.some((r) =>
          r.program?.children?.some((c) => c.kind === 'scenario-title'),
        )
      )
        throw new Error('Titolo scenario non valido per uno schema storico.');
      if (
        old.physical?.cycle?.records?.some(
          (r) => r.intent?.choiceEvent !== undefined || r.intent?.input?.kind === 'choose-hero',
        )
      )
        throw new Error('Intento collegato non valido per uno schema storico.');
      for (const combat of [old.combat, old.physical?.cycle?.seed?.combat])
        if (
          combat?.operation?.origin?.choiceEvent !== undefined ||
          combat?.operations?.some((o) => o.origin?.choiceEvent !== undefined)
        )
          throw new Error('Provocazione collegata non valida per uno schema storico.');
    }
    if (version === 20) {
      const previous = BaseStateSchema.extend({ schemaVersion: z.literal(20) }).parse(raw);
      return StateSchema.parse({ ...previous, schemaVersion: 24 });
    }
    if (typeof version === 'number' && version <= 19) {
      type OldScenario = {
        pack?: {
          manifest?: { lair?: unknown };
          definitions?: { states?: { actions?: { op?: string }[] }[] }[];
        };
        conclusion?: {
          outcome?: string;
          version?: string;
          timing?: string;
          cause?: { kind?: string };
        };
      };
      const old = raw as {
        scenario?: OldScenario;
        physical?: { cycle?: { seed?: { scenario?: OldScenario } } };
      };
      for (const sc of [old.scenario, old.physical?.cycle?.seed?.scenario])
        if (
          sc?.pack?.manifest?.lair !== undefined ||
          sc?.conclusion?.outcome === 'victory' ||
          sc?.conclusion?.version === 'source-lair-victory-v1' ||
          sc?.conclusion?.timing === 'source-end' ||
          sc?.conclusion?.cause?.kind === 'source-victory' ||
          sc?.pack?.definitions?.some((d) =>
            d.states?.some((s) => s.actions?.some((a) => a.op === 'endGame')),
          )
        )
          throw new Error('Covo e vittoria non validi per uno schema storico.');
    }
    if (version === 19) {
      const previous = BaseStateSchema.extend({ schemaVersion: z.literal(19) }).parse(raw);
      return StateSchema.parse({ ...previous, schemaVersion: 24 });
    }
    if (typeof version === 'number' && version <= 18) {
      type OldScenario = { pack?: { manifest?: { liveGroups?: unknown } } };
      const old = raw as {
        scenario?: OldScenario;
        physical?: {
          runs?: { program?: { groupRules?: unknown } }[];
          cycle?: { seed?: { scenario?: OldScenario } };
        };
      };
      if (
        old.scenario?.pack?.manifest?.liveGroups !== undefined ||
        old.physical?.cycle?.seed?.scenario?.pack?.manifest?.liveGroups !== undefined ||
        old.physical?.runs?.some((r) => r.program?.groupRules !== undefined)
      )
        throw new Error('Gruppi attivi non validi per uno schema storico.');
    }
    if (version === 18) {
      const previous = BaseStateSchema.extend({ schemaVersion: z.literal(18) }).parse(raw);
      return StateSchema.parse({ ...previous, schemaVersion: 24 });
    }

    if (typeof version === 'number' && version <= 17) {
      const old = raw as {
        physical?: { runs?: { program?: { children?: { kind?: string }[] } }[] };
        scenario?: {
          pack?: { manifest?: { threatContinuations?: unknown } };
          conclusion?: { cause?: { kind?: string }; timing?: string };
          rounds?: { frames: { stage?: string; threatRequestId?: string }[] };
        };
      };
      if (
        old.physical?.runs?.some((r) =>
          r.program?.children?.some((c) => c.kind === 'group-suffer'),
        ) ||
        old.scenario?.pack?.manifest?.threatContinuations ||
        old.scenario?.conclusion?.cause?.kind === 'threat' ||
        old.scenario?.rounds?.frames.some((f) => f.stage === 'conclusion' || f.threatRequestId)
      )
        throw new Error('Continuazioni di minaccia non valide per uno schema storico.');
    }
    if (version === 17) {
      const previous = BaseStateSchema.extend({ schemaVersion: z.literal(17) }).parse(raw);
      return StateSchema.parse({ ...previous, schemaVersion: 24 });
    }
    if (typeof version === 'number' && version <= 16) {
      const old = raw as {
        physical?: { boons?: unknown };
        scenario?: { pack?: { manifest?: { boons?: unknown } } };
      };
      if (old.physical?.boons || old.scenario?.pack?.manifest?.boons)
        throw new Error('Regole benefici non valide per uno schema storico.');
    }
    if (version === 16) {
      const previous = BaseStateSchema.extend({ schemaVersion: z.literal(16) }).parse(raw);
      return StateSchema.parse({ ...previous, schemaVersion: 24 });
    }
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
    if (typeof version === 'number' && version <= 15) {
      const previous = raw as {
        scenario?: { pack?: { manifest?: { failure?: unknown } }; conclusion?: unknown } | null;
      };
      if (previous.scenario?.pack?.manifest?.failure || previous.scenario?.conclusion)
        throw new Error('Conclusione non valida per uno schema storico.');
    }
    if (version === 15) {
      const previous = BaseStateSchema.extend({ schemaVersion: z.literal(15) }).parse(raw);
      return StateSchema.parse({ ...previous, schemaVersion: 24 });
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
      return StateSchema.parse({ ...previous, schemaVersion: 24 });
    }
    if (version === 13) {
      const previous = HistoricalBaseStateSchema.extend({ schemaVersion: z.literal(13) }).parse(
        raw,
      );
      return StateSchema.parse({ ...previous, schemaVersion: 24 });
    }
    if (version === 12) {
      const previous = HistoricalBaseStateSchema.extend({ schemaVersion: z.literal(12) }).parse(
        raw,
      );
      if (previous.physical?.version === 3 || previous.physical?.cycle)
        throw new Error('Ledger ordinario non valido per schema12.');
      return StateSchema.parse({ ...previous, schemaVersion: 24 });
    }
    if (version === 11) {
      const legacy = HistoricalBaseStateSchema.extend({ schemaVersion: z.literal(11) }).parse(raw);
      if (legacy.physical && legacy.physical.version !== 1)
        throw new Error('Runtime fronti non valido per schema11.');
      return StateSchema.parse({ ...legacy, schemaVersion: 24 });
    }
    if (version === 10)
      return StateSchema.parse({
        ...VersionTenStateSchema.parse(raw),
        schemaVersion: 24,
        physical: null,
      });
    if (version === 9)
      return StateSchema.parse({
        ...VersionNineStateSchema.parse(raw),
        schemaVersion: 24,
        scenario: null,
      });
    if (version === 8)
      return StateSchema.parse({
        ...VersionEightStateSchema.parse(raw),
        schemaVersion: 24,
        scenario: null,
        mapGeneration: null,
      });
    if (version === 7)
      return StateSchema.parse({
        ...VersionSevenStateSchema.parse(raw),
        schemaVersion: 24,
        scenario: null,
        mapGeneration: null,
      });
    if (version === 6) {
      return StateSchema.parse({
        ...VersionSixStateSchema.parse(raw),
        schemaVersion: 24,
        scenario: null,
        mapGeneration: null,
        group: null,
      });
    }
    if (version === 5) {
      const previous = VersionFiveStateSchema.parse(raw);
      return StateSchema.parse({
        ...previous,
        schemaVersion: 24,
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
        schemaVersion: 24,
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
        schemaVersion: 24,
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
        schemaVersion: 24,
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
        schemaVersion: 24,
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
