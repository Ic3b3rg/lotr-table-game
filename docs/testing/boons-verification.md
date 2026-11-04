# Verifica del consumer benefici — #94

Base `f9d9db890ac25adf7d1cfa6970454155f94eaf6c`, schema16 e 662 test;
nuova capacità esplicita in schema17. Spec e piano sono stati committati prima
del codice. Le slice verificano compiler, stock, finestre, controller HTTP,
integrazione fonte e recovery ai confini pubblici reali.

Esito finale: `npm test`688/688, zero saltati,294320.702292ms. Typecheck,
formato, diff e privacy della nuova storia sono passati.

## Fixture e prove positive

Tutti i dati delle fixture sono inventati: distribuzione2/4/9, valori4/5,
nomi, identificativi e fonti sintetici. Non modificano il catalogo originale
e non dimostrano l'accettazione di #89/#33.

I test `boons-*.test.mjs` coprono provenienza e input rigorosi, stock ignoto,
duplicati, receiver, limite e conservazione, sostituzioni e conversioni già
pagate, riciclo, bonus a zero successi, difesa/divieti/scarto, subito diretto
contro figli, fine turno/prossimità, titolo/Riposo e costi dell'intero seguito.
Gli HTTP verificano anche attore, stale, retry e concorrenza sul singolo ledger.

Il recovery interrompe il processo con SIGKILL a sei confini: concessione,
acquisizione prima del figlio obbligatorio, prova rivelata, uso/scarto,
carte sostituite, risultato e ritorno al padre. Ogni confine confronta l'intero
payload dopo riavvio e restore su host senza pack. Sei alterazioni risignate
sono respinte senza sostituire lo stato.

La UI sintetica usa tre proprietari e320/768/1024/1440 su HTTP IPv4 senza
`crypto.subtle`. Le nove situazioni verificate includono concessione, attacco
passivo, offerta/costo/sostituzione della prova, difesa obbligatoria, ritorno,
stock ignoto e blocco noto dell'Ombra:108 combinazioni. Input nativi e filepicker,
lettore interamente nel viewport, guida, tastiera/focus e confronto del payload
immutato. L'export nativo conserva l'intero payload. Le prove fallite restano
separate dalle catture valide nel report privato.
I17 snapshot nativi e l'export sono riconvalidati anche con il validator finale.

## Fonti originali e replay in sola lettura

Le tre definizioni sono ricontrollate con un oracle indipendente3/3 sul workbook,
Rules Reference e FAQ2.0; i quattro PDF ricevuti mantengono byte e hash.
Input fisico57:780002 byte, SHA256
`3d06fbbf8f767b3e5e78e859c7187986041ed77d7af173917c4c72f2126b0c52`.
Il compiler produce un artefatto diagnostico, stock non verificato e zero copie.
I testi, mapping e programmi originali restano nella scratch ignorata.

I payload autorizzati vengono riconvalidati senza eseguire mosse:351 storici,
59 nativi91 e75 nativi89. Il confronto intero ammette soltanto schema17 e il
default `physical: null` già previsto dalla migrazione degli schemi fino a10.
Gli80 input puntuali dell'episodio89 sono controllati per byte/hash,158043420
byte totali, mantenendo il sigillo ricevuto977 file/529638388 byte.

Il checkpoint156 originale resta round3/Azione, respinto per la riserva ignota:
nessun costo, sorteggio, movimento o avanzamento. Nessuna nuova partita originale
è stata avviata e nessuna quantità è stata inventata per il pack originale.

## Comandi e consegna

Verifiche pubbliche: `npm run build`, `node --test tests/boons-*.test.mjs`,
`npm test`, `npm run typecheck`, `npm run format:check`, `git diff --check`.
Le prime prove RED e i successivi GREEN sono conservati separatamente.
Il primo passaggio finale completo ha riportato687/688: timeout di avvio host
del recovery sotto carico concorrente. Il report privato riporta anche l'esito
del passaggio completo isolato successivo,688/688, senza modificare i limiti
dei test o la concorrenza del runner.

Il report privato e il sigillo nella scratch propria raccolgono comandi,
input/byte/hash, replay, tentativi, processi chiusi e commit locali. Review
Standards/Spec e integrazione spettano al root. #57, #89, #33 e #65 restano
aperte; altre famiglie o capacità non compilate restano gated.
