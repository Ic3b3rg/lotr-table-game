import { readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { AssetNameSchema } from '../shared/catalog';

export function contentAsset(
  name: string,
  allowed: (string | undefined)[],
  packPath: string,
): Buffer | null {
  if (!AssetNameSchema.safeParse(name).success || !allowed.includes(name)) return null;
  try {
    const directory = realpathSync(join(dirname(resolve(packPath)), 'assets'));
    const path = realpathSync(join(directory, name));
    if (dirname(path) !== directory || statSync(path).size > 2_000_000) return null;
    const data = readFileSync(path);
    return data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? data : null;
  } catch {
    return null;
  }
}
