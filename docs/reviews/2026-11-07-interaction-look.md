# Review del consumer prima dell’interazione — #135

Confronto fisso `4a3b867c93ef538607b71b84cf9dd1721931f2ab` →
`089dbe2ac9e6129b3eec25d8cea96e2603f9defa`, otto commit.
Il prodotto congelato è `2ecc760`; l’ultimo commit aggiunge soltanto il
[rapporto di verifica](../testing/interaction-look-verification.md).
Questa review accetta il checkpoint implementato, senza chiudere #135 o #33.

## Standards

Review indipendente: zero difetti P1/P2, zero violazioni documentate e nessuno
smell facoltativo da riportare dopo la verifica dei chiamanti. Controllati
contratti, responsabilità dei moduli, privacy, fattibilità, versioni storiche e
registro ordinario secondo AGENTS, glossario e ADR 0002/0003.

Una prova inventata nuova sul selettore privato passa 4/4. Invertire in memoria
il controllo del proprietario fa fallire entrambe le verifiche di proprietà
(2 pass, 2 fail, exit1). I bundle mutati restano nella scratch della review:
nessuna modifica a prodotto o dist. Non è una mutation run dell’intera suite.

## Spec

Review indipendente: zero difetti azionabili nel checkpoint. Verificati binding
alla definizione corrente, vero impegno fonte, carta non rimossa, premio capped,
ordine materiale di costi/effetti, scelta dei gruppi pronti, ritorno fonte e
movimento residuo. Controllati proiezioni comuni, lettura autenticata corrente,
risposte tardive, migrazioni 1–31 e replay dell’episodio archiviato.

Le sei fixture di famiglia isolate non provano sei registri HTTP completi:
rimuovono il ciclo dopo l’apertura del nuovo confine. I percorsi ordinari di
fonte, indizi, primo combattimento, provocazione e archivio coprono il registro
condiviso. La review ha inoltre completato un nuovo caso HTTP inventato del
covo conservando il ciclo per l’intera lettura, prova, messaggio e ritorno:
1/1, exit0; un premio, una sola azione e movimento conservato. Questo campione
aggiuntivo non amplia la dichiarazione sulle altre cinque famiglie.

## Evidenza verificata dal Root

Root ha verificato il manifest privato: 862.071 byte, SHA256
`5c224958dbd46ff2eb724579a89a8a14385215ff2f160b19b4448c366cc17d1d`;
2.972 file ordinari, 561.995.993 byte, tutti coerenti per tipo, dimensione e hash.
Rapporti Root e implementer identici; tutte le righe correnti di src, dist,
tests e scripts coincidono con il prodotto congelato.

La canonica finale registrata è `npm test`, exit0: **1097/1097**, zero
fail/cancel/skip/todo, stderr vuoto, durata 1.552.022,742333 ms. Fingerprint di
src/dist/tests/scripts/lock identiche prima, dopo e alla consegna. Il precedente
tentativo completo 1096/1097 rimane conservato; la correzione riguarda soltanto
il mount del dialogo nel DOM fittizio preesistente. Le review non hanno ripetuto
la canonica invariata.

QA nativa inventata con tre identità indipendenti e PC condiviso, lettore a
320/768/1024/1440, entrambi gli ordini materiali, caso non fato/capped, recovery
e restore da file senza pack. Root ha visto direttamente lettore e ordine a320;
la review Spec ha visto il lettore a tutte le quattro larghezze e le attese degli
altri posti. Le restanti asserzioni/catture sono distinte nel rapporto. La
scelta dei gruppi di provocazione è verificata via HTTP, non dichiarata come
gameplay nativo del browser.

Una lista iniziale della review Spec ha mostrato nomi di file nella propria
evidenza oltre quelli necessari. La lettura è stata fermata: nessun contenuto
di quei profili, processo, target o superficie protetta è stato ispezionato.
Le letture successive usano soltanto percorsi selezionati.

## Limiti e decisione

Restano gate espliciti: finanziamento dipendente da fato nascosto, lettura
anticipata con provocazione interrompente non dimostrata e assenza reale di
carte nel mazzo e negli scarti. Ruling del piano: integrare il consumer provato
con questi limiti uniformi; il costo possibile è lasciare indisponibile una
combinazione fisicamente lecita. Non sono divieti attribuiti al regolamento.
Capacità sconosciute e incontri A2 non compilati mantengono i propri gate.

Il replay deriva gli output dalla fonte, artifact e shuffle iniziale salvati:
due cronologie di output coerentemente alterate sono respinte mantenendo tali
input fissi. Il checksum ricalcolabile non autentica la sostituzione integrale
degli input autorevoli; la prova non sostiene questa garanzia.

#57 resta **NULL/UNVERIFIED/BLOCKED**; checkpoint156 **STATIC/GATED**.
Nessuna partita originale, telefono fisico, LAN, Windows, Safari o Unity è
certificata. Il thread della richiesta Asmodee contiene ancora soltanto il
messaggio inviato: nessun conteggio confermato e nessun nuovo invio.

Esito: **Standards 0; Spec 0** nel checkpoint, integrabile con limiti dichiarati.
#135/#65/#89/#33 restano aperte per i rispettivi criteri residui. Il merge non
distribuisce né migra il tavolo protetto in esecuzione.
