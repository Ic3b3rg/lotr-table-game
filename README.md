<img src="assets/icon.svg" width="64" height="64" alt="">

# Viaggi · tavolo locale

Versione digitale personale di Viaggi nella Terra di Mezzo, in sviluppo. Il tavolo sul PC accoglie i telefoni via QR e conserva la preparazione della compagnia: eroi, ruoli, equipaggiamento e mazzi iniziali. Effetti, prove, movimento, combattimento e campagna giocabile seguono nei prossimi incrementi. [Specifica e task della preparazione](https://github.com/Ic3b3rg/lotr-table-game/issues/20).

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

Quando il gruppo ha concordato le scelte, **Prepara i mazzi della compagnia** assegna quindici carte per eroe: ruolo 1 preparato e quattordici carte coperte. La composizione è consultabile; l'ordine coperto resta salvato sull'host. Dopo la conferma la compagnia è fissata e si recuperano soltanto i posti esistenti. Non sono ancora disponibili cambi al campo o azioni dell'avventura.

Le schede distinguono originale italiano, traduzione e verifica incompleta. Il pacchetto attuale comprende sei eroi, sei ruoli, 74 definizioni abilità e 78 oggetti; quattro testi conservano una candidatura esplicita, compreso Guardian 1 di provenienza `Custom`. Non certifica l'intera scatola o gli effetti del futuro motore. [Metadati e limiti verificati](docs/testing/party-content-metadata.json).

Il primo catalogo acquisito viene congelato nel salvataggio. Modificare il file di input non riscrive una partita esistente. Il backup include testi, copie e ordine esatti; le immagini sono opzionali e si reinstallano separatamente. I vecchi salvataggi e backup della sessione vengono migrati allo schema 2. Per tornare al software precedente serve una copia conservata prima della migrazione: il vecchio host non legge lo schema 2.

## Sviluppo e verifiche

```sh
npm run typecheck
npm run format:check
npm test
```

[Scelte tecniche e fonti](docs/development.md), [mappa di pianificazione](docs/planning/README.md), [inventario del workbook carte](docs/research/card-workbook-inventory.md).

[Risultati delle verifiche e prova sui dispositivi](docs/testing/offline-session-verification.md), [revisione di standard e specifica](docs/reviews/2026-10-23-offline-session.md).

[Verifiche della preparazione reale](docs/testing/party-preparation-verification.md), [revisione indipendente della preparazione](docs/reviews/2026-10-25-party-preparation.md).

Avvio e browser Chromium sono verificati sul Mac di sviluppo. L'host Windows, Safari su iPhone, Chrome su Android, la scansione fisica del QR e cinque telefoni con WAN scollegata devono ancora essere provati con il gruppo: [prova LAN](https://github.com/Ic3b3rg/lotr-table-game/issues/5).

Created in [T3 Code](https://t3.codes).
