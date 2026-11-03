import { createHash } from 'node:crypto';
import { frontFixture, hash } from './physical-fronts.mjs';
export const textHash = (text) => createHash('sha256').update(text).digest('hex');
export function inventedLastStand(raw) {
  const source = { sourceId: 'invented-last-stand', locator: 'Fixture!instructions' };
  const message = (text) => ({ text, textSha256: textHash(text), source });
  const titles = raw.cards.filter((c) => c.family === 'title').slice(0, 2);
  return {
    version: 1,
    rules: 'source-last-stand-v1',
    sources: [{ id: source.sourceId, sha256: 'a'.repeat(64) }],
    instructions: ['damage', 'fear'].flatMap((family) =>
      Array.from({ length: 5 }, (_, i) => ({
        id: `invented-${family}-instruction-${i}`,
        family,
        model: { ...source, sha256: 'b'.repeat(64) },
        stat: family === 'damage' ? 'might' : 'spirit',
        ...message(`Istruzione inventata ${family} ${i}: prova {0}.`),
      })),
    ),
    outcomes: {
      damage: message(
        'Esito inventato danni: restituisci le coperte del tipo e ottieni ispirazione.',
      ),
      fear: message(
        'Esito inventato paure: restituisci le coperte del tipo e ottieni ispirazione.',
      ),
      defeat: message('Esito inventato: sconfitto; perdita all’inizio Ombra o senza superstiti.'),
    },
    awards: [
      { condition: 'only-active-hero', minimum: null, titleId: titles[0].id, source },
      { condition: 'tested-difficulty-at-least', minimum: 3, titleId: titles[1].id, source },
    ],
    titles: titles.map((c, i) => ({
      cardId: c.id,
      cardHash: hash(c),
      source: c.text.original?.reference ?? c.text.evidence[0],
      effects:
        i === 0
          ? [
              {
                op: 'last-stand-success',
                n: 2,
                cost: 'remove-from-adventure',
                target: 'self-or-nearby',
              },
            ]
          : [{ op: 'rest', n: 2, after: { op: 'remove-and-gain-boon', boon: 'determined' } }],
    })),
  };
}
export function lastStandFixture() {
  const f = frontFixture();
  for (const c of f.catalog.skills) {
    c.success = 1;
    c.fate = 0;
  }
  return { ...f, lastStandInput: inventedLastStand(f.raw) };
}
