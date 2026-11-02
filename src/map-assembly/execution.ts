import { performance } from 'node:perf_hooks';
import type { AssemblyInput, ClockContext, ClockObservation } from './model';
import { InputError } from './model';

export class AssemblyStop extends Error {
  constructor(
    readonly kind: 'source-failure' | 'source-operation-exception' | 'administrative-stop',
    readonly reason: string,
    message: string,
    readonly sourceErrorCode: number | null = null,
  ) {
    super(message);
  }
}
export type TraceEvent = {
  stage: string;
  operation: string;
  samples: number;
  ordinal: number;
  [key: string]: unknown;
};
export type Observe = {
  tick: (site: string) => void;
  emit: (operation: string, details: Record<string, unknown>) => void;
};

/** Poll sites are an explicit port policy; no claim to Unity frame scheduling. */
export class SearchClock {
  readonly observations: ClockObservation[] = [];
  private readonly start = performance.now();
  private elapsed = 0;
  constructor(
    private policy: AssemblyInput['execution']['clock'],
    private limit: number,
  ) {}
  observe(context: ClockContext): number {
    if (this.observations.length >= this.limit)
      throw new AssemblyStop(
        'administrative-stop',
        'clock-trace-budget',
        'Budget della traccia clock esaurito.',
      );
    const ordinal = this.observations.length;
    let elapsedMilliseconds: number;
    if (this.policy.policy === 'replay-clock-v1') {
      const row = this.policy.observations[ordinal];
      if (
        !row ||
        row.ordinal !== ordinal ||
        Object.entries(context).some(([k, v]) => row[k as keyof ClockContext] !== v) ||
        row.elapsedMilliseconds < this.elapsed ||
        row.timeout !== row.elapsedMilliseconds > this.policy.timeoutMilliseconds
      )
        throw new InputError(`Input: replay clock non coerente al cursore ${ordinal}.`);
      elapsedMilliseconds = row.elapsedMilliseconds;
    } else
      elapsedMilliseconds =
        this.policy.policy === 'logical-clock-v1'
          ? ordinal * this.policy.stepMilliseconds
          : performance.now() - this.start;
    if (!Number.isFinite(elapsedMilliseconds) || elapsedMilliseconds > 86400000)
      throw new AssemblyStop(
        'administrative-stop',
        'clock-range',
        'Intervallo clock amministrativo esaurito.',
      );
    const timeout = elapsedMilliseconds > this.policy.timeoutMilliseconds;
    this.observations.push({ ...context, ordinal, elapsedMilliseconds, timeout });
    this.elapsed = elapsedMilliseconds;
    if (timeout)
      throw new AssemblyStop(
        'administrative-stop',
        'clock-budget',
        'Budget temporale osservato dal clock del port.',
      );
    return elapsedMilliseconds;
  }
  finish(): void {
    if (
      this.policy.policy === 'replay-clock-v1' &&
      this.observations.length !== this.policy.observations.length
    )
      throw new InputError('Input: replay clock con osservazioni residue.');
  }
  get cursor(): number {
    return this.observations.length;
  }
}
