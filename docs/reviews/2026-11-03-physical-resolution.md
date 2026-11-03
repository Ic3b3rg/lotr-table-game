# Review del contratto fisico #61

Diff indipendente `05ebcbb156b7fdebcd7a064fdadb1f5e8d646059...f1ff169c5eb2b08a64eb477f6a05fd99cacb11e2`, un solo rapporto. Autorità: [#61](https://github.com/Ic3b3rg/lotr-table-game/issues/61), baseline, regole/FAQ, fonti e vincoli privati dichiarati. Due reviewer separati, nessuna modifica ai dati da parte loro.

## Standards

**Un P2, corretto dal root:** due passaggi associavano identità di carte alle rispettive capacità. Violava «effetti per identità […] soltanto in scratch ignorata». Rimossi gli abbinamenti dal testo pubblico; rimangono acquisizioni, binding, tassonomia generica e frontiere. Il dettaglio continua a essere disponibile soltanto nel registro privato. La pubblicazione usa uno snapshot ripulito, senza i passaggi precedenti nella storia del ramo pubblicato.

Nessuno smell aggiuntivo. Il reviewer ricontrolla 90 input, 120 artefatti, 25 fonti bloccate e i riferimenti locali; nessuna esecuzione del motore o modifica al checkout.

## Spec

**Zero finding sostanziati.** Verificati 36 fronti/righe workbook e matrice, regole/errata pertinenti, 28 corpi IL dall’assembly primario, modelli e 17 valori italiani. Partizione 10/18/8 e progressione Ultimo Sforzo riscontrate. P0 sintetico e prima uscita originale P3 sono distinti; T01–T25 restano proposte. Nessun runtime/UI nuovo dichiarato.

## Verifica root e limiti

Ricalcolati hash/byte di 90 input e 120 artefatti. Ripetute in scratch distinta letture di 27 modelli, 28 corpi IL, matrice36/288 dimensioni e finestre selezionate; 25 fonti bloccate immutate. Checker sul rapporto ripulito, collegamenti, formato e diff verdi. Nessun nuovo codice: la baseline 419 di #38 e gli 88 test del catalogo conservano il proprio perimetro.

Nessuna norma primaria ulteriore trovata per il mazzo realmente vuoto: limite esplicito, diagnosi/sospensione proposta; non blocca i casi indipendenti. Inferenze operative restano dichiarate e verificabili. #33 e #57 rimangono aperte. [Contratto](../research/physical-resolution-runtime-contract.md).

Rilievi: Standards **1 P2 corretto**; Spec **0**. Nessun rilievo aperto.
