import type { SourceText } from '../shared/scenario';
const icons: Record<string, Extract<SourceText[number], { kind: 'icon' }>['name']> = {
  '\uf461': 'spirit',
  '\uf462': 'agility',
  '\uf463': 'might',
  '\uf460': 'wisdom',
  '\uf472': 'wit',
  '\uf475': 'action',
  '\uf469': 'damage',
  '\uf468': 'fear',
};
/** Source markup is parsed into data. No HTML is ever evaluated or inserted. */
export function compileSourceText(value: string): SourceText {
  const result: SourceText = [];
  let bold = 0,
    italic = 0,
    buffer = '';
  const flush = () => {
    if (buffer)
      result.push({
        kind: 'text',
        text: buffer,
        style: bold ? (italic ? 'boldItalic' : 'bold') : italic ? 'italic' : 'plain',
      });
    buffer = '';
  };
  for (const token of value
    .replace(/\[(\/?[bi])\]/g, '<$1>')
    .split(/(<\/?[bi]>|[\ue000-\uf8ff])/g)) {
    if (token === '<b>' || token === '</b>' || token === '<i>' || token === '</i>') {
      flush();
      if (token === '<b>') bold++;
      if (token === '</b>') bold = Math.max(0, bold - 1);
      if (token === '<i>') italic++;
      if (token === '</i>') italic = Math.max(0, italic - 1);
    } else if (/^[\ue000-\uf8ff]$/.test(token)) {
      flush();
      const name = icons[token];
      if (!name) throw new Error(`Unknown source icon U+${token.charCodeAt(0).toString(16)}`);
      result.push({ kind: 'icon', name });
    } else buffer += token;
  }
  flush();
  return result.length ? result : [{ kind: 'text', text: '', style: 'plain' }];
}
