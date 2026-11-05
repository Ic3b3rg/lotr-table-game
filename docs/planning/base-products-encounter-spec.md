# Incontro nel perimetro base — #104

Contratto: [issue104](https://github.com/Ic3b3rg/lotr-table-game/issues/104),
base `fb6a2bbab354d2f92ce5a59e17b898f988701fcc`, schema21,757 test.
Glossario, ADR2–3, baseline di fedeltà e contratti55/89/98/100/102 vincolanti.
Unico implementer nel checkout assegnato; review Standards/Spec e integrazione
al root. Scelte ordinarie già autorizzate, nessun nuovo gate di approvazione.

## Fonte e risultato

Chiudere verticalmente la sola interazione75 per input esplicito prodotto[0]:
ispezione gratuita, impegno/costo una volta, prova con carte e conversioni,
conseguenza fonte, rimozione e ritorno. Riusare scenario, frame, consumer
fisici P1/P2, provocazioni, esplorazione e Store.once. Nessun executor nuovo.

Ricevuti102 verificati prima del parse:2669 file/1854240772 byte,
manifest SHA256
`4b7cf61ac90caa035044f0691cb17aa34b7ca0e28b1f3115e857d303b5f0a974`.
Copie e adapter propri nella scratch ignorata; nessun helper o DB ricevuto
eseguito in posto. Probe aggiuntivo verificato626656 byte, SHA256
`8cc0b275a2ed48f1d938dbdac446f8172f94452d57c358caf0c961fdb1a302fc`.

Rilettura bounded di S1581→R5486/node20400/FSM27459 e soli modelli
S2319/S2323/S2780:7 oggetti/68563 byte, due reader concordi, consumo completo,
puntatori e parametri confrontati col normalizzato. FSM intero14 stati/
14 azioni, ordine non sequenziale preservato. Packet italiani MAIN riletti
dal TextAsset primario. Owner effettivi OwnsProducts1120→IsOwned10fa→
GetProduct10fc: congiunzione dei requisiti, lookup per ID nella collezione
posseduta, null falso. Non si legge alcuno stato personale di licenza.

Adattamento esplicito di prodotto: il set attestato è[0], non una deduzione
dagli asset, IsLocked o quantità mancanti. ProductModel0 non contiene
TitleModel33; ProductModel5 lo contiene. L'azione richiede5: sul set[0]
emette il ramo0 e termina PRIMA dell'incremento del contatore e del titolo.
Il ramo1 e i cinque stati esterni restano documentati e diagnosticati,
senza compilare un premio/carta/policy fuori base. Oracle statico separato
verifica tutte14 azioni, uguaglianza3 distinta da meno/più e raggiungibilità.

Il primo CANCEL annulla l'ispezione senza costo. Il secondo appartiene
alla prova di Ingegno1 e significa fallimento, determinato dalle carte.
Successo:1 ispirazione cappata, messaggio e guardia. Fallimento: Scatto1
facoltativo e rimozione. Entrambi raggiungono Hide prima di FinishFSM.
Nessun pulsante Pass/Fail, risultato libero, secondo costo o rimborso.

Scatto è un movimento aggiuntivo, non un viaggio né uno scarto di carta
inventato: è il packet a concederlo. Riusare adiacenza, provocazioni di
tutti i gruppi pronti, esplorazione obbligatoria e ritorni. La concessione
non modifica il budget del viaggio interrotto. Fonti normative puntuali:
[Rules Reference §§37.3,60.2–4,89](https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf).

## Capacità, preflight e persistenza

Capacità facoltativa piccola `manifest.baseProducts`, attestata dal compiler
e congelata ante-startup, locale a un prefab/definizione. Legare hash di
prefab, closure/certificato intero, oggetti ProductModel0/5 e owner pertinenti,
input[0], controller e realizzazione. Set ignoto/non attestato/non ammesso
rifiutato prima di emettere il freeze, avviare lo scenario o pagare effetti.
Il binding alla realizzazione deve confermare esattamente gli stessi prodotti.
Nessun aggiornamento di capacità o origine durante il run.

Il modulo profondo resta scenario: compile/parse attestano; INTERACT_SCENARIO
e SCENARIO_INPUT possiedono l'intera continuazione e la concessione Scatto.
Il nuovo handler prodotti è ammesso soltanto nel proprio owner; il ramo
fuori base è un confine differito, mai una scelta client. Nessuna mutazione
globale è ammessa nella closure base. Eventi diretti/manomissioni dei guard
non possono raggiungere contatore/titolo. Incontro e pool rimangono interi.

Preflight dell'intero seguito ammesso prima di costo/carte/RNG: esiti della
prova, premio, Scatto, tutte le destinazioni legali e relativi receiver,
esplorazione, provocazioni, P1/P2 e ritorni. Nessun filtro per capacità o
reroll. Dipendenze mancanti e quantità57 conservano il gate specifico e
l'intero payload. Nessun polling nuovo della perdita. Dopo sconfitta,
callback/effect continuano solo nei confini attestati; nessuna nuova scelta
personale del defunto. PlayerCount, budget e proprietà non diminuiscono.

Schema22 introduce soltanto le forme nuove; migrazione21→22 strutturale.
Schemi≤21 rifiutano capacità, istruzioni, richieste, origini di provocazione
e concessioni nuove anche nel seed. Pack/programmi storici, impronte,
origine immutabile round1/Azione, semantica e ricevute restano invariati.
Replay intero, nessuna esenzione o normalizzazione gameplay.

## Verifica e UI

TDD tramite compile/parse, programma scenario reale derivato da fixture
inventate, comandi HTTP/SQLite/Store.once e backup/replay. Costi/cancel,
pass/fail/conversioni, premio al cap, Scatto accettato/rifiutato, conseguenze,
ritorni fra proprietari, prodotti e guard. Autorizzazione actor/hero/space/
source/card/cursor, concorrenza/stale/retry/receipt, nessun doppio effetto.
SIGKILL/restore su host nuovi vuoti packless ai nuovi confini; interi
payload/viste, alterazioni risignate respinte.

UI italiana nel design system esistente: attore, costo già pagato, carte,
totali/esito, prossimo passo, Scatto facoltativo e attesa degli altri chiari.
Guida/lettore/focus/tastiera disponibili, niente controlli liberi o dettagli
del certificato nella normale UI di gioco. QA positiva SOLO inventata,
precondizioni dichiarate ante-startup,3 identità autonome e320/768/1024/1440,
HTTP IPv4 senza crypto.subtle. Dopo bootstrap soltanto DOM/Input per
avvio/visita/prova/conseguenze/ritorno; GET per osservare.

Validator finale ricostruito dal commit e byte-identico per i confronti:
503 file/17 viste94,18 snapshot/viste96,14 snapshot/viste98,17 snapshot/
viste100,19 snapshot/viste102, export/finali. Byte/hash prima del parse,
wholepayload/wholeview e sole migrazioni dichiarate. Copie identiche non
nuove prove; originale156 gated/immutato, nessun gameplay sui ricevuti.

Suite canonica757+nuovi a concorrenza4 DA SOLA dopo QA/validator pesanti;
typecheck/formato/diff/privacy anche storia. Nessuna asserzione/caso/deadline/
soglia indebolita, suppression/skip o dipendenza nuova. Commit locali puliti,
report pubblico tecnico e README/sigillo privati con input/comandi/tentativi/
byte/hash/limiti. Chiudere propri host/browser prima della consegna.

Quantità57 null/unverified: «Mantieni il blocco finché le quantità sono
verificate». Nessun5/5/5/proxy/infinito/unknown=empty/filtro/reroll/domanda
ripetuta. Nessuna nuova partita originale, ripresa156 o accettazione/chiusura
89/33/57/65. Prodotto5,109/inventario, altri incontri, campo completo e A2
successivi. Nessun altro agente/checkout/installazione/GHwrite/push/PR/merge.
Originali/prosa/carte/IR/FSM/IL/JSON/immagini solo scratch ignorata anche storia;
solo superfici/PID propri, nessun inventario globale o preview delle modifiche.
