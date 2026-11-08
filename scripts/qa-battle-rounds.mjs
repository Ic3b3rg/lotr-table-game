// Finite invented camp bootstrap; all subsequent game writes use native owner controls.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { readyBattleRounds } from '../tests/battle-rounds-helper.mjs';
import { reachDepartureCamp } from '../tests/camp-departure-helper.mjs';
import { readSession, readBackup } from '../tests/battle-combat-helper.mjs';
import { terrainPolicy } from '../tests/fixtures/battle-test-terrain.mjs';
import { ownBrowser, until } from './qa-camp-browser.mjs';
const outcome = process.argv[2] ?? 'win';
assert.ok(['win', 'loss'].includes(outcome));
const directory = resolve('.scratch/battle-rounds142/native', outcome + '-' + Date.now());
await mkdir(directory, { recursive: true });
const cleanups = [],
  t = { after: (fn) => cleanups.push(fn) },
  report = {
    outcome,
    invented: true,
    originalGameplay: false,
    steps: [],
    captures: [],
    inspectedImages: [],
    viewports: [],
    errors: [],
  };
let browser, r, pages;
const log = (step, data = {}) => {
  report.steps.push({ step, ...data });
  console.log(JSON.stringify({ step, ...data }));
};
try {
  r = await readyBattleRounds(t, {
    outcome,
    roleScout: true,
    sourceEdit: (departure) => {
      departure.combat.testTerrain = terrainPolicy();
    },
  });
  await reachDepartureCamp(r);
  await writeFile(
    join(directory, 'owners.private.json'),
    JSON.stringify(
      r.actors.map((a) => ({
        playerId: a.body.player.id,
        name: a.body.player.name,
        recoveryCode: a.recoveryCode,
      })),
    ),
    { mode: 0o600 },
  );
  const bootstrap = await readBackup(r.host);
  assert.equal(bootstrap.payload.state.scenario.conclusion.stage, 'camp');
  report.bootstrap = {
    declaredAt: new Date().toISOString(),
    heroes: 3,
    boundary:
      'Finite invented cards/stats/stock and actual prior source outcome reach camp. Subsequent game mutations use native UI only.',
    bytes: Buffer.byteLength(JSON.stringify(bootstrap)),
  };
  log('DECLARED_INVENTED_CAMP_BOOTSTRAP', report.bootstrap);
  browser = await ownBrowser(directory);
  report.browser = await browser.send('Browser.getVersion');
  pages = [await browser.page(r.host.url + '/', 1440)];
  for (const width of [320, 768, 1024]) pages.push(await browser.page(r.host.url + '/join', width));
  for (const [n, actor] of r.actors.entries()) {
    const page = pages[n + 1];
    await until(() => page.visible('#recover-details'), 'recovery form');
    await page.click('#recover-details > summary');
    await page.type('#recover-code', actor.recoveryCode);
    await page.click('#recover-form button[type=submit]');
    await until(
      () =>
        page.read(
          `document.querySelector('#welcome').textContent===${JSON.stringify(actor.body.player.name)}`,
        ),
      'independent identity',
    );
  }
  async function transition(page, selector) {
    const before = (await readSession(r.host)).revision;
    await page.syncRevision(before);
    await page.click(selector);
    const next = await until(
      async () => {
        const s = await readSession(r.host);
        return s.revision > before ? s : null;
      },
      selector + ' persisted',
      25000,
    );
    await page.syncRevision(next.revision);
    return next;
  }
  async function shot(page, name, selector) {
    if (selector) {
      await until(() => page.visible(selector), 'capture ' + name);
      await page.call('DOM.scrollIntoViewIfNeeded', { nodeId: await page.node(selector) });
    }
    await page.shot(join(directory, name + '.png'));
    report.captures.push(name + '.png');
  }
  async function layouts(stage, selector) {
    for (const [n, width] of [1440, 320, 768, 1024].entries()) {
      const p = pages[n];
      await p.syncRevision((await readSession(r.host)).revision);
      const layout = await p.read(
        '({width:innerWidth,document:document.documentElement.scrollWidth,guide:!document.querySelector("#open-guide").disabled})',
      );
      assert.equal(layout.width, width);
      assert.ok(layout.document <= width + 1, JSON.stringify(layout));
      assert.ok(layout.guide);
      report.viewports.push({ stage, ...layout });
      await shot(p, stage + '-' + width, selector);
    }
  }
  await transition(pages[1], '#campaign-heroes > button');
  for (let n = 0; n < 3; n++) await transition(pages[n + 1], `[data-camp-confirm="hero-${n + 1}"]`);
  await pages[1].click('[data-preparation-hero="hero-1"] .physical-card');
  await until(() => pages[1].visible('#card-reader'), 'reader');
  await shot(pages[1], 'reader-320');
  await pages[1].key('Escape');
  assert.ok(await pages[1].read('document.activeElement.classList.contains("physical-card")'));
  await pages[1].click('#open-guide');
  await pages[1].type('#guide-search', 'ombra');
  assert.match(
    await pages[1].read('document.querySelector("#guide-articles").innerText'),
    /minaccia/i,
  );
  await shot(pages[1], 'guide-320');
  await pages[1].click('#close-guide');
  await pages[1].click('#camp-departure-agreed');
  await transition(pages[1], '[data-camp-depart]');
  let checkedWaiting = false,
    reloaded = false;
  async function drain() {
    for (let n = 0; n < 1800; n++) {
      const s = await readSession(r.host),
        q = s.physical.active,
        source = s.scenario.pending,
        combat = s.combat.pending;
      if ((!q && !source && !combat) || s.scenario.conclusion?.stage === 'camp') return s;
      const playerId = q?.actorPlayerId ?? source?.actorPlayerId ?? combat?.actorPlayerId;
      const owner = Math.max(
          0,
          r.actors.findIndex((a) => a.body.player.id === playerId),
        ),
        page = pages[owner + 1];
      await page.syncRevision(s.revision);
      if (q) {
        assert.equal(q.kind, 'decision', q.reason);
        await until(() => page.visible('#physical-decision-form'), 'actual physical choice');
        if (!checkedWaiting) {
          const waiter = pages[((owner + 1) % 3) + 1];
          await waiter.syncRevision(s.revision);
          assert.equal(await waiter.visible('#physical-decision-form'), false);
          assert.match(
            await waiter.read('document.querySelector("#physical-resolution").innerText'),
            /In attesa/,
          );
          await shot(page, 'physical-owner');
          await shot(waiter, 'physical-waiter');
          checkedWaiting = true;
        }
        if (q.mode === 'choose') {
          const slots = s.physical.attackTest?.slots
            .filter((x) => q.options.some((o) => o.id === 'slot:' + x.id && !o.unavailable))
            .sort((a, b) => b.cost - a.cost);
          const id = slots?.[0]
            ? 'slot:' + slots[0].id
            : (['reveal', 'resolve', 'apply', 'close', 'close-rest', 'keep'].find((id) =>
                q.options.some((o) => o.id === id && !o.unavailable),
              ) ?? q.options.find((o) => !o.unavailable).id);
          await transition(page, `#physical-decision-form [data-option=${JSON.stringify(id)}]`);
        } else if (q.mode === 'allocate') {
          const budget = q.purpose === 'negation' ? q.maximum : 0,
            damage = Math.min(budget, q.remaining.damage),
            fear = Math.min(budget - damage, q.remaining.fear);
          await page.select('#physical-damage', String(damage));
          await page.select('#physical-fear', String(fear));
          await transition(page, '#physical-decision-form button[type=submit]');
        } else if (q.mode === 'select') {
          const ids = await page.read(
            '[...document.querySelectorAll("#physical-decision-form input[type=checkbox]")].map(e=>e.value)',
          );
          for (const id of ids.slice(0, q.minimum))
            await page.click(`#physical-decision-form input[value=${JSON.stringify(id)}]`);
          await transition(page, '#physical-decision-form button[type=submit]');
        } else {
          if (!reloaded && s.round?.phase === 'rally') {
            const before = (await readBackup(r.host)).payload;
            await page.call('Page.reload');
            await until(
              () => page.visible('#physical-decision-form'),
              'pending Scout survives reload',
            );
            assert.deepEqual((await readBackup(r.host)).payload, before);
            reloaded = true;
            await shot(page, 'rally-scout-reloaded');
          }
          await page.select('#physical-scout-destination-0', 'top');
          await transition(page, '#physical-decision-form button[type=submit]');
        }
      } else if (source && s.scenario.conclusion) {
        await until(
          () =>
            page.read(
              `document.querySelector('#campaign').dataset.request===${JSON.stringify(source.id)}`,
            ),
          'current conclusion request',
        );
        await transition(page, '#campaign-next');
      } else if (source) {
        await until(
          () =>
            page.read(
              `document.querySelector('#scenario').dataset.request===${JSON.stringify(source.id)}`,
            ),
          'source request binding',
          25000,
        );
        await transition(page, '#scenario-next');
      } else {
        const id =
          combat.options.find((o) => o.id === 'close' && !o.unavailable)?.id ??
          combat.options.find((o) => !o.unavailable).id;
        await transition(page, `[data-combat-choice=${JSON.stringify(id)}]`);
      }
    }
    throw Error('Native closure did not return');
  }
  let s = await drain();
  assert.equal(s.scenario.handoffCount, 1);
  await layouts('battle-start', '#rounds');
  async function agree(page) {
    if (!(await page.read('document.querySelector("#round-agreed").checked')))
      await page.click('#round-agreed');
  }
  async function turn(index) {
    const p = pages[index + 1],
      hero = s.preparation.heroes.find((h) => h.playerId === r.actors[index].body.player.id);
    await p.syncRevision(s.revision);
    await p.select('#round-hero', hero.heroId);
    await agree(p);
    s = await transition(p, '#round-confirm');
  }
  const scouts = [];
  for (let round = 1; round <= (outcome === 'win' ? 6 : 1); round++) {
    for (let n = 0; n < 3; n++) {
      if (s.round.heroes[n].turnEnded) continue;
      await turn(n);
      await transition(pages[n + 1], '#round-end-turn');
      s = await drain();
    }
    await agree(pages[1]);
    s = await transition(pages[1], '#round-confirm');
    log('UI_BEGIN_SHADOW', { round });
    s = await drain();
    assert.equal(s.round.shadowStep, 'threat');
    assert.equal(s.scenario.battleRound.change.delta, 7);
    await layouts('threat-' + round, '#rounds');
    await agree(pages[2]);
    s = await transition(pages[2], '#round-confirm');
    s = await drain();
    const full = (await readBackup(r.host)).payload.state;
    log('UI_SOURCE_BOUNDARY', {
      round,
      threat: full.scenario.globals.battlePressure,
      thresholds: full.scenario.rounds.frames.at(-1).handled,
      stage: full.scenario.rounds.frames.at(-1).stage,
      registeredTimers: full.scenario.pack.timers.length,
    });
    if (s.scenario.conclusion) {
      assert.equal(s.scenario.conclusion.outcome, 'failure');
      assert.equal(full.scenario.globals.battlePressure, 42);
      await layouts('source-terminal', '#campaign');
      break;
    }
    assert.equal(s.round.phase, 'rally');
    for (let n = 0; n < 3; n++) {
      const p = pages[n + 1],
        hero = s.preparation.heroes.find((h) => h.playerId === r.actors[n].body.player.id);
      await p.syncRevision(s.revision);
      await p.select('#scout-hero', hero.heroId);
      s = await transition(p, '#rally-scout');
      s = await drain();
      scouts.push({ round, owner: n + 1 });
    }
    assert.ok(s.round.heroes.every((h) => h.rallyDone));
    await agree(pages[3]);
    s = await transition(pages[3], '#round-confirm');
    assert.equal(s.round.number, round + 1);
    log('UI_THREE_OWNER_RALLY_NEW_ROUND', { round: s.round.number });
    if (round === 1) {
      await turn(0);
      await transition(pages[1], '#start-travel');
      s = await readSession(r.host);
      const from = s.journey.heroes[0].spaceId,
        to = s.journey.definition.connections
          .flatMap(([a, b]) => (a === from ? [b] : b === from ? [a] : []))
          .find((id) => id !== from);
      assert.ok(to);
      await pages[1].select('#map-destination', to);
      s = await transition(pages[1], '#move-hero');
      s = await drain();
      assert.equal(s.round.heroes[0].actionsUsed, 1);
      log('UI_LEGAL_NEXT_ROUND_MOVE', { round: 2 });
      await transition(pages[1], '#round-end-turn');
      s = await drain();
      // Remaining owners still take their full turns in the next iteration.
    }
    if (outcome === 'loss') break;
  }
  report.scouts = scouts;
  report.reloaded = reloaded;
  report.checkedWaiting = checkedWaiting;
  const last = await readBackup(r.host);
  await writeFile(join(directory, 'final.private.json'), JSON.stringify(last));
  assert.equal(last.payload.state.scenario.pack.timers.length, 0);
  for (const p of pages) {
    assert.equal(await p.read('document.querySelector("#personal").hidden'), p === pages[0]);
    const body = await p.read('document.body.innerText');
    for (const value of [
      'battleRounds',
      'scriptedGroups',
      'bannerPools',
      'battleRecipe',
      'recoveryHash',
      'source-battle-shadow-v1',
    ])
      assert.ok(!body.includes(value), value);
  }
  report.errors = browser.events.filter(
    (e) =>
      e.method === 'Runtime.exceptionThrown' ||
      (e.method === 'Log.entryAdded' && e.params.entry.level === 'error') ||
      (e.method === 'Network.responseReceived' && e.params.response.status >= 500),
  );
  assert.deepEqual(report.errors, []);
  report.result = 'PASS';
} catch (error) {
  report.result = 'FAIL';
  report.error = String(error.stack ?? error);
  if (r)
    await writeFile(
      join(directory, 'failure.private.json'),
      JSON.stringify(await readBackup(r.host)),
    ).catch(() => {});
  if (pages)
    for (const [n, p] of pages.entries())
      await p.shot(join(directory, 'failure-' + n + '.png')).catch(() => {});
  throw error;
} finally {
  if (browser) {
    report.events = browser.events.filter(
      (e) =>
        e.method === 'Runtime.exceptionThrown' ||
        (e.method === 'Network.responseReceived' && e.params.response.status >= 400),
    );
    report.cleanup = await browser.close();
  }
  for (const cleanup of cleanups.reverse()) await cleanup();
  await writeFile(join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify({
      report: join(directory, 'report.json'),
      result: report.result,
      cleanup: report.cleanup,
    }),
  );
}
