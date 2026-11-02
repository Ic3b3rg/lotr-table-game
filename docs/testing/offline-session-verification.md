# Verifica della sessione locale — 23 ottobre 2026

Riferimento: [specifica e quattro task](https://github.com/Ic3b3rg/lotr-table-game/issues/8). Il traguardo implementa collegamento e conservazione della sessione con uno stato dimostrativo; carte, regole e campagna non sono ancora implementate.

## Ambiente verificato

- Host: macOS 26.5.1, arm64; Node.js 24.11.1, npm 11.6.2.
- Browser: preview di T3 Code, Chromium 152.0.7977.130 / Electron 44.4.5. La stringa user agent emula macOS Intel; non equivale a una prova su un secondo sistema operativo.
- Due profili browser distinti, origine loopback per il tavolo e origine HTTP dell'IP LAN per la vista personale. Sull'origine LAN `isSecureContext` è falso: ingresso, codice casuale, cookie e azioni hanno funzionato anche in questa condizione.
- Dati della prova completa in una cartella temporanea dedicata. Nessun contenuto originale delle carte o della campagna usato per la prova.

## Verifiche automatiche

Installazione ripetibile con `npm ci --ignore-scripts`; `npm run format:check`, `npm run typecheck` e `npm test` riusciti. **13 test, nessun fallimento e nessun test saltato.** Audit npm sul lockfile: nessuna vulnerabilità segnalata nelle dipendenze runtime e di sviluppo.

I test avviano processi host reali e verificano attraverso HTTP:

- Cinque partecipanti, limite del sesto ingresso e vista condivisa che non occupa un posto.
- Salvataggio dopo conferma, SIGKILL e riavvio con lo stesso archivio; identità e stato conservati.
- Recupero a tavolo pieno e reinvio dell'ingresso senza partecipanti aggiuntivi.
- Cookie non valido, input errato, Host/Origin estranei e limitazione dei tentativi di recupero.
- Conferme concorrenti con un solo esito, reinvii dopo arresto e rifiuto di comandi riferiti a una richiesta superata.
- Partecipazione richiesta per le azioni comuni e conferma della scelta concordata dal gruppo nella dimostrazione.
- Esportazione/ripristino su un host vuoto, ricevute conservate e vecchi accessi invalidati dopo il ripristino.
- Rifiuto di file errati, versione di esportazione sconosciuta, mancata conferma e revisione del tavolo superata, senza sostituire lo stato corrente.
- Esportazioni coerenti durante una conferma e nessun QR LAN per un host limitato al loopback.

## Verifiche nei browser e sul Mac

- Ingresso dalla vista personale e partecipante visibile nel tavolo condiviso; QR SVG caricato e risorse dell'app tutte locali.
- Ricarica con recupero automatico del posto tramite cookie. Recupero manuale in un secondo profilo, dopo ripristino e riavvio, senza aggiungere persone.
- Apertura della prova, accordo indicato dal partecipante, conferma del segnale A e stesso esito sui due schermi.
- Esportazione effettivamente scaricata dal browser come JSON. Caricamento di file errato con messaggio e nessun ripristino disponibile.
- Caricamento della copia valida, annullamento della conferma con stato invariato, successiva conferma con ripristino riuscito e invito al recupero sugli altri schermi.
- Larghezze 320, 768, 1024 e 1440 CSS pixel: nessun overflow orizzontale nella vista personale. Controlli HTML nativi con etichette; nessun errore console rilevato durante i flussi verificati. Nessuna certificazione di accessibilità completa dichiarata.
- Bind su un singolo IP dell'interfaccia LAN reale: URL annunciato raggiungibile, soltanto quell'indirizzo pubblicato, QR verso un'altra interfaccia rifiutato e gestione backup dal PC disponibile.
- Aggiornamento di una sessione di sviluppo senza versione: aggiunta di `schemaVersion: 1`, con identica identità del tavolo, revisione, generazione, partecipanti ed esito; recupero ancora funzionante dopo il riavvio.

## Prova fisica da eseguire con il proprietario

Il [ticket della prova LAN](https://github.com/Ic3b3rg/lotr-table-game/issues/5) resta aperto. Le finestre del browser sul Mac non sostituiscono queste prove:

1. Preparare il progetto su Mac e su Windows, avviare con i rispettivi launcher e annotare sistema, CPU e versione Node.
2. Collegare PC e telefoni alla stessa rete; disattivare la WAN mantenendo attiva la rete locale. Da browser senza cache, scansionare il QR con Safari su iPhone e Chrome su Android.
3. Far entrare cinque persone e verificare che il PC condiviso non occupi un posto. Confermare un segnale dal telefono e osservarlo sugli altri schermi.
4. Bloccare i telefoni, cambiare app, ricaricare, interrompere e ripristinare la Wi-Fi. Verificare riconnessione, stesso posto e assenza di azioni duplicate.
5. Chiudere e riaprire l'host; recuperare un posto da un altro telefono con il codice. Provare anche un arresto improvviso del processo.
6. Esportare una copia e ripristinarla sull'altro PC. Controllare partecipanti, richiesta/esito e recupero dei posti.
7. Annotare firewall e permessi LAN, porta occupata, rete ospiti isolata e cambio dell'indirizzo del PC. Registrare esiti reali prima di dichiarare il traguardo verificato sui dispositivi.

Formato distributivo finale, installazione del runtime inclusa in un pacchetto e prova del salvataggio di una partita completa richiedono i successivi traguardi.
