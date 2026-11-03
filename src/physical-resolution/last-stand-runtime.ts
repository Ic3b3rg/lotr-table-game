import type { PhysicalState, PhysicalSnapshot } from './model';
import type { PhysicalInput } from '../shared/physical';
import type { LastStandSnapshot } from '../shared/last-stand';
import type { LastStandArtifact } from './last-stand-program';
import { PhysicalRandom } from './random';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';
import { STAT_LABELS } from '../shared/skill-tests';

type Family = 'damage' | 'fear';
type Stat = LastStandArtifact['instructions'][number]['stat'];
type Run = PhysicalState['runs'][number];
type Host = {
  choose(
    hero: number,
    path: string,
    title: string,
    options: { id: string; label: string }[],
  ): string;
  ask(
    hero: number,
    path: string,
    title: string,
    options: { id: string; label: string }[],
  ): PhysicalInput;
  test(hero: number, stat: Stat, path: string): number;
  limits(hero: number): { damage: number; fear: number };
  upCount(hero: number, family: Family): number;
  returnCovered(hero: number, family: Family): number;
  reward(hero: number): number;
  award(hero: number, titleId: string, source: string, path: string): void;
};
export type LastStandReaction = {
  id: string;
  hero: number;
  label: string;
  available(): boolean;
  resolve(): void;
};

