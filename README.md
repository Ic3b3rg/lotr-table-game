<img src="assets/icon.svg" width="64" height="64" alt="">

# Viaggi · tavolo locale

Versione digitale personale di Viaggi nella Terra di Mezzo, in sviluppo. Il primo traguardo è la sessione sul PC con accesso dei telefoni via QR; regole, carte e campagna complete sono i traguardi successivi. [Specifica e task](https://github.com/Ic3b3rg/lotr-table-game/issues/8).

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

## Sviluppo e verifiche

Sul ramo `prototype/diorama-25d` è disponibile la [prova visiva del diorama](src/client/prototypes/diorama/README.md): avviarla con `npm run prototype` e aprire [la scena](http://127.0.0.1:4320/prototype/diorama). È indipendente dal tavolo salvato e usa valori e abilità dimostrativi.

```sh
npm run typecheck
npm run format:check
npm test
```

[Scelte tecniche e fonti](docs/development.md), [mappa di pianificazione](docs/planning/README.md), [inventario del workbook carte](docs/research/card-workbook-inventory.md).

[Risultati delle verifiche e prova sui dispositivi](docs/testing/offline-session-verification.md), [revisione di standard e specifica](docs/reviews/2026-10-23-offline-session.md).

Avvio e browser Chromium sono verificati sul Mac di sviluppo. L'host Windows, Safari su iPhone, Chrome su Android, la scansione fisica del QR e cinque telefoni con WAN scollegata devono ancora essere provati con il gruppo: [prova LAN](https://github.com/Ic3b3rg/lotr-table-game/issues/5).

Created in [T3 Code](https://t3.codes).
