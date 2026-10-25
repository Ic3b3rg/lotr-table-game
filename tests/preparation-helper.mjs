import { randomUUID } from 'node:crypto';
import { startHost } from './host-helper.mjs';
import { privateCatalog } from './fixtures/catalog.mjs';

export async function setup(t, catalog) {
  const pack = await privateCatalog(catalog);
  const host = await startHost({ LOTR_CONTENT_PACK: pack.path });
  t.after(async () => {
    await host.dispose();
    await pack.dispose();
  });
  return host;
}
export async function command(host, player, intent, at) {
  const state = at ?? (await (await host.request('/api/session')).json());
  return host.request(
    '/api/commands',
    {
      ...intent,
      requestId: intent.requestId ?? randomUUID(),
      generation: state.generation,
      expectedRevision: state.revision,
    },
    player.cookie,
  );
}
