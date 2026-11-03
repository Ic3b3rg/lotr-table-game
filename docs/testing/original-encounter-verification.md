# Primo incontro originale — verifica issue71

Implementazione P3a sulla base `082a86db1421d1f254c1d457cb5dd27aa0d575b9`.
Codice verificato: `6c237f2` (schema15); specifica e piano erano già committati
in `4baddbf`, prima del codice. Il perimetro è il solo incontro originale
chiuso dal manifest, nella realizzazione congelata dell'incarico. Non è la
conclusione di P3 o dell'issue33. Review Standards/Spec e integrazione restano
al root; nessuna scrittura GitHub è stata effettuata.

La [specifica](../planning/original-encounter-spec.md) descrive i contratti;
il [piano](../planning/original-encounter-plan.md) registra i passi.
La decisione sul registro è in [ADR0003](../adr/0003-registro-ordinario-e-fonte-dell-incontro.md).
Metadati e hash della consegna sono in
[original-encounter-verification.json](original-encounter-verification.json).
Originali, carte, immagini, pacchetti, mapping e prove private restano nella
scratch ignorata `.scratch/node5/`, anche rispetto alla storia Git di questa
consegna. Il codice pubblico contiene consumer generici e fixture inventate.

## Comportamento verificato

Lo startup usa il freeze esistente, inizializza i prefab e completa soltanto
le sei operazioni iniziali per eroe. Le prove successive hanno frame propri.
Ispezione ed Escape non modificano neppure la revisione. La conferma richiede
proprietario, turno, casella, budget e fonte correnti; paga un'azione. Le
continuazioni e i figli non ne pagano altre. Il viaggio conserva il movimento
residuo, effettivamente utilizzato dalla UI dopo il ritorno.

La UI originale ha prodotto il conteggio condiviso esatto **2+1**, fra due
eroi, risolto la conseguenza fisica del primo tentativo, attribuito il solo
premio fonte e concluso il segnalino. Un secondo percorso ha conservato il
primo successo dopo un fallimento del ramo alternativo; un altro eroe ha poi
superato quel ramo con una conversione legale, senza premio Sapienza inventato.
Il primo test non è stato ripetuto. Tutte e tre le identità hanno agito nello
startup, nei turni e, considerando i due percorsi, nelle prove dell'incontro.

Le quantità, le caratteristiche, le facce e le soglie sono confrontate con i
Message effettivi e con binding/IL già raccolti. Non derivano dalle etichette
degli stati. Il ramo nullo non è selezionabile; il listener differito resta
nascosto in ogni backup UI verificato. Non sono stati aggiunti Pass/Fail
manuali, Cancel al ramo obbligatorio, negazioni o premi impliciti.

## Architettura e compatibilità

Il manifest `original-encounter-v1` dichiara espressamente un solo prefab
interattivo. I consumer ordinari/fisici lo riconoscono senza abilitazione
globale o esenzione al replay. Le istruzioni compilate sono attestate anche
con hash dell'azione emessa. Le capacità fisiche richieste vengono verificate
prima di avviare lo scenario.

Il ledger originale v2 interleccia comandi ordinari, transizioni fonte e
continuazioni fisiche. Il seed rimane lo startup completato, round1/Azione;
non viene sostituito con snapshot successivi. Il replay ricostruisce tutti gli
output e le ricevute; le cache usano il contesto completo, copie difensive e
confronto degli output persistiti. Ogni comando applica costo, avanzamento,
risorse, casualità e ricevuta nella stessa `Store.once`.

Il risultato della prova padre è distinto da Scoperta e Ultimo Sforzo figli.
Un test aggiuntivo riproduce una sconfitta causata dalla perdita di un limite
preparato: conserva il risultato e gli effetti immediati, termina il tentativo
con causa esplicita e impedisce nuove scelte dell'eroe sconfitto. Non introduce
un annullamento facoltativo per gli eroi attivi.

La migrazione14→15 è esplicita. I run pubblicati mantengono regole per run,
attivazione P2 storica esplicita, RNG, titoli/copie e tetti storici. I tre fix
PR70 e le semantiche PR68 sono coperti dalla suite completa. Il controllo
privato aggiuntivo ha riletto **43 backup P2 della QA root finale** e il freeze
originale: tutti validi, nessuna modifica ai campi gameplay o alle ricevute,
salvo la versione schema migrata. Gli 11 snapshot del vecchio child, mai
pubblicati, sono esclusi da questo controllo di compatibilità.

## Prove e loro autorità

