# Review delle prove collettive dei superstiti — #98

Confronto fissato a `645e74e1313b9bb88c671c0a8ce30d0dab86b448` contro
`2cdaae4b4120f1fd0c5288cdaa520ba70cd3f857`: tre commit,44 file.
[Issue98](https://github.com/Ic3b3rg/lotr-table-game/issues/98),
[specifica/piano](../planning/live-groups-spec.md) e
[rapporto](../development/live-groups.md). Due review indipendenti con
contesti freschi; il root ha svolto separatamente le verifiche sotto.

## Standards

**Zero violazioni documentate.** AGENTS, glossario, ADR1–3, baseline di
fedeltà e contratto della nuova capacità sono rispettati nel diff esaminato.
Controller condiviso, numerosità fonte completa, origine immutabile e
semantica storica esplicita. Le modifiche ai21 test esistenti aggiornano
soltanto l'aspettativa dello schema; nessuna deadline, asserzione, dipendenza
o script indebolito.

Suggerimento facoltativo, possibile **Duplicated Code** in
`src/physical-resolution/front-runtime.ts:670`: la sequenza
`lastStand.settle`→controllo terminale→gate ripete la gestione a2630.
Un helper condiviso potrebbe ridurla conservando il fallback storico.
Non è una violazione o un difetto riprodotto; il root mantiene la modifica
circoscritta ai gruppi versionati, senza aggiungere un refactor al perimetro.

Verifica indipendente:6/6 test runtime in memoria e1/1 test di attestazione
compiler. Nessun host, browser, DB o validatore pesante eseguito dal reviewer.
Le verifiche più ampie dichiarate dal child erano soltanto lette.

## Spec

**Zero rilievi:** nessun requisito mancante/parziale, scope creep o
comportamento errato riprodotto nel diff esaminato.

Controllati marker/certificato/freeze, rifiuto schema≤18 anche nell'origine,
programma scenario effettivo, ordine condiviso e riassegnazione del chooser,
discendenti, reazioni dell'oscurità, sospensione terminale, reset e ritorno.
La numerosità originale della Compagnia rimane intatta e i programmi senza
marker conservano il percorso storico.

Verifica indipendente:6/6 test runtime in memoria. Nessuna suite completa,
prova HTTP, SIGKILL, browser, validatore ricevuto o rilettura delle primarie
eseguita dal reviewer. Nessun probe separato eseguito. Le dichiarazioni
più ampie della consegna erano soltanto lette.

**Conteggio per asse:** Standards0 violazioni/1 suggerimento facoltativo;
Spec0 rilievi. Nessun ordinamento trasversale fra i due assi.

## Verifica del root

I tre commit sono integrati su un branch locale dalla base fissata, senza
modifiche al codice consegnato. Il root ha verificato il sigillo e ciascuno
dei2169 file/1446920021 byte, quindi creato copie proprie per eseguire gli
adapter; evidenze ricevute e DB rimangono intatti. Manifest SHA256
`4c450bd02b83c72b125fe81c30610d42aa34dadfdb21c52671905d74b6a8944c`.

Riletti13 corpi IL pertinenti:5809 byte codice/1889 istruzioni, tutti gli
hash e campi del ledger concordanti salvo i percorsi dei file rilocati.
Ripetuti lettori dei10 oggetti/32065 byte, localizzazione e oracle bounded.
Tutti e tre gli output compiler storici sono identici byte per byte; il
nuovo pack statico differisce soltanto nella capacità e coincide con la
consegna. PDF ufficiale verificato per byte/hash e sezioni normative.
Nessuna esecuzione Unity/JIT, parità RNG o partita originale dedotta.

Validator ricostruito dai sorgenti integrati:503/503 file autorizzati,
398 payload distinti,17 viste94 complete. Ogni input controllato per byte/hash
e confrontato interamente una volta. Passano inoltre18 snapshot/viste96,
export/finale96 e14 snapshot/viste98, export/finale98; questi ultimi hanno
13 payload distinti. Soltanto schema19 e il default storico physical:null
per versioni≤10 sono migrazioni; i restore su host nuovo differiscono nei
soli campi generation/revision/updatedAt. Originale156 gated/intatto.
Nessuna esenzione, normalizzazione gameplay o nuova prova ottenuta contando
copie identiche. Le differenze del bundle child/root sono esclusivamente
commenti con il percorso della stessa dipendenza; confronto dei payload
e validatore eseguito non sono stati normalizzati.

Audit ricevuto UI:11 checkpoint×3 identità×4 larghezze=132 casi sintetici,
492 PNG,15 file eventi/15926 eventi. Controllati tutti i record su payload
immutato, overflow, lettore/focus, tastiera, guida e assenza crypto.subtle;
zero eccezioni/loadingFailed e due HTTP422 di restore intenzionali.
Il root ha ispezionato cinque immagini, comprese le decisioni effettive
dei superstiti a320/1440 e la guida; non tutti i492 PNG. Chiusura dei tre
contesti e rilascio della porta propria attestati. Il root non ha avviato
un nuovo browser; la nuova esecuzione runtime è nella suite automatica.

Suite canonica root **719/719**, zero fail/skip/cancel/todo,
494088,483417ms, concorrenza4 invariata. Eseguita da sola dopo tutte le
verifiche pesanti e senza modificare i sorgenti consegnati. Typecheck,
formato e diff passano; nessuna nuova deadline o soglia.

Validator ricostruito nuovamente dal commit finale e confrontato byte per
byte con quello usato per tutti i confronti. Privacy260 needle/zero leak
su diff, file pubblici e nuova storia. Nessun corpus o materiale originale
tracciato. Comandi, output, adattamenti e tentativi restano nella scratch
ignorata del root, separati dal sigillo ricevuto.

Quantità57 null/unverified e gate mantenuto per decisione del proprietario.
Nessuna nuova partita originale, ripresa156 o accettazione89/33. Le issue
57/65/89/33 rimangono aperte. Interazione del covo/vittoria, catena119↔123,
altri rami, campo completo e A2 richiedono il seguito. Schema19 richiede
il nuovo lettore; rollback dei dati tramite un backup precedente.
