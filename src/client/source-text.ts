import { compileSourceText } from '../scenario/text';
import type { SourceText } from '../shared/scenario';
export const ICON_LABELS: Record<Extract<SourceText[number], { kind: 'icon' }>['name'], string> = {
  might: 'Forza',
  agility: 'Agilità',
  spirit: 'Spirito',
  wisdom: 'Saggezza',
  wit: 'Ingegno',
  success: 'Successo',
  fate: 'Fato',
  inspiration: 'Ispirazione',
  action: 'Interazione',
  attack: 'Attacco',
  damage: 'Danno',
  fear: 'Paura',
  lore: 'Sapienza',
  person: 'Persona',
  search: 'Ricerca',
  threat: 'Minaccia',
  exploration: 'Esplorazione',
};
export function sourceText(tokens: SourceText): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const normalized = tokens.flatMap((t) =>
    t.kind === 'text' && /\[\/?[bi]\]/.test(t.text)
      ? compileSourceText(t.text).map((part) =>
          part.kind === 'text' && part.style === 'plain' ? { ...part, style: t.style } : part,
        )
      : [t],
  );
  for (const token of normalized) {
    if (token.kind === 'icon') {
      const icon = document.createElement('span');
      icon.className = 'source-icon';
      icon.textContent = ICON_LABELS[token.name];
      fragment.append(icon);
    } else {
      const node = document.createElement(
        token.style === 'bold' || token.style === 'boldItalic'
          ? 'strong'
          : token.style === 'italic'
            ? 'em'
            : 'span',
      );
      node.textContent = token.text.replaceAll('\\n', '\n');
      if (token.style === 'boldItalic') node.className = 'source-italic';
      fragment.append(node);
    }
  }
  return fragment;
}
