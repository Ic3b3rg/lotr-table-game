# Due incontri di ricerca — #110

La capacità facoltativa `source-search-encounters-v1` completa due owner della
mappa A1 e li collega alla normale interazione dal tavolo. Ispezione e chiusura
sono gratuite; l'impegno costa una sola azione. Scelta, carte, conversioni,
effetti, riconoscimento del messaggio, rimozione e ritorno usano lo stesso
ledger e l'origine immutabile round1/Azione.

La [specifica](../planning/search-encounters-spec.md) e il
[piano](../planning/search-encounters-plan.md) precedono l'implementazione.
Base `cd125df0466878ba808d30b2107a72e1fb66995d`, schema24/baseline816 dopo108;
nuovo schema25. Review Standards/Spec e integrazione competono al root.

## Closure e consumer

Owner92: `prefabresources.assets:5475`, FSM27448,8 stati/8 azioni.
Owner93: `prefabresources.assets:5479`, FSM27452,9/9. Modelli, nodi, certificati,
metodi, prodotti base e definizioni intere sono attestati ante-startup.
Restano identiche le quattro azioni già certificate e le liste dei prefab;
si chiudono soltanto i due gate di questi owner. Il compiler rifiuta closure
parziali, receiver sovrapposti, callback mancanti, effetti scambiati e permessi
trasferiti ad altre definizioni.

Il secondo `DisplayMessageCancelConfirm` è una scelta binaria già pagata.
Entrambi gli eventi producono il proprio effetto: nessun secondo costo,
rimborso o cancel inventato. La prova conserva il binding locale iniziale0,
statistica e limiti superiori inclusivi0/1/2 con fallback ultimo. Il conteggio
0…99 deriva dalle carte e dalle conversioni del vero attore.

I messaggi avviano consumer fisici tipizzati: scarto di danno/paura,
Scoperta, disposizione senza preparazione, alternativa con preparazione dagli
scarti e ispirazione. La disposizione non presenta né accetta preparazione o
scarto per il limite. La preparazione dagli scarti conserva tutte le copie,
il limite di quattro e i trigger dopo-preparazione/scarto. Le alternative
restano visibili anche con un effetto impossibile. La regola del mazzo abilità
esaurito è applicata anche all'esito zero; i programmi storici mantengono la
propria forma. Nessun effetto viene risolto dal solo testo.

Il preflight percorre tutta la continuazione prima di azioni, carte o RNG,
comprese tutte le opzioni, le popolazioni preparabili e i loro consumer.
Dipendenze mancanti conservano la diagnostica specifica. Provocazioni, P1/P2,
sostituzioni, attore sconfitto, cleanup e ritorni riusano il controller esistente.
Un attore sconfitto non riceve nuove scelte personali. Non sono introdotti
un secondo motore, esiti manuali o hook di test in produzione.

## Persistenza

Store.once conserva la ricevuta del vero vincitore fra richieste concorrenti,
stale e retry. Le guardie verificano player, eroe, segnalino, spazio, carta e
cursor. Schema25 migra soltanto la struttura: i formati≤24 rifiutano le nuove
forme anche nel seed; gli omonimi nei normali dizionari rimangono validi.
Nessun pack o origine riceve aggiunte retroattive.

Le prove intercettano il vero UPDATE SQLite e terminano14 worker prima del
commit: rollback del payload intero e retry esatto del candidato. Altri14
SIGKILL dopo commit ripartono su host nuovi, vuoti e packless ai confini di
scelte, carte, conversioni, preparazione, messaggi e ritorno. Payload, viste e
origine sono confrontati interamente;15 negativi risignati ricevono422 senza
mutazioni. Non sono applicate normalizzazioni gameplay.

## Fonti e verifica

Manifest ricevuto998832 byte, SHA256
`28c9a5ba0bbb79cc950295be5ec896473318c937bf2c4b5ff2e308f6448c14f3`:
4728 file/2791095473 byte verificati prima di parse o copia;916 PNG audit-only.
Ricevute, identità e provenienza restano immutate. Si adattano soltanto i
percorsi operativi nelle copie proprie.

Due reader verificano8 oggetti/92974 byte, tutti17 stati/17 azioni e2003
record di parametri,1 binding e11 relabel posizionali. Oracle indipendente,
senza import dal prodotto:35 corpi IL pertinenti,6246 byte di codice,
2235 istruzioni,281 salti e17 regioni di eccezione;14 valori di localizzazione
e100 conteggi. Modelli/prefab/nodi, packet completi e soli callee pertinenti
sono riletti puntualmente, senza nuova scansione globale.

Il pack privato passa da37 definizioni/279 stati/295 azioni/30 deferred edge a
37/290/308/28. Fingerprint precedente
`755729b27d760d96a2bc14203259245d9d04d4e8b97930cece8233181c763aad`;
nuovo `1bca5b17c89617fbdcfc6bd3c491187947f00a83161e61d07db1a1c8ef3ecaf9`.
Tre compilazioni sono identiche per byte e validano staticamente la proiezione
ricevuta. Raw, corpus, carte, prosa, IR/FSM/IL, JSON e immagini rimangono
nella scratch ignorata; il repository contiene codice e fixture inventate.

