# Review risoluzione fisica coperta #63

Diff indipendente `cb60ea4...99953fa`, con reviewer Standards e Spec separati.
Autorità: [issue63](https://github.com/Ic3b3rg/lotr-table-game/issues/63),
[specifica](../planning/physical-resolution-p0-spec.md), piano, contratto61 e
standard del repository. Il root integra i nove commit e corregge il rilievo.

## Standards

**Un P2, corretto dal root:** il journal casuale ammetteva soltanto256 record,
mentre gli schemi consentono32 padri da32 figli, con due famiglie. Sette
programmi validi con alternanza sofferenza/scarto completavano; l'ottavo
produceva258 record e falliva Zod, impedendo alla fonte di avanzare. Lo stato
precedente restava intatto, ma senza continuazione diagnostica.

Il limite ora deriva dal massimo conservativo2+32×32×2=2.050. Anche il budget
del cursore copre27 indici per mescolata e128 parole per indice. Nessuna
riduzione dei programmi ammessi. Regressione RED→GREEN sul massimo:32 padri,
32 figli ciascuno,1.026 record effettivi,56 copie e32 ritorni singoli, con
validazione dopo serializzazione. Nessun altro finding o smell sostanziato.

## Spec

**Zero finding sostanziati.** Conservazione, caso fonte sintetico, casualità,
costi/allocazioni, gate, padre/figli, migrazioni, ricevute e privacy coerenti
con P0. Verifica indipendente in memoria del sorgente e dei151 hash: raw e
freeze immutati; otto riavvii e quattro ripristini validi, finale56 copie e
mazzi27/27. Le catture UI riscontrano tre identità, actor esclusivo, etichette,
focus e quattro viewport. Nessun nuovo host o browser avviato dai reviewer.

## Verifica root e limiti

Suite finale **444/444**, zero skipped; typecheck, formato e diff verdi.
Ricalcolati hash degli artefatti e ripetuto il checker offline su copie
proprie, con il sorgente integrato. [Rapporto e riproduzione](../testing/physical-resolution-p0-verification.md).
I dettagli privati restano ignorati. P1/fronti, P2/Ultimo Sforzo e P3/incontri
originali conservano i gate; #33 e le quantità non confermate di #57 restano
aperte. Nessun rilievo aperto.
