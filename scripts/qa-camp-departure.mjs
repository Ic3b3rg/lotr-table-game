// Manual acceptance: invented native camp bootstrap, then UI input only.
// Uses only hosts, browser contexts, profiles and files created by this invocation.
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { once } from 'node:events';
import {
  readyDeparture,
  reachDepartureCamp,
  readSession,
  readBackup,
} from '../tests/camp-departure-helper.mjs';
import { startHost } from '../tests/host-helper.mjs';
import { ownBrowser, until, pause } from './qa-camp-browser.mjs';
const outcome = process.argv[2] ?? 'win';
assert.ok(['win', 'loss'].includes(outcome));
const directory = resolve('.scratch/a2-departure/browser', `${outcome}-${Date.now()}`);
await mkdir(directory, { recursive: true });
const cleanups = [],
  t = { after: (fn) => cleanups.push(fn) },
  report = {
    outcome,
    invented: true,
    originalGameplay: false,
    viewports: [],
    steps: [],
    physicalViewing:
      'Screenshots captured for subsequent image inspection; assertions below are script assertions.',
  };
let browser,
  r,
  pages = [];
const log = (step, data = {}) => {
  report.steps.push({ step, ...data });
  console.log(JSON.stringify({ step, ...data }));
};
try {
  r = await readyDeparture(t, { outcome, roleScout: true });
  await reachDepartureCamp(r);
  report.bootstrap = {
    declaredAt: new Date().toISOString(),
    boundary:
      'Real source win/loss consumer reached invented camp; every subsequent game mutation uses native UI controls.',
    players: 3,
    heroes: 3,
  };
  const initial = await readBackup(r.host);
  assert.equal(initial.payload.state.scenario.conclusion.stage, 'camp');
  assert.equal(
    initial.payload.state.scenario.conclusion.outcome,
    outcome === 'win' ? 'victory' : 'failure',
  );
  log('DECLARED_INVENTED_CAMP_BOOTSTRAP', {
    outcome,
    bytes: Buffer.byteLength(JSON.stringify(initial)),
  });
  browser = await ownBrowser(directory);
  report.browser = await browser.send('Browser.getVersion');
  const shared = await browser.page(r.host.url + '/', 1440);
  pages.push(shared);
  for (const width of [320, 768, 1024]) pages.push(await browser.page(r.host.url + '/join', width));
  const recover = async (page, actor) => {
    await until(() => page.visible('#recover-details'), 'recovery form');
    if (!(await page.read('document.querySelector("#recover-details").open')))
      await page.click('#recover-details > summary');
    await page.type('#recover-code', actor.recoveryCode);
    await page.click('#recover-form button[type="submit"]');
    await until(
      () =>
        page.read(
          `document.querySelector('#welcome').textContent===${JSON.stringify(actor.body.player.name)}`,
        ),
      'recovered own identity',
    );
  };
  for (const [n, a] of r.actors.entries()) await recover(pages[n + 1], a);
  assert.equal(await shared.read('document.querySelector("#personal").hidden'), true);
  const transition = async (page, selector) => {
    const state = await readSession(r.host),
      before = state.revision;
    await page.syncRevision(before);
    if (state.scenario?.conclusion?.stage === 'camp-preparation') {
      const count = state.scenario.conclusion.campaign.preparation.heroes.filter(
        (h) => h.confirmedRevision !== null,
      ).length;
      await until(
        () =>
          page.read(
            `document.querySelector('.camp-preparation > .test-status')?.textContent.startsWith('${count} di 3')`,
          ),
        'current camp confirmations rendered',
        25000,
      );
    }
    await page.click(selector);
    await until(
      async () => (await readSession(r.host)).revision > before,
      selector + ' persisted',
      25000,
    );
    await pause(150);
  };
  await transition(pages[1], '#campaign-heroes > button');
  for (const [n] of r.actors.entries())
    await transition(pages[n + 1], `[data-camp-confirm="hero-${n + 1}"]`);
  let s = await readSession(r.host);
  assert.equal(s.campDeparture.available, true, s.campDeparture.reason);
  await until(() => pages[1].visible('#camp-departure-agreed'), 'departure agreement');
  assert.equal(await pages[1].read('document.querySelector("[data-camp-depart]").disabled'), true);
  await pages[1].click('#camp-departure-agreed');
  assert.equal(await pages[1].read('document.querySelector("[data-camp-depart]").disabled'), false);
  // Open and close a real card reader; Escape returns focus to its invoking card.
  await pages[1].click('[data-preparation-hero="hero-1"] .physical-card');
  await until(() => pages[1].visible('#card-reader'), 'card reader');
  await pages[1].shot(join(directory, 'reader-320.png'));
  await pages[1].key('Escape');
  assert.equal(
    await pages[1].read('document.activeElement.classList.contains("physical-card")'),
    true,
  );
  await pages[1].click('#open-guide');
  await pages[1].type('#guide-search', 'seconda');
  assert.ok(
    (await pages[1].read('document.querySelector("#guide-articles").innerText')).includes(
      'Scoperta 3',
    ),
  );
  await pages[1].shot(join(directory, 'guide-320.png'));
  await pages[1].click('#close-guide');
  for (const width of [320, 768, 1024, 1440]) {
    await pages[1].size(width);
    await pages[1].read('document.fonts.ready.then(()=>true)');
    await pause(250);
    const layout = await pages[1].read(
      '({width:innerWidth,document:document.documentElement.scrollWidth,labels:[...document.querySelectorAll(".camp-preparation select")].every(e=>!!document.querySelector(`label[for="${e.id}"]`)),status:!!document.querySelector(".camp-preparation [role=status]")})',
    );
    assert.ok(layout.document <= width + 1, JSON.stringify(layout));
    assert.ok(layout.labels && layout.status);
    report.viewports.push({ stage: 'camp', ...layout });
    await pages[1].call('DOM.scrollIntoViewIfNeeded', {
      nodeId: await pages[1].node('[data-camp-depart]'),
    });
    await pages[1].shot(join(directory, `camp-${width}.png`));
  }
  await pages[1].size(320);
  await transition(pages[1], '[data-camp-depart]');
  log('UI_DEPARTED');
  let restored = false,
    scoutOwners = new Set(),
    roleOwners = new Set();
  for (let n = 0; n < 120; n++) {
    s = await readSession(r.host);
    const q = s.scenario.pending;
    if (!q) break;
    const full = (await readBackup(r.host)).payload.state,
      b = full.scenario.battle,
      owner = r.actors.findIndex((a) => a.body.player.id === q.actorPlayerId),
      page = pages[owner >= 0 ? owner + 1 : 1];
    await until(
      () =>
        page.read(`document.querySelector('#scenario').dataset.request===${JSON.stringify(q.id)}`),
      'current request rendered',
      25000,
    );
    if (q.kind === 'physical') {
      const p = s.physical.active;
      if (b.runKey === 'initial') roleOwners.add(p.actorPlayerId);
      if (b.runKey === 'scout') {
        if (!scoutOwners.has(p.actorPlayerId)) log('UI_SCOUT3_OWNER', { owner: owner + 1 });
        scoutOwners.add(p.actorPlayerId);
      }
      const waiter = pages[((owner + 1) % 3) + 1];
      await until(
        () =>
          waiter.read(
            `document.querySelector('#scenario').dataset.request===${JSON.stringify(q.id)}`,
          ),
        'waiting identity rendered',
        25000,
      );
      assert.equal(
        await waiter.visible('#physical-decision-form'),
        false,
        'Waiting owner cannot answer another owner',
      );
      assert.ok(
        (await waiter.read('document.querySelector("#physical-resolution").innerText')).includes(
          'In attesa',
        ),
      );
      if (p.mode === 'scout') {
        if (b.runKey === 'scout' && !restored) {
          await page.call('DOM.scrollIntoViewIfNeeded', {
            nodeId: await page.node('#physical-decision-form'),
          });
          await page.shot(join(directory, 'pending-scout-personal.png'));
          await shared.call('Page.reload');
          await until(
            () =>
              shared.read('document.querySelector("#connection").textContent==="Collegato al PC"'),
            'shared refresh',
          );
          const prior = await readBackup(r.host),
            beforeRefresh = prior.payload;
          await page.call('Page.reload');
          await until(
            () => page.visible('#physical-decision-form'),
            'personal refresh preserves Scout3',
          );
          assert.deepEqual((await readBackup(r.host)).payload, beforeRefresh);
          const downloadDir = join(directory, 'downloads');
          await mkdir(downloadDir);
          await browser.send('Browser.setDownloadBehavior', {
            behavior: 'allowAndName',
            downloadPath: downloadDir,
            browserContextId: shared.browserContextId,
            eventsEnabled: true,
          });
          await shared.click('nav a[href="#backups"]');
          await shared.click('#export-backup');
          const event = await until(
            () =>
              browser.events.find(
                (e) => e.method === 'Browser.downloadProgress' && e.params.state === 'completed',
              ),
            'UI backup download',
          );
          const file = join(downloadDir, event.params.guid),
            backup = JSON.parse(await readFile(file, 'utf8'));
          assert.deepEqual(backup.payload, prior.payload);
          for (const path of r.sourcePaths) await rm(path);
          const old = r.host;
          await old.stop('SIGKILL');
          r.host = await startHost({ LOTR_DATA_DIR: join(r.directory, 'ui-empty-restore') });
          cleanups.push(() => r.host.stop());
          await shared.navigate(r.host.url + '/');
          await shared.click('nav a[href="#backups"]');
          await shared.click('#backups > details > summary');
          await shared.call('DOM.setFileInputFiles', {
            nodeId: await shared.node('#backup-file'),
            files: [file],
          });
          await until(() => shared.visible('#restore-preview'), 'UI restore preview');
          await shared.click('#restore-backup');
          assert.ok(await shared.read('document.querySelector("#restore-confirmation").open'));
          await shared.click('#confirm-restore');
          await until(
            async () => !!(await readSession(r.host)).scenario?.battle,
            'UI file restored to empty host',
            25000,
          );
          const recovered = (await readBackup(r.host)).payload,
            expected = structuredClone(prior.payload);
          for (const key of ['generation', 'revision', 'updatedAt'])
            expected.state[key] = recovered.state[key];
          assert.deepEqual(recovered, expected);
          for (const [i, a] of r.actors.entries()) {
            await pages[i + 1].navigate(r.host.url + '/join');
            await recover(pages[i + 1], a);
          }
          restored = true;
          log('UI_PACKLESS_FILE_RESTORE', { bytes: Buffer.byteLength(JSON.stringify(backup)) });
          continue;
        }
        // An explicit native destination choice; every other card keeps its labelled bottom/order default.
        await page.select('#physical-scout-destination-0', 'top');
        await transition(page, '#physical-decision-form button[type="submit"]');
      } else if (p.mode === 'choose') {
        const option =
          ['reveal', 'resolve', 'close', 'close-rest'].find((id) =>
            p.options.some((o) => o.id === id),
          ) ?? p.options[0].id;
        await transition(page, `#physical-decision-form [data-option="${option}"]`);
      } else if (p.mode === 'select') {
        for (let i = 0; i < p.minimum; i++)
          await page.click(`#physical-decision-form input[type=checkbox]:nth-of-type(${i + 1})`);
        await transition(page, '#physical-decision-form button[type=submit]');
      } else throw Error('Unexpected browser acceptance choice ' + p.mode);
    } else await transition(page, '#scenario-next');
  }
  s = await readSession(r.host);
  assert.equal(s.scenario.phase, 'action');
  assert.equal(s.scenario.handoffCount, 1);
  assert.equal(s.round.number, 1);
  assert.equal(scoutOwners.size, 3);
  assert.equal(roleOwners.size, 3);
  assert.ok(restored);
  const pc = shared;
  await until(() => pc.visible('#journey-map'), 'new shared battle map');
  for (const width of [320, 768, 1024, 1440]) {
    await pc.size(width);
    await pause(250);
    await pc.call('DOM.scrollIntoViewIfNeeded', { nodeId: await pc.node('#map-title') });
    const layout = await pc.read(
      '({width:innerWidth,document:document.documentElement.scrollWidth,walls:document.querySelectorAll(".map-wall").length,cells:document.querySelectorAll(".map-space").length,markers:document.querySelectorAll(".map-token").length})',
    );
    assert.ok(layout.document <= width + 1, JSON.stringify(layout));
    assert.equal(layout.walls, 3);
    assert.equal(layout.cells, 10);
    assert.ok(layout.markers >= 6);
    report.viewports.push({ stage: 'battle', ...layout });
    await pc.shot(join(directory, `battle-${width}.png`));
  }
  const personal = pages[1];
  await personal.click('#round-agreed');
  await transition(personal, '#round-confirm');
  await transition(personal, '#start-travel');
  s = await readSession(r.host);
  const to = s.scenario.spaceBindings.find((b) => b.sourceId === 'west/veranda').id;
  await personal.select('#map-destination', to);
  await transition(personal, '#move-hero');
  s = await readSession(r.host);
  assert.equal(s.journey.heroes[0].spaceId, to);
  assert.equal(s.round.heroes[0].actionsUsed, 1);
  const blocked = s.scenario.spaceBindings.find((b) => b.sourceId === 'east/atrium').id;
  await personal.select('#map-destination', blocked);
  assert.equal(await personal.read('document.querySelector("#move-hero").disabled'), true);
  await personal.call('DOM.scrollIntoViewIfNeeded', {
    nodeId: await personal.node('#map-preview'),
  });
  await personal.shot(join(directory, 'first-turn-wall-320.png'));
  log('UI_FIRST_LEGAL_ACTION', { wallBlocked: true, scoutOwners: 3, roleOwners: 3 });
  const ax = await personal.call('Accessibility.getFullAXTree');
  await writeFile(join(directory, 'accessibility.json'), JSON.stringify(ax, null, 2));
  const consoleErrors = browser.events.filter(
    (e) =>
      e.method === 'Runtime.exceptionThrown' ||
      (e.method === 'Log.entryAdded' && e.params.entry.level === 'error'),
  );
  assert.equal(consoleErrors.length, 0, JSON.stringify(consoleErrors));
  report.final = {
    phase: s.scenario.phase,
    handoff: s.scenario.handoffCount,
    round: s.round.number,
    actionsUsed: s.round.heroes[0].actionsUsed,
    archiveCount: (await readBackup(r.host)).payload.state.episodes.length,
    consoleErrors: 0,
  };
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL';
  if (r)
    try {
      await writeFile(
        join(directory, 'failure-session.json'),
        JSON.stringify(await readSession(r.host)),
      );
    } catch {}
  report.error = String(error.stack ?? error);
  for (const [n, page] of pages.entries())
    try {
      await page.shot(join(directory, `failure-${n}.png`));
      await writeFile(
        join(directory, `failure-${n}.txt`),
        await page.read('document.body.innerText'),
      );
    } catch {}
  throw error;
} finally {
  if (browser) {
    await writeFile(join(directory, 'events.json'), JSON.stringify(browser.events, null, 2));
    await browser.close();
  }
  for (const cleanup of cleanups.reverse())
    try {
      await cleanup();
    } catch {}
  await writeFile(join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ directory, status: report.status }));
}
