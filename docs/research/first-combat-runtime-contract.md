# Primo combattimento originale: contratto e confine successivo

Ricerca per [#75](https://github.com/Ic3b3rg/lotr-table-game/issues/75),
3 novembre 2026, sul checkout assegnato e sulla base
`d10dd70f9ca70574de92cf643a2fdbe0195e2958`, schema15.
**Il primo scontro richiede un consumer di attacco e nemici, collegato alla
fisica esistente e alle continuazioni dello scenario. Non è implementato da
questa ricerca.** L'uscita verificabile proposta termina dopo la rimozione
del primo gruppo e il seguito che rivela la sezione2, aggiorna l'obiettivo
e arresta il timer. Non comprende tutta A1, campo o avventura2.

Un solo file pubblico; acquisizioni, testi, associazioni delle carte,
annotazioni, grafi, IL e checker sono nella scratch ignorata
`.scratch/first-combat/`. Nessuna suite, host, app originale, Unity/JIT o
sessione di gioco è stata eseguita. La baseline541/541 è quella consegnata
dal root, non una verifica ripetuta né una prova del combattimento.

## Autorità e perimetro

**E** indica fonte primaria letta o dato ricalcolato da quella fonte;
**I** indica adattamento o proposta implementativa; **U** un limite esplicito.
Gli indici stato/azione sono zero based. `A1218:003f` significa MethodDef
`0x06001218`, offset IL relativo al codice; S/R/L4 sono pathID qualificati
di `sharedassets0.assets`, `resources.assets`, `level4`.

| Fonte             | Identità e localizzatori                                                                                                                                                                                                                                                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A / P / Msc       | Installazione Steam24301165, JiME **1.6.6#1128**, Unity2022.3.62f2. SHA256 Assembly-CSharp `8869ef87b7d49f4993911904e35d78b72f8339e91158bbe8784c9691a9d743c6`; PlayMaker `a7b91f8e0eeb2c3edf351eed4ca722088d6d0281d3db718d7db153c9ff756b54`; mscorlib `9434e43dd58f9e3aba5b76c94f5da7fcec20c1bce2186c830039aa77c439b47a`.                                 |
| Asset / IT / MAIN | File e oggetti bloccati nel manifest privato. TextAsset italiani `BonesOfArnor_it` / `Main_it`, pathID `-2938581942859744165` / `-7439224213581943799`; bundle SHA256 `021cb0f200afd2d87369bc6663d1cbd6c157b21ee9dfcab1bd532d3ebe330606` / `c6b5dd76a635eb7082a24b7dbfca146460b8131f85aff9f07e7e9e3713d29cdf`.                                            |
| Regole            | [Manuale IT][manuale], soprattutto pp.10–12/16; [Rules Reference][regole], §§1–3/10–12/21–22/24/30/33–35/43/48/54/59–61/69/71/74/83/93/100; [FAQ IT2.0][faq], pp.1–2. PDF locali identificati dai precedenti lock e ricontrollati; R e FAQ ricontrollati anche online. Il fetch FAQ EN è terminato in timeout: nessuna regola dedotta da quel fallimento. |
| W / catalogo      | Workbook V1.10,610.648 byte, SHA256 `833edd0f9235d559253c6c0d43e61bcc0b5d955103bb2001e37a2e3ddef88ca4`; [baseline approvata](../planning/fidelity-baseline.md), [identità](base-card-identity-reconciliation.md), [catalogo fisico](physical-content-catalog.md). Le traduzioni approvate non diventano trascrizioni editoriali italiane.                 |
| QA autentica      | Freeze Cacciatore di #38, già riusato da #71/#73: Aragorn/Capitano, Beravor/Apripista, Bilbo/Cacciatore; tre proprietari distinti. Freeze SHA256 `8cffc05eb19f741d9c10da6cb8b8b5e58ac4c5551e345aa94606e50f3a6d1951`. Anche l'export UI dello startup, revisione37, è bloccato privatamente. Non viene costruita una nuova compagnia.                      |

Si riusano [principal](first-adventure-runtime-contract.md),
[compiler startup](first-adventure-startup-compiler.md),
[realizzato55](first-adventure-realized-runtime-contract.md),
[contratto61](physical-resolution-runtime-contract.md),
[P0](../planning/physical-resolution-p0-spec.md),
[P1](../planning/physical-resolution-p1-spec.md),
[P1b](../planning/physical-resolution-p1b-spec.md),
[P2](../planning/physical-resolution-p2-spec.md),
[incontro71](../planning/original-encounter-spec.md) ed
[esplorazione73](../planning/original-exploration-spec.md).
Nessun audit generale di nemici,74 abilità o generatore viene ripetuto.
GLOSSARY, istruzioni in `docs/agents` e ADR1–3 restano vincolanti.

## Dalla persona al gruppo

**E — Impegno:** R27649.s2→6 apre le opzioni e l'annullamento gratuito.
Ogni opzione d'interazione impegna il suo eroe, nella stessa casella del
segnalino, pagando una sola azione; le prove e i messaggi successivi
proseguono quel tentativo. Sono tre opzioni e cinque esiti effettivi.
L'host deve applicare anche il beneficio del ramo senza prova: leggerne il
testo non sposta risorse. Gli esiti con conseguenze fisiche o benefici
richiedono il rispettivo consumer prima dell'abilitazione. Le associazioni
puntuali rimangono private. [R27649.s6–15; IT packet effettivi;
A117b/1182; R §§2/49/71.]

**E — Conteggi distinti da #71:** i due challenge della persona partono da
un `Sum` **letterale0**, non dal `Result` cumulativo dell'altro incontro.
Caratteristiche e coppie ordinate provengono dai packet e dai parametri:
Forza, limiti superiori0/2/3; Agilità,0/1. Il selettore usa il primo limite
maggiore o uguale al risultato, altrimenti l'ultimo evento. Conservare il
risultato0…99 e l'attore; non trasformare quei valori in soglie minime o
sommarli fra interazioni. [R27649.s3/s15; A117b:0007–004e.]

**E — Broadcast e timer:** l'esito normale raggiunge principal.s21,
l'unica variante pertinente s23. Poi la persona invia, in ordine,
`SET_DUDE_TIMER` e `SET_REVEALED_DUDES`, si nasconde e resta in s19.
I ricevitori effettivi sono il principal per i due eventi di spawn e il
timer R20635 per i due aggiornamenti. Il secondo aggiornamento è un
**BoolFlip**: dopo lo startup il valore è vero, dopo l'interazione falso.
Il primo assegna solo `DUDE_TIMER=true`. **TimerValue parte da2 allo
startup e non viene azzerato dall'interazione o dallo spawn.** Visibilità,
processing e registrazione del ricevitore sono distinti. [R27649.s13/14/16/18/5;
R20635.s0/10/12; A1e4c/1eb2/23d7; export startup37.]

**I — Concessione:** soltanto l'inserto del messaggio di spawn riuscito in
s23 concede all'eroe dell'interazione un attacco facoltativo, contro quel
gruppo, senza ulteriore azione. Registrare concessione, uso o rinuncia e
ritorno; non attaccare automaticamente. La variante normale e lo spawn
fallito non ricevono questa concessione. Il beneficio dell'esito precedente
resta un'operazione separata. [R20275.s21/s23.a0.Message.Inserts[0];
IT `A1_M1_E1_ENEMIES_A`; A1217/121b/121e; R §2.3.]

