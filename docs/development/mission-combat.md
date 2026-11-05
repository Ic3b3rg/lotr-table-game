# Primo scontro dal segnalino di missione — #108

Il consumer scenario collega ora la persona, lo spawn proprietario, il primo gruppo,
il controller di combattimento e la sua callback. Il collegamento è facoltativo e
fonte-bound: un pack precedente conserva interamente impronta, programma e gate.
La quantità dei benefici di #57 resta non verificata; il pack originale continua
quindi a bloccare l’intera interazione prima di costi, carte o casualità.

La specifica è in [mission-combat-spec.md](../planning/mission-combat-spec.md);
il [contratto primario](../research/first-combat-runtime-contract.md) distingue
fonte, interpretazione digitale e limiti. Questo rapporto non certifica una nuova
partita originale né la conclusione del gioco.

## Collegamento e continuazioni

`source-first-combat-v1` lega quattro definizioni complete al certificato corrente,
al prefab, al modello già presente nel combat source, alla configurazione
base/normale e alla posa realizzata congelata. Non copia EnemyLogic né introduce
un secondo kernel. Il compiler verifica owner, receiver esclusivi, certificati,
intero inventario, assenza di deferred edge nei quattro owner e binding geometrici.
Gli altri segnalini mantengono le rispettive capacità e i rispettivi gate.

L’ispezione presenta tutte e tre le opzioni con costo e annullamento gratuito.
Le prove usano carte e conversioni reali, attore conservato e `Sum` letterale zero:
limiti superiori ordinati e fallback sull’ultimo evento. Risorse, benefici e paure
passano dai consumer fisici esistenti. Il preflight percorre tutti gli esiti e le
continuazioni, incluse riserve e possibili provocazioni; non filtra il pool né
rende disponibile una sola opzione per aggirare #57.

Lo spawn chiede due figure e aggiunge tredici punti al budget locale. Distingue
massimo del gruppo, limite simultaneo, figure vive/in attesa e inventario fisico
non censito. Con un solo posto disponibile diagnostica prima del costo, senza
ridurre il gruppo. Con zero posti conserva il percorso di fallimento senza
salvare l’aggiunta locale né concedere l’attacco. Bonus e incremento di difficoltà
non vengono inventati. L’allocazione dei banner riusa il codice già certificato.
Il gruppo e la logica sono associati reciprocamente tramite la ricevuta salvata.

Solo lo spawn riuscito della variante offre all’eroe attore un attacco contro quel
gruppo senza un’altra azione. Uso, rinuncia e ritorno sono persistiti. Il principal
completa il proprio seguito e il proprio obiettivo prima di offrire l’attacco:
una sconfitta durante l’attacco concesso conserva così l’obiettivo della callback.
Carte, slot, spese, danni, contrattacco e P1/P2 restano nel controller condiviso.

Una sconfitta reale rimuove il gruppo dal tracker, risolve l’ispirazione e consegna
`DEFEATED` alla propria logica una sola volta. La fuga timer conserva una causa
distinta, rimuove tutti i gruppi vivi senza simulare salute zero e non assegna il
premio di sconfitta. I gruppi rimossi liberano la disponibilità per i successivi
spawn. Sapienza, sezione due, piazzamenti, annuncio, obiettivo, cleanup e ritorno
seguono gli owner esistenti; restano distinti annuncio letterale e valore salvato.
Il timer parte dallo startup: interazione e spawn non lo resettano. Armamento e
BoolFlip vengono consegnati nell’ordine fonte. Ombra, provocazioni, attore sconfitto
e controllo della perdita conservano i confini già attestati.

## Persistenza e migrazione

Schema24 aggiunge soltanto le forme del nuovo collegamento. I formati precedenti
le rifiutano anche nel seed; parole omonime nei dizionari restano dati validi.
Nessun formato storico riceve una capacità retroattiva. Un solo ledger ordinario
con origine immutabile registra costi, effetti, concessione e ritorni; Store.once
mantiene ricevute stabili su richieste concorrenti, stale e retry.

Le prove di crash intercettano il vero UPDATE SQLite in un processo di test e lo
terminano prima del commit; il retry ricostruisce l’intero candidato. Dodici
confini dopo commit vengono invece terminati con SIGKILL e ripristinati su host
nuovi, vuoti e privi dei pack. I confronti comprendono payload, viste e origine
interi. I negativi rifirmati verificano rifiuto422 e immutabilità di entrambe le
rappresentazioni.

## Grounding e verifica

Gli input autorizzati sono stati controllati riga per riga per byte e SHA256 prima
del parse: 4916 file della consegna106 e 236 artefatti del contratto75. Manifest,
provenienza e ricevute rimangono immutati; helper e DB operano soltanto su copie
proprie. Le immagini ricevute sono audit-only.

Due lettori verificano 41 oggetti puntuali, 378929 byte, compresi tutti i quattro
FSM: 78 stati e 98 azioni; il slice del contratto è 46/52. Il controllo indipendente
consuma 6994 parametri e verifica 104 corpi IL selezionati, 19687 byte, 7208 istruzioni,
703 salti e cinque regioni di eccezione. L’oracle non importa compiler o runtime
del prodotto. Controlla inoltre 200 conteggi letterali, effetti, pose e owner.
Il level4 completo non è tra gli input ricevuti: i sei oggetti selezionati e la
realizzazione riusano il certificato congelato, senza accesso agli originali.

