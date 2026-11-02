# Preparazione della compagnia — evidenze del 25 ottobre 2026

Perimetro: [specifica approvata](../planning/party-preparation-spec.md), issue [20](https://github.com/Ic3b3rg/lotr-table-game/issues/20) e task 21–23. Fondazione `1882195`; nessun codice del combattimento dimostrativo importato. Ambiente: macOS, Node 24.11.1, Chromium tramite Chrome DevTools. Le fixture pubbliche contengono esclusivamente testi sintetici.

## Host e persistenza

`npm test`: **29/29**, zero fallimenti o test saltati. `npm run typecheck` e `npm run format:check`: superati. La build viene eseguita dalla suite. Baseline prima dell'incremento: 13/13.

I test aprono processi HTTP separati con SQLite reale, cookie di partecipanti e cartelle temporanee. Coprono:

- Catalogo assente, incoerente e aggiornato dopo acquisizione: la partita conserva il catalogo congelato.
- Solitario con due, tre e quattro eroi; cinque persone con eroi distinti; ingresso durante una bozza senza cancellazioni automatiche.
- Proprietà, unicità di eroe/ruolo, ultima copia contesa, rango I, mani e armatura; limite individuale di una mano e suggerimenti compatibili.
- Quindici carte per eroe, ruolo 1 preparato, quattordici coperte e debolezze senza reinserimento. Cinque eroi ricevono 75 copie distinte. Le viste pubbliche non espongono l'ordine.
- Conferme concorrenti, reinvio dopo SIGKILL/riavvio, ricevuta e mazzi atomici, blocco di nuovi posti dopo la preparazione con recupero ancora disponibile.
- Bozza conservata dopo arresto e recupero su altro dispositivo; backup con stesso ordine privato, importazione su host vuoto senza pacchetto input, migrazione dei vecchi formati e rifiuto atomico di copie/riferimenti incoerenti.

L'avviso sperimentale di `node:sqlite` proviene dalla versione Node fissata e non indica un test fallito.

## Contenuti privati reali

Il pacchetto locale contiene sei eroi, sei ruoli, 74 definizioni abilità (98 copie) e 78 definizioni oggetto (83 copie), con sei ritratti e venti icone condivise. I [metadati pubblicabili](party-content-metadata.json) registrano conteggi, hash e candidati; testi integrali, immagini, build privata e salvataggi restano ignorati da Git.

Controllate 23 impronte delle fonti locali senza modificare gli originali. La riproduzione privata ha confrontato 32 output identici con il comando seguente dalla radice del worktree:

```sh
PYTHONDONTWRITEBYTECODE=1 /Users/silvioceccarini/.t3/projects/lotr-interactive-table-game/.scratch/unity-audit-venv/bin/python .scratch/private-content/build.py --check-reproduction
```

Dei 328 testi localizzati, 324 hanno superato il confronto registrato; quattro restano non verificati: tre nomi con associazione candidata e il testo Guardian W130 di origine `Custom`. Il badge e la provenienza rimangono consultabili. Non è una certificazione dei fronti fisici, delle 343 carte o dell'esecuzione degli effetti.

## Browser desktop e telefono

Il browser collaborativo T3 è stato tentato prima del fallback. Due snapshot della stessa pagina sono falliti con `Preview automation snapshot timed out after 15000ms`; le prove sono proseguite in Chromium tramite Chrome DevTools.

Verificate sul vero host la selezione e modifica della compagnia, lettura delle carte, preparazione, ricarica e recupero del medesimo posto in un contesto browser distinto. Il tavolo reale di verifica contiene Aragorn, Bilbo e Gimli con ruoli e oggetti salvati, tre carte preparate e tre mazzi da quattordici carte. La vista condivisa mantiene `player: null` e non aumenta i partecipanti.

| Superficie | Esito osservato |
| --- | --- |
| Telefono emulato 390×844, touch, movimento ridotto | Larghezza documento 390; nessuna immagine rotta; tre aree personali leggibili; animazioni disattivate |
| PC 1440 CSS px, DPR 2 | Larghezza documento 1440; compagnia a tre colonne; nessuna immagine rotta; nessun posto occupato dalla vista condivisa |
| Console delle due viste reali | Nessun errore o avviso dopo la ricarica finale |
| Risorse delle due viste reali | Nessuna richiesta verso origini esterne |
| Scheda eroe → carta → chiusura | Focus restituito al controllo esterno connesso |
| Modulo obsoleto e conferma comune obsoleta | HTTP 409, scelta concorrente conservata, compagnia ancora in bozza, riallineamento esplicito |

La prova di regressione riproducibile è [preparation-regressions.js](../../tests/browser/preparation-regressions.js), da caricare come script classico in un contesto Chromium su un host di prova con fixture sintetica. Chiama davvero l'HTTP e non sostituisce le risposte del server.

La revisione ha riprodotto il difetto del modulo vecchio prima della correzione: HTTP 200 e sovrascrittura della scelta concorrente dopo polling. Dopo la correzione, HTTP 409 e nessuna sovrascrittura, anche per la conferma definitiva. Il lettore annidato perdeva il focus prima della correzione e lo ripristina dopo.

Per il rifiuto dall'ultimo eroe su telefono, l'errore era a `top: -1136.125` e senza focus. Dopo la correzione è a `top: 370.875`, il recupero termina a `532.875` entro gli 844 pixel, con focus e input conservati. Il polling mantiene il modulo fino a **Ricarica le scelte**; il clic carica la scelta aggiornata e riabilita i moduli. Il revisore indipendente ha segnato M1 risolto, `disposition: ship`, limitatamente a questa correzione.

Le catture complete desktop/telefono e la prova di errore sono in `.impeccable/review/`, private perché mostrano contenuti del gioco. La revisione e il confronto documentale sono [registrati separatamente](../reviews/2026-10-25-party-preparation.md).

## Prove residue

L'emulazione non sostituisce Windows, Safari su iPhone, Chrome su Android, la scansione fisica del QR o cinque telefoni reali con WAN scollegata: restano nel [ticket LAN 5](https://github.com/Ic3b3rg/lotr-table-game/issues/5). Questo incremento non esegue prove del gioco, movimento, effetti, combattimenti o avventure e non certifica una campagna completa.
