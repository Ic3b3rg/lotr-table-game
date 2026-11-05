# Negozio abilità del primo campo — #114

Contratto canonico: [issue114](https://github.com/Ic3b3rg/lotr-table-game/issues/114),
main `5db5cf5134a3f38e5a917f45be43d4037bc30d9e`, schema26, baseline864.
Glossario, ADR2–3 e baseline di fedeltà vincolanti. Implementer unico nel
checkout assegnato; Standards/Spec e integrazione al root. Scelte ordinarie
e lavoro autonomo già autorizzati, senza altri gate di approvazione.

## Risultato

Dal campo raggiunto attraverso i controller reali di conclusione, il
proprietario sceglie il proprio eroe, consulta un ruolo giocato, legge
carte/prezzi/simboli e acquista o vende le sole abilità upgrade possedute.
La disponibilità è comune all'intera Compagnia. La vista PC senza identità
osserva proprietari, saldi e prossimo passo; non occupa un posto e non compra.

Il premio storico e la sua ricevuta rimangono immutabili. Saldi per eroe e
ruolo e inventario abilità della campagna sono output separati ricostruiti
dal medesimo command ledger. Acquistare sottrae il prezzo attestato, vendere
lo rimborsa al ruolo della carta. Un cambio di ruolo per il seguito conserva
XP e acquisti. Nessun limite aggiuntivo al numero delle operazioni.

Il primo campo è l'intero perimetro: nessun upgrade oggetti o partenza A2.
Le nuove carte hanno testo italiano, identità, copie, costi, simboli e dati
meccanici reali. Tali annotazioni non costituiscono programmi eseguibili.
Gli effetti futuri richiedono il proprio consumer attestato e mantengono i
gate al suo confine; l'acquisto non esegue effetti nell'episodio concluso.

## Fonti e congelamento

Le due capsule ricevute sono verificate interamente per byte/SHA256 prima
del parse; ogni copia riceve una seconda verifica. Ricevute e identità
ricevute restano intatte. Helper e handle operativi cambiano soltanto nelle
copie proprie, con lock e digest separati. Nessuna scansione globale.

Rilettura bounded dei sei RoleModel e dei soli SkillModel puntati dai loro
CoreSkills/UpgradeSkills, con reader C/Python e schema AssetStudio. Un
decoder binario indipendente verifica campi, puntatori e consumo intero;
un oracle separato dal compiler/runtime confronta tutte le offerte con il
workbook primario, la localizzazione e le errata ufficiali. Prezzi da Cost,
associazione da RoleSource e array, copie/numero/simboli dal workbook.
Nessuna deduzione dal numero, dalla posizione o dal solo nome.

Rileggere gli otto ingressi UIRestScene e i callee GameData effettivi:
GetSkillIds restituisce EquippedSkillIds; AddSkill conserva unicità;
RemoveSkill rimuove la proprietà. GetAvailableXP distingue i ruoli giocati
dal ruolo senza saldo; SetAvailableXP aggiorna/crea il record pertinente.
Disponibilità su tutti gli eroi e confronto del costo precedono l'acquisto.
Le anomalie del prodotto e delle associazioni individuali rimangono nella
provenienza, senza creare nuove copie o promuovere candidati a confermati.

Norma primaria: [Rules Reference §§36.1–36.8, pp.14–15](https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf).
La scelta corrente del ruolo e l'elenco dei ruoli con esperienza sono
concetti distinti. Il negozio legge questi ultimi, anche a saldo zero.

Capacità facoltativa `manifest.campSkills`, `source-camp-skills-v1`, legata
al catalogo iniziale, alla conclusione e ai metodi fonte. Il compiler
richiede il certificato corrispondente; il pack viene congelato prima dello
startup. Le 74 abilità iniziali, i formati e i pack storici restano identici.
Le offerte sono una proiezione separata di definizioni nuove, non un'estensione
silenziosa del catalogo iniziale. Prima si ricostruisce pack112 byte-identico.

## Contratti e invarianti

Il modulo scenario possiede capacità, transazioni e inventario di campagna.
La UI invia un intento `camp-skill` con operazione, eroe, ruolo e copia;
mai prezzo, XP o risultato. Si riusano SCENARIO_INPUT, richiesta/cursore,
source/pack/projection fingerprint, generazione/revisione, Store.once e
registro originale v2 con origine immutabile round1/Azione. Il riepilogo
di acquisto/rimborso nella ricevuta è verificato dal replay esistente.

Solo il proprietario dell'eroe può operare e solo nella fase campo. Il ruolo
dell'offerta deve coincidere con il saldo e con il ruolo richiesto. Saldo
insufficiente, copia già detenuta dall'eroe o da altri, vendita di copia
assente o non upgrade, fonte/cursore/stato superati falliscono senza mutazioni.
Core, base, eroe, debolezze e titoli non diventano vendibili.

La campagna possiede l'inventario abilità effettivo del seguito, inizializzato
dalle vere copie dell'episodio comprese le carte trattenute. Ogni acquisto
aggiunge una sola copia; ogni vendita la rimuove e riapre la disponibilità
comune. L'episodio concluso e le sue zone restano prova storica intatta.
Nessun secondo journal, nuova origine al campo o esenzione di replay.

Schema27 migra strutturalmente1–26 senza aggiungere capacità, saldi o copie.
I formati≤26 rifiutano le forme nuove, anche nell'origine e negli intenti;
normali parole omonime nei dizionari restano dati validi. Il restore cambia
solo generation/revision/updatedAt. Nessuna normalizzazione gameplay.

## UI e verifica

Si conserva il linguaggio visivo del tavolo: pannello campo, articoli per
eroe, saldi leggibili per ruolo, offerte con prezzo e proprietario comune,
lettore carte e guida contestuale. La lettura/annullamento è gratuita.
Controlli nativi con label e motivi dei blocchi, stato della richiesta,
focus restituito e tastiera; niente prezzi liberamente inseriti.

TDD verticale con fixture interamente inventate: compiler/capacità,
controller HTTP/SQLite reale, UI e recovery. Casi zero/esatto/insufficiente,
acquisto/vendita/ripetizione, ruoli distinti/cambio ruolo, concorrenza su
copia comune e ricevuta del vero vincitore, ownership/fase/source/copy/
cursor/revision/generation errati. Negativi coerentemente risignati422
confrontano payload, viste e origine interi. SIGKILL prima/dopo il vero
commit e restore packless su host nuovi vuoti; nessun hook nel prodotto.

QA nativa inventata: tre contesti personali indipendenti e un quarto PC
senza identità, 320/768/1024/1440, HTTP IPv4 senza crypto.subtle. Tutti i
prerequisiti e premi dichiarati prima dello startup; ingresso al campo dal
consumer reale. Dopo bootstrap solo DOM/Input/filepicker gioca, GET/evaluate
osservano. Lettore/guida/focus/tastiera, acquisti/vendite/conflitto, export/
restore corrente e recupero dei tre posti. PNG dipinti e ispezionati.

Validator finale git-show/onLoad:503 file/398 payload/17 viste94; serie96–108
18/14/17/19/13/20/22;40+9 snapshot110 degli stessi giochi;32 snapshot112;
export/finali e nuovi propri. Byte/hash prima del parse, confronti interi,
sole migrazioni schemaVersion e physical:null storico≤10; restore solo
amministrativo. Ogni correzione prodotto richiede tutte le serie dal nuovo
binario. Duplicati non contano come gameplay aggiuntivo.

TypeScript strict/Node24/Zod/SQLite/DOM esistenti, nessuna dipendenza nuova.
Codice in src/shared, src/scenario, src/server e src/client; test Node in
tests con fixture inventate. Stile Prettier esistente, guardie nominate:
`if (!cap) return;`. Comandi: `npm run build`,
`node --test --test-concurrency=4 tests/camp-skills-*.test.mjs`,
`npm run typecheck`, `npm run format:check`, `git diff --check`.
Canonica `npm test` da sola a concorrenza4 dopo tutti i controlli pesanti,
con vero exitcode npm/Node e footer spec/TAP conservato.

## Confini della consegna

57 null/unverified resta bloccante,156 soltanto statico/gated/immutato.
Nessuna nuova partita originale o ripresa per aggirare il blocco. Non si
chiudono89/33/65/57 né si dichiara completa avventura o gioco. Soltanto
processi e browser propri; nessun accesso/inventario delle superfici protette.
Nessuna delega, altro checkout, installazione o scrittura GitHub/push/PR/merge.
Corpus, carte/prosa, IL/IR/FSM, JSON e immagini soltanto scratch ignorata
anche in storia. Pubblici codice, fixture inventate e rapporto tecnico;
README/sigillo privati conservano tentativi, comandi, hash, adapter e limiti.
