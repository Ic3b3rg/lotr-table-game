# Sviluppo della sessione locale

Il primo traguardo è descritto nella [specifica approvata](https://github.com/Ic3b3rg/lotr-table-game/issues/8). Il confine dei test è l'host HTTP realmente avviato; il browser usa le stesse richieste. Le prove fisiche della LAN sono distinte dai test del computer di sviluppo.

## Scelte tecniche

- Node.js 24 LTS (minimo 24.11.1, versione presente nel computer di sviluppo), TypeScript 5.9.3 con controlli strict. Server HTTP nativo; esbuild 0.28.2 produce host e risorse browser. Nessun server di sviluppo o download necessario durante l'uso.
- UI con HTML, CSS e TypeScript; due percorsi per tavolo condiviso e vista personale, senza un framework necessario per queste schermate. Direzione visiva provvisoria: carta chiara, verde bosco, file leggibili per i cinque posti, QR prioritario sul PC e ingresso prioritario sul telefono. Testi e stati sono reali, senza illustrazioni o componenti del gioco copiati nelle schermate tecniche.
- Polling seriale delle letture, con stato visibile di disconnessione. Il trasporto non decide l'ordine o la validità delle azioni di gioco.
- QR prodotto sul PC da qrcode 1.5.4; validazione delle richieste con Zod 4.6.7. Risorse servite dalla stessa origine, Host e Origin controllati e nessun CORS aperto.
- Dipendenze fissate nel lockfile; script di installazione disabilitati in `.npmrc`. Il binario esbuild è fornito dal pacchetto opzionale della piattaforma, senza eseguire install script.

## Fonti primarie verificate

- [Node 24.11.1 HTTP](https://nodejs.org/download/release/v24.11.1/docs/api/http.html#httpcreateserveroptions-requestlistener): server e limiti delle richieste.
- [Node 24.11.1 test runner](https://nodejs.org/download/release/v24.11.1/docs/api/test.html#running-tests-from-the-command-line): test nativi e processi separati per le prove di riavvio.
- [esbuild: platform e target](https://esbuild.github.io/api/#platform): build distinte Node e browser.
- [Zod: definizione degli schemi](https://zod.dev/api): validazione dei dati ai confini, comprese future copie importate.
- [qrcode: API](https://github.com/soldair/node-qrcode#tostringtext-options-cberror-string): generazione SVG locale con margine e correzione d'errore.

Le verifiche nel browser sono eseguite tramite la preview condivisa di T3. Un browser Chromium sul Mac non certifica Safari iOS, Android o l'host Windows.
