import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

export async function campEvidence(name, value) {
  if (!process.env.LOTR_CAMP_EVIDENCE_DIR) return;
  const dir = resolve(process.env.LOTR_CAMP_EVIDENCE_DIR);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name + '.json'), JSON.stringify(value), { flag: 'wx' });
}
