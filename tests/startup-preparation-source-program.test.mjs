import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileScenarioPack } from '../dist/scenario-library.mjs';
import { scenarioFixture } from './fixtures/scenario.mjs';
import { startupMaterial } from './startup-preparation-helper.mjs';
import { hash } from './fixtures/map-freeze.mjs';

test('source actions cannot embed controller-only startup rules or children, even with an attested manifest', () => {
  for (const [child, rules, capability] of [
    [{ kind: 'scout', hero: 0, count: 2 }, true, false],
    [{ kind: 'prepared', hero: 0, copy: 'role-1-skill-1:1' }, false, false],
    [{ kind: 'startup-scout', hero: 0 }, false, false],
    [{ kind: 'startup-test', hero: 0 }, false, false],
    [{ kind: 'startup-scout', hero: 0 }, true, true],
  ]) {
    const pack = scenarioFixture();
    pack.name = 'Programma sintetico inventato';
    pack.manifest.scope = 'synthetic-physical-p1';
    if (capability) pack.manifest.startupPreparation = startupMaterial().capability;
    const program = {
      profile: 'source-fronts-v1',
      ...(rules ? { startupRules: 'source-startup-preparation-v1' } : {}),
      initialCredits: [0],
      limits: [{ kind: 'requires-capability', capability: 'source-derived' }],
      darknessHeroes: [],
      children: [child],
    };
    pack.definitions[0].states[1].actions = [
      {
        index: 0,
        op: 'physical',
        origin: {
          type: 'Synthetic.PhysicalProgram',
          parameterHash: hash(program),
          load: 'hash-match-positional',
        },
        text: [{ kind: 'text', text: 'Fonte inventata', style: 'plain' }],
        program,
      },
    ];
    const input = {
      pack,
      ...(capability
        ? {
            startupPreparationCertificate: {
              instructionHash: hash(pack.manifest.startupPreparation),
            },
          }
        : {}),
      certificates: pack.definitions.map((d) => ({
        source: d.source,
        objectHash: hash(d),
        lifecycleHash: hash('invented lifecycle'),
        initial: d.initial,
        handlers: d.handlers,
        states: d.states.map((s) => ({
          index: s.index,
          transitions: s.transitions,
          actions: s.actions.map((a) => ({
            index: a.index,
            type: a.origin.type,
            parameterHash: a.origin.parameterHash,
            enabled: true,
          })),
        })),
        deferredEdges: [],
      })),
    };
    assert.throws(() => compileScenarioPack(input), /programma fisico/i);
  }
});