## Spawn, disponibilità e posizione

| Dato E         | Valore effettivo e proprietario                                                                                                                                                                                                                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identità       | S1629, EnemyModel ID2; Logic GO R2309 → EnemyLogic R21459 → FSM R24473. I due riferimenti gruppo↔logica vengono assegnati sullo spawn riuscito. [A1218:0010–003e/0138–0158.]                                                                                                                                                      |
| Figure e punti | `SpecifySize=true`, size2; `IgnoreCost=false`, AdditionalPoints13. Costi S1629: una figura7, due13, tre19. Il **massimo del gruppo3**, il **massimo simultaneo6**, le **due figure richieste** e i **13 punti** sono quattro quantità diverse.                                                                                     |
| Disponibilità  | Sul percorso fresco: in gioco0, pending0, riservate0; sei posti applicativi disponibili, quattro dopo lo spawn. I contatori includono gli eventuali modelli collegati; qui LinkedEnemyId0. La riserva conta occorrenze di figure, non punti. [A0b86/0b93/0b94/0bb1/0bb2; startup senza spawn.]                                     |
| Budget         | Prima0, budget locale0+13, costo13, residuo0; sui percorsi successivi `clamp(P+13−13,0,5H)`, qui H3 quindi tetto15. Se fallisce, l'aggiunta locale non viene salvata. [A1218:0056–0097/0128–0137/02bc–02d7.]                                                                                                                       |
| Statistiche    | Ogni figura: salute5, armatura0, stregoneria0. Due barre distinte;10 è la somma iniziale della salute, non una singola figura. Bonus casuali disabilitati, lista esplicita vuota; gruppo normale, non a distanza, inizialmente pronto. [S1629; A0bb7/0c21/0c22/0c4c.]                                                              |
| Casella        | SpawnPosition GO R6413 → custom Tile R21590, modello S2635/hash1507440, unica casella R25982/Spaces[0]. Il binding usa la posa **realizzata** congelata; la posizione authoring del Transform R11013 non è la posizione di gioco. Non scegliere una casella vicina o il prefab standard100A. [A1217:0016–0080; freeze/proiezione.] |
| Callback       | Successo e fallimento sono entrambi `FINISHED→s22→s0`; successo attende la chiusura del messaggio. Fallimento non mostra il messaggio di piazzamento. s22 imposta e annuncia il nuovo obiettivo. [R20275.s21–23; A1217/121b/121e.]                                                                                                 |

