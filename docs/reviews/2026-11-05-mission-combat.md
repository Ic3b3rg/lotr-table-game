# Review e integrazione del primo scontro — #108

Confronto fissato: main `767b8d71b8849cfd8e03d2344cc6dc04232d7c8c` e
consegna `57e6889fffcb7ae9d4c0d468f89b7c6625299748`. Due review indipendenti,
con contesti separati. [Ticket](https://github.com/Ic3b3rg/lotr-table-game/issues/108),
[specifica](../planning/mission-combat-spec.md) e
[rapporto](../development/mission-combat.md).

## Standards

Nessuna violazione documentata. Un suggerimento facoltativo P3, possibile
Duplicated Code: rimozione timer e assegnazione dei banner ripetevano il
predicato dei gruppi vivi già posseduto da `livingEnemyGroups(state)`.
Il root riusa quel helper nei due punti; include anche le figure in attesa
e conserva lo stesso criterio di ammissibilità. Correzione `cbc85f9`.

La review ha letto diff, chiamanti, prove, glossario, ADR2–3, baseline,
spec e piano; nessun test, build, host o browser eseguito dal reviewer.
I dodici smell di riferimento sono euristiche, distinti dalle regole del repo.
Totale: zero violazioni, un suggerimento facoltativo risolto.

## Spec

Nessun requisito mancante, comportamento errato o ampliamento sostanziato.
Verificati tre opzioni/sei esiti, challenge con zero letterale e limiti
superiori inclusivi, preflight dell’intera persona, quantità/budget/disponibilità
separati, posa realizzata, ordine della sezione, attacco della sola variante,
sconfitta distinta dalla fuga, eventi del timer, registro e migrazione.

Il reviewer ha confrontato staticamente copie locali con hash verificati:
78 stati e 98 identità/transizioni, due spawn e 200 conteggi. Non ha eseguito
helper/DB ricevuti, host, browser o gameplay originale. Le dichiarazioni runtime
sono state verificate separatamente dal root. Totale: zero rilievi.

## Verifica del root

La consegna e le due copie proprie sono verificate integralmente: 4.728 file,
2.791.095.473 byte; nessun link simbolico, profili operativi esclusi. Helper e
metadati operativi sono adattati solo nella copia di lavoro; fonti, identità
e ricevute rimangono immutate.

Le primarie puntuali riproducono i 41 oggetti e tutti i parametri, 104 corpi IL,
78 stati/98 azioni e 200 casi. L’oracle resta separato dal prodotto. Le tre
compilazioni e il controllo dopo la correzione del root producono gli stessi
byte; le 71 azioni precedenti e l’intera EnemyLogic sono preservate. La posa
riusa il certificato ricevuto: nessuna nuova esecuzione Unity o prova di
parità numerica/JIT.

Il validator ricostruito dai sorgenti committati dopo la correzione del root confronta integralmente 503 file, 398 payload distinti e 17 viste94. Le serie96/98/100/102/104/106 conservano 18/14/17/19/13/20 snapshot con viste, export e finali; la serie108 ne conserva22, con19payload distinti. Solo versione dello schema e physical:null storico≤10 sono migrati.156rimane statico, gated e immutato; nessun gameplay sugli input ricevuti.

Le prove native inventate comprendono 132 combinazioni, tre identità e quattro
larghezze: 108 casi completi e 24 di ispezione/annullamento. Verificati i
20.845 eventi, le ricevute di pittura e dimensioni di 484 PNG; cinque schermate
ispezionate direttamente, comprese guida e lettore mobile. Nessuna eccezione
Runtime o errore di caricamento; tre favicon404 e due restore422 intenzionali
sono conservati. Esportazione, immutabilità dei negativi, recupero e chiusura
delle sole superfici del task sono attestati; il root non ha aperto un nuovo
browser né controllato processi altrui. Il primo episodio che aveva esposto
una regressione rimane archiviato e non vale come prova positiva finale.

Canonica eseguita da sola, concorrenza4, Node24.11.1: **816/816**, zero fallimenti, skip, cancellazioni e todo;847455,436417ms. Tipi, formato e diff passano. L’estrattore del root attendeva un footer TAP anziché il formato spec emesso da Node: corretto sul log completo immutato, senza ripetere test conclusi o attribuire un exit status non registrato al processo npm. Il fallimento riguarda soltanto l’estrazione del riepilogo.

I 26 file di test precedenti cambiano soltanto le aspettative della versione
corrente. Nessun caso, asserzione o termine ridotto; dipendenze e concorrenza
canoniche restano identiche. La prima canonica del child aveva trovato tre
regressioni nel preflight senza pack: corrette, con validator e suite interi
ripetuti. I tentativi sono conservati.

Quantità57 ancora null/unverified per decisione del proprietario. Nessuna
partita originale avviata o ripresa156; accettazioni89/33 e macro65 restano
aperte. La UI inventata non certifica una partita originale completa, campo
completo o avventura2. Le fonti e tutti i dati reali restano privati.
