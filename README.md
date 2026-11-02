<img src="assets/icon.svg" width="64" height="64" alt="">

# Viaggi · tavolo locale

Versione digitale personale di Viaggi nella Terra di Mezzo, in sviluppo. Il tavolo sul PC accoglie i telefoni via QR, conserva la compagnia e permette turni e fasi persistenti, mappa e viaggio interrompibile, interazioni con prova, fato, ispirazione e Scoperta con carte preparate e mazzi ordinati. Generazione della mappa completa, capacità delle carte, combattimento e campagna giocabile seguono nei prossimi incrementi. [Mappa e viaggio](https://github.com/Ic3b3rg/lotr-table-game/issues/31).

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

Da **Eroi e carte**, entrare al tavolo e scegliere i propri eroi: da due a quattro in solitario, uno per persona con due–cinque partecipanti. Ruoli e oggetti suggeriti sono modificabili; le copie già assegnate restano riservate. I limiti individuali dell'eroe, le mani, l'armatura e il rango iniziale vengono controllati dall'host. Il PC condiviso può consultare tutte le schede senza entrare.

Quando il gruppo ha concordato le scelte, **Prepara i mazzi della compagnia** assegna quindici carte per eroe: ruolo 1 preparato e quattordici carte coperte. La composizione è consultabile; l'ordine coperto resta salvato sull'host. Dopo la conferma la compagnia è fissata e si recuperano soltanto i posti esistenti. Le prove standard sono disponibili subito sotto; cambi al campo e avventure seguiranno.

Le schede distinguono originale italiano, traduzione e verifica incompleta. Il pacchetto attuale comprende sei eroi, sei ruoli, 74 definizioni abilità e 78 oggetti; quattro testi conservano una candidatura esplicita, compreso Guardian 1 di provenienza `Custom`. Non certifica l'intera scatola o gli effetti del futuro motore. [Metadati e limiti verificati](docs/testing/party-content-metadata.json).

Il primo catalogo acquisito viene congelato nel salvataggio. Modificare il file di input non riscrive una partita esistente. Il backup include testi, copie e ordine esatti; le immagini sono opzionali e si reinstallano separatamente. I vecchi salvataggi e backup negli schemi 1, 2, 3, 4 e 5 vengono migrati allo schema 6, conservando compagnia, ordine dei mazzi, prove e Scoperta in corso. I salvataggi anteriori allo schema 5 mantengono i round disattivati finché il gruppo non li avvia; i round già attivi vengono conservati. Per tornare al software precedente serve una copia conservata prima della migrazione: il vecchio host non legge lo schema 6.

## Turni e fasi del round

Dalla vista personale, dopo la preparazione, concordate **Inizia i round**.
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
eroe effettua **Scopri 2 per la Riorganizzazione**, una volta, in ordine
concordato; il mazzo non viene mescolato una seconda volta. Concluse tutte
le Scoperte, una conferma comune apre il nuovo round. Nessun cambio di turno
o fase è possibile con una rivelazione aperta. Turno, azioni e progressi
sopravvivono a ricarica, recupero, arresto e backup.

## Mappa e viaggio

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
[verifiche di mappa e movimento](docs/testing/travel-verification.md).

Avvio e browser Chromium sono verificati sul Mac di sviluppo. L'host Windows, Safari su iPhone, Chrome su Android, la scansione fisica del QR e cinque telefoni con WAN scollegata devono ancora essere provati con il gruppo: [prova LAN](https://github.com/Ic3b3rg/lotr-table-game/issues/5).

Created in [T3 Code](https://t3.codes).