**E/U — Due distinzioni da conservare:** A0b94 verifica il costo di
una figura e almeno un posto libero; A0bb7 costruisce la dimensione
specificata, senza ridurla alla disponibilità residua. Il percorso fresco
ha spazio per entrambe. Non è dimostrato un algoritmo di riduzione2→1:
un futuro caso di carenza va diagnosticato prima del costo, senza inventare
uno spawn parziale. `SpecifySize=true` non usa GetMaxGroupSize per
ricalcolare la richiesta dal budget. Inoltre MaxUnitsInPlay6 attesta il limite applicativo,
non un nuovo censimento fisico per tipo; il manuale attesta25 miniature
nemiche complessive. La richiesta effettiva colloca due figure. [Fonti
sopra; M p.3; [distinzione componenti/modelli](base-component-coverage.md).]

**E/I — Difficoltà:** questa azione non consulta la difficoltà e non
applica bonus automatici; non aumentarne salute o figure perché esiste
la modalità difficile. La difficoltà1 modifica invece i punti all'inizio
Ombra; la modalità2 ha ulteriori differenze. Il freeze attuale non contiene
un binding esplicito di difficoltà: il prossimo pack deve dichiarare e
validare la configurazione normale già supportata, prima dei costi.
Non certificare altre modalità per analogia. [A1218/0bb7/3902:023a–02cc;
S805; identity/context del freeze; compiler38.]

## Attacco digitale e carte della compagnia

**E — Sottoinsieme fisico:** verificati tre eroi, **sette copie di sei
oggetti**,45 copie abilità appartenenti a33 identità, comprese le tre
debolezze realmente pescate; tre preparate iniziali. Le tre armi contengono
**sette slot distinti** di capacità a costo di successi. Un doppione di
testo sulla stessa carta non fonde i due slot. Gli oggetti d'attacco
effettivamente equipaggiati non sono a distanza. [W Equipment!2/22/30/167/176/195;
Characters!13/15/16; righe abilità determinate dalle copie del freeze;
modelli S2107–2109 e sei ItemModel; `cards.private.json`.]

La rilettura OOXML distinta conserva i simboli di tutte le copie, il testo
inglese e la traduzione approvata, identità/proprietario/numero, celle e
hash per campo. Le30 abilità non debolezza possedute hanno annotazioni
private delle finestre; ciò non è un nuovo catalogo74 né un executor.
Le tre preparate dello startup non rappresentano tutte le preparazioni
future: Scoperta e figli possono renderne disponibili altre.

| Confine normativo E                                                     | Requisito digitale I                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Proprietario, turno, bersaglio, costo e distanza. R §§2–3/12.2–12.3/74. | Un attacco ordinario richiede l'eroe vivo di turno e un'azione; un attacco concesso richiede la precisa concessione ancora aperta. Oggetti equipaggiati, almeno uno idoneo; caratteristica comune a tutti gli oggetti scelti. Bersaglio vivo nella stessa casella, oppure adiacente solo con tutti gli oggetti a distanza. |
| Prova e finestre. R §§1/12.4/69/93/100; FAQ p.2.                        | Sostituzioni della caratteristica e modificatori prima del reveal, minimo una carta; vere carte e simboli, nessun effetto dal testo delle rivelate. Preparata e costo verificati per ogni capacità; Assalto non si attiva da uno scarto imposto. Finestre attacco e negazione sono contesti differenti.                    |
| Fato, ispirazione e successi. R §§38/48/88/95/100.                      | Ledger di simboli convertiti/spesi e risorse; scelte reali, successi aggiunti e capacità legate alla definizione intera. Ogni slot stampato si paga e usa al massimo una volta nell'attacco; nessun successo paga due slot. Non moltiplicare liberamente colpi per successi.                                               |
| Colpi e modificatori. R §§10–12/59; A0c65/38e5.                         | Sommare gli effetti legali prima dell'applicazione; salute per figura, danno residuo alla successiva, armatura prima di stregoneria. Implementare i modificatori raggiunti dalle armi e gli agganci delle persistenti fisiche già compilate. Nessun modificatore scelto liberamente dal client.                            |
| Attacco senza colpi e contrattacco. R §21.7; A0c5d/38e5/38a0.           | Zero colpi è un risultato valido e può provocare contrattacco. Uno “Apply” esterno a un attacco mantiene invece la sua causa e non concede contrattacco. Distinguere anteprima revocabile e applicazione registrata.                                                                                                       |
| Movimento/interazione con nemici. R §§35/60/71.                         | Prima di uscire o interagire provocare ogni gruppo pronto nella casella; attaccare non apre questa provocazione. Salvare la continuazione del movimento/interazione e ricalcolare la legalità dopo i figli. La provocazione non esaurisce il gruppo.                                                                       |

