# Verifica della conclusione fallita e del primo campo — #91

Base `738bc8a1835e8a59b119296a48367b9259e5e0c9`, schema15,647 test.
[Spec e piano](../planning/adventure-failure-spec.md) precedono il codice;
[comportamento e migrazione](../development/adventure-failure.md).
Il root possiede review Standards/Spec e integrazione. Consegna di soli
commit locali, senza altri agenti, checkout, installazioni o scritture GitHub.

## Grounding bounded

Le primarie sono state rilette staticamente, senza esecuzione Unity/JIT:
principale completo35 stati/50 azioni, ramo34→31→32→33 con8 azioni;
due AdventureModel consumati integralmente,740 byte;35 corpi IL,
9.644 byte di codice e3.249 istruzioni, con target di salto controllati.
Due decoder concordano e i puntatori necessari sono risolti. Nove chiavi
italiane provengono dai due TextAsset puntuali. Il controllo delle abilità
equipaggiate copre il catalogo fisico completo, senza interpretare un titolo
posseduto come equipaggiato.

| Confine                                                | Owner riletto                                                                      |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Eroe sconfitto prima dell’Ombra e prima del cap        | `06003902`, IL00f3–0116                                                            |
| Ultimo Sforzo terminale e assenza di superstiti        | `06003bf4`, `06000c93`                                                             |
| Segnale al principale, bonus, elaborazione dell’evento | `06000c96`, `06000cd8`, `060038a6`, `0600152d`                                     |
| XP al ruolo selezionato e Sapienza all’ingresso        | `0600125f`, `06001251`                                                             |
| Destinazione, completamento e reset della scena        | `060012be`, `060012a4`, `06000c97`, `06000ca5`, `06000ce1`, `06000d1e`, `06000cba` |
| Loader, mappa, racconto e campo                        | `06003920/3938`, `06001050/1051/1054/1055`, `06000dec`                             |
| Cambio ruolo e proprietà titolo separata               | `06000e08`, `06000cc3`                                                             |

L’oracle privato è indipendente dal compiler/runtime di prodotto. Verifica
parametri, ordine, riferimento modello, aritmetica e owner IL. Originali,
narrativa, mapping, normalizzazioni, immagini, backup e identità restano
solo nella scratch ignorata, anche nella storia Git.

## Prove automatiche

Le nuove fixture pubbliche sono inventate, con nomi, valori e destinazioni
distinti dagli originali. I test esercitano i consumer e le transazioni
esistenti, senza un executor parallelo della conclusione.

| Prova                           | Copertura                                                                                                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `adventure-failure-compiler`    | Attestazione, closure, destinazione, operazioni fuori ramo e permesso Sapienza limitato                                                                                           |
| `adventure-failure-runtime`     | Messaggi e azioni concorrenti, stato di elaborazione, premi al ruolo una volta, titolo/equipaggiamento, bonus compagnia                                                           |
| `adventure-failure-http`        | Uno/tutti sconfitti, figli e padre interrotto, perdita differita durante Ombra, cap e soglie distinti, retry/concorrenza/stale/attore, richieste dopo il termine, ruoli nel campo |
| `adventure-failure-recovery`    | SIGKILL e packless a sette confini, intero payload/ricevute, dieci alterazioni risignate e capacità illecita in vecchio schema                                                    |
| `adventure-failure-transaction` | SIGKILL prima del commit SQLite di trigger, premi e passaggio; rollback integrale e retry singolo                                                                                 |

Il RED→GREEN ha incluso la conservazione dell’elaborazione del principale
e il rifiuto di premi non appartenenti al ramo certificato. Le regressioni
esistenti di movimento, ritorni fisici e riserva fisica prima dei costi
restano invariate. Nessun test rimosso o saltato, limite abbassato,
suppression o esenzione di replay aggiunti.

Suite completa finale: **662/662 test**, zero fallimenti o skip;
`npm test`, `npm run typecheck`, `npm run format:check` e `git diff --check`
verdi. Privacy verificata con248 needle sulle aggiunte pubbliche e
sull’intera nuova storia Git: zero corrispondenze originali.
I351 backup pertinenti (299 storici e52 nativi di89,607.434.918 byte)
sono accettati dal validatore finale: ogni campo di gameplay e tutte le
ricevute coincidono, salvo la migrazione esplicita a schema16.

