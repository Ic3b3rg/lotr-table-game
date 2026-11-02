import { readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { AssetNameSchema, CatalogSchema, type Catalog } from '../shared/catalog';

export function loadCatalog(path: string): Catalog {
  try {
    if (statSync(path).size > 2_000_000) throw new Error('Pacchetto troppo grande.');
    return CatalogSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
  } catch (cause) {
    throw new Error(
      'Catalogo locale non valido: controlla il pacchetto prima di avviare il tavolo.',
      { cause },
    );
  }
}
export function catalogAsset(
  catalog: Catalog | null,
  name: string,
  packPath: string,
): Buffer | null {
  if (!catalog || !AssetNameSchema.safeParse(name).success) return null;
  const allowed = [
    ...catalog.heroes.map((hero) => hero.portrait),
    ...catalog.items.map((item) => item.image),
  ];
  if (!allowed.includes(name)) return null;
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
