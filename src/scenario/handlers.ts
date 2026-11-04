import type { ScenarioAction } from '../shared/scenario';
import { invariant } from '../map-freeze/validate';

/** Source types whose bounded semantics have an explicit IR handler. */
const sourceHandlers: Record<string, ScenarioAction['op'] | ScenarioAction['op'][]> = {
  'FFG.JIME.Actions.DisplayMessageCancelConfirm': ['confirm', 'sourceTest'],
  'FFG.JIME.Actions.DisplayMessageChallenge': 'challenge',
  'FFG.JIME.Actions.DisplayMessageMultipleChoice': 'choice',
  'FFG.JIME.OwnsProducts': 'nullProduct',
  'FFG.JIME.Actions.AddLore': 'lore',
  'Synthetic.PhysicalProgram': 'physical',
  'FFG.JIME.Actions.DisplayMessage': 'message',
  'FFG.JIME.Actions.GetStartTileId': 'getStart',
  'FFG.JIME.Actions.RevealTile': 'revealTile',
  'FFG.JIME.Actions.HighlightTileSpace': 'highlight',
  'FFG.JIME.Actions.ExploreTile': 'explore',
  'FFG.JIME.Actions.SetSectionVisibility': 'section',
  'FFG.JIME.Actions.SetObjective': 'objective',
  'FFG.JIME.Actions.AddThreatEvent': 'threat',
  'HutongGames.PlayMaker.Actions.SetBoolValue': 'set',
  'HutongGames.PlayMaker.Actions.SetIntValue': 'set',
  'HutongGames.PlayMaker.Actions.BoolFlip': 'flip',
  'FFG.JIME.Actions.GetTileId': 'getTile',
  'HutongGames.PlayMaker.Actions.GetPosition': 'getPosition',
  'FFG.Common.Actions.CheckBool': 'branchBool',
  'HutongGames.PlayMaker.Actions.BoolTest': 'branchBool',
  'HutongGames.PlayMaker.Actions.SendEventByName': 'broadcast',
  'FFG.Common.Actions.FinishProcessingEvent': 'release',
  'FFG.Common.Actions.FinishFSM': 'stop',
  'FFG.JIME.Actions.RevealNode': 'revealNode',
  'FFG.JIME.Actions.HideThisNode': 'hideNode',
  'HutongGames.PlayMaker.Actions.IntAdd': 'addInt',
  'HutongGames.PlayMaker.Actions.IntOperator': 'subtractInt',
  'HutongGames.PlayMaker.Actions.IntCompare': 'compareInt',
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
