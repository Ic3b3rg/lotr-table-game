import { mkdir, writeFile, copyFile, readFile, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

export async function itemEvidence(name, value, closedDataDir) {
  if (!process.env.LOTR_CAMP_ITEMS_EVIDENCE_DIR) return;
  const dir = resolve(process.env.LOTR_CAMP_ITEMS_EVIDENCE_DIR);
  await mkdir(dir, { recursive: true });
  const databases = [];
  if (closedDataDir) {
    const target = join(dir, name + '-closed-db');
    await mkdir(target, { recursive: true });
    for (const file of ['session.sqlite', 'session.sqlite-wal', 'session.sqlite-shm']) {
      const from = join(closedDataDir, file),
        to = join(target, file);
      try {
        await access(from);
      } catch (e) {
        if (e.code === 'ENOENT') continue;
        throw e;
      }
      const bytes = await readFile(from),
        sha256 = createHash('sha256').update(bytes).digest('hex');
      await copyFile(from, to);
      const copy = await readFile(to);
      if (
        copy.length !== bytes.length ||
        createHash('sha256').update(copy).digest('hex') !== sha256
      )
        throw Error('Closed database copy differs');
      databases.push({ path: to, bytes: copy.length, sha256 });
    }
  }
  await writeFile(join(dir, name + '.json'), JSON.stringify({ ...value, databases }), {
    flag: 'wx',
  });
}
