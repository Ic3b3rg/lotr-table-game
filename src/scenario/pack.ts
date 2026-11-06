import { validateCampPreparationCapability } from './camp-preparation-capability';
import { validateCampItemsCapability } from './camp-items-capability';
import { readFileSync, statSync } from 'node:fs';
import { ScenarioPackSchema, type ScenarioPack } from '../shared/scenario';
import type { Projection } from '../shared/generated-map';
import { digest } from '../map-freeze/hash';
import { invariant } from '../map-freeze/validate';
import { validateSourceHandler } from './handlers';
import { verifySourceDeployment } from '../combat/deployment-compiler';
import { verifyCombatClosure } from '../combat/compiler';
import { validateShadowCapability } from './shadow-capability';
import { validateThreatCapability } from './threat-capability';
import { validateLiveGroups } from './live-groups';
import { validateClueCapability } from './clue-capability';
import { playableScenarioPrefab } from '../shared/clues';
import { validateFailureCapability, isConclusionReward } from './failure-capability';
import { validateCampCapability } from './camp-capability';
import { validateLairCapability, isLairClueReward } from './lair-capability';
import { validateLinkedCapability, linkedDefinition } from './linked-capability';
import { validateBaseProducts, baseProductsDefinition } from './base-products';
import { validateItemCapability } from './item-capability';
import { validateSearches, searchDefinition } from './searches';
import { validateThreatTokens, threatTokenDefinition } from './threat-tokens';
import {
  validateFirstCombat,
  firstCombatDefinition,
  validateFirstCombatBinding,
} from './first-combat';
export function parseScenarioPack(raw: unknown) {
  const pack = ScenarioPackSchema.parse(raw);
  const original = pack.manifest.scope === 'original-encounter-v1';
  if (pack.manifest.startupPreparation)
    invariant(
      original || pack.manifest.scope === 'synthetic-physical-p1',
      'Preparazione iniziale senza consumer fisico fonte.',
    );
  invariant(
    original === !!pack.manifest.playablePrefabs,
    'Manifest originale incompleto o estraneo.',
  );
  const definitions = new Map(pack.definitions.map((d) => [d.source, d]));
  validateLinkedCapability(pack);
  validateBaseProducts(pack);
  validateItemCapability(pack);
  validateFirstCombat(pack);
  validateSearches(pack);
  validateThreatTokens(pack);
  validateLairCapability(pack);
  validateClueCapability(pack);
  validateFailureCapability(pack);
  const exploration = pack.manifest.exploration;
  if (exploration) {
    invariant(original, 'Esplorazione fuori dal consumer originale.');
    invariant(
      new Set(exploration.tiles.map((t) => t.source)).size === exploration.tiles.length,
      'Tessere esplorabili duplicate.',
    );
    const d = definitions.get(exploration.definition),
      waiting = d?.states.find((s) => s.index === d.initial),
      click = d?.states.find((s) => s.index === d.handlers['NODE CLICKED']),
      confirm = click?.actions[0],
      enter =
        confirm?.op === 'confirm'
          ? d?.states.find((s) => s.index === click!.transitions[confirm.confirmEvent])
          : null,
      get = enter?.actions[0],
      explore = enter?.actions[1],
      finish = d?.states.find((s) => s.index === enter?.transitions.FINISHED);
    invariant(
      d &&
        d.states.length === 4 &&
        Object.keys(d.handlers).length === 1 &&
        waiting?.actions.length === 0 &&
        Object.keys(waiting.transitions).length === 0 &&
        click?.actions.length === 1 &&
        confirm?.op === 'confirm' &&
        click.transitions[confirm.cancelEvent] === d.initial &&
        enter?.actions.length === 2 &&
        get?.op === 'getTile' &&
        get.target.scope === 'local' &&
        d.variables.some((v) => v.name === get.target.name && v.type === 'int' && v.value === -1) &&
        explore?.op === 'explore' &&
        explore.tile.kind === 'variable' &&
        digest(explore.tile.ref) === digest(get.target) &&
        !explore.skipIntro &&
        !explore.noInspiration &&
        !explore.skipOutro &&
        explore.skipAdjacentSectionEvent === false &&
        finish?.actions.length === 2 &&
        finish.actions[0]?.op === 'hideNode' &&
        finish.actions[1]?.op === 'stop',
      'Template esplorazione incompleto o non certificato.',
    );
    const principal = definitions.get(pack.principal)!,
      { event, variable } = exploration.adjacent;
    invariant(!principal.deferredHandlers[event], 'Evento adiacente con receiver non compilato.');
    invariant(
      principal.handlers[event] === undefined
        ? variable === null
        : variable?.scope === 'local' &&
            principal.variables.some((v) => v.name === variable.name && v.type === 'int'),
      'Binding/handler adiacente incoerenti.',
    );
  }
  invariant(definitions.size === pack.definitions.length, 'FSM duplicate.');
  invariant(
    definitions.has(pack.principal) && pack.timers.every((t) => definitions.has(t)),
    'FSM mancante.',
  );
  const globals = new Map(pack.globals.map((v) => [v.name, v]));
  const rounds = pack.manifest.rounds;
  const followup = pack.manifest.followup;
  validateThreatCapability(pack);
  validateLiveGroups(pack);
  if (followup) {
    invariant(original && rounds, 'Seguito senza fase originale.');
    const deployment = verifySourceDeployment(followup.deployment);
    invariant(
      deployment.source.adventure === pack.identity.adventureSource,
      'Deployment di un’altra avventura.',
    );
    invariant(
      deployment.source.files.every((f) =>
        pack.sources.some((s) => s.file === f.file && s.sha256 === f.sha256),
      ),
      'Fonte deployment non legata al pack.',
    );
    for (const name of [followup.playerCountBinding, followup.enemyPointsBinding])
      invariant(globals.get(name)?.type === 'int', 'Binding seguito assente.');
    invariant(
      new Set(followup.instances.map((i) => i.definition)).size === followup.instances.length,
      'Istanze statiche duplicate.',
    );
    for (const i of followup.instances)
      invariant(definitions.has(i.definition), 'Lifecycle senza definizione.');
    invariant(
      new Set(followup.thresholds.map((t) => t.source)).size === followup.thresholds.length,
      'Soglie duplicate.',
    );
    for (const t of followup.thresholds)
      if (t.definition)
        invariant(
          followup.instances.some((i) => i.definition === t.definition && i.kind === 'threat'),
          'Soglia senza istanza statica.',
        );
  }
  if (pack.manifest.boons)
    invariant(
      ['original-encounter-v1', 'synthetic-physical-p1'].includes(pack.manifest.scope),
      'Benefici senza consumer fisico fonte.',
    );
  if (pack.manifest.combat) {
    const combat = verifyCombatClosure(pack.manifest.combat);
    invariant(original && followup && rounds, 'Combattimento senza capacità originale precedente.');
    validateShadowCapability(pack, combat);
    const deployment = verifySourceDeployment(followup.deployment);
    invariant(
      combat.source.deploymentFingerprint === deployment.fingerprint &&
        combat.source.projectionFingerprint === followup.projectionFingerprint,
      'Combattimento non legato al deployment congelato.',
    );
    invariant(
      digest(combat.source.models) === digest(deployment.compiled.models.map((m) => m.source)),
      'Pool modelli combattimento incompleto.',
    );
    for (const asset of combat.source.assets.filter((a) => a.cls !== 'EnemyActivationModel')) {
      const deployed = deployment.source.assets.find((a) => a.source === asset.source);
      invariant(
        deployed && digest(deployed) === digest(asset),
        'Statistica/bonus combattimento diverso dal deployment.',
      );
    }
    invariant(
      combat.source.files.every((f) =>
        pack.sources.some((s) => s.file === f.file && s.sha256 === f.sha256),
      ),
      'Fonte combattimento fuori dal pack.',
    );
  }
  if (rounds) {
    invariant(original, 'Fonte delle fasi fuori dal consumer originale.');
    invariant(
      !rounds.configuration.initialEnemyGroups.length,
      'Attivazioni nemiche non disponibili.',
    );
    for (const [binding, type] of [
      ['round', 'int'],
      ['threat', 'int'],
      ['darkness', 'bool'],
      ['darknessOverride', 'string'],
    ] as const)
      invariant(
        globals.get(rounds.bindings[binding])?.type === type,
        'Binding della fase assente o di tipo errato.',
      );
    invariant(
      new Set(rounds.darkness.spaces.map((s) => s.id)).size === rounds.darkness.spaces.length,
      'Caselle oscurità duplicate.',
    );
    invariant(
      rounds.darkness.tokenPrefabs.every((s) => pack.manifest.prefabs.some((p) => p.source === s)),
      'Token oscurità senza prefab fonte.',
    );
  }
  const checkVariables = (variables: typeof pack.globals) => {
    invariant(
      new Set(variables.map((v) => v.name)).size === variables.length,
      'Variabili duplicate.',
    );
    for (const v of variables)
      invariant(
        v.type === 'int'
          ? Number.isInteger(v.value)
          : v.type === 'bool'
            ? typeof v.value === 'boolean'
            : v.type === 'string'
              ? typeof v.value === 'string'
              : Array.isArray(v.value),
        'Tipo variabile incoerente.',
      );
  };
  checkVariables(pack.globals);
  for (const d of pack.definitions) {
    checkVariables(d.variables);
    const locals = new Map(d.variables.map((v) => [v.name, v]));
    const indices = new Set(d.states.map((s) => s.index));
    invariant(
      indices.size === d.states.length && indices.has(d.initial),
      'Stato iniziale non valido.',
    );
    invariant(
      Object.values(d.handlers).every((s) => indices.has(s)),
      'Handler senza stato.',
    );
    for (const s of d.states) {
      invariant(
        Object.keys(s.deferredTransitions ?? {}).every((e) => s.transitions[e] === undefined) &&
          (!Object.keys(s.deferredTransitions ?? {}).length ||
            !!rounds ||
            baseProductsDefinition(pack, d.source) ||
            threatTokenDefinition(pack, d.source)),
        'Confine condizionale ambiguo o senza capacità della fase.',
      );
      invariant(
        Object.values(s.transitions).every((t) => indices.has(t)),
        'Transizione senza stato.',
      );
      invariant(
        new Set(s.actions.map((a) => a.index)).size === s.actions.length,
        'Azioni duplicate.',
      );
      invariant(
        s.actions.every((a, i) => !i || a.index > s.actions[i - 1]!.index),
        'Ordine azioni non valido.',
      );
      for (const a of s.actions) {
        validateSourceHandler(a);
        const typeOf = (ref: { scope: 'local' | 'global'; name: string }) =>
          (ref.scope === 'local' ? locals : globals).get(ref.name)?.type;
        const integerRefs = [
          ...(a.op === 'chooseHero' ? [a.target] : []),
          ...(a.op === 'awardTitle' ? [a.recipient] : []),
          ...(a.op === 'copyInt'
            ? [a.target, ...(a.value.kind === 'variable' ? [a.value.ref] : [])]
            : []),
          ...(a.op === 'switchInt'
            ? [a.value, ...a.cases.map((c) => c.equals)].flatMap((v) =>
                v.kind === 'variable' ? [v.ref] : [],
              )
            : []),
          ...(a.op === 'challenge'
            ? [
                ...('scope' in a.sum ? [a.sum] : []),
                ...a.bounds.flatMap((b) => (typeof b.maximum === 'number' ? [] : [b.maximum])),
              ]
            : []),
          ...(a.op === 'isExplored' && a.tile.kind === 'variable' ? [a.tile.ref] : []),
        ];
        invariant(
          integerRefs.every((ref) => typeOf(ref) === 'int') &&
            (a.op !== 'focus' || a.positions.every((ref) => typeOf(ref) === 'vector')),
          'Tipo del binding della nuova istruzione incoerente.',
        );
        if (a.op === 'choice')
          invariant(
            a.options.every((o) => !o.requirement || typeOf(o.requirement) === 'bool'),
            'Opzione con requisito non booleano.',
          );
        if (a.op === 'message')
          invariant(
            [a.inspiration, a.consequence, a.sprint, a.boon, a.recovery].filter(Boolean).length <=
              1,
            'Messaggio con conseguenze concorrenti non compilate.',
          );
        if (
          ['copyInt', 'switchInt', 'isExplored', 'focus'].includes(a.op) ||
          (a.op === 'challenge' &&
            (!('scope' in a.sum) || a.bounds.some((b) => typeof b.maximum !== 'number'))) ||
          (a.op === 'message' && a.inspiration) ||
          (a.op === 'explore' && a.intro)
        )
          invariant(
            pack.manifest.clues ||
              linkedDefinition(pack, d.source) ||
              searchDefinition(pack, d.source) ||
              threatTokenDefinition(pack, d.source) ||
              baseProductsDefinition(pack, d.source) ||
              firstCombatDefinition(pack, d.source),
            'Istruzione fuori dalla capacità indizi o collegata congelata.',
          );
        if (a.op === 'objective' && a.bindings)
          invariant(
            followup &&
              new Set(a.bindings.map((b) => b.placeholder)).size === a.bindings.length &&
              a.bindings.every(
                (b) =>
                  (b.ref.scope === 'local' ? locals : globals).get(b.ref.name)?.type === 'int' &&
                  a.text.some((t) => t.kind === 'text' && t.text.includes(b.placeholder)),
              ),
            'Argomenti obiettivo non legati alla fonte.',
          );
        if (a.op === 'spawnRandom' && a.suffering)
          invariant(
            pack.manifest.threatContinuations?.thresholds.some(
              (t) => t.definition === d.source && t.form === 'spawn-register',
            ),
            'Conseguenza di soglia fuori dalla capacità attestata.',
          );
        if (a.op === 'send' || a.op === 'multiplyInt' || a.op === 'spawnRandom')
          invariant(followup, 'Azione fuori dalla capacità seguito.');
        if (a.op === 'send')
          invariant(definitions.has(a.definition), 'Receiver indirizzato mancante.');
        if (a.op === 'compareInt' || a.op === 'subtractInt')
          invariant(rounds, 'Operatore della fase fuori dalla capacità congelata.');
        if (a.op === 'compareInt')
          invariant(
            [a.equalEvent, a.lessEvent, a.greaterEvent].every(
              (e) => s.transitions[e] !== undefined || !!s.deferredTransitions?.[e],
            ),
            'Confronto intero senza ramo fonte o gate.',
          );
        if (a.op === 'explore' && (!a.skipIntro || !a.skipOutro))
          invariant(
            d.source === exploration?.definition ||
              (pack.manifest.clues && a.intro && !a.skipIntro && a.skipOutro && a.noInspiration),
            'Esplorazione senza presentazione certificata.',
          );
        if (
          [
            'confirm',
            'sourceTest',
            'challenge',
            'choice',
            'nullProduct',
            'ownsProducts',
            'addItem',
            'modalWait',
            'lore',
          ].includes(a.op) ||
          (a.op === 'message' &&
            (a.consequence || a.inspiration || a.sprint || a.boon || a.recovery))
        )
          invariant(
            original &&
              ((a.op === 'confirm' && d.source === pack.manifest.exploration?.definition) ||
                (a.op === 'lore' && isConclusionReward(pack, d.source, s.index)) ||
                (a.op === 'lore' &&
                  pack.manifest.clues &&
                  ((d.source === pack.principal && isLairClueReward(pack, s.index)) ||
                    pack.manifest.prefabs.some(
                      (p) =>
                        p.source === pack.manifest.clues!.fort.prefab && p.fsmSource === d.source,
                    ))) ||
                (a.op === 'lore' &&
                  followup?.instances.some(
                    (i) => i.definition === d.source && i.kind === 'logic',
                  )) ||
                pack.manifest.prefabs.some(
                  (p) => playableScenarioPrefab(pack, p.source) && p.fsmSource === d.source,
                )),
            'Istruzione incontro fuori dal manifest chiuso.',
          );
        const events =
          a.op === 'confirm'
            ? [a.confirmEvent, a.cancelEvent]
            : a.op === 'sourceTest'
              ? [a.passEvent, a.failEvent]
              : a.op === 'challenge'
                ? a.bounds.map((b) => b.event)
                : a.op === 'choice'
                  ? [...a.options, ...(a.cancel ? [a.cancel] : [])].map((o) => o.event)
                  : a.op === 'nullProduct'
                    ? [a.falseEvent]
                    : a.op === 'switchInt'
                      ? a.cases.map((c) => c.event)
                      : a.op === 'isExplored'
                        ? [a.trueEvent, a.falseEvent]
                        : [];
        invariant(
          events.every((e) => s.transitions[e] !== undefined),
          'Ramo incontro senza transizione fonte.',
        );
        if (a.op === 'physical')
          invariant(
            (a.program.profile !== 'source-fronts-v1' ||
              (!a.program.groupRules &&
                !a.program.children.some((c) => c.kind === 'scenario-title'))) &&
              pack.manifest.scope ===
                (a.program.profile === 'source-fronts-v1'
                  ? 'synthetic-physical-p1'
                  : 'synthetic-physical-p0') &&
              pack.name.toLocaleLowerCase('it-IT').includes('sintetic') &&
              d.source === pack.principal &&
              s.actions.length === 1 &&
              a.origin.parameterHash === digest(a.program),
            'Programma fisico richiede fonte sintetica esplicita, esclusiva e parametri corrispondenti; i gruppi attivi sono derivati dal controller congelato.',
          );
        const refs = [
          ...('target' in a && typeof a.target === 'object' ? [a.target] : []),
          ...('ref' in a ? [a.ref] : []),
          ...(a.op === 'challenge'
            ? [
                ...('scope' in a.sum ? [a.sum] : []),
                ...a.bounds.flatMap((b) => (typeof b.maximum === 'number' ? [] : [b.maximum])),
              ]
            : []),
          ...(a.op === 'spawnRandom' ? [a.points] : []),
          ...(a.op === 'objective' ? (a.bindings ?? []).map((b) => b.ref) : []),
          ...('tile' in a && a.tile.kind === 'variable' ? [a.tile.ref] : []),
          ...(a.op === 'addInt' && a.value.kind === 'variable' ? [a.value.ref] : []),
          ...((a.op === 'copyInt' || a.op === 'switchInt') && a.value.kind === 'variable'
            ? [a.value.ref]
            : []),
          ...(a.op === 'switchInt'
            ? a.cases.flatMap((c) => (c.equals.kind === 'variable' ? [c.equals.ref] : []))
            : []),
          ...(a.op === 'focus' ? a.positions : []),
          ...('left' in a && a.left.kind === 'variable' ? [a.left.ref] : []),
          ...('right' in a && a.right.kind === 'variable' ? [a.right.ref] : []),
        ];
        for (const ref of refs)
          invariant(
            (ref.scope === 'local' ? locals : globals).has(ref.name),
            'Binding variabile assente.',
          );
      }
    }
  }
  invariant(
    new Set(pack.manifest.prefabs.map((p) => p.source)).size === pack.manifest.prefabs.length,
    'Prefab duplicati.',
  );
  for (const p of pack.manifest.prefabs)
    invariant(definitions.has(p.fsmSource), 'Closure prefab mancante.');
  for (const p of pack.manifest.prefabs.filter((p) => p.progress)) {
    const d = definitions.get(p.fsmSource)!;
    invariant(
      original && pack.manifest.playablePrefabs!.includes(p.source),
      'Progressi fuori dalla closure giocabile.',
    );
    const progress = p.progress!;
    invariant(
      progress.firstPass.scope === 'local' &&
        progress.total.scope === 'local' &&
        d.variables.some((v) => v.name === progress.firstPass.name && v.type === 'bool') &&
        d.variables.some((v) => v.name === progress.total.name && v.type === 'int') &&
        d.states.some((s) =>
          s.actions.some(
            (a) =>
              a.op === 'challenge' &&
              'scope' in a.sum &&
              a.sum.name === progress.total.name &&
              a.sum.scope === 'local',
          ),
        ),
      'Progressi non legati alle variabili fonte.',
    );
  }
  for (const source of pack.manifest.playablePrefabs ?? []) {
    const p = pack.manifest.prefabs.find((p) => p.source === source);
    invariant(p, 'Prefab giocabile assente.');
    const d = definitions.get(p.fsmSource)!;
    const clickTarget =
      d.handlers['NODE CLICKED'] ??
      d.states.find((s) => s.transitions['NODE CLICKED'] !== undefined)?.transitions[
        'NODE CLICKED'
      ];
    const click = d.states.find((s) => s.index === clickTarget);
    invariant(
      click?.actions.length === 1 && click.actions[0]?.op === 'confirm',
      'Ingresso incontro senza conferma fonte esclusiva.',
    );
  }
  validateCampCapability(pack);
  validateCampItemsCapability(pack);
  validateCampPreparationCapability(pack);
  return { pack, fingerprint: digest(pack) };
}
export function loadScenarioPack(path: string) {
  invariant(statSync(path).size <= 4_000_000, 'Pacchetto scenario troppo grande.');
  return parseScenarioPack(JSON.parse(readFileSync(path, 'utf8')));
}
export function validateScenarioBinding(pack: ScenarioPack, p: Projection) {
  if (pack.manifest.campItems)
    invariant(
      pack.manifest.campItems.catalogFingerprint === p.context.catalogFingerprint &&
        digest(pack.manifest.campItems.ownedProductIds) === digest(p.context.ownedProductIds),
      'Oggetti del campo diversi dal catalogo o dai prodotti della realizzazione.',
    );
  if (pack.manifest.campSkills)
    invariant(
      pack.manifest.campSkills.catalogFingerprint === p.context.catalogFingerprint,
      'Campo diverso dal catalogo della realizzazione.',
    );
  validateFirstCombatBinding(pack, p);
  if (pack.manifest.threatTokens)
    invariant(
      digest(p.context.ownedProductIds) === digest(pack.manifest.threatTokens.ownedProductIds),
      'Prodotti dei segnalini minaccia diversi dalla realizzazione.',
    );
  if (pack.manifest.searches)
    invariant(
      digest(p.context.ownedProductIds) === digest(pack.manifest.searches.ownedProductIds),
      'Prodotti della ricerca diversi dalla realizzazione.',
    );
  if (pack.manifest.items)
    invariant(
      digest(p.context.ownedProductIds) === digest(pack.manifest.items.ownedProductIds),
      'Prodotti inventario diversi dalla realizzazione.',
    );
  if (pack.manifest.baseProducts)
    invariant(
      digest(p.context.ownedProductIds) === digest(pack.manifest.baseProducts.ownedProductIds),
      'Prodotti della realizzazione fuori dal perimetro base attestato.',
    );
  if (pack.manifest.clues)
    invariant(
      pack.manifest.clues.projectionFingerprint === p.fingerprint,
      'Indizi di un’altra realizzazione.',
    );
  if (pack.manifest.followup) {
    const cap = pack.manifest.followup;
    invariant(cap.projectionFingerprint === p.fingerprint, 'Seguito di un’altra realizzazione.');
    invariant(
      new Set(cap.explorationNodes.map((n) => n.source)).size === cap.explorationNodes.length &&
        new Set(cap.explorationNodes.map((n) => n.tileSource)).size ===
          cap.explorationNodes.length &&
        cap.explorationNodes.every((n) =>
          p.sections.some((s) => s.tiles.some((t) => t.source === n.tileSource)),
        ),
      'Binding segnalini esplorazione incoerenti.',
    );
    const source = cap.deployment.source;
    invariant(
      source.products.length === p.context.ownedProductIds.length &&
        source.products.every((s) =>
          source.assets.some(
            (a) => a.source === s && p.context.ownedProductIds.includes(Number(a.data._id)),
          ),
        ),
      'Pool deployment di un altro prodotto.',
    );
  }
  if (pack.manifest.rounds) {
    const source = pack.manifest.rounds;
    invariant(
      source.projectionFingerprint === p.fingerprint &&
        source.darkness.spaces.length === p.spaces.length &&
        p.spaces.every((space) =>
          source.darkness.spaces.some((s) => s.id === space.id && s.source === space.source),
        ),
      'Proprietà delle fasi di un’altra realizzazione o incomplete.',
    );
  }
  invariant(
    (pack.manifest.exploration?.tiles ?? []).every((t) =>
      p.sections.some((s) => s.tiles.some((x) => x.source === t.source)),
    ),
    'Capacità esplorazione di un’altra realizzazione.',
  );
  invariant(
    pack.identity.adventureSource === p.context.adventureSource &&
      pack.identity.adventureId === p.context.adventureId &&
      pack.identity.language === p.context.language,
    'Scenario/source mismatch.',
  );
  const files = new Map(pack.sources.map((f) => [f.file, f.sha256]));
  invariant(files.size === pack.sources.length, 'Source file duplicate.');
  for (const source of [
    p.context.adventureSource,
    ...p.assignments.flatMap((a) => [a.modelSource, a.prefab.source]),
  ]) {
    const file = source.split(':')[0]!;
    const expected = p.provenance.files.find((f) => f.file === file);
    invariant(
      expected && files.get(file) === expected.sha256,
      'Source hash mancante o incoerente.',
    );
  }
  for (const f of p.provenance.files)
    if (files.has(f.file)) invariant(files.get(f.file) === f.sha256, 'Source hash mismatch.');
  const principal = pack.definitions.find((d) => d.source === pack.principal)!;
  const startupStates = new Set<number>();
  const visitStartup = (index: number | undefined) => {
    if (index === undefined || startupStates.has(index)) return;
    startupStates.add(index);
    const state = principal.states.find((s) => s.index === index)!;
    for (const [event, next] of Object.entries(state.transitions))
      if (event !== 'NODE CLICKED') visitStartup(next);
  };
  if (pack.manifest.clues) {
    visitStartup(principal.initial);
    visitStartup(principal.handlers.SCENARIO_BEGIN);
  }
  const startupSources = new Set(
    principal.states
      .filter((s) => !pack.manifest.clues || startupStates.has(s.index))
      .flatMap((s) =>
        s.actions.flatMap((a) => {
          if (a.op !== 'explore') return [];
          const target = a.tile;
          const startVariable =
            target.kind === 'variable' &&
            principal.states.some((s) =>
              s.actions.some(
                (x) =>
                  x.op === 'getStart' &&
                  x.target.scope === target.ref.scope &&
                  x.target.name === target.ref.name,
              ),
            );
          const hash =
            target.kind === 'start' || startVariable
              ? p.sections.find((s) => s.id === 0)!.tiles[0]!.hashId
              : target.kind === 'hash'
                ? target.value
                : (target.ref.scope === 'local' ? principal.variables : pack.globals).find(
                    (v) => v.name === target.ref.name,
                  )?.value;
          const tile = p.sections.flatMap((s) => s.tiles).find((t) => t.hashId === hash);
          invariant(tile, 'Tessera startup non disponibile.');
          return [tile.source];
        }),
      ),
  );
  if (pack.manifest.clues && pack.manifest.followup)
    invariant(
      p.sections
        .flatMap((section) => section.tiles)
        .every(
          (tile) =>
            startupSources.has(tile.source) ||
            pack.manifest.followup!.explorationNodes.some(
              (node) => node.tileSource === tile.source,
            ),
        ),
      'Binding di esplorazione incompleto per le tessere successive della missione.',
    );
  for (const a of p.assignments) {
    const m = pack.manifest.prefabs.find((m) => m.source === a.prefab.source);
    if (m && startupSources.has(p.spaces.find((s) => s.id === a.spaceId)!.tileSource)) {
      const d = pack.definitions.find((d) => d.source === m.fsmSource)!;
      invariant(
        !d.deferredHandlers.PRE_REVEAL && !d.deferredHandlers.REVEALED,
        'Prefab reveal non certificato per questa realizzazione.',
      );
    }
  }
  for (const a of p.assignments)
    invariant(
      pack.manifest.prefabs.some(
        (m) =>
          m.source === a.prefab.source &&
          m.modelSource === a.modelSource &&
          m.encounterId === a.encounterId,
      ),
      'Prefab non certificato per questa realizzazione.',
    );
}
