# App ufficiale: versione, italiano e dati disponibili

Verifica locale del 23 ottobre 2026, dopo l'installazione eseguita dal proprietario. Fonte primaria: copia Steam di **The Lord of the Rings: Journeys in Middle-earth**, appID `1003400`. Questa nota descrive disponibilità e leggibilità dei dati; non certifica ancora la fedeltà del motore da realizzare.

## Riferimento identificato

- Build Steam: **24301165**, manifest `appmanifest_1003400.acf`, download dichiarato completo e conferma del proprietario.
- App `JiME.app`: versione **1.6.6**, identificativo `com.fantasyflightgames.jime`; versione interna del TextAsset `_version`: **1.6.6#1128**.
- Versione Unity osservata nei file serializzati: **2022.3.62f2**.
- Installazione inventariata: **359 file**, **660.504.464 byte**. Non sono stati modificati file dell'app.

La radice è `~/Library/Application Support/Steam/steamapps/common/Journeys in Middle-earth/`. Percorsi, impronte SHA-256 e ricevute locali sono in `.scratch/materials/official-app-receipt.json` e `official-app-files.json`, esclusi da Git. Per esempio, l'assembly `Assembly-CSharp.dll` ha SHA-256 `8869ef87b7d49f4993911904e35d78b72f8339e91158bbe8784c9691a9d743c6`.

## Risorse italiane verificate

Il manifest `JiME.app/Contents/Resources/Data/StreamingAssets/bundles/manifest.dat`, versione 1.6.6, dichiara **137 pacchetti**: 92 di localizzazione, 34 di narrazione audio e 11 di loghi. Tutti i file dichiarati sono presenti; tutte le dimensioni coincidono con il manifest. Questo controllo non sostituisce la verifica semantica dei contenuti.

Sono presenti sette pacchetti di localizzazione italiana, compresi `localization/main/it` e `localization/bonesofarnor/it`. La presenza di pacchetti di altre campagne non ne stabilisce appartenenza alla scatola base o disponibilità nel gioco.

I due pacchetti seguenti sono stati decodificati come TextAsset con tabelle CSV:

| Tabella           | Chiavi distinte | Valori vuoti osservati |
| ----------------- | --------------: | ---------------------: |
| `BonesOfArnor_it` |           1.536 |                      1 |
| `Main_it`         |           3.839 |                      6 |

Le 1.536 chiavi italiane della campagna coincidono esattamente con quelle della tabella inglese della stessa build. Il conteggio esclude intestazione, righe senza chiave e commenti. I valori vuoti non sono stati classificati automaticamente come errori. Il pacchetto italiano della campagna ha SHA-256 `021cb0f200afd2d87369bc6663d1cbd6c157b21ee9dfcab1bd532d3ebe330606`.

Questo rende disponibili testi italiani originali dell'app. Non dimostra che tutte le carte fisiche siano rappresentate integralmente: la tabella principale contiene anche nomi di abilità, eroi e oggetti, oltre all'interfaccia e a contenuti ulteriori. Il confronto carta per carta con il [workbook](card-workbook-inventory.md) e le [immagini](card-archives-audit.md) rimane necessario.

Il successivo [confronto dei componenti base](base-component-coverage.md) censisce 703 modelli e verifica 155 percorsi immagine. Il prodotto base collega sei eroi, sei ruoli, 78 modelli oggetto con quantità complessiva 83 e 44 facce delle 22 tessere viaggio. Le abilità condividono modelli e presentano discrepanze di riferimenti e quantità: non si può trasformare direttamente l'inventario dell'app nelle 343 carte fisiche. La matrice documenta per ogni famiglia identità, quantità, immagini e testi ancora da verificare; i campioni distinguono nomi italiani da istruzioni o effetti completi.

## Dati strutturati e limite della decodifica

`resources.assets` contiene, fra l'altro, 414 Texture2D e 9.106 MonoBehaviour; `sharedassets0.assets` contiene 2.354 MonoBehaviour, inclusi oggetti nominati come avventure. Questi conteggi descrivono contenitori misti, non il catalogo della sola scatola base.

La lettura sperimentale usa UnityPy **1.25.4** e TypeTreeGeneratorAPI **0.0.10**, soltanto in una venv sotto `.scratch/`. [Documentazione dello strumento](https://github.com/K0lb3/UnityPy). La [verifica degli schemi serializzati](official-app-schema-validation.md) ha individuato due difetti negli schemi generati: allineamento dell'intestazione e rappresentazione dell'array `TileModel.DefaultExploreKeys`. Correzioni applicate soltanto in memoria consentono di leggere integralmente **11 campioni**, risolvendo **767 occorrenze di puntatori non nulli**; un secondo backend conferma quattro dei campioni. Il modello `BonesOfArnor` contiene 14 riferimenti ad avventure esistenti: questo dato non stabilisce quante avventure si giochino in un percorso.

Il [censimento dei simboli runtime](official-app-runtime-symbols.md) identifica le famiglie da verificare: campagna, mappe, nemici, condizioni, casualità e salvataggio. La successiva [ricerca sulla progressione](base-campaign-routing.md) risolve i collegamenti ai prefab e alle FSM principali delle 14 avventure e documenta dal codice le scelte del percorso, comprese biforcazioni e conclusioni anticipate. I controlli di questa ricerca coprono 1.380 oggetti e 5.412 puntatori non nulli; sono una verifica statica, ancora da confrontare con esecuzione e salvataggi dell'app. Restano aperte copertura degli altri modelli, semantica completa degli eventi e generazione delle mappe. Nessuna delle due ricerche certifica un'importazione completa o il motore da realizzare.

L'app, il workbook e i regolamenti rimangono fonti complementari. Gli indici tecnici sotto `.scratch/materials/` conservano metadati e chiavi; questa nota non pubblica testi narrativi, immagini originali o dati personali del proprietario.
