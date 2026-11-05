# Review del covo e della vittoria — #100

Confronto fissato a `c38a8c6ce8e3b62ddd1ce95b424af186d2769ff4` contro
`0565b49fca9329e02e6bf9c7d3a91f1d1092cbaf`: cinque commit,50 file.
[Issue100](https://github.com/Ic3b3rg/lotr-table-game/issues/100),
[specifica](../planning/lair-victory-spec.md), [piano](../planning/lair-victory-plan.md)
e [rapporto](../development/lair-victory.md). Due contesti di review freschi;
verifiche del root separate dalle dichiarazioni della consegna.

## Standards

**Nessuna violazione documentata trovata.** Esaminati diff, sorgenti/test
modificati, guardie storiche, dispatch del termine, replay e standard forniti.
Le modifiche ai test precedenti riguardano soltanto aspettative di schema.

Suggerimento euristico, possibile **Duplicated Code**:
`src/scenario/lair-capability.ts:46` raccoglie gli ingressi NODE CLICKED e
richiede una conferma esclusiva, ripetendo `clue-capability.ts:58`.
Un validator condiviso potrebbe mantenere allineati i due controlli.
È un giudizio di manutenzione, non una violazione documentata. Il root
mantiene il perimetro funzionale consegnato senza questo refactor facoltativo.

Il reviewer ha svolto soltanto ispezione Git/sorgenti read-only: nessun test,
build, host, browser, DB, gameplay originale o helper ricevuto eseguito.
Le dichiarazioni runtime/compatibilità del rapporto non sono state da lui
riprodotte indipendentemente.

## Spec

**Nessun rilievo attuabile:** nessun requisito mancante/parziale, scope creep
o comportamento errato identificato nel diff esaminato.

Controllati issue/spec/piano/report, ADR2–3 e baseline, limiti inclusivi,
progresso persistente, owner EndGame, provenienza dell'attore, premi/campo,
preflight e guardie storiche.

Verifica indipendente in memoria: compiler3/3, runtime4/4; i due file erano
stati invocati anche insieme, senza contare la ripetizione come nuovi casi.
Probe storico228/228: schemi1–19, sei nuove forme di marker/opcode/campi
della conclusione, sia scenario corrente sia origine del replay.
Nessuna suite completa, attività host/browser/DB, helper ricevuto o scrittura.
Compatibilità e primarie rimangono nella verifica separata del root.

**Conteggio per asse:** Standards0 violazioni/1 suggerimento facoltativo;
Spec0 rilievi. Gli assi restano separati, senza un ordinamento comune.

## Verifica del root

Cinque commit integrati dalla base fissata senza modifiche al codice
consegnato. Verificati tutti i2257 file/1638161665 byte e create due copie
proprie, una immutabile e una per gli adapter. Manifest SHA256
`7b312580310d039f317bca709936433d9c9d74203d01754904358b401875bdf8`.
Nessun DB ricevuto aperto, helper eseguito in posto o sigillo alterato.

Riletti quattro asset/272248 byte con due lettori,17 owner IL/1077 byte
codice/376 istruzioni e PlayMaker154 byte/68 istruzioni. Hash, lunghezze e
ledger coincidono salvo i percorsi locali dei file IL. Sedici chiavi italiane
ricontrollate; compiler storico invariato e tre output del nuovo freeze
identici byte per byte. Oracle separato:29 azioni,18 stati del covo e50000
casi di somma/limite/ordine/fallback. Nessuna esecuzione Unity/JIT o parità RNG.

Validator ricostruito dai sorgenti integrati:503/503 file autorizzati,
398 payload distinti e17 viste94. Ogni file è verificato per byte/hash e
confrontato interamente una volta. Passano18 snapshot/viste96,14 snapshot/viste98
e17 snapshot/viste100, inclusi export/finali. I17 nuovi snapshot contengono
16 payload distinti. Solo schema20 e il default storico physical:null≤10
sono migrazioni; i restore su nuovo host differiscono nei soli campi
generation/revision/updatedAt. Nessun gameplay o normalizzazione sui ricevuti,
nessuna esenzione replay. Originale156 rimane gated e immutato.

Audit UI ricevuto:168 casi completi su14 checkpoint e24 casi separati di
ispezione/annullamento gratuito, tre identità e quattro larghezze. Nei168
record sono verificati guida, lettore/focus, tastiera e assenza crypto.subtle;
nei24, proprietario abilitato, annullamento gratuito e assenza overflow.
Tutti i192 casi dichiarano payload immutato. Seicento PNG,12 file eventi/
19870 eventi, zero eccezioni/loadingFailed e due HTTP422 intenzionali.
Cinque immagini ispezionate dal root: carte a320, stato dell'attore a768,
vittoria a1440 e campo a320/1440; non tutti i600 PNG. Ricevuta di chiusura
dei tre contesti e rilascio della porta propria verificata. Nessun nuovo
browser eseguito dal root; nuova esecuzione runtime nella suite automatica.

L'adapter di audit root aveva inizialmente assunto un'unica forma dei record
QA; i due KeyError sono errori del solo helper, registrati separatamente.
Il controllo finale distingue le due forme e non inventa verifiche mancanti.
Invarianti riprodotte sui22 test preesistenti: soli attesi19→20; script,
deadline, casi, asserzioni, concorrenza e dipendenze invariati.

Suite canonica root **733/733**, zero fail/skip/cancel/todo,
552249,210708ms, concorrenza4 invariata, eseguita da sola dopo tutte le
verifiche pesanti. Typecheck, formato e diff passano. Il codice consegnato
non è stato modificato dal root.

Validator ricostruito dal commit finale e byte-identico a quello dell'intero
confronto. Le differenze rispetto al bundle child sono soltanto commenti
con il percorso della stessa dipendenza; nessuna riscrittura del runtime
o dei payload. Privacy269 needle/zero leak su diff, pubblico e nuova storia.
Comandi, tentativi e byte/hash nella scratch root, separati dalle evidenze.

Quantità57 null/unverified e blocco mantenuto. Nessuna partita originale,
ripresa156 o accettazione89/33. #57/#65/#89/#33 rimangono aperte;
119↔123, altri rami, campo completo/acquisti e A2 restano successivi.
I dati schema20 richiedono il nuovo lettore; rollback con backup precedente.