/** Owns selection, shared difficulty and outcome; the host owns real card zones. */
export class LastStandRuntime {
  private readonly rng: PhysicalRandom;
  constructor(
    private readonly p: Omit<PhysicalState, 'snapshot'>,
    private readonly s: PhysicalSnapshot,
    private readonly host: Host,
  ) {
    this.rng = new PhysicalRandom(digest({ stream: 'last-stand-v1', entropy: p.entropy }));
  }
  active(hero: number) {
    return !this.s.lastStand?.heroes[hero]?.defeated;
  }
  private state(): LastStandSnapshot {
    return (this.s.lastStand ??= {
      version: 1,
      algorithm: 'sha256-last-stand-counter-rejection-v1',
      heroes: this.p.heroes.map((h) => ({ heroId: h.heroId, difficulty: 1, defeated: false })),
      titles: [],
      selections: [],
      random: [],
      rngCursor: 0,
      lossDue: null,
      terminal: null,
      test: null,
    });
  }
  settle(run: Run, reactions: LastStandReaction[] = []) {
    const artifact = this.p.lastStand;
    invariant(
      artifact && run.lastStandRules?.artifactFingerprint === artifact.fingerprint,
      'Regole Ultimo Sforzo senza istruzioni congelate corrispondenti.',
    );
    const state = this.state(),
      doneReactions = new Set<string>();
    let completed = 0;
    while (true) {
      const obligations = this.p.heroes.flatMap((h, hero) =>
        this.active(hero)
          ? (['damage', 'fear'] as const).flatMap((family) =>
              this.s.areas[hero]![family].length >= this.host.limits(hero)[family]
                ? [
                    {
                      hero,
                      family,
                      id: `${hero}:${family}`,
                      label: `${h.heroId} · Ultimo Sforzo ${family === 'damage' ? 'danni' : 'paure'}`,
                    },
                  ]
                : [],
            )
          : [],
      );
      const ready = reactions.filter((r) => !doneReactions.has(r.id) && r.available());
      if (!obligations.length && !ready.length) return;
      const actor = obligations[0]?.hero ?? ready[0]!.hero;
      const choices = this.p.heroes.flatMap((h, hero) => {
        const owned = obligations.filter((o) => o.hero === hero);
        return hero !== actor && owned.length > 1
          ? [
              {
                id: `${hero}:choose-family`,
                label: `${h.heroId} · scegli questo eroe; il suo proprietario sceglierà il tipo`,
              },
            ]
          : owned.map(({ id, label }) => ({ id, label }));
      });
      let selected = this.host.choose(
        actor,
        `${run.id}/last-stand/order-${completed}`,
        'Scegli quale Ultimo Sforzo o reazione simultanea risolvere prima.',
        [...choices, ...ready].map(({ id, label }) => ({ id, label })),
      );
      const owner = obligations.find((o) => selected === `${o.hero}:choose-family`)?.hero;
      if (owner !== undefined)
        selected = this.host.choose(
          owner,
          `${run.id}/last-stand/type-${completed}`,
          'Scegli quale tipo di Ultimo Sforzo affrontare per il tuo eroe.',
          obligations.filter((o) => o.hero === owner).map(({ id, label }) => ({ id, label })),
        );
      const reaction = ready.find((r) => r.id === selected);
      if (reaction) {
        doneReactions.add(selected);
        completed++;
        reaction.resolve();
        continue;
      }
      const obligation = obligations.find((o) => o.id === selected)!;
      completed++;
      const { hero, family } = obligation;
      const population = artifact.instructions.filter((i) => i.family === family);
      const index = this.rng.index(population.length),
        instruction = population[index]!;
      const h = state.heroes[hero]!;
      const previous = state.selections.filter(
        (s) => s.runId === run.id && s.heroId === h.heroId && s.family === family,
      ).length;
      const baseId = `${run.id}/last-stand/${hero}/${family}`;
      const id = previous ? `${baseId}/${previous}` : baseId;
      state.random.push({ id, population: population.map((i) => i.id), index });
      state.rngCursor = this.rng.cursor;
      const record: LastStandSnapshot['selections'][number] = {
        id,
        runId: run.id,
        sourceFingerprint: digest({
          binding: this.p.binding,
          source: run.source,
          spatial: run.spatial,
        }),
        heroId: h.heroId,
        family,
        instructionId: instruction.id,
        instructionHash: digest(instruction),
        stat: instruction.stat,
        difficulty: h.difficulty,
        successes: null,
        forcedFailure: null,
        outcome: null,
        returned: 0,
        inspiration: 0,
        titles: [],
      };
      state.selections.push(record);
      const reveal = this.host.ask(
        hero,
        `${id}/reveal`,
        `Ultimo Sforzo · ${STAT_LABELS[instruction.stat]} · difficoltà ${record.difficulty}. Rivela e risolvi le carte della prova.`,
        [{ id: 'reveal', label: 'Rivela le carte della prova' }],
      );
      invariant(
        reveal.kind === 'physical-choice' && reveal.option === 'reveal',
        'La prova richiede le vere rivelazioni.',
      );
      record.successes = this.host.test(hero, instruction.stat, `${id}/test`);
      const limits = this.host.limits(hero);
      record.forcedFailure = (['damage', 'fear'] as const).some(
        (f) => this.host.upCount(hero, f) >= limits[f],
      );
      record.outcome =
        !record.forcedFailure && record.successes >= record.difficulty ? 'pass' : 'fail';
      if (record.outcome === 'pass') {
        record.returned = this.host.returnCovered(hero, family);
        record.inspiration = this.host.reward(hero);
        h.difficulty++;
        for (const [n, award] of artifact.awards.entries()) {
          const eligible =
            award.condition === 'only-active-hero'
              ? state.heroes.filter((h) => !h.defeated).length === 1
              : record.difficulty >= award.minimum!;
          if (eligible && !state.titles.some((t) => t.cardId === award.titleId)) {
            this.host.award(hero, award.titleId, id, `${id}/award-${n}`);
            record.titles.push(award.titleId);
          }
        }
      } else {
        h.defeated = true;
        const loss = {
          runId: run.id,
          heroId: h.heroId,
          instructionHash: digest(artifact.outcomes.defeat),
        };
        state.lossDue ??= loss;
        if (state.heroes.every((h) => h.defeated)) {
          state.terminal = {
            ...loss,
            kind: 'adventure-loss',
            timing: 'no-active-heroes',
            consumer: 'original-adventure-loss-unavailable',
          };
          return;
        }
      }
    }
  }
}
