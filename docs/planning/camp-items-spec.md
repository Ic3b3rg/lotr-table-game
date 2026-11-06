# Migliorare gli oggetti al primo campo — #116

Contratto canonico: [issue116](https://github.com/Ic3b3rg/lotr-table-game/issues/116).
Base main `4c3c858b58bdc068f2d33ef15e5f76783e17aac5`, schema27,
baseline root883/883. Glossario, ADR2–3 e baseline di fedeltà vincolanti.
Unico implementer nel checkout predisposto da T3. Specifica, piano e scelte
ordinarie sono già autorizzati; Standards/Spec e integrazione spettano al root.

## Risultato e confini

Il campo si raggiunge attraverso i veri consumer della conclusione. Il
proprietario consulta l'oggetto effettivamente posseduto, rango, alternative
fonte del rango seguente, requisito e Sapienza condivisa corrente. Legge
le carte, sceglie un'alternativa e conferma la sostituzione nell'inventario
effettivo di campagna. La carta precedente torna disponibile; nessun salto
di rango, downgrade, duplicazione, trasferimento o commercio libero.
Annullamento e lettura non modificano il gioco. Il PC anonimo e gli altri
telefoni osservano proprietario, attesa e prossimo passo.

Sapienza è condivisa e permanente: non viene spesa. XP, premi e ricevute
storiche, origine del registro e zone dell'episodio concluso rimangono
immutati. Non si aggiunge un limite artificiale alle operazioni al campo.
Equipaggiamento personale e accessori nell'inventario comune conservano
identità e vincoli distinti attestati dalla fonte. Nessuna proprietà è
dedotta dal solo nome, numero, ordine o disponibilità di una carta.

Nessuna partenza A2, attivazione di prodotti diversi da `[0]`, o esecuzione
implicita dei futuri effetti delle carte. Gli effetti senza consumer
attestato rimangono gated ai propri confini prima di costi, carte e RNG,
senza impedire lettura e miglioramenti validi. Quantità sconosciute non
producono stock eseguibile.57 resta null/unverified e bloccante;156 resta
statico/gated e byte-identico. Nessuna nuova partita originale o ripresa;
89/33/65/57 restano aperte e nessun live viene aggiornato.

## Fonti e certificazione

Prima del parse si verificano i manifest pinned, poi tutte le righe per
byte/SHA256 prima della lettura o copia, senza symlink. Le copie proprie
ricevono una seconda verifica. Ricevute e identità storiche annidate
rimangono immutate; soltanto helper e handle operativi propri hanno adapter
e lock separati. Non si eseguono helper o DB ricevuti in place.

Prima si ricostruisce114 corretto byte-identico, fingerprint
`8f1b22eafa1f90b99e90ef2954eb0010b868bce683b7e62b6a5e967c3c296986`,
658484byte, SHA256
`307852652f7c49e8a7220ea84fa65302d1cd60bd9973a1ec6984f3e0f8703386`.
Il draft ricevuto rimane prova storica; il catalogo iniziale74, capacità,
definizioni e certificati precedenti non vengono modificati per il confronto.

Baseline app fissa Steam1.6.6#1128/build24301165, Unity2022.3.62f2.
Rilettura bounded dei soli ingressi UIRestScene pertinenti e dei veri callee
GameData/ItemModel raggiunti. Due reader verificano modelli, campi, puntatori
e consumo intero. Workbook, localizzazione, manuale italiano ed errata
verificati attestano identità, copie, simboli, ranghi, soglie, alternative
e testo italiano completo. Un oracle indipendente dal prodotto verifica
tutte le offerte e catene base. Anomalie e candidati restano espliciti,
senza promozioni per deduzione.

Norma primaria: [Rules Reference FFG, p4 e §§34,51.5–51.7,56.1–56.8](https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf).
La copia locale ricevuta viene verificata prima della derivazione, anche
quando il fetch web non riesce. Nessuna certificazione JIT/Unity inventata.

La nuova capacità è facoltativa, source-bound e certificata dal compiler,
congelata prima dello startup. Non si aggiunge retroattivamente a pack,
origini, campagne o salvataggi già congelati. Le carte del seguito sono
definizioni separate dal catalogo iniziale, con effetti richiedenti il
rispettivo consumer; non sono nuovi programmi eseguibili.

## Contratti e invarianti

Si riusano SCENARIO_INPUT, richiesta/cursore, source/pack/projection
fingerprint, revisione/generazione, Store.once e command ledger/cycle replay
esistenti. L'intento seleziona soltanto eroe o inventario comune, copia
posseduta e alternativa; nessun costo, soglia, Sapienza o risultato libero
dal client. Il server verifica fase campo, identità player/hero, proprietà,
presenza reale, disponibilità comune e rango successivo fonte.

La campagna usa gli inventari esistenti inizializzati alla conclusione.
Ogni conferma sostituisce una sola copia nella corretta sede; l'episodio
concluso conserva la prova storica. Nessun secondo journal o nuova origine.
Retry restituisce la vera ricevuta del vincitore; richieste superate o
concorrenti non duplicano la sostituzione.

Il riepilogo completo della ricevuta è verificato dal replay e legato
bidirezionalmente a tipo di comando e kind dell'intento. La correzione
finanziaria114 resta intatta. Le nuove forme sono rifiutate nei formati
storici e nel prefisso startup/pre-seed prima della migrazione. I normali
dizionari con parole omonime rimangono dati validi. Se necessaria, la
migrazione di schema è soltanto strutturale, senza retrofit gameplay.
Restore cambia soltanto generation/revision/updatedAt.

## UI

Si estende il pannello campo e il linguaggio visivo esistente: oggetto
attuale e proprietario, rango, requisito contro Sapienza corrente,
alternative leggibili e motivi dei blocchi. Conferma esplicita con riepilogo
della sostituzione e pulsante annulla; lettore e guida contestuale sempre
accessibili. Massimo rango, soglia insufficiente, copia contesa e capacità
futura assente hanno messaggi comprensibili. Controlli nativi, focus e
tastiera, target tattili e assenza di overflow alle quattro larghezze.

## Implementazione e verifica

Stack e stile esistenti: Node24, TypeScript strict, Zod, SQLite e DOM senza
nuove dipendenze. Moduli in src/shared, src/scenario, src/server e src/client;
test Node con fixture interamente inventate in tests. Guardie nominate,
oggetti strict e Prettier del repository, per esempio `if (!cap) return;`.

Seam già autorizzati: compiler pubblico, controller HTTP/SQLite reali,
export/restore, validator onLoad e UI reale. TDD a slice verticali: RED
prima di ogni comportamento, prima sostituzione dal telefono al vero
inventario prima di estendere il perimetro. Sotto/esatto/sopra soglia,
catene e alternative, ranghi finali, copia contesa, proprietà/fase/fonte/
cursore/revisione/generazione errati, concorrenza e retry con ricevuta intera.

SIGKILL pre/postcommit, candidato precommit con vere righe command/receipt,
restore packless su nuovi host vuoti, negativi coerentemente risignati422.
Confronti interi di payload, vista, origine, inventario, Sapienza e XP;
nessun hook nel prodotto. Le prove e tutti i tentativi rimangono privati.

QA Chrome nativa inventata: tre contesti personali e quarto PC anonimo,
320/768/1024/1440, HTTP IPv4 senza crypto.subtle. Prerequisiti e premi
definiti prima dello startup; campo dai veri consumer. Dopo bootstrap solo
DOM/Input/filepicker gioca; GET/evaluate osservano. Lettore, alternative,
conferma/cancel, impossibili, guida, focus/tastiera/tap, conflitto,
export/current restore e recupero dei tre posti. PNG dipinti ispezionati;
chiusura e verifica delle sole superfici/processi propri.

Validator git-show/onLoad dal commit prodotto su503file/398payload/17viste94,
serie96–10818/14/17/19/13/20/22,11040+9snapshot degli stessi giochi,
11232snapshot,11415/11distinti+30recovery, tutti export/finali/viste/origini
e nuovi propri. Byte/hash prima del parse, nessuna normalizzazione gameplay,
esonero o duplicato contato come nuovo gioco. Dopo correzioni si ripetono
tutte le serie; dopo soli documenti si provano binari e alberi byte-identici.

Comandi: `npm run build`, test mirati con
`node --test --test-concurrency=4 tests/camp-items-*.test.mjs`,
`npm run typecheck`, `npm run format:check`, `git diff --check`.
Solo dopo tutti i controlli pesanti: `npm test` canonica da sola,
concorrenza4, vero exit npm e footer spec/TAP, tempi e HEAD pulito invariato.
Nessuna assertion/deadline/soglia ridotta, skip/suppression o installazione.

Pubblici soltanto codice generico, fixture inventate e report tecnico di
conti/hash/locatori. Corpus, testi, carte, IR/IL/JSON/PNG e mapping reali
soltanto nella scratch ignorata, anche nell'intera storia Git. Privacy scan
su ogni nuovo commit/diff/file usando testi reali vecchi e nuovi come needle.
README riproducibile, lock e manifest privati sigillati con byte/SHA di
input, helper, output, DB/snapshot, tentativi e log. Le cache e i profili
propri non portabili e i file autoriferiti sono esclusi esplicitamente.
Commit locali puliti e atomici; nessuna delega, checkout extra o scrittura
remota. Nessuna domanda aperta al momento; ambiguità fonte non attestabili
restano limiti espliciti mentre prosegue tutto il lavoro indipendente.
