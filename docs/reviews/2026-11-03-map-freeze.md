# Revisione del congelamento A1 nella sessione

Issue #53, completamento del generatore/congelamento #41; base `b9c0f46`,
head revisionato `41fb60d`. Due revisori freschi, Standards e Spec separati.

## Standards

Zero violazioni documentate di ADR, vocabolario, seam di verifica e confine
privato. Un suggerimento facoltativo P3: condividere i controlli della catena
retry ripetuti in generation-state.ts e validate.ts. È un possibile costo
di manutenzione, senza comportamento errato immediato; estrazione rinviata.

## Spec

Due P2 confermati:

1. Il validatore offline accettava seedArray geometrici/finali alterati
   dopo rehash. Forma, seed e ordinale non dimostrano che gli slot siano
   coerenti. Ora ricostruisce uno stream RNG locale dal seed, controllando
   tutti gli slot ai checkpoint, inclusi i retry con snapshot. Il lavoro
   è bounded dai budget di operazioni già fissati dalla policy; non avvia
   il generatore e non consuma RNG o stato della sessione. Una regressione
   rossa→verde copre entrambi gli snapshot e il rifiuto di ordinali eccessivi.
2. Il timeout non invalidava l'identità del worker. Un exit/error tardivo
   poteva mettere in pausa la ripresa dello stesso job, oppure un message
   tardivo poteva pubblicare il vecchio risultato. Ora il worker scaduto
   viene invalidato prima di rendere disponibile la ripresa; ogni callback
   verifica l'attivazione corrente. Tre regressioni rosse→verdi eseguono
   gli handler reali con Worker/timer controllati, senza attese o host live:
   exit, error e message vecchi non alterano il nuovo lavoro, che completa.

Correzioni dell'autore nell'unico passaggio dopo la review, senza seconda
certificazione delegata. I test del worker sostituiscono solo il confine
esterno di thread/timer e usano il servizio reale; le transazioni/ricevute
restano coperte dai test HTTP del modulo.

## Verifica root e accettazione

**301/301** test, zero skipped, typecheck/format/diff con exit0. Root ha
rigenerato la proiezione H3 e confrontato geometria, movimento, incontri,
spawn, storia e RNG con le evidenze precedenti; fingerprint e 226.688 byte
restano identici dopo le correzioni. L'ordine degli oggetti della compagnia
reale viene preservato, senza forzarlo alla fixture.

Ripetuto in scratch root il validatore degli artefatti UI del child: tre
identità, pending da crash, ripresa esplicita, reload e restore senza pack,
mappa/mazzi/RNG/storia/ricevute identici. La prova browser, tastiera e viewport
è stata eseguita dal child; il root ha verificato gli artefatti e i controlli
offline, senza ripetere l'intera partita UI. Nessuna modifica UI è intervenuta
nel passaggio di correzione. Host utente 4339/PID12892 conservato.

Prove private root: `.scratch/map-freeze-root-review/`. Il risultato resta
pre-startup: nessuna FSM o effetto eseguito, nessuna parità Unity/JIT.
#38 deve consumare il dato salvato, chiudere i prefab della realizzazione
effettiva e governare per-hero Scoperta 2/Spirito 1, piazzamenti e obiettivo.
#33 richiede ancora tutta l'avventura, i due esiti e campo/prosecuzione.

Esito: Standards 0 violazioni / 1 suggerimento facoltativo rinviato;
Spec 2 P2 corretti con quattro regressioni rosso→verde.
