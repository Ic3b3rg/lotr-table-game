# Miglioramenti degli oggetti al primo campo — #116

Il campo mostra l'equipaggiamento effettivo del proprietario e gli accessori
comuni separatamente. Le carte e le alternative si leggono gratuitamente;
una scelta richiede conferma esplicita, oppure si annulla senza modifiche.
La conferma sostituisce una copia nell'inventario di campagna e libera
quella precedente. Anche il riepilogo comune e il suo lettore seguono
l'inventario di campagna; le zone dell'episodio concluso restano storiche.

La Sapienza autorevole è un requisito permanente condiviso: non viene
spesa. XP e premi storici rimangono invariati. Il server verifica campo,
proprietà, copia disponibile e successore immediato della fonte. Non sono
ammessi salti di rango, downgrade, duplicazioni o trasferimenti personali.
La persona autenticata conferma la scelta concordata dell'inventario
comune, senza creare un proprietario personale. Il PC anonimo osserva.

## Contratti e persistenza

La capability facoltativa `source-camp-items-v1` è certificata dal compiler,
legata a catalogo, metodi, modelli e quantità e congelata prima dello startup.
Prodotti posseduti espliciti `[0]`. Un pack privo della capability non la
acquisisce da file esterni aggiunti in seguito. Nessun nuovo inventario,
journal o seed: si riusano `SCENARIO_INPUT`, `Store.once`, comandi e replay
del ciclo esistenti.

La ricevuta completa identifica copie, modelli, ranghi, requisito e Sapienza
letta. Tipo del comando, kind e riepilogo sono verificati in entrambe le
direzioni e dal replay. Le guardie finanziarie114 rimangono operative.
Schema28 aggiunge soltanto una migrazione strutturale: le nuove forme
sono rifiutate nei formati1–27 e nel prefisso startup/pre-seed, conservando
i dizionari ordinari. Il restore modifica soltanto generation, revision
e updatedAt. Il piano di startup rifiuta un catalogo incoerente prima di
carte, costi o RNG.

## Fonti e riproduzione

Norma: [Rules Reference FFG, p4 e §§34,51.5–51.7,56.1–56.8](https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf).
La copia locale ricevuta è stata verificata prima dell'estrazione PDFKit;
il fetch web fallito è conservato. Baseline fissa Steam1.6.6#1128,
build24301165, Unity2022.3.62f2. La prova è statica, senza certificazione
JIT o esecuzione del runtime Unity.

| Verifica bounded                                       | Risultato                                                         |
| ------------------------------------------------------ | ----------------------------------------------------------------- |
| Product e ItemModel, due reader e decoder indipendente | 79 oggetti,22896byte;78 modelli,13472byte                         |
| Stock base e successori immediati                      | 83 copie fisiche;71 archi;33 puntatori esterni non eseguibili     |
| Workbook/localizzazione e confronto italiano/originale | 78 carte complete;222 dimensioni numeriche                        |
| Oracle indipendente dal prodotto                       | 46 catene,92 passi;426 casi finiti di soglia/disponibilità        |
| IL degli ingressi UI e callee effettivi                | 34 corpi,5201byte codice,2049 istruzioni,205 destinazioni di ramo |

Gli ingressi UIRestScene verificati comprendono06000deb,06000df4–df5,
06000e00–e04,06000e06,06000e23–e24; i callee attestano gli inventari,
la sostituzione, lo stock e la lettura della Sapienza. Gli identificatori
sono locatori; le prove private conservano i corpi bounded e i relativi hash.
Un marker workbook non standard resta esplicitamente sconosciuto nelle
meccaniche non eseguibili. Un binding storico è stato ricontrollato senza
creare alias. Non sono stati cambiati catalogo iniziale74, carte precedenti
o certificati per superare i confronti.

114 corretto è ricostruito byte-identico:658484byte,
SHA256 `307852652f7c49e8a7220ea84fa65302d1cd60bd9973a1ec6984f3e0f8703386`,
fingerprint `8f1b22eafa1f90b99e90ef2954eb0010b868bce683b7e62b6a5e967c3c296986`.
116 conserva tutti i campi precedenti:829785byte,
SHA256 `982996c68598bd8599f49e9eefb7ef54615f676ebed6fb7aa1470942628ba50d`,
fingerprint `e823cb6663fe1af41b835dc6de504c2c7c129b0ddd9ea453c5a62aade6d05492`.
Tre compilazioni identiche, ripetute con compiler costruito dal commit
prodotto tramite git-show/onLoad.

## Verifiche

Base main `4c3c858b58bdc068f2d33ef15e5f76783e17aac5`, baseline root883.
Commit prodotto verificato `afd4095eb79e1306e9e31d52916a9735cbf1da94`.
Specifica e piano precedono il codice. Tutti i test nuovi usano materiale
inventato e controller HTTP/SQLite reali.

| Controllo                                                         | Risultato                                                                                                  |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| TDD mirato116, dopo l'ultima correzione                           | 23/23,exit0; nessuno skip                                                                                  |
| Soglie, alternative, ranghi, proprietà/fase/fonte/cursore/rev/gen | Payload interi e veri riepiloghi del vincitore; retry e contesa200/409                                     |
| Recovery116 per esecuzione completa                               | 5 tagli postcommit,3 precommit reali,26 negativi risignati422;8 snapshot dei tagli aggiuntivi              |
| Precommit                                                         | Vere righe SQLite command/receipt prima del COMMIT; rollback, retry e restore su host nuovi vuoti packless |
| Corpus503 e viste94                                               | 503file/398payload distinti/17 viste intere                                                                |
| Serie96–108                                                       | 18/14/17/19/13/20/22 snapshot, inclusi export/finali                                                       |
| Serie110                                                          | 40+9 snapshot degli stessi giochi; nessun duplicato contato come nuovo gioco                               |
| Serie112                                                          | 32 snapshot nativi, export/finali/vista/origine                                                            |
| Serie114                                                          | 15 snapshot/11 payload distinti,export/restore;30 recovery                                                 |
| Nuove prove proprie                                               | Tutti gli snapshot,export/finali,viste/origini e candidati reali; tentativi precedenti conservati          |
| Canonica isolata                                                  | 906/906,exit npm0,concurrency4;1116.454s;footer spec reale,nessun fail/skip/cancelled/todo                 |
| Tipi, formato, diff e privacy                                     | exit0; storia completa,diff e file finali,1029 needle lunghe più nomi brevi interi                         |