| Livello                    | Risultato e limite                                                                                                                                                                                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Automatici pubblici        | `npm test`: **523/523**, zero fallimenti, skip o todo; baseline510. HTTP e SQLite reali, sorgenti inventati.                                                                                                                                                      |
| Recupero e atomicità       | Retry/concorrenza, SIGKILL prima/dopo il commit, ripristino senza pack e backup risignati con costo/progresso/ritorno/posizione o entrambe le cronologie alterati.                                                                                                |
| Conseguenze/P2 automatici  | Conseguenze reali, Ultimo Sforzo e sconfitta consumati dal motore; nessun ACK sostitutivo. Include il caso padre/figlio descritto sopra.                                                                                                                          |
| Fonte privata indipendente | Solo slice raggiunto: **17 stati, 18 azioni**, tre Message di prova e tre Message di conseguenza confrontati, un solo proprietario del premio, guardia nulla chiusa. Confronto con il corpus primario già raccolto; non nuova estrazione o esecuzione Unity.      |
| Artefatto originale        | **30 definizioni, 80 stati, 54 azioni** complessivi, incluso lo startup riusato; un solo prefab giocabile. Fingerprint nei metadati.                                                                                                                              |
| Preparazione/backend       | Copia verificata degli input e replay preliminare in un database distinto. Queste prove non sono presentate come avanzamenti UI.                                                                                                                                  |
| Browser finale             | Tre contesti Chrome indipendenti, pack/carte/mappa originali, intero percorso descritto sopra mediante controlli nativi. P2 non è stato raggiunto nei due percorsi originali UI: la sua consumazione è provata dagli automatici, non attribuita a queste catture. |

La compagnia e il freeze iniziali provengono dal backup autentico dichiarato,
importato tramite filepicker. Lo startup è stato eseguito dalla UI. Per il
secondo ramo è stato ripristinato l'export UI di quello startup; nessun counter
preparato. Le immagini finali del conteggio concluso provengono dal ripristino,
solo per ispezione visiva, dell'export prodotto dal primo percorso: provenienza
e confronto integrale sono registrati separatamente.

Sono stati validati **50 backup UI finali** con il parser dello schema15,
senza normalizzare o alterare i payload.

Nel pending di prova, SIGKILL/restart senza i quattro file pack conserva
l'intero payload. Il restore via filepicker conserva tutti i campi gameplay e
le ricevute; cambiano soltanto generation/revision/updatedAt. Un altro SIGKILL
nel pending del premio conserva esattamente conteggio e premio, senza ripetere
l'entry. Entrambi i percorsi terminano con ritorno unico, movimenti residui
riutilizzabili e budget coerenti. I tre turni del primo percorso sono stati
conclusi legalmente; non è stata forzata la successiva Fase di Ombra.

## Verifica visiva e riproduzione

Browser dedicato sul proprio host4365, profilo e database isolati. La verifica
di edit propri usa Chrome nativo/CDP, coerentemente con il divieto di Preview
per questo uso. Le azioni impiegano focus, Input, normali controlli e
filepicker; le letture Runtime e le richieste Node all'app sono soltanto
osservative, con HTTP GET. Nessun fetch scrivente o modifica SQL ausiliaria
avanza i percorsi UI.

Ispezionati screenshot a **320/768/1024/1440**, mappa e decisioni: nessun
overflow orizzontale, controlli misurati almeno44px, status/focus e progressi
leggibili. Guida consultata; tre cicli del lettore con Escape nativo e ritorno
del focus superati nel pending iniziale. Durante un'altra cattura è ricomparso
il limite intermittente di focus già documentato in P2: tentativo conservato,
non attribuito al prodotto e nessuna ripetizione infinita della pipeline.
Le successive catture dichiarano soltanto i controlli realmente eseguiti.
I 26 asset privati necessari erano già disponibili: nessun download di asset,
nessun404 di asset o eccezione JavaScript osservati. Le disconnessioni durante
i SIGKILL iniettati sono classificate separatamente.

Le catture precedenti ai fix del lettore e dei nomi sono conservate in
`browser/initial-pass-artifacts/`, con manifesti d'invalidazione; la sequenza
originale è stata ripetuta sul codice finale. Gli errori di assunzione dei
driver preparatori (conseguenza chiusa automaticamente, status transitorio di
restore e passaggio di fase non automatico) sono classificati nella README
privata e non contano come regressioni del prodotto o prove superate.

Riprodurre la parte pubblica, con le dipendenze esistenti e senza installazioni:

```sh
npm test
npm run typecheck
npm run format:check
git diff --check
```

La `.scratch/node5/README.private.md` descrive input/source-lock, compilazione,
checker indipendente, compatibilità, host/profilo, sequenze native ed export.
`manifest.private.json` inventaria hash e classificazione delle prove. La porta4339
e la scratch condivisa dei test di abilità non sono state utilizzate; i soli
processi e contesti creati per questa consegna sono stati chiusi.

Restano fuori: 119↔123 e gli altri incontri, combattimento/Ombra, esiti completi,
campo e avventura2; il problema delle quantità dei benefici dell'issue57 e i
gate per mazzi fisici realmente vuoti restano invariati. Non sono certificati
telefoni reali, LAN, Windows o Safari. Nessuna chiusura di issue33/57/65 né
pubblicazione GitHub è inclusa nella consegna.
