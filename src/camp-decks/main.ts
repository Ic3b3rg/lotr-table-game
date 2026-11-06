import { parseArgs } from 'node:util';
import { readBounded, writeNew } from '../map-io/files';
import { PHYSICAL_CONTENT_LIMITS } from '../physical-content/model';
import { canonical } from '../map-freeze/hash';
import { bounded, fingerprint, pinsSchema } from './model';
import { campDeckCapability } from './source';
import { materializeCampDecks, verifyCampDeckArtifact } from './decks';

try {
  const command = process.argv[2];
  const { values, tokens } = parseArgs({
    args: process.argv.slice(3),
    options: {
      input: { type: 'string' },
      output: { type: 'string' },
      seed: { type: 'string' },
      'expect-source': { type: 'string' },
      'expect-realization': { type: 'string' },
      'expect-artifact': { type: 'string' },
    },
    tokens: true,
    allowPositionals: false,
  });
  const names = tokens.filter((t) => t.kind === 'option').map((t) => t.name);
  if (new Set(names).size !== names.length) throw new Error('Duplicate options.');
  if (
    !['materialize', 'verify', 'capability'].includes(command ?? '') ||
    !values.input ||
    !values.output
  )
    throw new Error(
      'Use capability|materialize|verify --input FILE --output NEW_FILE; materialize requires --seed HEX.',
    );
  if ((command === 'materialize') !== (values.seed !== undefined))
    throw new Error('Unexpected/missing --seed.');
  if (command !== 'verify' && names.some((n) => n.startsWith('expect-')))
    throw new Error('Expected pins belong to verify.');
  if (values.seed !== undefined) fingerprint.parse(values.seed);
  const pins = pinsSchema.parse({
    ...(values['expect-source'] === undefined
      ? {}
      : { sourceFingerprint: values['expect-source'] }),
    ...(values['expect-realization'] === undefined
      ? {}
      : { realizationFingerprint: values['expect-realization'] }),
    ...(values['expect-artifact'] === undefined
      ? {}
      : { artifactFingerprint: values['expect-artifact'] }),
  });
  const input: unknown = JSON.parse(
    new TextDecoder('utf-8', { fatal: true }).decode(
      await readBounded(values.input, PHYSICAL_CONTENT_LIMITS.bytes),
    ),
  );
  let output: unknown, report: unknown;
  let gated = false;
  if (command === 'materialize') {
    const result = materializeCampDecks(input, { seed: values.seed });
    output = result;
    gated = result.format === 'camp-decks-gate-v1';
    report =
      result.format === 'camp-decks-artifact-v1'
        ? {
            format: 'camp-decks-materialization-v1',
            sourceFingerprint: result.sourceFingerprint,
            realizationFingerprint: result.realizationFingerprint,
            artifactFingerprint: result.artifactFingerprint,
            runtimeReady: false,
          }
        : result;
  } else if (command === 'capability') {
    const result = campDeckCapability(input);
    output = report = result;
    gated = !result.enabled;
  } else {
    const artifact = verifyCampDeckArtifact(input, pins);
    output = report = {
      format: 'camp-decks-verification-v1',
      valid: true,
      sourceFingerprint: artifact.sourceFingerprint,
      realizationFingerprint: artifact.realizationFingerprint,
      artifactFingerprint: artifact.artifactFingerprint,
      runtimeReady: false,
      adventureStartEnabled: false,
    };
  }
  bounded(output);
  // No trailing newline: file and API canonical-byte budgets are identical.
  await writeNew(values.output, canonical(output));
  process.stdout.write(`${JSON.stringify(report)}\n`);
  if (gated) process.exitCode = 2;
} catch (error) {
  process.stderr.write(
    `Camp decks CLI: ${error instanceof Error ? error.message : 'invalid input.'}\n`,
  );
  process.exitCode = 1;
}
