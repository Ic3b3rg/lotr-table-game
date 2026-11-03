import { build } from 'esbuild';
import { cp, mkdir } from 'node:fs/promises';

// https://esbuild.github.io/api/#platform
await mkdir('dist/public', { recursive: true });
await build({
  entryPoints: ['src/server/main.ts'],
  bundle: true,
  packages: 'external',
  platform: 'node',
  format: 'esm',
  target: 'node24',
  outfile: 'dist/host.mjs',
});
await build({
  entryPoints: ['src/map-geometry/main.ts'],
  bundle: true,
  packages: 'external',
  platform: 'node',
  format: 'esm',
  target: 'node24',
  outfile: 'dist/map-geometry.mjs',
});
await build({
  entryPoints: ['src/map-generation/primitives.ts'],
  bundle: true,
  packages: 'external',
  platform: 'node',
  format: 'esm',
  target: 'node24',
  outfile: 'dist/map-primitives.mjs',
});
for (const [entry, outfile] of [
  ['src/map-selection/main.ts', 'dist/map-selection.mjs'],
  ['src/map-assembly/main.ts', 'dist/map-assembly.mjs'],
  ['src/map-assembly/assembly.ts', 'dist/map-assembly-library.mjs'],
  ['src/map-selection/selection.ts', 'dist/map-selection-library.mjs'],
  ['src/map-encounters/main.ts', 'dist/map-encounters.mjs'],
  ['src/map-encounters/encounters.ts', 'dist/map-encounters-library.mjs'],
  ['src/scenario/index.ts', 'dist/scenario-library.mjs'],
  ['src/map-freeze/index.ts', 'dist/map-freeze-library.mjs'],
  ['src/map-freeze/worker.ts', 'dist/map-generation-worker.mjs'],
  ['src/physical-content/catalog.ts', 'dist/physical-content-library.mjs'],
  ['src/physical-content/main.ts', 'dist/physical-content.mjs'],
  ['src/physical-resolution/index.ts', 'dist/physical-resolution-library.mjs'],
  ['src/combat/index.ts', 'dist/combat-library.mjs'],
]) {
  await build({
    entryPoints: [entry],
    bundle: true,
    packages: 'external',
    platform: 'node',
    format: 'esm',
    target: 'node24',
    outfile,
  });
}
await build({
  entryPoints: ['src/client/app.ts'],
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: ['safari15', 'chrome100'],
  outfile: 'dist/public/app.js',
});
await cp('src/client/index.html', 'dist/public/index.html');
await cp('src/client/style.css', 'dist/public/style.css');

await cp('src/client/assets', 'dist/public/assets', { recursive: true });
