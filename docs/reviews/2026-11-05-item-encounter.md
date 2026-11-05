# Review dell’incontro con oggetto — #106

Confronto fissato a `24fa97e8342e6114c519f733d02b989ea0e24f0f` contro
`581e7ad50d224e48ef32dda15d0394da9366fa58`: sette commit, 67 file.
[Issue106](https://github.com/Ic3b3rg/lotr-table-game/issues/106),
[specifica](../planning/item-encounter-spec.md),
[piano](../planning/item-encounter-plan.md) e
[rapporto](../development/item-encounter.md). Due review indipendenti con
contesti freschi; verifica del root distinta dalla consegna.

## Standards

**Nessuna violazione documentata o smell euristico sostanziale trovato.**
Controllati migrazioni, custodia e consumo, binding fonte, preflight,
callback, inventario pubblico e lettore. La sospetta modifica dell’effetto
storico fear-facedown è un falso positivo: il loop già controlla used e
il ramo storico non vi aggiunge la copia, conservando il comportamento.

Verifica finita: 4/4 test compiler/fisica con il dist esistente. Nessun
build, host HTTP, restore, suite canonica, browser, gameplay originale o
modifica a sorgenti/evidenze. Aspetti già imposti dal tooling esclusi.

## Spec

**Nessun requisito mancante/parziale, scope creep o comportamento errato
confermato.** Controllati certificato modale, input espliciti, rifiuto dei
binding errati, conversioni e nuovo costo del retry, gate upgrade, custodia
unica, consumo del proprietario, sola faccia della paura, callback e campo.

Verifica indipendente: 8/8 test compiler/runtime/fisica sul dist esistente e
bundle in memoria. Nessuna build su disco, host, recupero o nuova partita
originale. Primarie/oracle, compatibilità integrale, QA nativa e suite
canonica rimangono riscontri indipendenti del root.

**Conteggio per asse:** Standards 0 violazioni/0 smell sostanziali; Spec 0
rilievi. Nessun ordinamento trasversale dei due assi.

## Verifica del root

I sette commit sono integrati dalla base fissata senza modifiche root al
codice consegnato. Verificati tutti i 4916 file / 2505445694 byte e create
copie proprie immutabili/di lavoro. Manifest 1017460 byte, SHA256
`b42f257f7dd5f5182ac1ac76e2d98643d132ee15832c5f28e75ece6c0eaf4af5`.
Nessun helper o DB ricevuto eseguito in posto; esclusi soltanto i profili
browser indicati dal sigillo. Le ricevute originali restano immutate.

Riletti sei oggetti centrali / 60091 byte con due reader, più i riferimenti
pertinenti: 125 letture, 123 oggetti distinti, 73127 byte; 114 riferimenti
alle abilità base, 113 identità distinte. Sessantacinque corpi IL,
4223 byte codice / 1521 istruzioni, incluso il lifecycle modale. Ledger,
parametri, puntatori e localizzazioni coincidono con la consegna.

Le tre righe complete Equipment16–18 del workbook primario sono rilette
e confrontate, distinguendo carta base, consumo e quantità dai benefici.
Il primo adapter root cercava queste righe nel risultato del helper per
Skill Cards: StopIteration conservato. Corretto il selettore sul foglio
Equipment, senza cambiare primarie, carta o gameplay. Oracle indipendente:
9 stati, 10 azioni e 1536 casi finiti. Quattro output compiler identici
byte per byte e freeze104 invariato; nessuna esecuzione Unity/JIT o parità RNG.

Il validator root ricostruito dal commit integrato misura 1581584 byte,
SHA256 `12fe250fdf7eb2a02de0556ac70bc37404883e0a6c0c134fc238bac0018c4af3`.
Rispetto al child cambiano soltanto 95 commenti dei percorsi della stessa
dipendenza; il codice runtime non è normalizzato. Passano 503/503 input,
398 payload distinti e 17 viste94 complete, 913356631 byte comprese le viste.
Nove batch disgiunti controllano tutti gli indici una volta, byte/hash
prima del parse e interi payload/viste, senza esenzioni replay.

Passano 18 snapshot/viste96, 14/98, 17/100, 19/102 e 13/104, con
18/13/16/18/12 payload distinti; export/finali inclusi. Passano anche
20 snapshot/viste106, 18 payload distinti, export e finale interi. Sole
migrazioni: schema23 e il default storico physical:null≤10. Nei restore
correnti cambiano generation/revision/updatedAt. Copie identiche non nuove
prove; il 156 conserva gate57 e payload intero nel solo preflight statico.

Audit della QA nativa ricevuta: 19 matrici, 228 combinazioni, tre identità
e 320/768/1024/1440. I 204 casi completi verificano guida, lettore/focus,
tastiera, assenza overflow e crypto.subtle. Le 24 ispezioni verificano
annullamento gratuito e istruzione dell’attore, senza attribuire loro
controlli non registrati. Verificati nove file / 28946 eventi: zero eccezioni
e loadingFailed, due 422 intenzionali sui restore. 924 PNG nel solo episodio
finale; la precedente fixture con riferimenti errati è archiviata e non
conteggiata come accettazione positiva o adattata per farla passare.

Il root ispeziona quattro immagini, tra cui il lettore a320 prima e dopo
il consumo con proprietario e residui corretti. Un fotogramma della finestra
fisica contiene un’area Chromium non ancora dipinta e non viene usato come
prova visiva del contenuto; il DOM, gli input successivi e i payload sono
verificati separatamente. Non si dichiara ispezione manuale di tutte le
immagini o nuova sessione browser del root. Ricevuta di chiusura dei tre
contesti e rilascio della sola porta propria verificata.

I 25 file test preesistenti del child cambiano soltanto le attese22→23;
asserzioni, casi, deadline, build e dipendenze invariati. Il primo run
canonico del child termina 788/789 per ECONNRESET in una GET del recupero
storico della vittoria. Sono conservati stack e log; test isolato e nuova
suite completa passano sullo stesso codice, senza ridurre i controlli.

Suite canonica root **789/789**, zero fail/skip/cancel/todo,
720068,542125 ms, concorrenza4 invariata, da sola dopo tutte le verifiche
pesanti e i reviewer. Passa anche il test storico di recupero che aveva
avuto ECONNRESET nel primo tentativo del child. Tipi, formato e diff verdi.
Nessuna modifica del codice consegnato. Il validator dal commit finale
è ricostruito e confrontato byte per byte con quello dei riscontri completi.

Privacy 317 stringhe, zero leak su diff, pubblico e nuova storia; originali,
prosa/carte, IR/FSM/IL, JSON e immagini solo scratch ignorata. Comandi,
adattamenti, byte/hash e risultati root separati dal sigillo ricevuto.

Quantità 57 null/unverified e blocco mantenuto; nessuna nuova partita originale,
ripresa156 o accettazione89/33. #57/#65/#89/#33 restano aperte. Upgrade oltre
il solo oggetto base, altri incontri, campo completo e A2 rimangono seguiti.
Schema23 richiede il nuovo lettore; rollback dei dati da un backup precedente.
