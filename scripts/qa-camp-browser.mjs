// A dedicated browser only. No discovery of existing profiles, targets or processes.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
export const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function until(check, label, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const value = await check();
    if (value) return value;
    await pause(120);
  }
  throw Error('Timed out: ' + label);
}
export async function ownBrowser(directory) {
  await mkdir(directory, { recursive: true });
  const profile = join(directory, 'profile');
  await mkdir(profile);
  const child = spawn(
    process.env.LOTR_QA_CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    [
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-sync',
      '--disable-component-update',
      '--disable-extensions',
      '--remote-debugging-port=0',
      '--user-data-dir=' + profile,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  let stderr = '';
  child.stderr.on('data', (chunk) => (stderr += chunk));
  child.on('error', () => {});
  let socket;
  const pending = new Map(),
    events = [];
  let sequence = 0;
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++sequence,
        timer = setTimeout(() => {
          pending.delete(id);
          reject(Error('CDP timeout ' + method));
        }, 15000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  try {
    const lines = await until(async () => {
      try {
        return (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).trim().split('\n');
      } catch {
        return null;
      }
    }, 'own Chrome debugging endpoint');
    socket = new WebSocket('ws://127.0.0.1:' + lines[0] + lines[1]);
    await once(socket, 'open');
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const q = pending.get(message.id);
        if (q) {
          pending.delete(message.id);
          clearTimeout(q.timer);
          message.error
            ? q.reject(Error(JSON.stringify(message.error)))
            : q.resolve(message.result);
        }
      } else events.push(message);
    };
  } catch (error) {
    child.kill('SIGTERM');
    await writeFile(join(directory, 'chrome.stderr'), stderr);
    throw error;
  }
  const contexts = [];
  return {
    send,
    events,
    async page(url, width = 1024) {
      const { browserContextId } = await send('Target.createBrowserContext', {
        disposeOnDetach: true,
      });
      contexts.push(browserContextId);
      const { targetId } = await send('Target.createTarget', {
        url: 'about:blank',
        browserContextId,
      });
      const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
      const call = (method, params) => send(method, params, sessionId);
      await call('Page.enable');
      await call('Runtime.enable');
      await call('Network.enable');
      const read = async (expression) => {
        const r = await call('Runtime.evaluate', {
          expression,
          returnByValue: true,
          awaitPromise: true,
        });
        if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
        return r.result.value;
      };
      const node = async (selector) => {
        const { root } = await call('DOM.getDocument');
        const { nodeId } = await call('DOM.querySelector', { nodeId: root.nodeId, selector });
        assert.ok(nodeId, 'Missing ' + selector);
        return nodeId;
      };
      const key = async (key, code = key) => {
        const windowsVirtualKeyCode =
          {
            Home: 36,
            ArrowDown: 40,
            ArrowUp: 38,
            ArrowLeft: 37,
            ArrowRight: 39,
            Enter: 13,
            Escape: 27,
            Tab: 9,
            Space: 32,
          }[key] ?? 0;
        await call('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode });
        await call('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode });
      };
      const page = {
        targetId,
        browserContextId,
        sessionId,
        call,
        read,
        node,
        key,
        async size(width, height = 900) {
          await call('Emulation.setDeviceMetricsOverride', {
            width,
            height,
            deviceScaleFactor: 1,
            mobile: false,
          });
          await pause(250);
          await read('document.fonts.ready.then(()=>true)');
        },
        async navigate(url) {
          await call('Page.navigate', { url });
          await until(() => read('document.readyState === "complete"'), 'page load');
          await until(
            () => read('document.querySelector("#connection")?.textContent === "Collegato al PC"'),
            'connected app',
            25000,
          );
        },
        async syncRevision(revision) {
          await until(
            async () => {
              const event = [...events]
                .reverse()
                .find(
                  (e) =>
                    e.sessionId === sessionId &&
                    e.method === 'Network.responseReceived' &&
                    e.params.response.url.endsWith('/api/session'),
                );
              if (!event) return false;
              try {
                const { body } = await call('Network.getResponseBody', {
                  requestId: event.params.requestId,
                });
                return JSON.parse(body).revision === revision;
              } catch {
                return false;
              }
            },
            'public session revision rendered',
            25000,
          );
          await pause(200);
        },
        async visible(selector) {
          return read(
            `(()=>{const e=document.querySelector(${JSON.stringify(selector)});return !!e&&!!e.getClientRects().length&&!e.closest('[hidden]');})()`,
          );
        },
        async click(selector) {
          await until(() => page.visible(selector), selector + ' visible');
          await until(
            () => read(`!document.querySelector(${JSON.stringify(selector)}).disabled`),
            selector + ' enabled',
          );
          const id = await node(selector);
          await call('DOM.scrollIntoViewIfNeeded', { nodeId: id });
          const { model } = await call('DOM.getBoxModel', { nodeId: id });
          const q = model.content,
            x = (q[0] + q[2] + q[4] + q[6]) / 4,
            y = (q[1] + q[3] + q[5] + q[7]) / 4;
          await call('Input.dispatchMouseEvent', {
            type: 'mousePressed',
            x,
            y,
            button: 'left',
            clickCount: 1,
          });
          await call('Input.dispatchMouseEvent', {
            type: 'mouseReleased',
            x,
            y,
            button: 'left',
            clickCount: 1,
          });
        },
        async type(selector, value) {
          const id = await node(selector);
          await call('DOM.focus', { nodeId: id });
          await call('Input.insertText', { text: value });
        },
        async select(selector, value) {
          await until(() => page.visible(selector), selector + ' visible');
          await until(
            () => read(`!document.querySelector(${JSON.stringify(selector)}).disabled`),
            selector + ' enabled',
          );
          const values = await read(
              `Array.from(document.querySelector(${JSON.stringify(selector)}).options).map(o=>({value:o.value,disabled:o.disabled,label:o.textContent.trim()}))`,
            ),
            enabled = values.filter((o) => !o.disabled),
            target = enabled.find((o) => o.value === value);
          assert.ok(target, 'Unavailable option ' + value);
          let length = 1;
          while (
            length < target.label.length &&
            enabled.filter((o) =>
              o.label
                .toLocaleLowerCase()
                .startsWith(target.label.slice(0, length).toLocaleLowerCase()),
            ).length > 1
          )
            length++;
          await call('Page.bringToFront');
          await call('DOM.focus', { nodeId: await node(selector) });
          for (const char of target.label.slice(0, length)) {
            const upper = char.toUpperCase(),
              code = /[a-z]/i.test(char)
                ? 'Key' + upper
                : /[0-9]/.test(char)
                  ? 'Digit' + char
                  : char === '/'
                    ? 'Slash'
                    : char === ' '
                      ? 'Space'
                      : '';
            const windowsVirtualKeyCode = char === '/' ? 191 : upper.codePointAt(0);
            await call('Input.dispatchKeyEvent', {
              type: 'keyDown',
              key: char,
              code,
              text: char,
              windowsVirtualKeyCode,
            });
            await call('Input.dispatchKeyEvent', {
              type: 'keyUp',
              key: char,
              code,
              windowsVirtualKeyCode,
            });
          }
          assert.equal(
            await read(`document.querySelector(${JSON.stringify(selector)}).value`),
            value,
          );
        },
        async shot(path) {
          const { data } = await call('Page.captureScreenshot', {
            format: 'png',
            captureBeyondViewport: false,
          });
          await writeFile(path, Buffer.from(data, 'base64'));
        },
      };
      await page.size(width);
      await page.navigate(url);
      return page;
    },
    async close() {
      for (const id of contexts)
        await send('Target.disposeBrowserContext', { browserContextId: id }).catch(() => {});
      await send('Browser.close').catch(() => {});
      socket.close();
      if (child.exitCode === null && child.signalCode === null) {
        await Promise.race([once(child, 'exit'), pause(3000)]);
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
      }
      await writeFile(join(directory, 'chrome.stderr'), stderr);
    },
  };
}
