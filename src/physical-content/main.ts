import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { readBounded, writeNew } from '../map-io/files';
import { inspectPhysicalContent, PHYSICAL_CONTENT_LIMITS } from './catalog';

try {
  const { values, tokens } = parseArgs({
    options: { input: { type: 'string' }, output: { type: 'string' } },
    tokens: true,
    allowPositionals: false,
  });
  const names = tokens.filter((token) => token.kind === 'option').map((token) => token.name);
  if (new Set(names).size !== names.length) throw new Error('Opzioni duplicate.');
  if (!values.input || !values.output) throw new Error('Usare --input file --output nuovo-file.');
  const bytes = await readBounded(values.input, PHYSICAL_CONTENT_LIMITS.bytes);
  const json = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const result = inspectPhysicalContent(JSON.parse(json));
  await writeNew(
    values.output,
    `${JSON.stringify(
      {
        ...result,
        inputFileFingerprint: createHash('sha256').update(bytes).digest('hex'),
      },
      null,
      2,
    )}\n`,
  );
  if (result.status === 'diagnostic') process.exitCode = 2;
} catch (error) {
  process.stderr.write(
    `Catalogo fisico: ${error instanceof Error ? error.message : 'input non valido.'}\n`,
  );
  process.exitCode = 1;
}