Il nuovo pack privato contiene 37 definizioni, 279 stati, 295 azioni e 30 deferred
edge. Le 71 azioni già presenti nei quattro owner e l’intera EnemyLogic restano
identiche; si aggiungono soltanto 19 stati e 27 azioni mancanti. Tre compilazioni
producono gli stessi byte e validano la proiezione ricevuta. Le fonti originali, le carte e i relativi IR/FSM/IL, JSON e immagini rimangono
private. Il repository contiene codice, prove inventate e documentazione tecnica.

Le fixture pubbliche sono interamente inventate. Le prove HTTP attraversano tutti
gli esiti della persona, conversione, scorte, ownership, concorrenza, provocazione,
Ombra, rinuncia/uso dell’attacco, sconfitta e callback. La QA nativa inventata usa
tre identità distinte e 320/768/1024/1440 pixel su HTTP IPv4 senza crypto.subtle.
Dopo lo startup tutte le scritture gameplay passano da DOM/Input; HTTP GET ed
evaluate osservano. Carte, conversione, due figure, spesa dell’arma e sconfitta
sono reali. Sono verificati guida, lettore, focus, tastiera, overflow, export esatto,
due negativi 422, restore corrente, recupero dei tre posti e chiusura delle sole
superfici proprie. I fotogrammi effettivamente dipinti sono stati ispezionati.

I tentativi falliti sono conservati. Due regressioni rilevanti hanno aggiunto
prove prima della correzione: opzioni UI mancanti e obiettivo callback sovrascritto
al ritorno dell’attacco. Una corsa del driver fra aggiornamento GET e completamento
del focus UI è stata diagnosticata e ripresa dallo stesso stato senza nuove carte.
La formattazione ha cambiato i byte emessi: il codice corrente è stato riavviato
sullo stato salvato e l’intera serie nativa è stata riletta dal validator committato.

Il validator ricostruito esclusivamente dai sorgenti committati verifica 503 file
storici, 398 payload distinti e 17 viste complete. Le serie native 96/98/100/102/104/106
conservano rispettivamente 18/14/17/19/13/20 snapshot con viste intere ed export/finali;
i payload distinti sono 18/13/16/18/12/18. I 22 snapshot di questo lavoro hanno 19
payload distinti e conservano export/finale esatti. Copie identiche non sono nuove
prove gameplay. L’originale 156 è sottoposto soltanto a preflight statico gated e
confronto di immutabilità.

La QA inventata comprende 132 casi; 484 PNG superano il controllo di pittura e
cinque viste rappresentative sono state lette direttamente. Le sole segnalazioni
di rete conservate sono tre richieste favicon 404 e i due restore 422 intenzionali;
nessuna eccezione Runtime. Le ricevute delle build del validator identificano
commit, byte e SHA256; ogni correzione al codice richiede una nuova verifica intera.

La prima canonica ha rilevato tre regressioni: il controllo della nuova associazione
accedeva al pack anche nel contesto autonomo del kernel, che può esserne privo.
Il lookup della capacità ora conserva quel contesto; i 12 controlli mirati passano
con le asserzioni esistenti. Il test concorrente confronta inoltre i retry con
la ricevuta del vincitore effettivo, senza dipendere dall’ordine delle richieste.
Validator completo e canonica sono stati ripetuti dal commit corretto.

La suite canonica è eseguita da sola, a concorrenza quattro, dopo QA e validator.
Esito finale: **816/816**, zero errori, skip e cancellazioni; Node 24.11.1.
Tipi, formato, diff e privacy sono verificati senza cambiare le soglie. Le due review
Standards/Spec fresche e l’integrazione spettano al root.

| Verifica                        | Esito                                                 |
| ------------------------------- | ----------------------------------------------------- |
| Canonica isolata, concorrenza 4 | 816/816                                               |
| Storico dal commit              | 503 file, 17 viste intere                             |
| Serie 96/98/100/102/104/106     | 18/14/17/19/13/20, export e finali                    |
| Nativa 108                      | 22 snapshot/viste, 19 payload distinti; export/finale |
| QA inventata                    | 3 identità, 4 larghezze, 132 casi                     |
| Privacy diff e nuova storia     | 445 stringhe fonte, zero fughe                        |

Le dipendenze sono identiche. Non sono stati eliminati casi o asserzioni, né ridotti
deadline o soglie.
I 26 file di test preesistenti cambiano soltanto l’aspettativa della versione corrente.
Le tre regressioni della prima canonica e tutti i tentativi precedenti sono conservati
con diagnosi e comandi nelle prove private. Nessun push, PR, merge o partita originale.

## Integrazione del root

Due review fresche: Standards senza violazioni, un suggerimento P3 risolto riusando `livingEnemyGroups` nei due punti; Spec senza rilievi. Il root riproduce le fonti/oracle e le compilazioni statiche, confronta nuovamente tutti i salvataggi/viste/export storici e i22snapshot nativi dal proprio commit, verifica132casi QA e legge cinque schermate. La propria canonica isolata conclude816/816, zero fallimenti/skip/cancellazioni; tipi, formato, diff e privacy sono verdi. Il riepilogo è estratto dal log originale dopo la correzione di un parser del formato console. Nessuna partita originale avviata o ripresa156;57resta null/unverified e gated. [Review e limiti](../reviews/2026-11-05-mission-combat.md).
