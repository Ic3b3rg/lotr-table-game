import { readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

const documents = [
  { id: 'manual', title: 'Manuale di gioco · italiano', file: 'manuale-gioco-it.pdf' },
  { id: 'reference', title: 'Compendio delle regole · inglese', file: 'rules-reference-en.pdf' },
  { id: 'faq', title: 'FAQ ed errata · italiano', file: 'faq-errata-it-2.0.pdf' },
  { id: 'corrections', title: 'Carte corrette · italiano', file: 'carte-corrette-it.pdf' },
] as const;

export function ruleDocument(directory: string, id: string): Buffer | null {
  const document = documents.find((document) => document.id === id);
  if (!document) return null;
  try {
    const root = realpathSync(directory);
    const path = realpathSync(join(root, document.file));
    const info = statSync(path);
    if (dirname(path) !== root || !info.isFile() || info.size > 20_000_000) return null;
    const data = readFileSync(path);
    return data.subarray(0, 5).toString('ascii') === '%PDF-' ? data : null;
  } catch {
    return null;
  }
}

export function ruleCatalog(directory: string) {
  return documents.map(({ id, title }) => ({
    id,
    title,
    available: Boolean(ruleDocument(directory, id)),
  }));
}
