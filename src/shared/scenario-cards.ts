import type { Session, ScenarioCommand, ScoutingCommand, SkillTestCommand } from './protocol';
type Input<C> = C extends unknown
  ? Omit<C, 'requestId' | 'generation' | 'expectedRevision'>
  : never;
type CardIntent = Input<ScoutingCommand | SkillTestCommand>;
export function bindScenarioCards(
  session: Pick<Session, 'scenario'>,
  intent: CardIntent,
): CardIntent | Input<ScenarioCommand> {
  const sc = session.scenario,
    q = sc?.pending;
  if (!sc || sc.phase !== 'setup' || !q) return intent;
  let input: Extract<ScenarioCommand, { type: 'SCENARIO_INPUT' }>['input'];
  if (intent.type === 'RESOLVE_SCOUT') {
    const { type, scoutId, ...choices } = intent;
    input = { kind: 'scout-resolve', ...choices };
  } else if (intent.type === 'CONVERT_FATE') input = { kind: 'convert' };
  else if (intent.type === 'RESOLVE_SKILL_TEST') input = { kind: 'test-resolve' };
  else return intent;
  return {
    type: 'SCENARIO_INPUT',
    scenarioId: sc.id,
    packFingerprint: sc.packFingerprint,
    projectionFingerprint: sc.projectionFingerprint,
    pendingId: q.id,
    sourceFingerprint: q.fingerprint,
    heroId: q.heroId,
    input,
  };
}
