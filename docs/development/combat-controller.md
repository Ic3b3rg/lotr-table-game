# Controller di attacco e provocazione — #85

Il combattimento è disponibile nella vista personale degli avvii che congelano
la nuova capacità prima dello startup. Il proprietario sceglie bersaglio, armi
compatibili e caratteristica, consulta gli slot, annulla gratuitamente oppure
conferma costo e rivelazione. Il percorso prosegue attraverso conversioni,
capacità, spesa dei successi, applicazione dei colpi, eventuale contrattacco e
ritorno. Il movimento e l’interazione conservano il comando durante le
provocazioni e lo ricontrollano dopo tutti i figli.

Spec e piano: [contratto](../planning/combat-controller-spec.md),
[piano](../planning/combat-controller-plan.md). Grounding:
[75](../research/first-combat-runtime-contract.md),
[77](first-combat-kernel.md), [81](../planning/second-shadow-spec.md),
[83](../research/second-shadow-combat-runtime-contract.md).

## Implementazione

Il compiler e le primitive di selezione e colpi estendono il nucleo esistente.
L’artefatto versionato conserva quattro modelli, 48 istruzioni ordinarie, 13
bonus e le clausole source-linked dell’intera compagnia: 33 definizioni, 45
copie, 45 clausole. Le statistiche materializzate non ricevono di nuovo i bonus.
Immunità, tratti, distanza, selezione trattenuta e riduzione progressiva restano
separati.

`src/combat/controller.ts` coordina lo stato autorevole dei gruppi e il consumer
fisico P1/P2. La prova usa carte reali e slot della singola copia; ogni successo
paga una sola spesa. I figli conservano le carte del padre e la fonte pagata.
Gli esiti distinguono offerto, negato, prevenuto e subito al trasferimento;
scarti, cure e conseguenze figlie non riscrivono il subito diretto. Una frontiera
persistita ordina aggiunte e Ultimo Sforzo e ricontrolla i limiti dopo ciascun
figlio. I movimenti imposti seguono grafo, minacce, provocazioni ed esplorazioni.

Il controller parte dallo startup completo round1/Azione e continua nello
stesso ledger v2 e nella stessa transazione `Store.once`. Replay e ricevute
comprendono costi, carte, istruzioni, gruppi e ritorni. La nuova capacità è
facoltativa nel formato schema15: i backup precedenti conservano pack e campi.
Le viste ordinarie escludono identità delle coperte, ordine dei mazzi ed entropia.

## Verifica del percorso autentico

Un host, un profilo browser e tre contesti propri hanno importato dall’interfaccia
il freeze autentico ante-startup. Tutto l’avanzamento è avvenuto tramite tastiera,
controlli browser nativi e filepicker, su HTTP IPv4 senza `crypto.subtle`.
Nessuna write API/SQL ha avanzato l’accettazione. Il percorso ha completato
startup, due round, prove collettive, spawn e ingresso nel round3 senza
cambiare deployment, seed o mappa.

Il nuovo avvio ha materializzato due gruppi diversi dal precedente freeze81.
Un gruppo con un’acquisizione obbligatoria non verificabile è rimasto bloccato;
il gruppo attaccato ha conservato l’intero pool. Prima è stata risolta una
provocazione con vera negazione e conseguenze fisiche, poi è ripreso il movimento
originario una sola volta, senza esaurire il gruppo. Un’altra eroina ha aperto e
annullato gratuitamente l’anteprima, confermato l’attacco, convertito un fato con
l’unica ispirazione disponibile e pagato uno slot da un successo per due colpi.
Le difese hanno assorbito entrambi i colpi. Il contrattacco ha rivelato vere carte:
un successo ha negato un danno e il danno residuo è stato realmente subito.
Il turno e il movimento rimasto sono tornati disponibili.

Preparazioni, istruzioni effettive, precondizioni e sequenza completa sono nella
prova privata ignorata; non sono sostituiti con esempi inventati nel rapporto.
La sconfitta completa, il premio, la concessione figlia, il movimento aggiuntivo
e Ultimo Sforzo hanno invece prove comportamentali con fixture inventate. Le
istruzioni estratte nel percorso autentico non hanno raggiunto questi rami.

La UI è stata verificata a 320, 768, 1024 e 1440 pixel durante spesa, negazione e
ritorno: nessun overflow, attore e attese distinti, scelte da telefono, guida e
lettore con apertura/chiusura da tastiera e ripristino del focus. Screenshot e
osservazione di rete/console sono privati.

## Controlli riproducibili

- `npm run typecheck`
- `npm run format:check`
- `npm test`
- `git diff --check`

Risultato conclusivo: **618/618 test**, typecheck, formato e diff check verdi.
La baseline ricevuta era 598/598; non è stata rieseguita separatamente sulla
base immutata. Le prove proprie contano 61 backup validati, sette coppie
SIGKILL, sette restore UI, dieci alterazioni risignate respinte e zero errori
runtime/HTTP nel browser. Host, osservatore e tre contesti propri sono chiusi.

I nuovi test coprono compiler, pool completi, riprese sotto il minimo, immunità,
copie/slot/successi, Scoperta figlia, risorse, causa diretta, frontiera P2,
controller HTTP, retry concorrenti, stale, gate prima dei costi, provocazione,
movimenti, concessione pagata con SIGKILL e premio unico dopo sconfitta.
I passaggi RED→GREEN e i controlli incrementali sono conservati nei log privati.

La matrice privata indipendente confronta 12 popolazioni/130 elementi, 258
riprese, 213 insiemi di bonus e 13.694 pacchetti con i dati fonte; include tutte
le 20 aggiunte e 45 clausole. Compatibilità verificata su 180 backup autorizzati
(129 precedenti e 51 del freeze81), senza ricostruire o silenziare campi. Le prove
proprie includono confronti completi dopo SIGKILL, restore tramite filepicker con
quattro file sorgente assenti e alterazioni coerentemente risignate respinte dal
replay. I checkpoint storici ripristinati per recupero non hanno avanzato una
partita alternativa.

I tentativi falliti restano nelle prove: test inizialmente RED, correzioni delle
fixture, selezione nativa e verifiche del lettore adattate al DOM effettivo,
conversione richiesta senza risorse e un riavvio del solo host di prova ripetuto
per una sequenza errata dei processi. Non sono promossi a prove riuscite.

## Limiti e consegna

La vera attivazione Ombra e il seguito25 restano bloccati prima dell’intera fase.
Le quantità57 sono sconosciute: nessuna configurazione provvisoria è stata
assunta. La disponibilità sconosciuta è distinta da una riserva verificata vuota;
il consumo di un beneficio realmente assente applica il ripiego stampato.
Le capacità opzionali mancanti restano indisponibili prima del proprio costo.
Nessuna estensione globale del catalogo74, esecuzione Unity/JIT o certificazione
di parità RNG originale. Questo incremento non dichiara completa la partita.

Prove, comandi, input/byte/hash e limiti sono sigillati in
`.scratch/issue85/evidence-lock.json`, con indice
`.scratch/issue85/README.private.md`. La review Standards/Spec e l’integrazione
spettano al root. Nessun push, PR o aggiornamento GitHub dal checkout assegnato.
