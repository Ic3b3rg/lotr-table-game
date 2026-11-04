import { bindScenarioCards } from '../shared/scenario-cards';
import type {
  GroupCommand,
  ScenarioCommand,
  MapGenerationCommand,
  JourneyCommand,
  RoundCommand,
  ScoutingCommand,
  Session,
  SkillTestCommand,
  Command,
} from '../shared/protocol';
import { action } from './actions';
import { randomIntent, request, RequestError } from './api';

type GameCommand =
  | Extract<
      Command,
      {
        type:
          | 'CYCLE_INPUT'
          | 'INTERACT_SCENARIO'
          | 'EXPLORE_SCENARIO'
          | 'START_ATTACK'
          | 'COMBAT_INPUT';
      }
    >
  | ScenarioCommand
  | MapGenerationCommand
  | GroupCommand
  | JourneyCommand
  | RoundCommand
  | ScoutingCommand
  | SkillTestCommand;
type Intent<C = GameCommand> = C extends GameCommand
  ? Omit<C, 'requestId' | 'generation' | 'expectedRevision'>
  : never;

export function createGameActions(
  getSession: () => Session | null,
  sync: () => Promise<void>,
  root: HTMLElement,
  status: HTMLElement,
  error: HTMLElement,
  refreshControls?: () => void,
) {
  let pending: { signature: string; body: object } | null = null;
  return {
    clear() {
      pending = null;
    },
    async submit(intent: Intent, focusResult = false) {
      if (!getSession()) return;
      const caller = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      let completed = false;
      await action(async () => {
        const current = getSession()!;
        error.hidden = true;
        const bound = ['RESOLVE_SCOUT', 'CONVERT_FATE', 'RESOLVE_SKILL_TEST'].includes(intent.type)
          ? bindScenarioCards(
              current,
              intent as Extract<
                Intent,
                { type: 'RESOLVE_SCOUT' | 'CONVERT_FATE' | 'RESOLVE_SKILL_TEST' }
              >,
            )
          : intent;
        const signature = JSON.stringify({ ...bound, generation: current.generation });
        if (pending?.signature !== signature)
          pending = {
            signature,
            body: {
              ...bound,
              requestId: randomIntent(),
              generation: current.generation,
              expectedRevision: current.revision,
            },
          };
        const controls = [
          ...root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>(
            'input, select, button',
          ),
        ].map((control) => ({ control, disabled: control.disabled }));
        for (const { control } of controls) control.disabled = true;
        try {
          await request('/api/commands', pending.body);
          pending = null;
          await sync();
          completed = true;
        } catch (cause) {
          error.textContent =
            cause instanceof RequestError
              ? cause.message
              : 'Il PC non ha risposto. Riprova: la stessa richiesta verrà applicata una sola volta.';
          error.hidden = false;
          if (cause instanceof RequestError) {
            pending = null;
            await sync();
          }
          error.focus();
        } finally {
          for (const { control, disabled } of controls)
            if (control.isConnected) control.disabled = disabled;
          refreshControls?.();
        }
      });
      if (completed) {
        if (
          focusResult ||
          !caller?.isConnected ||
          (caller instanceof HTMLButtonElement && caller.disabled)
        )
          status.focus();
        else caller.focus({ preventScroll: true });
      }
      return completed;
    },
  };
}
