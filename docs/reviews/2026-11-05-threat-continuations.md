# Review delle soglie e della perdita per minaccia — #96

Base `9cdba430175808ddeeca75270a6ec2823eab31cc`; consegna
`1fb0ef941e4e3a56e82022008c6d42bfbe0ab61f`, sei commit. Contratto:
[issue96](https://github.com/Ic3b3rg/lotr-table-game/issues/96),
[spec/piano](../planning/threat-continuations-spec.md), glossario, ADR2–3 e
baseline di fedeltà. Review indipendenti con contesti separati; root responsabile
delle correzioni e dell'integrazione.

## Standards

**Un P2 riprodotto.** La nuova conseguenza collettiva usa il primo slot come
attore e comprende anche gli eroi sconfitti. Il guard del consumer salta
l'intero figlio se quell'attore è sconfitto: i superstiti non subiscono nulla.
Se è sconfitto un altro eroe, rimane nell'ordine e riceve una nuova negazione.
Contrasta con bersagli e condizioni della baseline e della spec.

Nessuno smell facoltativo segnalato. Il reviewer verifica inoltre compilazione,
sei rifiuti di certificati alterati, migrazione17→18 e sei rifiuti storici.
Soli probe sintetici, senza host o modifiche alla consegna.

## Spec

**Un P1 riprodotto, stessa causa.** «Conseguenza fisica per ciascun eroe» e
ritorno prima del deployment non sono rispettati se lo slot0 è già sconfitto.
È raggiungibile dopo una conseguenza precedente della medesima Ombra, con
superstiti. Il padre termina e conta un ritorno, saltando le loro conseguenze.
La variante con un altro sconfitto gli assegna ulteriori carte. Il probe
indipendente usa il vero `spawnPhysicalProgram`; il replay accetta entrambi
i risultati erronei. Nessuno scope creep accertato.

## Correzione root e seguito distinto

`group-suffer` ora risolve la propria lista di superstiti anche quando il
primo slot è sconfitto. L'ordine filtra gli eroi attivi e viene aggiornato
dopo ogni discendente; il chooser passa a un superstite quando necessario.
Il comportamento storico degli altri figli rimane distinto.

Una regressione pubblica, osservata RED→GREEN, copre prima lo slot0 e poi
un altro slot già sconfitto: attore valido, destinatari attivi, negazione e
subito di entrambi i superstiti, conservazione, replay e un solo ritorno.
Le prove esistenti coprono anche la sconfitta durante il nuovo padre e la
conclusione immediata senza superstiti.

Il root riproduce inoltre lo stesso limite nel precedente `group-test`:
era già presente nella base9cdba43. Correggerne il programma derivato senza
un nuovo marker cambierebbe il replay dei pack congelati. È un seguito
prioritario da versionare prima dell'accettazione completa33; non è dichiarato
risolto da questa integrazione. Un primo passaggio completo root è interrotto
per questa verifica, conservato separatamente e non contato come positivo.

## Provenienza e verifica root

Sigillo ricevuto: **1.393 file,1.166.317.557 byte**, manifest SHA256
`9110f4fef3bb336d346d4b5ad9d6db2c48080152d1ceab1ea6dfe0c56fd47844`.
Tutti i byte/hash della fonte e della copia root coincidono. Evidenze ricevute
immutabili; helper eseguiti soltanto su copie proprie, nessun DB ricevuto aperto.

Il root rilegge10 oggetti e le tre FSM complete:12 stati/15 azioni, doppio
reader concorde; testo bounded e35 corpi IL,9.001 byte/3.131 istruzioni.
I campi dei corpi IL coincidono, eccetto i path amministrativi rilocati.
La compilazione conserva gli identificatori delle ricevute originali dopo
questo confronto: tutti e tre gli output sono identici byte per byte, impronta
`6540d71d0feb7a643133cd01fadfd2cc17918a5b9886dff3d1b146ccd0c03b85`.
Oracle separato sui15 output e sull'ordine del controller riprodotto.
Nessuna esecuzione Unity/JIT o equivalenza della casualità dichiarata.

La consegna distingue UI sintetica, confronto statico e accettazione originale.
Le quantità57 rimangono null/non verificate; il checkpoint156 resta la prova
del blocco. Nessuna nuova partita originale o accettazione89/33.

Sul codice corretto, suite canonica root **705/705**, zero fail/skip/cancel/todo,
467.771,696209ms; typecheck, formato e diff passano. Nessuna modifica di
deadline, casi o concorrenza4. La prima suite incompleta rimane nel log distinto.

Validator ricostruito dalla correzione committata, identico byte per byte a
quello usato per tutti i confronti. Root: **503/503** file,398 payload distinti,
17 viste pubbliche94 complete, intero gameplay e ricevute conservati. Soltanto
schema18 e il default storico `physical: null` fino a schema10 sono ammessi.
Passano altri18 snapshot sintetici con18 viste complete, export e restore
finale, esclusi soltanto generation/revision/updatedAt amministrativi.

Ricontrollate168 righe UI ricevute:156 sul percorso e12 supplementari dopo
la correzione del testo dei contributi. Tre PNG ispezionati dal root, compreso
il testo finale a320px; nessuna nuova prova browser dichiarata. Privacy su260
needle di fonte, diff, untracked e nuova storia: zero corrispondenze.

## Confini

Schema18 con migrazione strutturale. Il codice precedente non lo legge:
un rollback dei dati richiede un backup antecedente. Nessun retrofit di copie,
capacità o origine nei pack precedenti. Tavolo protetto intoccato.
Vittoria/covo, campo completo, avventura2 e il seguito collettivo storico
restano lavori successivi. #57/#65/#89/#33 rimangono aperte.

Standards: un P2; Spec: un P1. Un solo difetto sottostante, corretto dal root;
il limite storico distinto rimane esplicito. Integrazione del perimetro96
accettata; l'accettazione completa33 rimane aperta.
