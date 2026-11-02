import { open, mkdtemp, link, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
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
  const file = await open(path, 'r');
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > 1024 * 1024)
      throw new Error('Il pacchetto deve essere un file di massimo 1 MB.');
    const buffer = Buffer.alloc(1024 * 1024 + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await file.read(buffer, length, buffer.length - length, length);
      if (bytesRead === 0) break;
      length += bytesRead;
    }
    if (length > 1024 * 1024) throw new Error('Il pacchetto supera 1 MB.');
    return GeometryPackSchema.parse(JSON.parse(buffer.subarray(0, length).toString('utf8')));
  } finally {
    await file.close();
  }
}
async function writeNew(path: string, json: string): Promise<void> {
  const temporary = await mkdtemp(join(dirname(path), '.lotr-geometry-'));
  try {
    const staged = join(temporary, 'result.json');
    const file = await open(staged, 'wx', 0o600);
    try {
      await file.writeFile(json);
      await file.sync();
    } finally {
      await file.close();
    }
    // A same-filesystem hard link publishes the complete file exclusively.
    await link(staged, path);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
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
