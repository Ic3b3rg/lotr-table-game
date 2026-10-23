# Riconciliazione delle identità delle carte base

Ricerca del 23 ottobre 2026 per [Riconciliare identità e quantità delle carte base fra Excel e app](https://github.com/Ic3b3rg/lotr-table-game/issues/18), sul ramo `prototype/diorama-25d`, HEAD iniziale `b0ca2dcbc4812fa69a7516f0e27c561c6586e2bc`. **I 78 modelli oggetto corrispondono a tutte le 78 righe Base dell’Excel e alle loro 83 copie. Le 32 associazioni precedentemente aperte sono risolte.** Le anomalie delle abilità sono circoscritte; nessuna quantità o classificazione sorgente è stata corretta.

Il riferimento rimane la [baseline concordata](../planning/fidelity-baseline.md): traduzione fedele dall’Excel con verifica degli effetti. Questo lavoro associa identità e quantità; non traduce il corpus né certifica tutti gli effetti. I nomi italiani citati provengono dall’app, senza essere presentati come trascrizioni dei fronti fisici italiani.

**Fonti e metodo.** W indica l’XLSX originale V1.10, 610.648 byte, SHA-256 `833edd0f9235d559253c6c0d43e61bcc0b5d955103bb2001e37a2e3ddef88ca4`. S indica `JiME.app/Contents/Resources/Data/sharedassets0.assets`, seguito dal pathID; `_id` è l’identificativo applicativo. App Steam **1.6.6#1128**, build **24301165**, Unity **2022.3.62f2**, assembly SHA-256 `8869ef87b7d49f4993911904e35d78b72f8339e91158bbe8784c9691a9d743c6`. Ricevute e inventari: [workbook](card-workbook-inventory.md), [app](official-app-inventory.md), [componenti](base-component-coverage.md).

Il manifest dell’installazione individua `localization/main/en` nel bundle `3c4d1479c98f10739888fe29f2a1ef07` e `localization/main/it` in `6a822186acd50201e5ab5439407de4a6`: TextAsset `Main_en`/`Main_it`, 3.839 chiavi ciascuno. Le tabelle restano in memoria. UnityPy 1.25.4 e TypeTreeGeneratorAPI 0.0.10, con intestazione TPK corretta soltanto in memoria, leggono integralmente **226 modelli** pertinenti; consumo esatto, concordanza dei lettori C/Python e risoluzione alla classe attesa di **1.222 puntatori non nulli**. Hash iniziali/finali attestano fonti e helper condivisi invariati. Nessun bundle di campagna aggiuntivo aperto.

**Oggetti.** Il collegamento usa `NameKey` e valore inglese, rango W.F/`Level`, categoria W.C/`Type`, copie W.B/`Quantity`, valore W.H/`UpgradeCost` e riferimenti. Maiuscole, accenti e punteggiatura sono normalizzati esclusivamente nel confronto. Risultano **77 corrispondenze univoche** con il nome inglese localizzato, contro le precedenti 46 ottenute dal nome interno. Tutti i 78 valori di upgrade e tutte le quantità concordano; concordano anche i 30 valori numerici delle mani per armi/supporti. La relazione osservata è `Type=0` per Weapon/Support, `1` per Armor, `2` per Trinket; non sostituisce le categorie originali.

Queste sono le 32 associazioni recuperate; “riga” si riferisce a `Equipment`, e il nome è quello italiano dell’app. Per ciascuna, il manifest locale conserva anche nome inglese, `NameKey`, rango, tipo, copie, cella sorgente e riferimento in S2319.

| `_id` | Modello S | Riga W | Nome italiano app        |
| ----: | --------: | -----: | ------------------------ |
|     2 |      2249 |      8 | Ascia dei Colli Ferrosi  |
|     3 |      2259 |     11 | Squillo d’Onore          |
|     4 |      2268 |     10 | Portatrice di Dolore     |
|    10 |      2126 |     33 | Monito della Vedova      |
|    11 |      2137 |     34 | Spaccaombre              |
|    12 |      2148 |     35 | Forgiasangue             |
|    16 |      2192 |     50 | Pioggia d’Argento        |
|    19 |      2224 |    171 | Collera della Fanciulla  |
|    20 |      2234 |    172 | Ramo di Ent              |
|    22 |      2241 |      5 | Bellicosa                |
|    23 |      2242 |    179 | Spada Numenoreana        |
|    24 |      2243 |     65 | Voce del Fiume           |
|    25 |      2244 |    183 | Sole Argenteo            |
|    26 |      2245 |    184 | Vincitrice del Fato      |
|    29 |      2248 |     64 | Riposo del Cuore         |
|    32 |      2252 |      4 | Rifugio di Guerra        |
|    34 |      2254 |     28 | Sgusciaspina             |
|    36 |      2256 |    194 | Sottosole                |
|    41 |      2260 |    129 | Flagello delle Lame      |
|    42 |      2261 |    130 | Fine della Collera       |
|    47 |      2265 |    198 | Mantello Sempreverde     |
|    48 |      2266 |    199 | Desiderio del Pellegrino |
|    51 |      2269 |     24 | Mantello di Tucboro      |
|    53 |      2271 |     26 | Viandante del Vento      |
|    54 |      2272 |     27 | Mantello Splendente      |
|    56 |      2274 |    102 | Pipa dal Lungo Cannello  |
|    57 |      2275 |    103 | Tempestosa               |
|    59 |      2277 |     60 | Fazzoletto di Famiglia   |
|    60 |      2279 |     61 | Ricordo Personale        |
|    65 |      2284 |     99 | Mappa del Confiniere     |
|    80 |      2297 |     73 | Elmo Nanico              |
|    81 |      2298 |     74 | Scagliadifuoco           |

L’eccezione ortografica è S2242: `ITEM_NUMERNORIAN_SWORD` restituisce **Númenorian Sword**, mentre W.E179 contiene **Numenorean Sword**. Non è stata creata una correzione automatica della chiave. Sono concordanti livello II, Weapon, una mano, una copia e valore upgrade 58; la catena limitata al prodotto base è S2240 Sword → S2242 → S2244 Sun-Silver / S2245 Fate-Bender, corrispondente alla famiglia W.D176/D179/D183/D184. Il fronte inglese comunitario mostra **Númenórean Sword**, II e 58: ulteriore riscontro dell’associazione, senza attestare edizione italiana o testo originale. [JiME Cards DB, Hands, fronte della spada di rango II](https://sites.google.com/view/jime-carddb/home/items/hands).

Le 71 relazioni `Upgrades` interne ai 78 modelli conservano famiglia W.D e incremento di un rango. Gli altri bersagli non sono stati decodificati. I modelli dei ranghi I/II/III sono 20/25/33; le cinque copie oltre le 78 righe derivano da Dagger ×2, Travel Garb ×2, Cloak ×3, Extra Rations ×2. Tutti i 78 percorsi icona sono nuovamente risolti da `globalgamemanagers:13.m_Container`, con payload verificati: **20 texture condivise**, non 78 fronti di carta.

**Abilità base ed eroe.** W.`Skill Cards!17:22` identifica sei abilità base, cinque copie ciascuna: 30, concordanti con S2319.`Skills`. S2537, `_id=2`, è associato a Honed Agility mediante nome interno, famiglia e quantità; la sua localizzazione rimane qualificata sotto.

I sei `HeroModel` S2107–S2112 corrispondono alle sei righe Base di `Characters`. Ogni `StartingSkills` contiene quattro riferimenti e cinque copie, riconciliate con le cinque righe numerate dell’eroe: **24 riferimenti, 22 modelli condivisi, 30 carte**. Aragorn 2/3, per esempio, sono due righe fisiche distinte W.3/4 associate a S2351, Strider, quantità 2. S2609 Gift of Men serve Aragorn 5 e Beravor 5; S2612 Immortality serve Elena 3 e Legolas 5. Le quantità aggregate dei 22 modelli concordano tutte con S2319. Conservare proprietario e numero evita di fondere carte di eroi differenti.

**Ruoli e discrepanza 73.** I sei `RoleModel` S2334–S2339 collegano ciascuno due `CoreSkills` e nove `UpgradeSkills`. Nome, ruolo sorgente e costo XP distinguono omonimi come Ready Defense iniziale e da 7 XP. L’ortografia inglese Defence/Defense viene confrontata esplicitamente senza riscrivere le fonti. Le carte iniziali numerate 2/3 condividono un modello con quantità 2. La colonna J dell’Excel, **Reshyk Rating**, è una valutazione dell’autore: non entra nell’identità o nella progressione.

S2319.`Skills[11]` e `[12]` puntano entrambi a S2372, `_id=12`, Death Stroke, quantità 1 ciascuno. S2339.`UpgradeSkills[3]` lo collega una sola volta; W.`Skill Cards!172` descrive Hunter 7, Count=1, confermato come numero/titolo dal fronte inglese comunitario. Hunter totalizza quindi **13** nelle quantità serializzate; gli altri cinque ruoli totalizzano 12. La duplicazione spiega aritmeticamente l’eccesso 73 contro 72, senza autorizzare una modifica all’app o certificare il comportamento runtime. [Cards DB, Hunter, carta 7](https://sites.google.com/view/jime-carddb/home/roles/hunter).

Pathfinder richiede una distinzione ulteriore: S2494, `_id=23`, Ambush 1, ha quantità **2** nel prodotto; S2358, `_id=114`, Ambush 2, è raggiunto soltanto da S2338.`UpgradeSkills[4]`. W.225/226 differiscono esclusivamente in G, numero 7/8, anche confrontando tutte le colonne sorgenti; i due fronti comunitari confermano numeri differenti ed effetto, tratto, simbolo e costo uguali. La relazione fra l’insieme delle due righe e i due modelli è confermata. L’abbinamento individuale 23→7 e 114→8 rimane **candidato**, sostenuto dai suffissi interni e dall’ordine degli upgrade, concordante con gli altri 52 casi. Aggiungere un’altra copia per il modello 114 conterebbe due volte una delle due carte già rappresentate. [Cards DB, Pathfinder, carte 7–8](https://sites.google.com/view/jime-carddb/home/roles/pathfinder).

**Titoli e chiavi mancanti.** Tutte le 21 righe W.332–352 corrispondono ai 21 `TitleModel`, una copia per riga. Venti possiedono un `SkillModel.TitleSource` nella chiusura base esaminata. L’eccezione è **Barrel Rider**, W.348, Title 17, S2762: identità confermata anche dal fronte inglese, collegamento SkillModel assente nel perimetro verificato. L’assenza non elimina la carta né permette di inventarne un modello. Il 20 dell’app descrive quel sottoinsieme di abilità, non il totale fisico dei titoli. [Cards DB, Titles, carta 17](https://sites.google.com/view/jime-carddb/home/common-cards/titles).

Due `NameKey` serializzati non risolvono né in Main_en né in Main_it: S2537.`SKILL_HONED_AGILITY` e S2549.`SKILL_TRAVELING_SONG`. Esistono rispettivamente `SKILL_HONED_FOCUS` = Honed Agility / Agilità Affinata e `SKILL_TRAVELLING_SONG` = Travelling Song / Canto di Viaggio. Sono **candidati di localizzazione**, separati dalle associazioni di identità verificate tramite nome interno, famiglia, XP e quantità; nessun alias runtime è dimostrato.

**Guardian 1 e limiti residui.** S2560, `_id=50`, appartiene ai CoreSkills del Guardiano e coincide nominalmente con W.`Skill Cards!130`, You Cannot Pass, Guardian 1. La relazione applicativa è confermata; `Collection=Custom` rimane conservata e l’appartenenza fisica alla base resta candidata. L’app contiene un nome, non la prova dell’effetto stampato. Rimane valido l’[esito prudente precedente](guardian-base-card-check.md): occorre un fronte autentico identificato per edizione/ristampa, oppure attestazione ufficiale equivalente. L’assenza di trascrizione italiana, invece, non impedisce le altre associazioni.

Il [Manuale italiano, p. 3](https://cdn.svc.asmodee.net/production-asmodeeit/uploads/2022/09/Viaggi_nella_Terra_di_Mezzo.pdf#page=3) dichiara 30 abilità base, 30 eroe, 72 ruolo e 21 titolo. Il filtro sorgente Base restituisce 152 copie nelle quattro famiglie, con Guardian Custom esclusa. Il totale serializzato 153 non risolve l’eccesso ruolo e il difetto titolo. **Non è stata forzata la somma generale a 343.** Restano inoltre l’abbinamento individuale dei due Ambush, la spiegazione runtime del duplicato Hunter, l’assenza del collegamento Barrel Rider e gli alias di localizzazione. Nessuno richiede nuove scansioni per riconoscere le identità già determinate; la certificazione editoriale degli effetti/fronti rimane distinta.

**Manifest e riproduzione.** `.scratch/card-identity-reconciliation/manifest.json` registra `rowIDs`, `appIDs`, numero, copie, fonti e stati `confirmed`/`candidate`/`unresolved`: 78 oggetti confermati; 129 righe abilità considerate, 126 confermate e tre candidate, più l’associazione confermata dell’insieme Ambush. “Confermato” significa associazione W/app nel perimetro dichiarato, non autenticazione editoriale. `verification.json` conserva hash e controlli; `community-images.json` provenienza, impronte e osservazioni dei **sei fronti inglesi campionati**, qualificati come mirror comunitario.

```sh
PYTHONDONTWRITEBYTECODE=1 .scratch/unity-audit-venv/bin/python .scratch/card-identity-reconciliation/reconcile.py
PYTHONDONTWRITEBYTECODE=1 .scratch/unity-audit-venv/bin/python .scratch/card-identity-reconciliation/verify.py
```

L’analisi locale non richiede rete. L’helper facoltativo `fetch_cards.py` documenta la raccolta delle immagini pertinenti conservate localmente; gli URL opachi non sono identificativi editoriali stabili. Originali, testi ed immagini rimangono locali. Nessun avvio dell’app, accesso ai salvataggi, esportazione dell’Excel, modifica di codice di produzione, branch, commit, push o mutazione di GitHub.
