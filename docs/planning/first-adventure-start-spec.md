# Avvio della prima avventura — #38

Base `cba8ad5a7d0709990faae0cbed3d407d35bb10f0`, 3 novembre 2026.
Autorità: issue38 e tre commenti letti il3novembre, contratti
[principal](../research/first-adventure-runtime-contract.md),
[realizzato](../research/first-adventure-realized-runtime-contract.md),
[generatore](../research/first-adventure-map-generator-contract.md),
[movimento](../research/map-movement-contract.md), freeze53 e ADR0001/0002.
L'esecuzione è autorizzata integralmente nel checkout T3 assegnato; review e
integrazione sono del root. Nessun subagente, altro checkout, installazione,
Unity, modifica a originali o scrittura GitHub.

## Risultato e confine

Da «mappa salvata» il gruppo avvia l'avventura con contenuti italiani privati,
completa lo startup fonte e raggiunge obiettivo0 e un turno legale. La
realizzazione `mapGeneration.frozen` e tutti gli snapshot RNG restano immutati.
Il gameplay aggiunge binding/visibilità/esplorazione/posizioni separati.
Una vecchia mappa, Scoperta o prova non certifica l'avvio A1.

Il pacchetto locale contiene IR tipizzata, provenienza, manifest delle closure
certificate e testi risolti con insert/icon/markup. È validato e congelato nella
sessione; dopo l'avvio reload/backup non richiedono fonti o pacchetto su disco.
Un prefab senza closure o un'azione sconosciuta blocca prima degli effetti.
Le nuove dipendenze sono compilabili da un manifest verificato, non da un
elenco di seed ammessi. H3 e compagnia UI sono verifiche distinte.

## Runtime e richieste

Istanza stabile per principal/timer/prefab effettivo; binding locali/globali,
Space, tile hash e world position. Gli entry path di tutti i prefab scelti
sono eseguiti in spawn order prima di `SCENARIO_BEGIN`. Azioni istantanee,
popup aperto, completamento azione, ProcessingState e FSM stopped sono stati
distinti. Le azioni concorrenti dello stesso stato entrano in ordine fonte.
I ricevitori nascosti restano registrati. Un broadcast non è RaiseEvent.

Sequenza: threat15; intro ordinaria; reveal302A; eroi a Spaces[1] e Scoperta2
separata per ogni eroe; auto-explore302A in space order con PRE_REVEAL e
REVEALED effettivi e NoInspiration; reveal/explore custom100A; persona e flip
del timer una sola volta; reveal sezione1 in tile order; Spirito1 per ogni
eroe, conversioni/scarto/esito e ricompensa capped; obiettivo0; singolo
handoff a round1. Nessun costo azione, rally shuffle o bonus Aragorn nel setup.
Il premio al limite completa con incremento zero.

Il controllo bounded delle abilità già preparate include anche i trigger
obbligatori della preparazione. Il pack può compilare un guadagno di
ispirazione identificato e vincolato all'intera definizione di carta verificata;
il consumer lo registra una sola volta prima di SCENARIO_BEGIN. Un trigger
che richiede capacità fisiche non implementate resta un blocker esplicito
per quella preparazione, senza applicare il solo testo come effetto. Questo
non abilita le altre capacità delle carte. L'ingresso richiede la preparazione
iniziale di ruolo, distinguendola da Scoperte libere legacy già risolte.

Ogni comando porta identità autenticata, generation, expectedRevision,
scenario/pack/projection fingerprint, pending request e source cursor, più
hero/actor quando richiesto. La transazione conserva effetto, cursore, prova
di completamento e ricevuta. Duplicati/stale/cross-request/restore non
ridisegnano carte né riapplicano eventi/reward/flip/handoff. Non esistono
ACK per sostituire Scoperta o prove, né START_SCOUT libero durante startup.

## Compatibilità e UI

Schema10 migra1–9 aggiungendo soltanto scenario null: conserva pending
generation, ricevute, preparazione, copie, prove, Scoperte e turni legacy.
I validatori consentono consumer della nuova avventura solo se legati alla
proiezione e al runtime; restano rigorosi per consumer legacy.

La UI riusa il sistema grafico esistente. Nome/istruzioni/obiettivo italiani,
chi agisce e prossima azione sono visibili; guida e backup sono sempre
raggiungibili. Markup tramite nodi DOM consentiti e icone con nomi leggibili,
mai HTML arbitrario o caratteri PUA non risolti. Tastiera, focus e status
annunciabili; controlli usabili a320/768/1024/1440px.

La mappa deriva dalla geometria completa, traslata/scalata con margine senza
tagliare poligoni. Gli ID conservano un mapping stabile. Movimento/vicinanza
usano movementGraph; il grafo fonte degli incontri resta intatto. Solo tessere
e nodi rivelati dal runtime sono mostrati. Ispezione/cancel sono gratuiti;
commit di interazione ed esplorazione ulteriore restano gated sulle capacità
effettive. Gli ACK Ombra legacy non eseguono la nuova avventura.

## Accettazione

Fixture pubbliche inventate; test HTTP di ordine/eventi/actor, carte per eroe,
conversioni/cap, popup/binding/flip, idempotenza, backup/ripresa a ogni richiesta,
migrazioni e mismatch fonte. Tre identità browser indipendenti, import del
backup UI autentico53, poi soli controlli UI fino al primo turno. Interruzioni
in intro/Scoperta/prova/conversione/placement/obiettivo/handoff confrontano
runtime, map/RNG, mazzi e ricevute. Host/dati isolati,4339 intoccabile.

Verifiche finali: npm test, typecheck, format:check, git diff --check;
manifest e script privati riproducibili, rapporto pubblico di soli metadati.
Nessuna certificazione Unity/JIT, telefoni/LAN/Safari o avventura completa.
Inventario successivo: interazioni ed effetti fisici, danni/paure/last stand,
combattimento, minaccia/timer, progressione, esiti/campo/ID2; non sono consegnati
da questo incremento e non richiedono di attendere quantità dei benefici.
