# Review degli incontri collegati e del titolo — #102

Confronto fissato a `08593af56f604bb0510248943d7f3bf57f28fe3d` contro
`b8e5f6f2c22919d262162ee4d0223e5d28d90e91`: sette commit,63 file.
[Issue102](https://github.com/Ic3b3rg/lotr-table-game/issues/102),
[specifica](../planning/linked-encounters-spec.md),
[piano](../planning/linked-encounters-plan.md) e
[rapporto](../development/linked-encounters.md). Due review indipendenti
con contesti freschi; verifica del root distinta dalla consegna.

## Standards

**Nessuna violazione documentata o smell euristico sostanziale trovato.**
Preservati proprietà dello scenario, custodia/preparazione/rimozione condivisa
del titolo, autorità server, guardie storiche e confine unico del replay.
Esclusi gli aspetti di stile già controllati dal tooling.

Verifica: comando in memoria compiler/UI3/3 passato; probe in memoria con12
asserzioni su ispezione pura, alternative condizionali, dispatch ciclico/
invalido e rifiuto di quantità/identità/hash titolo incoerenti.

L'esito del precedente comando sui cinque file compiler/runtime/title/
descendants/UI non è stato catturato dal reviewer: quei risultati non sono
considerati verificati in questo asse. Nessuna suite completa, validatore
pesante, host/browser/DB, helper ricevuto, installazione o modifica delle
evidenze. Dati compilati originali soltanto ispezionati staticamente.

## Spec

**Nessun requisito mancante/parziale, scope creep o comportamento errato
identificato.** Controllati limiti della capacità, dispatch fonte, listener
nascosti, scelte con costo, callback fisici, pavimento della minaccia,
custodia/preparazione/uso in attacco del titolo e rifiuto degli schemi storici.

Verifica indipendente: cinque file compiler/runtime/title/descendants/UI,
13 test passati senza errori o skip, circa11 secondi. Nessuna rilettura
indipendente delle primarie, QA browser, recupero HTTP/SQLite, compatibilità
integrale o suite canonica: tali riscontri restano nella verifica del root.
Sorgenti ed evidenze invariati.

**Conteggio per asse:** Standards0 violazioni/0 smell sostanziali; Spec0
rilievi. Nessun ordinamento trasversale dei due assi.

## Verifica del root

I sette commit sono integrati dalla base fissata senza modifiche root al
codice consegnato. Verificati tutti i2669 file/1854240772 byte e create copie
proprie per eseguire gli adapter; sigillo ricevuto immutato, nessun DB aperto.
Manifest SHA256
`4b7cf61ac90caa035044f0691cb17aa34b7ca0e28b1f3115e857d303b5f0a974`.

Riletti dieci asset/177134 byte con due reader e42 corpi IL/3230 byte codice/
1084 istruzioni, oltre al solo owner PlayMaker154 byte/68 istruzioni.
Ledger, hash e campi concordano. Ricontrollate31 chiavi italiane, riga intera
del workbook, quantità e policy del titolo separatamente dai benefici.
La sola variazione amministrativa della ricevuta workbook è il percorso
della copia propria. Freeze storico invariato e tre nuovi output compiler
identici byte per byte. Oracle indipendente:43 istruzioni/41 stati e337
casi finiti. Nessuna esecuzione Unity/JIT o parità RNG dichiarata.

Validator ricostruito dai sorgenti integrati:503/503 input,398 payload
distinti e17 viste94 complete. Ogni file controllato per byte/hash prima
del parse e confrontato interamente una volta. I batch root sono nove,
disgiunti, con la stessa unione503 dei sette batch ricevuti; vecchi risultati
copiati archiviati separatamente. Passano18 snapshot/viste96,14 snapshot/
viste98,17 snapshot/viste100 e19 snapshot/viste102, inclusi export/finali.
I19 nuovi snapshot hanno18 payload distinti. Solo schema21 e il default
storico physical:null≤10 sono migrazioni; nei restore su host nuovo cambiano
generation/revision/updatedAt. Nessuna normalizzazione gameplay o esenzione
replay, originale156 gated/immutato e nessun gameplay sui ricevuti.

Audit UI ricevuto:192 casi completi e48 ispezioni/annullamenti, più quattro
letture della copia titolo del destinatario, diverso dall'attore. Nei192
record: guida, lettore/focus, tastiera e assenza crypto.subtle. Nei48:
visibilità, costo/abilitazione quando l'opzione è visibile, annullamento e
assenza overflow. La proprietà disabled di un pulsante nascosto non viene
interpretata come disponibilità. Tutti i240 record dichiarano payload
immutato. Verificate24 registrazioni/33279 eventi: zero eccezioni e loadingFailed,
due422 intenzionali per restore e un409 stale del driver, distinto dai due.
Seicentottantotto PNG; cinque ispezionati dal root (due pannelli fisici,
stato del turno prima/dopo il titolo e lettore a320). Non si dichiara
ispezione manuale di tutte le immagini o nuova QA browser del root.
Chiusura dei tre contesti e rilascio della porta propria attestati.

Invarianti root sui23 test preesistenti: soltanto attese20→21; casi,
asserzioni, deadline, concorrenza, build e dipendenze invariati. Il primo
giro canonico del child falliva per una precondizione casuale del nuovo test
di provocazione: documentato e conservato. La fixture finale usa viaggio e
attivazioni fonte sull'intera popolazione, senza abbassare le asserzioni.

Suite canonica root **757/757**, zero fail/skip/cancel/todo,
624174,140792ms, concorrenza4 invariata, eseguita da sola dopo tutte le
verifiche pesanti. Typecheck, formato e diff passano. Nessuna modifica del
codice consegnato; le nuove verifiche runtime includono i confini di recupero.

Validator ricostruito dal commit finale e byte-identico a quello usato per
tutti i confronti. Differenze child/root soltanto nei commenti del percorso
della stessa dipendenza; runtime e payload non sono stati riscritti.
Privacy291 stringhe, zero leak su diff, pubblico e nuova storia; corpus e
ricevute soltanto scratch ignorata. Comandi, adattamenti, byte/hash e
riscontri root separati dal sigillo ricevuto.

Quantità57 null/unverified e blocco mantenuto; nessuna nuova partita originale,
ripresa156 o accettazione89/33. #57/#65/#89/#33 rimangono aperte; altri
incontri, campo completo/acquisti e A2 successivi. Schema21 richiede il
nuovo lettore; rollback dei dati mediante un backup precedente.
