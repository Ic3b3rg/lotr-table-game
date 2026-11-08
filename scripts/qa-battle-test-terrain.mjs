// Manual battle-combat acceptance: declared invented finite camp bootstrap, then UI input only.
// Uses only hosts, browser contexts, profiles and files created by this invocation.
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { once } from 'node:events';
import { readyTerrain as readyDeparture } from '../tests/battle-test-terrain-helper.mjs';
import {
  readSession as rawReadSession,
  readBackup as rawReadBackup,
} from '../tests/battle-combat-helper.mjs';
import { reachDepartureCamp } from '../tests/camp-departure-helper.mjs';
import { startHost } from '../tests/host-helper.mjs';
import { ownBrowser, until, pause } from './qa-camp-browser.mjs';
const kind = process.argv[2] ?? 'fire';
assert.ok(['fire', 'rock'].includes(kind));
const outcome = 'win';
const directory = resolve(
  process.env.LOTR_QA_OUTPUT_DIR ?? '.scratch/battle-terrain139/evidence/native',
  `${kind}-${Date.now()}`,
);
await mkdir(directory, { recursive: true });
const cleanups = [],
  ownedHosts = [],
  t = { after: (fn) => cleanups.push(fn) },
  report = {
    outcome,
    kind,
    diagnostics: [],
    audits: [],
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
const readSession = async (host) => {
  const s = await rawReadSession(host);
  report.diagnostics.push({ kind: 'read-session', revision: s.revision });
  return s;
};
const readBackup = async (host) => {
  const b = await rawReadBackup(host);
  report.diagnostics.push({ kind: 'private-read-backup', revision: b.payload.state.revision });
  return b;
};
try {
  r = await readyDeparture(t, { outcome, kind, roleScout: true });
  ownedHosts.push(r.host);
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
    const persisted = await until(
      async () => {
        const next = await readSession(r.host);
        return next.revision > before ? next : null;
      },
      selector + ' persisted',
      25000,
    );
    await page.syncRevision(persisted.revision);
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
    roleOwners = new Set(),
    introductions = 0,
    objectiveShown = false;
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
    const instruction = full.scenario.pack.manifest.battleStartup.instructions[b.cursor];
    assert.notEqual(q.kind, 'deployment-intro', 'No invented introduction per spawn point');
    if (instruction.op === 'message') {
      assert.equal(introductions++, 0);
      assert.equal(full.scenario.enemies.entropy, null);
      assert.deepEqual(full.scenario.enemies.groups, []);
      assert.ok(
        await page.read(
          `document.querySelector('#scenario').innerText.includes(${JSON.stringify(instruction.text)})`,
        ),
      );
      await page.call('DOM.scrollIntoViewIfNeeded', {
        nodeId: await page.node('#scenario-message'),
      });
      await page.shot(join(directory, 'source-introduction.png'));
      log('UI_SOURCE_INTRO_BEFORE_SPAWN');
    }
    if (q.kind === 'objective') {
      assert.deepEqual(full.scenario.objective.text, [
        { kind: 'text', style: 'plain', text: instruction.objectiveText },
      ]);
      assert.deepEqual(q.text, [{ kind: 'text', style: 'plain', text: instruction.text }]);
      assert.notDeepEqual(q.text, full.scenario.objective.text);
      for (const value of [instruction.text, instruction.objectiveText])
        assert.ok(
          await page.read(
            `document.querySelector('#scenario').innerText.includes(${JSON.stringify(value)})`,
          ),
        );
      await page.call('DOM.scrollIntoViewIfNeeded', {
        nodeId: await page.node('#scenario-message'),
      });
      await page.shot(join(directory, 'source-objective.png'));
      objectiveShown = true;
      log('UI_OBJECTIVE_MESSAGE_AND_SUMMARY_DISTINCT');
    }
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
          ownedHosts.push(r.host);
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
  assert.equal(introductions, 1);
  assert.ok(objectiveShown);
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

  const capture = async (page, stage) => {
    for (const width of [320, 768, 1024, 1440]) {
      await page.size(width);
      const layout = await page.read(
        '({width:innerWidth,document:document.documentElement.scrollWidth,text:document.querySelector("#physical-resolution").innerText,heading:document.querySelector("#start-title").innerText})',
      );
      assert.ok(layout.document <= width + 1, JSON.stringify(layout));
      report.viewports.push({ stage, ...layout });
      await page.call('DOM.scrollIntoViewIfNeeded', {
        nodeId: await page.node('[data-terrain-test]'),
      });
      await page.shot(join(directory, `${stage}-${width}.png`));
      await page.call('DOM.scrollIntoViewIfNeeded', {
        nodeId: await page.node('#physical-decision-form'),
      });
      await page.shot(join(directory, `${stage}-controls-${width}.png`));
    }
    await page.size(320);
  };
  const audit = async (stage) => {
    const full = (await readBackup(r.host)).payload.state,
      session = await readSession(r.host),
      publicSession = JSON.stringify(session);
    const hidden = full.preparation.heroes.flatMap((h) => h.deck),
      held = full.physical.snapshot.resolution.revealed.flatMap((r) => r.cards);
    const known = [
      /^\/preparation\/episode\/heroes\/\d+\/copies\/\d+$/,
      /^\/preparation\/heroes\/\d+\/composition\/\d+$/,
      /^\/scenario\/pack\/manifest\/battleStartup\/deckCatalog\/cards\/\d+\/copies\/\d+$/,
      /^\/scenario\/completedSetup\/\d+\/revealed\/\d+$/,
      /^\/physical\/parents\/\d+\/results\/\d+\/setup\/revealed\/\d+$/,
    ];
    const knownPaths = [];
    const inspect = (v, path = '') => {
      if (Array.isArray(v)) v.forEach((x, n) => inspect(x, path + '/' + n));
      else if (v && typeof v === 'object')
        Object.entries(v).forEach(([k, x]) => inspect(x, path + '/' + k));
      else if (hidden.includes(v)) {
        assert.ok(
          known.some((rule) => rule.test(path)),
          `Unexpected hidden copy association at ${path}`,
        );
        knownPaths.push(path);
      }
    };
    inspect(session);
    const testView = JSON.stringify(session.physical.sourceTest ?? {}),
      options = JSON.stringify(session.physical.active?.options ?? []);
    for (const copy of held) {
      assert.ok(!testView.includes(JSON.stringify(copy)));
      assert.ok(!options.includes(copy), 'Terrain choices use opaque test-bound copy identities');
    }
    for (const h of full.preparation.heroes)
      if (h.deck.length > 1)
        assert.ok(
          !publicSession.includes(JSON.stringify(h.deck)),
          'Hidden deck order stays private',
        );
    for (const page of pages) {
      const dom = await page.read('document.body.outerHTML'),
        controls = await page.read(
          'document.querySelector("#physical-decision-form")?.outerHTML??""',
        );
      for (const copy of [...hidden, ...held])
        assert.ok(
          !controls.includes(copy),
          'No raw hidden/revealed copy association in terrain controls',
        );
      for (const player of full.players) {
        assert.ok(!dom.includes(player.recoveryHash));
        assert.ok(!publicSession.includes(player.recoveryHash));
      }
      for (const secret of [
        full.physical.entropy,
        full.physical.cycle.seed.departure.archiveFingerprint,
      ]) {
        assert.ok(!dom.includes(secret));
        assert.ok(!publicSession.includes(secret));
      }
    }
    report.audits.push({ stage, knownInventoryAndPreviouslyRevealedPaths: knownPaths });
    report.audits.push({ stage, identities: 4, hiddenCopies: hidden.length, passed: true });
  };
  const paid = [];
  for (let owner = 0; owner < 3; owner++) {
    const personal = pages[owner + 1];
    await personal.click('#round-agreed');
    await transition(personal, '#round-confirm');
    await transition(personal, '#start-travel');
    s = await readSession(r.host);
    const offer = s.combat.attacks.find(
      (o) =>
        !o.reason &&
        s.scenario.enemies.groups.some(
          (g) => g.id === o.groupId && !g.exhausted && g.figures.some((f) => f.health > 0),
        ),
    );
    assert.ok(offer, 'Choose a live ready source target without changing any source pool');
    await personal.click('#combat-setup > summary');
    await personal.select('#combat-target', offer.groupId);
    const beforeAttack = (await readBackup(r.host)).payload;
    await transition(personal, '#combat-confirm');
    log('UI_REAL_TERRAIN_ATTACK', { owner: owner + 1, kind });
    let fateCaptured = false,
      used = false,
      captured = false,
      reloaded = false;
    for (let n = 0; n < 200; n++) {
      s = await readSession(r.host);
      const q = s.physical.active,
        p = s.combat.pending;
      if (!q && !p && !s.combat.current) break;
      const actor = q?.actorPlayerId ?? p?.actorPlayerId,
        index = r.actors.findIndex((a) => a.body.player.id === actor),
        page = pages[index + 1];
      assert.ok(page);
      await page.syncRevision(s.revision);
      if (!q) {
        await until(() => page.visible('#combat .combat-choices'), 'source combat choice');
        const choice =
          p.options.find((o) => o.id === 'close' && !o.unavailable) ??
          p.options.find((o) => !o.unavailable);
        await transition(page, `[data-combat-choice="${choice.id}"]`);
        continue;
      }
      assert.equal(q.kind, 'decision');
      await until(() => page.visible('#physical-decision-form'), 'owner physical controls');
      const relevant =
        s.physical.sourceTest?.terrain?.kind === (kind === 'fire' ? 'attack' : 'negate');
      if (relevant && !captured) {
        for (const waiter of [pages[0], ...pages.slice(1).filter((_, i) => i !== index)]) {
          await waiter.syncRevision(s.revision);
          assert.equal(await waiter.visible('#physical-decision-form'), false);
          assert.ok(
            (
              await waiter.read('document.querySelector("#physical-resolution").innerText')
            ).includes('In attesa'),
          );
        }
        assert.ok(
          (await page.read('document.querySelector("#start-instruction").innerText')).includes(
            r.actors[index].body.player.name,
          ),
        );
        await capture(page, `${kind}-owner${owner + 1}-offer`);
        const prior = (await readBackup(r.host)).payload;
        await page.call('Page.reload');
        await until(() => page.visible('#physical-decision-form'), 'pending terrain reload');
        assert.deepEqual((await readBackup(r.host)).payload, prior);
        reloaded = true;
        if (owner === 0) {
          await page.click('.physical-test-cards .physical-card');
          await until(() => page.visible('#card-reader'), 'revealed-card reader');
          await page.shot(join(directory, `${kind}-revealed-reader.png`));
          await page.key('Escape');
          assert.equal(
            await page.read('document.activeElement.classList.contains("physical-card")'),
            true,
          );
          await page.click('#open-guide');
          await page.type('#guide-search', 'falò');
          assert.ok(
            (await page.read('document.querySelector("#guide-articles").innerText')).includes(
              'Punizione',
            ),
          );
          await page.shot(join(directory, `${kind}-terrain-guide.png`));
          await page.click('#close-guide');
          await audit('pending-' + kind);
        }
        captured = true;
      }
      if (kind === 'rock' && relevant && q.mode === 'select' && !fateCaptured) {
        const labels = await page.read(
          '[...document.querySelectorAll("#physical-decision-form label")].map(e=>e.innerText)',
        );
        assert.ok(
          q.options.every((o) => o.label.includes(' · copia ') && labels.includes(o.label)),
        );
        assert.equal(new Set(labels).size, labels.length, 'Fate icons need distinct native labels');
        await capture(page, `${kind}-owner${owner + 1}-fate`);
        fateCaptured = true;
      }
      if (q.mode === 'choose') {
        let option;
        if (relevant && !used && (kind === 'rock' || owner < 2)) {
          option = q.options.find(
            (o) =>
              o.id.startsWith(kind === 'fire' ? 'terrain:fire:' : 'terrain:boulder:') &&
              (kind === 'rock' || o.id.endsWith(':' + (owner === 0 ? 'pierce' : 'smite'))),
          )?.id;
          if (option) {
            used = true;
            paid.push({ owner: owner + 1, kind, option });
          }
        }
        const slot = s.physical.attackTest?.slots
          .filter((slot) => q.options.some((o) => o.id === `slot:${slot.id}` && !o.unavailable))
          .sort((a, b) => b.cost - a.cost)[0];
        option ??=
          (slot ? `slot:${slot.id}` : null) ??
          ['reveal', 'resolve', 'apply', 'close', 'close-rest', 'keep'].find((id) =>
            q.options.some((o) => o.id === id && !o.unavailable),
          ) ??
          q.options.find((o) => !o.unavailable).id;
        await transition(page, `#physical-decision-form [data-option="${option}"]`);
      } else if (q.mode === 'select') {
        for (const choice of q.options.slice(0, q.minimum))
          await page.click(`#physical-decision-form input[value="${choice.id}"]`);
        await transition(page, '#physical-decision-form button[type=submit]');
      } else if (q.mode === 'allocate') {
        const damage = Math.min(q.maximum, q.remaining.damage),
          fear = Math.min(q.maximum - damage, q.remaining.fear);
        await page.select('#physical-damage', String(damage));
        await page.select('#physical-fear', String(fear));
        await transition(page, '#physical-decision-form button[type=submit]');
      } else if (q.mode === 'scout') {
        await page.select('#physical-scout-destination-0', 'top');
        await transition(page, '#physical-decision-form button[type=submit]');
      } else throw Error('Unexpected native terrain mode ' + q.mode);
    }
    const full = (await readBackup(r.host)).payload.state,
      a = full.combat.attempts.at(-1);
    assert.equal(a.returned, true);
    assert.equal(a.packet.executed, true);
    assert.ok(captured && reloaded);
    if (kind === 'fire') {
      if (owner < 2) assert.ok(a.result.modifiers.includes(owner === 0 ? 'pierce' : 'smite'));
      else assert.deepEqual(a.result.modifiers, []);
    } else assert.ok(used && a.outcome.negated.damage + a.outcome.negated.fear > 0);
    assert.equal(full.round.heroes.find((h) => h.heroId === a.heroId).actionsUsed, 2);
    assert.equal(full.journey.travel.remaining, 2);
    assert.deepEqual(full.episodes[0], beforeAttack.state.episodes[0]);
    await personal.syncRevision(full.revision);
    await personal.call('DOM.scrollIntoViewIfNeeded', { nodeId: await personal.node('#combat') });
    await personal.shot(join(directory, `${kind}-owner${owner + 1}-source-return.png`));
    log('UI_TERRAIN_SOURCE_RETURN', { owner: owner + 1, kind, used, actions: 2, residual: 2 });
    await audit('returned-' + kind + '-' + owner);
    if (owner < 2) await transition(personal, '#round-end-turn');
  }
  const consoleErrors = browser.events.filter(
    (e) =>
      e.method === 'Runtime.exceptionThrown' ||
      (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') ||
      (e.method === 'Log.entryAdded' && e.params.entry.level === 'error'),
  );
  assert.equal(consoleErrors.length, 0, JSON.stringify(consoleErrors));
  for (const [index, page] of pages.entries())
    await writeFile(
      join(directory, `accessibility-${index}.json`),
      JSON.stringify(await page.call('Accessibility.getFullAXTree'), null, 2),
    );
  await writeFile(
    join(directory, 'final-private-backup.json'),
    JSON.stringify(await readBackup(r.host)),
  );
  report.paid = paid;
  report.final = {
    threeOwners: true,
    sharedPC: true,
    nativeWritesOnlyAfterBootstrap: true,
    sourceReturns: 3,
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
  const cleanupErrors = [];
  if (browser) {
    await writeFile(join(directory, 'events.json'), JSON.stringify(browser.events, null, 2));
    try {
      report.ownedBrowser = await browser.close();
    } catch (error) {
      cleanupErrors.push(String(error.stack ?? error));
    }
  }
  report.ownedHosts = [];
  for (const host of ownedHosts) {
    try {
      await host.stop();
      report.ownedHosts.push({ url: host.url, stopAwaited: true });
    } catch (error) {
      cleanupErrors.push(String(error.stack ?? error));
    }
  }
  for (const cleanup of cleanups.reverse())
    try {
      await cleanup();
    } catch (error) {
      cleanupErrors.push(String(error.stack ?? error));
    }
  report.cleanupErrors = cleanupErrors;
  if (cleanupErrors.length || report.ownedBrowser?.exited !== true) report.status = 'FAIL';
  await writeFile(join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ directory, status: report.status }));
  assert.deepEqual(cleanupErrors, [], 'Owned resources must close');
  assert.equal(report.ownedBrowser?.exited, true, 'The dedicated owned Chrome process must exit');
}
