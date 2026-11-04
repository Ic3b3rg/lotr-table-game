# Benefici: copie e consumer

Implementazione di [#94](https://github.com/Ic3b3rg/lotr-table-game/issues/94),
secondo [spec](../planning/boons-spec.md) e [piano](../planning/boons-plan.md).
I programmi beneficio usano il controller fisico e il ledger esistenti.
L'acquisizione non attribuisce proprietà di campagna e non occupa gli slot
preparati: ogni copia è nella riserva oppure scoperta presso un solo eroe.

## Compilazione e avvio

L'API pubblica `compileBoons(raw, input)` di `physical-resolution` produce
`source-boons-v1`. `validateBoonArtifact(raw, artifact)` lo ricompila e confronta
prima di accettarlo. L'input lega tre definizioni univoche ai campi originali,
meccaniche, uso e riferimenti; gli operandi numerici vengono dai campi attestati.
Il compiler controlla struttura e provenienza; l'autenticità e la corrispondenza
dei programmi alle fonti richiedono l'oracle privato indipendente.

L'artefatto distingue definizioni verificate e stock. Quantità non attestate
producono `unverified`, nessuna copia e `runtimeReady: false`. Solo quantità,
copie e provenienze complete possono superare anche il validator della famiglia
fisica. Il supporto runtime non verifica il dato mancante di #57.

Il manifest dichiara `boons: { version, fingerprint }`; `physical-boons.json`
deve corrispondere prima dello startup. `freezePhysical` congela l'artefatto e
ogni run ne conserva il fingerprint. Un manifest che lo richiede senza file
disponibile viene rifiutato prima dello startup. Il backup contiene tutto ciò
che serve per replay e restore senza pack.

## Consumer collegati

- Le concessioni condizionali nemiche usano il subito diretto sigillato della
  richiesta, preservando figli P1/P2, movimento dovuto, attore e ritorno al padre.
  Tipi fissi e scelta tra tipi usano la stessa riserva dei fronti fisici.
- Acquisizione, duplicato dello stesso tipo, perdita e scarto conservano la copia
  e la fonte. `unknown`, `verified-empty` e `available` restano distinti.
  L'esaurimento senza norma attestata conserva una diagnosi prima del costo.
- Le prove possono sostituire carte mantenendo numero e identità, inclusi
  simboli convertiti, risorse già pagate, riciclo e carte trattenute dai padri.
  I bonus di successi e colpi derivano dal programma e si applicano una volta.
- La difesa obbligatoria precede la prova dell'attacco subito; il divieto di
  prevenire non elimina lo scarto obbligatorio. Gli altri scarti osservano il
  subito effettivo oppure la prossimità reale a fine turno, compresi i nemici
  esausti ancora presenti.
- Il titolo già compilato che conclude Riposo usa il consumer soltanto dopo
  il preflight dell'intero seguito, prima di scarto della preparata o rimozione
  del titolo. Le altre capacità non compilate conservano i loro gate.

Il preflight include receiver, stock condiviso, spostamenti e figli obbligatori;
non sceglie istruzioni, non filtra popolazioni e non consuma RNG o risorse per
scoprire una dipendenza mancante. I programmi letterali P1 marcati hanno un
confine esplicito nello startup/setup; usarli dopo il setup resta gated prima
della richiesta. I cicli fisici nativi ordinari e di combattimento mantengono
il proprio contesto congelato.

## Persistenza e interfaccia

Lo schema17 aggiunge la capacità in modo esplicito. La migrazione dai salvataggi
precedenti è strutturale: nessuna ricostruzione di copie e nessuna abilitazione
retroattiva. I pack storici conservano semantica e gate precedenti. Il replay
ricostruisce custodia, eventi, bonus e risultati; `Store.once` conserva le
ricevute nei retry, inclusi i comandi dei figli.

La UI mostra carta, fonte della concessione, custode e disponibilità. Lettore
e guida restano consultabili durante le attese. Il blocco noto della prossima
Ombra viene mostrato prima della conferma, senza rivelare l'istruzione futura.
Non esistono controlli liberi per assegnare benefici o quantità.

Le quantità originali rimangono null/non verificate. Il checkpoint originale156
conserva il rifiuto prima dei costi e tutto il payload; questa implementazione
non costituisce accettazione della partita #89 o del percorso #33.
