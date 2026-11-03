# Risoluzione fisica coperta P0 — #63

3 novembre 2026, base `cb60ea4f9917cdd878ac8728d3025e7267870819`.
Autorità: [issue63](https://github.com/Ic3b3rg/lotr-table-game/issues/63),
[contratto61](../research/physical-resolution-runtime-contract.md), relativa
[review](../reviews/2026-11-03-physical-resolution.md), baseline, ADR0001/0002,
contratti e verifiche startup38, catalogo57 e freeze53. Issue letta tramite gh:
nessun commento; prerequisito61 chiuso. Spec, piano ed esecuzione inline già
autorizzati; review e integrazione al root, nessuna nuova approvazione di routine.

## Risultato e capacità

P0 consegna due mazzi comuni da28 copie, aree degli eroi e una risoluzione
coperta persistente integrata nel normale consumer scenario, HTTP e UI.
L'accettazione usa testi, parametri, capacità e stati **inventati**, esplicitamente
denominati prova sintetica. Il contenuto fisico è quello reale verificato; il
programma non è un incontro originale e non completa33. P1 resta responsabile
dei36 fronti e finestre; P2 di Ultimo Sforzo; P3 degli incontri originali.

Mappa delle capacità, nell'ordine di costruzione:

1. `physical-resolution`: modulo profondo, schema/programmi stretti, freeze,
   casualità separata, copie/zone, replay e vista pubblica.
2. `scenario-physical`: azione IR, continuazione/task e richieste fonte;
   dipende da1, riusa Store.once e tutti i controlli scenario38.
3. `physical-ui`: allocazioni, retro/conteggi, attesa, esiti e guida;
   dipende da2 e dalle sole proiezioni pubbliche.
4. Verifica HTTP/browser/recovery: attraversa1–3; nessun executor alternativo.

## Fonte e interfaccia

L'azione `physical` è ammessa soltanto nel manifest `synthetic-physical-p0`,
con tipo fonte `Synthetic.PhysicalProgram`, hash dei parametri e programma
bounded. Gli altri tipi fonte/opcode restano rigorosamente verificati.
Lo stato che la contiene ha una sola azione: il padre resta aperto fino alla
chiusura di tutti i figli, prima della transizione FINISHED. La prova riusa
preparazione/freeze/startup, con nome e messaggi esplicitamente sintetici.
Non aggiunge comandi di danno liberi o pulsanti debug alla partita originale.

Il programma fissa destinatari tramite slot della compagnia congelata,
ordine dei tipi, quantità, faccia, eventuali concessioni di prevenzione e
scarti. Ogni concessione fissa actor, budget e costo in crediti **sintetici
della fonte**, inizializzati dal programma e consumati una volta. Nessun
credito è Protezione, ispirazione o carta originale. Una concessione può
richiedere la stessa casella; il destinatario resta quello dell'istruzione.
Più concessioni sono risolte nell'ordine esplicito fonte. Il client alloca
danni/paure entro quantità residue e budget oppure lascia il budget inutilizzato.
Non sceglie importo della fonte, destinatario, origine o identità coperte.

Le risposte usano SCENARIO_INPUT con scenario/pack/proiezione, pending ID,
fingerprint del cursore, hero, generation e expectedRevision. La richiesta
fisica include padre, figlio e finestra; actor e destinatario sono distinti.
ACK non risolve un figlio. Una conseguenza obbligatoria non offre Annulla.
Operazioni automatiche consecutive si completano nella stessa transazione,
senza pause artificiali o conferme di lettura.

## Stato, casualità e confini

Schema11 aggiunge il consumer fisico privato nullable. Migrazioni1–10 lo
inizializzano a null e conservano pending generation, legacy scout/test/
round/travel, scenario, carte e ricevute. Nessun vecchio tavolo è avviato
retroattivamente. Freeze, geometria e RNG mappa restano identici.

All'avvio di un programma sintetico l'host carica il raw tramite
`requirePhysicalFamily(raw,'damage'|'fear')`, anche se diagnostico per benefici.
Conserva raw, hash byte/provenienza e fingerprint canonico nel salvataggio.
Una sola inizializzazione; dopo il commit nessun file pack è necessario.

Casualità privata `sha256-counter-rejection-fisher-yates-v1`: entropia256bit
generata dall'host una volta, parole uint32 derivate da SHA256 con contatore,
rejection sampling per indice uniforme, Fisher–Yates senza sostituzione.
Stream fisico distinto dal RNG mappa, nessuna parità Unity/System.Random
asserita. Stato e decisioni sono salvati e verificati dal replay.

Subire coperto trasferisce la cima alla vera area dell'eroe senza consultare
il fronte. Lo scarto sceglie casualmente solo coperte eleggibili, senza
sostituzione; restituisce sotto il mazzo pertinente nell'ordine materializzato.
Il programma distingue scarto obbligatorio e fino a N; la carenza normale
risolve quanto possibile, inferenza dichiarata nel contratto61. Zero e tutto
prevenuto producono completamenti persistenti. Ogni copia ha una sola zona,
sempre56 copie globali. Il padre conserva cursore, figli e ritorno once-only.

Fronti, passive/modificatori non certificati e Ultimo Sforzo mantengono gate
specifici. I limiti della prova sono esplicitamente sintetici ed effettivi,
non i limiti stampati degli eroi originali. Una policy che richiede capacità
non implementate sospende prima della conseguenza. La soglia viene verificata
alla barriera della fonte, senza inventare un Ultimo Sforzo. Mazzo realmente
vuoto: sospensione diagnostica sulla pesca precisa, conservando copie già
trasferite, costi, residui e continuazione; niente reshuffle o carta sostitutiva.
La domanda benefici57 rimane quella già pending, senza nuove quantità.

## Integrità e privacy

Il modulo ricostruisce mazzi/aree, decisioni, costi, finestre, cursori e figli
dal freeze, dal programma autorevole e dalle risposte registrate. Il consumer
riconcilia esplicitamente source-history, task-state, instance-state,
request-state, ricevute e allowScenarioPlay. Effetti/completamenti attesi
derivano dalle entry fonte e dai figli: eliminare entrambi i registri delle
ricevute non rende valido un effetto. Stato, scelta, costo, casualità, zone,
cursore e ricevuta sono atomici in Store.once. Retry identico restituisce la
ricevuta; intento diverso, stale, cross-hero/source o actor errato sono respinti.

La vista pubblica fisica espone solo tipo/faccia/conteggi, quantità, concessioni
legali, attore/destinatario, esito e prossimo passo. Non espone raw/fronti,
ID copia/definizione/hash identificanti, ordine, entropia o decisioni casuali.
Il resto della vista scenario resta compatibile. Nessuna route asset fisica.
Risposte, eventi, ricevute, reader, DOM e log devono rispettare questo confine.
Full backup e database host restano recupero privato amministrativo esplicito,
senza nuovo requisito di account o cifratura.

## UI e prove

Riutilizzare stile e componenti correnti: titolo sintetico, chi agisce e per
chi, quantità residue, budget/costo, allocazioni legali, retro/conteggi, esito
e passo successivo. Guida e backup disponibili, controlli nativi con label,
focus/status, layout320/768/1024/1440; nessun termine IR/RNG/frame nel flusso.

TDD con fixture pubbliche inventate, libreria e HTTP reali: input/bounds,
origini,56 copie, prevenzione/costi/cross-hero, zero, soglie/gate/vuoto,
ordine/scarti/casualità salvata, padre con almeno due figli, concorrenza,
duplicate intent, attori/cursori, SIGKILL, restore e alterazioni risignate.
Tre identità browser indipendenti su host/dati propri, solo UI per avanzare;
eventuale backup autentico importato dalla UI dichiarato come precondizione.
Riavvio/restore a ogni richiesta fisica disponibile, pack rimosso dopo freeze,
confronti readonly di gameplay e ricevute, recovery dei posti. Nessuna
scrittura API/SQLite per superare l'accettazione browser.

Sempre: solo checkout assegnato, dipendenze esistenti, scratch ignorata per
materiali/prove. Mai: altri agenti/checkout, install, GitHub write/push/PR,
modifiche a originali o fonti altrui, host4339/PID12892/dati utente.
Porta4353 solo libera; chiudere soltanto processi e schede propri.
Consegna: npm test/typecheck/format:check/diffcheck, report riproducibile di
fonti/hash/prove/limiti, commit ordinati e checkout pulito. Nessuna certificazione
di telefoni fisici/LAN/Windows/Safari o intera avventura33.
