# JiME: inventario dei simboli runtime

Consultazione locale: 23 ottobre 2026. Perimetro dichiarato: JiME 1.6.6; Steam build 24301165, riscontrata nella ricevuta locale `.scratch/materials/official-app-receipt.json`. La ricevuta resta materiale locale escluso tramite `.scratch/` in `.gitignore`. Il [censimento dell'app](official-app-inventory.md) riporta versione, lingua e limiti della lettura dei dati.

**Fonte A, primaria:** `Contents/Resources/Data/Managed/Assembly-CSharp.dll`, percorso relativo alla radice `JiME.app` identificata nella ricevuta; 3.039.744 byte.

SHA256: `8869ef87b7d49f4993911904e35d78b72f8339e91158bbe8784c9691a9d743c6`, calcolato localmente e coincidente con la ricevuta.

Metodo: lettura dei metadati PE/CLI con Python stdlib, tabelle `TypeDef`, `MethodDef`, `Field`, `MemberRef`, `Assembly`. L'identità assembly è `Assembly-CSharp`, versione `0.0.0.0`: non certifica la versione prodotto. Nessuna decompilazione, ispezione dei corpi IL o estrazione delle stringhe narrative `#US`.

## Famiglie osservate e verifiche successive

Tutti i nomi seguenti provengono dalla fonte A. Prefisso dei tipi: `FFG.JIME.`, salvo `FFGRandom`, `PersistentGameObject`, `System.Random` e `UnityEngine.Random`. Le barre separano nomi distinti dello stesso tipo. Le verifiche proposte restano aperte.

- **Campagna:** `CampaignModel.GetFirstAdventureID/GetNextAdventureId`; `GameController.RecordAdventureCompleted/ProceedToNextGame/EndCampaign`; tipi `Actions.SetNextAdventure` e `Actions.AddAlternativeAdventure`. Verificare diramazioni, prerequisiti, conseguenze degli esiti e persistenza delle alternative.

- **Scelta e scorrimento delle avventure:** `UIMapScene.SelectAdventure/GetUpcomingAdventures/SwapMainUpcomingAdventure/OnLeftButtonClick/OnRightButtonClick`; separatamente, `CampaignSelectController.TranslateCampaignSelection`. Verificare ordinamento, alternative selezionabili e differenza fra navigazione e conferma.

- **Generazione mappe:** `Builders.MapBuilder.CreateMap/CoroutineBuildMap/CalculateAllPlacements/RestoreMap/CanSectionsConnect`; `Builders.SectionBuilder.TrySeedRandomTile/CanUseTile/HasMetSizeRequirements`; `TileBucket.Shuffle`. Campi osservati in `MapBuilder`: `RandomSeed`, `Seed`, `CampaignUsedEncounterIds`. Verificare vincoli geometrici, disponibilità delle tessere, tentativi/fallback, collocazione degli incontri e ripristino.

- **Nemici:** `Adventure.IsEnemyEligibleForSpawn/GetRandomEnemyActivation/CoroutinePerformEnemyActivation`; `SpawnEnemyGroupsFromSpawnPoints.PerformEnemySelection`; tipo `Actions.SpawnRandomEnemyGroups`; `EnemyGroupFilter.MeetsCriteria`; `EnemyModel.GetCost/GetActivation`; `EnemyLogic.get_Fsm`. Verificare budget, dimensionamento dei gruppi, bonus, priorità e collegamento alle FSM.

- **Eventi e condizioni:** `Actions.CheckCondition.PerformCheck`, con campi `LeftSide`, `Operator`, `RightSide`, `TrueEvent`, `FalseEvent`; `Adventure.CoroutineProcessEvent`; `GameController.CoroutinePerformThreatEvent`; `ThreatEvent.get_FSM`; tipi `Actions.AddThreatEvent`, `Actions.GetMissionFsmBool`, `Actions.SetMissionFsmInt`. Verificare operatori, soglie, ordine degli eventi, ambito e reset delle variabili.

- **Casualità:** tipo globale `FFGRandom`, metodi `set_Seed`, `get_Count`, `RandomBool`, `Range`, `Next`; campo `SerializedGame.LastUsedSeed`. La tabella `MemberRef` contiene riferimenti a `System.Random.Next/NextDouble` e `UnityEngine.Random.Range/InitState`, senza attribuzione dei chiamanti in questa analisi. Verificare generatori effettivamente usati, intervalli, pesi, consumo delle estrazioni e riproducibilità.

- **Salvataggio:** `GameData.CanSave/CoroutineSave/Load`; `GameSerializer.Save/Load`; `AdventureSerializer.Save/Load`; `SaveLoadUtility.IsSaveFileValid/UpgradeAllSaveFiles`; `PersistentGameObject.MigrateSaveData` (tipo globale). Campi osservati: `SerializedGame.CompletedAdventureIds/AlternativeAdventureIds/AdventureData`; `SerializedAdventure.Tiles/Sections/EnemiesInPlay/ActiveThreatEvents/SceneData`. Verificare stato realmente scritto, serializzazione delle FSM, compatibilità, validazione e punti di salvataggio.

## Limiti

Inventario selettivo: la presenza di un simbolo non dimostra comportamento, chiamate effettive, algoritmo o copertura delle avventure. Collegamenti con asset/FSM, valori e flussi richiedono verifica successiva. Nessuna attestazione di fedeltà o completezza; nessun avvio dell'app, accesso ad account/salvataggi personali, rete o modifica dell'installazione.
