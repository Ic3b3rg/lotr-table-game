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

Se ci sono più indirizzi, scegliere quello della Wi-Fi/Ethernet condivisa con i telefoni. Le reti ospiti possono impedire la comunicazione tra dispositivi. Per cambiare porta impostare `LOTR_PORT`; `LOTR_BIND` seleziona l'indirizzo di ascolto (predefinito `0.0.0.0`, tutte le interfacce IPv4).

## Sviluppo e verifiche

```sh
npm run typecheck
npm test
```

[Scelte tecniche e fonti](docs/development.md), [mappa di pianificazione](docs/planning/README.md), [inventario del workbook carte](docs/research/card-workbook-inventory.md).

Avvio e browser Chromium sono verificati sul Mac di sviluppo. L'host Windows, Safari su iPhone, Chrome su Android, la scansione fisica del QR e cinque telefoni con WAN scollegata devono ancora essere provati con il gruppo: [prova LAN](https://github.com/Ic3b3rg/lotr-table-game/issues/5).

Created in [T3 Code](https://t3.codes).
