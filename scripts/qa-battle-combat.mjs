// Manual battle-combat acceptance: declared invented finite camp bootstrap, then UI input only.
// Uses only hosts, browser contexts, profiles and files created by this invocation.
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { once } from 'node:events';
import {
  readyBattle as readyDeparture,
  readSession,
  readBackup,
} from '../tests/battle-combat-helper.mjs';
import { reachDepartureCamp } from '../tests/camp-departure-helper.mjs';
import { startHost } from '../tests/host-helper.mjs';
import { ownBrowser, until, pause } from './qa-camp-browser.mjs';
const outcome = process.argv[2] ?? 'win';
assert.ok(['win', 'loss'].includes(outcome));
const directory = resolve(
  process.env.LOTR_QA_OUTPUT_DIR ?? '.scratch/battle-combat137/native',
  `${outcome}-${Date.now()}`,
);
await mkdir(directory, { recursive: true });
const cleanups = [],
  ownedHosts = [],
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
  r = await readyDeparture(t, { outcome, roleScout: true, singleFigureGroups: true });
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

  // Ada's first source turn demonstrates the real wall. Bruno now attacks and
  // leaves the adjacent group with residual travel; every choice below is native.
  await personal.select('#map-destination', s.journey.definition.startSpaceId);
  await transition(personal, '#move-hero');
  await transition(personal, '#round-end-turn');
  const attacker = pages[2];
  await attacker.click('#round-agreed');
  await transition(attacker, '#round-confirm');
  await transition(attacker, '#start-travel');
  s = await readSession(r.host);
  const hero = s.preparation.heroes.find((h) => h.playerId === r.actors[1].body.player.id),
    from = s.journey.heroes.find((h) => h.heroId === hero.heroId).spaceId;
  const adjacent = s.journey.definition.connections.flatMap(([a, b]) =>
    a === from ? [b] : b === from ? [a] : [],
  );
  const group = s.scenario.enemies.groups.find((g) =>
    adjacent.includes(s.scenario.spaceBindings.find((b) => b.sourceId === g.spaceId).id),
  );
  assert.ok(group);
  const destination = s.scenario.spaceBindings.find((b) => b.sourceId === group.spaceId).id;
  await attacker.select('#map-destination', destination);
  await transition(attacker, '#move-hero');
  await until(() => attacker.visible('#combat-setup > summary'), 'attack offer');
  await attacker.click('#combat-setup > summary');
  const targetLabels = await attacker.read(
    '[...document.querySelector("#combat-target").options].map(o=>o.textContent)',
  );
  assert.equal(
    new Set(targetLabels).size,
    targetLabels.length,
    'Distinct battle groups need distinct native target labels',
  );
  assert.match(
    await attacker.read('document.querySelector("#start-instruction").innerText'),
    /atta(?:ccare|cchi)/i,
  );
  assert.match(
    await attacker.read('document.querySelector("#scenario-limit").innerText'),
    /Attacchi e provocazioni/,
  );
  await attacker.select('#combat-target', group.id);
  const beforeAttack = (await readBackup(r.host)).payload;
  await attacker.click('#combat-cancel');
  assert.deepEqual((await readBackup(r.host)).payload, beforeAttack);
  await attacker.click('#combat-setup > summary');
  await attacker.click('.combat-weapon-card .physical-card');
  await until(() => attacker.visible('#card-reader'), 'attack weapon reader');
  await attacker.shot(join(directory, 'attack-reader.png'));
  await attacker.key('Escape');
  assert.equal(
    await attacker.read('document.activeElement.classList.contains("physical-card")'),
    true,
  );
  for (const width of [320, 768, 1024, 1440]) {
    await attacker.size(width);
    await attacker.read('document.fonts.ready.then(()=>true)');
    await pause(250);
    const layout = await attacker.read(
      '({width:innerWidth,document:document.documentElement.scrollWidth,labels:[...document.querySelectorAll("#combat-form select")].every(e=>!!e.closest("label")),cost:document.querySelector("#combat-confirm").innerText,previewText:getComputedStyle(document.querySelector(".combat-preview")).color,helperText:getComputedStyle(document.querySelector(".combat-preview .company-help")).color,previewBackground:getComputedStyle(document.querySelector(".combat-preview")).backgroundColor})',
    );
    assert.ok(layout.document <= width + 1, JSON.stringify(layout));
    assert.ok(layout.labels);
    assert.match(layout.cost, /1 azione/);
    const luminance = (color) => {
      const [r, g, b] = color
        .match(/[\d.]+/g)
        .slice(0, 3)
        .map((part) => {
          const channel = Number(part) / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    for (const color of [layout.previewText, layout.helperText]) {
      const [a, b] = [luminance(color), luminance(layout.previewBackground)].sort((x, y) => y - x);
      assert.ok((a + 0.05) / (b + 0.05) >= 4.5, 'Attack preview text needs normal-text contrast');
    }
    report.viewports.push({ stage: 'attack', ...layout });
    await attacker.call('DOM.scrollIntoViewIfNeeded', {
      nodeId: await attacker.node('#combat-form'),
    });
    await attacker.shot(join(directory, `attack-${width}.png`));
  }
  await attacker.size(320);
  await transition(attacker, '#combat-confirm');
  log('UI_REAL_ATTACK_ONE_ACTION');
  let spentInspiration = false,
    viewedReply = false,
    reloadedAttack = false;
  const drain = async () => {
    for (let n = 0; n < 200; n++) {
      s = await readSession(r.host);
      const q = s.physical.active,
        c = s.combat.current,
        pending = s.combat.pending;
      if (!q && !c && !pending) return;
      const actor = q?.actorPlayerId ?? pending?.actorPlayerId,
        index = r.actors.findIndex((a) => a.body.player.id === actor),
        page = pages[index + 1];
      assert.ok(page);
      await page.syncRevision(s.revision);
      if (q) {
        assert.equal(
          q.kind,
          'decision',
          'Native acceptance must resolve the actual supported physical consumer',
        );
        await until(() => page.visible('#physical-decision-form'), 'current physical controls');
        const waiter = pages[((index + 1) % 3) + 1];
        await waiter.syncRevision(s.revision);
        assert.equal(await waiter.visible('#physical-decision-form'), false);
        if (c?.stage === 'counterattack' && !viewedReply) {
          assert.equal(c.packet.executed, true);
          viewedReply = true;
          for (const width of [320, 768, 1024, 1440]) {
            await page.size(width);
            await pause(250);
            const layout = await page.read(
              '({width:innerWidth,document:document.documentElement.scrollWidth,status:document.querySelector("#physical-resolution").innerText})',
            );
            assert.ok(layout.document <= width + 1, JSON.stringify(layout));
            report.viewports.push({ stage: 'enemy-reply', width, document: layout.document });
            await page.call('DOM.scrollIntoViewIfNeeded', {
              nodeId: await page.node('#physical-decision-form'),
            });
            await page.shot(join(directory, `enemy-reply-${width}.png`));
          }
          await page.size(320);
          const prior = (await readBackup(r.host)).payload;
          await page.call('Page.reload');
          await until(() => page.visible('#physical-decision-form'), 'pending attack reload');
          assert.deepEqual((await readBackup(r.host)).payload, prior);
          reloadedAttack = true;
          log('UI_ENEMY_PHYSICAL_REPLY_AND_RELOAD');
        }
        if (q.mode === 'choose') {
          const slot = s.physical.attackTest?.slots
            .filter((slot) => q.options.some((o) => o.id === `slot:${slot.id}` && !o.unavailable))
            .sort((a, b) => b.cost - a.cost)[0];
          let option;
          if (
            !spentInspiration &&
            c?.stage === 'attack-test' &&
            q.options.some((o) => o.id === 'inspiration' && !o.unavailable)
          ) {
            option = 'inspiration';
            spentInspiration = true;
          } else
            option =
              (slot ? `slot:${slot.id}` : null) ??
              ['reveal', 'resolve', 'apply', 'close', 'close-rest', 'keep'].find((id) =>
                q.options.some((o) => o.id === id && !o.unavailable),
              ) ??
              q.options.find((o) => !o.unavailable).id;
          await transition(page, `#physical-decision-form [data-option="${option}"]`);
        } else if (q.mode === 'select') {
          const boxes = await page.read(
            '[...document.querySelectorAll("#physical-decision-form input[type=checkbox]")].map(e=>e.value)',
          );
          for (const value of boxes.slice(0, q.minimum))
            await page.click(`#physical-decision-form input[value="${value}"]`);
          await transition(page, '#physical-decision-form button[type=submit]');
        } else if (q.mode === 'allocate')
          await transition(page, '#physical-decision-form button[type=submit]');
        else if (q.mode === 'scout') {
          await page.select('#physical-scout-destination-0', 'top');
          await transition(page, '#physical-decision-form button[type=submit]');
        } else throw Error('Unexpected physical decision ' + q.mode);
      } else {
        assert.ok(pending);
        await until(() => page.visible('#combat .combat-choices'), 'combat source request');
        const choice = pending.options.filter((o) => !o.unavailable).at(-1);
        assert.ok(choice);
        await transition(page, `[data-combat-choice="${choice.id}"]`);
      }
    }
    throw Error('Native battle did not return');
  };
  await drain();
  let full = (await readBackup(r.host)).payload.state,
    attempt = full.combat.attempts[0];
  assert.equal(attempt.returned, true);
  assert.equal(attempt.packet.executed, true);
  assert.ok(attempt.result.hits > 0);
  assert.ok(attempt.outcome.suffered.damage + attempt.outcome.suffered.fear > 0);
  assert.ok(spentInspiration && viewedReply && reloadedAttack);
  s = await readSession(r.host);
  assert.equal(s.round.heroes.find((h) => h.heroId === hero.heroId).actionsUsed, 2);
  assert.equal(s.journey.travel.remaining, 1);
  await attacker.syncRevision(s.revision);
  await attacker.call('DOM.scrollIntoViewIfNeeded', { nodeId: await attacker.node('#combat') });
  await attacker.shot(join(directory, 'ordinary-source-return-320.png'));
  log('UI_ATTACK_SOURCE_RETURN', { actions: 2, residual: 1, hits: attempt.result.hits });
  await attacker.select('#map-destination', from);
  await transition(attacker, '#move-hero');
  s = await readSession(r.host);
  assert.ok(s.combat.pending);
  assert.equal(s.journey.heroes.find((h) => h.heroId === hero.heroId).spaceId, destination);
  assert.equal(s.journey.travel.remaining, 1);
  const order = s.combat.pending.options;
  assert.ok(order.length >= 1);
  assert.ok(
    order.every((o) => o.id !== group.id),
    'Exhausted reply group is excluded',
  );
  await until(
    () =>
      attacker.read(
        'document.querySelector("#start-title").innerText === "Scegli l’ordine delle provocazioni"',
      ),
    'rendered provocation guide',
  );
  assert.equal(
    await attacker.read('document.querySelector("#start-title").innerText'),
    'Scegli l’ordine delle provocazioni',
  );
  for (const width of [320, 768, 1024, 1440]) {
    await attacker.size(width);
    await pause(250);
    const dimensions = await attacker.read(
      '({width:innerWidth,document:document.documentElement.scrollWidth})',
    );
    assert.ok(dimensions.document <= width + 1);
    report.viewports.push({ stage: 'provocation-order', ...dimensions });
    await attacker.call('DOM.scrollIntoViewIfNeeded', { nodeId: await attacker.node('#combat') });
    await attacker.shot(join(directory, `provocation-order-${width}.png`));
  }
  await attacker.size(320);
  await drain();
  s = await readSession(r.host);
  full = (await readBackup(r.host)).payload.state;
  assert.equal(s.journey.heroes.find((h) => h.heroId === hero.heroId).spaceId, from);
  assert.equal(s.journey.travel.remaining, 0);
  assert.equal(full.combat.operations.at(-1).status, 'returned');
  assert.deepEqual(full.combat.operations.at(-1).provoked[0], order.at(-1).id);
  assert.ok(full.combat.attempts.every((a) => a.returned));
  log('UI_PROVOCATION_CHOSEN_ORDER_AND_RETURN', {
    readyChoices: order.length,
    attempts: full.combat.attempts.length,
    residual: 0,
  });
  // Carla's ordinary turn makes a multi-group order explicit even when the
  // attacked cell had just one ready group left. Choose using live public
  // positions; never select a seed or reduce the deployment population.
  await transition(attacker, '#round-end-turn');
  const thirdOwner = pages[3];
  await thirdOwner.click('#round-agreed');
  await transition(thirdOwner, '#round-confirm');
  s = await readSession(r.host);
  const thirdHero = s.preparation.heroes.find((h) => h.playerId === r.actors[2].body.player.id),
    thirdStart = s.journey.heroes.find((h) => h.heroId === thirdHero.heroId).spaceId,
    readyCounts = new Map();
  for (const g of s.scenario.enemies.groups.filter(
    (g) => g.placed && !g.exhausted && g.figures.some((f) => f.health > 0),
  )) {
    const cell = s.scenario.spaceBindings.find((b) => b.sourceId === g.spaceId).id;
    readyCounts.set(cell, (readyCounts.get(cell) ?? 0) + 1);
  }
  const routes = [[thirdStart]],
    seen = new Set([thirdStart]);
  let route;
  while (routes.length) {
    const candidate = routes.shift(),
      here = candidate.at(-1);
    if ((readyCounts.get(here) ?? 0) >= 2) {
      route = candidate;
      break;
    }
    for (const next of s.journey.definition.connections.flatMap(([a, b]) =>
      a === here ? [b] : b === here ? [a] : [],
    ))
      if (!seen.has(next)) {
        seen.add(next);
        routes.push([...candidate, next]);
      }
  }
  assert.ok(
    route && route.length <= 4,
    'A complete invented deployment must support a multi-group choice within ordinary travel',
  );
  for (const destination of route.slice(1)) {
    s = await readSession(r.host);
    if (!s.journey.travel?.remaining) await transition(thirdOwner, '#start-travel');
    await thirdOwner.select('#map-destination', destination);
    await transition(thirdOwner, '#move-hero');
    await drain();
  }
  s = await readSession(r.host);
  if (!s.journey.travel?.remaining) await transition(thirdOwner, '#start-travel');
  s = await readSession(r.host);
  const multiFrom = s.journey.heroes.find((h) => h.heroId === thirdHero.heroId).spaceId,
    multiTo =
      route.length > 1
        ? route.at(-2)
        : s.journey.definition.connections.flatMap(([a, b]) =>
            a === multiFrom ? [b] : b === multiFrom ? [a] : [],
          )[0],
    multiBefore = s.journey.travel.remaining;
  await thirdOwner.select('#map-destination', multiTo);
  await transition(thirdOwner, '#move-hero');
  s = await readSession(r.host);
  const multiOrder = s.combat.pending;
  assert.ok(
    multiOrder && multiOrder.options.length >= 2,
    'Native acceptance must actually offer multiple ready groups',
  );
  await until(
    () => thirdOwner.visible('#combat .combat-choices'),
    'multiple native provocation choices',
  );
  assert.equal(
    await thirdOwner.read('document.querySelector("#round-end-turn").disabled'),
    true,
    'Turn return waits for all chosen provocations',
  );
  assert.equal(
    await thirdOwner.read('document.querySelector("#move-hero").disabled'),
    true,
    'Suspended movement cannot be submitted again',
  );
  for (const width of [320, 768, 1024, 1440]) {
    await thirdOwner.size(width);
    const dimensions = await thirdOwner.read(
      '({width:innerWidth,document:document.documentElement.scrollWidth})',
    );
    assert.ok(dimensions.document <= width + 1);
    report.viewports.push({ stage: 'multiple-provocation-order', ...dimensions });
    await thirdOwner.call('DOM.scrollIntoViewIfNeeded', {
      nodeId: await thirdOwner.node('#combat'),
    });
    await thirdOwner.shot(join(directory, `multiple-provocation-order-${width}.png`));
  }
  await thirdOwner.size(320);
  await drain();
  s = await readSession(r.host);
  full = (await readBackup(r.host)).payload.state;
  const multiOperation = full.combat.operations.at(-1);
  assert.equal(multiOperation.status, 'returned');
  assert.equal(multiOperation.playerId, r.actors[2].body.player.id);
  assert.equal(multiOperation.provoked[0], multiOrder.options.at(-1).id);
  assert.deepEqual(new Set(multiOperation.provoked), new Set(multiOrder.options.map((o) => o.id)));
  assert.equal(s.journey.heroes.find((h) => h.heroId === thirdHero.heroId).spaceId, multiTo);
  assert.equal(s.journey.travel.remaining, multiBefore - 1);
  log('UI_THIRD_OWNER_MULTIPLE_READY_ORDER_AND_RETURN', {
    choices: multiOrder.options.length,
    provocations: multiOperation.provoked.length,
    residual: s.journey.travel.remaining,
  });
  report.battle = {
    sourceAttackReturned: true,
    enemyPhysicalReply: true,
    inspirationSpent: spentInspiration,
    attackReload: reloadedAttack,
    provocationChoices: Math.max(order.length, multiOrder.options.length),
    thirdOwnerMultipleReadyOrder: true,
    ordinaryReturn: true,
  };
  await writeFile(
    join(directory, 'final-private-backup.json'),
    JSON.stringify(await readBackup(r.host)),
  );

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
    actionsUsed: s.round.heroes.find((h) => h.heroId === hero.heroId).actionsUsed,
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
