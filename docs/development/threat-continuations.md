# Soglie successive e perdita per minaccia — #96

Implementazione personale di [#96](https://github.com/Ic3b3rg/lotr-table-game/issues/96)
sulla base `9cdba43`, dopo PR95. [Specifica e piano](../planning/threat-continuations-spec.md)
precedono il codice; glossario, ADR2–3 e baseline di fedeltà restano il contratto.
Review Standards/Spec e integrazione spettano al root.

## Capacità e ciclo reale

`source-threat-continuations-v1` è una capacità facoltativa congelata prima
dello startup. Il compiler attesta separatamente spawn/registrazione,
conseguenza fisica per eroe, oscurità/spawn/registrazione e spawn terminale:
owner, receiver, definizioni complete, binding, aritmetica, filtri, budget,
popolazione e metodi del controller devono concordare. Il certificato storico
mantiene i propri rifiuti; il seguito prima indisponibile richiede il nuovo
attestato corrispondente, senza allargamenti per intervalli di stati/azioni.

Il percorso usa FSM, deployment, controller fisico, Ombra e ledger esistenti.
La conseguenza del primo nuovo messaggio risolve l'ordine scelto dal gruppo,
una prova per negare per ciascun eroe e il subito effettivo prima del
deployment. Il figlio tipizzato riusa la primitiva ordinata e il consumer di
subire: non trasforma la negazione in una prova binaria e non attribuisce
l'effetto all'oscurità.

Il controller aumenta la minaccia dopo la conferma. Ordina le soglie come
attestato, attende messaggio, figli e collocazioni, registra l'eventuale
seguito, rimuove il solo receiver completato e riscorre la lista viva.
Anche un callback appena registrato può essere raggiunto nello stesso
aumento; una registrazione duplicata non crea un secondo evento.
Ogni spawn ricalcola il proprio budget e usa le figure vive disponibili,
con popolazione e residuo distinti. I nuovi gruppi attendono la prossima Ombra.

L'oscurità globale cambia prima del messaggio e dello spawn della seconda
forma. La fase di oscurità già conclusa non viene ripetuta. Prossime finestre
fisiche, combattimento e incontri dei nuovi pack condividono il valore;
caselle, segnalini e override conservano i propri significati e gate.

## Termine e preflight

La perdita iniziale segue la priorità della sconfitta eroe e precede ogni
effetto dell'Ombra. Dopo un aumento, tutte le soglie raggiunte ritornano
prima del controllo del limite; raggiungerlo o superarlo non elimina gli
spawn. Il termine precede refresh, ricomposizione e Riorganizzazione.

La conclusione91 riceve una causa tipizzata di minaccia, con prima/dopo,
limite, frame e controller. Non vengono inventati eroe, run o Ultimo Sforzo.
Una sconfitta durante il padre fisico conserva la propria priorità e i
ritorni della fonte: con superstiti il padre termina; senza superstiti
rimane sospeso nella conclusione immediata. Premi, destinazione, racconto
e primo campo usano lo stesso ledger e vengono applicati una volta.

Il preflight dell'intera continuazione precede RNG, carte, movimento, tick
e aumento. Riconosce anche una vera conclusione terminale, senza forzare
reset o ROUND_START. Nei nuovi pack la disponibilità mostrata dalla UI
controlla questa stessa continuazione. Benefici ignoti, terreno, logiche,
incontri, vittoria e altri rami non compilati mantengono le diagnosi prima
dei costi.

Schema18 aggiunge capacità, causa e confini nuovi. La migrazione17→18 è
soltanto strutturale; formati precedenti rifiutano le nuove forme. I pack
storici conservano struttura, impronta, origine e gate. Nessuna capacità
o copia fisica viene ricostruita nei salvataggi precedenti.

## Fonti e verifiche

Le tre FSM R25917/R25174/R27029 sono lette integralmente da due reader
concordi: 12 stati, 15 azioni, 31.280 byte. Owner, receiver e modello del
limite portano il controllo a 10 oggetti/32.065 byte; il TextAsset bounded
aggiunge 364.560 byte. Puntatori e salti sono validi. Sono ricatturati
35 corpi IL, 9.001 byte codice e 3.131 istruzioni, compreso l'owner PlayMaker.
L'oracle indipendente confronta parametri, binding, conseguenza testuale,
ordine e tutti i 15 output; la ricompilazione produce tre file identici.
Il pack statico risultante contiene 37 definizioni, 208 stati, 207 azioni
e 42 confini differiti. Nessuna esecuzione Unity/JIT o parità RNG dichiarata.

Tredici test nuovi coprono forme/certificati, soglia esatta, callback multipli
e duplicati, cap/superamento, priorità eroe, oscurità condivisa, disponibilità,
budget/residui, dipendenze tardive, attori, stale, concorrenza e padre sospeso.
Otto SIGKILL e otto restore packless confrontano l'intero payload e tutte le
ricevute, con sole differenze amministrative dichiarate per il restore.
Undici alterazioni risignate sono respinte dal validator; un rifiuto HTTP
e due rifiuti nativi confermati conservano l'intero stato.

La UI sintetica percorre startup, turni, soglie, negazione, collocazioni,
oscurità, perdita, premi, mappa, racconto e campo con tre identità.
156 combinazioni sul percorso e 12 verifiche supplementari di sola lettura
coprono 320/768/1024/1440, tastiera/focus, guida e lettore: 504 PNG.
HTTP IPv4 esercita l'assenza di crypto.subtle. L'export corrente è confrontato
integralmente, tre cambi ruolo conservano XP/Sapienza e il file esatto viene
ripristinato da input nativo. I tentativi del driver falliti sono separati
dalle prove positive; non viene dichiarata assenza di errori HTTP intenzionali.

La suite canonica finale `npm test`, separata da QA e validator pesanti,
passa 704/704 test (691 di base e 13 nuovi), zero fail/skip/cancellazioni,
in 468,489 secondi, con `--test-concurrency=4` invariato. Passano anche
typecheck, Prettier e diff check. La verifica privacy confronta 260 stringhe
fonte con diff, nuovi file pubblici e tutta la nuova storia: zero corrispondenze.

Il validator è ricostruito dal codice finale: 503 file ricevuti confrontati
integralmente una volta ciascuno, comprendendo tutti i 485 autorizzati,
i 17 snapshot94 e l'export94; 398 payload distinti senza contare copie come
nuove prove indipendenti. Tutte le 17 viste pubbliche94 sono confrontate
integralmente. Replay sempre eseguito, nessuna esenzione, nessuna mossa sui
salvataggi ricevuti. Le sole differenze sono le migrazioni strutturali
dichiarate. Altri 18 snapshot propri e le rispettive 18 viste complete,
l'export nativo e il suo restore finale passano il medesimo validator.

## Limiti e consegna

Tutti i dati positivi sono inventati: identità, soglie, importi, caratteristica,
destinazione, premi e disponibilità nemiche. Il confronto statico con le
fonti originali è separato. La quantità57 originale resta null/non verificata;
il checkpoint156 conserva il blocco prima dell'Ombra e l'intero payload.
Nessuna nuova partita originale, prosecuzione di quel checkpoint o accettazione
originale89/33. Vittoria/covo, altri incontri/terreni, campo completo e A2
restano lavori successivi; 33/65/57/89 non vengono chiuse.

Originali, narrativa, mapping, IR/IL, immagini, identità e salvataggi restano
nella scratch ignorata anche nella storia Git. Input/byte/hash, comandi,
tentativi e limiti sono in `.scratch/threat96/README.private.md`;
sigillo `.scratch/threat96/evidence-lock.json`.
Solo vendor già presente e checkout assegnato; nessuna installazione, altro
agente/checkout, scrittura GitHub, push o PR. Host, browser e contesti propri
sono chiusi e verificati. Nessun accesso alle superfici protette.

## Integrazione root

Review Standards/Spec indipendenti completate. Un difetto comune(P2 Standards,
P1 Spec) è corretto: la nuova conseguenza collettiva risolve tutti i superstiti
anche con slot0 già sconfitto, esclude destinatari sconfitti e mantiene un
chooser valido dopo i discendenti. Regressione RED→GREEN sui due slot e
suite completa finale **705/705**, zero skip/fail; typecheck/formato/diff verdi.

Il root riproduce fonti/oracle e tre output identici, riconvalida503 file con
398 payload distinti e17 viste94, altri18 snapshot/viste, export e restore
finale. Privacy della nuova storia260/0. Il limite analogo del precedente
`group-test`, già nella base, richiede un seguito versionato per preservare
i pack congelati: resta esplicito e prioritario. Nessuna accettazione originale
89/33 o quantità57 verificate. [Review e prove root](../reviews/2026-11-05-threat-continuations.md).
