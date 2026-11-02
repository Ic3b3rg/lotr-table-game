import { z } from 'zod';
import type { Preparation } from './preparation';

export const GroupSchema = z.strictObject({ expectedPlayers: z.int().min(1).max(5) });
export type Group = z.infer<typeof GroupSchema>;

export function groupProblem(
  group: Group | null,
  players: number,
  preparation: Preparation | null,
): string | null {
  if (!group) return null;
  if (
    players > group.expectedPlayers ||
    (preparation?.status === 'prepared' && players !== group.expectedPlayers)
  )
    return 'Il numero di giocatori non corrisponde al gruppo concordato.';
  if (
    group.expectedPlayers > 1 &&
    preparation?.heroes.some(
      (hero) => preparation.heroes.filter((other) => other.playerId === hero.playerId).length > 1,
    )
  )
    return 'Un gruppo deve assegnare un solo eroe a ogni giocatore.';
  return null;
}