24 nuovi test TDD attraversano veri programmi compilati, carte/effetti,
conversioni, reset del mazzo, ownership, concorrenza, recupero, P2/sconfitta e
provocazioni. Le regressioni trovate includono il permesso del premio senza
clues e il reset del mazzo in entrambi i rami. I tentativi falliti sono conservati.
La prima canonica completa ha rilevato due regressioni nel builder fisico dei
contesti storici senza owner:838/840, zero skip/cancel. La capacità nuova ora
si attiva soltanto su un'istanza reale attestata; i due test esistenti e tutti
i relativi assert restano identici. Il GREEN mirato è16/16 e la canonica
viene ripetuta interamente dopo tutte le verifiche pesanti.

La QA nativa finale ripete tre episodi interamente inventati, con precondizioni
fissate prima dello startup: entrambe le scelte e conteggi0/1/2, tre identità
per episodio,320/768/1024/1440,HTTP IPv4 senza crypto.subtle. Dopo bootstrap
soltanto DOM/Input gioca; GET/evaluate osservano.444 casi verificano
costo/attore/opzioni/attesa/prossimo passo, guida, lettore, focus, tastiera e
assenza overflow.1680 PNG superano il controllo di pittura;812 file distinti,
cinque viste positive ispezionate direttamente. I duplicati non aggiungono
prova gameplay. La cura positiva è provata dai test con vere carte detenute;
non viene dedotta dal ramo nativo senza danni.

Le serie finali conservano11/14/15 snapshot e viste intere,10/13/14 payload
distinti, export esatti, restore corrente e recupero dei tre posti dalla UI.
Sei negativi intenzionali ricevono422; nessuna eccezione Runtime, richiesta
fallita o errore di rete inatteso. Un timeout del driver durante Escape nella
guida è conservato e ripreso sullo stesso payload; la matrice completa viene
ripetuta prima dell'acknowledgement. Nessuno startup o pesca è ripetuto per
quel tentativo. Tutti gli host, browser e contesti propri sono chiusi e la
porta propria è stata nuovamente associata per verificarne il rilascio.
Dopo la correzione del builder, gli stessi tre export inventati sono importati
dalla UI su nuovi host vuoti e packless:72 ulteriori casi di QA, con recupero
posti, export/restore e confronto del payload intero in sola lettura. Queste verifiche non aggiungono
partite, startup, pescate o nuova prova gameplay. L'intera serie originale
rimane byte-immutata e viene riletta integralmente dal nuovo validator.

Il validator git-show/onLoad usa esclusivamente i sorgenti committati;
binario1636257 byte, SHA256
`5925e41b7dd719ee597dcf08618ed0c9e2511ebe3e31e46c5d47aa4c5676a746`.
Confronta503 file/398 payload distinti e17 viste94. Le intere serie native
96/98/100/102/104/106/108 mantengono18/14/17/19/13/20/22 snapshot e viste,
con18/13/16/18/12/18/19 payload distinti ed export/finali. Tutte sono ripetute
dal commit finale, insieme alle tre serie110. Sole differenze storiche:
schemaVersion e physical:null≤10; al restore soltanto generation/revision/
updatedAt. Nessuna altra normalizzazione o esenzione. Byte/hash sono
ricontrollati prima del parse. I tentativi e l'identità del commit/binario
rimangono nelle ricevute private.

La canonica usa `npm test` da sola, concorrenza4: baseline816 più24 test.
Tipi, formato, diff e privacy coprono tutta la nuova storia; nessun caso,
assert, deadline o soglia ridotto, skip, suppression o dipendenza aggiunta.
Ricevute private conservano comandi, tentativi, commit, binario, byte e SHA256.

## Limiti conservati

Nessuna partita originale nuova o ripresa156.156 è soltanto preflight statico
gated e immutabile. La selezione originale congelata e gli altri prefab restano
identici, inclusi21/15.57 resta null/unverified e bloccata per preferenza
esplicita; nessun proxy, filtro, reroll o riduzione delle popolazioni.
Inventario106,108, Scatto, indizi, titoli, vittoria/sconfitta e campo mantengono
le rispettive capacità. Non sono chiuse89/33/65/57 né certificati il gioco o
l'avventura completi. Nessun tavolo live del proprietario è dichiarato aggiornato.

## Integrazione del root

Due review fresche senza rilievi, Standards0/Spec0. Il root riproduce fonti/oracle e compilazioni, interi salvataggi/viste/export storici e49snapshot nativi, verifica444casi più72restore e legge cinque immagini. Seconda canonica isolata840/840, exit code0, zero fail/skip/cancel, con tipi/formato/diff/privacy verificati. La prima aveva un HTTP500 in un test storico: non riprodotto in cinque prove mirate e nella ripetizione completa; causa non dichiarata risolta, log conservato e diagnostica aggiunta al solo helper del test. Nessuna modifica di prodotto del root. [Review e limiti](../reviews/2026-11-05-search-encounters.md).57resta null/unverified e156statico/gated.
