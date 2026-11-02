# Revisione delle primitive del generatore

Issue #44, base `d1f3df5`, head revisionato `5c52a7f`.
Due revisori freschi hanno confrontato separatamente standard e specifica.

## Standards

Zero violazioni documentate e zero smell da segnalare. I dieci file
revisionati rispettano AGENTS, vocabolario e ADR. Aritmetica delle fonti,
contatore, stato copiato/validato e Comparison sort restano nel modulo;
nessuna modifica al salvataggio attivo. Politica float32 ed evidenza IL
sono distinte dalla parità col runtime Unity.

## Spec

Zero requisiti mancanti/parziali, comportamenti aggiunti fuori ambito o
implementazioni errate rilevate. Confrontati direttamente con i corpi IL:
inizializzazione unchecked, seme minimo, campione massimo, double e large-range;
intervalli vuoti/unitari, shuffle singleton, isolamento dello stato e indici;
contatore prima della mutazione; pari, ordine dei confronti, insertion,
pivot, ricorsione destra, profondità e heap. Il revisore ha eseguito le
undici prove della build pubblica: 11/11.

Il revisore non ha certificato autonomamente l'audit di ricerca completo,
la matrice privata più ampia o il comportamento Unity/JIT/mappa completa.
La [verifica dell'autore](../testing/map-source-primitives-verification.md)
ne riporta evidenza e limiti senza attribuirli alla revisione indipendente.

Esito: Standards 0 / Spec 0, nessun miglioramento rinviato da questa revisione.
Suite completa dell'autore 102/102, tipi, formato e diff check superati.
#41/#38/#33 restano aperte.
