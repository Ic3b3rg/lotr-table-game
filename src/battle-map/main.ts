import { parseArgs } from 'node:util';
import { readBounded, writeNew } from '../map-io/files';
import { PHYSICAL_CONTENT_LIMITS } from '../physical-content/model';
import { compileBattleMapSource, verifyBattleMapArtifact } from './compiler';
import { battleMapCapability } from './capability';
import { pinsSchema } from './model';

const readJson = async (path: string): Promise<unknown> =>
  JSON.parse(
    new TextDecoder('utf-8', { fatal: true }).decode(
      await readBounded(path, PHYSICAL_CONTENT_LIMITS.bytes),
    ),
  ) as unknown;

try {
  const command = process.argv[2];
  const { values, tokens } = parseArgs({
    args: process.argv.slice(3),
    options: {
      input: { type: 'string' },
      output: { type: 'string' },
      artifact: { type: 'string' },
      'expect-source': { type: 'string' },
      'expect-artifact': { type: 'string' },
    },
    tokens: true,
    allowPositionals: false,
  });
  const names = tokens.filter((t) => t.kind === 'option').map((t) => t.name);
  if (new Set(names).size !== names.length) throw new Error('Duplicate options.');
  if (
    !['compile', 'verify', 'capability'].includes(command ?? '') ||
    !values.input ||
    !values.output
  )
    throw new Error(
      'Use compile|verify --input file --output new-file; capability also requires --artifact file.',
    );
  if ((command === 'capability') !== (values.artifact !== undefined))
    throw new Error('Unexpected/missing --artifact.');
  if (
    command === 'compile' &&
    (values['expect-source'] !== undefined || values['expect-artifact'] !== undefined)
  )
    throw new Error('Pins belong to verify/capability.');
  const pins = pinsSchema.parse({
    ...(values['expect-source'] === undefined
      ? {}
      : { sourceFingerprint: values['expect-source'] }),
    ...(values['expect-artifact'] === undefined
      ? {}
      : { artifactFingerprint: values['expect-artifact'] }),
  });
  const input = await readJson(values.input);
  let output: unknown, report: unknown;
  if (command === 'compile') {
    const a = compileBattleMapSource(input);
    output = a;
    report = {
      format: 'battle-map-compilation-v1',
      sourceFingerprint: a.sourceFingerprint,
      artifactFingerprint: a.artifactFingerprint,
      runtimeReady: false,
    };
  } else if (command === 'verify') {
    const a = verifyBattleMapArtifact(input, pins);
    output = {
      format: 'battle-map-verification-v1',
      sourceFingerprint: a.sourceFingerprint,
      artifactFingerprint: a.artifactFingerprint,
      selectedAlternative: a.compiled.selectedAlternative,
      runtimeReady: false,
    };
    report = output;
  } else {
    // Both CLI pins and request pins apply; neither can overwrite the other.
    const a = verifyBattleMapArtifact(await readJson(values.artifact!), pins);
    const capability = battleMapCapability(a, input);
    output = capability;
    report = capability;
    if (!capability.enabled) process.exitCode = 2;
  }
  await writeNew(values.output, `${JSON.stringify(output, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report)}\n`);
} catch (error) {
  process.stderr.write(
    `Battle map CLI: ${error instanceof Error ? error.message : 'invalid input.'}\n`,
  );
  process.exitCode = 1;
}
