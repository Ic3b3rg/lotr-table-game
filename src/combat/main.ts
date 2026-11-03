import { parseArgs } from 'node:util';
import { readBounded, writeNew } from '../map-io/files';
import { PHYSICAL_CONTENT_LIMITS } from '../physical-content/model';
import { compileCombatSource, verifyCombatArtifact } from './compiler';
import { restoreCombatKernel } from './kernel';
import { combatCapability } from './capability';
import { runTechnicalCombat } from './technical-run';

const readJson = async (path: string) =>
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
    },
    tokens: true,
    allowPositionals: false,
  });
  const names = tokens.filter((t) => t.kind === 'option').map((t) => t.name);
  if (new Set(names).size !== names.length) throw new Error('Opzioni duplicate.');
  if (
    !['compile', 'verify', 'run', 'replay', 'capability'].includes(command ?? '') ||
    !values.input ||
    !values.output
  )
    throw new Error(
      'Usare compile|verify|run|replay|capability --input file --output nuovo-file; run/capability richiedono --artifact file.',
    );
  const needsArtifact = command === 'run' || command === 'capability';
  if (needsArtifact !== !!values.artifact)
    throw new Error('Opzione --artifact non corrispondente al comando.');
  const input = await readJson(values.input);
  let output: unknown;
  let report: unknown;
  switch (command) {
    case 'compile': {
      const a = compileCombatSource(input);
      output = a;
      report = { artifactFingerprint: a.fingerprint, coverage: a.compiled.coverage };
      break;
    }
    case 'verify': {
      const a = verifyCombatArtifact(input);
      output = {
        format: 'combat-verification-v1',
        artifactFingerprint: a.fingerprint,
        sourceFingerprint: a.sourceFingerprint,
        projectionFingerprint: a.projectionFingerprint,
        coverage: a.compiled.coverage,
        instructions: a.compiled.instructions.length,
        items: a.compiled.items.length,
        slots: a.compiled.items.reduce((n, i) => n + i.slots.length, 0),
        runtimeReady: false,
      };
      report = output;
      break;
    }
    case 'run': {
      const result = runTechnicalCombat(await readJson(values.artifact!), input);
      output = result.checkpoint;
      report = result.report;
      if (result.report.gates.length) process.exitCode = 2;
      break;
    }
    case 'replay': {
      const kernel = restoreCombatKernel(input);
      output = kernel.checkpoint();
      report = {
        evidence: 'checkpoint-replay',
        gameplayAcceptance: false,
        artifactFingerprint: kernel.checkpoint().artifactFingerprint,
      };
      break;
    }
    case 'capability': {
      const capability = combatCapability(await readJson(values.artifact!), input);
      output = capability;
      report = capability;
      if (!capability.enabled) process.exitCode = 2;
      break;
    }
  }
  await writeNew(values.output, `${JSON.stringify(output, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report)}\n`);
} catch (error) {
  process.stderr.write(
    `Nucleo combattimento: ${error instanceof Error ? error.message : 'input non valido.'}\n`,
  );
  process.exitCode = 1;
}
