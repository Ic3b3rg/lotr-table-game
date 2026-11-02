# Sviluppo della sessione locale

Il primo traguardo è descritto nella [specifica approvata](https://github.com/Ic3b3rg/lotr-table-game/issues/8). Il confine dei test è l'host HTTP realmente avviato; il browser usa le stesse richieste. Le prove fisiche della LAN sono distinte dai test del computer di sviluppo.

## Scelte tecniche

- Node.js 24 LTS (minimo 24.11.1, versione presente nel computer di sviluppo), TypeScript 5.9.3 con controlli strict. Server HTTP nativo; esbuild 0.28.2 produce host e risorse browser. Nessun server di sviluppo o download necessario durante l'uso.
- UI con HTML, CSS e TypeScript; due percorsi per tavolo condiviso e vista personale, senza un framework necessario per queste schermate. Direzione visiva provvisoria: carta chiara, verde bosco, file leggibili per i cinque posti, QR prioritario sul PC e ingresso prioritario sul telefono. Testi e stati sono reali, senza illustrazioni o componenti del gioco copiati nelle schermate tecniche.
- Polling seriale delle letture, con stato visibile di disconnessione. Il trasporto non decide l'ordine o la validità delle azioni di gioco.
- QR prodotto sul PC da qrcode 1.5.4; validazione delle richieste con Zod 4.6.7. Risorse servite dalla stessa origine, Host e Origin controllati e nessun CORS aperto.
- Dipendenze fissate nel lockfile; script di installazione disabilitati in `.npmrc`. Il binario esbuild è fornito dal pacchetto opzionale della piattaforma, senza eseguire install script.
- Persistenza con SQLite integrato in Node 24; in 24.11.1 l'API è ancora sperimentale e il runtime emette il relativo avviso. Nessun modulo nativo aggiuntivo da compilare. Una transazione `BEGIN IMMEDIATE` legge e modifica lo stato prima del commit, con sincronizzazione FULL; le risposte positive seguono il commit. I test terminano davvero il processo con SIGKILL e lo riavviano.
- Il browser genera un codice casuale di 96 bit con `getRandomValues` (disponibile anche su HTTP locale), l'host ne conserva soltanto l'hash SHA-256. Il codice è mostrato all'ingresso e non viene scritto nel localStorage. Un cookie HttpOnly e SameSite Strict, firmato con chiave privata locale persistente, ricorda il posto sullo stesso browser. Il trasporto HTTP è limitato alla LAN: non utilizza cookie Secure, service worker o altre funzioni che richiedono HTTPS. Non esporre l'host direttamente su Internet.
- Ogni comando condiviso porta un'identità di intento stabile. Una chiave primaria composta da partecipante e richiesta reclama il comando nella stessa transazione che aggiorna lo stato e salva la ricevuta. Un hash dell'intento impedisce di usare la stessa identità per una scelta diversa. Il reinvio restituisce la ricevuta precedente; una richiesta di gioco superata non si applica alla successiva.
- L'esportazione JSON versione 1 legge stato e ricevute nella stessa transazione; non copia il file SQLite aperto e non include la chiave che firma i cookie. Il ripristino valida formato, checksum SHA-256 e riferimenti, poi sostituisce stato e ricevute in una sola transazione. Il checksum rileva alterazioni, non certifica l'autore della copia. Una nuova generazione invalida cookie e comandi in volo; revisione e conferma esplicita proteggono dalla sostituzione di un tavolo cambiato durante il controllo.
- Backup e ripristino richiedono un partecipante oppure una richiesta proveniente dal PC stesso (indirizzi remoto e locale del socket uguali), così un host vuoto può essere ripristinato senza creare un posto provvisorio anche con bind su un singolo IP LAN. Host e Origin sono controllati anche per questa eccezione. Ingresso/recupero hanno un limite locale di 30 tentativi per minuto e indirizzo. La dimostrazione conserva fino a 5000 ricevute, senza eliminarle per far spazio a nuovi comandi; l'importazione accetta al massimo 4 MiB. Il motore del gioco completo avrà un proprio contratto di dati e migrazioni.
- La sessione dichiara `schemaVersion: 1`, distinta da revisione e generazione. Gli stati senza versione prodotti durante lo sviluppo vengono validati e aggiornati atomicamente, senza cambiare partecipanti, revisione o ricevute; una versione sconosciuta non viene interpretata come un tavolo vuoto. I QR vengono filtrati secondo il bind effettivo e l'URL di avvio usa un indirizzo realmente servito.

## Fonti primarie verificate

- [Node 24.11.1 HTTP](https://nodejs.org/download/release/v24.11.1/docs/api/http.html#httpcreateserveroptions-requestlistener): server e limiti delle richieste.
- [Node 24.11.1 test runner](https://nodejs.org/download/release/v24.11.1/docs/api/test.html#running-tests-from-the-command-line): test nativi e processi separati per le prove di riavvio.
- [esbuild: platform e target](https://esbuild.github.io/api/#platform): build distinte Node e browser.
- [Zod: definizione degli schemi](https://zod.dev/api): validazione dei dati ai confini, comprese future copie importate.
- [qrcode: API](https://github.com/soldair/node-qrcode#tostringtext-options-cberror-string): generazione SVG locale con margine e correzione d'errore.
- [SQLite in Node 24.11.1](https://nodejs.org/download/release/v24.11.1/docs/api/sqlite.html#class-databasesync), [transazioni SQLite](https://www.sqlite.org/lang_transaction.html), [synchronous](https://www.sqlite.org/pragma.html#pragma_synchronous).
- [MDN: getRandomValues](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues): casualità nel browser anche senza contesto HTTPS.

Le verifiche nel browser sono eseguite tramite la preview condivisa di T3. Un browser Chromium sul Mac non certifica Safari iOS, Android o l'host Windows.