Le serie sono state ripetute dopo l'ultima correzione. I confronti non
normalizzano il gameplay: soltanto schema28, il precedente physical:null
per i formati fino a10 e i tre campi amministrativi del restore. Le vecchie
asserzioni sono conservate;31 file aggiornano soltanto la versione corrente,
incluso il limite del relativo test di ricevute. Nessuna dipendenza nuova,
installazione, riduzione di soglie/deadline o suppression.

La QA finale usa Chrome nativo, tre contesti personali indipendenti e PC
anonimo,320/768/1024/1440,HTTP IPv4 senza crypto.subtle. Prerequisiti e
premi sono fissati prima dello startup; il campo arriva dall'acquisizione
dell'accessorio, dalla prova del covo e dai consumer reali di conclusione.
Dopo bootstrap giocano soltanto DOM/Input/filepicker.48 casi finali nelle
tre matrici producono156 PNG;4 ulteriori controlli della guida contestuale
usano lo stesso gioco. Lettore, annulla, focus/tastiera/tap, impossibili,
conflitto, export,422,current restore e recupero dei tre posti verificati.
Nessun overflow; i comandi controllati rispettano44px. I PNG sono realmente
dipinti e campioni delle quattro larghezze sono stati ispezionati.

Le prove precedenti restano distinguibili: una slice verticale, una prima
QA completa e una copia del medesimo gioco per la guida; non diventano
nuovi casi finali o partite originali. La chiusura delle sole superfici
proprie è provata mediante uscita dei PID noti e riapertura della porta propria.

## Fallimenti conservati e limiti

Le RED hanno rilevato capability assente, nomi accessibili incompleti,
gate di startup tardivo, messaggio futuro inesatto e riepilogo comune
ancora storico. Le correzioni hanno le rispettive GREEN. Sono conservati
anche gli errori degli helper: nome worksheet/marker, prerequisiti di
fixture, percorso adiacente e fase di acknowledgement, apertura del recupero,
aspettativa errata sul modello comune e tentativo di focus su testo non
focusabile. Due import errati del helper finale hanno restituito module-not-found e sono stati corretti contro il percorso reale del binario. Un tentativo di copia forzata ha restituito ENOSYS; la successiva
copia fisica è verificata. Non si attribuiscono altre cause ai tentativi.

Il fallimento opzionale storico del minimo colori su un PNG audit-only
di114 resta immutato, insieme ai due PNG aggiuntivi e ai240 PNG QA accettati. I nuovi criteri sono
dichiarati prima delle catture:almeno120 colori RGB e frazione dominante
massima0.97; nessuna reclassificazione dello storico. I controlli geometrici
e l'ispezione visiva accompagnano le metriche.

Non è una prova su telefoni fisici, Windows o del runtime Unity. La nuova
capability consente consultazione e sostituzione; le capacità delle carte
richiedono i consumer del seguito. A2 e altri prodotti restano gated prima
di costi/carte/RNG.57 rimane NULL/UNVERIFIED e bloccante;156 resta byte-identico,
statico/gated.89/33/65/57 rimangono aperte. Nessuna partita originale
completa, ripresa originale o aggiornamento del live dichiarato.

Corpus,testi,carte,IR/IL,JSON,DB e PNG rimangono nella capsule privata ignorata
`.scratch/camp116`, con README,lock,log,tentativi e manifest byte/SHA.
Le identità storiche non vengono seguite o riscritte. Il solo node_modules
autorizzato è stato copiato fisicamente/COW in sola lettura dall'origine,
con lock coincidente e verifica di tutte le copie; resta escluso dalla capsule.
Nessuna scrittura GitHub,push,PR o merge. Root esegue review indipendenti
Standards/Spec e integrazione.

## Integrazione del root

[Review e verifiche indipendenti](../reviews/2026-11-06-camp-items.md):
Standards0violazioni/1suggerimento facoltativo; Spec0finding statici.
Il controllo visivo root rileva un invito impossibile al massimo rango
in lista e lettore. La correzione ha RED/GREEN e una nuova regressione
su massimo/Sapienza insufficiente/copie possedute, mantenendo la lettura gratuita.

24/24 mirati e **907/907 canonici**, npm exit0, ALONE4,1120,538secondi,
HEAD pulito invariato. Corpus e tutte le serie storiche/proprie passano;
l’ultima modifica solo client/test conserva backend e validator byte-identici.
Verificati anche164JSON/24DB prodotti dalla canonica root. Un controllo
nativo distinto sul vero applicativo ripristinato inventato mostra lista
e lettore corretti a quattro larghezze,8PNG, payload intero invariato e
sole superfici proprie chiuse. Non è una nuova partita originale.

Il pack116 e le quantità non cambiano.57NULL/UNVERIFIED e156statico/gated,
A2 e futuri consumer rimangono invariati. Il rapporto distingue le prove
consegnate prima della correzione UX da quelle finali del root.
