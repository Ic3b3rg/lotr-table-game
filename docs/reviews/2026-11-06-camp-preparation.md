# Review e integrazione delle scelte al campo — #122

Confronto fissato: main `c4220e203fc3b70c8b365f6b77c19d65a86f4962` e consegna
`9c3c5a43cf3b99cf0bc4a2c938ef92f5a0e17202`. Sei commit, con specifica e piano
prima del codice; due review indipendenti con contesti separati.
[Ticket](https://github.com/Ic3b3rg/lotr-table-game/issues/122),
[specifica](../planning/camp-preparation-spec.md),
[rapporto](../development/camp-preparation.md).

## Standards

Zero violazioni documentate rispetto ad AGENTS, glossario, baseline e ADR1–3.
I moduli seguono lo stile dei consumer del campo esistenti. I 31 test storici
modificati cambiano soltanto l'attesa dello schema corrente 28→29.

Due osservazioni facoltative P3, non bloccanti:

- Possibile Duplicated Code nell'elenco dei cinque intenti, ripetuto in
  `server/state.ts`, `server/backup-format.ts`, `scenario/validate.ts` e
  `shared/camp-preparation.ts`. Una futura estrazione può mantenere unica la
  classificazione, conservando le guardie specifiche dei singoli confini.
- Possibile Duplicated Code nella whitelist amministrativa dei due test di
  recovery/transazione: clone e riallineamento di generation/revision/updatedAt.
  Un helper puro comune è facoltativo; nessuna normalizzazione va ampliata.

Totali Standards: zero violazioni, due suggerimenti P3; nessun refactoring
aggiunto a questa consegna. La review è statica e non si attribuisce i test
del child o le successive verifiche del root.

## Spec

Missing 0, partial 0, wrong 0, scope 0; nessun finding riprodotto.
Verificati proprietà personale, liberazione del ruolo senza scambio o XP0,
ricetta fonte, esclusività degli accessori e ritenzione durante upgrade,
invalidazioni pertinenti, ritorno/rientro, binding delle ricevute, replay
e difese dei formati storici. Guardian1 conserva il gate della propria
identità. La slice non materializza mazzi o altri effetti futuri.

Issue, manifest e prove selezionate sono letti dopo verifica byte/SHA.
Confermati separatamente i 31 cambi di sola versione nei test storici e
l'identità degli alberi prodotto/test/script/package fra commit prodotto
del child e suo commit finale documentale. Nessuna attestazione runtime
deriva dalla sola review Spec. Gravità massima nell'asse: assente.

## Correzione UX del root

La vista personale seguiva l'ordine della compagnia: secondo e terzo
proprietario trovavano i propri controlli dopo quelli degli altri eroi.
Il root rende prioritari gli eroi controllati dalla persona autenticata;
il PC anonimo mantiene l'ordine condiviso. L'array della compagnia e tutti
i dati del gioco restano immutati.

Il test UI esistente è esteso con ordine personale, ordine comune,
conferma del solo proprietario e immutabilità dell'input. Il vecchio codice
fallisce l'asserzione sul primo eroe della seconda persona; la correzione
passa. Nessun nuovo caso Node aggiunto: la canonica resta di 923 test.
Modificati soltanto client e test UI; backend e validator rimangono identici.

## Fonti, compatibilità e prove del root

Manifest ricevuto: 9.757.456 byte, SHA256
`3859b0b92d51d582e415ffb069aa91de59cc7db600160b40d0ff3cf6f54ed7e3`.
Verificati prima della lettura e copiati in due directory proprie tutti i
1.247 file, 913.341.417 byte. Verificati anche i 25.337 riferimenti immutabili,
11.013.837.850 byte, senza ricopiare quell'archivio. Percorsi unici, senza
traversal o componenti symlink; ricevuto e adapter operativi restano separati.
Gli handle storici non vengono seguiti sul filesystem o riscritti.

Riletti sei modelli ruolo, 54 identità iniziali e tre corpi IL contro i byte
del PE primario. Catalogo74 e status/provenienze invariati. Il compiler dal
commit corrente produce tre volte gli stessi byte, conservando integralmente
campi e certificati precedenti. Pack122: 847.820 byte, SHA256
`c289036b1221a7f783d4440c29dcd79732684b750d506c034bad2d0c391df5bc`,
fingerprint `e82a6af60c2ef1a7bd920bd01cfcf691f7e1f1073b85a1b35724def5b7c6d818`.

Passano 16 test mirati al primo albero integrato; dopo la correzione solo UI
passa anche il test esteso. Tipi, formato e diff passano. Backup/publicSession
e State/parseState sono costruiti con git-show/onLoad dal commit verificato:
1.690.524 e 1.659.117 byte, identici al backend del child. Nessun binario
storico viene usato come validator del codice nuovo.

Passano il corpus503, 398 payload distinti e 17 viste94, più tutte le serie
96–108 con 18/14/17/19/13/20/22 snapshot ed export/finali. La matrice aggiuntiva
110–116, canonica906 storica, prove122 e nuovi recovery root comprende
1.042 artefatti: 901 backup, 383 payload distinti, 809 viste, 48 candidati
completi, 40 con vere righe SQL, 30 candidati storici di solo stato,
150 file SQLite e 253 validazioni negative. Non sono 1.042 nuove partite.

La canonica root termina **923/923**, vero npm exit0/signalnull, ALONE4,
1.200,235 secondi; zero fail/cancel/skip/todo, HEAD pulito e invariato
`61fb0f9682e691aaa5c519828fb8898b30f0d891`. La correzione UI è inclusa.
I nuovi output sono distinti dalla canonica923 del child e dalla906 storica.

Verificati dopo il run tutti i nuovi 208 JSON e 51 file SQLite: insieme dei
nomi attesi identico, byte/SHA prima del parse, 304 backup completi anche
quando il payload si ripete, 129 payload distinti, 256 viste, 18 candidati,
14 con righe SQL, 30 candidati di solo stato e 105 negativi. Interi payload,
origini, comandi e ricevute confrontati; soltanto migrazione strutturale e
tre campi amministrativi del restore, nessuna normalizzazione gameplay.

## UI nativa e limiti

La QA inventata del child comprende 40 casi e 112 PNG, tre contesti
personali e PC anonimo, quattro larghezze e restore packless. Precede la
priorità personale del root: rimane distinta dalla verifica finale di quella
correzione. Tutti i 112 PNG sono ricontrollati per hash, decodifica e metriche;
campioni sono visti direttamente.

Il root ripristina l'export inventato sigillato su un host nuovo vuoto senza
pack, tramite filepicker nativo, e recupera le tre identità. Quattro comandi
UI liberano un ruolo occupato, assegnano quello libero e riconfermano due
eroi; la conferma del terzo rimane valida. Snapshot fisico, preparazione
archiviata, mappa, contenuti, sorgente, RNG e prefisso del registro restano
identici. Backup e vista completi passano i validator correnti; reload non
modifica il payload. Il seguito rimane requires-content.

Tre telefoni simulati a320, PC anonimo a1440, ulteriori controlli a768/1024:
sei PNG con paint/focus effettivi e deadline che rifiuta frame mancanti.
Ordine personale/comune, assenza di overflow e WebCrypto assente verificati.
Tutti i 2.610 eventi raccolti hanno zero eccezioni JS e zero risposte HTTP
di errore. I soli processi e contesti propri sono chiusi, con rebind della
porta propria. Sorgenti e asset testati risultano identici dopo la canonica.

Non è una nuova partita originale o una prova su telefoni fisici, Windows,
Safari o Unity/JIT. I tentativi precedenti rimangono conservati, compreso il
primo tentativo di sconfitta sintetica che invece riusciva nella prova;
non vengono contati come accettazione finale o reroll dell'originale.

#57 mantiene le tre quantità `null/unverified` e il blocco richiesto.
Nessuna pesca, mescolata, preparazione fisica, trigger, XP0 futuro o partenza
A2; nessun originale nuovo, ripresa156 o retrofit. #57/#89/#33/#65 restano
aperte. Corpus, raw/IR/IL, immagini e prove rimangono nella scratch ignorata.
