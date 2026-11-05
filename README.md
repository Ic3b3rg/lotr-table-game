<img src="assets/icon.svg" width="64" height="64" alt="">

# Viaggi · tavolo locale

Versione digitale personale di Viaggi nella Terra di Mezzo, in sviluppo. Il tavolo sul PC accoglie i telefoni via QR, conserva la compagnia e permette turni e fasi persistenti, mappa e viaggio interrompibile, interazioni con prova, fato, ispirazione e Scoperta con carte preparate e mazzi ordinati. Generazione della mappa completa, capacità delle carte, combattimento e campagna giocabile seguono nei prossimi incrementi. [Accettazione della partita completa a tre](https://github.com/Ic3b3rg/lotr-table-game/issues/33).

## Preparazione iniziale

Su macOS o Windows installare Node.js **24 LTS, almeno 24.11.1 e inferiore a 25**, quindi aprire un terminale nella cartella del progetto:

```sh
npm ci --ignore-scripts
npm run build
```

Questa preparazione richiede Internet per scaricare le dipendenze. Ripeterla dopo un aggiornamento del codice; il funzionamento del tavolo già preparato è locale.

## Aprire il tavolo

```sh
npm start
```

In alternativa usare **Avvia tavolo.command** su Mac o **Avvia tavolo.cmd** su Windows. Aprire sul PC [il tavolo](http://127.0.0.1:4317), collegare i telefoni alla stessa Wi-Fi e scansionare il QR con la fotocamera del telefono. La vista condivisa non occupa un posto; per partecipare dal PC usare il relativo collegamento.

Tenere aperto il processo host; Ctrl+C lo arresta. Nessun download, login o connessione Internet serve durante l'uso. La prima autorizzazione del firewall deve consentire l'accesso sulla rete locale.

Ogni modifica accettata viene salvata automaticamente sul PC. Alla riapertura si ritrova il tavolo. Durante l'ingresso viene mostrato un codice personale: conservarlo per riprendere il posto da un altro telefono o se si cancellano i cookie. Lo stesso browser ricorda l'accesso; usare lo stesso indirizzo del PC. Il nome da solo non permette di prendere il posto di un altro giocatore.

I dati sono separati dal progetto: su Mac in `~/Library/Application Support/LotrTavolo`, su Windows in `%LOCALAPPDATA%\LotrTavolo`, su Linux in `$XDG_DATA_HOME/lotr-tavolo` o `~/.local/share/lotr-tavolo`. `LOTR_DATA_DIR` consente una cartella diversa. Non cancellarla per aggiornare il programma.

Da **Una copia del tavolo** si esporta un file JSON e si può ripristinarlo anche su un altro PC. Controllare il riepilogo e confermare: il ripristino sostituisce il tavolo corrente e richiede ai giocatori di recuperare il posto con il loro codice. Una copia non valida viene rifiutata senza sostituzione. Sul PC è possibile ripristinare anche un tavolo vuoto dalla vista `127.0.0.1`; dai telefoni occorre essere entrati nella sessione.

La sezione **Prova il collegamento** serve solo a verificare una scelta condivisa: il gruppo si accorda su un segnale e una persona lo conferma. Non è ancora un'avventura né il motore delle regole.

Se ci sono più indirizzi, scegliere quello della Wi-Fi/Ethernet condivisa con i telefoni. Le reti ospiti possono impedire la comunicazione tra dispositivi. Per cambiare porta impostare `LOTR_PORT`; `LOTR_BIND` seleziona l'indirizzo di ascolto (predefinito `0.0.0.0`, tutte le interfacce IPv4).

## Cominciare insieme

Il percorso guidato mostra il passo attuale e chi deve agire:

1. Ognuno entra con il proprio nome dalla vista personale e conserva il codice.
2. Un partecipante conferma quanti giocatori aspettare. Attendete tutti i posti previsti.
3. Ognuno salva il proprio eroe; controllate ruolo e oggetti con **Configura**. In solitario scegliete da due a quattro eroi.
4. Concordate le scelte e preparate insieme i mazzi. Gli eroi diventano fissi.
5. Un partecipante conferma la collocazione nel tratto di mappa disponibile.
6. Iniziate il round, concordate l’ordine e gestite ciascun turno dalla vista del proprietario.

**Guida al tavolo** resta nell’intestazione su PC e telefono: istruzioni, ricerca per argomento, regole dei comandi e limiti della versione. **Mostra tutti gli strumenti** apre catalogo, backup e strumenti secondari; **Torna al percorso guidato** riprende il passo reale senza cambiare il gioco. Le scelte locali non salvate restano nel modulo quando un compagno aggiorna il tavolo.

Per rendere consultabili i documenti originali offline, copiare nella sottocartella `rules` dei dati i quattro PDF forniti, con questi nomi:

- `manuale-gioco-it.pdf`
- `rules-reference-en.pdf`
- `faq-errata-it-2.0.pdf`
- `carte-corrette-it.pdf`

In alternativa indicare la cartella con `LOTR_RULES_DIR`, per esempio `LOTR_RULES_DIR="$PWD/.scratch/materials" npm start` su macOS. In PowerShell impostare `$env:LOTR_RULES_DIR` al percorso assoluto prima di `npm start`. Sono ammessi solo questi nomi, file PDF nella cartella e fino a 64 MB ciascuno. La guida riassuntiva funziona anche senza PDF; quelli mancanti sono indicati. I materiali originali restano privati.

Le prove mostrano la pesca già salvata dal PC, con successi e fato. Non si lanciano dadi. Convertire fato, ricaricare o recuperare il posto conserva la stessa pesca; movimento ridotto evita l’animazione.

## Carte e preparazione della compagnia

I contenuti reali si installano tramite un pacchetto privato: `catalog.json` e, facoltativamente, una cartella `assets/` accanto al file. Non sono distribuiti in questa repository. Copiare questi elementi nella cartella dati indicata sopra, oppure impostare `LOTR_CONTENT_PACK` al percorso del catalogo. Senza pacchetto la lobby funziona e segnala che le carte sono assenti.

Per usare il pacchetto privato già preparato in questo worktree, su macOS:

```sh
LOTR_CONTENT_PACK="$PWD/.scratch/private-content/catalog.json" LOTR_DATA_DIR="$PWD/.scratch/user-table" LOTR_PORT=4321 npm start
```

Su Windows, dopo aver copiato il pacchetto privato nello stesso percorso relativo, da PowerShell:

```powershell
$env:LOTR_CONTENT_PACK = (Resolve-Path .scratch/private-content/catalog.json).Path
$env:LOTR_DATA_DIR = "$PWD/.scratch/user-table"
$env:LOTR_PORT = "4321"
npm start
```

Aprire [il tavolo della compagnia](http://127.0.0.1:4321). Il percorso dati distinto conserva questa sessione separatamente dalle prove tecniche.

Dal percorso guidato, entrare al tavolo e scegliere i propri eroi: da due a quattro in solitario, uno per persona con due–cinque partecipanti. Ruoli e oggetti suggeriti sono modificabili; le copie già assegnate restano riservate. I limiti individuali dell'eroe, le mani, l'armatura e il rango iniziale vengono controllati dall'host. Il PC condiviso può consultare tutte le schede senza entrare.

Quando il gruppo ha concordato le scelte, **Prepara i mazzi della compagnia** assegna quindici carte per eroe: ruolo 1 preparato e quattordici carte coperte. La composizione è consultabile; l'ordine coperto resta salvato sull'host. Dopo la conferma la compagnia è fissata e si recuperano soltanto i posti esistenti. Nel percorso tecnico precedente le prove standard sono disponibili subito sotto. Con il generatore A1 configurato, il passo successivo è la creazione della mappa e i comandi di gioco attendono lo startup.

Le schede distinguono originale italiano, traduzione e verifica incompleta. Il pacchetto attuale comprende sei eroi, sei ruoli, 74 definizioni abilità e 78 oggetti; quattro testi conservano una candidatura esplicita, compreso Guardian 1 di provenienza `Custom`. Non certifica l'intera scatola o gli effetti del futuro motore. [Metadati e limiti verificati](docs/testing/party-content-metadata.json).

Il primo catalogo acquisito viene congelato nel salvataggio. Modificare il file di input non riscrive una partita esistente. Il backup include testi, copie e ordine esatti; le immagini sono opzionali e si reinstallano separatamente. I vecchi salvataggi e backup negli schemi da 1 a 10 vengono migrati allo schema 11, conservando compagnia, ordine dei mazzi, prove, Scoperta, generazione della mappa, scenario e ricevute. I salvataggi anteriori allo schema 5 mantengono i round disattivati finché il gruppo non li avvia; i round già attivi vengono conservati. Per tornare al software precedente serve una copia conservata prima della migrazione: il vecchio host non legge lo schema 11. Il numero di giocatori resta non configurato solo per gli stati anteriori allo schema 7; i gruppi già configurati sono conservati. Una Scoperta 2 già aperta viene conclusa con le carte salvate: non viene ripescata durante l’aggiornamento. Le vecchie mappe e le richieste aperte restano nel percorso precedente; non vengono trasformate in un avvio A1 o fisico completato.

## Creazione della mappa A1

Il generatore usa un pacchetto privato verificato per lo stesso catalogo:
`map-generator.json` nella cartella dati, oppure il percorso indicato da
`LOTR_GENERATOR_PACK`. Il pacchetto non è distribuito nella repository;
[formato, prove e riproduzione](docs/testing/map-freeze-verification.md).

Dopo la preparazione un partecipante conferma **Crea la mappa**. Il PC salva la
richiesta e lavora mantenendo disponibili le viste dei giocatori. Una ricerca
interrotta può essere ripresa dalla vista personale: prima del risultato serve
lo stesso materiale iniziale. Dopo il salvataggio, reload, riavvio e backup
riusano la stessa mappa anche senza il pacchetto, conservando incontri e storia.

Il risultato conserva la realizzazione completa. Il passo successivo avvia il
copione usando questa mappa e conserva il generatore e il suo RNG invariati.

## Avvio della prima avventura

Installare il pacchetto privato `scenario.json` nella cartella dati o indicarlo
con `LOTR_SCENARIO_PACK`. Il materiale deve certificare i prefab effettivi della
mappa: un prefab o un effetto non supportato impedisce l'avvio. Il compiler di
sviluppo è esportato da `dist/scenario-library.mjs`; [contratto, provenienza e
prove riproducibili](docs/testing/first-adventure-start-verification.md).

Da **La mappa è salvata**, il gruppo concorda **Avvia l’avventura**. Seguite
l'introduzione e i piazzamenti italiani. Ogni proprietario conclude Scoperta 2
e Spirito 1 per il proprio eroe, con carte, conversioni ed esiti salvati.
L'avvio non usa azioni del turno. Dopo l'obiettivo iniziale, una sola conferma
apre la Fase di Azione; il proprietario dell'eroe scelto avvia il primo turno.
Guida e copie della sessione restano disponibili durante ogni richiesta.

La mappa mostra le tessere rivelate dal copione e distingue quelle ancora da
esplorare. Potete viaggiare fra caselle adiacenti già esplorate. Ispezionare un
segnalino e chiudere l'ispezione è gratuito; interazioni successive, nuove
esplorazioni, combattimento e Ombra attendono i loro effetti completi.
Il guadagno obbligatorio della carta iniziale Cacciatore è registrato una sola
volta; le altre capacità delle carte richiedono i rispettivi incrementi.
Una preparazione che richiede un effetto fisico non disponibile viene rifiutata
prima di cambiare le carte.

Dopo l'avvio il salvataggio e il backup includono il pacchetto scenario e la
richiesta corrente: reload, riavvio e ripristino funzionano anche senza i file
originali o il pacchetto su disco. Le immagini opzionali si reinstallano
separatamente. Questo incremento arriva al primo turno; l'intera avventura
resta nel perimetro di #33. Le sessioni precedenti conservano il percorso
dimostrativo descritto sotto, comprese le sue conferme manuali dell'Ombra.

## Covo e primo campo nei nuovi avvii

Un pacchetto privato che comprende l’interazione certificata del covo permette
ora di cercare il passaggio e raggiungere la vittoria e il primo campo.
Questa capacità deve essere presente prima di avviare l’avventura: sostituire
un file sul PC conserva il blocco di una partita già iniziata.

Con l’eroe di turno nella casella del covo, ispezionate il segnalino.
Chiudere l’ispezione è gratuito; confermare consuma un’azione e completa
le provocazioni e i costi delle carte attive. Il proprietario risolve la
prova con le carte rivelate e le conversioni disponibili. Il progresso resta
salvato dopo un fallimento: un nuovo tentativo può essere continuato da un
altro eroe e da un altro telefono. Seguite le conseguenze fino al ritorno.

Il successo conduce ai premi e alla destinazione indicata, quindi al campo.
Gli XP restano nel ruolo che li ha ricevuti, anche per gli eroi sconfitti;
la Sapienza appartiene alla compagnia. Un partecipante conferma per il gruppo;
gli altri leggono e attendono. Nel campo ciascun proprietario può scegliere
il ruolo del proprio eroe. Acquisti, potenziamenti e avventura successiva
attendono ancora i rispettivi contenuti.

Lo schema corrente è20. L’aggiornamento dei salvataggi precedenti è soltanto
strutturale: conserva carte, origine, ricevute e richieste senza aggiungere
capacità. Il software precedente non legge questo nuovo schema; per tornare
indietro serve una copia precedente. Le quantità dei benefici restano non
verificate e il loro blocco viene mantenuto. La verifica positiva del covo è
interamente inventata e non certifica una partita originale completa.
[Contratto](docs/planning/lair-victory-spec.md) e
[risultati tecnici](docs/development/lair-victory.md).

## Carte coperte: prova P0

Il consumer fisico gestisce due mazzi comuni da28 copie, conseguenze coperte,
prevenzione concessa dalla fonte e scarti casuali sotto i mazzi, con recupero
e ricevute atomici. È verificato con un **programma sintetico dichiarato**:
parametri, stati, testi e crediti inventati, nello stesso consumer scenario.
Non abilita danni liberi, pulsanti debug o nuovi incontri originali.

Solo quella fonte richiede il raw privato `physical-content.json` nella cartella
dati, oppure `LOTR_PHYSICAL_PACK`: deve essere il raw verificabile dal catalogo,
non un export di famiglia o un certificato. Danni e paure vengono validati
separatamente; i benefici irrisolti non bloccano queste famiglie. Una volta
congelato, il salvataggio non richiede più quel file. I tavoli precedenti
mantengono il consumer fisico assente, senza inizializzazione retroattiva.

Le viste di gioco espongono soltanto retro e conteggi. Il backup completo e il
database del PC conservano invece anche identità e ordine delle carte nascoste:
sono materiale privato di recupero. Fronti, capacità originali e Ultimo Sforzo
mantengono i rispettivi gate. [Contratto e prove P0](docs/testing/physical-resolution-p0-verification.md).

## Turni e fasi del round

Nel percorso precedente, dalla vista personale, dopo preparazione e collocazione sulla mappa, concordate **Inizia i round**.
Il gruppo sceglie l'ordine; il proprietario avvia il turno di un proprio eroe.
Ogni eroe ha fino a due azioni, anche ripetute, e può concludere senza usarle
tutte. **Interazione · 1 azione** rivela una prova e consuma l'azione nella
stessa conferma. Il viaggio è disponibile nella mappa; gli attacchi arriveranno con il combattimento.
Una prova richiesta da un effetto già determinato non consuma azioni.

Dopo tutti i turni, il gruppo passa all'Ombra e conferma, nell'ordine,
attivazione nemica, oscurità e minaccia. Questi tre passaggi sono **manuali**:
risolvete o verificate che non si applichino; il tavolo non calcola ancora
nemici, paura, minaccia o soglie. Dopo minaccia rendete pronti i nemici esauriti.

La conferma finale ricompone tutti i mazzi senza le preparate. Solo dopo ogni
eroe effettua **Scoperta di Riorganizzazione**, una volta, in ordine
concordato: due carte di base, più una per Aragorn e per gli eroi nella
sua stessa casella o in una adiacente. Il conteggio è mostrato nel pulsante; il mazzo non viene mescolato una seconda volta. Concluse tutte
le Scoperte, una conferma comune apre il nuovo round. Nessun cambio di turno
o fase è possibile con una rivelazione aperta. Turno, azioni e progressi
sopravvivono a ricarica, recupero, arresto e backup.

Il bonus di Aragorn segue le posizioni salvate, senza altri costi. Nei vecchi round senza mappa, per gli altri eroi il gruppo indica esplicitamente se sono vicini ad Aragorn sul proprio tavolo; nessuna risposta è preselezionata. Il nuovo avvio guidato registra già la mappa prima dei round.

## Mappa e viaggio

Questo è il percorso precedente con mappa dimostrativa; non avvia lo startup A1.
Il pacchetto mappa è distinto dalle carte: `journey-map.json` con eventuali
PNG in `assets/` accanto al file. Si installa nella cartella dati o si indica
con `LOTR_MAP_PACK`. Per il frammento privato preparato in questo worktree:

```sh
LOTR_CONTENT_PACK="$PWD/.scratch/private-content/catalog.json" LOTR_MAP_PACK="$PWD/.scratch/private-map/journey-map.json" LOTR_DATA_DIR="$PWD/.scratch/user-table" LOTR_PORT=4321 npm start
```

In PowerShell si aggiunge `$env:LOTR_MAP_PACK` con il percorso assoluto di
`journey-map.json` agli altri parametri già indicati sopra.

Dopo la preparazione, prima dei turni di un round, il gruppo conferma
**Apri il tratto e colloca gli eroi**. Il primo tratto usa la vera tessera
302A: tre caselle, partenza nella seconda. È in orientamento canonico e non
riproduce ancora la mappa completa, l'esplorazione, i nemici o gli eventi
dell'avventura. [Dati primari e limiti](docs/research/journey-map-topology.md).

Nel turno del tuo eroe, **Inizia viaggio · 1 azione** concede due movimenti.
Seleziona una casella sulla mappa o dal campo **Destinazione**, leggi
l'anteprima e premi **Conferma movimento**. Ogni movimento richiede una
casella adiacente; gli esagoni del disegno non sono caselle aggiuntive.
Puoi effettuare un'interazione fra i due movimenti, poi usare il residuo.
Un secondo viaggio concede altri due movimenti. Concludere il turno rinuncia
ai residui, mantenendo la posizione. Più eroi possono stare nella stessa casella.

Trascina il tabellone o apri **Visuale e movimento ridotto**. Frecce, +/−
e Home controllano la camera dalla mappa. Ricarica, recupero e backup
conservano posizioni e viaggio interrotto; il ripristino funziona senza il
pacchetto, mentre le immagini opzionali vanno reinstallate separatamente.

Per lo sviluppo della mappa completa è disponibile un compilatore geometrico
separato dal tavolo. Dopo `npm run build`, con un pacchetto privato nel
[formato descritto](docs/planning/initial-map-geometry-spec.md):

```sh
node dist/map-geometry.mjs --input geometry.json --rotation 0 --list
node dist/map-geometry.mjs --input geometry.json --rotation 0 --placement 0 --output composed.json
```

La prima chiamata elenca le giunzioni legali; la seconda congela quella
selezionata in un file nuovo, senza sovrascrivere. Senza `--output` il JSON va
su stdout. Il risultato `scope: geometry-only` conserva pacchetto, impronta,
pose e grafo; non viene caricato dall'host. La verifica originale copre la
prima sezione 302A/custom100A. La pipeline completa di selezione, geometria,
movimento e incontri è ora collegata al freeze di sessione descritto sopra.
L'avvio [#38](https://github.com/Ic3b3rg/lotr-table-game/issues/38) consuma quella
realizzazione con il pacchetto scenario descritto sopra.

La build produce anche `dist/map-primitives.mjs`: `SourceRandom` con stato
snapshot/ripristino, `sourceShuffle` e `comparisonSort` conservano le scelte
e l'ordine richiesti dal generatore. Sono separati dalla casualità dei mazzi.
La politica `FLOAT32_POLICY` identifica l'arrotondamento portabile adottato;
la [verifica delle primitive](docs/testing/map-source-primitives-verification.md)
ne registra prove e limiti rispetto al runtime originale.

`dist/map-selection.mjs --input pacchetto.json --output nuovo-file.json`
prepara i pool e seleziona le tessere delle quattro sezioni, conservando
scelte e stato RNG. Il [formato privato](docs/planning/map-selection-spec.md)
richiede contesto e provenienza espliciti. L'output `scope: selection-only`
si ferma prima dell'assemblaggio geometrico; non viene caricato dal tavolo.

## Scoperta e carte preparate

Dalla vista personale scegli l'eroe e il numero di carte da scoprire indicato
dalla regola o dalla capacità. **Ricomponi e scopri 2** riunisce invece prima
mazzo e scarti, lasciando escluse le preparate: questa modalità indipendente
è disponibile prima di avviare i round. Nei round i mazzi vengono ricomposti
insieme all'inizio della Riorganizzazione, prima delle Scoperte dedicate.

Per ogni carta scegli **Sopra il mazzo**, **Sotto il mazzo** o **Prepara questa
carta**. Puoi prepararne al massimo una. Con **Sposta prima/dopo** scegli
l'ordine: la prima dell'elenco sarà la più vicina alla prossima pesca nel
gruppo sopra o sotto. Poi conferma preparazione e ordine.

Se la nuova carta sarebbe la quinta preparata devi scartarne una fra le
cinque, anche quella appena scelta. Le debolezze sono preparabili e contano
nel limite. **Registra lo scarto della carta** serve, fuori dalle prove e da
Scoperta, per un effetto già risolto dal gruppo; non ne automatizza la capacità.

Prova abilità e Scoperta si escludono: prima concludi la rivelazione in corso.
Il PC salva le carte rivelate e permette di riprendere la richiesta dopo un
riavvio o un ripristino. Le selezioni del modulo non ancora confermate si
mantengono durante il polling, finché la pagina rimane aperta.

## Prove abilità

Dalla vista personale, nella sezione **Prove abilità**, scegli un tuo eroe,
la caratteristica e la soglia indicate dalla regola. Puoi anche scegliere il
semplice conteggio dei successi. Nei round scegli prima l’origine: interazione del tuo eroe di turno (1 azione) oppure effetto già determinato dal gruppo (nessuna azione). Durante Riorganizzazione si effettuano soltanto le Scoperte dedicate. Lascia il modificatore a zero, salvo un effetto
già determinato dal gruppo, poi premi **Rivela le carte della prova**.

Nelle carte rivelate contano soltanto i simboli. Ogni ispirazione spesa converte
un fato in un successo; **Concludi la prova** registra il risultato e scarta le
carte. L'host ricompone automaticamente il mazzo quando si esaurisce, escludendo
le carte preparate e quelle ancora nella prova. **Registra 1 ispirazione ottenuta**
serve per un effetto già risolto dal gruppo, entro il limite dell'eroe.

Una sola prova resta aperta sul tavolo; il suo proprietario la gestisce e gli
altri schermi ne seguono l'esito. Ricarica, recupero, riavvio e backup conservano
anche una prova interrotta fra pesca e conversioni. Le capacità di eroi, carte
preparate e oggetti non sono automatizzate: questa è la base delle prove, ancora
separata da attacchi e campagna giocabile.

## Sviluppo e verifiche

```sh
npm run typecheck
npm run format:check
npm test
```

[Scelte tecniche e fonti](docs/development.md), [mappa di pianificazione](docs/planning/README.md), [inventario del workbook carte](docs/research/card-workbook-inventory.md).

[Risultati delle verifiche e prova sui dispositivi](docs/testing/offline-session-verification.md), [revisione di standard e specifica](docs/reviews/2026-10-23-offline-session.md).

[Verifiche della preparazione reale](docs/testing/party-preparation-verification.md), [revisione indipendente della preparazione](docs/reviews/2026-10-25-party-preparation.md).

[Contratto delle prove abilità](docs/planning/skill-tests-spec.md) e
[verifiche delle prove persistenti](docs/testing/skill-tests-verification.md).

[Contratto di Scoperta](docs/planning/scouting-spec.md) e
[verifiche di Scoperta e carte preparate](docs/testing/scouting-verification.md).

[Contratto dei round](docs/planning/rounds-spec.md) e
[verifiche di turni, azioni e riorganizzazione](docs/testing/rounds-verification.md),
[revisione e correzioni](docs/reviews/2026-11-02-rounds.md).

[Contratto del viaggio](docs/planning/travel-spec.md) e
[verifiche di mappa e movimento](docs/testing/travel-verification.md),
[revisione e correzione](docs/reviews/2026-11-02-travel.md).

Avvio e browser Chromium sono verificati sul Mac di sviluppo. L'host Windows, Safari su iPhone, Chrome su Android, la scansione fisica del QR e cinque telefoni con WAN scollegata devono ancora essere provati con il gruppo: [prova LAN](https://github.com/Ic3b3rg/lotr-table-game/issues/5).

Created in [T3 Code](https://t3.codes).
