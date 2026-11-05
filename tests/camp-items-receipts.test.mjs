import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { buildSync } from 'esbuild';
import { readyScenario, startScenario } from './scenario-helper.mjs';
import { readBackup, signBackup } from './skill-test-helper.mjs';
const code = buildSync({
  stdin: {
    contents:
      "export {ReceiptSchema} from './src/shared/protocol'; export {BackupSchema} from './src/server/backup-format';export {scenarioReceiptProblem} from './src/scenario/validate';",
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
const item = {
  heroId: 'invented-hero',
  copy: 'invented-before:1',
  upgrade: 'invented-after:1',
  fromModelId: 41,
  toModelId: 42,
  fromRank: 1,
  toRank: 2,
  threshold: 3,
  lore: 3,
};
const skill = {
  heroId: 'invented-hero',
  roleId: 'invented-role',
  copy: 'invented-skill:1',
  operation: 'buy',
  cost: 2,
  before: 6,
  after: 4,
};

test('item summaries bind bidirectionally to scenario input type and camp-item kind without weakening financial summaries', () => {
  const good = {
    requestId: randomUUID(),
    type: 'SCENARIO_INPUT',
    appliedRevision: 2,
    scenarioId: randomUUID(),
    pendingId: randomUUID(),
    source: 'invented-source',
    kind: 'camp-item',
    phase: 'action',
    item,
  };
  assert.deepEqual(ReceiptSchema.parse(good), good);
  for (const bad of [
    { ...good, type: 'START_SCENARIO', kind: 'start' },
    { ...good, type: 'START_SCENARIO' },
    { ...good, type: 'INTERACT_SCENARIO' },
    { ...good, kind: 'ack' },
    { ...good, item: undefined },
    { ...good, skill },
    { ...good, kind: 'camp-skill', skill },
    { ...good, item: undefined, kind: 'camp-skill' },
    { ...good, item: undefined, kind: 'ack', skill },
  ])
    assert.equal(ReceiptSchema.safeParse(bad).success, false, JSON.stringify(bad));
  const financial = { ...good, kind: 'camp-skill', skill };
  delete financial.item;
  assert.deepEqual(ReceiptSchema.parse(financial), financial);
});

test('re-signed startup exports in every supported schema reject item summaries and forged upgrade kinds before migration', async (t) => {
  const r = await readyScenario(t);
  assert.equal((await startScenario(r.host, r.player)).status, 200);
  const original = await readBackup(r.host);
  for (let schemaVersion = 10; schemaVersion <= 28; schemaVersion++)
    for (const forgeKind of [false, true]) {
      const b = structuredClone(original);
      b.payload.state.schemaVersion = schemaVersion;
      if (schemaVersion === 10) delete b.payload.state.physical;
      signBackup(b);
      assert.equal(BackupSchema.safeParse(b).success, true, `unaltered ${schemaVersion}`);
      const start = b.payload.commands.find((c) => c.receipt.type === 'START_SCENARIO');
      start.receipt.item = structuredClone(item);
      if (forgeKind) {
        start.receipt.type = 'SCENARIO_INPUT';
        start.receipt.kind = 'camp-item';
        start.receipt.phase = 'action';
        start.receipt.pendingId = randomUUID();
        const record = b.payload.state.scenario.commands.find(
          (c) => c.requestId === start.requestId,
        );
        record.kind = 'camp-item';
        record.pendingId = start.receipt.pendingId;
      }
      signBackup(b);
      assert.equal(
        BackupSchema.safeParse(b).success,
        false,
        `forged ${schemaVersion}/${forgeKind}`,
      );
    }
  assert.deepEqual((await readBackup(r.host)).payload, original.payload);
});

test('the original pre-seed receipt validator rejects an otherwise matching fabricated item transaction', async (t) => {
  const r = await readyScenario(t);
  assert.equal((await startScenario(r.host, r.player)).status, 200);
  const { state, commands } = (await readBackup(r.host)).payload;
  const entry = commands.find((c) => c.receipt.type === 'START_SCENARIO'),
    record = state.scenario.commands.find((c) => c.requestId === entry.requestId);
  entry.receipt = {
    ...entry.receipt,
    type: 'SCENARIO_INPUT',
    kind: 'camp-item',
    phase: 'action',
    pendingId: randomUUID(),
    item,
  };
  record.kind = 'camp-item';
  record.pendingId = entry.receipt.pendingId;
  assert.equal(ReceiptSchema.safeParse(entry.receipt).success, true);
  assert.notEqual(scenarioReceiptProblem(state, commands), null);
});
