import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { readBounded, writeNew } from '../map-io/files';
import { placeMapEncounters } from './encounters';
try {
  const { values, tokens } = parseArgs({
    options: { input: { type: 'string' }, output: { type: 'string' } },
    tokens: true,
    allowPositionals: false,
  });
  const names = tokens.filter((t) => t.kind === 'option').map((t) => t.name);
  if (new Set(names).size !== names.length) throw new Error('Opzioni duplicate.');
  if (!values.input || !values.output) throw new Error('Usare --input file --output nuovo-file.');
  const bytes = await readBounded(values.input, 64 * 1024 * 1024);
  let result;
  try {
    result = placeMapEncounters(JSON.parse(bytes.toString('utf8')));
  } catch (error) {
    throw new Error(`Input: ${error instanceof Error ? error.message : 'non valido'}`);
  }
  await writeNew(
    values.output,
    `${JSON.stringify({ ...result, inputFileFingerprint: createHash('sha256').update(bytes).digest('hex') }, null, 2)}\n`,
  );
  if (result.status !== 'encounters-complete') process.exitCode = 2;
} catch (error) {
  process.stderr.write(`Incontri: ${error instanceof Error ? error.message : 'non riuscito.'}\n`);
  process.exitCode = 1;
}
