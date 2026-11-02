import { readBounded, writeNew } from '../map-io/files';
import { parseArgs } from 'node:util';
import { GeometryPackSchema } from './model';
import { composeGeometry, enumerateAttachments } from './geometry';

function integer(value: string | undefined, label: string): number {
  if (
    value === undefined ||
    !/^(0|[1-9][0-9]*)$/.test(value) ||
    !Number.isSafeInteger(Number(value))
  )
    throw new Error(`${label}: indicare un intero non negativo.`);
  return Number(value);
}
async function readPack(path: string) {
  return GeometryPackSchema.parse(
    JSON.parse((await readBounded(path, 1024 * 1024)).toString('utf8')),
  );
}

try {
  const { values, tokens } = parseArgs({
    options: {
      input: { type: 'string' },
      rotation: { type: 'string' },
      list: { type: 'boolean' },
      placement: { type: 'string' },
      output: { type: 'string' },
    },
    tokens: true,
    allowPositionals: false,
  });
  const names = tokens.filter((token) => token.kind === 'option').map((token) => token.name);
  if (new Set(names).size !== names.length) throw new Error('Opzioni duplicate.');
  if (
    !values.input ||
    (values.list === true) === (values.placement !== undefined) ||
    (values.list && values.output !== undefined)
  )
    throw new Error(
      'Usare --input file --rotation 0..5 con --list oppure --placement indice [--output file].',
    );
  const rotation = integer(values.rotation, 'Rotazione');
  const pack = await readPack(values.input);
  const result = values.list
    ? { scope: 'geometry-only', candidates: enumerateAttachments(pack, rotation) }
    : composeGeometry(pack, rotation, integer(values.placement, 'Giunzione'));
  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (values.output !== undefined) await writeNew(values.output, json);
  else process.stdout.write(json);
} catch (error) {
  const message = error instanceof Error ? error.message : 'Compilazione non riuscita.';
  process.stderr.write(`Mappa: ${message}\n`);
  process.exitCode = 1;
}
