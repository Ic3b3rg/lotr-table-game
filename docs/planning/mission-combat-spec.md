# Primo scontro dal segnalino — #108

Contratto canonico: [#108](https://github.com/Ic3b3rg/lotr-table-game/issues/108).
Base `767b8d71b8849cfd8e03d2344cc6dc04232d7c8c`, schema23/789 test.
Glossario, ADR2–3, baseline e contratti55/61/75, spec/report89/98/100/102/104/106
vincolanti. Implementazione personale nel checkout assegnato; root possiede
le due review fresche e l’integrazione. Nessuna delega o scrittura remota.

## Risultato e autorità

Collegare il solo segnalino attestato al gruppo, al controller di attacco
esistente e alla callback proprietaria fino al ritorno legale. Conservare
le quattro definizioni complete78/98 e distinguere la slice75 di46/52 dalle
parti già certificate. Nessun motore parallelo o duplicazione della logica.

Capacità facoltativa `manifest.firstCombat`, `source-first-combat-v1`:
prefab, definizioni/certificati, prodotto[0], normale/viaggio, configurazione,
modello, disponibilità, riserve, budget, posa realizzata, logica e receiver
espliciti ante-startup. Nessun retrofit durante il run. Le quantità fisiche
per tipo non si deducono dal massimo simultaneo applicativo.

Input106: tutte4916 righe/2505445694 byte verificate prima di parse/copia;
manifest1017460 byte SHA256
`b42f257f7dd5f5182ac1ac76e2d98643d132ee15832c5f28e75ece6c0eaf4af5`.
Input75:236 artefatti/127326674 byte verificati, manifest49203 byte SHA256
`b9fe2063f8d8f3bade8211d321c5164d5970859b57e837b569561347267c6bc7`.
Le41 ricevute di provenienza restano intatte;35 hanno copie byte identiche
disponibili. Non seguire le altre sei agli originali. Rilettura fresca a due
reader sulle primarie ricevute resources/sharedassets e owner pertinenti;
il livello realizzato riusa il certificato congelato, senza aprire l’originale.
Oracle statico separato dal compiler/runtime. Fonti, adattamenti, tentativi,
corpus e immagini soltanto nella scratch privata ignorata anche in storia.

## Comportamento

Ispezione/cancel gratuiti. Tutte le tre opzioni e i sei rami terminali sono
conservati. La conferma paga un’azione una volta, mantenendo attore/casella/
turno e movimento residuo. Prove con carte e conversioni reali: Sum letterale0,
conteggio0…99, primo limite ordinato superiore inclusivo e fallback ultimo.
Nessun pulsante Pass/Fail o esito libero. Ispirazione, benefici e conseguenze
usano i consumer condivisi, mai il solo testo del messaggio.

Spawn: due figure, costo13, AdditionalPoints13, massimo gruppo3 e massimo
simultaneo6 separati. Contare figure vive, pending e riserve reali; una carenza
non certificata conserva una diagnostica prima del costo e non riduce2→1.
Fallimento fonte non presenta il messaggio e non salva l’aggiunta al budget.
Successo salva il residuo cappato a5 per eroe. Nessun bonus di difficoltà.
Posa dal custom Tile congelato e Spaces[0], mai nearestspace/authoring.
Conservare entrambi i legami gruppo↔logica e verificarli nel replay.

Soltanto l’inserto della variante riuscita offre all’attore un attacco contro
quel gruppo senza altra azione. Registrare offerta, uso/rinuncia e ritorno;
ramo normale/fallimento non lo concedono. Armi, spese, carte, modificatori,
contrattacco, P1/P2 e titoli appartengono al controller esistente.

L’ordine fonte è spawn/principale, SET_DUDE_TIMER, SET_REVEALED_DUDES, hide,
attesa. Il primo evento assegna true; il secondo inverte il bool: vero dopo
startup e falso dopo l’interazione. Timer2 decorre dallo startup e non si
resetta. Processing, registrazione receiver e visibilità restano distinti.

Sconfitta tramite veri attacchi→premio di gruppo→DEFEATED proprietario.
Fuga timer→rimozione di tutti i gruppi→evento mirato, senza ispirazione di
sconfitta. Sapienza all’entry una volta; tre piazzamenti sezione2 ordinati
con ConnectedSpaces fonte/comparator, distinti dal movementGraph. Conservare
annuncio0 e obiettivo persistito3. Cleanup e ritorno al turno/viaggio o alla
Ombra sospesa una volta; gli indizi successivi restano quelli già posseduti.
Nessun nuovo polling della perdita o nuove scelte personali dello sconfitto.

Preflight dell’intera continuazione prima di costo/carte/RNG: tutte opzioni/
esiti, receiver, consumer fisici, pool interi, provocazioni e ritorni.
57null/unverified conserva il gate specifico: «Mantieni il blocco finché le
quantità sono verificate». Nessun filtro, proxy, premio sostitutivo, quantità
inventata, unknown=empty, reroll o nuova domanda al proprietario.

## Persistenza, UI e verifica

Stesso Store.once e ledger, origine immutabile round1/Azione. Autorizzazioni
player/hero/space/source/card/cursor, concurrent/stale/retry e ricevute stabili.
Migrazione24 solo strutturale se necessaria; formati≤23 rifiutano le nuove
forme anche nel seed e conservano nomi arbitrari nei dizionari. Pack/hash/
replay storici invariati, nessuna esenzione o normalizzazione gameplay.

UI nel design esistente: chi agisce, costo già pagato, due figure/bersaglio,
collocazione, attacco facoltativo, rinuncia, attese e prossimo passo chiari.
Guida/lettore/focus/tastiera, quattro larghezze320/768/1024/1440. QA positiva
inventata con precondizioni ante-startup e tre identità indipendenti su HTTP
IPv4 senza crypto.subtle. Dopo bootstrap soltanto DOM/Input gioca; GET/evaluate
osservano. Export esatto, restore corrente e recupero posti; sole superfici
proprie. Fotogrammi non dipinti non sono prove visive positive.

TDD compiler/programmi reali inventati, transazioni HTTP/SQLite, veri attacchi,
SIGKILL prima/dopo commit e restore packless su host vuoti ai nuovi confini;
payload e viste interi, negativi risignati422 senza mutazioni. Validator dal
commit finale sui503 file/17 viste94 e serie18/14/17/19/13/20 di96–106,
export/finali, byte/hash prima del parse. Copie identiche non nuove prove.
156 soltanto preflight statico gated/immutato, nessuna partita originale.

Node24.11.1, TypeScript/Zod/DOM e sole dipendenze esistenti. Suite canonica
da sola a concorrenza4 dopo QA/validator pesanti; tipi/formato/diff/privacy
dell’intera nuova storia. Nessun caso/assert/deadline/soglia indebolito,
skip/suppression/dependency. Commit locali ordinati, report tecnico pubblico,
README/sigillo privati.57/65/89/33 restano aperte; non è il gioco completo.
