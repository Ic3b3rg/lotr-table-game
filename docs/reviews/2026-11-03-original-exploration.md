# Review dell’esplorazione originale — #73

Diff fissato `821f9d5...404cd93`, otto commit di integrazione.
Due reviewer indipendenti in sola lettura; fonti: issue73, specifica/piano,
contratti principal e realizzato, GLOSSARY e ADR0001–0003.

## Standards

**Un P2: verificare la continuazione completa prima dell’ingresso.**
`shared/exploration.ts:13–17` controllava soltanto i due handler differiti.
Un pacchetto accettato dal compiler poteva contenere REVEALED e il messaggio,
ma rinviare la transizione FINISHED verso il rilascio. Il fingerprint
pubblicizzava la destinazione; ingresso e intro consumavano movimento e
assegnavano il premio, poi il messaggio falliva ripetutamente con HTTP500.
Richiesta ed esplorazione restavano pendenti.

Violazione della specifica, righe38–39: «Dipendenze non chiuse bloccano la
destinazione prima del costo». Probe inventato attraverso compiler e HTTP
reali, senza modifiche dirette al database: ingresso200, intro200, premio1,
reveal500. Nessun ulteriore conflitto documentato o smell rilevante.

## Spec

**Nessun finding P1/P2.** Ingresso/cancel, movimento già pagato, premio al
destinatario corretto con cap, ordine dei reveal, processing e ritorno
risultavano coerenti con il perimetro richiesto. Il confronto mirato con la
coroutine A06003888 confermava la gestione delle sezioni adiacenti e il
controllo del vero handler: A1 non ne dichiara uno pertinente.

Verificati staticamente registro interlecciato, origine immutabile,
confronto canonico/cache, fingerprint host e precedenze della guida.
Interazioni109/75,119↔123 e Ombra rimangono fuori capacità. Il reviewer
non ha duplicato suite, host o QA browser; gli artefatti sono verificati
dal root.

## Correzione e disposizione del root

La destinazione richiede ora un percorso completo fino al rilascio o
all’arresto su ogni ramo supportato, per PRE_REVEAL, REVEALED e l’eventuale
handler adiacente. Percorsi ciclici, incompleti o con effetti interattivi o
broadcast privi della prova di contesto/receiver restano indisponibili
prima di spendere movimento. Il controllo serve sia la vista sia il comando
autorevole: un fingerprint ricostruito correttamente non aggira il gate.

La regressione HTTP inventata riproduce il difetto prima della correzione;
dopo, la destinazione non è pubblicizzata, il comando restituisce409 e
payload completo e checksum del backup rimangono identici. Il timestamp
di esportazione, distinto dal salvataggio, viene confrontato soltanto dove
pertinente. I test positivi esercitano ancora entrambe le esplorazioni e
il receiver adiacente realmente presente nella fixture.

Il guard aggiunto non cambia il pack originale, le sue due rivelazioni o
le schermate. I33 backup del percorso UI sono riconvalidati sul bundle
corretto; hash dei612 artefatti e dei18 input primari invariati. Suite e
compatibilità sono riportate nel
[rapporto di verifica](../testing/original-exploration-verification.md).

Standards:1 finding, massimoP2, corretto. Spec:0 finding P1/P2.
