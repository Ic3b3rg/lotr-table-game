import { open, mkdtemp, link, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/** Bound both the initial stat and the actual read, including files that grow. */
export async function readBounded(path: string, limit: number): Promise<Buffer> {
  const file = await open(path, 'r');
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > limit)
      throw new Error(`Il pacchetto deve essere un file di massimo ${limit} byte.`);
    const buffer = Buffer.alloc(limit + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await file.read(buffer, length, buffer.length - length, length);
      if (bytesRead === 0) break;
      length += bytesRead;
    }
    if (length > limit) throw new Error(`Il pacchetto supera il massimo di ${limit} byte.`);
    return buffer.subarray(0, length);
  } finally {
    await file.close();
  }
}

export async function writeNew(path: string, json: string): Promise<void> {
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
