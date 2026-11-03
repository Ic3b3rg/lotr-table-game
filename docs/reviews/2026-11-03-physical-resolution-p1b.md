# Review ciclo ordinario P1b — #67

Diff indipendente `5cbf06a...3113e29`, due reviewer Standards e Spec.
Autorità: [issue67](https://github.com/Ic3b3rg/lotr-table-game/issues/67),
spec/piano P1b, contratto61, review P1a e ADR0002. Integrazione e correzioni
al root; nessuna modifica dai reviewer.

## Standards

**Un P1, corretto.** Il nuovo seguito dopo Protezione ricalcolava una
ricompensa diversa anche nei run P1a già conclusi o sospesi. Un salvataggio
valido della base veniva rifiutato dal nuovo replay. La correzione distingue
esplicitamente le regole dei nuovi run dalla semantica storica senza
riscriverne i costi o le risorse. Regressione su completamento e continuazione;
confronto aggiuntivo con il codice pubblicato compilato in memoria.

Nessun altro finding o smell sostanziato. Esaminati cache Store e prefisso
canonico, copie difensive, contesti, ledger/ricevute, privacy, limiti e
migrazioni. Le ottimizzazioni non esentano dal confronto degli output
persistiti o dalla validazione di byte cambiati.

## Spec

**Un P2, corretto.** Il primo ledger accettava un numero di round inventato:
la presenza del ciclo eliminava il vincolo round1 della fonte. Il probe
con round999 e ricevute coerenti passava i parser. Il confine ora verifica
round1/Fase di Azione sul seed del handoff; i progressi successivi rimangono
ricostruiti dal ledger. Regressione HTTP con backup alterato e risignato,
rifiuto422 e tavolo invariato.

Nessun ulteriore finding su costi, vicinanza/Protezione, Riposo o Scoperta;
nessuno scope creep sostanziato. La scelta della combinazione dei tipi nel
Riposo non è stata segnalata senza norma primaria contraria. P2, consumer
originali e acquisizioni restano seguiti espliciti, non completamenti dichiarati.

## Verifica root

**482/482 test**, zero skipped; typecheck, formato e diff verdi. Due
regressioni RED→GREEN, più controllo della capacità nuova ancora attiva.
161 hash, checker indipendente e replay di17 backup ripetuti su copie
separate; confronto integrale di restore e freeze. I reviewer non hanno
avviato host/browser: QA effettiva e controllo di artefatti sono distinti
nel [rapporto](../testing/physical-resolution-p1b-verification.md).

Nessun rilievo aperto: Standards1 P1 corretto, Spec1 P2 corretto.