**I — Dipendenze effettive:** oltre agli slot delle armi servono
conversioni e successi da preparate, sostituzioni prima della prova,
Assalto/Protezione con costi distinti, Scoperta figlia che trattiene le
carte del padre, reazioni dei tre eroi, supporti/prevenzioni e limiti già
chiusi da61. Le capacità che concedono un altro attacco creano un figlio
con proprietario, bersaglio e concessione propri; il ritorno della capacità
pagata sopravvive allo scarto della copia. Una capacità opzionale non
supportata ha un gate specifico, non viene ignorata silenziosamente.
[W selezionato; R §§1/43/69/93/100; FAQ p.2; contratto61/P1b.]

Il [test fisico corrente](../../src/physical-resolution/front-runtime.ts)
possiede già rivelazioni, conversioni e figli, ma non un contesto d'attacco
con spesa degli slot; il
[programma dei fronti](../../src/physical-resolution/front-program.ts)
descrive anche modificatori di attacco senza offrirne ancora il consumer
ordinario. Un handler esistente per una prova generica non chiude queste
finestre. Le associazioni per identità, quantità dei colpi e capacità
particolari rimangono esclusivamente nel contratto privato.

## Contrattacco, conseguenze e Ombra

**E — Istruzione:** S1629 punta, in ordine, a dodici EnemyActivationModel.
A0ba5 filtra per MinGroupSize/MaxGroupSize **delle figure rimaste**, poi
A0ad6 seleziona uniformemente un indice con UnityEngine.Random.Range.
Sono12 candidati con due figure,11 con una; la voce esclusa a una figura
non va selezionata utilizzando la dimensione iniziale. Ogni voce conserva
valori danni/paure per size, chiave italiana, caratteristica per negare e
istruzione aggiuntiva quando presente. Tutte le dodici sono state seguite,
non un campione. Quattro hanno un'aggiunta fisica distinta; una raggiunge
un'acquisizione beneficio condizionata e quindi #57. Dettagli e mapping
sono privati. [S1699–1710; A0ba5/0d7d/3894/389a; MAIN selezionato.]

**E/I — Legalità e destinatario:** dopo i colpi controllare sopravvivenza,
Stordire, stato pronto/esaurito e distanza del **medesimo attaccante**.
Qui il nemico è normale e non a distanza: un gruppo esaurito non
contrattacca. Anche l'attacco gratuito conserva queste regole. La fonte
seleziona l'istruzione prima della domanda sulla distanza; conservare
selezione e motivo di mancata esecuzione. Nel digitale la distanza è
derivabile dalle posizioni: non accettare un “Sì/No” arbitrario come prova
di legalità. Un contrattacco eseguito esaurisce il gruppo; la provocazione
conserva la distinta regola di esaurimento. [A38e5:018b–024b;
A38a0:01d9–022e; A3894/389a:0345–0358; R §§21/35/71/74.]

**I — Conseguenza completa:** aprire il vero test per negare previsto
dall'istruzione scelta, allocare ciascun successo una sola volta a danno
o paura, consentire prevenzioni legali e poi risolvere le carte effettive.
L'eroe può lasciare successi inutilizzati. Conservare quanto è stato
realmente subito da quell'attacco per le condizioni successive; una carta
annidata ha la propria causa: il saldo delle carte rimaste nell'area e la
sola ascendenza del figlio non misurano quel risultato. Applicare aggiunte, reazioni e controlli P2
alle rispettive finestre, senza anticipare una barriera a metà fonte o
ritardare un obbligo già raggiunto dopo una nuova reazione. L'app mostra
importi e istruzioni aggiuntive: non sposta i mazzi fisici. [A389a:00cf–0344;
R §§12.8–12.9/22/54; contratto61; P1/P2.]

