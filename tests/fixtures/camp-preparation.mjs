// All cards, sources, bindings and method records are invented before startup.
import { campItemCompilation, campItemCatalog } from './camp-items.mjs';
import { hash } from './map-freeze.mjs';

export function attachCampPreparation(pack, catalog) {
  const source = { id: 'invented-preparation', sha256: hash('invented preparation source') };
  const cap = {
    version: 'source-camp-preparation-v1',
    evidenceHash: hash('invented preparation evidence'),
    catalogFingerprint: hash(catalog),
    skillsFingerprint: hash(pack.manifest.campSkills),
    itemsFingerprint: hash(pack.manifest.campItems),
    sources: [source],
    methods: Object.fromEntries(
      ['continue', 'select', 'back'].map((name) => [
        name,
        {
          assemblyHash: pack.manifest.failure.methods.xp.assemblyHash,
          method: '06009997',
          bodyHash: hash(`invented preparation ${name}`),
        },
      ]),
    ),
    cards: catalog.skills
      .filter((c) => c.kind !== 'weakness')
      .map((c) => ({
        cardId: c.id,
        cardHash: hash(c),
        kind: c.kind,
        ownerId: c.ownerId,
        number: c.number,
        identity: 'bound',
        evidence: [{ sourceId: source.id, locator: `invented:card:${c.id}` }],
      })),
  };
  pack.manifest.campPreparation = cap;
  return cap;
}
export function preparationCompilation() {
  const input = campItemCompilation();
  input.pack.manifest.campSkills.catalogFingerprint = hash(campItemCatalog());
  input.campSkillsCertificate = { instructionHash: hash(input.pack.manifest.campSkills) };
  attachCampPreparation(input.pack, campItemCatalog());
  input.campPreparationCertificate = { instructionHash: hash(input.pack.manifest.campPreparation) };
  return input;
}
