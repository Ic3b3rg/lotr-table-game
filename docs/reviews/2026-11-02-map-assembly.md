# Revisione dell'assemblaggio delle sezioni

Issue #48; base `2006ca2`, head revisionato `64290a9`.
Due revisori freschi hanno valutato Standards e Spec separatamente.

## Standards

Zero violazioni documentate. Confine privato, vocabolario, ADR e isolamento
da host/sessione rispettati. Un possibile Duplicated Code: il PrefixTree
locale ripete l'algoritmo del SequenceTree della selezione. Estrazione
condivisa facoltativa rinviata; gli stati delle due fasi rimangono separati
e verificati. Nessun blocco Standards.

## Spec

Tre difetti P2 confermati confrontando le fonti:

1. Il getter BoundingSphere della sezione target veniva saltato quando il
   valore era scartato. `A132a:0162–0173` ne richiede comunque l'effetto
   sulla cache (`A0e3f`). Corretto prima dell'enumerazione delle ancore,
   dopo i controlli di connectability/permission. Regressione senza
   required joins: la cache della radice viene ora popolata.
2. Il validatore rifiutava una traccia replay vuota, benché un fallimento
   della selezione prima del clock producesse esattamente quella traccia.
   Ora accettata; le osservazioni residue continuano a essere rifiutate.
3. LastAttachedTileId veniva azzerato a ogni tentativo. `A3ca4` scrive −1
   soltanto nei tre ritorni espliciti senza scelta; un'eccezione durante
   l'enumerazione conserva l'ultimo successo. Spostate le scritture e
   aggiunta l'asserzione al caso con lista piazzamenti vuota.

Ogni regressione è stata osservata rossa prima della propria correzione,
poi verde. Le correzioni sono dell'autore nell'unico passaggio successivo
alla review; nessuna seconda certificazione delegata. L'audit residuo non
ha rilevato ulteriori violazioni dei requisiti dell'incremento.

Verifica root: **193/193** test, zero skipped, tipi/formato/diff verdi.
Il caso H3/seed1 rigenerato e controllato separatamente conserva geometria,
trace, RNG e grafo rispetto al risultato del child. Il replay consuma tutte
le **91.998** osservazioni e riproduce i campi realizzati e diagnostici.
Il checker Python privato verifica anche la cache target introdotta dalla
correzione; nessuna equivalenza con Unity/JIT viene dedotta da questo fatto.

Il [contratto del movimento](../research/map-movement-contract.md) resta
un follow-up distinto. Incontri, freeze e avvio sono fuori da #48;
#41/#38/#33 rimangono aperte.

Esito: Standards 0 violazioni / 1 suggerimento facoltativo rinviato;
Spec 3 difetti P2 corretti con regressioni rosso→verde.
