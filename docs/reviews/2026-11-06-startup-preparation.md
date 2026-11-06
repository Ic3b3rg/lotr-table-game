# Review e integrazione della preparazione iniziale — #65/#33

Base `d89132020df2ba0393ed7c665bb70525411a5118`. Consegna
`8212b79f325ebaec39b7e0a54d77eb30b8059bc4`, integrata mediante cherry-pick
fino a `6c99d2b` con albero completo identico. Correzione Root e prodotto
finale verificato: `68cf5ebb317450453fb7ecc4dcd3013ae98bd87b`.

## Standards e Spec

Le due review indipendenti hanno riprodotto lo stesso **P1**: il nuovo
prefisso fisico dello startup impediva il passaggio al ciclo originale,
che richiedeva ancora un registro vuoto. Anche seed e replay avrebbero
scartato quel prefisso. La prova UI della consegna usava uno scope fisico
inventato e non copriva questo confine del consumer originale.

Root ha riprodotto il fallimento dell'ultimo ACK e corretto il confine:
preparazione iniziale di ruolo e servizi di setup conclusi rimangono nel
seed immutabile e nel replay. I padri delle interazioni successive vengono
ricostruiti dal registro del ciclo. Il conteggio del prefisso è limitato
alla fonte attestata; i pack senza marker conservano il comportamento
storico. Nessuna cronologia viene esentata dalla riconciliazione.

La nuova review circoscritta alla correzione giudica il P1 **ADDRESSED**
su entrambi gli assi, senza nuova regressione sostanziata. Non restano
finding aperti per questa integrazione.

## Verifiche Root

La regressione con input inventati ma scope del consumer originale copre
entrambe le scelte di preparazione della Scoperta: ultimo ACK, primo turno,
viaggio, movimento, interazione e figlio fisico. Verifica SIGKILL, riavvio
senza pack, backup completo, ricevute, recupero personale e ripresa della
conseguenza. Quattro alterazioni risignate del prefisso sono respinte.
La matrice finale passa **2/2**, exit0; il gruppo mirato passa **18/18**,
exit0. RED e fallimenti intermedi del supporto di prova sono conservati.

Sul prodotto finale congelato `68cf5eb`, `npm test` è stato eseguito una
sola volta, senza altri carichi di verifica, con concorrenza4:
**998/998, exit npm0**, zero fail/cancel/skip/todo, durata Node
`1210842.928667` ms. Stderr vuoto. Sorgenti e tutti i26 file dist sono
identici prima e dopo. Build, typecheck, formato e diff risultano verdi;
nessuna dipendenza, soglia o timeout è stata modificata.

Il parser del riepilogo privato cercava il prefisso TAP `#`, mentre Node
ha emesso `ℹ`: i campi footer della ricevuta originale sono quindi null.
Root ha verificato il footer completo nel log grezzo e registrato una
lettura supplementare, senza modificare ricevuta/log o ripetere la suite.
Manifest della canonica: **1126 byte**, SHA256
`5511750530ff2ad73c514cad766f6f9c7bea1a0760908a02d606583dc045acf2`;
tutti i sei file elencati sono verificati indipendentemente.

Le161 prove private della consegna sono state verificate per percorso,
dimensione e hash. Manifest: **27263 byte**, SHA256
`36f003d14b659ec9f84ffa1657de12b687fb692b4f56f13670c740bf59f5d2b0`.
Il validator integrato accetta invariati tutti i27 payload completi dei
backup UI inventati. La compilazione del pack sorgente storico e quella
della prova UI restano identiche. Tra bundle del child e bundle Root
cambiano soltanto95 commenti generati da esbuild con il percorso delle
dipendenze: dopo quella precisa sostituzione, ogni altro byte coincide.
I due hash grezzi rimangono distinti e conservati.

## Portata dell'accettazione

La UI della consegna attraversa il percorso con tre identità personali,
vista condivisa e larghezze320/768/1024/1440; comprende scelta della paura,
attesa degli altri giocatori, guida, primo turno e restore senza pack.
Questi input sono inventati. La regressione aggiunta da Root esercita lo
scope originale tramite HTTP, sempre con carte e istruzioni inventate:
non è una partita originale o una nuova accettazione UI originale.

Schema30 introduce la capacità prospettiva attestata; nessun retrofit
dei salvataggi storici. #57 mantiene tutte e tre le quantità
`null/unverified/blocked`;156 resta statico/gated. Telefoni fisici, LAN,
Windows e Safari non sono certificati. #65, #89 e #33 rimangono aperte
per i rispettivi criteri residui e per la partita originale completa.
