# Due segnalini minaccia — #112

Contratto: [issue112](https://github.com/Ic3b3rg/lotr-table-game/issues/112).
Base `4d50c29cb19c154c3cfc2558b50368fde6514bda`, schema25/baseline840,
dopo chiusura110. Glossario, ADR2–3, baseline di fedeltà, contratti55/61/75
e spec/report89/98/100/102/104/106/108/110 rimangono vincolanti.
Implementazione personale nel checkout assegnato; root possiede review e
integrazione. Nessuna delega, installazione, altro checkout o scrittura remota.

## Risultato e autorità

Giocare dalla UI i soli due segnalini già selezionati: ispezione/cancel
gratuiti, conferma con una sola azione, prove reali, conseguenze, eventuale
nuovo tentativo e ritorno al turno/viaggio. Selezione e posa congelate immutate.
Nessun nuovo originale o ripresa156; positivi interamente inventati con tutte
le precondizioni dichiarate prima dello startup.

Perimetro primario: prefab5696/FSM27669,8 stati/9 azioni;
prefab5515/FSM27488,12/12. Conservare l'inventario intero20/21, inclusi tre
stati non ammessi del secondo owner. Due reader concordi su modelli, root,
nodi, FSM, parametri e packet; rilettura bounded dei soli owner/callee.
Oracle indipendente da compiler/runtime, byte/hash verificati prima del parse.
Raw, localizzazione, carte, IR/FSM/IL/JSON e immagini solo scratch ignorata,
anche nella storia Git. Pubblici codice, fixture inventate e metadati tecnici.

Input110: manifest1830594 byte, SHA256
`ba6eb1dd311d388c7fbaabb029635b8e5233f5391326d9595411994b5c44443e`,
8542 file/3654464113 byte. Tutte le righe verificate prima della copia.
Ricevute/identità/provenienza invariate; adapter e handle operativi propri.
Ricostruire byte-identico il pack110 prima di aggiungere la nuova capacità.

## Contratto di esecuzione

Capacità facoltativa `manifest.threatTokens`, `source-threat-tokens-v1`,
attestata e congelata ante-startup. Due owner esclusivi con hash di prefab,
modello/nodo, definizione e certificato intero; stati ammessi espliciti,
stati esclusi motivati e un solo confine differito non eseguibile. Prodotti
esattamente[0], controller e binding fonte attestati. Nessun retrofit.

Il primo owner usa sourceTest Saggezza2. Fallire torna all'attesa visibile,
rilascia il padre e conserva le carte/risorse pagate; riprovare è una nuova
azione. Il successo risolve il beneficio col consumer esistente e l'IntAdd−4
del binding minaccia, poi messaggio, rimozione/termine una volta. L'ordine
non sequenziale delle due azioni rimane conservato.

Il secondo usa sourceTest Spirito2. Successo: ispirazione1 cappata e
rimozione. Fallimento: OwnsProducts conserva esattamente `[null]`, entrambi
gli eventi e il confine escluso. OnEnter06001120 chiama IsOwned060010fa;
Unity Object equality su null restituisce false, quindi soltanto evento0,
paura1 col consumer P1/P2 e rimozione. PlayerChoice/ModifyCorruption restano
nel certificato intero e nell'oracle; non vengono simulati o abilitati.

Il pavimento0 è attestato da Update06000c8b,270 byte, getter/setter e
binding AdventureThreat. Estendere l'approccio linked102 al solo nuovo
indirizzo owner/stato/azione. Nessun clamp globale di IntAdd, nuovo polling
Update/perdita, modifica di contatori, PlayerCount, budget o cap storici.

Le prove usano carte e conversioni reali, statistica e target dal packet;
nessun Pass/Fail o successo libero. Attore, casella, round/turno, conteggio
e residuo viaggio persistiti. Riutilizzare regola76.1 e consumer condivisi;
programmi storici e contesti autonomi senza owner mantengono la forma valida.
L'attore sconfitto conserva il padre senza nuove scelte personali/perdita.

Preflight dell'intera continuazione prima di azione/carte/RNG: entrambi gli
esiti, benefici, popolazioni, effetti/preparazioni e discendenti, provocazioni
e P1/P2. Quantità57 null/unverified mantengono il blocco dell'intera azione,
anche se il ramo scelto non acquisirebbe benefici. Nessun filtro, proxy,
unknown=empty, RNG/reroll o premio dal solo testo.

## Persistenza e accettazione

Stesso Store.once, ledger e origine immutabile round1/Azione. Autorizzazioni
player/hero/source/space/card/cursor; concurrent/stale/retry confrontano la
ricevuta del vero vincitore e interi payload/viste. Schema26 solo strutturale:
formati≤25 rifiutano nuove forme anche nel seed; omonimi nei dizionari validi.
Nessuna normalizzazione gameplay, reinterpretazione storica o esenzione.

TDD compiler/programmi/controller HTTP/SQLite inventati: certificati20/21,
cancel/costo, entrambi gli esiti, retry, conversioni, beneficio/ispirazione,
paura/P2, stock57, null/prodotti, clamp0/1/3/4/>4 e fonte alterata,
provocazioni/sconfitta/cleanup. SIGKILL prima/dopo commit e restore packless
su host nuovi vuoti; confronti interi e negativi risignati422 immutabili.
Nessun hook di test in produzione o motore parallelo.

QA nativa inventata: tre identità,320/768/1024/1440,HTTP IPv4 senza
crypto.subtle. Dopo bootstrap solo DOM/Input gioca; GET/evaluate osservano.
Costo, attore, carte/esito, retry/attesa/prossimo passo chiari. Guida/lettore,
focus/tastiera/no overflow, screenshot dipinti ispezionati, export/restore
corrente e recupero posti. Solo host/profilo/contesti propri, porta4413.

Validator git-show/onLoad dal commit finale:503 file/398 payload/17 viste94,
serie96–10818/14/17/19/13/20/22,40 snapshot110 e9 recheck degli stessi
giochi, export/finali interi e nuovi propri. Byte/hash prima del parse;
sole migrazioni schemaVersion e physical:null storico≤10; al restore solo
generation/revision/updatedAt.156 statico/gated/immutato; duplicati non nuovi GP.
Ogni modifica codice richiede la ripetizione delle serie intere.

Canonica `npm test` da sola, concorrenza4 dopo controlli pesanti; tipi/formato/
diff/privacy su file e storia intera. Nessun caso/assert/deadline/soglia
ridotto, skip/suppression o dipendenza. Commit locali ordinati/puliti,
report tecnico e README/sigillo privati con comandi/tentativi/input/hash/limiti.
57/65/89/33 aperte; campo completo, upgrade oltre base e A2 sono seguiti.
