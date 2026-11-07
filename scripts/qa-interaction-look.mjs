// Dedicated Chrome and invented bootstrap only. After bootstrap, game writes use native UI.
import assert from 'node:assert/strict';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { ownBrowser, until, pause } from './qa-camp-browser.mjs';
import {
  readyLook,
  reachLook,
  readSession,
  readBackup,
  playable,
} from '../tests/interaction-look-helper.mjs';

const directory = resolve(process.argv[2]);
assert.ok(directory.startsWith(resolve('.scratch/issue135-task1') + '/'));
await mkdir(directory);
const cleanups = [],
  records = [],
  screenshots = [];
const t = {
  after: (f) => cleanups.push(f),
  diagnostic: (message) => records.push({ diagnostic: message }),
};
const record = (action, details = {}) => {
  records.push({ at: new Date().toISOString(), action, ...details });
  console.log(action);
};
let browser;
async function recover(page, actor) {
  await until(() => page.visible('#recover-details'), 'recover seat');
  if (!(await page.read('document.querySelector("#recover-details").open')))
    await page.click('#recover-details summary');
  await page.type('#recover-code', actor.recoveryCode);
  await page.click('#recover-form button');
  await until(() => page.read('!document.querySelector("#joined").hidden'), 'seat recovered');
}
async function tools(page) {
  if (
    (await page.read('document.querySelector("#toggle-tools").getAttribute("aria-pressed")')) !==
    'true'
  )
    await page.click('#toggle-tools');
}
async function shot(page, name) {
  const file = join(directory, name + '.png');
  await page.shot(file);
  screenshots.push(file);
}
async function current(r) {
  return (await readBackup(r.host)).payload;
}
async function syncAll(pages, r) {
  const s = await readSession(r.host);
  for (const page of pages) await page.syncRevision(s.revision);
  return s;
}
async function prepareRestore(pc, file, r) {
  const expected = await readSession(r.host);
  await pc.syncRevision(expected.revision);
  const message =
    expected.scenario?.pending?.text
      .filter((p) => p.kind === 'text')
      .map((p) => p.text)
      .join('') ?? '';
  await until(
    () =>
      pc.read(
        `document.querySelector('#scenario-message').textContent.trim() === ${JSON.stringify(message.trim())}`,
      ),
    'PC rendered current source state',
  );
  await tools(pc);
  if (!(await pc.read('document.querySelector("#backup-file").closest("details").open')))
    await pc.click('#backups details summary');
  await pc.call('DOM.setFileInputFiles', { nodeId: await pc.node('#backup-file'), files: [file] });
  await until(() => pc.visible('#restore-backup'), 'backup preview');
  await pc.click('#restore-backup');
}
async function confirmRestore(pc) {
  await pc.click('#confirm-restore');
  try {
    await until(
      () =>
        pc.read(
          'document.querySelector("#backup-status").textContent.includes("Copia ripristinata")',
        ),
      'native restore',
    );
  } catch (error) {
    throw new Error(
      error.message + ': ' + (await pc.read('document.querySelector("#backup-error").textContent')),
    );
  }
}
async function restoreFile(pc, file, r) {
  await prepareRestore(pc, file, r);
  await confirmRestore(pc);
}

async function lateRead(owner, change) {
  await owner.call('Fetch.enable', {
    patterns: [{ urlPattern: '*/api/private/looks/*', requestStage: 'Response' }],
  });
  const firstEvent = browser.events.length,
    started = Date.now();
  await owner.click('#read-private-look');
  const paused = await until(
    () =>
      browser.events
        .slice(firstEvent)
        .find(
          (e) =>
            e.sessionId === owner.sessionId &&
            e.method === 'Fetch.requestPaused' &&
            e.params.responseStatusCode === 200,
        ),
    'owned private response paused',
  );
  await change();
  await until(
    () => owner.read('!document.querySelector("#read-private-look")'),
    'private binding cleared',
  );
  await owner.call('Fetch.continueRequest', { requestId: paused.params.requestId });
  await owner.call('Fetch.disable');
  await pause(250);
  assert.ok(
    Date.now() - started < 5000,
    'Late response was released before the existing request timeout',
  );
  assert.equal(await owner.read('document.querySelector("#private-look-reader").open'), false);
  assert.equal(await owner.read('document.querySelector("#private-look-reader").textContent'), '');
  record('Late private response ignored', {
    elapsedMs: Date.now() - started,
    url: paused.params.request.url,
  });
}

