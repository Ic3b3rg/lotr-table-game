import { createHash } from 'node:crypto';
import { digest } from '../map-freeze/hash';
import { validateProjection } from '../map-freeze/validate';
import { SourceSchema } from '../shared/generated-map';
import {
  bounded,
  check,
  unique,
  integer,
  object,
  list,
  stat,
  CombatSourceSchema,
  type CombatSource,
  type Dependency,
  type Modifier,
} from './model';

// Closed native action identities. Only spawn is executed here; the rest retain explicit owners.
const owners: Record<string, Dependency | null> = {
  'FFG.JIME.Actions.SpawnEnemyGroup': null,
  'FFG.Common.Actions.FinishFSM': 'scenario-continuation',
  'FFG.Common.Actions.FinishProcessingEvent': 'scenario-continuation',
  'FFG.JIME.Actions.AddLore': 'scenario-continuation',
  'FFG.JIME.Actions.DisplayMessage': 'scenario-continuation',
  'FFG.JIME.Actions.DisplayMessageChallenge': 'person-controller',
  'FFG.JIME.Actions.DisplayMessageMultipleChoice': 'person-controller',
  'FFG.JIME.Actions.EnemyGroupRemoveAll': 'scenario-continuation',
  'FFG.JIME.Actions.HideThisNode': 'scenario-continuation',
  'FFG.JIME.Actions.SetObjective': 'scenario-continuation',
  'FFG.JIME.Actions.SetSectionVisibility': 'scenario-continuation',
  'HutongGames.PlayMaker.Actions.BoolFlip': 'scenario-continuation',
  'HutongGames.PlayMaker.Actions.BoolTest': 'scenario-continuation',
  'HutongGames.PlayMaker.Actions.IntCompare': 'scenario-continuation',
  'HutongGames.PlayMaker.Actions.IntOperator': 'scenario-continuation',
  'HutongGames.PlayMaker.Actions.SendEvent': 'scenario-continuation',
  'HutongGames.PlayMaker.Actions.SendEventByName': 'scenario-continuation',
  'HutongGames.PlayMaker.Actions.SetBoolValue': 'scenario-continuation',
};
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const fileOf = (source: string) => source.slice(0, source.lastIndexOf(':'));
const pointer = (raw: unknown) => {
  const p = object(raw);
  check(Object.keys(p).length === 2 && 'm_FileID' in p && 'm_PathID' in p, 'PPtr invalido.');
  return {
    file: integer(p.m_FileID, 'PPtr file', 0, 100),
    path: integer(p.m_PathID, 'PPtr path', -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
  };
};
const bindingTypes: Record<string, string> = {
  intVariables: 'int',
  boolVariables: 'bool',
  stringVariables: 'string',
  gameObjectVariables: 'object',
  objectVariables: 'object',
  vector3Variables: 'vector3',
};

/** Derives executable data from native fields, never state names or asserted instruction hashes. */
export function compileCombatSource(raw: unknown) {
  bounded(raw);
  const s = CombatSourceSchema.parse(raw);
  validateProjection(s.projection);
  const files = new Map(s.manifest.files.map((f) => [f.file, f]));
  unique(
    s.manifest.files.map((f) => f.file),
    'File',
  );
  unique(
    s.manifest.mechanics.map((m) => m.capability),
    'Prova meccanica',
  );
  const requireFile = (name: string) => check(files.has(name), `File fonte assente: ${name}.`);
  for (const f of files.values()) {
    unique(
      f.externals.map((e) => e.id),
      'File esterno',
    );
    f.externals.forEach((e) => requireFile(e.file));
    const frozen = s.projection.provenance.files.find((p) => p.file === f.file);
    if (frozen) check(frozen.sha256 === f.sha256, 'Hash fonte diverso dalla proiezione.');
  }
  for (const m of s.manifest.mechanics) requireFile(m.file);
  const resolve = (from: string, raw: unknown): string => {
    const p = pointer(raw),
      own = fileOf(from);
    check(p.path !== 0, 'PPtr nullo al confine richiesto.');
    const file = p.file === 0 ? own : files.get(own)?.externals.find((e) => e.id === p.file)?.file;
    check(file, 'File esterno irrisolto.');
    return SourceSchema.parse(`${file}:${p.path}`);
  };
  unique(
    s.assets.map((a) => a.source),
    'Asset',
  );
  unique(
    s.fsms.map((f) => f.source),
    'FSM',
  );
  unique(
    s.items.map((i) => i.id),
    'Oggetto',
  );
  unique(
    s.items.map((i) => i.model),
    'ItemModel',
  );
  unique(
    s.items.map((i) => `${i.file}:${i.locator}`),
    'Riga oggetto',
  );
  unique(
    s.texts.map((t) => t.key),
    'Chiave testo',
  );
  unique(
    s.additions.map((a) => a.key),
    'Aggiunta',
  );
  const assets = new Map(s.assets.map((a) => [a.source, a]));
  for (const a of s.assets) {
    requireFile(fileOf(a.source));
    check(digest(a.data) === a.dataHash, 'Hash campi asset cambiato.');
  }
  const asset = (source: string, cls: string) => {
    const a = assets.get(source);
    check(a?.cls === cls, `Riferimento ${source}: atteso ${cls}.`);
    return a;
  };
  for (const t of s.texts) {
    requireFile(t.file);
    check(sha(t.value) === t.sha256, 'Hash testo cambiato.');
  }
  for (const a of s.additions)
    check(
      s.texts.find((t) => t.key === a.key)?.sha256 === a.textHash,
      'Aggiunta non legata al testo fonte.',
    );
  const validateVariables = (variables: CombatSource['globals']) => {
    unique(
      variables.map((v) => v.name),
      'Variabile',
    );
    for (const v of variables) {
      if (v.type === 'int') integer(v.value, 'Variabile intera', -2147483648, 2147483647);
      else if (v.type === 'bool') check(typeof v.value === 'boolean', 'Variabile bool.');
      else if (v.type === 'string') check(typeof v.value === 'string', 'Variabile stringa.');
      else if (v.type === 'vector3')
        check(
          Array.isArray(v.value) &&
            v.value.length === 3 &&
            v.value.every((n) => typeof n === 'number' && Number.isFinite(n)),
          'Variabile vettore.',
        );
      else pointer(v.value);
    }
  };
  validateVariables(s.globals);
  const boundValue = (raw: unknown, f: CombatSource['fsms'][number]): unknown => {
    const v = object(raw);
    if (v.kind === 'literal') {
      check(Object.keys(v).length === 2 && 'value' in v, 'Letterale invalido.');
      return v.value;
    }
    check(
      v.kind === 'binding' &&
        (v.scope === 'local' || v.scope === 'global') &&
        typeof v.name === 'string',
      'Binding invalido.',
    );
    check(
      Object.keys(v).every((k) =>
        [
          'kind',
          'scope',
          'name',
          'type',
          'initial',
          'serializedSample',
          'serializedUseVariable',
        ].includes(k),
      ),
      'Campo binding ignoto.',
    );
    const variable = (v.scope === 'local' ? f.variables : s.globals).find((a) => a.name === v.name);
    check(
      variable &&
        bindingTypes[String(v.type)] === variable.type &&
        digest(variable.value) === digest(v.initial),
      'Binding senza variabile/tipo/valore effettivo.',
    );
    return variable.value;
  };
  const inspectBindings = (v: unknown, f: CombatSource['fsms'][number]): void => {
    if (!v || typeof v !== 'object') return;
    if (!Array.isArray(v) && object(v).kind === 'binding') {
      boundValue(v, f);
      return;
    }
    Object.values(v).forEach((child) => inspectBindings(child, f));
  };
  const sourceActions: {
    source: string;
    state: number;
    action: number;
    type: string;
    parameterHash: string;
    dependency: Dependency | null;
  }[] = [];
  for (const f of s.fsms) {
    requireFile(fileOf(f.source));
    validateVariables(f.variables);
    unique(
      [...f.states, ...f.deferredStates].map((v) => v.index),
      'Indice stato',
    );
    unique(
      [...f.states, ...f.deferredStates].map((v) => v.name),
      'Nome stato',
    );
    check(
      [...f.states, ...f.deferredStates].some((v) => v.name === f.start),
      'Start FSM irrisolto.',
    );
    const indices = new Set([...f.states, ...f.deferredStates].map((v) => v.index));
    for (const to of Object.values(f.handlers)) check(indices.has(to), 'Handler irrisolto.');
    for (const state of f.states) {
      unique(
        state.actions.map((a) => a.index),
        'Indice azione',
      );
      state.actions.forEach((a, i) =>
        check(i === 0 || a.index > state.actions[i - 1]!.index, 'Ordine azioni invalido.'),
      );
      Object.values(state.transitions).forEach((to) =>
        check(indices.has(to), 'Transizione irrisolta senza gate.'),
      );
      for (const a of state.actions) {
        check(Object.hasOwn(owners, a.type), `Azione fonte sconosciuta: ${a.type}.`);
        check(digest(a.parameters) === a.parameterHash, 'Hash parametri effettivi cambiato.');
        inspectBindings(a.parameters, f);
        sourceActions.push({
          source: f.source,
          state: state.index,
          action: a.index,
          type: a.type,
          parameterHash: a.parameterHash,
          dependency: owners[a.type]!,
        });
      }
    }
  }
  const native = asset(s.manifest.enemy, 'EnemyModel'),
    e = native.data;
  const maximum = integer(e.MaxUnitCount, 'Massimo gruppo', 1, 3),
    capacity = integer(e.MaxUnitsInPlay, 'Massimo in gioco', 1, 100);
  check(
    integer(e.LinkedEnemyId, 'LinkedEnemyId') === 0,
    'Modello collegato richiede closure disponibilità.',
  );
  check(
    e.IsNamed === 0 && e.IsUnique === 0 && list(e.SpecialActivations).length === 0,
    'Nemico speciale fuori closure.',
  );
  const costs = list(e.Costs).map((r) => {
    const row = object(r);
    return {
      size: integer(row.Num, 'Size costo', 1, maximum),
      points: integer(row.Cost, 'Costo', 1),
    };
  });
  unique(
    costs.map((c) => c.size),
    'Costo size',
  );
  check(costs.length === maximum, 'Tabella costi incompleta.');
  const enemy = {
    source: native.source,
    modelId: integer(e._id, 'EnemyModel ID', 1),
    maximum,
    capacity,
    costs,
    stats: {
      health: integer(e.Health, 'Salute', 1),
      armor: integer(e.Armor, 'Armatura'),
      sorcery: integer(e.Sorcery, 'Stregoneria'),
    },
    ranged: (integer(e.Traits, 'Traits', 0, 2147483647) & 1024) !== 0,
    elite: false as const,
  };
  const activationSources = list(e.Activations).map((p) => resolve(native.source, p));
  unique(activationSources, 'Istruzione modello');
  check(
    activationSources.length > 0 && activationSources.length <= 32,
    'Numero istruzioni invalido.',
  );
  check(
    s.assets.filter((a) => a.cls === 'EnemyActivationModel').length === activationSources.length,
    'Istruzione fonte omessa/estranea.',
  );
  const instructions = activationSources.map((source, order) => {
    const a = asset(source, 'EnemyActivationModel'),
      d = a.data;
    const minimum = integer(d.MinGroupSize, 'MinGroupSize', 1, maximum),
      max = integer(d.MaxGroupSize, 'MaxGroupSize', minimum, maximum);
    const text = s.texts.find((t) => t.key === d.KeyAttackFlavor);
    check(text, 'Istruzione senza testo/negazione fonte.');
    const icons: [string, string][] = [
      ['\uf463', 'might'],
      ['\uf462', 'agility'],
      ['\uf461', 'spirit'],
      ['\uf460', 'wisdom'],
      ['\uf472', 'wit'],
    ];
    const stats = icons.filter(
      ([icon, name]) => text.value.includes(icon) || text.value.includes(`[${name}]`),
    );
    check(stats.length === 1, 'Caratteristica negazione ambigua/assente.');
    const damage = list(d.Damage).map((raw) => {
      const r = object(raw);
      return {
        size: integer(r.Size, 'Size istruzione', 1, maximum),
        damage: integer(r.Physical, 'Danni'),
        fear: integer(r.Fear, 'Paure'),
      };
    });
    unique(
      damage.map((r) => r.size),
      'Riga istruzione',
    );
    check(
      Array.from({ length: max - minimum + 1 }, (_, n) => minimum + n).every((n) =>
        damage.some((d) => d.size === n),
      ),
      'Importi istruzione incompleti.',
    );
    const extraKey = d.KeyAttackAdditionalEffect;
    check(typeof extraKey === 'string', 'Chiave aggiunta invalida.');
    const extra = s.additions.find((p) => p.key === extraKey);
    check(extraKey === '' || extra, 'Aggiunta senza capacità fonte esplicita.');
    return {
      source,
      order,
      modelId: integer(d._id, 'ID istruzione', 1),
      minimum,
      maximum: max,
      negate: stat.parse(stats[0]![1]),
      text: structuredClone(text),
      damage,
      addition: extra?.operation ?? null,
      additionEvidence: extra ? { key: extra.key, textHash: extra.textHash } : null,
      dependencies: [
        ...(extra ? ['physical-consequences-p2'] : []),
        ...(extra?.operation.kind === 'gain-boon' ? ['boon-quantities-57'] : []),
      ] as Dependency[],
    };
  });
  unique(
    instructions.map((i) => i.modelId),
    'ID istruzione',
  );
  check(
    s.additions.every((p) => instructions.some((i) => i.additionEvidence?.key === p.key)),
    'Aggiunta estranea.',
  );
  const items = s.items.map((row) => {
    requireFile(row.file);
    const data = asset(row.model, 'ItemModel').data;
    check(/^[1-9][0-9]*$/.test(row.cells.B), 'Quantità oggetto invalida.');
    const quantity = integer(Number(row.cells.B), 'Quantità oggetto', 1, 100);
    const weapon = row.cells.C === 'Weapon';
    const attackStat = weapon ? stat.parse(row.cells.G.toLowerCase()) : null;
    const hands = row.cells.I === '-' ? 0 : integer(Number(row.cells.I), 'Mani oggetto', 0, 2);
    check(
      (data.Is2Handed === 1 ? 2 : data.Type === 0 ? 1 : 0) === hands,
      'Mani discordanti dal modello.',
    );
    check(!weapon || data.Type === 0, 'Arma non equipaggiabile in mano.');
    const slots = weapon
      ? row.cells.K.split(/\r?\n/).map((line, index) => {
          const match = /^([1-9][0-9]*) Success(?:es)?: ([0-9]+) hits?(?:, (pierce|stun))?$/.exec(
            line.trim(),
          );
          check(match, 'Slot arma/modificatore non supportato.');
          return {
            id: `${row.id}/slot/${index}`,
            index,
            cost: integer(Number(match[1]), 'Costo successi', 1, 100),
            hits: integer(Number(match[2]), 'Colpi'),
            modifiers: match[3] ? [match[3] as Modifier] : [],
            locator: `${row.locator}/K/line/${index + 1}`,
            rowHash: digest(row),
          };
        })
      : [];
    check(slots.length <= 16, 'Troppi slot arma.');
    return {
      id: row.id,
      model: row.model,
      modelId: integer(data._id, 'ItemModel ID', 1, 2147483647),
      quantity,
      hands,
      ranged: row.ranged,
      stat: attackStat,
      slots,
      rowHash: digest(row),
    };
  });
  const equipped = s.projection.context.heroes.flatMap((h) => h.items);
  for (const i of items)
    check(
      equipped.filter((e) => e.catalogId === i.id).length <= i.quantity,
      'Copie oltre quantità.',
    );
  for (const i of equipped)
    check(
      items.some((r) => r.id === i.catalogId && r.model === i.source && r.modelId === i.id),
      'Oggetto equipaggiato senza riga/modello corrispondente.',
    );
  check(
    items.every((i) => equipped.some((e) => e.catalogId === i.id)),
    'Oggetto estraneo alla compagnia.',
  );
  const spawns = s.manifest.spawns.map((locator) => {
    const f = s.fsms.find((f) => f.source === locator.source),
      state = f?.states.find((s) => s.index === locator.state),
      a = state?.actions.find((a) => a.index === locator.action);
    check(
      f && state && a?.type === 'FFG.JIME.Actions.SpawnEnemyGroup',
      'Origine spawn non valida.',
    );
    const p = a.parameters;
    check(
      Object.keys(p).every((k) =>
        [
          'Message',
          'GroupToSpawn',
          'SpecifySize',
          'GroupSize',
          'IgnoreCost',
          'AdditionalPoints',
          'RandomBonuses',
          'Bonuses',
          'Logic',
          'SpawnPosition',
          'FocusCamera',
          'Succeeded',
          'Failed',
        ].includes(k),
      ),
      'Parametro spawn ignoto.',
    );
    check(resolve(f.source, p.GroupToSpawn) === enemy.source, 'Spawn cross-model.');
    check(
      boundValue(p.SpecifySize, f) === true &&
        boundValue(p.IgnoreCost, f) === false &&
        boundValue(p.RandomBonuses, f) === false &&
        list(p.Bonuses).length === 0,
      'Variante spawn fuori closure.',
    );
    const size = integer(boundValue(p.GroupSize, f), 'Dimensione richiesta', 1, maximum),
      points = integer(boundValue(p.AdditionalPoints, f), 'Punti aggiunti');
    const logicGO = asset(resolve(f.source, boundValue(p.Logic, f)), 'GameObject');
    const components = list(logicGO.data.m_Component).map((p) =>
      resolve(logicGO.source, object(p).component),
    );
    const ofClass = (cls: string) => {
      const found = components.filter((p) => assets.get(p)?.cls === cls);
      check(found.length === 1, `Binding ${cls} ambiguo/assente.`);
      return asset(found[0]!, cls);
    };
    const logic = ofClass('EnemyLogic'),
      yieldable = ofClass('IYieldableComponent'),
      logicFsm = ofClass('PlayMakerFSM');
    for (const component of [logic, yieldable, logicFsm])
      check(
        resolve(component.source, component.data.m_GameObject) === logicGO.source,
        'Binding componente su GO estraneo.',
      );
    check(pointer(logic.data.Enemy).path === 0, 'Logica già collegata.');
    const fsmPointer = pointer(yieldable.data.Fsm);
    check(
      fsmPointer.path === 0 || resolve(yieldable.source, yieldable.data.Fsm) === logicFsm.source,
      'Binding yieldable errato.',
    );
    const definition = s.fsms.find((f) => f.source === logicFsm.source);
    check(definition?.handlers.DEFEATED !== undefined, 'Callback DEFEATED assente.');
    const go = asset(resolve(f.source, boundValue(p.SpawnPosition, f)), 'GameObject');
    const tiles = list(go.data.m_Component)
      .map((p) => resolve(go.source, object(p).component))
      .filter((p) => assets.get(p)?.cls === 'Tile');
    check(tiles.length === 1, 'SpawnPosition senza Tile univoca.');
    const tile = asset(tiles[0]!, 'Tile'),
      tileModel = resolve(tile.source, tile.data.Model);
    check(resolve(tile.source, tile.data.m_GameObject) === go.source, 'Tile/GO incoerente.');
    const tileSpaces = list(tile.data.Spaces).map((p) => resolve(tile.source, p));
    tileSpaces.forEach((source) => asset(source, 'TileSpace'));
    check(tileSpaces.length === 1, 'Spawn multi-space non coperto da questo nucleo.');
    const realizedTile = s.projection.sections
      .flatMap((s) => s.tiles)
      .find((t) => t.source === tile.source);
    const position = s.projection.spaces.find((p) => p.tileSource === tile.source && p.index === 0);
    check(
      realizedTile?.modelSource === tileModel && position && position.source === tileSpaces[0],
      'Spawn non presente nella posa congelata.',
    );
    const event = (raw: unknown) => {
      const e = object(raw);
      check(
        e.kind === 'event' && typeof e.name === 'string' && state.transitions[e.name] !== undefined,
        'Evento spawn senza transizione fonte.',
      );
      return { event: e.name, state: state.transitions[e.name]! };
    };
    return {
      id: `${f.source}/${state.index}/${a.index}`,
      origin: locator,
      parameterHash: a.parameterHash,
      size,
      points,
      cost: costs.find((c) => c.size === size)!.points,
      logic: {
        gameObject: logicGO.source,
        component: logic.source,
        fsm: logicFsm.source,
        yieldable: yieldable.source,
        defeatedState: definition.handlers.DEFEATED,
      },
      position: {
        gameObject: go.source,
        tile: tile.source,
        tileModel,
        tileHash: realizedTile.hashId,
        sourceSpace: tileSpaces[0]!,
        spaceId: position.id,
        index: 0,
        nodePosition: position.nodePosition,
      },
      success: event(p.Succeeded),
      failure: event(p.Failed),
    };
  });
  unique(
    spawns.map((s) => s.id),
    'Spawn',
  );
  check(
    sourceActions.filter((a) => a.type === 'FFG.JIME.Actions.SpawnEnemyGroup').length ===
      spawns.length,
    'Spawn fonte omesso.',
  );
  const compiled = {
    enemy,
    instructions,
    items,
    spawns,
    sourceActions,
    coverage: {
      states: s.fsms.reduce((n, f) => n + f.states.length, 0),
      actions: sourceActions.length,
    },
    dependencies: [
      ...new Set(
        sourceActions
          .flatMap((a) => (a.dependency ? [a.dependency] : []))
          .concat(instructions.flatMap((i) => i.dependencies)),
      ),
    ],
  };
  const data = {
    format: 'combat-artifact-v1' as const,
    algorithm: 'first-combat-kernel-v1' as const,
    sourceFingerprint: digest(s),
    projectionFingerprint: s.projection.fingerprint,
    source: s,
    compiled,
  };
  return { ...data, fingerprint: digest(data) };
}
export type CombatArtifact = ReturnType<typeof compileCombatSource>;

/** Rebuilds all derived values; a checksum alone never validates an artifact. */
export function verifyCombatArtifact(
  raw: unknown,
  expected?: { sourceFingerprint?: string; projectionFingerprint?: string; fingerprint?: string },
): CombatArtifact {
  bounded(raw);
  const record = object(raw);
  check(
    Object.keys(record).sort().join(',') ===
      'algorithm,compiled,fingerprint,format,projectionFingerprint,source,sourceFingerprint',
    'Formato artifact strict.',
  );
  const artifact = compileCombatSource(record.source);
  check(digest(raw) === digest(artifact), 'Artifact alterato o derivazione incoerente.');
  if (expected)
    for (const key of ['sourceFingerprint', 'projectionFingerprint', 'fingerprint'] as const)
      if (expected[key] !== undefined)
        check(expected[key] === artifact[key], `Artifact cross-source: ${key}.`);
  return artifact;
}
