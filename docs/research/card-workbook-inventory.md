# Inventario del workbook carte V1.10

Analisi del 23 ottobre 2026 del file `JiME_Cards_List_V1.10.xlsx` fornito direttamente dall'utente. Originale conservato intatto negli allegati T3, 610.648 byte, SHA-256 `833edd0f9235d559253c6c0d43e61bcc0b5d955103bb2001e37a2e3ddef88ca4`. Lettura dei valori e delle formule OOXML; nessuna modifica o esportazione del workbook.

## Struttura verificata

Nove fogli: `Characters`, `Equipment`, `Skill Cards`, `DamageFear`, `BoonsBanes`, `TerrainSpace Trait`, `Modifiers - Keywords`, `Rankings`, `Custom Content`. Il file contiene testi inglesi, dati e classificazioni; non contiene immagini incorporate o parti di collegamento a workbook esterni. Le 34 formule rilevate sono nel foglio `Rankings`; non intervengono nei conteggi delle carte e non sono state ricalcolate.

Righe di dati: 19 personaggi, 210 oggetti e 383 abilità. Queste cifre comprendono prodotti diversi e contenuti personalizzati, non corrispondono al numero delle carte fisiche del base. Per il catalogo si usano i valori sorgente e la colonna `Count`, distinguendo le quantità dalle righe.

## Confronto della scatola base

Riferimento dei quantitativi fisici: [inventario ufficiale Asmodee](https://www.asmodee.it/product/il-signore-degli-anelli-viaggi-nella-terra-di-mezzo/). Il totale ufficiale delle undici famiglie è 343.

| Famiglia | Evidenza nel file | Quantità ufficiale | Esito del solo conteggio |
| --- | --- | ---: | --- |
| Eroi | `Characters!A2:B20`: 6 righe con Collection=Base | 6 | Coerente |
| Oggetti | `Equipment!A2:K211`: 78 righe Base, somma Count=83 | 83 | Coerente |
| Abilità eroe | `Skill Cards!A2:K384`: 30 righe Base/Hero, somma Count=30 | 30 | Coerente |
| Abilità base | stesso foglio: 6 righe Base/Basic, Count=5 per riga | 30 | Coerente |
| Abilità ruolo | stesso foglio: 71 righe Base/Role, somma Count=71 | 72 | Classificazione da verificare, descritta sotto |
| Titoli | stesso foglio: 21 righe Base/Title, somma Count=21 | 21 | Coerente |
| Debolezze | stesso foglio: 20 righe Base/Weakness, somma Count=20 | 20 | Coerente |
| Danni | `DamageFear!A2:C19`: 18 voci; la nota su Weariness indica 11 copie | 28 | 28 ricostruibili assumendo una copia per le altre voci |
| Paure | `DamageFear!A20:C37`: 18 voci; la nota su Gloom indica 11 copie | 28 | 28 ricostruibili assumendo una copia per le altre voci |
| Benefici | `BoonsBanes!A2:B4`: 3 tipi, senza colonna quantità | 15 | Tipi presenti; molteplicità non documentata qui |
| Terreni | `TerrainSpace Trait!A2:C11`: 10 voci Base nella sezione Terrain | 10 | Numero di voci coerente; identificativi e immagini da confrontare |

La coerenza numerica non verifica testo, simboli, fronti/retri o recepimento delle errata. Non viene certificato un corpus completo di 343 carte originali italiane.

## Anomalie e filtri

**Guardian 1:** `Skill Cards!A130:K130` contiene `You Cannot Pass`, Type=Role, Hero/Role=Guardian, Number=1, Count=1, ma Collection=Custom. Gli altri undici numeri del ruolo sono Base. Un filtro Base elimina quindi questa voce e lascia 71 abilità ruolo. Possibile classificazione errata o variante: confrontare l'effetto con la carta originale prima di riclassificarla; l'originale resta intatto. [Pagina dell'archivio per il confronto](https://sites.google.com/view/jime-carddb/home/roles/guardian).

**Maiuscole nelle collezioni:** `Equipment!A36` contiene `sw`, mentre altre righe usano `SW`. Conservare il valore sorgente e documentare la normalizzazione nelle viste di lavoro.

**Contenuti personalizzati:** `Characters` ha una riga Custom; `Skill Cards` ne ha trenta, inclusa la voce Guardian segnalata. Il foglio `Custom Content!A2:C4` elenca Glorfindel, Warrior e Ring-bearer. Il filtro per collezione aiuta a separarli, ma la presenza dell'anomalia Guardian impedisce di trattarlo come autorità sufficiente.

**Identità:** per Hero/Role/Basic/Title non sono emerse chiavi duplicate nel composto Type, Hero/Role e Number. Nomi ripetuti con numeri distinti sono previsti; non deduplicare per solo nome. Per le debolezze Number è `-`, quindi serve una chiave diversa. Per gli oggetti preservare nome, tipo, rango e collezione: non reinterpretare la colonna Upgrade come un identificativo stampato senza verifica.

## Italiano e materiali residui

Il workbook è utilizzabile come fonte inglese fornita dall'utente per l'inventario e il lavoro successivo sui testi. Una traduzione di lavoro va distinta dal testo ufficiale italiano. L'associazione a immagini e testi italiani, il confronto con le [errata italiane](https://cdn.svc.asmodee.net/production-asmodeeit/uploads/2022/09/jme_faq_ita.pdf) e le [carte corrette](https://cdn.svc.asmodee.net/production-asmodeeit/uploads/2022/09/JME_Carte_Aggiornate.pdf) restano aperti.

Restano inoltre separati da questo file: immagini delle carte e dei componenti, tessere della mappa e dati della campagna iniziale. L'[audit dell'archivio immagini](card-archives-audit.md) descrive le fonti consultabili; la [richiesta materiali](https://github.com/Ic3b3rg/lotr-table-game/issues/2) e la [baseline](https://github.com/Ic3b3rg/lotr-table-game/issues/3) registrano il lavoro da completare.
