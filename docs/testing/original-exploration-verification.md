# Esplorazione originale — verifica #73

Base `821f9d5914877df999e4e276526c8e5edeef7d90`, schema 15,
baseline 526. Specifica/piano committati in `4c6dcad`, prima del codice.
Codice finale: `4b20d7c030d77342cd7b3548dcfd85a8e1f142c1`.
Il percorso originale è su `c32590c17965a2e0d8154c89f46eada2f7fd3674`;
l'unica differenza successiva in `src` è il testo della mappa a turni conclusi,
riverificato separatamente come descritto sotto. Il perimetro comprende
le due tessere visibili richieste, i loro ingressi di reveal e il ritorno
al viaggio. Review Standards/Spec e integrazione restano al root;
nessuna scrittura GitHub, push, PR o chiusura issue dal child.

La [specifica](../planning/original-exploration-spec.md) e il
[piano](../planning/original-exploration-plan.md) fissano i criteri.
I [metadati](original-exploration-verification.json) riportano SHA,
conteggi e sigilli. Originali, testi, carte, immagini, mapping e IR/FSM/IL
sono soltanto nella scratch ignorata `.scratch/exploration/`, anche rispetto
alla storia Git. Le fixture pubbliche sono inventate.

## Ingresso, costo e ritorno

La UI permette di scegliere una casella visibile adiacente inesplorata e
leggere la conferma del template. Annullamento/Escape non cambiano neppure
la revisione. La conferma registra il movimento e apre l'esplorazione:
un movimento del viaggio già pagato, zero azioni interazione aggiuntive.
L'eroe rimane nella casella raggiunta. È l'adattamento digitale del
[Compendio, §37.3–37.5](https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf#page=15),
con la conferma/cancellazione effettiva di R19941/R27232.

Il comando `EXPLORE_SCENARIO` è distinto dall'interazione. Prima del costo
controlla fonte/realizzazione, proprietario, turno, posizione, collegamento,
visibilità, budget e closure di reveal. Durante intro, piazzamenti e outro
il viaggio è sospeso. L'ispirazione va all'esploratore, entro il suo limite;
il partecipante che legge un segnalino non ne diventa destinatario.

Il manifest opzionale `source-exploration-v1` certifica template, tessere,
alternative d'introduzione e receiver. La scelta del flavor ha entropia
persistita separata dalla mappa. PRE_REVEAL/REVEALED seguono l'ordine Spaces,
con processing/release reali, senza usare spawn order o soli eventi dichiarati.
La rimozione del segnalino, il premio e il ritorno avvengono una volta.

Il principal A1 non ha l'handler globale pertinente all'evento adiacente:
non si apre una nuova sezione per deduzione. Il controllo è confrontato
con la coroutine A06003888 e il principal effettivo; non è un'esenzione.
Una fixture inventata con vero handler verifica assegnazione della sezione,
piazzamenti, attesa e release prima del ritorno, senza hardcode sezione+1.

I reveal109/75 completano messaggio, release e attesa. Le loro interazioni
rimangono ispezionabili e gated prima dei costi, anche con fingerprint valido.
Il listener nascosto resta tale; etichette narrative non assegnano oggetti,
titoli, prove o risultati.

## Ledger e compatibilità

Il ledger originale ricostruisce ingresso, attore/eroe, pose, azioni/movimenti,
selezione flavor, premio effettivo/capped, frame, eventi/receiver e ritorno.
Il premio è un run di risorse fisiche legato al cursore ExploreTile effettivo,
così i contesti delle successive conseguenze rimangono continui.
Stato e receipt passano nella stessa `Store.once`; retry/concorrenza e
riavvio non duplicano costi, casualità, eventi o premi.

Il seed resta round1/Azione dopo lo startup. Freeze, geometria, coordinate,
RNG mappa e sei completamenti iniziali restano invariati. Replay canonico
e cache confrontano tutti gli output persistiti, senza esenzioni.

Lo schema rimane15 con capacità nuova opzionale e versionata nel pack.
**I pack già congelati senza questa capacità mantengono il loro gate**:
il nuovo file su disco non amplia retroattivamente un salvataggio. Non sono
reinterpretati run P0/P1a/P1b/P2, attivazione P2 legacy, regole per run,
sentinel32, proprietà del tipo, reentrance, titoli o limiti storici.

La verifica privata rilegge **109 backup**: 43 P2 pubblicati più1 freeze,
50 backup UI finali71 e15 backup della QA root71, incluse copie/precondizioni.
Tutti i campi gameplay e tutte le ricevute sono confrontati, ammettendo solo
la migrazione della versione schema dove necessaria. Gli 11 P2 inediti
invalidati prima di PR70 sono esclusi.

Fingerprint delle esplorazioni e degli incontri calcolati dall'host nella
vista derivata, esclusi da stato e backup. La UI funziona sul normale HTTP
senza `crypto.subtle`; proprietà, revisione e fonte restano autorevoli.

## Prove e loro autorità

| Livello                    | Risultato e limite                                                                                                                                                                                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Suite pubblica             | **540/540**, zero fail/skip/todo; typecheck, formato e diff verdi. Nessun test soppresso o criterio ridotto.                                                                                                                                                                                            |
| Interface e HTTP/SQLite    | Conferma/cancel, ownership/pose/adiacenza/visibilità/turno/budget/stale/cross-source, due esplorazioni, ordine nodi/receiver, reward capped/no-op, ritorno e movimento residuo, replay respinto e interazioni non chiuse gated con fonte valida.                                                        |
| Atomicità/recupero         | Concorrenza/retry; SIGKILL prima/dopo commit all'ingresso e al reward; pending packless/restart/restore; payload risignati con storie/ricevute eliminate o pose, premi, eventi, costi, cursori e return alterati.                                                                                       |
| Fonte privata indipendente | 10 stati / 9 azioni del solo template e dei due reveal, inclusi gli stati d'attesa;8 oggetti / 38.568 byte,18 input bloccati, effectiveParams/binding e IL riusati. Verifica anche le due estrazioni flavor persistite nel vero export UI. Non è esecuzione Unity/JIT.                                  |
| Pack originale             | 31 definizioni / 88 stati / 63 azioni complessivi, inclusi startup e incontro precedente; due tessere esplorabili, un prefab interattivo. Nessun audit generale rifatto.                                                                                                                                |
| UI originale               | Tre contesti/posti indipendenti, carte/mappa/pack autentici; due esplorazioni da due eroi, entrambi i reveal, gate ispezionati dagli altri posti, residui utilizzati e tre turni conclusi.33 backup del percorso convalidati, più confronto integrale dopo il ripristino66 per la correzione del testo. |

La ricompensa capped è esercitata negli automatici. Nei percorsi originali
UI i due premi effettivi sono 1 e 1; non si attribuisce al browser un caso capped
o P2 che non ha raggiunto. Le carte fisiche e i loro mazzi restano invariati
in questa QA di esplorazione. Il primo incontro rimane intatto nel percorso
UI; la sua regressione è coperta dalla suite e dai backup71.

## QA originale e catture finali

Precondizione dichiarata: freeze autentico importato via filepicker, startup
giocato dalla UI con due servizi per eroe e relativo export37. Dopo la
correzione descritta sotto, quell'export legittimo è stato importato dalla
UI e il percorso di esplorazione ripetuto sul codice finale, da revisione38.
Nessun counter preparato, scrittura HTTP/SQL ausiliaria o comando debug:
azioni native Input/focus/filepicker, Node GET soltanto per osservare.

Primo eroe: viaggio e movimento, secondo viaggio, cancel gratuito42,
ingresso43 con residuo2. Export UI, SIGKILL e restart senza i quattro pack:
payload identico. Restore del pending tramite filepicker44 conserva tutti
i campi gameplay e le ricevute, salvo generation/revision/updatedAt.
IntroACK45 assegna il premio, revealACK46 rilascia il nodo, outroACK47
ritorna una volta. Ispezione gated da un altro posto, residuo48, fine turno49.

Secondo eroe: viaggio, attraversamento della prima tessera, secondo cancel
gratuito e ingresso55 con residuo1. IntroACK56 assegna il secondo premio e
apre il reveal. Un altro SIGKILL/restart packless56 conserva l'intero payload,
premi inclusi. ACK57/outro58, ispezione gated dal terzo posto, residuo59,
fine turno60. Terzo eroe: viaggio nelle tessere già esplorate, fine turno65.
Export finale65 dalla UI. Nessun passaggio fittizio in Ombra.

Screenshot finali a **320/768/1024/1440**, intro, secondo reveal, mappe e
turni conclusi:17 catture, nessun overflow, pulsante Continua 48 px e status focalizzato;
responsabile, costo/residui e guida coerenti. Tre contesti su IPv4HTTP dello
stesso Mac con `isSecureContext=false` e `crypto.subtle` assente.
Tutti i 26 asset configurati rispondono GET 200. La finestra del percorso originale
non ha eccezioni JavaScript né 404; sette ERR_CONNECTION_REFUSED sono classificati
sui due SIGKILL iniettati. Non si dichiara un contatore Network.loadingFailed,
evento non sottoscritto dall'osservatore.

Un tentativo di cattura del lettore ha riprodotto l'intermittenza nativa di
focus già nota71/P2: lettore aperto, focus catturato sul comando guida.
Tentativo conservato, nessuna ripetizione infinita o modifica del prodotto.
Un unico focus DOM esplicito successivo ed Escape sono riusciti; le catture
separate dichiarano soltanto i controlli realmente eseguiti.

L'ispezione finale ha trovato un suggerimento preesistente della mappa che
invitava ad aprire un turno dopo che tutti gli eroi avevano concluso. La guida
già conservava il prossimo passo corretto. Il test del rendering riproduce
il messaggio errato in RED; `4b20d7c` lo sostituisce con turni conclusi e
rimando alla guida. Nessun altro file `src` differisce dal percorso originale.
Le cinque catture precedenti dei turni conclusi sono conservate ma superate
per questo testo. Il loro stato di gioco resta una prova valida del ledger.

Per rifare il controllo interessato sul codice finale, l'export UI65
immutato è stato importato via filepicker, arrivando a66; i tre posti sono
stati recuperati dai form in tre nuovi contesti indipendenti. Confrontati
tutti i campi gameplay e le ricevute, salvo generation/revision/updatedAt.
Nuove catture dei quattro viewport e della mappa verificano testo e focus.
Il primo tentativo si era fermato sulla richiesta di recupero del posto dopo
il restore: log e artefatti conservati, nessuna transizione di gioco aggiunta.
Questa finestra separata registra 132 risposte 200, zero eccezioni JS e un 404
del favicon preesistente, distinto dai 26 asset configurati.

La regressione RED→GREEN `4902812` corregge la provenienza del premio:
prima il run fisico usava stato/entry/azione segnaposto, ora usa il cursore
effettivo e i parametri fonte. Le vecchie catture e i relativi salvataggi
di esplorazione sono conservati e classificati in `pre-cursor-fix/`, esclusi
dalla verifica finale. Il percorso interessato è stato ripetuto, senza
modificare i vecchi artefatti per farli passare.

## Riproduzione e confini

Con le dipendenze già disponibili:

```
npm test
npm run typecheck
npm run format:check
git diff --check
```

La README privata descrive compiler/checker, source-lock, precondizioni,
esecuzione nativa, export e manifesti. Host 4369, profilo/dati propri;
host, osservatore e Chrome dedicato chiusi, soltanto PID propri segnalati.
Nessuna cancellazione di dati per liberare spazio.

È registrata una deviazione di inventario: una ricerca iniziale di soli nomi
aveva come radice l'intera scratch del progetto per localizzare i PDF.
Non sono stati aperti contenuti del tavolo4339 né usati i suoi servizi,
SQL o processi; non si afferma assenza di enumerazione di nomi/metadata
sotto quella radice. Le letture successive sono state delimitate ai primari.

Restano fuori: interazioni109/75,119↔123, combattimento/Ombra, esiti/campo/
avventura2 e chiusure33/65/57. Quantità benefici 5/5/5 non confermate e mazzi
realmente vuoti mantengono diagnosi/continuazione, senza carte false,
reshuffle o domande ripetute al proprietario. Nessuna certificazione di
telefono reale, LAN remota, Windows, Safari, Unity/JIT o partita completa.
