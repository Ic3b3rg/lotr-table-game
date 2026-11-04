# Consegna implementazione #81

Base `177e97aff7d5f00481f869deec5a0a07e4c58ffa`, schema15. Solo il checkout
assegnato; nessuna delega, installazione, push, PR o scrittura GitHub.
Review Standards/Spec e integrazione spettano al root.

Lo scope corretto comprende lo spawn obbligatorio della soglia, oltre al
seguito del timer. Sono esclusi gruppi iniziali e spawn da interazione
volontaria con la persona. Combattimento, provocazione e successive
attivazioni restano gated usando i gruppi vivi, prima dei costi.

## Implementazione

- Capacità facoltativa congelata `source-shadow-followup-v1`, con istanze
  statiche, inizializzazione/lifecycle, receiver indirizzato e origini/hash.
  Nessuna migrazione o sostituzione del pack dei run precedenti.
- Continuazioni durevoli per eventi, messaggi, tessere, segnalini esplorazione,
  prova collettiva, piazzamenti e registry delle soglie. Preflight dell'intero
  seguito prima del tick; i controlli su copia non sono prove con carte.
- Obiettivo risolto dai binding all'entry, distinto dall'annuncio letterale.
  Ordine ricalcolato con ConnectedSpaces; pose dalla mappa congelata. Il nuovo
  freeze aggiunge soltanto gli anchor locali necessari ai segnalini.
- Deployment dal pool posseduto completo: budget, disponibilità, filtri,
  modificatori, statistiche, stendardi e posizioni persistiti. Figure condivise
  con77; nessun controller di combattimento, nemico o attaccante artificiale.
- UI con conferme vicine alle istruzioni, attori/attese, obiettivo consultabile,
  gruppi e bonus sulla mappa, guida e lettore. Hash sul server anche via HTTP.

## Verifica

| Prova | Risultato |
| --- | --- |
| Suite finale | 597/597, zero fail/skip/todo |
| Typecheck, formato, diff/privacy | Verificati sul codice consegnato |
| Compatibilità | 111 + 18 backup, campi originali e ricevute invariati |
| Fixture comportamentali | Soglia esatta, più soglie/gate anticipato, dipendenza tardiva, callback duplicato, nessun gruppo con budget assente |
| Recupero | SIGKILL, restore packless, retry/stale/concorrenza e alterazioni risignate |
| Accettazione originale | Tre identità, seconda Ombra completa, due gruppi reali, round3/Azione e primo turno |

L'oracle privato è separato dal prodotto: ricostruisce ordine, binding,
minaccia, selezioni e statistiche dai record nativi e dalla mappa congelata.
Il pool fonte comprende 21 record; quattro modelli e tredici bonus chiudono
la dipendenza raggiunta. Nove SIGKILL, otto restore critici e nove alterazioni risignate sono
verificati; 28 catture native coprono i quattro viewport richiesti. Nessuna
equivalenza della sequenza RNG Unity è certificata. I test pubblici usano dati inventati; non sono gameplay originale.

La suite è stata ripetuta soltanto dopo correzioni emerse dalle verifiche:
validazione dei piazzamenti parziali, testo del gate, interpolazione del popup
ed esplicitazione del binding dell'obiettivo. I tentativi precedenti e i loro
limiti sono conservati e distinti dalla prova finale.

## Evidenze e riproduzione

Scratch privata propria `.scratch/second-shadow/`: `README.private.md`, lock
input/primarie, compilazione, oracle, log dei test, export/DOM/catture nativi,
verifiche di ripristino e chiusura. Il sigillo finale è `evidence-lock.json`;
1.160 file, 718.555.375 byte. Manifest SHA256:
`7aabfeb7af0896c1ef36e328232426eccd32966f2d4d035d2d9a122aadec17fc`
(211.848 byte). Contiene originali e materiale amministrativo: non pubblicarlo.
`verify-seal.py` verifica tutti i byte/hash senza scrivere nel sigillo.

Pack finale: `fc02acdc18ef405f7d7da36ef786bb3aff42ce9aa54ff63d18213af582bf09e3`.
33 definizioni, 110 stati, 87 azioni, 59 rami differiti. La prova finale è
a revisione99: il primo turno è aperto con due azioni disponibili. 51 backup
del freeze finale sono verificati; gli altri tentativi sono separati. Il ledger v2 nasce
dallo startup completo round1/Azione e conserva quell'origine.

Locatori principali: R20635; GO2309/R24473; R27649/stati5→19;
R20900/stato0/azione1 e stato3; R27941/R27777; A06003902/3908,
A060038ac, A06001227/1229–1237/3c41, A06000c46/c47 e A06000b84.
I riferimenti non estendono le capacità dei pack precedenti.

Implementazione locale: `85c2edc`, `684f8f6`, `f3ba757`. Tre contesti e i
processi propri di host, Chrome e observer sono chiusi; porta4381 e CDP
propria liberate.

Riproduzione pubblica: `npm run typecheck`, `npm run format:check`, `npm test`.
I comandi privati e gli input puntuali sono nel README del sigillo.

#33/#65/#57 restano aperte. Il seguito oltre il primo spawn, le attivazioni,
combattimento, campo/A2, perdita finale e partita completa restano fuori da
questa consegna. Nessuna quantità dei benefici è stata assunta.