Riusare P2 per difficoltà per eroe, selezione conservata, prove, scoperte al
limite, titoli, sconfitta e perdita tipizzata. Un eroe sconfitto conserva
le carte ed esce dai normali bersagli/turni; il padre conserva il risultato
già acquisito e non gli offre un nuovo attacco. Con superstiti vale il
confine della prossima Ombra; senza superstiti quello immediato. Il
consumer originale della conclusione resta una capacità distinta, mai un
ACK terminale. [R §§24/29; FAQ p.2; A3902:00f3–012b;
[raccordo sconfitta](../../src/server/physical-defeat.ts);
[correzione del padre71](../testing/original-encounter-verification.md).]

**I:** interrompere nuove scelte, prove o attacchi del morto senza cancellare
gli effetti globali già entrati. La continuazione rimane quella del ramo
fonte: non riaprire la persona nascosta come se fosse un incontro ritentabile
e non sostituire una perdita terminale con un ritorno ordinario.

**E — Ordine:** il contrattacco appartiene al passo4 dell'attacco.
Le capacità “dopo l'attacco” si risolvono solo dopo quel passo; non possono
eliminarlo retroattivamente. Se una vera attivazione è interrotta da colpi,
la fonte sopprime il contrattacco di quell'interruzione e riprende con
l'istruzione interrotta, oppure termina se il gruppo è sconfitto/esaurito.
Non sorteggia da capo soltanto perché è cambiata la vista. [FAQ p.2;
A38a0:0029–0059; A387c:019a–0278/0329–0357.]

**E/I — Dopo la prova è un'altra finestra:** dopo il calcolo dei risultati
si scartano le carte rivelate e si risolvono gli effetti con quella
tempistica; non attendere automaticamente la fine dell'intero attacco.
Conservare il risultato e gli slot pagati mentre il figlio si risolve,
prima del passo4. Un eventuale beneficio o una sconfitta del figlio
richiedono il loro esito reale e il successivo controllo di legalità.
[R §§100.3–100.5/12; W selezionato; P1/P2.]

**E/I — Quando serve Ombra:** il combattimento può terminare in Azione,
ma il contratto non garantisce che bastino le azioni disponibili della
compagnia. Quando occorre un altro round, servono davvero attivazioni,
oscurità applicabile, ROUND_END/timer, minaccia e Riorganizzazione.
Non è lecito saltarli con i tre ACK legacy. Un gruppo già esaurito salta
l'attivazione, non l'intera Ombra. [R §§30/35/73/83; A3902.]

Per il solo gruppo raggiunto sono chiusi anche selezione e istruzione
d'attivazione, bersaglio attivo estratto dal packet filtro3, alternativa
per bersaglio irraggiungibile e ripresa. Il gruppo sceglie parità di
bersagli e percorsi legali sul movementGraph; l'app originale non conosce
le posizioni fisiche. Il timer riceve ROUND_END dopo attivazioni/oscurità
e prima del successivo aumento minaccia. Non spostare quel tick allo spawn.
[A0bbb/0b7c/0b84:005c–0087/0cb4; A388e/387c/3882;
A3902:02cc–03a8/050b–06a3; R §§30/60/83.]

**I — Casualità salvata:** separare mappa congelata, mescolate/coperte
fisiche, istruzioni nemiche, eventuale eroe d'attivazione e Ultimo Sforzo.
Per ogni decisione registrare fonte, popolazione ordinata eleggibile,
dimensione effettiva, indice/identità/hash e stato o risultato materializzato.
Il bersaglio del contrattacco non è un'estrazione d'eroe. Persistenza prima
della presentazione; retry/reload/restore e figli non ridisegnano le scelte.
Un RNG digitale versionato non certifica equivalenza della sequenza Unity.
[A0ad6/0cb4; P0/P2; ADR0002.]

## Rimozione e primo confine stabile

**E — Figura e gruppo:** la figura a salute0 viene rimossa; le figure
superstiti mantengono salute residua e recuperano le difese temporanee
secondo la fonte. Non assegnare ricompensa per ogni barra eliminata.
L'inserto ricompensa compare solo quando la salute del gruppo è0:
un'ispirazione all'attaccante oppure a un eroe vicino, entro il cap.
Serve una scelta/operazione fisica registrata, non il solo messaggio.
[A0c65/38e5; A38a0:005a–01d8; MAIN
`UI_ENEMY_DEFEATED_INSPIRATION_REMINDER`; R §§10/48.]