try {
  browser = await ownBrowser(join(directory, 'browser'));
  for (const [label, options, order] of [
    ['fate', {}, null],
    ['nonfate-capped', { fate: 0, initialInspiration: 6 }, null],
    ['look-before-cost', { fate: 1, costs: 1, initialInspiration: 6 }, 'look'],
    ['cost-before-look', { fate: 1, costs: 1, initialInspiration: 6 }, 'spend'],
  ]) {
    record('Invented bootstrap begins', { label, options });
    const r = await readyLook(t, options);
    await reachLook(r);
    const boot = await current(r);
    await writeFile(join(directory, label + '-bootstrap.private.json'), JSON.stringify(boot));
    record('Invented bootstrap ends; subsequent game writes are native UI only', {
      label,
      revision: boot.state.revision,
    });
    const owner = await browser.page(r.host.url + '/join', 320),
      other = await browser.page(r.host.url + '/join', 768),
      third = await browser.page(r.host.url + '/join', 1024),
      pc = await browser.page(r.host.url + '/', 1440);
    const pages = [owner, other, third, pc];
    for (const [index, page] of pages.slice(0, 3).entries()) {
      await recover(page, r.players[index]);
      await tools(page);
    }
    await tools(pc);
    await owner.click('#open-guide');
    await owner.type('#guide-search', 'interagire');
    assert.ok(
      await owner.read(
        'document.querySelector("#guide-articles").textContent.includes("La carta resta in cima")',
      ),
    );
    await owner.click('#close-guide');
    const s = await readSession(r.host),
      node = playable(s),
      space = s.scenario.spaceBindings.find((b) => b.sourceId === node.spaceId).id;
    const location = s.journey.definition.spaces.find((sp) => sp.id === space).label;
    const index = await owner.read(
      `Array.from(document.querySelectorAll('#map-nodes button')).findIndex(b=>b.textContent.endsWith(${JSON.stringify(location)}))`,
    );
    assert.ok(index >= 0);
    const nodeButton = `#map-nodes button:nth-child(${index + 1})`;
    await owner.click(nodeButton);
    await owner.key('Escape');
    assert.deepEqual(await current(r), boot, 'inspection and Escape are read-only');
    record('Inspected and cancelled without cost', { label });
    await owner.click(nodeButton);
    await owner.click('#confirm-encounter');
    await until(
      async () =>
        (await readSession(r.host)).physical.active?.purpose ===
        (order ? 'interaction-order' : 'interaction-look'),
      'native committed before window',
    );
    await syncAll(pages, r);
    if (order) {
      const id = await until(
        () =>
          owner.read(
            `Array.from(document.querySelectorAll('#physical-decision-form button')).find(b=>b.textContent.includes(${JSON.stringify(order === 'look' ? 'Guarda la carta' : 'spendi 1')}))?.dataset.option ?? null`,
          ),
        'material before-effect controls rendered',
      );
      await owner.call('DOM.scrollIntoViewIfNeeded', {
        nodeId: await owner.node('#physical-decision-form'),
      });
      await shot(owner, label + '-order-320');
      await owner.click(`#physical-decision-form button[data-option="${id}"]`);
      await until(
        async () => (await readSession(r.host)).physical.active?.purpose === 'interaction-look',
        'chosen order reached private look',
      );
      record('Chose material before-effect order', { label, order });
    }
    await syncAll(pages, r);
    const pending = await current(r),
      q = pending.state.scenario.pending,
      looked = pending.state.physical.snapshot.resolution.privateLooks.at(-1);
    await until(() => owner.visible('#read-private-look'), 'owner private controls rendered');
    assert.equal(await owner.visible('#read-private-look'), true);
    for (const page of [other, third, pc]) {
      assert.equal(await page.read('!!document.querySelector("#read-private-look")'), false);
      assert.equal(
        await page.read('document.querySelector("#private-look-reader").textContent'),
        '',
      );
      assert.equal(
        await page.read(
          'document.querySelector("#card-reader-content").textContent.includes("La carta resta in cima")',
        ),
        false,
      );
      assert.equal(
        await page.read(
          'document.querySelector("#physical-resolution").textContent.includes("In attesa")',
        ),
        true,
      );
    }
    const otherSessions = new Set([other.sessionId, third.sessionId, pc.sessionId]);
    assert.equal(
      browser.events.some(
        (e) =>
          otherSessions.has(e.sessionId) &&
          e.method === 'Network.requestWillBeSent' &&
          e.params.request.url.includes('/api/private/looks/'),
      ),
      false,
    );
    record('Three identities and shared PC enforce private reader ownership', { label });
    await owner.click('#read-private-look');
    await until(
      () => owner.read('document.querySelector("#private-look-reader").open'),
      'private reader opens',
    );
    const reading = await owner.read('document.querySelector("#private-look-reader").textContent');
    assert.ok(reading.includes('La carta resta in cima'));
    assert.ok(reading.includes(`${options.fate === 0 ? 0 : 1} fato`));
    const contrast = await owner.read(`(() => {
      const dialog = document.querySelector('#private-look-reader');
      const luminance = color => {
        const channels = color.match(/[0-9.]+/g).slice(0, 3).map(Number).map(c => {
          c /= 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      };
      const background = luminance(getComputedStyle(dialog).backgroundColor);
      return Array.from(dialog.querySelectorAll('.company-help')).map(p => {
        const ink = luminance(getComputedStyle(p).color);
        return (Math.max(ink, background) + 0.05) / (Math.min(ink, background) + 0.05);
      });
    })()`);
    assert.ok(contrast.length === 2 && contrast.every((ratio) => ratio >= 4.5));
    record('Private reader text contrast verified', { label, ratios: contrast });
    for (const width of [320, 768, 1024, 1440]) {
      await owner.size(width);
      const rect = await owner.read(
        '(()=>{const r=document.querySelector("#private-look-reader").getBoundingClientRect();return{x:r.x,right:r.right,viewport:innerWidth,bodyWidth:document.documentElement.scrollWidth}})()',
      );
      assert.ok(rect.x >= 0 && rect.right <= rect.viewport + 1, JSON.stringify(rect));
      assert.ok(rect.bodyWidth <= rect.viewport + 1, JSON.stringify(rect));
      await shot(owner, `${label}-reader-${width}`);
    }
    await owner.click('#close-private-look');
    assert.deepEqual(await current(r), pending, 'reader close does not cancel, pay or reward');
    for (const [name, page] of [
      ['other', other],
      ['third', third],
      ['pc', pc],
    ]) {
      await page.call('DOM.scrollIntoViewIfNeeded', {
        nodeId: await page.node('#physical-resolution'),
      });
      await shot(page, label + '-' + name + '-waiting');
    }
    await owner.call('Page.reload');
    await until(() => owner.visible('#read-private-look'), 'pending survives native reload');
    await tools(owner);
    assert.deepEqual(await current(r), pending);
    const downloads = join(directory, label + '-downloads');
    await mkdir(downloads);
    await browser.send('Browser.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloads,
      eventsEnabled: true,
      browserContextId: pc.browserContextId,
    });
    await pc.click('#export-backup');
    const file = await until(async () => {
      const files = await readdir(downloads);
      return files.find((f) => f.endsWith('.json'));
    }, 'native backup download');
    const backupFile = join(downloads, file),
      downloaded = JSON.parse(await readFile(backupFile, 'utf8'));
    assert.deepEqual(downloaded.payload, pending);
    record('Exported actual pending file through PC UI', { label, file: backupFile });
    await owner.click('#physical-decision-form button[data-option="continue"]');
    await until(
      async () => (await readSession(r.host)).scenario.pending?.kind === 'message',
      'source callback message',
    );
    await syncAll([owner], r);
    await owner.click('#scenario-next');
    await until(
      async () => (await readSession(r.host)).scenario.pending === null,
      'actual source return',
    );
    const done = await current(r);
    assert.equal(done.state.scenario.play.attempts.at(-1).returned, true);
    assert.equal(
      done.state.round.heroes[0].actionsUsed,
      boot.state.round.heroes[0].actionsUsed + 1,
    );
    assert.deepEqual(done.state.journey.travel, boot.state.journey.travel);
    if (order) assert.equal(done.state.preparation.heroes[0].inspiration, order === 'look' ? 5 : 6);
    else
      assert.equal(
        done.state.preparation.heroes[0].inspiration,
        Math.min(6, boot.state.preparation.heroes[0].inspiration + (options.fate === 0 ? 0 : 1)),
      );
    record('Returned from actual source with exact action and travel budget', {
      label,
      inspiration: done.state.preparation.heroes[0].inspiration,
    });
    if (label === 'fate') {
      await restoreFile(pc, backupFile, r);
      await until(
        () => owner.read('!document.querySelector("#joined").hidden===false'),
        'identity expires after restore',
      );
      await recover(owner, r.player);
      await tools(owner);
      await until(() => owner.visible('#read-private-look'), 'recovered pending look');
      const old = (await readSession(r.host)).generation;
      await prepareRestore(pc, backupFile, r);
      await lateRead(owner, async () => {
        await confirmRestore(pc);
        await until(
          async () => (await readSession(r.host)).generation !== old,
          'generation changed via native restore',
        );
      });
      await recover(owner, r.player);
      await tools(owner);
      await until(() => owner.visible('#read-private-look'), 'owner recovered again');
      const duplicate = await browser.page(r.host.url + '/join', 768);
      pages.push(duplicate);
      await recover(duplicate, r.player);
      await tools(duplicate);
      await lateRead(owner, async () => {
        await duplicate.click('#physical-decision-form button[data-option="continue"]');
        await until(
          async () => (await readSession(r.host)).scenario.pending?.kind === 'message',
          'same-owner native pending change',
        );
      });
      await syncAll([duplicate], r);
      await duplicate.click('#scenario-next');
      await until(
        async () => (await readSession(r.host)).scenario.pending === null,
        'restored source returned',
      );
      const final = await current(r);
      assert.equal(final.state.physical.snapshot.resolution.privateLooks.length, 1);
      assert.equal(final.state.round.heroes[0].actionsUsed, done.state.round.heroes[0].actionsUsed);
      assert.deepEqual(final.state.journey.travel, done.state.journey.travel);
      record('Native file restore/recovery and late generation/pending reads passed', { label });
    }
    await writeFile(
      join(directory, label + '-result.private.json'),
      JSON.stringify({ bootstrap: boot, pending, done, looked }, null, 2),
    );
    for (const page of pages)
      await browser.send('Target.disposeBrowserContext', {
        browserContextId: page.browserContextId,
      });
    await r.host.stop();
  }
  const errors = browser.events.filter((e) => e.method === 'Runtime.exceptionThrown');
  assert.deepEqual(errors, []);
  record('Native QA completed', {
    screenshots: screenshots.length,
    viewports: [320, 768, 1024, 1440],
    runtimeExceptions: errors.length,
  });
} finally {
  if (browser)
    await writeFile(
      join(directory, 'browser-events.private.json'),
      JSON.stringify(
        browser.events
          .filter((e) =>
            [
              'Runtime.exceptionThrown',
              'Log.entryAdded',
              'Network.loadingFailed',
              'Fetch.requestPaused',
            ].includes(e.method),
          )
          .map((e) => ({
            method: e.method,
            sessionId: e.sessionId,
            details:
              e.method === 'Fetch.requestPaused'
                ? { url: e.params.request.url, responseStatusCode: e.params.responseStatusCode }
                : e.params,
          })),
        null,
        2,
      ),
    );
  if (browser) await browser.close();
  for (const cleanup of cleanups.reverse()) await cleanup();
  await writeFile(
    join(directory, 'actions.private.json'),
    JSON.stringify({ records, screenshots }, null, 2),
  );
}
