import { z } from 'zod';
import { IntentIdSchema, PlayerSchema, SessionSchema } from '../shared/protocol';
import { CatalogSchema } from '../shared/catalog';

const PrivatePlayerSchema = PlayerSchema.extend({
  recoveryHash: z.string().regex(/^[a-f0-9]{64}$/),
  requestId: IntentIdSchema,
});
const BaseStateSchema = SessionSchema.omit({ catalog: true }).extend({
  content: CatalogSchema.nullable(),
  players: z.array(PrivatePlayerSchema).max(5),
});
export const StateSchema = BaseStateSchema.superRefine((state, ctx) => {
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

const LegacyStateSchema = BaseStateSchema.omit({ content: true }).extend({
  schemaVersion: z.literal(1),
});
export function parseState(raw: unknown): State {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const version = 'schemaVersion' in raw ? raw.schemaVersion : 1;
    if (version === 1) {
      const previous = LegacyStateSchema.parse({ ...raw, schemaVersion: 1 });
      return StateSchema.parse({ ...previous, schemaVersion: 2, content: null });
    }
  }
  return StateSchema.parse(raw);
}
