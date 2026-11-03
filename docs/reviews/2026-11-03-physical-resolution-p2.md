# Review Ultimo Sforzo P2 — #69

Diff fisso `fa110b6...7446b60`, Standards e Spec in due reviewer indipendenti.
Autorità: [issue69](https://github.com/Ic3b3rg/lotr-table-game/issues/69),
spec/piano P2, contratto61, standard e ADR. Probe sintetici in memoria;
nessuna modifica, host o browser dai reviewer.

## Standards

**Un P2, corretto.** La barriera assegna `child=children.length`, ma le
risposte ammettevano solo0–31. Con32 figli la richiesta si apriva e nessuna
risposta passava lo schema. Il campo ora ammette32; la regressione completa
Ultimo Sforzo dopo31/32 figli, con serializzazione e ritorno singolo, senza
ridurre il programma ammesso. Nessun altro finding o smell sostanziato.

## Spec

**Un P2 e un P1, corretti.**

- P2: la scelta globale permetteva al primo proprietario di fissare il tipo
  danni/paure di un altro eroe. Ora il gruppo sceglie l'eroe e il suo
  proprietario sceglie il tipo prima della selezione; attore estraneo respinto.
- P1: il set dei tipi già conclusi impediva un nuovo obbligo quando una
  reazione faceva raggiungere di nuovo lo stesso limite. Ora la soglia viene
  ricontrollata, mentre solo le reazioni concluse sono deduplicate. La nuova
  selezione ha identità distinta e deve terminare prima del ritorno. Il test
  riproduce successo, nuova sofferenza e successivo fallimento forzato.

Nessun altro requisito mancante non dichiarato o scope creep sostanziato.
La QA precedente resta distinta dal codice corretto; T14 automatico/HTTP
non viene presentato come fallimento forzato verificato nel browser.

## Verifica root

**510/510 test**, zero skipped; typecheck, formato e diff verdi. Tre
regressioni RED→GREEN.624 hash e checker indipendente ripetuti;64 vecchi
backup classificati53 validi/11 invalidati dalla correzione prepubblicazione.
Nuova QA a tre identità su2642a88: delega del tipo, prove/costo, restart e
restore integrale, titoli/lettore e sconfitta con superstiti.43 nuovi backup
e sigillo406 file verificati; limiti del focus durante cattura e degli
asset dell'ambiente dichiarati nel [rapporto](../testing/physical-resolution-p2-verification.md).
Nessun rilievo aperto: Standards1 P2 corretto; Spec1 P1+1 P2 corretti.
