# JiME 1.6.6: verifica degli schemi serializzati

Ricerca locale del 23 ottobre 2026 per [Verificare la lettura delle strutture di campagna dell'app 1.6.6](https://github.com/Ic3b3rg/lotr-table-game/issues/15). **Il puntatore incoerente è spiegato e corretto in memoria; emerge un secondo difetto di rappresentazione degli array.** Entrambe le correzioni sono validate sul campione sotto, senza certificare la ricostruzione della campagna.

Fonte primaria: installazione identificata nel [censimento](official-app-inventory.md), app **1.6.6#1128**, Steam **24301165**, Unity **2022.3.62f2**; `Data/sharedassets0.assets`, `resources.assets`, `globalgamemanagers.assets` e DLL in `Managed/`. Strumenti già installati: UnityPy **1.25.4**, TypeTreeGeneratorAPI **0.0.10**. Ricevute preesistenti: `.scratch/materials/official-app-receipt.json`. Evidenze dell'esperimento: `.scratch/schema-validation/`.

Nel MonoBehaviour `sharedassets0.assets:805`, endian **little**, l'ordine osservato è: `m_GameObject` byte 0–11; `m_Enabled` byte 12; padding 13–15; `m_Script` 16–27; stringa `m_Name` da 28. I dodici byte del puntatore sono `01 00 00 00 e0 08 00 00 00 00 00 00`: `(fileID=1,pathID=2272)`. Il primo external è `globalgamemanagers.assets`; l'oggetto 2272 esiste, classe Unity `MonoScript`, metadati `Assembly-CSharp / FFG.JIME.AdventureModel`.

Lo schema generato omette il flag di allineamento su `m_Enabled`; quello UnityPy/TPK corrispondente alla versione lo contiene (`0x4101`, incluso `0x4000`). La lettura generata comincia quindi il puntatore al byte **13**, producendo `(16777216,38117834752)`. L'allineamento applicato **dopo** `m_Script` riporta il cursore a 28: questo spiega perché nome e campi successivi sembrano corretti. Il [codice upstream del generatore](https://github.com/UnityPy-Org/TypeTreeGeneratorAPI/blob/df79bd6a786d4ba52ed4a7b3d40047ecf578256b/TypeTreeGeneratorAPI/TypeTreeGenerator/TypeTreeGenerator.cs#L17) mostra la stessa disposizione dei flag; il [lettore UnityPy](https://github.com/K0lb3/UnityPy/blob/master/UnityPy/helpers/TypeTreeHelper.py) applica l'allineamento dopo il valore. Le copie installate, esaminate direttamente, restano il riferimento dell'esperimento.

Correzione dell'intestazione: creare un nuovo nodo radice conservando il corpo generato, sostituendo soltanto i primi quattro figli con quelli di `get_typetree_node(ClassIDType.MonoBehaviour, obj.version)`. Verificare prima nomi e ordine: `m_GameObject,m_Enabled,m_Script,m_Name`. Nessuna modifica ai valori numerici o ai file sorgente.

Secondo difetto, `TileModel.DefaultExploreKeys`: il backend predefinito `AssetsTools` emette un contenitore chiamato `string`, con figlio `Array` di elementi `string`. UnityPy sceglie prima il lettore della stringa scalare e consuma **128/156** e **128/172** byte sulle tessere 2635/2636, anche dopo la correzione dell'intestazione. Rinominare **solo quel contenitore** in `vector`, mantenendo figli e flag, legge rispettivamente 2 e 3 stringhe e raggiunge esattamente la fine. Il backend alternativo installato `AssetStudio` emette invece `String[]`: con la medesima intestazione corretta restituisce dizionari identici per entrambe le tessere, avventura 805 e campagna 872. Anche `OtherSideId` e gli hash reciproci delle due tessere coincidono. Non è stata applicata una riscrittura generalizzata degli array.

Campione verificato; `S=sharedassets0.assets`, `R=resources.assets`; numeri finali = byte consumati/dimensione:

- AdventureModel: S805 **344/344**, R19893 **156/156**.
- CampaignModel: S872 **564/564**, R19896 **384/384**.
- ProductModel base: S2319 **9424/9424**; EnemyModel: S1618 **584/584**.
- TileModel: S2635 **156/156**, S2636 **172/172**, con entrambe le correzioni.
- EncounterModel: S1517 e R19905 **212/212** ciascuno; EncounterGroupModel: S919 **120/120**.

Risultato: **11/11** letture complete, lettore C e lettore Python concordi; **767 occorrenze** di puntatori non nulli risolte a oggetti esistenti della classe attesa, **15 nulli**, **zero fallimenti residui nel campione**. I controlli comprendono i riferimenti del prodotto base; non equivalgono alla decodifica completa degli oggetti destinatari. Indice: `validation-results.json`; confronto alternativo: `backend-crosscheck.json`.

La campagna S872 ha `_id=1`, `AssetBundleCode=BonesOfArnor` e un array di **14 riferimenti** a AdventureModel esistenti. S805 richiede ProductModel S2319 (`_id=0`, prodotto base). Questa evidenza distingue il riferimento base dai contenitori misti; non dimostra percorsi, numero di partite o progressione. Delle altre campagne sono stati consultati soltanto metadati identificativi, senza decodificarne i corpi.

Riproduzione dalla radice, senza installazioni:

```sh
PYTHONDONTWRITEBYTECODE=1 .scratch/unity-audit-venv/bin/python .scratch/schema-validation/validate.py
PYTHONDONTWRITEBYTECODE=1 .scratch/unity-audit-venv/bin/python .scratch/schema-validation/crosscheck.py
```

L'helper usa `load_local_dll_folder`, mantiene `check_read=True` sul corpo e non altera `read_typetree_boost`. Restano da verificare altri schemi, percorsi `RuntimeGameObject/RuntimeTexture`, prefab/FSM e logica. Prossimo confronto: riferimenti serializzati contro `CampaignModel.GetFirstAdventureID/GetNextAdventureId` e risoluzione dei prefab, poi osservazione controllata dell'app. Nessun avvio dell'app, modifica dell'installazione o accesso ai salvataggi; nessuna attestazione di gioco 1:1.
