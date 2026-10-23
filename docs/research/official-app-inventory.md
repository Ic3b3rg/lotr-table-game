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

## Dati strutturati e limite della decodifica

`resources.assets` contiene, fra l'altro, 414 Texture2D e 9.106 MonoBehaviour; `sharedassets0.assets` contiene 2.354 MonoBehaviour, inclusi oggetti nominati come avventure. Questi conteggi descrivono contenitori misti, non il catalogo della sola scatola base.

La lettura sperimentale usa UnityPy **1.25.4** e TypeTreeGeneratorAPI **0.0.10**, soltanto in una venv sotto `.scratch/`. [Documentazione dello strumento](https://github.com/K0lb3/UnityPy). La [verifica degli schemi serializzati](official-app-schema-validation.md) ha individuato due difetti negli schemi generati: allineamento dell'intestazione e rappresentazione dell'array `TileModel.DefaultExploreKeys`. Correzioni applicate soltanto in memoria consentono di leggere integralmente **11 campioni**, risolvendo **767 occorrenze di puntatori non nulli**; un secondo backend conferma quattro dei campioni. Il modello `BonesOfArnor` contiene 14 riferimenti ad avventure esistenti: questo dato non stabilisce quante avventure si giochino in un percorso.

Il [censimento dei simboli runtime](official-app-runtime-symbols.md) identifica le famiglie da verificare: campagna, mappe, nemici, condizioni, casualità e salvataggio. Restano da validare gli altri modelli, il grafo completo delle avventure, i collegamenti dei prefab, le condizioni degli eventi e la generazione delle mappe. I controlli sul campione non certificano un'importazione completa o la fedeltà del comportamento.

L'app, il workbook e i regolamenti rimangono fonti complementari. Gli indici tecnici sotto `.scratch/materials/` conservano metadati e chiavi; questa nota non pubblica testi narrativi, immagini originali o dati personali del proprietario.
