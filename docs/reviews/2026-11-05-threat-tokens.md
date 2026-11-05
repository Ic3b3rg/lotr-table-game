# Review e integrazione dei segnalini minaccia — #112

Confronto fissato: main `4d50c29cb19c154c3cfc2558b50368fde6514bda` e
consegna `49aa63607e7e8b235133d2d9d8800c435f9f5a91`. Due review indipendenti,
con contesti separati. [Ticket](https://github.com/Ic3b3rg/lotr-table-game/issues/112),
[specifica](../planning/threat-tokens-spec.md), [rapporto](../development/threat-tokens.md).

## Standards

Zero violazioni documentate o smell Fowler sufficientemente concreti.
Capability, consumer, persistenza e migrazione seguono i confini esistenti.
I vecchi test modificati aggiornano soltanto la versione corrente25→26.
Review statica dei file tracciati; nessuna suite, build, host, browser,
scratch o scrittura remota. Totale: zero rilievi.

## Spec

Un P2: il messaggio dell'ultimo tentativo restituito precedeva quelli delle
fasi successive. La storia conserva quel tentativo, quindi l'invito a
riprovare o continuare il turno poteva nascondere Ombra e Riorganizzazione.
Viola il requisito di indicare chiaramente attesa e prossimo passo.

Il root riproduce il difetto con un test della UI reale compilata in un
DOM di prova, poi limita il messaggio al medesimo eroe, turno, round e Fase
di Azione. Sono verificati entrambi i tipi di segnalino, fine turni,
Ombra, Riorganizzazione, scelta dell'eroe e turno del round successivo.
Il test fallisce prima della correzione e passa dopo; nove casi UI mirati
passano. Nessuna modifica a regole, costi o forma dei salvataggi.

Nessun altro requisito mancante, comportamento errato o ampliamento
sostanziato. Il reviewer controlla sigillo e byte/hash dei file statici
pertinenti prima della lettura: inventario20/21, programma17/18, tre stati
esclusi, puntatore nullo, eventi, IL di proprietà/uguaglianza e floor0.
Nessuna esecuzione di helper, suite, host o browser. Totale: un P2,
corretto dal root in `b250cd8b45a8e2c769b866ccdb592600711e9241`.

## Verifiche del root

Controllate tutte10.539righe/4.380.356.111byte e due copie proprie per
byte/hash, senza symlink. Manifest2.376.873byte, SHA256
`08901a5c1b926bf35a63c3f446540f1ab9595b2c956b7c16d3dad82abef845e7`.
Nella copia operativa cambiano1080handle e25helper per i soli percorsi;
ricevute, provenienza e identità restano immutate. Nessun helper o DB
ricevuto viene eseguito nella consegna originale.

Rilettura delle primarie: otto oggetti/105.166byte con due reader,
20stati21azioni,2222parametri,3binding e5relabel; oracle indipendente su
35corpi IL/5442code byte/1906istruzioni/213branch/16regioni EH e15chiavi.
Il puntatore nullo resta tale: proprietà falsa, evento verso paura1;
i tre stati del ramo corruzione restano censiti ed esclusi. Il floor0
è applicato soltanto all'indirizzo attestato. Nessun polling Update nuovo.

Il pack110 viene ricostruito identico; tre compilazioni nuove sono identiche
per byte. Nuovo fingerprint `065471143eabbfc15b4dffa16fa787c280b69757f442a6f79bc09b03c98a7704`;
selezione, posa, pool, altre capacità e istruzioni precedenti immutati.

Il validator git-show/onLoad del commit corretto è1.644.662byte, SHA256
`28d79fbd2ba1421da004e0f70e8a271284b16fe95b86db9bcf5f3322da670e85`.
Il binario ricevuto differisce nei soli95prefissi dei commenti di dipendenza;
il confronto che li rende uguali riguarda esclusivamente il binario,
senza normalizzare payload o replay.

Passano503file/398payload distinti e17viste94; serie96/98/100/102/104/106/108
con18/14/17/19/13/20/22snapshot, export e finali interi.110conserva40snapshot/
37payload distinti e9recheck/6distinti degli stessi giochi;112conserva32snapshot
nuovi. Il confronto include viste e origini intere. Sole migrazioni strutturali
attestate; nessuna normalizzazione di gameplay o esenzione per il nuovo codice.

L'audit della QA ricevuta riguarda due episodi inventati, tre identità,
quattro larghezze,27matrici/324casi e32snapshot. Dodici file di eventi,
47.271eventi: zero eccezioni Runtime o caricamenti falliti, quattro restore422
intenzionali. Tutti1200PNG sono dipinti,638byte-distinti; sette viste lette
direttamente dal root, incluse attesa mobile, carte/conversioni, beneficio,
P2, ritorno, lettore e guida. Le immagini documentano il codice del child
prima della correzione dei messaggi; la regressione root verifica il seguito
delle fasi. Nessuna nuova partita o nuova esecuzione browser del root viene
attribuita a questo audit. I duplicati non sono ulteriore gameplay.

Recovery:49file verificati dal binario corrente,16postcommit,16precommit e
17negativi422. Payload, viste, origine e restore packless interi; soltanto
generation/revision/updatedAt amministrativi possono cambiare al restore.
Le ricevute di chiusura delle sole superfici proprie sono verificate dai
file, senza ispezionare processi altrui.

Canonica root **864/864**, exit code0, zero fail/cancel/skip/todo,
concorrenza4 da sola dopo i controlli pesanti;972,726secondi, HEAD invariato
e albero pulito. Tipi, formato, diff e privacy passano. I28vecchi file di
test contengono soltanto le aspettative di schema corrente25→26; il nuovo
caso UI root aggiunge una regressione, senza ridurre alcuna prova precedente.

Gli errori di preparazione dei helper e i RED attesi rimangono conservati.
Un errore iniziale nel solo scaffold del test root viene corretto prima
del RED che dimostra il vero messaggio errato. Nessuna asserzione o scadenza
viene ridotta per ottenere il verde.

## Limiti

Quantità57 ancora null/unverified; intera continuazione bloccata prima di
costi e casualità. Nessuna ipotesi sulle copie, filtro, proxy o reroll.
156 resta statico/gated e immutato, senza nuova partita originale o ripresa.
89/33/65/57 restano aperte: questa consegna non certifica l'avventura completa.
Campo completo, acquisti/upgrade e A2 restano successivi. Nessuna parità
Unity/JIT, QA su telefoni fisici/Safari/Windows o aggiornamento del tavolo
live del proprietario viene dichiarato. Corpus e immagini restano privati.

Standards:0rilievi. Spec:1P2corretto con regressione verificata.
