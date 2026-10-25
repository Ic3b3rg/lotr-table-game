import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { startHost } from './host-helper.mjs';
import { catalogFixture, privateCatalog } from './fixtures/catalog.mjs';

test('il catalogo locale è consultabile e rimane congelato dopo un aggiornamento dell’input', async (t) => {
  const pack = await privateCatalog();
  t.after(() => pack.dispose());
  const first = await startHost({ LOTR_CONTENT_PACK: pack.path });
  let current = first;
  t.after(async () => {
    await current.stop();
    await first.dispose();
  });
  const response = await first.request('/api/catalog');
  assert.equal(response.status, 200);
  const catalog = await response.json();
  assert.equal(catalog.heroes.length, 6);
  assert.equal(catalog.skills.length, 74);
  assert.equal(catalog.heroes[0].ability.kind, 'translated');
  const session = await (await first.request('/api/session')).json();
  assert.equal(session.catalog.id, 'synthetic-base-v1');
  assert.equal(JSON.stringify(session).includes('Testo inventato'), false);
  await first.stop('SIGKILL');
  const changed = catalogFixture();
  changed.id = 'other';
  changed.heroes[0].name.text = 'Altro eroe';
  await writeFile(pack.path, JSON.stringify(changed));
  current = await startHost({ LOTR_CONTENT_PACK: pack.path, LOTR_DATA_DIR: first.dataDir });
  assert.deepEqual(await (await current.request('/api/catalog')).json(), catalog);
});

test('un catalogo assente lascia il tavolo utilizzabile con stato esplicito', async (t) => {
  const host = await startHost();
  t.after(() => host.dispose());
  assert.equal((await (await host.request('/api/session')).json()).catalog, null);
  const response = await host.request('/api/catalog');
  assert.equal(response.status, 200);
  assert.equal(await response.json(), null);
});

test('cataloghi incoerenti non vengono acquisiti o sostituiti con dati vuoti', async (t) => {
  for (const mutate of [
    (c) => {
      c.heroes[0].maxHands = 1;
      c.heroes[0].startingItemIds = ['bow', 'armor'];
    },
    (c) => {
      c.heroes[0].skills[0] = 'missing';
    },
    (c) => {
      c.skills[0].quantity = 4;
    },
    (c) => {
      c.skills[1].id = c.skills[0].id;
    },
    (c) => {
      c.heroes[0].portrait = '../secrets.png';
    },
    (c) => {
      delete c.skills[0].text.kind;
    },
  ]) {
    const catalog = catalogFixture();
    mutate(catalog);
    const pack = await privateCatalog(catalog);
    t.after(() => pack.dispose());
    await assert.rejects(
      startHost({ LOTR_CONTENT_PACK: pack.path }).then((host) => {
        t.after(() => host.dispose());
        return host;
      }),
      /catalog|Catalog/,
    );
  }
});
