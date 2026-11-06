# Primo campo → preparazione → avventura 2: contratto sorgente

Ricerca statica per [#120](https://github.com/Ic3b3rg/lotr-table-game/issues/120),
6 novembre 2026, sul main `2106fd06b1e66030bffa384bd725dc896f900ca3`, schema 28.
**Entrambi gli esiti dell’avventura1 conducono al modello2, passando dalla
mappa della campagna e dal campo. La campagna conserva progressi e proprietà;
il tavolo viene ripreparato secondo le regole delle avventure successive.**
Il modello2 usa una mappa battaglia, due impostazioni di tabellone e Scoperta 3;
non il generatore viaggio o lo startup dell’avventura1.

Il contratto distingue comportamento dell’app, regola fisica e adattamento
necessario al digitale. Non abilita la partenza. La capsule non contiene le
scene richieste per verificare geometria e caselle battaglia; il ramo A2 dopo
sconfitta contiene inoltre un messaggio italiano incongruente, che non
autorizza a dedurre una debolezza dal nome dello stato. Questi limiti precedono
una certificazione del primo turno legale.

## Fonti, perimetro e identificatori

Autorità fissate dalla [baseline di fedeltà](../planning/fidelity-baseline.md):
Steam **1.6.6#1128**, build **24301165**, Unity **2022.3.62f2** per automazioni;
regole ufficiali e correzioni per il tavolo; workbook V1.10 per i dati fisici,
con provenienza distinta. Prodotti posseduti espliciti **`[0]`**, senza DLC o
promozionali sbloccati. `RequiredProducts=[]` su A2 non allarga questa proprietà.
Il [grafo precedente](base-campaign-routing.md) è stato usato per selezionare
gli ingressi, poi i metodi pertinenti sono stati riletti dalle DLL.

| Sigla | Fonte e locatore |
| --- | --- |
| A | `primary/Managed/Assembly-CSharp.dll`, SHA256 `8869ef87b7d49f4993911904e35d78b72f8339e91158bbe8784c9691a9d743c6`; token `0x06…` e offset `IL_…` relativi al codice del metodo. [Inventario app](official-app-inventory.md). |
| P | `primary/Managed/PlayMaker.dll`, SHA256 `a7b91f8e0eeb2c3edf351eed4ca722088d6d0281d3db718d7db153c9ff756b54`; stessi locatori. |
| S / R | `primary/sharedassets0.assets` / `primary/resources.assets`; il numero seguente è il pathID Unity. `R27344.s[7].a[1]` indica stato/azione, indici zero based. [Verifica dello schema](official-app-schema-validation.md). |
| B / M | TextAsset italiani nei due bundle ricevuti: `BonesOfArnor_it`, CAB `de6e1db3db3feb5f9cac9ab9f2ee46c7`, pathID `-2938581942859744165`; `Main_it`, CAB `f8344648403e00c8c44347d4709b3e23`, pathID `-7439224213581943799`. Chiave e record CSV identificano il contenuto privato. |
| RR | [Rules Reference ufficiale](https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf), pagine stampate e paragrafi. |
| IT | [Manuale italiano](https://cdn.svc.asmodee.net/production-asmodeeit/uploads/2022/09/Viaggi_nella_Terra_di_Mezzo.pdf), [FAQ italiane2.0](https://cdn.svc.asmodee.net/production-asmodeeit/uploads/2022/09/jme_faq_ita.pdf), [carte corrette](https://cdn.svc.asmodee.net/production-asmodeeit/uploads/2022/09/JME_Carte_Aggiornate.pdf). |
| WB | `primary/title-card-workbook.xlsx`, SHA256 `833edd0f9235d559253c6c0d43e61bcc0b5d955103bb2001e37a2e3ddef88ca4`; worksheet e coordinate, senza pubblicarne i testi. [Inventario workbook](card-workbook-inventory.md). |

Il manifest ricevuto è stato verificato **prima del parse**: 4.839 byte,
SHA256 `2b5fdeb8f6269b252ee2786d1e097b71c9f56e05f9798ae19a87f86b343cdb0d`.
Tutte le 27 righe, 195.885.646 byte, sono state verificate prima della copia;
percorsi relativi unici, senza traversal o componenti symlink, file regolari.
Le27 copie sono state ricontrollate. README e provenienze sono stati letti
successivamente; gli handle assoluti annidati sono rimasti identità storiche.
Nessun backup precedente è stato acquisito.

## Uscita A1 e veri ingressi della campagna

`GameController.SignalEndGame` imposta la conclusione, chiama il
`RecordAdventureCompleted` che in questa build non registra l’esito e
inoltra il vero evento alla FSM. Prima dell’evento controlla la presenza
dell’abilità232 in `HeroInfo[].EquippedSkillIds`: se presente nella compagnia
aggiunge2 Sapienza una volta per questa chiamata, senza moltiplicare per gli
eroi. Non controlla `UnlockedTitleIds` e non assegna XP aggiuntivi.
A `0x06000c96 IL_001b–007d`, `0x06000cd8`, `0x06000c9c`.

| Ramo | Stati R20275 | Effetti prima del campo | Destinazione |
| --- | --- | --- | --- |
| Vittoria | `30 → 32 → 33` | `Adventure/Bandits/Win?=true`;4 XP a ciascun eroe nel ruolo scelto per A1;2 Sapienza, oltre all’eventuale bonus232 e alla Sapienza già ottenuta. | `SetNextAdventure(S806)` poi `ProceedToNextGame`. |
| Sconfitta | `34 → 31 → 32 → 33` | Due messaggi distinti; `Win?=false`;3 XP per eroe/ruolo A1;1 Sapienza, con la stessa conservazione e condizione del bonus. | Identico riferimento S806, non un incremento numerico. |

Questi sono effetti delle azioni di ingresso, non premi subordinati alla
chiusura di tutti i messaggi dello stato: `isSequence=false`; P
`FsmState.ActivateActions 0x060005b5` avvia le azioni in ordine senza attendere
che ogni precedente sia terminata. `AwardXP.OnEnter` usa
`max(0, GetAvailableXP(eroe,ruolo)) + premio` per tutti gli eroi, senza filtro
sconfitti; `AddLore.OnEnter` somma al globale corrente e attende la propria
animazione. A `0x0600125f`, `0x06001251/0x06003c47`;
R20275.s[30–34], parametri `XP`, `Lore`, `boolVariable/boolValue`, `Adventure`.
Gli eroi sconfitti mantengono il diritto agli XP e alla prossima avventura:
[RR §24.2, p12](https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf#page=12).

`SetNextAdventure.OnEnter` svuota `AlternativeAdventureIds`, quindi scrive
`CurrentAdventureId=2` dal modello assegnato. `ProceedToNextGame` aggiunge
**1**, l’ID del modello ancora giocato, a `CompletedAdventureIds`; non
aggiunge2 e non modifica la destinazione. Poi ripulisce lo stato della scena
e chiama `LevelLoader.GameToRestScene`. La conclusione `FinishFSM` è un altro
confine: l’azione FFG eredita `HutongGames.PlayMaker.Actions.FinishFSM.OnEnter`.
A `0x060012be`, `0x060012a4`, `0x06000c97 IL_0000–005b`, `0x06002316`.
L’append originale non è una garanzia di idempotenza: il digitale deve
conservarne l’effetto una sola volta nel registro già esistente.

### Mappa, storia, campo, scelta e ritorno

Il loader normale risolve il modello corrente2, carica il contesto del campo
e apre la mappa della campagna, scena10; al termine del caricamento richiede
un salvataggio. Il ripristino indiscriminato dei globali visibile nell’altro
ramo è per il quest launcher: non è il ramo di questa campagna.
A `LevelLoader/<CoroutineGameToRestScene>d__26.MoveNext 0x06003920`,
`IL_00cd–0198`; `CoroutineLoadRestScene 0x06003938`.

| Ingresso effettivo | Comportamento verificato | Scrittura/salvataggio |
| --- | --- | --- |
| `UIMapScene.Load`, `SelectAdventure`, frecce | Lista di corrente più alternative; selezione e testi seguono l’indice. Qui la lista è solo2. | Selezionare o cambiare indice non conclude l’avventura e non assegna premi. A `0x06001050–1052`, `1056–1057`, `105d`. |
| Primo `OnContinueButtonClicked` | Mostra il passaggio alla storia/località selezionata e imposta `isEpilogueVisible`. | Nessuno scambio della destinazione in questo ramo. A `0x06001054 IL_0024–00d3`. |
| Continue con storia visibile | `SwapMainUpcomingAdventure`, poi `MapSceneToRestScene`. | Una vera alternativa selezionata sostituisce il corrente e riceve il vecchio corrente nella stessa posizione della lista. Se uguale al corrente è no-op. Il campo viene riaperto, senza nuovo premio. A `1054 IL_000b–0023`, `1055`, loader `0x06003944`. |
| Fallback dei due `GetUpcomingAdventure` | Corrente≥0: risolve quell’ID. Corrente negativo: primo modello se completati null/vuoti, altrimenti elemento dell’array dopo l’ultimo completato; ultimo/assente dà null. | Nessun `id+1`. Un corrente non risolvibile non autorizza un altro fallback; lo scambio non riempie automaticamente un corrente negativo quando non trova un’alternativa. A `0x0600105c`, `0x06000e22`, `1055`. |
| Testi della mappa | Nome/località/storia del modello selezionato; `RestTextOverride` non vuoto sostituisce la storia. | I rami A1 studiati non impostano un override. La sua cancellazione verificata è alla partenza. A `0x06001051`, `0x06003984 IL_014c–0157`. |
| `UIRestScene.OnContinueClicked` | Passa alla selezione ruoli. `OnRoleSelected` libera il ruolo dagli altri eroi e lo assegna all’eroe selezionato. | Cambia subito `SerializedHero.RoleId`; non trasferisce XP, abilità comprate o oggetti. A `0x06000e12`, `e08`, `0x06000cce`. |
| `OnBackClicked` | Torna alla vista abilità/campo e cambia le callback dei ritratti. | Non ripristina il ruolo precedente: nessuna transazione di annullamento dei ruoli. A `0x06000e13`, coroutine `0x0600398a/39ae`. |
| `OnEmbarkButtonClicked` | Rifiuta la partenza se qualunque eroe ha `RoleId=-1`. | Niente partenza parziale. A `0x06000e1a`. |
| `CoroutineEmbark` | Con prossimo modello valido, garantisce un saldo≥0 nel ruolo attuale di ciascun eroe, poi passa il modello al loader; con modello null torna ai titoli. | Aggiunge eventualmente una voce XP0 per un nuovo ruolo, conservando le altre; cancella `RestTextOverride`. A `0x06003984 IL_003d–007d,013c–0168`, `0x06000cd3/cd4`. |

La selezione dei ruoli base usa S2334–2339, tutti con
`RestrictedHeroes=[]`; l’unicità è realizzata dalla callback, non da uno
scambio degli inventari. `ResetScene` decide quale menu mostrare usando
prossimo modello/primo modello e completamenti: non ricrea eroi o mazzi.
A `0x06000dec IL_00e4–0180`, `0x06000dfd`, `0x06000e09`.

La partenza contiene anche una verifica generica del titolo5: possedere
almeno quattro delle abilità20/30/41/52/63, purché nessun eroe possieda già
quel titolo; aggiunge `UnlockedTitleIds`, poi attende il messaggio se presente.
Sono cinque upgrade di costo3 di ruoli diversi, verificati in
S2461/2538/2550/2562/2574. Non si raggiunge questa soglia con il solo premio
3/4XP del primo ruolo al primo campo. Non va però eliminata dalla semantica
generale della callback. A `0x06000e1e`, `0x06003984 IL_007f–013a`,
`0x06000cc3`; titolo5 S2783. Non è un premio obbligatorio del passaggio A1→A2.

### Salvataggi e ripresa originali

`GameSerializer.Save` conserva i globali e i prodotti della collezione,
aggiorna timestamp e scena; **solo nella scena2** scrive `AdventureData`
e l’ID del modello giocato. Un eventuale `AdventureData` precedente nel
record del campo non prova che si debba riprendere A1: `Load` carica la scena
avventura solo per scena2; per campo1/mappa10 conserva i dati di campagna.
A `0x06000e6a IL_0019–0029,0094–00d8`, `0x06000e6b IL_0020–005a`.

I pulsanti Save & Quit controllano `CanSave` e chiamano
`RestSceneToTitlescreen`; la coroutine salva **prima** di Cleanup e del
ripristino dei globali. Il rientro passa per hotload e caricamento del modello
corrente. Il passaggio mappa→campo non ha un proprio autosave nella coroutine
letta; non equivale a salvare ogni scelta. A `0x06000e11`, `0x0600105b`,
`0x06003956 IL_007f–00c0`, `0x06003962`; salvataggio effettivo
`GameData/<CoroutineSave>d__20 0x0600390e`.

L’app non conserva le zone e gli ordini dei mazzi fisici né le posizioni
fisiche delle figure. Non offre la garanzia per richiesta interrotta che
richiedono gli [ADR2](../adr/0002-salvataggio-e-conferma-delle-azioni.md) e
[ADR3](../adr/0003-registro-ordinario-e-fonte-dell-incontro.md).
[RR §80, p22](https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf#page=22).

## Stato da conservare, restituire e ricostruire

La pulizia dopo l’avventura e la preparazione successiva sono due operazioni
diverse. La norma non prescrive di portare il vecchio ordine del mazzo nella
nuova avventura. Il campo può precedere la nuova selezione dei ruoli senza
perdere i saldi del ruolo precedente.
[RR, “After Each Adventure” e “Camp”, p3](https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf#page=3),
[“Continuing a Campaign”, p5](https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf#page=5).

| Stato | Operazione e ordine | App / norma / requisito digitale |
| --- | --- | --- |
| Compagnia, eroi, difficoltà, proprietà prodotti | Conservare identità, nome della compagnia, `CampaignId/SlotGUID`, numerosità, difficoltà della campagna e `[0]`. Gli sconfitti tornano attivi. | A `SerializedGame.HeroInfo/CampaignDifficulty/ProductIds`; `Hero.Reset 0x06000d1e`; RR §24.2, §26.1. Il numero H è quello degli eroi, non dei dispositivi. |
| Premi e saldi XP | Applicare una volta i premi A1 ai ruoli A1; conservare saldi per eroe/ruolo dopo acquisti/rimborsi. Il cambio ruolo successivo non sposta questi fondi. | A `AwardXP`, `SerializedRole.RoleId/XP`, `Get/SetAvailableXP`; [RR §§36.1–36.8, pp14–15](https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf#page=14). Ricevuta del premio e saldo spendibile sono dati distinti. |
| Sapienza e abilità232 | Conservare totale precedente, aggiungere premi e bonus condizionale; gli upgrade non la spendono. | A `GameFsmVariables._lore`, `SignalEndGame`, `AddLore`; [RR p4 e §56](https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf#page=4). L’eventuale +2 dello startup A2 è ancora un effetto diverso. |
| Abilità comprate | Conservare tutte quelle ancora possedute, anche di ruoli precedenti; restituire alla disponibilità comune le copie vendute. | A `EquippedSkillIds`, `AddSkill/RemoveSkill 0x06000cd6/cd7`, UI `0x06000e07`; RR p4/p5. Nessun accumulo delle carte ruolo gratuite come se fossero acquisti. |
| Titoli | Conservare proprietà anche se la carta era rimossa dall’avventura; recuperarla per il mazzo successivo. Non lasciare automaticamente preparato un titolo vecchio. | A `UnlockedTitleIds`, `AddTitleToHero` modifica questa lista, non `EquippedSkillIds`; [RR §§105.1–105.4, p26](https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf#page=26), FAQ IT p2. Proprietà e uso/preparazione restano distinti. |
| Danni, paure e benefici | Al termine scartare tutti quelli dell’eroe, anche sconfitto; nessuna condizione di quelle carte continua in A2. | RR p3, §§24.2,27.1/27.3. Danno/paura tornano in fondo al rispettivo mazzo; benefici alla riserva. Il successivo shuffle rende irrilevante quell’ordine per il nuovo mazzo, non per l’episodio archiviato. |
| Ispirazione, altri segnalini personali, effetti temporanei | Scartare tutti i segnalini; ricreare l’area personale senza i residui temporanei di A1. Applicare poi i veri nuovi trigger delle carte. | RR p3. L’assenza di questi dati nell’app non è una regola di reset. Un campo persistente come `SerializedHero.Corruption` non è cancellato da `Hero.Reset`: non estendere la pulizia ad ogni proprietà chiamata “condizione”. |
| Ultimo Sforzo | Resettare difficoltà personale a1 e stato personale a0/attivo. Conservare `SerializedGame.LastStandsFailed`, il contatore cumulativo separato. | A `ResetGameState 0x06000ca5`, `Hero.Reset 0x06000d1e`, getter/setter `0x06000cc7–cca`; [FAQ IT p2](https://cdn.svc.asmodee.net/production-asmodeeit/uploads/2022/09/jme_faq_ita.pdf#page=2). La regola errata sul fallimento obbligato vale durante l’Ultimo Sforzo, non elimina il ritorno nell’avventura successiva. |
| Debolezze | Restituire **tutte** quelle di ogni zona a fine A1; nella nuova preparazione mescolare il mazzo comune e assegnarne una dalla cima a ogni eroe. | [RR §§112.1–112.4, p27](https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf#page=27), p5. Non conservare né scegliere la vecchia copia; non dedurre una seconda debolezza dal ramo A2 ambiguo. |
| Base, eroe e ruolo | Ricomporre base1–6, eroe1–5, tutte le abilità comprate e titoli; scegliere il ruolo successivo e aggiungere le sue1–3. Preparare la sua1; mescolare le altre con le carte raccolte. | RR p5; WB `Skill Cards!17–22`, righe eroe e ruolo; S2334–2339. I `CoreSkills` dell’app contengono due modelli per ruolo: non sostituiscono le tre carte fisiche della norma. La composizione non rimane fissa a15 dopo acquisti/titoli. |
| Zone e ordini | Recuperare scarti, preparate, rivelate e carte messe da parte; rimuovere vecchie debolezze e vecchie carte ruolo gratuite; costruire nuovi ordini, scarti/rivelate inizialmente vuoti e sola carta ruolo1 preparata prima dei trigger. | RR p3/p5, §105.4. Il digitale deve registrare copie, shuffle e ordine di assegnazione delle debolezze; l’app non fornisce questi risultati. Le decisioni d’ordine spettano al gruppo, non a una nuova priorità di rete. |
| Oggetti personali aggiornati | Conservare le versioni risultanti dai miglioramenti; il precedente torna alla disponibilità. Nessun nuovo assortimento iniziale e nessuno scambio fra eroi. | A `HeroItemIds`, `OnUpgradeItemConfirmed 0x06000e03`; [RR p3–4 e §§34,51.5–51.7](https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf#page=4). Consultazione/selezione dell’alternativa precedono la sostituzione confermata. |
| Accessori comuni e consumi | Restituire tutti gli accessori equipaggiati all’inventario comune, conservarne le versioni aggiornate, riassegnarne al massimo uno per eroe nel setup. Alla nuova equipaggiatura collocare consumi pari al valore stampato e ripristinare la faccia utilizzabile. | A `SerializedGame.ItemIds`, `get_GroupItemIds 0x06000cbe`; l’app non memorizza l’assegnazione fisica. [RR §§25.1–25.3,109.2–109.6, pp12/27](https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf#page=27), FAQ IT p2. Non conservare i consumi residui di A1 né duplicare una copia su due eroi. |
| Limiti di equipaggiamento | Nel nuovo setup: massimo un’armatura, due icone mano complessive e un accessorio; usare le copie realmente possedute. | RR §§34.1–34.5/51.4. L’eccezione che permette più accessori acquisiti **durante** un’avventura non aumenta il limite iniziale successivo. |
| Globali e storia della campagna | Conservare Sapienza, flag A1, liste usati/sbloccati, ID corrente/completati/alternative e proprietà. Resettare solo i globali scena effettivi. | `ResetGameSceneVariables 0x06000ce1`: `PlayerCount=H`, default di `EnemyPoints`, `Round`, `Threat`, `IsDarkness`, `DarknessMessageOverride`. R19891: default0/1/0/false/ stringa vuota. Non cancella tutti i nomi `Adventure/…`; `Adventure/Bandits/Win?` serve ad A2. |
| Obiettivo, regole e override | Il reset della label UI non cancella `SerializedGame.CurrentObjective`; A2 lo sostituisce nello stato8 con il proprio packet compresso. `CurrentAdventureRules` è svuotato alla conclusione; `RestTextOverride` viene rimosso alla partenza. | A `0x06000ca5 IL_0046–005f`, `0x06000c96 IL_004e–005d`, `0x0600120f IL_0025–0067`, `0x06003984 IL_014c–0157`. Il nuovo consumer non deve presentare il vecchio obiettivo come attivo in A2. |
| Mappa, nemici, timer e cursori A1 | Terminare le richieste di A1 nel loro episodio; non trasportarne figure, minaccia, timer o fase come stato attivo A2. Creare i nuovi oggetti/locali dai relativi sorgenti. | A `0x06000ca5`, loader `0x06003920`, `Adventure.Awake 0x06000b86`, `BeginAdventure 0x06000b8a`. L’archivio digitale dell’episodio e il suo RNG non vanno riscritti per realizzare questa pulizia. |

Le definizioni complete delle carte rimangono prerequisiti. Per esempio, il
trigger di preparazione della carta ruolo1 del Cacciatore e dell’upgrade
corrispondente modifica l’ispirazione: WB `Skill Cards!K166/K169`, non una
regola generale di azzeramento. WB `Equipment!K24/K26/K27` contiene effetti
**dopo il setup** che possono assegnare un beneficio o ispirazione alle
versioni aggiornate. Vanno risolti con il loro timing e fronte verificato,
anche se il vecchio equipaggiamento non li aveva. Le carte eroe preparate
durante Scoperta 3 possono avere altri trigger: WB `Skill Cards!K41` è un
esempio, non un permesso di ignorare tutti i trigger senza effetto apparente.
La provenienza anomala del Guardiano1 in WB `A130:K130` resta quella del
[report dedicato](guardian-base-card-check.md), senza riclassificazioni.

Le quantità dei tre benefici restano **null/unverified**. Restituire un
beneficio già posseduto significa restituire quella copia registrata;
non autorizza a inventare il totale disponibile. Nessuna5/5/5, disponibilità
infinita, `unknown=empty`, filtro o reroll risolve un consumer mancante.
[Decisione e prove delle quantità](boon-copy-quantity-evidence.md).

## A2: modello e startup bounded

S806 è letto **396/396 byte**, `Type=1`, `IsPreGenerated=false`, due
`BoardSettings` con `Skin=0,1`, sedici river flag false per ciascuno;
`ThreatLimitScaledPerPlayer=true`, `ThreatLimitPerPlayer=13`.
La riserva iniziale è una figura del modello S1640/ID3 e un vessillo élite.
`ThreatLimit=90` è il campo non scelto da `GetThreatLimit(H)` in questo ramo.
A `0x06000d68–d6a`; S806.`BoardSettings/StartingEnemyReserveList`.

Il prefab selezionato è R4285, Adventure R20188 con `Model→S806`, FSM R27344
**118.596/118.596 byte**. Nessun `Map`, `MapBuilder`, `Tile` o `Space` è nel
suo albero verificato; `CustomTiles=null`. Non si possono trattare i suoi
Transform come una mappa viaggio realizzata. Nel loader la condizione
`Type!=0` salta `InitializeBuilder/CreateMap` e la scrittura di
`LastUsedSeed` del generatore viaggio: A `0x06003932 IL_028c–0337`, salto a
`IL_04b5`. Un vecchio `LastUsedSeed` nel salvataggio non identifica la
casualità di A2.

Il caricamento battaglia usa `GetBattleboardSize=2`, richiede gli ambienti
**BattleBoard_Forest e BattleBoard_Rock**, poi configura `BBManager` con i
due BoardSettings. A `0x06003932 IL_00b6–013b`, `0x06000d69/d6a/d50`,
`0x06000d46`, `0x06000b8a IL_0385–0469`, `0x0600137c/137d/137f`.
Queste scene non sono fra i 27 ingressi: caselle, facce fisiche, adiacenze,
bordi e loro corrispondenza ai piazzamenti non sono chiusi da questa ricerca.
I `GameNode.Space=null` dei nodi iniziali non colmano il collegamento.

Un secondo limite di provenienza: il precedente G13 apparteneva al file
`globalgamemanagers`, mentre la capsule contiene `globalgamemanagers.assets`.
Il pathID13 di quest’ultimo è uno Shader, non il ResourceManager. Il tentativo
è registrato; non sono stati cercati altri file. Modello, GameObject e
backreference dell’Adventure concordano, ma manca una nuova verifica diretta
della voce ResourceManager per `S806.Prefab.Path`.

### Ordine e richieste della FSM raggiungibili

L’ordine seguente è la closure dichiarativa del principal dopo
`SCENARIO_BEGIN`, condizionata alla disponibilità delle dipendenze sopra.
Non è una partita eseguita. `BeginAdventure(false)` ricrea gli elenchi scena,
resetta gli eroi/globali scena, imposta Round1, resetta minaccia, applica
riserva/vessillo e avvia setup. A `0x06000b86`, `0x06000b8a IL_0085–025c`.

| Stato R27344 | Effetto effettivo nello startup |
| --- | --- |
| `2` | Calcola `Threat Value=3×PlayerCount`; registra R2814/ThreatEvent R28109 sovrascrivendone la soglia predefinita6. `IntOperator.operation=2` è moltiplicazione nell’IL, A `0x06001e8c/1e8e`; `AddThreatEvent 0x06001257`. |
| `1` | Messaggio B `B1_INTRO`, record109: istruzione di disposizione dei due tabelloni. Attende la callback del messaggio. |
| `5` | Evidenzia HeroSpawn R3777/Transform R11449 e presenta B `B1_INTRO_2`, record110: piazzare gli eroi e far effettuare **Scoperta 3 a ciascuno**. Nessun test Spirito1 ereditato da A1. Evidenziazione e camera sono azioni concorrenti dello stesso ingresso. |
| `15` | `BoolTest` del globale `Adventure/Bandits/Win?`; TRUE→3, FALSE→16. L’owner effettivo di `OnEnter` è A `0x06001d74`. Il binding cerca la variabile locale, poi globale: P `0x06000346/0494/06c3/06bc`; il nome non è un valore locale inventato. |
| `16`, solo dopo sconfitta | Un’unica `DisplayMessage`, chiave `B1_WEAKNESS`, MessageSource nullo. La meccanica resta irrisolta: vedere sotto. Poi FINISHED→3. |
| `3 → 19 → 20` | Rivela in tre richieste i gruppi terreno `[R24371,R23719]`, `[R23051,R20158,R21491]`, `[R21123,R21425]`: due cespugli, tre muri, un fuoco e una roccia. Modelli S2615/S2631/S2634/S2626; `IsRandomTerrain=false` e `IsUnique=false` per tutti. |
| `9` | Messaggio introduttivo B `B1_INTRO_3`, record111. |
| `6` | Calcola SP1=4H, SP3=5H, SP4=6H; passa spawn point `[R25524,R27187,R26617]` e budget **`[SP1,SP4,SP3]`**, quindi4H/6H/5H. `EnemyPoints` globale è0 al nuovo setup. |
| `4` | `DisplayMessageAndReveal` sul GameObject R3210/GameNode R21806, ID100301, tipo minaccia; packet M `PLACE_THREAT`, insert B `B1_PORTCULLIS_PLACE`. |
| `7` | Analoga rivelazione R1061/GameNode R23697, ID100300, tipo ricerca; M `PLACE_SEARCH` con insert B `B1_TENT_PLACE`. **AddLore2 è la seconda azione di questo ingresso**, non il premio di un’interazione successiva. |
| `8 → 0` | Presenta B `B1_OBJECTIVE`, imposta `B1_OBJECTIVE_1` (`SetObjective.OnEnter`, A `0x0600120f`), poi `FinishProcessingEvent`. La coroutine setup invia successivamente `ROUND_START` al principal; questo non ha un arco per tale evento. Finito setup, svuota alternative e salva. A `0x060038b8 IL_0096–018f`. |

Percorsi principal: vittoria A1
`[2,1,5,15,3,19,20,9,6,4,7,8,0]`; sconfitta aggiunge16 dopo15.
Il budget di turno non deve aprirsi al primo messaggio o dopo il solo scout.
Il confine ipotetico richiede tutte le richieste, posizioni fisiche, trigger
obbligatori, effetto Sapienza e obiettivo risolti; qui rimane non certificato.

`DisplayMessage` eredita `DisplayMessageBase.OnEnter/OnUpdate`, che prepara
il popup e invoca il vero `PerformAction`; `OnProgress→OnHideFinished` termina
l’azione. La variante Reveal chiama `Node.Reveal`, mostra il packet e termina
dopo chiusura/rilascio dell’evidenziazione. A `0x06001160/1161/1163`,
`115b–115d`, `1169`, `116b/116c/116e`. Non sono prove o scelte libere. Nei packet di piazzamento l’insert0 conserva
una chiave anche con `IsUsed=false` serializzato: `ResolveArguments`
ricalcola quel flag dall’arità, A `0x06000b80 IL_0049–0086`. Non si può
eliminare l’insert prima della risoluzione.

La rivelazione dei terreni passa per `RevealTerrainNodes` e
`Adventure/<CoroutineRevealTerrains>d__79`, A `0x060012ad/12ae`,
`0x06003c59`, `0x060038b2`. I quattro template sono R19918/19934/19937/19929;
P `PlayMakerFSM.InitTemplate 0x06000051` e costruttore Fsm `0x06000445`
spiegano perché una cache locale, come R23257, non sostituisce il template.
Tutti gli ingressi iniziali sono in attesa. `Node.Awake→Initialize` è
ereditato, A `0x06001599/159c`; `Node.Reveal` chiama `PreReveal`/`OnReveal`,
non equivale a inviare automaticamente gli eventi PlayMaker omonimi.
I template non giustificano richieste `UI_TODO` aggiunte allo startup.

Sono stati controllati gli ingressi iniziali dei24 FSM del solo albero A2
istanziato, senza seguire i loro rami successivi: tutti sono in attesa, salvo
il `FinishProcessingEvent` iniziale del principal. I due timer R23017/R20703
partono con `StartValue=TimerValue=1`, `IsRunning=false`, `IsRepeating=false`;
`Adventure.Timers=[]` nel prefab. Non è il timer viaggio A1. Locali principal:
interi0, `Choice0/Choice1=true`, `SECTION2=false`; questi default non attestano
una scelta giocatore iniziale.

### Incongruenza del ramo dopo sconfitta

R27344.s[16] si chiama “Add Weakness”, ma contiene solo il messaggio sopra;
non contiene un’azione che assegni una carta. Il packet ha `LocalizedValue`
e `CompressedValue` vuoti, key `B1_WEAKNESS`; il valore italiano B, record112,
si riferisce invece a diventare nascosto e scartare un segnalino persona.
Il nodo sorgente è nullo e il principal non ha appena piazzato un segnalino
persona. Il testo completo rimane privato.

La rilettura del TextAsset con CSV e lettore binario indipendenti conferma
questa incongruenza del materiale statico, non l’intenzione dell’autore o
una correzione osservata nell’app. `ResolveArguments`, A `0x06000b80`, e
`DisplayMessage.PerformAction 0x0600115b` sono i callee del packet. Non è
lecito tradurre il nome dello stato in una seconda debolezza, assegnare
silenziosamente un beneficio a tutti o eliminare l’istruzione. Per un
consumer completo di questo ramo serve una primaria che ne risolva
l’istruzione e il bersaglio; il ramo resta gated. Nel corpus normativo ricevuto non è stata identificata una correzione che
risolva istruzione e bersaglio; questo mancato riscontro non esclude una
primaria ulteriore.

### Piazzamenti, disponibilità e casualità

I piazzamenti sono Transform del prefab, non caselle già identificate:
HeroSpawn R11449; spawn point R7598/R10876/R11785; terreni R6794/R7684/
R10222/R7428/R11117/R11205/R10475; nodi ricerca/minaccia R12057/R11164.
Posizioni, rotazioni e scale esatte, con i puntatori ai GameObject, sono nel
contratto privato. Senza le scene/tabelloni non vengono inventati confini
attraversabili o la casella dell’eroe; in particolare i muri sono bordi che
modificano l’adiacenza, non semplici ostacoli da collocare al centro.
[RR p3 e §111, p27](https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf#page=27).

| H, eroi | Prima soglia | Minaccia massima | Budget nell’ordine dei tre spawn point |
| ---: | ---: | ---: | --- |
| 2 | 6 | 26 | 8 / 12 / 10 |
| 3 | 9 | 39 | 12 / 18 / 15 |
| 4 | 12 | 52 | 16 / 24 / 20 |
| 5 | 15 | 65 | 20 / 30 / 25 |

`SpawnEnemyGroupsFromSpawnPoints.OnEnter→SpawnGroups`, A
`0x06001122/1125`, mantiene budget per punto, distribuisce eventuali
EnemyPoints extra, sceglie fra indici ancora eleggibili e considera nuovo
gruppo, bonus o figura aggiuntiva con preferenze del modello e H. Non sono
conteggi fissi di nemici. I filtri dei tre punti escludono il mask136;
R25524 richiede inoltre almeno un tratto del mask1024. Il filtro avventura
aggiuntivo ha tutti i mask a0. Si usano i modelli del prodotto posseduto0, costo,
limiti di copie in gioco/pending/riservate e collegamenti; non un pool
ridotto per evitare capacità mancanti. A `0x06000ba4/b94`,
`EnemyGroupFilter.MeetsCriteria 0x06000c4d`, `UserCollectionManager.GetEnemies
0x0600110f`; S2319.`Enemies`,21 riferimenti riletti.

Nel primo punto, con H2, **nessun modello a distanza ammesso costa≤8**:
l’unico candidato base con i tratti richiesti è ID4/S1651, costo iniziale10.
L’assenza di gruppi in quel punto è un caso legale del filtro originale,
non un reroll di convenienza. Con H≥3 il punto può generare nemici; non ne
segue una quantità fissa. L’ordine di presentazione dei gruppi è invece
l’ordine dell’array dei punti e poi della lista prodotta per quel punto:
`CoroutineRevealGroups 0x06003c28`, callback `0x06001127/1128`.

Il core usa **UnityEngine.Random**: selezione di indice/modello/bonus tramite
`GetRandomElement 0x06000ad6` (nessuna estrazione per un unico elemento),
pesi float tramite `Range(0,1)`, e `Randomize(IList) 0x06000ae1`, che effettua
uno swap con indice nell’intera lista per ogni elemento. Non è lo shuffle
con restringimento progressivo. `TryAddBonus/TryAddFigure 0x0600112a/112b`
leggono costi, disponibilità e limiti; i budget vengono aggiornati dopo gli
effetti. Anche `Node.Reveal()` usa `Range(0,0.5)` per il ritardo, A
`0x06001588`: i draw di presentazione condividono questo generatore.

Queste letture non forniscono uno stato Unity iniziale, un transcript completo
delle chiamate delle scene mancanti o parità Unity/JIT. Non basta passare il
seed di A1 a un algoritmo nuovo. La futura realizzazione deve congelare
identità, ordine dei pool, scelte, gruppi, bonus, quantità, salute, vessilli,
piazzamenti e casualità necessaria al replay; la closure dei bonus e delle
scene va completata prima di abilitarla. Non è stato calcolato né eseguito
un layout A2 o un primo turno usando stock ipotetico.

## Seam correnti e prossime slice

Il codice corrente è contesto del gap, non prova dell’originale:

| Seam sul main indicato | Conseguenza per il seguito |
| --- | --- |
| [`conclusion.ts`](../../src/scenario/conclusion.ts), `applyConclusionAction/answerCampaign` | Conserva conclusione, premi, destinazione, mappa/storia/campo e proiezione campagna; `next.status=requires-content`. Non possiede il comando di partenza successiva. |
| [`camp-skills.ts`](../../src/scenario/camp-skills.ts), [`camp-items.ts`](../../src/scenario/camp-items.ts) | Saldi/copie acquistate e inventari aggiornati sono già autorevoli. `skillCopies` iniziale deriva anche dalle vecchie zone: non si può trattare tutta la lista come composizione pronta A2 senza distinguere base/eroe/ruolo/debolezze/acquisti/titoli. |
| [`preparation.ts`](../../src/shared/preparation.ts), [`scenario.ts`](../../src/server/scenario.ts) | Preparazione/startup attuali vincolano oggetti iniziali di rangoI senza accessori e composizione iniziale; `START_SCENARIO` richiede mappa frozen e assenza di scenario. Non sono un consumer del campo con upgrade e acquisti. |
| [`pack.ts`](../../src/scenario/pack.ts), [`runtime.ts`](../../src/scenario/runtime.ts), [`prepared-effects.ts`](../../src/scenario/prepared-effects.ts) | Freeze e startup dipendono dalla fonte attestata; il nuovo prefab/mappa, Scoperta 3 e i trigger delle carte richiedono capacità proprie, non la sostituzione del solo ID. |
| [`physical-cycle.ts`](../../src/server/physical-cycle.ts), [`store.ts`](../../src/server/store.ts), [`state.ts`](../../src/server/state.ts) | Registro v2 con origine round1/Azione immutabile, ricevute e replay integrale già esistono. Il seguito deve usare lo stesso contratto transazionale e conservare l’episodio concluso; niente secondo journal, origine A1 riscritta o migrazione che esegue gameplay. |
| [`scenario.ts`](../../src/client/scenario.ts), [`camp-skills.ts`](../../src/client/camp-skills.ts), [`camp-items.ts`](../../src/client/camp-items.ts) | Campo e lettori esistono. Servono richieste di preparazione/assegnazione e stato del seguito coerenti su tutti i dispositivi, mantenendo controlli di proprietà, attore, revisione e retry. |

Slice minime proposte, senza implementazione in questa consegna:

1. **Handoff e preparazione della compagnia successiva.** Specificare il
   consumer dell’inventario del campo nello stesso registro, mantenendo
   immutabili episodio e origine A1. Prerequisiti: copie e fronti delle carte
   selezionate, saldi e inventari attuali, policy dei trigger. Accettazione:
   entrambi gli esiti, scambi di ruolo, acquisti/rimborsi e upgrade;
   restituzione delle vecchie debolezze/accessori; nuova composizione e
   consumi corretti; duplicate/stale/retry e interruzioni conservano copie,
   ordini, RNG e ricevute. La partenza A2 rimane gated.
2. **Chiudere le primarie dello startup battaglia.** Acquisizione autorizzata
   e sigillata di ResourceManager e scene Forest/Rock, verifica delle facce
   e della topologia fisica, mapping dei piazzamenti; risolvere il packet
   dopo sconfitta e completare pool/bonus/casualità raggiunti. Accettazione:
   consumi esatti, puntatori, bordi/caselle e rami H2–5 verificati da checker
   indipendente; nessun riuso del generatore A1 o ripiego sugli ignoti.
3. **Freeze e startup A2 fino al primo turno.** Solo con quelle dipendenze e
   consumer fisici disponibili; nuovo contenuto congelato prospettivamente.
   Accettazione: piazzamento, Scoperta 3 di ogni eroe, ramo dell’esito,
   tre gruppi terreno, spawn, minaccia/ricerca, +2 Sapienza, obiettivo e
   termine setup; tutti i trigger obbligatori e il primo turno legale.
   Recovery su ogni richiesta e replay intero nello stesso registro.
   Qualunque prerequisito mancante deve bloccare prima di carte, costi o
   RNG della partenza. Nessun retrofit nei freeze storici.

Queste slice non chiudono #33: la sua accettazione richiede ancora il
percorso reale completo e la continuazione, con i limiti di #57/#89/#65
rispettati. L’ordine delle prime due attività può consentire lavoro
indipendente; non richiede un’altra decisione sulla scatola prestata.

## Verifica riproducibile e limiti della consegna

La scratch ignorata propria è `.scratch/first-camp-transition-120/`.
Contiene originali ricevuti immutati, adapter separati, raw/schema,
parametri/IL, contratto normalizzato, checker, tentativi, README e manifest
finale byte/SHA. I pathID pubblicati sono locatori, non contenuto eseguibile. Esempi di
offset oggetto verificati: S806.`Type`52, `ThreatLimitPerPlayer`268,
`BoardSettings[0/1].Skin`348/372; destinazione di R20275.s[32] nel puntatore
`unityObjectParams[0].m_PathID`178.484. Il ledger privato contiene 7.292 locatori di campi e
parametri.

- Due reader UnityPy C/Python concordano su **165 oggetti / 1.949.301 byte**,
  consumo esatto; **1.649 puntatori non nulli** risolti con classe esatta o
  base Unity compatibile,1.569 nulli. Il tentativo sullo Shader G13 è escluso
  da queste attestazioni, non nascosto fra le risoluzioni.
- Un terzo lettore privato usa solo `struct` e lo schema esportato: consuma
  gli stessi byte senza UnityPy, confronta i valori interi e conserva i
  locatori di campo/parametro. È indipendente dall’estrattore di conclusioni;
  condivide lo schema, quindi non è una prova indipendente del layout dello
  schema stesso.
- FSM: backend AssetStudio preesistente, header TPK corretto; nessuna
  modifica degli input/header grezzi. Parametri PlayMaker strutturali con
  indici e confini delle azioni controllati, inclusi wrapper FsmGameObject,
  template, variabili e callback ereditate. I dati normalizzati restano privati.
- IL: **178 corpi A / 28.003 code byte / 10.074 istruzioni**, più
  **22 corpi P / 5.364 code byte / 1.931 istruzioni**, selezionati da
  ingressi/callee e indici di metadati, inclusi piccoli confronti di overload
  scartati;
  lunghezze e salti diretti controllati. Il checker rilegge anche header e
  code byte dal PE originale senza dncil. Non sono stati scanditi tutti i
  corpi IL o ricostruiti tutti gli incontri A2.
- Il checker confronta i percorsi dei due esiti, formule per H2–5, bonus
  presente/assente e il caso ranged H2: **16 combinazioni finite**, più 8 casi di fallback, compreso un array
  non consecutivo dichiarato inventato. Respinge
  **11 alterazioni** di tipo mappa, scala, destinazione, quantità inventate,
  reset cumulativo, composizione, istruzione dedotta dal nome, Scoperta,
  ordine budget, ramo saltato e falso primo turno certificato. Sono controlli
  statici del contratto, non nuove prove del runtime del gioco.
- I quattro PDF sono stati verificati prima dell’estrazione testuale PDFKit;
  regole, FAQ e carte corrette sono state confrontate per i punti pertinenti.
  Il workbook è stato letto via OOXML, con fogli/coordinate espliciti.
  I due URL ufficiali RR/FAQ sono stati consultati nuovamente il 6 novembre;
  le copie locali verificate restano la base delle citazioni normative.

Comandi di riproduzione dal checkout, con il solo interprete/vendor già
autorizzati indicati nel README privato:

```text
PYTHONDONTWRITEBYTECODE=1 <python-autorizzato> .scratch/first-camp-transition-120/helpers/reverify_assets.py
PYTHONDONTWRITEBYTECODE=1 <python-autorizzato> .scratch/first-camp-transition-120/helpers/produce_contract.py
PYTHONDONTWRITEBYTECODE=1 <python-autorizzato> .scratch/first-camp-transition-120/helpers/check_contract.py
```

Sono conservati anche i tentativi falliti: riferimento G13 non pertinente,
assunzioni errate nella visita dei contenitori UnityPy e tipo del wrapper
MessageSource corretto nel checker. Le librerie PDF/workbook opzionali non
presenti non sono state installate. I risultati storici root907 ricevuti
rimangono prove storiche; non sostituiscono nuovi controlli del prodotto.

Nessuna esecuzione Unity/JIT, partita originale, host, browser, DB, export,
build o suite del gioco. Nessuna attestazione su telefoni fisici, Windows o
Safari. Nessuna modifica a runtime/UI/schema/pack, stock o verified;
quantità57 null/unverified, episodio156 statico/gated, #57/#89/#33/#65 aperte.
Unico artefatto pubblico: questo rapporto. Review Standards e Spec fresche,
adozione e integrazione spettano al Root.
