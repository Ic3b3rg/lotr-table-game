import { build } from 'esbuild';
import { cp, mkdir } from 'node:fs/promises';

// https://esbuild.github.io/api/#platform
await mkdir('dist/public', { recursive: true });
await build({ entryPoints: ['src/server/main.ts'], bundle: true, packages: 'external', platform: 'node', format: 'esm', target: 'node24', outfile: 'dist/host.mjs' });
await build({ entryPoints: ['src/client/app.ts'], bundle: true, platform: 'browser', format: 'esm', target: ['safari15', 'chrome100'], outfile: 'dist/public/app.js' });
await cp('src/client/index.html', 'dist/public/index.html');
await cp('src/client/style.css', 'dist/public/style.css');