Il gruppo restituisce l'eventuale banner, esce dal tracker e da
EnemiesInPlay, poi consegna `DEFEATED` alla propria logica. Qui non esiste
un handler TRY_DEFEAT. IYieldable R28923 ha Fsm serializzato nullo:
Awake lo lega al PlayMakerFSM dello stesso GO; la coroutine aspetta il
processing corretto. La logica R24473 termina con FinishFSM;
HideThisNode sul GO2309 senza Node è un no-op, non la rimozione di un
altro segnalino. [A0c3e/38d3/38d9/1530/152d/11bc; componenti R2309.]

**E — Seguito chiuso:** R24473 entra nel messaggio e nell'unico AddLore1
in parallelo; rivela la sezione2; completa il successivo messaggio e
l'obiettivo; invia FINAL ESCAPE al solo timer, che smette di correre e
rilascia processing; infine la logica si ferma. Il premio Sapienza è
all'entry, non un secondo premio dopo la lettura. Non vengono trovati
indizi o conclusa l'avventura. [R24473.s3/2/6/4/5/1;
R20635.s9/3; A1251/3c47/12c3/3c5f/120f.]

La sezione2 realizzata contiene tre tessere e tre segnalini esplorazione.
La presentazione fonte riordina a ogni passo le tessere che toccano
quelle già visibili, usando **ConnectedSpaces fonte**, distinto dal
movementGraph; il caso di tre elementi usa gli scambi piccoli di mscorlib.
Ordine effettivo, confronti, pose, tre riferimenti Tile/ExploreNode e
richieste sono nel contratto privato. La rivelazione non esplora i nodi
né abilita le loro interazioni. [A38ac/3873; Msc692c/6929;
tre Tile L4 e rispettivi GameNode, verificati integralmente.]

**E — Differenza fra packet:** nell'annuncio dell'obiettivo il secondo
inserto è il letterale0; nel SetObjective è il binding globale degli
indizi, inizialmente3. Non sostituire entrambi con un campione o correggere
silenziosamente la fonte. Il salvataggio e la presentazione devono
conservare i rispettivi input; questo punto richiede disposizione esplicita
nella review implementativa, non una nuova domanda al proprietario.
[R24473.s4.a0/a1.Message.Inserts[1]; R19891;
A0b80/0b84/120f; IT `A1_M1_OBJECTIVE_2`.]

**E — Alternativa timer:** a scadenza, il ramo armato mostra la rimozione
e `EnemyGroupRemoveAll` libera tracker/banner e svuota **tutti** i gruppi
in gioco. Quest'azione non emette automaticamente DEFEATED: il SendEvent
successivo lo invia espressamente a GO2309/FSM. Se la persona non è stata
impegnata, il ramo visibile la nasconde e invia comunque quel callback.
Lo stesso seguito assegna la Sapienza, ma la fuga/rimozione non concede
l'ispirazione della sconfitta in attacco. Conservare la causa distinta.
[R20635.s4–7/11/13–14; A11ae; R24473.]

**I — Checkpoint d'uscita:** gruppo assente, eventuale ricompensa e
Sapienza applicate una volta, sezione2 visibile e inesplorata, obiettivo
persistito, timer fermo, logica stopped, persona nascosta, figli chiusi e
un solo ritorno al turno/viaggio oppure all'Ombra sospesa. Non trasformare
il ritorno dall'alternativa timer in un nuovo turno. Indizi e listener
119↔123 restano quelli già posseduti, senza eventi aggiunti.

## Incremento verticale proposto

Questo ordine è **I**: lavoro futuro, non modifiche presenti o test passati.
Conserva [ADR0003](../adr/0003-registro-ordinario-e-fonte-dell-incontro.md)
e l'origine immutabile round1/Azione del ledger originale.

