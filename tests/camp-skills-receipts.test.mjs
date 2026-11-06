import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { buildSync } from 'esbuild';
import { readyScenario, startScenario } from './scenario-helper.mjs';
import { readBackup, signBackup } from './skill-test-helper.mjs';

const code = buildSync({
  stdin: {
    contents: `export {ReceiptSchema} from './src/shared/protocol';
      export {BackupSchema} from './src/server/backup-format';
      export {scenarioReceiptProblem} from './src/scenario/validate';`,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { ReceiptSchema, BackupSchema, scenarioReceiptProblem } = await import(
  'data:text/javascript;base64,' + Buffer.from(code.outputFiles[0].contents).toString('base64')
);

const skill = {
  heroId: 'invented-hero',
  roleId: 'invented-role',
  copy: 'invented-upgrade:1',
  operation: 'buy',
  cost: 2,
  before: 6,
  after: 4,
};

test('only an actual camp-skill scenario input receipt can carry its required financial summary', () => {
  const valid = {
    requestId: randomUUID(),
    appliedRevision: 2,
    type: 'SCENARIO_INPUT',
    scenarioId: randomUUID(),
    pendingId: randomUUID(),
    source: 'invented-source',
    kind: 'camp-skill',
    phase: 'action',
    skill,
  };
  assert.deepEqual(ReceiptSchema.parse(valid), valid);
  for (const invalid of [
    { ...valid, type: 'START_SCENARIO', kind: 'start' },
    { ...valid, type: 'START_SCENARIO' },
    { ...valid, type: 'INTERACT_SCENARIO' },
    { ...valid, kind: 'ack' },
    { ...valid, skill: undefined },
  ])
    assert.equal(ReceiptSchema.safeParse(invalid).success, false, JSON.stringify(invalid));
});

test('resigned historical and current startup backups reject financial summaries unrelated to a camp transaction', async (t) => {
  const r = await readyScenario(t);
  assert.equal((await startScenario(r.host, r.player)).status, 200);
  const original = await readBackup(r.host);
  for (let version = 10; version <= 28; version++) {
    const historical = structuredClone(original);
    historical.payload.state.schemaVersion = version;
    if (version === 10) delete historical.payload.state.physical;
    signBackup(historical);
    assert.equal(BackupSchema.safeParse(historical).success, true, `unmodified schema${version}`);
    const start = historical.payload.commands.find((c) => c.receipt.type === 'START_SCENARIO');
    assert.ok(start);
    start.receipt.skill = structuredClone(skill);
    signBackup(historical);
    assert.equal(
      BackupSchema.safeParse(historical).success,
      false,
      `forged financial summary in schema${version}`,
    );
  }
  const after = await readBackup(r.host);
  assert.deepEqual(after.payload, original.payload);
  assert.equal(after.checksum, original.checksum);
  assert.equal(after.format, original.format);
  assert.equal(after.formatVersion, original.formatVersion);
  assert.ok(Date.parse(after.exportedAt) >= Date.parse(original.exportedAt));
});

test('startup receipt validation rejects a forged camp transaction even when its metadata matches', async (t) => {
  const r = await readyScenario(t);
  assert.equal((await startScenario(r.host, r.player)).status, 200);
  const { state, commands } = (await readBackup(r.host)).payload;
  const entry = commands.find((c) => c.receipt.type === 'START_SCENARIO'),
    record = state.scenario.commands.find((c) => c.requestId === entry.requestId);
  entry.receipt = {
    ...entry.receipt,
    type: 'SCENARIO_INPUT',
    kind: 'camp-skill',
    phase: 'action',
    pendingId: randomUUID(),
    skill,
  };
  record.kind = 'camp-skill';
  record.pendingId = entry.receipt.pendingId;
  assert.equal(ReceiptSchema.safeParse(entry.receipt).success, true);
  assert.notEqual(scenarioReceiptProblem(state, commands), null);
});
