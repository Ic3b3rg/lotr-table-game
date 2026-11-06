# Trigger di preparazione nello startup — seguito #65/#33

Base `d89132020df2ba0393ed7c665bb70525411a5118`. Autorità: [#65](https://github.com/Ic3b3rg/lotr-table-game/issues/65),
[#33](https://github.com/Ic3b3rg/lotr-table-game/issues/33),
[contratto fisico](../research/physical-resolution-runtime-contract.md),
[startup](../research/first-adventure-runtime-contract.md) e
[riferimento di fedeltà](fidelity-baseline.md). Questo seguito collega una
capacità già implementata nel kernel al normale avvio; non certifica una
partita originale completa.

## Comportamento richiesto

La preparazione iniziale di ruolo e quella della Scoperta iniziale eseguono
gli effetti attestati `afterPrepare` nel controller fisico esistente.
L'ispirazione rispetta il limite e l'ordine delle istruzioni. Girare coperta
una paura scoperta conserva copia e zona: zero bersagli prosegue senza una
scelta vuota, un bersaglio segue la selezione automatica già prevista dal
kernel, più bersagli richiedono la scelta del proprietario. Le altre
identità attendono; non esistono quantità, programmi o conferme di effetto
liberi inviati dal client.

La Scoperta conserva rivelate, preparata, ordine cima/fondo e scarto per il
limite quattro. Il trigger segue la semantica corrente del kernel anche
quando la carta appena preparata viene scelta per lo scarto imposto dal
limite. Il padre restituisce una sola volta al medesimo messaggio fonte;
il prossimo eroe, le prove iniziali, obiettivo0 e il primo turno restano
ordinati dal consumer scenario.

## Capacità e compatibilità

Un marker prospettivo nel manifest lega la capacità al fingerprint
dell'artifact dei fronti, al catalogo e alla prova. Il compiler richiede un
certificato del marker; prima dello startup il freeze verifica artifact,
catalogo e tutte le policy storiche interessate. Nessun dispatch usa nomi,
testi o identità originali. Input assente, incompleto o diverso è respinto
prima di qualsiasi mutazione persistente.

Per questa capacità, anche Scoperta e prova iniziali attraversano il kernel:
non è possibile aggiungere il solo trigger mantenendo discontinuità nelle
risorse tra padri fisici. Nuovi figli tipizzati delegano alle operazioni
esistenti di preparazione, Scoperta e prova. I risultati di setup sono
proiezioni delle esecuzioni ricostruite, non un secondo motore di effetti.
Una continuazione di startup conserva fonte/entry/azione/eroe e padre; le
risposte usano le normali richieste fisiche della UI.

Lo schema30 introduce queste forme. La migrazione da1–29 è strutturale:
non aggiunge marker, trigger o ricompense. Forme nuove mascherate da schema
storico sono respinte. I pack privi del marker conservano il gate
`faceup-fear-flip`, le ricompense storiche e il replay pubblicato.

## Registro, recovery e riservatezza

Il primo padre fisico deriva esclusivamente dalle carte di ruolo realmente
preparate all'origine. I padri successivi derivano dai messaggi scout/spirit
compilati e dall'ordine della Compagnia. Programmi, risorse continue,
risultati, task, source-history e ricevute devono essere tutti riconciliati;
nessuna esenzione di replay. Il solo registro fisico governa trigger,
casualità, zone, costi e figli.

Retry, concorrenza, cursori e revisioni superati, attore estraneo, crash
prima della scrittura, restart e restore packless attraversano Store.once.
Tutto il prefisso commesso e le ricevute sono conservati. Modifiche coerenti
a due copie della cronologia non possono sostituire la fonte congelata.
Le API, gli eventi e la UI mostrano soltanto fronti scoperti e conteggi dei
coperti; backup amministrativi e prove con input originali restano privati.

## Prove e limiti

RED HTTP significativo con input inventati, poi casi zero/una/più paure,
ordine e ispirazione cappata, limite delle preparate, sorgenti incomplete,
continuazioni e primo turno. Tre identità personali indipendenti e vista
condivisa attraversano la UI, con guida/lettore e320/768/1024/1440.
Recovery e manomissioni hanno prove HTTP/SQLite mirate. Sul prodotto finale
una sola canonica `npm test` a concorrenza4, senza carichi pesanti paralleli,
più tipi/formato/diff/privacy; nessuna dipendenza o soglia modificata.

I test positivi sono inventati. Le quantità #57 rimangono null/unverified/
blocked: nessuna riserva ipotizzata, nessun avvio originale o ripresa156.
Review Standards/Spec e integrazione appartengono a Root; #65/#33 restano
aperte per i requisiti sostanziali residui. Nessuna scrittura remota o email.