| Ordine                 | Piccola interfaccia e uscita                                                                                                                                                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Contratti e gate    | Compiler privato con origini/hash per spawn, logica, challenge letterali, concessioni e dodici istruzioni. `combatCapability(source,company,state)` restituisce prerequisiti precisi prima di interazione, attacco o costo opzionale. Manifest versionato; i pack pubblicati mantengono i loro gate.                            |
| 2. Nemici              | Modulo `spawn/apply/activate/remove/view`: identità gruppo/figure, disponibilità, pose, barre, stato pronto e binding della logica. Nessuna scelta di importi o evento fonte dal client. Fixture inventate, confronto privato di questo solo modello.                                                                           |
| 3. Attacco e fisica    | `openAttack/answerAttack/result`: owner/hero/target, costo o concessione, oggetti/stat, finestre, carte vere, ledger successi, applicazione e contrattacco. L'adattatore fisico riceve istruzione e destinatario fonte e restituisce risultato solo dopo figli/P2. Estendere i contesti, non copiare un secondo motore di test. |
| 4. Scenario e registro | `resumeCombat(result)` restituisce alla precisa entry/azione. Collegare persona→spawn→obiettivo e sconfitta→logica→seguito; eventi indirizzati, timer e ricompense once-only. Nemici, casualità, risorse, carte, frame e receipt nella stessa Store.once; replay confronta anche tutte le nuove uscite.                         |
| 5. Ombra raggiunta     | Se il percorso attraversa il round: attivazione effettiva del gruppo, movimento/bersaglio, conseguenze, oscurità pertinente, timer e minaccia, poi vera Riorganizzazione. Soglie o rami ulteriori richiedono la loro closure prima dell'avanzamento. Nessuna generalizzazione a tutti i nemici.                                 |
| 6. UI a tre identità   | Dallo startup autentico dichiarato: ispezione/cancel, impegno, primo scontro, conseguenza, risultato fonte. Attaccante, possessore di un aiuto e destinatario sono distinti; guida, carte visibili quando legali, lettore, attese e focus. Autosave/ripresa/once a ogni richiesta; HTTP LAN senza `crypto.subtle`, come71/73.   |

**Gate inevitabili:** benefici57 senza quantità inventate; capacità
obbligatorie degli esiti e delle dodici istruzioni; handler d'attacco delle
persistenti fisiche; preparate e reazioni effettivamente disponibili;
posizione/riserva/costi/difficoltà; consumer Ombra o perdita quando
raggiunti. Non eliminare un candidato casuale per evitarne la dipendenza.
Neppure la variante normale esclude a priori un'acquisizione beneficio nel
successivo contrattacco. Può essere costruita e verificata la parte
indipendente, lasciando chiaro il gate prima dell'abilitazione che la richiede.
Un mazzo fisico realmente vuoto conserva diagnosi e continuazione alla
pesca esatta; nessuna carta fittizia, reshuffle o ignore. Non viene ripetuta
la richiesta già pendente al proprietario. [Contratto61; #57; S1699–1710;
P1/P2; [gate correnti](../../src/server/scenario.ts).]

| Criterio futuro            | Prova significativa richiesta                                                                                                                                                                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Legittimità e costo        | Actor estraneo, eroe sconfitto, turno/casella/range errati, oggetto non equipaggiato, concessione assente/usata, stale/cross-source: rifiuto senza spesa o pesca. Ispezione/cancel invarianti.                                                                                              |
| Successi e finestre        | Due slot uguali restano distinti; stesso slot ripetuto e simbolo riusato rifiutati. Zero colpi può contrattaccare. Sostituzione stat, Assalto, costo pagato e Scoperta figlia conservano le carte del padre e la continuazione; reazioni dopo attacco seguono il contrattacco.              |
| Nemici e casualità         | Figure2→1→0, salute residua, difese, Stordire/esaurimento, niente contrattacco fuori range. Tutti12 candidati a size2 e11 a size1; niente ridraw dopo restore né filtro del ramo beneficio.                                                                                                 |
| Conseguenze/P2             | Negazione e prevenzioni reali; aggiunte condizionate ai danni effettivamente subiti; figlio su altro eroe, carta annidata, perdita di preparata/limite, sconfitta con risultato padre conservato. Vuoto distinto da importo interamente prevenuto.                                          |
| Risultato fonte            | Una figura non assegna il premio di gruppo; nessun doppio premio dal testo. Callback unico, lore all'entry, tre piazzamenti nel loro ordine, packet0/globale3 distinti, timer non azzerato allo spawn, rimozione timer senza premio di combattimento.                                       |
| Durabilità e compatibilità | Retry/concorrenza, SIGKILL prima/dopo costo e callback; pending packless/restart/restore. Backup risignati con pose, salute, selezione, spesa, timer, ritorno o entrambe le cronologie alterati respinti. Conservare regole/run P0–P2, attivazione legacy, sentinel32 e vecchi pack.        |
| Tre telefoni logici        | Percorso nativo UI di tutti i proprietari, con precondizioni dichiarate; carte/reader/guida e320/768/1024/1440, HTTP non sicuro. Nessuna identità delle coperte in API/DOM/reader/log; backup amministrativo privato distinto. Quando servono altri round, prova della vera Ombra, non ACK. |

