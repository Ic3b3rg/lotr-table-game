# Prove collettive dei superstiti — #98

Contratto: [issue98](https://github.com/Ic3b3rg/lotr-table-game/issues/98),
base `645e74e1313b9bb88c671c0a8ce30d0dab86b448`, schema18, 705 test.
Glossario, ADR2–3 e baseline di fedeltà restano vincolanti. Spec e piano
scritti prima del codice. Un solo implementer nel checkout assegnato;
review Standards/Spec e integrazione al root.

## Obiettivo e grounding bounded

Una prova collettiva successiva alla sconfitta deve raggiungere tutti i
superstiti, anche quando lo slot del chooser originario è sconfitto. Dopo
ogni discendente il medesimo ordine condiviso rivaluta destinatari e chooser.
La negazione e le conseguenze dell'oscurità usano gli stessi consumer fisici.

Fonti locali96 verificate contro il manifest ricevuto: 1.393 file,
1.166.317.557 byte, SHA256 del manifest
`9110f4fef3bb336d346d4b5ad9d6db2c48080152d1ceab1ea6dfe0c56fd47844`.
Helper adattati soltanto nella scratch propria; nessun DB ricevuto aperto.
Rilettura IL limitata agli owner già attestati di fine round, sconfitta,
messaggio/spawn e ritorno. `A3902:00f3–015c` mantiene priorità eroe/cap;
`A3902:094b–0aef` attende i callback prima del cap. `A3bf4:0259–034c`
separa superstiti da perdita immediata. `A1229`/`A3c41` mantengono il
messaggio fisico prima dello spawn e un solo ritorno. Nessuna nuova finestra
di polling o reinterpretazione della casualità Unity.

Il lock96 non include il PDF normativo: colmata questa sola lacuna con il
[Rules Reference ufficiale](https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf).
P.2: ordine deciso dal gruppo; §§22.9–13: negazione per successo prima del
subito; §24: eroe sconfitto escluso dall'avventura, carte conservate e XP
ancora attribuiti; §54: verifica dei limiti dopo la fonte completa.
Le fonti non riducono la numerosità della Compagnia per le formule dell'app.

## Contratto versionato

Capacità facoltativa `manifest.liveGroups`, versione `source-live-groups-v1`:
hash dei controller rounds/followup/failure e hash dell'evidenza bounded.
Il compiler richiede il certificato corrispondente e i legami al freeze.
Dipendenze complete prima dello startup; nessuna aggiunta al pack o all'origine
durante la partita. Le quantità57 restano indipendenti e non verificate.

I programmi fisici derivati dichiarano `groupRules: source-live-groups-v1`
solo quando il manifest lo dichiara. Programmi storici identici, anche nella
forma: nessun campo default aggiunto, filtro, normalizzazione o esenzione
al replay v2. Schema19 introduce soltanto questa forma e migra18→19
strutturalmente. Formati≤18 rifiutano manifest/programmi con nuova capacità,
anche all'interno dell'origine e dei registri persistiti.

Il consumer condiviso distingue il proprietario che registra l'ordine
concordato dal gruppo, gli eroi destinatari ancora attivi e la numerosità
fonte completa. Rivaluta i superstiti dopo ogni discendente, compresi gli
effetti su un destinatario ancora da risolvere. Senza superstiti conserva il
padre sospeso e la conclusione immediata già prevista. Con superstiti conserva
risultati, carte, costi e continuazione fino a un unico ritorno. Le perdite
differite conservano la finestra fonte. Nessun executor nuovo.

Non cambiano PlayerCount, budget, minaccia, campagne, proprietà o stock.
Il preflight completo precede costi/RNG, conserva popolazioni integrali e
gate tardivi. I consumer senza marker conservano la semantica storica:
la loro correzione richiede un nuovo freeze, mai un retrofit di un run.

UI esistente italiana: ordine concordato dal gruppo e proprietario che lo
registra, destinatario della prova/negazione/subito, attesa e ritorno alla
fonte. Guida, lettore e focus restano disponibili; nessun nuovo controllo
libero o conferma aggiuntiva.

## Piano sequenziale: un incremento verticale

1. RED sul vero `spawnPhysicalProgram` dopo sconfitta di slot0/altro slot,
   fixture inventate; RED dei contratti compiler/freeze/migrazione. Applicare
   insieme marker, consumer condiviso e testo UI, poi GREEN mirato.
2. Estendere le regressioni ai discendenti: morte del chooser e di un futuro
   destinatario, due/uno/zero superstiti, oscurità e conseguenza collettiva,
   conservazione, P1/P2 e ritorni. Esercitare API HTTP e Store.once con
   attore errato, concorrenza, stale/retry e preflight senza mutazioni.
3. SIGKILL e restore packless ai nuovi confini, payload/ricevute interi,
   alterazioni risignate respinte. UI nativa inventata: tre identità,
   320/768/1024/1440, HTTP IPv4 senza crypto.subtle, percorso effettivo
   sconfitta→superstiti, fonte→figlio→ritorno; input DOM/Input soltanto.
4. Validator ricostruito dal codice finale. Confrontare una volta ciascuno
   i 503 file autorizzati e le 17 viste94, poi i 18 snapshot/viste96,
   export/finale96. Conteggiare separatamente payload distinti e copie.
   Solo migrazione di schema e default physical:null storico≤10.
5. Terminare QA e validator pesanti prima della suite canonica. Eseguire
   `npm test` (concorrenza4), `npm run typecheck`, `npm run format:check`,
   `git diff --check`, privacy su diff e nuova storia. Report pubblico
   tecnico, README/sigillo privati con input, byte/hash, comandi, tentativi
   e limiti. Commit locali ordinati e albero pulito.

Codice: `src/scenario`, `src/physical-resolution`, `src/server`, `src/shared`,
`src/client`; test Node in `tests`, fixture inventate in `tests/fixtures`.
TypeScript strict, funzioni nominate, stile Prettier esistente:
`if (!cap) return;`. Comandi mirati: `npm run build`;
`node --test --test-concurrency=4 tests/live-groups-*.test.mjs`.

## Limiti vincolanti

Quantità57 null/unverified per decisione del proprietario, nessun proxy o
riserva inventata. Nessuna nuova partita originale, prosecuzione156, reroll,
accettazione89/33 o chiusura57/65/89/33. Fonti originali solo confronto
statico/compiler/oracle bounded; prove positive inventate e dichiarate.
Vittoria/covo, altri incontri/terreni, campo completo e A2 restano nel seguito.
Nessuna installazione, agente, checkout, GHwrite/push/PR/merge. Solo host,
PID e profili propri; superfici protette escluse. Corpus e immagini soltanto
nella scratch ignorata, anche nella storia. Test/deadline/asserzioni intatti.
