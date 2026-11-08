// Fresh finite invented history, then native DOM/Input only from A2 conclusion onward.
// API GETs below observe persistence; no game POST or SQL write follows the declaration.
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, rm, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import {
  readyAdventure3,
  reachSecondCamp,
  readSession,
  readBackup,
} from '../tests/adventure3-startup-helper.mjs';
import { startHost } from '../tests/host-helper.mjs';
import { ownBrowser, until, pause } from './qa-camp-browser.mjs';
const outcome = process.argv[2] ?? 'victory';
assert.ok(['victory', 'failure'].includes(outcome));
const directory = resolve(
  process.env.LOTR_QA_OUTPUT_DIR ?? '.scratch/adventure3-startup-task1/browser',
  outcome + '-' + Date.now(),
);
await mkdir(directory, { recursive: true });
const cleanups = [],
  t = { after: (fn) => cleanups.push(fn) },
  report = {
    outcome,
    invented: true,
    originalGameplay: false,
    steps: [],
    viewports: [],
    screenshots: 'Generated for separate physical image inspection.',
  };
let r,
  browser,
  pages = [];
const log = (step, data = {}) => {
  report.steps.push({ step, ...data });
  console.log(JSON.stringify({ step, ...data }));
};
try {
  if (process.env.LOTR_QA_BOOTSTRAP) {
    const backup = JSON.parse(await readFile(process.env.LOTR_QA_BOOTSTRAP, 'utf8')),
      actors = JSON.parse(await readFile(process.env.LOTR_QA_ACTORS, 'utf8')),
      host = await startHost({ LOTR_DATA_DIR: join(directory, 'restored-bootstrap') });
    cleanups.push(() => host.stop());
    const empty = await readSession(host),
      response = await host.request('/api/restores', {
        backup,
        generation: empty.generation,
        expectedRevision: empty.revision,
        confirmed: true,
      });
    assert.equal(response.status, 200, await response.text());
    r = { host, actors, player: actors[0], other: actors[1], directory, sourcePaths: [] };
  } else {
    r = await readyAdventure3(t, { outcome, groupItem: true, roleScout: true });
    await reachSecondCamp(r, { stopAtConclusion: true });
  }
  await writeFile(join(directory, 'owned-host-url.txt'), r.host.url);
  log('OWNED_HOST_READY', { url: r.host.url, directory });
  const bootstrap = await readBackup(r.host);
  assert.equal(bootstrap.payload.state.scenario.conclusion.outcome, outcome);
  report.bootstrap = {
    declaredAt: new Date().toISOString(),
    boundary:
      'Legally reached invented A2 terminal, before conclusion acknowledgments/awards/camp. Every following game mutation uses native DOM/Input.',
    bytes: Buffer.byteLength(JSON.stringify(bootstrap)),
    players: 3,
    heroes: 3,
  };
  await writeFile(join(directory, 'bootstrap.private.json'), JSON.stringify(bootstrap));
  await writeFile(
    join(directory, 'bootstrap-actors.private.json'),
    JSON.stringify(r.actors.map((a) => ({ body: a.body, recoveryCode: a.recoveryCode }))),
  );
  log('DECLARED_FINITE_INVENTED_A2_TERMINAL', report.bootstrap);
  if (process.env.LOTR_QA_BROWSER_WAIT_FILE)
    await until(
      async () => {
        try {
          await access(process.env.LOTR_QA_BROWSER_WAIT_FILE);
          return true;
        } catch {
          return false;
        }
      },
      'browser provider selected',
      60000,
    );
  browser = await ownBrowser(directory);
  report.browser = await browser.send('Browser.getVersion');
  const shared = await browser.page(r.host.url + '/', 1440);
  pages.push(shared);
  for (const width of [320, 768, 1024]) pages.push(await browser.page(r.host.url + '/join', width));
  const recover = async (page, actor) => {
    await until(() => page.visible('#recover-details'), 'recover form');
    if (!(await page.read('document.querySelector("#recover-details").open')))
      await page.click('#recover-details > summary');
    await page.type('#recover-code', actor.recoveryCode);
    await page.click('#recover-form button[type=submit]');
    await until(
      () =>
        page.read(
          `document.querySelector('#welcome').textContent===${JSON.stringify(actor.body.player.name)}`,
        ),
      'own identity recovered',
    );
  };
  for (const [n, actor] of r.actors.entries()) await recover(pages[n + 1], actor);
  assert.equal(await shared.read('document.querySelector("#personal").hidden'), true);
  const transition = async (page, selector) => {
    const before = await readSession(r.host);
    await page.syncRevision(before.revision);
    await page.click(selector);
    await until(
      async () => (await readSession(r.host)).revision > before.revision,
      selector + ' persisted',
      25000,
    );
    await page.syncRevision((await readSession(r.host)).revision);
  };
  for (let n = 0; n < 30 && (await readSession(r.host)).scenario.conclusion.stage !== 'camp'; n++)
    await transition(pages[1], '#campaign-next');
  let s = await readSession(r.host);
  assert.equal(s.scenario.conclusion.stage, 'camp');
  assert.equal(
    await pages[1].read('document.querySelector("#campaign-title").textContent'),
    'Il secondo campo',
  );
  log('UI_A2_END_AND_SECOND_CAMP');
  const offer = s.scenario.pack.manifest.campSkills.roles.find((r) => r.id === 'role-1')
      .upgrades[0],
    row = `[data-camp-hero="hero-1"] [data-camp-copy="${offer.copy}"]`;
  await transition(pages[1], row + ' [data-camp-operation=buy]');
  await pages[1].click('[data-camp-item="sword:1"] details > summary');
  await pages[1].click('[data-camp-item="sword:1"] [data-camp-upgrade="advanced:1"]');
  await transition(pages[1], '[data-camp-item="sword:1"] [data-camp-confirm]');
  await transition(pages[1], row + ' [data-camp-operation=sell]');
  await transition(pages[1], row + ' [data-camp-operation=buy]');
  await transition(pages[1], '#campaign-heroes > button');
  for (const [n] of r.actors.entries())
    await transition(pages[n + 1], `[data-camp-confirm="hero-${n + 1}"]`);
  await pages[1].syncRevision((await readSession(r.host)).revision);
  await pages[1].select('#next-role-hero-1', 'role-4');
  await transition(pages[1], '[data-preparation-hero="hero-1"] form button');
  s = await readSession(r.host);
  assert.equal(s.scenario.conclusion.campaign.preparation.heroes[0].confirmedRevision, null);
  assert.equal(s.campDeparture.available, false);
  // The accessory is common property; choose its finite owned copy with the personal button.
  await transition(pages[1], '[data-preparation-hero="hero-1"] > button:not([data-camp-confirm])');
  await transition(pages[1], '[data-camp-confirm="hero-1"]');
  s = await readSession(r.host);
  assert.equal(s.campDeparture.available, true, s.campDeparture.reason);
  await pages[1].click('[data-preparation-hero="hero-1"] .physical-card');
  await until(() => pages[1].visible('#card-reader'), 'reader');
  await pages[1].shot(join(directory, 'reader-320.png'));
  await pages[1].key('Escape');
  assert.equal(
    await pages[1].read('document.activeElement.classList.contains("physical-card")'),
    true,
  );
  await pages[1].click('#open-guide');
  await pages[1].type('#guide-search', 'terza');
  assert.ok(
    (await pages[1].read('document.querySelector("#guide-articles").innerText')).includes(
      'Scoperta 3',
    ),
  );
  await pages[1].shot(join(directory, 'guide-320.png'));
  await pages[1].click('#close-guide');
  const capture = async (page, stage, selector) => {
    for (const width of [320, 768, 1024, 1440]) {
      await page.size(width);
      await pause(250);
      await page.read('document.fonts.ready.then(()=>true)');
      const layout = await page.read(
        '({width:innerWidth,document:document.documentElement.scrollWidth})',
      );
      assert.ok(layout.document <= width + 1, stage + JSON.stringify(layout));
      report.viewports.push({ stage, ...layout });
      await page.call('DOM.scrollIntoViewIfNeeded', { nodeId: await page.node(selector) });
      await page.shot(join(directory, `${stage}-${width}.png`));
    }
    await page.size(320);
  };
  await capture(pages[1], 'second-camp', '#camp-departure-agreed');
  await pages[1].click('#camp-departure-agreed');
  await transition(pages[1], '[data-camp-depart]');
  log('UI_A3_DEPARTURE');
  let restored = false,
    setupCaptured = false;
  const scoutOwners = new Set();
  for (let n = 0; n < 220; n++) {
    s = await readSession(r.host);
    const q = s.scenario.pending;
    if (!q) break;
    const owner = Math.max(
        0,
        r.actors.findIndex((a) => a.body.player.id === q.actorPlayerId),
      ),
      page = pages[owner + 1];
    await page.syncRevision(s.revision);
    await until(
      () =>
        page.read(`document.querySelector('#scenario').dataset.request===${JSON.stringify(q.id)}`),
      'current A3 request',
      25000,
    );
    if (q.kind === 'physical') {
      const p = s.physical.active;
      assert.equal(p.kind, 'decision', 'Mandatory startup must have a real executor');
      const waiter = pages[((owner + 1) % 3) + 1];
      await waiter.syncRevision(s.revision);
      assert.equal(await waiter.visible('#physical-decision-form'), false);
      assert.ok(
        (await waiter.read('document.querySelector("#physical-resolution").innerText')).includes(
          'In attesa',
        ),
      );
      if (p.mode === 'scout') {
        scoutOwners.add(p.actorPlayerId);
        if (!setupCaptured) {
          await capture(page, 'startup-child', '#physical-decision-form');
          setupCaptured = true;
        }
        if (!restored) {
          const prior = await readBackup(r.host),
            before = prior.payload;
          await page.call('Page.reload');
          await until(() => page.visible('#physical-decision-form'), 'reloaded pending Scout');
          assert.deepEqual((await readBackup(r.host)).payload, before);
          const downloads = join(directory, 'downloads');
          await mkdir(downloads);
          await browser.send('Browser.setDownloadBehavior', {
            behavior: 'allowAndName',
            downloadPath: downloads,
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
              'UI export',
              25000,
            ),
            file = join(downloads, event.params.guid),
            backup = JSON.parse(await readFile(file, 'utf8'));
          assert.deepEqual(backup.payload, prior.payload);
          for (const path of r.sourcePaths) await rm(path);
          await r.host.stop('SIGKILL');
          r.host = await startHost({ LOTR_DATA_DIR: join(r.directory, 'ui-empty-A3') });
          cleanups.push(() => r.host.stop());
          await shared.navigate(r.host.url + '/');
          await shared.click('nav a[href="#backups"]');
          await shared.click('#backups > details > summary');
          await shared.call('DOM.setFileInputFiles', {
            nodeId: await shared.node('#backup-file'),
            files: [file],
          });
          await until(() => shared.visible('#restore-preview'), 'restore preview', 25000);
          await shared.click('#restore-backup');
          await shared.click('#confirm-restore');
          await until(
            async () => !!(await readSession(r.host)).scenario?.journeyStartup,
            'UI restore',
            25000,
          );
          const after = (await readBackup(r.host)).payload,
            expected = structuredClone(before);
          for (const key of ['generation', 'revision', 'updatedAt'])
            expected.state[key] = after.state[key];
          assert.deepEqual(after, expected);
          for (const [i, a] of r.actors.entries()) {
            await pages[i + 1].navigate(r.host.url + '/join');
            await recover(pages[i + 1], a);
          }
          restored = true;
          log('UI_PACKLESS_RESTORE', { bytes: Buffer.byteLength(JSON.stringify(backup)) });
          continue;
        }
        await page.select('#physical-scout-destination-0', 'top');
        await transition(page, '#physical-decision-form button[type=submit]');
      } else if (p.mode === 'choose') {
        const option =
          ['reveal', 'resolve', 'apply', 'close', 'close-rest', 'keep'].find((id) =>
            p.options.some((o) => o.id === id && !o.unavailable),
          ) ?? p.options.find((o) => !o.unavailable).id;
        await transition(page, `#physical-decision-form [data-option="${option}"]`);
      } else if (p.mode === 'allocate')
        await transition(page, '#physical-decision-form button[type=submit]');
      else if (p.mode === 'select') {
        for (let i = 0; i < p.minimum; i++)
          await page.click(`#physical-decision-form input[type=checkbox]:nth-of-type(${i + 1})`);
        await transition(page, '#physical-decision-form button[type=submit]');
      } else throw Error('Unsupported UI child ' + p.mode);
    } else await transition(page, '#scenario-next');
  }
  s = await readSession(r.host);
  assert.equal(s.scenario.phase, 'action');
  assert.equal(s.scenario.handoffCount, 1);
  assert.equal(s.round.number, 1);
  assert.equal(scoutOwners.size, 3);
  assert.ok(restored && setupCaptured);
  assert.equal(s.scenario.journeyStartup.startSpaceDraw, undefined);
  assert.equal(s.scenario.journeyStartup.campaign, undefined);
  const personal = pages[1];
  await personal.syncRevision((await readSession(r.host)).revision);
  await personal.select('#round-hero', 'hero-1');
  await personal.click('#round-agreed');
  await transition(personal, '#round-confirm');
  await transition(personal, '#start-travel');
  s = await readSession(r.host);
  assert.equal(s.round.heroes[0].actionsUsed, 1);
  const moveState = (await readBackup(r.host)).payload.state,
    from = s.journey.heroes[0].spaceId,
    source = moveState.scenario.spaceBindings.find((b) => b.id === from).sourceId,
    tile = moveState.mapGeneration.projection.spaces.find((p) => p.id === source).tileSource,
    ownSpaces = new Set(
      moveState.mapGeneration.projection.spaces
        .filter((p) => p.tileSource === tile)
        .map((p) => moveState.scenario.spaceBindings.find((b) => b.sourceId === p.id).id),
    ),
    to = s.journey.definition.connections
      .flatMap(([a, b]) => (a === from ? [b] : b === from ? [a] : []))
      .find((id) => ownSpaces.has(id));
  assert.ok(to);
  await personal.syncRevision(s.revision);
  await personal.select('#map-destination', to);
  await transition(personal, '#move-hero');
  for (let n = 0; n < 100; n++) {
    s = await readSession(r.host);
    const q = s.physical.active,
      combat = s.combat.pending;
    if (!q && !combat && !s.combat.current) break;
    const owner = r.actors.findIndex(
        (a) => a.body.player.id === (q?.actorPlayerId ?? combat?.actorPlayerId),
      ),
      page = pages[owner + 1];
    assert.ok(page);
    await page.syncRevision(s.revision);
    if (q) {
      assert.equal(q.kind, 'decision');
      if (q.mode === 'choose') {
        const option =
          ['reveal', 'resolve', 'apply', 'close', 'close-rest', 'keep'].find((id) =>
            q.options.some((o) => o.id === id && !o.unavailable),
          ) ?? q.options.find((o) => !o.unavailable).id;
        await transition(page, `#physical-decision-form [data-option="${option}"]`);
      } else if (q.mode === 'allocate')
        await transition(page, '#physical-decision-form button[type=submit]');
      else if (q.mode === 'select') {
        const boxes = await page.read(
          '[...document.querySelectorAll("#physical-decision-form input[type=checkbox]")].map(e=>e.value)',
        );
        for (const id of boxes.slice(0, q.minimum))
          await page.click(`#physical-decision-form input[value="${id}"]`);
        await transition(page, '#physical-decision-form button[type=submit]');
      } else if (q.mode === 'scout') {
        await page.select('#physical-scout-destination-0', 'top');
        await transition(page, '#physical-decision-form button[type=submit]');
      }
    } else {
      const choice =
        combat.options.find((o) => o.id === 'close' && !o.unavailable) ??
        combat.options.find((o) => !o.unavailable);
      await transition(page, `[data-combat-choice="${choice.id}"]`);
    }
  }
  s = await readSession(r.host);
  assert.equal(s.journey.heroes[0].spaceId, to);
  assert.equal(s.journey.travel.remaining, 1);
  assert.equal(s.round.heroes[0].actionsUsed, 1);
  log('UI_FIRST_MOVE_RETURN', { from, to, remaining: s.journey.travel.remaining });
  await capture(personal, 'first-turn', '#map-preview');
  const ax = await personal.call('Accessibility.getFullAXTree');
  await writeFile(join(directory, 'accessibility.json'), JSON.stringify(ax, null, 2));
  const errors = browser.events.filter(
    (e) =>
      e.method === 'Runtime.exceptionThrown' ||
      (e.method === 'Log.entryAdded' && e.params.entry.level === 'error'),
  );
  assert.equal(errors.length, 0, JSON.stringify(errors));
  const final = await readBackup(r.host);
  report.final = {
    phase: s.scenario.phase,
    archives: final.payload.state.episodes.length,
    actionsUsed: s.round.heroes[0].actionsUsed,
    bytes: Buffer.byteLength(JSON.stringify(final)),
    consoleErrors: 0,
  };
  await writeFile(join(directory, 'final.private.json'), JSON.stringify(final));
  report.status = 'PASS';
  log('UI_FIRST_LEGAL_A3_ACTION', report.final);
} catch (error) {
  report.status = 'FAIL';
  report.error = String(error.stack ?? error);
  console.error(report.error);
  for (const [n, page] of pages.entries()) {
    try {
      await writeFile(
        join(directory, `failure-dom-${n}.json`),
        JSON.stringify(
          await page.read(
            '({campaign:document.querySelector("#campaign")?.innerText,scenario:document.querySelector("#scenario")?.innerText,physical:document.querySelector("#physical-resolution")?.innerText})',
          ),
        ),
      );
      await page.shot(join(directory, `failure-${n}.png`));
    } catch {}
  }
  if (r) {
    await writeFile(join(directory, 'host.stderr'), r.host.diagnostics());
    try {
      await writeFile(
        join(directory, 'failure-session.private.json'),
        JSON.stringify(await readSession(r.host)),
      );
    } catch {}
  }
  process.exitCode = 1;
} finally {
  if (browser) report.browserCleanup = await browser.close();
  for (const cleanup of cleanups.reverse()) await cleanup();
  report.ownedHostsStopped = true;
  await writeFile(join(directory, 'report.private.json'), JSON.stringify(report, null, 2));
  console.log('QA_REPORT ' + join(directory, 'report.private.json'));
}
