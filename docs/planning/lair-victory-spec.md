# Covo e vittoria fino al primo campo — #100

Contratto: [issue100](https://github.com/Ic3b3rg/lotr-table-game/issues/100),
base `c38a8c6ce8e3b62ddd1ce95b424af186d2769ff4`, schema19, 719 test.
Glossario, ADR2–3 e baseline di fedeltà vincolanti. Unico implementer nel
checkout assegnato; review Standards/Spec e integrazione al root. Le scelte
ordinarie sono già autorizzate: nessun ulteriore gate di approvazione.

## Risultato e grounding

Abilitare soltanto l'interazione certificata del covo, con carte, conversioni,
somma persistente e tentativi, fino al segnale fonte di vittoria, premi e
primo campo. Riutilizzare compiler, frame scenario, fisica P1/P2, Store.once
e ledger della conclusione. Nessun executor parallelo o controllo libero.

Ricevuti98: 2169 file / 1446920021 byte, manifest SHA256
`4c450bd02b83c72b125fe81c30610d42aa34dadfdb21c52671905d74b6a8944c`.
Ogni byte/hash verificato prima del parse; copie/adattamenti nella scratch
propria. Ricevute originali dei27 input separate dai path rilocati.

Evidenza primaria: R27686 consumato interamente, 82712 byte,18 stati;
R20275,188796 byte,35 stati; due modelli805/806,344/396 byte. Due lettori
concordi, parametri raw confrontati col normalizzato ricevuto, puntatori
controllati. Nessuna esecuzione Unity/JIT o partita originale.

La prova è Ingegno, la somma è il binding locale persistente; il limite
dinamico è inizializzato nella finestra PRE_REVEAL dalla numerosità intera
della Compagnia. Non si ricalcola sui superstiti. `0600117c` aggiunge il
risultato e limita0…99; `0600117b` sceglie il primo ResultPair il cui massimo
include il totale (uguaglianza inclusa), altrimenti l'ultimo. Ordine,
binding, testi italiani, effetti e callback appartengono agli asset/owner,
non ai nomi degli stati. Ispezione/annullamento gratuiti; conferma consuma
una sola azione e la fisica prima dell'interazione. Il fallimento conserva
somma e conseguenze; il nuovo tentativo usa il secondo ingresso fonte.

Il passaggio EndGame ha Success=true (`06001192`) e segnala al principale
(`06000c96`): ramo30→32→33. Flag, XP al ruolo selezionato di tutti gli eroi,
Sapienza e bonus equipaggiato usano gli owner già verificati del termine;
destinazione dal modello referenziato, un solo passaggio e ingresso campo.
Il messaggio di successo precede il segnale. Non è attestato un combattimento
obbligatorio in questa interazione. Non si introduce polling della perdita:
la sconfitta differita conserva la propria finestra, quella senza superstiti
il proprio confine immediato. L'intero episodio e i padri sospesi restano prova.

## Capacità e seam

Capacità facoltativa `manifest.lair`, `source-lair-victory-v1`, attestata prima
dello startup, vincolata a indizi, conclusione, prefab e hash delle definizioni
covo/principale e agli owner IL. Solo questo prefab acquisisce l'interazione;
i pack precedenti mantengono il gate. EndGame è ammesso soltanto nel suo owner
certificato. Le mutazioni della campagna restano confinate ai due rami del
principale, con destinazione comune certificata; nessun permesso generale per
Sapienza o XP. L'eccezione al validator indizi dipende dalla nuova capacità.

Il modulo profondo resta scenario: `compileScenarioPack`/`parseScenarioPack`
certificano il freeze, `interactScenario`/`resumeScenario` eseguono le decisioni
nel registro unico. La conclusione conserva causa, attore, tentativo, effetto,
contesto e una sola restituzione. Non si aggiunge un comando pubblico.

Schema20: migrazione19→20 solo strutturale; niente capacità default, origine
round1/Azione invariata e nessuna normalizzazione di gameplay o esenzione al
replay. Formati≤19 rifiutano capacità, istruzioni e conclusioni nuove anche
nel seed. P1/P2/failure storici conservati integralmente.

## Preflight, UI e verifica

Prima di costi/carte/RNG, attraversare tutta la continuazione obbligatoria,
compresi premi, ritorni e handoff al campo. Nessun filtro dei pool; stock
ignoto mantiene il gate specifico. Carte, copie, residui, risorse, fronti,
risultati e discendenti passano attraverso i consumer condivisi.

UI italiana esistente: attore, costo, carte/totale/esito, seguito e attesa;
guida, lettore, focus e tastiera. Percorso positivo interamente inventato,
precondizioni dichiarate prima dello startup, tre identità indipendenti,
320/768/1024/1440, HTTP IPv4 senza crypto.subtle. Solo DOM/Input per giocare;
GET per osservare, nessuna mutazione ausiliaria API/DB o evaluate che gioca.

TDD sui programmi scenario reali derivati da fixture inventate: successo,
fallimento, retry, uguaglianza/valore successivo,1…5 eroi e superstiti,
conversioni, provocazioni, P1/P2, premi/ritorni una volta. HTTP/Store.once:
attore, stale, copie/richieste/cursor, concorrenza e preflight immutato.
SIGKILL e restore packless ai nuovi confini, interi payload/viste e alterazioni
risignate respinte. Oracle statico indipendente dalla generazione output.

Validator finale ricostruito dal commit prodotto e byte-identico per tutti
i confronti:503 file/17 viste94,18 snapshot/viste96 e14 snapshot/viste98,
export/finali inclusi. Solo migrazioni strutturali dichiarate; copie identiche
non contano come nuove prove. Suite canonica `npm test` a concorrenza4 da sola
dopo QA/validator pesanti, `npm run typecheck`, `npm run format:check`,
`git diff --check` e privacy su diff e nuova storia. Nessuna soglia indebolita.

Codice TypeScript strict in src/scenario, shared, server, client; test Node
in tests, fixture inventate in tests/fixtures. Stile esistente Prettier,
funzioni nominate e guardie esplicite: `if (!cap) return;`.
Comandi mirati: `npm run build` e
`node --test --test-concurrency=4 tests/lair-victory-*.test.mjs`.

## Limiti

Quantità57 null/unverified: «Mantieni il blocco finché le quantità sono
verificate». Nessun proxy/reroll, nuova partita originale, ripresa156,
accettazione89/33 o chiusura57/65/89/33. Campo completo/acquisti, A2,
119↔123 e altri rami restano successivi. Nessuna installazione, delega,
checkout aggiuntivo o scrittura GitHub/push/PR/merge. Solo superfici proprie;
quelle protette escluse. Originali, narrativa, carte, IR/FSM/IL/JSON e immagini
solo scratch ignorata anche nella storia. Report pubblico tecnico e sigillo
privato con comandi, tentativi, byte/hash e limiti.
