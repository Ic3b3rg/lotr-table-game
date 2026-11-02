import { closeSync, openSync, readFileSync, readSync, realpathSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

const documents = [
  { id: 'manual', title: 'Manuale di gioco · italiano', file: 'manuale-gioco-it.pdf' },
  { id: 'reference', title: 'Compendio delle regole · inglese', file: 'rules-reference-en.pdf' },
  { id: 'faq', title: 'FAQ ed errata · italiano', file: 'faq-errata-it-2.0.pdf' },
  { id: 'corrections', title: 'Carte corrette · italiano', file: 'carte-corrette-it.pdf' },
] as const;

function rulePath(directory: string, id: string): string | null {
  const document = documents.find((document) => document.id === id);
  if (!document) return null;
  try {
    const root = realpathSync(directory);
    const path = realpathSync(join(root, document.file));
    const info = statSync(path);
    if (dirname(path) !== root || !info.isFile() || info.size > 64_000_000) return null;
    const descriptor = openSync(path, 'r');
    try {
      const header = Buffer.alloc(5);
      readSync(descriptor, header, 0, 5, 0);
      return header.toString('ascii') === '%PDF-' ? path : null;
    } finally {
      closeSync(descriptor);
    }
  } catch {
    return null;
  }
}

export function ruleDocument(directory: string, id: string): Buffer | null {
  const path = rulePath(directory, id);
  if (!path) return null;
  try {
    return readFileSync(path);
  } catch {
    return null;
  }
}

export function ruleCatalog(directory: string) {
  return documents.map(({ id, title }) => ({
    id,
    title,
    available: Boolean(rulePath(directory, id)),
  }));
}
