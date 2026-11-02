import { contentAsset } from './content-assets';
import { readFileSync, statSync } from 'node:fs';
import { CatalogSchema, type Catalog } from '../shared/catalog';

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
  if (!catalog) return null;
  const allowed = [
    ...catalog.heroes.map((hero) => hero.portrait),
    ...catalog.items.map((item) => item.image),
  ];
  return contentAsset(name, allowed, packPath);
}
