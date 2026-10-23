# Prove di fedeltà e primo incremento — proposta

Proposta del 23 ottobre 2026 per [Definire le prove di fedeltà delle regole e della campagna base](https://github.com/Ic3b3rg/lotr-table-game/issues/7), sulla [baseline concordata](fidelity-baseline.md). Il perimetro finale rimane l’intera scatola base e la campagna iniziale. Questa proposta non dichiara implementati il motore o il catalogo italiano.

## Contratto di verifica proposto

1. **Regole e carte:** ogni comportamento consegnato deve avere una fonte e prove dei casi normali e limite applicabili nella [matrice delle regole](../research/rules-fidelity-matrix.md). I testi tradotti conservano fonte e verifica degli effetti. Le discrepanze note rimangono esplicite; copie fisiche e modelli condivisi non vengono confusi.
2. **Prima avventura completa:** preparazione reale, ID 1 giocabile fino al campo e al caricamento dell’ID 2, entrambi gli esiti verificati, tutti i suoi eventi e rami inventariati. Includere salvataggio e ripresa durante prove, movimenti, attacchi e scelte; nessuna ricostruzione manuale della partita.
3. **Campagna completa:** tutte le 14 definizioni e i percorsi ammessi, con bivi, finali anticipati, condizioni, ricompense e ripresa. Non basta giocare una sequenza lineare. Il catalogo deve essere riconciliato nelle undici famiglie e nelle 343 copie, senza discrepanze sostanziali irrisolte.
4. **Casualità:** verificare algoritmi e parametri dove disponibili, invarianti e tracce ripetibili. Due avvii indipendenti possono produrre risultati diversi. Un seme del nuovo motore o poche partite osservate non dimostrano equivalenza con il generatore originale.
5. **Sessione:** mantenere il contratto approvato di salvataggio a ogni azione, recupero personale e gestione coerente dei reinvii. Verificare il gioco con un giocatore e 2–4 eroi e con gruppi di 2–5 giocatori. La prova fisica LAN senza Internet su Mac, Windows e telefoni resta necessaria e distinta dai test nei browser.

Questi criteri fissano il significato di “completo” per le due consegne giocabili. Le lacune che riguardano uno specifico effetto o contenuto non devono impedire di sviluppare le capacità indipendenti.

## Primo incremento proposto

**Portare eroi e mazzi reali nel tavolo già esistente**, con questa verifica visibile: da PC o telefono si scelgono eroi, ruoli ed equipaggiamento; ogni eroe riceve le carte iniziali corrette; ricaricando o recuperando il posto si ritrovano scelte e mazzi identici.

- Catalogo locale della base con identificativi fisici, copie, ranghi, testi italiani e provenienza. La [riconciliazione delle identità](../research/base-card-identity-reconciliation.md) fornisce le associazioni; gli abbinamenti candidati conservano il proprio stato.
- Assegnazione giocatore→eroi conforme alle regole, compreso il solitario. I dispositivi restano strumenti di accesso alla stessa sessione.
- Preparazione dei mazzi: sei carte base, cinque eroe, tre ruolo e una debolezza; prima carta ruolo preparata, altre quattordici mescolate. Stato completo conservato sull’host.
- Visualizzazione delle carte e dell’equipaggiamento su PC e telefoni, coerente con la direzione grafica già scelta.

L’incremento successivo aggiungerà prove, ispirazione, turni, movimento e combattimento reali; seguiranno automazioni, esplorazione e completamento della prima avventura. Questo ordine offre risultati verificabili mentre prosegue il lavoro sugli scenari.

## Evidenze e limiti attuali

Sono documentati 78 modelli oggetto associati alle 78 righe Base e alle 83 copie, le identità delle carte abilità con candidati e conflitti circoscritti, e il grafo statico delle 14 avventure. La matrice propone prove per 30 gruppi di regole, inclusi gli errata. Le prove del motore e i confronti runtime con l’app restano da eseguire.

La decisione e il dettaglio delle attività successive rimangono nel ticket di accettazione; la specifica e le issue di implementazione seguiranno il criterio concordato.
