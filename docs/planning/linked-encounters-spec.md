# Incontri collegati e titolo — #102

Contratto: [issue102](https://github.com/Ic3b3rg/lotr-table-game/issues/102),
base `08593af56f604bb0510248943d7f3bf57f28fe3d`, schema20, baseline733.
Glossario, ADR2–3 e baseline di fedeltà vincolanti. Unico implementer nel
checkout assegnato; scelte ordinarie, seam e commit locali già autorizzati.
Review Standards/Spec e integrazione spettano al root. Nessuna delega,
installazione, checkout aggiuntivo o scrittura remota.

## Risultato e fonti

Abilitare la sola catena certificata di due incontri: prima visita,
listener nascosto, prove con carte, conseguenze, ritorno fra proprietari e
acquisizione/preparazione del titolo fonte. Riutilizzare scenario, frame,
fisica P1/P2, controller di combattimento/provocazioni e Store.once.
Le prove positive sono inventate; gli originali servono solo a confronto
statico, compiler e oracle, mai a una nuova partita.

Il manifest ricevuto100 è verificato prima del parse:2257 file,
1638161665 byte, SHA256
`7b312580310d039f317bca709936433d9c9d74203d01754904358b401875bdf8`.
Ricevute originali dei27 input separate dalle copie rilocate e dagli adapter.
Tutto il materiale privato rimane nella scratch ignorata, anche nella storia.
Nessun helper o DB ricevuto viene eseguito in posto.

Grounding bounded sulle primarie proprie: R27611 completo19 stati/21 azioni,
R27602 completo22 stati/22 azioni, root/GameNode/model pertinenti e
S2755/S2604. Due reader concordi, consumo integrale, puntatori e parametri
raw confrontati col normalizzato. TitleModel10 e SkillModel90 sono identità
distinte, collegate dal puntatore effettivo.31 chiavi MAIN italiane rilette
dal TextAsset primario; owner IL di test, scelta, premio, aritmetica,
broadcast e lifecycle verificati. Nessuna ricostruzione globale dell'app.

119 distingue ispezione/conferma iniziale dalla successiva scelta con icona
interazione. Il primo costo precede la scelta facoltativa Saggezza1; lasciare,
passare o fallire aggiorna la visita una volta. BoolFlip precede SEARCHED e
REVEAL; SEARCHED può avere zero receiver. Il secondo evento raggiunge123
anche nascosto: prima dell'esplorazione conserva il binding; dopo di essa
piazza il segnalino, mantenendo l'istanza clonata della self-reference.

123 distingue scelta dell'alternativa e prova fisica: Agilità2 e Ingegno2
sono sourceTest automatici, senza pulsanti Pass/Fail. Agilità fallita subisce
il danno fonte e poi emette comunque GOTWOOD; Ingegno fallito ritorna
all'attesa visibile. Premi cappati e cleanup seguono i rispettivi owner.
GOTWOOD assegna true, non inverte il binding di119.

Il ritorno119 offre l'opzione impegnativa solo col binding ricevuto; lasciare
rimane gratuito. Il suo costo attiva le finestre prima dell'interazione.
La variazione−4 ha pavimento0 soltanto nel binding minaccia attestato.
Contatore indizi−1, PlayerCount, budget e proprietà rimangono integri.
Segue il messaggio, la scelta obbligatoria dell'eroe e il premio una volta.
La fonte propone l'intera Compagnia, non i telefoni o soltanto l'attore;
non rimuove dal selettore un eroe sconfitto.

## Capacità e interfacce

`manifest.linked`, facoltativo `source-linked-encounters-v1`, congela prima
dello startup esattamente due prefab/definizioni complete, eventi, binding,
controller e identità della carta titolo. Attestazione del compiler e hash
legano il nuovo programma ai campi fonte. Whitelist locale delle istruzioni:
nessun permesso generale per titoli, ricompense o mutazioni campagna.
I gate storici e gli altri prefab conservano il proprio contratto.

Il modulo profondo resta scenario: compile/parse certificano il freeze;
INTERACT_SCENARIO e SCENARIO_INPUT eseguono la stessa continuazione.
Un selettore puro condiviso individua il packet d'ispezione attraversando
soltanto i branchBool fonte, senza mutazioni. Un evento facoltativo del
comando identifica esclusivamente l'opzione impegnativa certificata della
successiva visita. Non permette di inviare esiti o eventi arbitrari.

La scelta dell'eroe scrive l'indice fonte nel binding locale, con attore
del tentativo e destinatario distinti. Il figlio fisico titolo ha una causa
scenario esplicita, carta/hash/binding verificati, e riusa copie, custodia,
limite quattro, preparazione immediata e consumer delle abilità titolo.
Un titolo già ottenuto dalla Compagnia presenta il messaggio fonte e non
duplica, trasferisce o ripristina la carta rimossa. Quantità e policy titolo
sono verificate indipendentemente dai benefici57.
La policy della carta fonte appartiene alla finestra di attacco: rimozione
dall'avventura per scegliere un modificatore. Riusa i sei modificatori e
il consumer attacco già realizzati; nessun costo scarto, uso durante una
prova ordinaria o trigger dopo preparazione viene inventato.

Schema21 introduce queste forme. La migrazione20→21 è esclusivamente
strutturale. Formati≤20 rifiutano capacità, opzioni/istruzioni/programmi nuovi
anche nell'origine. Nessuna capacità default, retrofit o normalizzazione
gameplay; pack, impronta, origine round1/Azione, ricevute e replay invariati.

## Preflight e persistenza

Prima di ogni costo, carta o RNG controllare l'intera continuazione:
riceventi nascosti, piazzamenti, tutte le alternative, conseguenze fisiche,
titolo, destinatari e ritorni. Population intere, nessun filtro/reroll.
Capacità mancanti e quantità57 mantengono il gate esatto e payload immutato.
Padri/figli, risultati, risorse pagate, copie e movimenti residui sono
conservati; una sola restituzione anche fra telefoni diversi.

Sconfitta e perdita seguono P1/P2 e le finestre già attestate: callback ed
effetti immediati proseguono dove consentito; nessuna nuova scelta personale
del defunto, nessun polling generale nuovo. Zero superstiti conserva padre
sospeso e conclusione immediata, perdita differita alla finestra propria.

## UI e accettazione

Riutilizzare DOM e design system esistenti. Ispezione gratuita, attore,
costo, scelta/prova, carte e totali, destinatario e copia ottenuta devono
essere comprensibili. Guida/lettore/focus/tastiera, nessun overflow alle
larghezze320/768/1024/1440. Nessun comando libero per titolo, beneficio,
minaccia o esito. HTTP IPv4 senza crypto.subtle.

Seam TDD: compile/parse, comandi scenario e fisici, HTTP/SQLite/Store.once,
backup/replay, UI nativa. Fixture pubbliche inventate, oracle statico privato
indipendente da compiler/runtime su tutti gli stati, azioni e binding.
Copertura: tre esiti della prima visita; due ordini di rivelazione; entrambe
prove/fallimenti; GOTWOOD idempotente; minaccia0/1/3/4/>4; altro destinatario;
titolo/costi/copie una volta; provocazioni, figli e sconfitta.

HTTP verifica attore/eroe/copia/fonte/cursor/stale/retry/concorrenza. SIGKILL
e restore su host nuovo vuoto senza pack ai confini nuovi confrontano interi
payload/viste; alterazioni risignate respinte, nessuna esenzione al replay.

QA positiva soltanto inventata: precondizioni esplicite ante-startup, tre
identità autonome e quattro larghezze. Poi solo DOM/Input per startup,
visita→rivelazione→prova/conseguenza→ritorno→titolo; GET per osservare.
Solo propri host/browser/PID; chiuderli prima della consegna.

Validator ricostruito dal codice committato e byte-identico per i confronti:
503 file/17 viste94,18 snapshot/viste96,14 snapshot/viste98 e17 snapshot/viste100,
export/finali. Byte/hash prima del parse; solo migrazioni dichiarate;
copie identiche non contano come nuove prove. Nessun gameplay sui ricevuti.

Comandi: `npm run build`; `node --test --test-concurrency=4 tests/linked-*.test.mjs`;
`npm test` da sola dopo QA/validator pesanti; `npm run typecheck`;
`npm run format:check`; `git diff --check`. TypeScript strict/Prettier
esistenti, codice in src/shared/scenario/server/client/physical-resolution,
test Node in tests e fixture in tests/fixtures. Guardie esplicite, ad esempio
`if (!cap) return;`. Nessuna dipendenza nuova o suppression/skip.

Quantità57 null/unverified: «Mantieni il blocco finché le quantità sono
verificate». Nessun proxy/unknown=empty/riserva infinita, episodio originale,
ripresa156, accettazione/chiusura89/33/57/65. Campo completo, A2 e altri rami
restano successivi. Report pubblico tecnico; README/sigillo privati con input,
comandi/tentativi, byte/hash e limiti. Commit locali puliti, nessun push/PR.
