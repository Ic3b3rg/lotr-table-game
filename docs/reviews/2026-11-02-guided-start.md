# Revisione dell'avvio guidato

Diff fissato `f628708...45db4f3`, commit `74e9a10`, `45db4f3`, issue #34 e
[specifica](../planning/guided-start-spec.md). Due revisori indipendenti in
contesto nuovo, più revisione UI e controllo documentale del flusso Impeccable.

## Standards

Nessuna violazione documentata. Un odore facoltativo P3: la decisione di
compagnia completa era duplicata fra guida e pulsante dei mazzi. Corretto
riusando `rosterProblem` anche sulle proiezioni pubbliche; nessun cast o
abbassamento dei controlli. Gli strumenti verificano tipi e formato.

## Spec

Due rilievi P2, entrambi riprodotti dal revisore sul controller effettivo:

- Il polling poteva sostituire il numero di giocatori non ancora confermato
  e chiudere il modulo. La correzione mantiene i dati locali, distingue gruppo
  salvato e scelta da confermare, e offre annullamento esplicito.
- Un salvataggio precedente con carte aperte senza mappa/round veniva mandato
  al passo mappa, dove le carte erano nascoste. Ora una pesca pendente ha
  precedenza; dopo la risoluzione si torna al passo mappa.

Correzioni in `ae5384a`, verificate dall'implementatore con browser reali:
concorrenza sul secondo tavolo e due fixture di sola vista per la regressione
legacy. Nessuna ulteriore revisione delegata delle piccole correzioni Spec.

## UI

Prima disposizione **recapture**: le catture complete erano state prodotte a
pagina scorsa e rappresentavano male l'intestazione sticky. Ripetute da scroll
0, quindi nuova revisione completa. Il revisore conferma coerenza con le
superfici esistenti e le evidenze del flusso, senza certificare l'avventura.

Un P2: l'apertura globale della guida saltava al primo articolo nascondendo
ricerca e indice. Corretto; la successiva verifica delle catture e del codice
ha giudicato quel rilievo **risolto**, disposizione **ship** per il perimetro
esaminato. L'aiuto contestuale continua a raggiungere l'articolo pertinente.

Conteggi iniziali: Standards **0 violazioni + 1 odore corretto**, Spec **2
corretti**, UI **1 corretto**. [Evidenze e limiti](../testing/guided-start-verification.md).

Il controllo documentale indipendente conferma palette e font preesistenti,
aggiorna solo le capacità e le evidenze in `PRODUCT.md`, e conserva `DESIGN.md`.
Il suo perimetro limitato al diorama e l'assenza del sidecar sono precedenti.