## Prove private e riproduzione

Il checker non importa builder del contratto, normalizer o runtime del
prodotto. Rilegge acquisizioni primarie, decoder C/Python e puntatori;
ricostruisce parametri e binding con un secondo decoder; ridecodifica IL,
testo, salti ed eccezioni; rilegge CSV italiani e le sole righe OOXML
selezionate. Le annotazioni semantiche delle carte restano una review
documentata, non un'autenticazione editoriale prodotta da un hash.

| Controllo statico E | Risultato                                                                                                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Input               | 33 acquisizioni bloccate, più8 file primari applicativi con hash/byte; fonti e copie altrui immutate. Helper copiati e adattati prima dell'esecuzione.                                                                                                 |
| Asset               | **43 oggetti /380.406 byte**, consumo completo C/Python e281 puntatori non nulli risolti. Nessuna scansione del corpus.                                                                                                                                |
| Binding             | Quattro FSM riletti;98 azioni normalizzate,6.994 record di parametri consumati,30 binding e15 rinomine posizionali verificati. Il sottoinsieme contrattuale è **46 stati /52 azioni**; il resto riusa il contratto principal.                          |
| Italiano e carte    | 69 chiavi effettive, due TextAsset noti; tre eroi, sei oggetti/sette copie,33 abilità/45 copie, sette slot di spesa. Originali e mapping soltanto privati.                                                                                             |
| IL                  | **104 corpi /19.687 byte di codice /7.208 istruzioni**,703 destinazioni di salto e5 regioni eccezione verificate da lettura fresca. Nessun metodo originale eseguito.                                                                                  |
| Negativi sui dati   | **16/16 alterazioni respinte**: quantità/punti/salute, concessione normale o su fallimento, limiti, candidato rimosso, negazione/importi, premio/timer/packet, ordine di rivelazione, azione/binding omessi. Non sono16 combattimenti o test gameplay. |

`README.private.md` contiene i percorsi primari esatti e l'elenco esplicito
di oggetti e MethodDef. `source-lock.json`/`primary-files.json` bloccano
gli input; `cards.private.json` e `contract.private.json` sono i contratti
riusabili; `verification.json` conserva i risultati; `manifest.json`
sigilla byte e SHA256 di script, input e prove, escludendo solo cache Swift
e metadati della consegna. Il rapporto pubblico non contiene IR o un pack eseguibile.
Il sigillo comprende **236 file /127.326.674 byte** e ricontrolla le41
righe fonte; SHA256 del manifest:
`b9fe2063f8d8f3bade8211d321c5164d5970859b57e837b569561347267c6bc7`.
Il rapporto e il suo receipt finale sono esterni al sigillo per evitare
un riferimento circolare; il receipt lega il digest del rapporto al commit.

Dal checkout assegnato, senza installazioni o host:

```sh
AUDIT_PY=/Users/silvioceccarini/.t3/projects/lotr-interactive-table-game/.scratch/unity-audit-venv/bin/python
PYTHONDONTWRITEBYTECODE=1 "$AUDIT_PY" .scratch/first-combat/check.py
python3 .scratch/first-combat/verify-manifest.py
/Users/silvioceccarini/.t3/projects/lotr-interactive-table-game/node_modules/.bin/prettier --check docs/research/first-combat-runtime-contract.md
git diff --check
```

La rigenerazione delle sole acquisizioni e annotazioni, in una copia della
propria scratch con output adattati, è descritta nel README privato; non
eseguire helper altrui con output nelle loro directory. I checker si possono
ripetere senza avviare gioco o riscrivere le prove sigillate.

**U — Limiti:** nessuna parità osservata Unity/JIT o RNG, nessuna nuova QA
UI/gameplay, nessuna copertura degli altri nemici, delle interazioni della
sezione2 o dei restanti rami A1. #33/#65/#57 rimangono aperte. Il prossimo
confine concreto è compiler/capability gate e consumer del primo attacco,
poi il suo collegamento alla persona e al seguito sopra; il root possiede
review, integrazione e apertura dell'implementazione.

[manuale]: https://cdn.svc.asmodee.net/production-asmodeeit/uploads/2022/09/Viaggi_nella_Terra_di_Mezzo.pdf
[regole]: https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf
[faq]: https://cdn.svc.asmodee.net/production-asmodeeit/uploads/2022/09/jme_faq_ita.pdf
