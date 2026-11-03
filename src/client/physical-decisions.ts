import type { Session } from '../shared/protocol';
import type { PhysicalActive, PhysicalInput } from '../shared/physical';
import type { Catalog } from '../shared/catalog';
import { definitionId } from '../shared/preparation';
import { text } from './dom';
import { refreshActions } from './actions';

type Decision = Extract<PhysicalActive, { kind: 'decision' }>;
/** Native, labelled controls; the server remains the authority on every option/cost. */
export function decisionForm(
  q: Decision,
  session: Session,
  catalog: Catalog | null,
  submit: (input: PhysicalInput) => void,
) {
  const form = document.createElement('form'),
    fields = document.createElement('fieldset');
  form.id = 'physical-decision-form';
  fields.append(text('legend', q.title));
  const status = text('p', '', 'company-help');
  status.setAttribute('role', 'status');
  status.id = 'physical-decision-status';
  const button = text(
    'button',
    q.mode === 'scout'
      ? 'Risolvi la Scoperta'
      : q.mode === 'select'
        ? 'Applica la selezione'
        : 'Applica la prevenzione',
    'company-action',
  ) as HTMLButtonElement;
  button.type = 'submit';
  button.dataset.write = '';
  const select = (id: string, label: string, options: { id: string; label: string }[]) => {
    const wrap = text('label', label),
      field = document.createElement('select');
    field.id = id;
    for (const o of options) {
      const option = document.createElement('option');
      option.value = o.id;
      option.textContent = o.label;
      field.append(option);
    }
    wrap.append(field);
    fields.append(wrap);
    return field;
  };
  let value: () => PhysicalInput | null;
  if (q.mode === 'choose') {
    for (const option of q.options) {
      const b = text('button', option.label, 'company-action') as HTMLButtonElement;
      b.type = 'button';
      b.dataset.write = '';
      b.dataset.option = option.id;
      b.onclick = () => submit({ kind: 'physical-choice', option: option.id });
      fields.append(b);
    }
    form.append(fields, status);
    return form;
  } else if (q.mode === 'select') {
    const boxes = q.options.map((o) => {
      const wrap = text('label', o.label),
        box = document.createElement('input');
      box.type = 'checkbox';
      box.value = o.id;
      wrap.prepend(box);
      fields.append(wrap);
      return box;
    });
    value = () => {
      const ids = boxes.filter((b) => b.checked).map((b) => b.value);
      status.textContent = `${ids.length} selezionate · da ${q.minimum} a ${q.maximum}.`;
      return ids.length >= q.minimum && ids.length <= q.maximum
        ? { kind: 'physical-select', ids }
        : null;
    };
  } else if (q.mode === 'allocate') {
    const damage = select(
      'physical-damage',
      'Danni da negare o prevenire',
      Array.from({ length: Math.min(q.maximum, q.remaining.damage) + 1 }, (_, n) => ({
        id: String(n),
        label: String(n),
      })),
    );
    const fear = select(
      'physical-fear',
      'Paure da negare o prevenire',
      Array.from({ length: Math.min(q.maximum, q.remaining.fear) + 1 }, (_, n) => ({
        id: String(n),
        label: String(n),
      })),
    );
    value = () => {
      const d = Number(damage.value),
        f = Number(fear.value);
      status.textContent = `${d + f} di ${q.maximum} assegnati. ${d + f ? 'Il costo indicato verrà pagato una volta.' : 'Nessuna prevenzione né costo.'}`;
      return d + f <= q.maximum
        ? { kind: 'physical-allocate', ability: q.options[0]?.id ?? null, damage: d, fear: f }
        : null;
    };
  } else {
    const rows = q.options.map((o, n) => {
      const dest = select(`physical-scout-destination-${n}`, `${o.label} · destinazione`, [
        { id: 'bottom', label: 'Fondo del mazzo' },
        { id: 'top', label: 'Cima del mazzo' },
        { id: 'prepare', label: 'Prepara questa carta' },
      ]);
      const order = select(
        `physical-scout-order-${n}`,
        `${o.label} · posizione`,
        q.options.map((_, i) => ({ id: String(i), label: String(i + 1) })),
      );
      order.value = String(n);
      return { id: o.id, dest, order };
    });
    const hero = session.preparation?.heroes.find((h) => h.heroId === q.actorHeroId);
    const copies = [...new Set([...(hero?.prepared ?? []), ...q.options.map((o) => o.id)])];
    const discard = select(
      'physical-scout-discard',
      'Scarto solo se si supera il limite di quattro preparate',
      [
        { id: '', label: 'Nessuna carta' },
        ...copies.map((id) => ({
          id,
          label: catalog?.skills.find((s) => s.id === definitionId(id))?.name.text ?? id,
        })),
      ],
    );
    value = () => {
      const prepared = rows.filter((r) => r.dest.value === 'prepare'),
        ordered = [...rows].sort((a, b) => Number(a.order.value) - Number(b.order.value));
      const over = (hero?.prepared.length ?? 0) + prepared.length > 4;
      const valid =
        prepared.length <= 1 &&
        new Set(rows.map((r) => r.order.value)).size === rows.length &&
        Boolean(discard.value) === over &&
        (!discard.value ||
          hero?.prepared.includes(discard.value) ||
          prepared[0]?.id === discard.value);
      status.textContent = valid
        ? 'Disposizione completa: le altre carte restano nell’ordine scelto.'
        : 'Prepara al massimo una carta; usa posizioni diverse e scarta solo per il limite di quattro.';
      return valid
        ? {
            kind: 'physical-scout',
            prepare: prepared[0]?.id ?? null,
            discard: discard.value || null,
            top: ordered.filter((r) => r.dest.value === 'top').map((r) => r.id),
            bottom: ordered.filter((r) => r.dest.value === 'bottom').map((r) => r.id),
          }
        : null;
    };
  }
  const update = () => {
    button.dataset.blocked = String(!value());
    refreshActions();
  };
  form.onchange = update;
  form.onsubmit = (e) => {
    e.preventDefault();
    const input = value();
    if (input) submit(input);
  };
  form.append(fields, status, button);
  update();
  return form;
}
