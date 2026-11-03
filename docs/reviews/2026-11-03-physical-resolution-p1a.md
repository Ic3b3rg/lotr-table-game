# Review fronti fisici P1a — #65

Diff fisso `5378c0b...da618b0`, Standards e Spec in due reviewer indipendenti.
Autorità: [issue65](https://github.com/Ic3b3rg/lotr-table-game/issues/65),
[spec/piano P1](../planning/physical-resolution-p1-spec.md), contratto61,
standard e ADR del repository. P1a è un incremento dichiaratamente parziale;
questa integrazione non chiude65 o33.

## Standards

**Un P1 e un P2, corretti dal root.**

- P1: il ledger richiedeva che una carta premiata alla preparazione iniziale
  fosse ancora preparata, anche dopo uno scarto obbligatorio P1. Il comando
  veniva annullato e la conseguenza restava bloccata. Ora la verifica usa
  la preparazione fonte conservata e l'identità della prima carta di ruolo;
  la regressione HTTP completa lo scarto e ripristina il backup.
- P2: la fattibilità ignorava i costi composti e le risorse condivise. Un
  ramo simultaneo con due scarti poteva essere offerto con una sola copia.
  Ora un controllo ricorsivo senza effetti considera tutti i costi, ordini
  e alternative sulle risorse disponibili; regressione con rami impossibili
  e corrispondenti rami interamente pagabili.

Giudizio facoltativo: possibile Duplicated Code nei cicli di ordinamento di
eroi, effetti e trigger. Rinvio del refactoring; nessun difetto ulteriore
sostanziato. Probe in memoria, nessun host o modifica del reviewer.

## Spec

**Due P2, corretti dal root.**

- Un indice mobile identificava le prevenzioni: scartare Protezione faceva
  ricomparire una prevenzione gratuita già usata. Identità ora stabile per
  possessore/copia/effetto; la regressione conserva due danni residui su
  quattro, anziché consentire una terza prevenzione.
- Il divieto fotografato prima della prova restava attivo dopo che una
  Scoperta figlia aveva girato coperta la carta che lo imponeva. Ora viene
  ricalcolato al ritorno e nelle finestre; la regressione applica il successo
  legalmente disponibile. Requisiti65:3/4 e semantica delle passive.

Nessuno scope creep sostanziato. P1b/ciclo ordinario e P4/acquisizioni sono
limiti dichiarati. Probe sintetici in memoria e applicabilità privata
verificata;209 hash concordanti, nessuna nuova QA browser dal reviewer.

## Verifica root

Quattro regressioni RED→GREEN; suite finale **467/467**, zero skipped,
typecheck, formato e diff verdi. Ripetuti compiler,36 esecuzioni e checker
separato, parsing/replay di27 backup e confronti integrali dei quattro
restore. [Rapporto e limiti](../testing/physical-resolution-p1-verification.md).
Nessun rilievo aperto: Standards1 P1+1 P2 corretti, Spec2 P2 corretti.
