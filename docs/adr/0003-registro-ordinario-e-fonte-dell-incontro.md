# Comandi ordinari e fonte dell'incontro nello stesso registro

Nel primo incontro originale il viaggio può essere interrotto da una prova,
da un suo figlio e da conseguenze fisiche, prima di riprendere con il movimento
residuo. Il registro originale v2 conserva un'origine immutabile allo startup
completato, round1/Azione, e ricostruisce in ordine comandi ordinari e fonte.
Aggiornare l'origine a ogni conseguenza cancellerebbe la prova del costo e
della posizione; registri separati non dimostrerebbero il loro interleaving.

Il manifest dichiara il singolo prefab la cui closure è verificata. La
conferma paga l'azione; prove, scelte e conseguenze proseguono quel tentativo
nella stessa transazione del rispettivo comando. I frame della fonte restano
separati dai completamenti iniziali per eroe. Il risultato del padre è
persistito prima di iniziare nuove scelte, anche se un figlio sconfigge l'eroe.

Lo schema15 introduce questa capacità senza reinterpretare i run pubblicati:
il registro v1 e le regole storiche per run mantengono i loro validatori e
l'attivazione P2 esplicita. Il registro v2 confronta tutti gli output e le
ricevute ricostruiti, senza esenzioni per lo scenario originale. Il costo è un
secondo percorso di replay e una migrazione esplicita; consente di preservare
salvataggi esistenti e diagnosticare modifiche coerentemente risignate alla
storia. Perimetro e prove sono nella
[specifica dell'incontro](../planning/original-encounter-spec.md) e nel
[report di verifica](../testing/original-encounter-verification.md).