## Percorso originale nativo

Un solo nuovo avvio, necessario per congelare la nuova capacità prima dello
startup. Import tramite filepicker del freeze autentico ante-startup,
tre identità originali recuperate, host/profilo/contesti propri e HTTP IPv4
senza `crypto.subtle`. Nessuna modifica a seed, mazzi, pool o esiti;
nessuna API/SQL write ausiliaria. Il run storico89 e il tavolo protetto
non sono stati modificati né eseguiti.

Il pack congelato ha34 definizioni,196 stati,192 azioni e42 confini
differiti. Il file scenario è436.061 byte, SHA256
`9a15ef82634468155c2f073176661b1e675032c40bc1120d12c5f106b7360b65`.
Fingerprint `0047087307ef2cdf1cd0c51aed5a3a62d116e94584bc729b9983e897455ce3b2`.
La ricompilazione separata è identica byte per byte. I quattro file eseguibili
configurati sono assenti dopo lo startup; le riprese usano il materiale
già congelato nel backup.

La partita raggiunge round3/Azione. Un eroe fallisce realmente l’Ultimo
Sforzo, con carte e conseguenze effettive; i movimenti nemici ancora dovuti
si completano. Il gruppo termina i turni dei superstiti. La prossima Ombra,
con minaccia21 sotto il limite64, esegue la conclusione originale prima
degli effetti della fase. I tre partecipanti confermano i messaggi, la mappa
della campagna e il racconto, fino al primo campo persistente. Tutti
scelgono poi un nuovo ruolo; i premi rimangono nei ruoli precedenti.
La destinazione fonte successiva è salvata e attende contenuto, senza avvio.

SIGKILL packless a sconfitta, primo messaggio, premi, mappa, racconto e campo
conservano integralmente gameplay e ricevute. Dieci backup alterati e
coerentemente risignati, sottoposti mediante filepicker e conferma reale,
sono respinti senza modifiche. Un export nativo corrente del campo viene
ripristinato e confrontato integralmente, salvo i campi amministrativi.

Un helper di ripristino ha inizialmente letto il puntatore a un export
precedente al campo. Non sono stati eseguiti comandi di gioco da quel
checkpoint. Il download corrente è stato subito ripristinato dal percorso
esatto della ricevuta; confronto integrale positivo. Il tentativo errato
è conservato e distinto dall’accettazione, senza cancellare evidenze o
rigiocare la partita. Altri errori preparatori dei decoder/driver sono
classificati nel report privato e non contati come successi del prodotto.

Le dodici combinazioni di tre identità e320/768/1024/1440 px verificano
assenza di overflow, controlli di almeno44px, guida, lettore e Tab/Escape
con ritorno del focus. La prova nativa ha riprodotto un ritorno tardivo del
focus dalla guida al suo pulsante; la correzione è verificata dalla stessa
prova RED→GREEN. Nessun pulsante di turno, mappa o combattimento rimane
apparentemente giocabile. Le verifiche UI non mutano il payload del campo.
Il validatore finale accetta59 payload nativi distinti da88 catture/download,
con un’unica origine round1/Azione e un solo fingerprint; include come
prova dell’errore il restore amministrativo escluso dall’accettazione.

Il ramo senza superstiti, la perdita durante Ombra e i bonus non posseduti
nel run nativo sono provati con fixture distinte. Nessun indizio autentico
è stato completato:89 rimane aperta. Vittoria, soglie40/48/55, benefici57,
campo completo e A2 giocabile restano incompleti. Nessuna chiusura33/65/57,
parità Unity/JIT/RNG o avventura completa in entrambi gli esiti è dichiarata.

Comandi, byte/hash, input copiati e verificati, sequenza nativa, tentativi,
backup storici, arresto dei soli processi propri e sigillo sono nel
`README.private.md` della consegna privata. Le prove ricevute sono rimaste
in sola lettura; nessun helper è stato eseguito al loro interno.
