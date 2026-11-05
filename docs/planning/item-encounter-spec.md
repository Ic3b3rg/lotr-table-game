# Incontro con oggetto e inventario — #106

Contratto: [issue106](https://github.com/Ic3b3rg/lotr-table-game/issues/106),
base `24fa97e8342e6114c519f733d02b989ea0e24f0f`, schema22/773 test.
Glossario, ADR2–3, baseline e contratti55/61/89/98/100/102/104 vincolanti.
Implementazione personale; review e integrazione al root. Autonomia già
autorizzata: nessuna approvazione ordinaria né delega.

## Obiettivo e confini

Chiudere verticalmente il solo incontro attestato: ispezione e annullamento
gratuiti, conferma con un costo, prova con carte e conversioni, fallimento
ripetibile, successo, acquisizione unica, messaggio/callback, rimozione e
ritorno al turno con movimenti conservati. Riusare scenario, fisica P1/P2,
provocazioni, inventario, lettore, finestre e Store.once.

Capacità facoltativa piccola congelata prima dello startup: prodotti[0],
inventario iniziale esplicito, modello/copia/quantità, carta e policy,
certificato intero, owner e lifecycle. Nessun retrofit di origini o pack.
Grounding bounded, due reader concordi e byte/hash prima del parse; oracle
indipendente. Corpus, testi originali, binding per carta, FSM/IL e immagini
rimangono nella scratch privata ignorata, anche nella storia Git.

Le due azioni concorrenti del messaggio conservano identità e parametri.
Il popup condiviso viene acquisito in ordine di aggiornamento; l'altro
attende finché è occupato. Il callback del vincitore cambia stato prima
dell'aggiornamento seguente. Nessuna seconda prova o azione viene inventata.

L'acquisizione risolve prima l'upgrade e il possesso esatto, poi aggiunge
la copia, applica la condizione della capacità di gruppo, mostra il premio
e verifica il titolo dopo la chiusura. Quantità e proprietà dei benefici
restano indipendenti. Il perimetro iniziale è la prima avventura base, con
inventario di campagna esplicitamente vuoto e sole abilità base certificate.
La numerosità fonte è conservata dopo sconfitte. I rami non raggiunti vanno
dimostrati dagli owner e dagli input, non dai nomi degli stati. Upgrade
che richiedono carte/finestre ulteriori conservano un gate prima dell'intero
costo, senza estrazione, filtro o reroll. Campo completo e upgrade generici
rimangono seguiti.

L'oggetto è proprietà comune, equipaggiato dall'eroe che lo ottiene, senza
trasferimenti liberi nella stessa avventura. Il consumer conserva copia,
custodia, consumo stampato, fonte e assegnazione. La capacità della carta
base usa la finestra fisica effettiva, senza successo, prevenzione o risorsa
gratuiti. Alla fine dell'avventura l'oggetto torna all'inventario comune.
Inventario e lettore mostrano eroe, consumo e istruzioni comprensibili.

## Architettura e accettazione

TypeScript strict/Zod e DOM esistenti. `src/scenario` attesta e controlla
fonte, preflight e callback; `src/physical-resolution` possiede acquisizione,
consumo e conservazione nel medesimo registro; `src/shared` dichiara i
contratti; `src/server` valida e persiste; `src/client` presenta il percorso.
Test Node e fixture interamente inventate in `tests`.

Preflight completo di entrambi gli esiti, owner, receiver, provocazioni,
P1/P2 e ritorni prima di costi/carte/RNG. Pool interi. Esaurimento fisico
reale conserva la diagnostica61/T25. Schema successivo solo strutturale;
formati storici rifiutano forme nuove anche nel seed, senza interpretare
normali chiavi di variabili/eventi come metadati. Replay e ricevute interi,
origine round1/Azione immutabile, nessuna normalizzazione gameplay.

TDD compiler/programmi scenario reali, costi/cancel, prove/conversioni,
ripetizione, quantità/possesso, consumer e finestre. HTTP/SQLite/Store.once:
concorrenza/retry/stale, actor/hero/space/source/card/cursor, nessun effetto
duplicato. SIGKILL e restore packless su host vuoti ai nuovi confini;
payload e viste interi, negativi risignati respinti immutabilmente.

QA positiva solo inventata, precondizioni ante-startup, tre identità,
320/768/1024/1440, HTTP IPv4 senza crypto.subtle. Dopo bootstrap soltanto
DOM/Input; GET/evaluate osservano. Guida, lettore, focus/tastiera, overflow,
export esatto, restore corrente e recupero posti. Solo superfici proprie.

Validator dal commit finale:503 file/17 viste94,18 snapshot/viste96,
14/98,17/100,19/102,13/104 ed export/finali. Byte/hash prima del parse,
confronti completi e sole migrazioni strutturali dichiarate. Copie identiche
non sono nuove prove. Originale156 soltanto statico/gated, mai gameplay.

Comandi: `npm run build`;
`node --test --test-concurrency=4 tests/item-*.test.mjs`;
infine `npm test` da sola dopo verifiche pesanti, `npm run typecheck`,
`npm run format:check`, `git diff --check` e privacy della nuova storia.
Nessuna dipendenza, installazione, riduzione di asserzioni/casi/deadline,
skip o suppression. Commit locali ordinati, report pubblico tecnico,
README/sigillo privati con input/provenienza/adapter/tentativi/comandi/hash.

Quantità57 null/unverified e blocco mantenuto. Nessun proxy, infinito,
unknown=empty, nuova partita originale o ripresa156. Nessuna chiusura di
57/65/89/33 né dichiarazione di gioco completo. Nessun altro checkout,
agente, GHwrite, push, PR o merge.
