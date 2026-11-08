import type { ScenarioAction } from '../shared/scenario';
import { invariant } from '../map-freeze/validate';

/** Source types whose bounded semantics have an explicit IR handler. */
const sourceHandlers: Record<string, ScenarioAction['op'] | ScenarioAction['op'][]> = {
  'FFG.JIME.Actions.DisplayMessageCancelConfirm': ['confirm', 'sourceTest', 'modalWait', 'choice'],
  'FFG.JIME.Actions.DisplayMessageChallenge': 'challenge',
  'FFG.JIME.Actions.DisplayMessageMultipleChoice': 'choice',
  'FFG.JIME.OwnsProducts': ['nullProduct', 'ownsProducts'],
  'FFG.JIME.Actions.AddItemToInventory': 'addItem',
  'FFG.JIME.Actions.AddLore': 'lore',
  'FFG.JIME.Actions.AwardXP': 'awardXP',
  'FFG.JIME.Actions.SetNextAdventure': 'nextAdventure',
  'FFG.JIME.Actions.ProceedToNextGame': 'proceed',
  'FFG.JIME.Actions.EndGame': 'endGame',
  'FFG.JIME.Actions.DisplayMessagePlayerChoice': 'chooseHero',
  'FFG.JIME.Actions.AwardTitle': 'awardTitle',
  'Synthetic.PhysicalProgram': 'physical',
  'FFG.JIME.Actions.DisplayMessage': ['message', 'physical'],
  'FFG.JIME.Actions.GetStartTileId': 'getStart',
  'FFG.JIME.Actions.RevealTile': 'revealTile',
  'FFG.JIME.Actions.HighlightTileSpace': 'highlight',
  'FFG.JIME.Actions.ExploreTile': 'explore',
  'FFG.JIME.Actions.SetSectionVisibility': 'section',
  'FFG.JIME.Actions.SetObjective': 'objective',
  'FFG.JIME.Actions.AddThreatEvent': ['threat', 'battleThreat'],
  'HutongGames.PlayMaker.Actions.SetBoolValue': 'set',
  'HutongGames.PlayMaker.Actions.SetIntValue': ['set', 'copyInt'],
  'HutongGames.PlayMaker.Actions.BoolFlip': 'flip',
  'FFG.JIME.Actions.GetTileId': 'getTile',
  'HutongGames.PlayMaker.Actions.GetPosition': 'getPosition',
  'FFG.Common.Actions.CheckBool': 'branchBool',
  'HutongGames.PlayMaker.Actions.BoolTest': 'branchBool',
  'HutongGames.PlayMaker.Actions.SendEventByName': 'broadcast',
  'HutongGames.PlayMaker.Actions.SendEvent': ['send', 'broadcast'],
  'FFG.Common.Actions.FinishProcessingEvent': 'release',
  'FFG.Common.Actions.FinishFSM': 'stop',
  'FFG.Common.Actions.Delay': 'delay',
  'FFG.JIME.Actions.RevealNode': 'revealNode',
  'FFG.JIME.Actions.HideThisNode': 'hideNode',
  'HutongGames.PlayMaker.Actions.IntAdd': 'addInt',
  'HutongGames.PlayMaker.Actions.IntOperator': [
    'subtractInt',
    'multiplyInt',
    'sumInt',
    'divideInt',
  ],
  'HutongGames.PlayMaker.Actions.GetFsmInt': 'sourceInt',
  'HutongGames.PlayMaker.Actions.BoolAllTrue': 'whenTrue',
  'FFG.JIME.SpawnEnemyGroupsFromSpawnPoints': 'battleSpawn',
  'FFG.JIME.Actions.GetEnemyReadyState': 'battleReady',
  'FFG.JIME.Actions.EnemyGroupAddToTracker': 'battleSpawn',
  'FFG.JIME.Actions.EnemyGroupExhaust': 'battleExhaust',
  'FFG.JIME.Actions.IsNodeVisible': 'battleVisible',
  'FFG.JIME.Actions.HideNode': 'battleNode',
  'FFG.JIME.Actions.EnemyGroupRemoveFromReserve': 'battleReserve',
  'FFG.JIME.Actions.EnemyBannerRemoveFromReserve': 'battleReserve',
  'FFG.JIME.Actions.SpawnRandomEnemyGroups': 'spawnRandom',
  'FFG.JIME.Actions.SpawnEnemyGroup': ['spawnFixed', 'battleSpawn'],
  'FFG.JIME.Actions.EnemyGroupRemoveAll': 'removeEnemies',
  'HutongGames.PlayMaker.Actions.IntCompare': 'compareInt',
  'HutongGames.PlayMaker.Actions.IntSwitch': 'switchInt',
  'FFG.JIME.Actions.IsTileExplored': 'isExplored',
  'FFG.Common.Actions.FocusCameraOnWorldPositions': 'focus',
};

export function validateSourceHandler(action: ScenarioAction) {
  invariant(
    Object.hasOwn(sourceHandlers, action.origin.type) &&
      [sourceHandlers[action.origin.type]].flat().includes(action.op),
    'Tipo fonte senza handler certificato corrispondente.',
  );
  if (action.op === 'set')
    invariant(
      action.origin.type.endsWith('SetBoolValue')
        ? typeof action.value === 'boolean'
        : Number.isInteger(action.value),
      'Tipo del valore incompatibile con l’handler fonte.',
    );
}
