# Revisione della selezione delle sezioni

Issue #46; base `e66317d`, head revisionato `c9f9e45`.
Due revisori freschi hanno valutato Standards e Spec separatamente.

## Standards

Zero violazioni documentate. Vocabolario, ADR, isolamento da host/sessione e
confine dei materiali privati rispettati. L'I/O condiviso conserva lettura
limitata e scrittura esclusiva; l'evidenza pubblica non contiene identità
delle tessere selezionate.

Un suggerimento facoltativo: riunire l'invalidazione della cache dei tratti
in add e rollback in un helper. Rinviato, senza impatto sul comportamento;
i due percorsi restano coperti dalle prove. Nessun blocco Standards.

## Spec

Due difetti importanti trovati confrontando le fonti:

1. Con H>1 e tutte le sezioni IgnorePlayerScaling, il codice mescolava i
   quattro builder e consumava il budget in un ciclo senza assegnazioni.
   `CreateMap 06001319:03b8–03e9` salta entrambi i passaggi. Regressione CLI
   rossa→verde: H2/H5 ora selezionano con zero extras e identico stato RNG
   del corrispondente H1, senza i quattro campioni aggiuntivi.
2. Un minimo superiore al massimo poteva produrre `selected` con uno start
   esplicito. `InitializeSection 06001345:0000–0018` si ferma prima di creare
   la sezione. Regressione CLI rossa→verde: la validazione rifiuta il pacchetto
   contraddittorio e non crea output. La politica è dichiarata nella specifica.

Le correzioni sono state eseguite dall'autore nell'unico passaggio successivo
alla review. Il revisore non è stato incaricato di una seconda certificazione.
Non ha rilevato altri problemi nei pool, lookup, ordine RNG, matching, trie,
rollback, optional e pubblicazione esclusiva.

Verifica root dopo le correzioni: **151/151** test, tipi, formato e diff check
verdi; **47/47** casi A1 ripetuti, con identica impronta dell'evidenza privata
`e753d279a8f1cec775d1cbe95010dfc0face6667aabd86a296a773c9e6374a9a`.

Restano fuori dalla certificazione del revisore: matrice privata, geometria,
assegnazione degli incontri, startup, freeze e parità Unity completa. Sono
limiti già dichiarati dell'incremento; #41/#38/#33 restano aperte.

Esito: Standards 0 violazioni / 1 suggerimento facoltativo rinviato;
Spec 2 difetti importanti corretti con regressioni rosso→verde.
