# Piano #67

[Specifica](physical-resolution-p1b-spec.md). Esecuzione inline, TDD ai seam
già autorizzati; nessuna delega o approvazione aggiuntiva.

1. RED HTTP fine turno con persistente; GREEN fonte ordinaria, sospensione,
   ritorno, schema13/migrazione e ledger verificato. Commit del primo percorso.
2. RED budget viaggio e contesto storico; GREEN budget effettivi e grafo
   corrente per fonte, distinguendo vicino da stessa casella.
3. RED Riposo e reazioni/preparate; GREEN policy confermate, costo reale,
   coperte miste, seguito della copia pagata e cessazione dopo Riposo.
4. RED Riorganizzazione/prove pertinenti; GREEN ricomposizione/Scoperta vere,
   passive, vincoli e trigger nel ledger unico. Gate specifici per consumer
   mancanti, inventario del seguito distinto da67.
5. RED recovery/tamper; GREEN receipt/intent, replay integrale, retry,
   concorrenza, crash e restore senza pack. Conservare le quattro regressioni66.
6. UI ordinaria e tre identità, preview prima e fallback solo documentato;
   avanzamenti esclusivamente UI, ripresa durante figlio, viewport e privacy.
7. Verifica privata mirata, suite completa/typecheck/formato/diff,
   manifesto/report e audit storia Git; commit ordinati, cleanup proprio.

## Aggiustamento dalla prova browser

Il browser ha riprodotto il commit oltre il timeout HTTP di cinque secondi
con il ledger cresciuto: il profilo attribuisce il costo ai replay ripetuti,
non a SQLite. Il raccordo può riusare un solo prefisso canonico già calcolato,
con chiave completa del contesto e confronto dei record. Ogni output resta
confrontato con il replay; copie difensive, modifiche del contesto o del
prefisso e restart non devono introdurre esenzioni. RED: abort nativo a
5.003 secondi con commit singolo; GREEN da verificare nel browser e con le
prove di alterazione/ripristino già previste, prima di ripetere la suite.
