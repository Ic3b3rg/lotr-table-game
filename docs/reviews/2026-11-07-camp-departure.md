# Partenza dal campo e primo turno A2 — review di #132

Dal primo campo confermato si può partire, comporre i nuovi mazzi, completare le richieste iniziali e compiere un movimento legale sulla mappa battaglia. A1 conserva origine, fonte, cronologia e ricevute; A2 possiede la propria origine nel registro esistente. Le prove positive usano esclusivamente partite e contenuti inventati dichiarati.

Questo incremento non certifica una partita originale completa: #57 conserva le tre quantità `null/unverified`, il checkpoint originale resta statico e bloccato, e i successivi incontri, combattimenti e fasi di Ombra di A2 mantengono i propri gate.

## Review indipendenti

Base `68cf1733d8c190421b8f796fa0d9dd46fd82a15d`; consegna `d2c22b25cdc6bc103aebe272e328df0b497c2bf5`; correzioni verificate `9d282f819a51ed2db51836135aeadaf93f31d552`.

| Asse      | Riscontro iniziale                                                                         | Correzione e nuova verifica                                                                                                                               |
| --------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standards | P2: selezione di un bonus escluso per la lingua attiva.                                    | Predicato originale di eleggibilità, conservando l’intera closure compilata; nuova review verifica corpo primario e hash.                                 |
| Spec      | P2: introduzione autonoma assente e introduzioni aggiunte per ogni punto spawn.            | Sedici istruzioni: messaggio fonte una sola volta prima della generazione, poi collocazione dei gruppi; ripresa verificata anche sul messaggio.           |
| Spec      | P2: racconto e obiettivo persistente usavano un solo testo.                                | Due testi risolti distinti nel freeze, verificati separatamente attraverso ripristino e UI.                                                               |
| Spec      | P2: modello/filtro deployment incoerenti e costi bonus incompleti superavano il preflight. | Binding al modello destinazione, filtro globale fonte e tabelle complete per le dimensioni raggiungibili; rifiuto senza entropia né cambiamenti di stato. |

La review delle correzioni considera tutti e quattro i P2 risolti e non trova nuove criticità importanti nel diff. La possibile duplicazione del transform geometrico resta un suggerimento facoltativo, invariato da queste correzioni.

## Decisione di fedeltà

Il flag `UnsupportedLanguage` descrive un’esclusione prevista dal gioco per la lingua attiva. Il corpo primario `EnemyGroup.GetEligibleBonuses`, metodo `0x06000c41`, salta il candidato a `IL_0035–0044`, prima del controllo del costo. È stato ripristinato quel predicato, già presente nel deployment precedente, conservando tutti i record compilati. Non si riduce il pool per aggirare una capacità mancante e non si estrae nuovamente.

Questa soluzione differisce dal gate generale proposto inizialmente. Se l’interpretazione fosse errata, potrebbe escludere un bonus legalmente disponibile: corpo primario, controllo indipendente e regressione esplicita rendono verificabile la decisione.

I [contratti 120](../research/first-camp-transition-runtime-contract.md) e [124](../research/second-adventure-battle-board-runtime-contract.md) distinguono messaggio dello stato9, generazione dello stato6 e due azioni dello stato8. I valori primari EN e IT di presentazione e obiettivo risultano diversi; nessun testo originale è stato aggiunto al repository pubblico.

## Verifica finale

- Un’unica canonica finale `npm test`, concorrenza4: **1.041/1.041**, uscita npm **0**, nessun fallimento, cancellazione, skip o TODO. Durata del footer: **1.358.849,042625 ms**.
- `typecheck`, `format:check` e `git diff --check`: uscita **0**.
- Tutte le **596** righe sorgente e **26** righe dist coincidono prima, dopo e nell’audit del controller; HEAD, albero Git, lockfile e Node invariati.
- Regressioni mirate: **27/27** per fonte/preflight e **1/1** per ripresa durante cinque confini: trigger ruolo, Scoperta3, introduzione, spawn e obiettivo distinto. Confrontati entrambi gli episodi e tutte le ricevute su host vuoto senza pack.
- Compilatori standalone126/128 e flag di attivazione invariati; nessun timeout, asserzione, soglia o controllo storico indebolito.

Testato il commit `9d282f8`, albero `c3fb3a4d0dd48a1a99f21bcb176fc4e424fce4bd`. Manifest privato finale: **14.575 byte**, SHA256 `55e2f7eb9e4a6087ff81e92894ebb4aa83852486c762b17ce41e1e34e2b0c021`, **86 file / 734.374 byte** di prove. Il controller verifica tutte le righe, footer grezzo, uscita e file attuali senza ripetere la suite verde.

Impronte TSV: sorgenti `f3f80c6d5157015cbcfe4b331f49fa9b68d7356aba4de4536c93113e567f320f`; dist `49891daa375f608c13db931951df23fbd7308893e178c2717c412e1fb3b8082e`.

## UI e limiti

Entrambi gli esiti inventati passano in Chrome con tre identità personali e PC condiviso: conferme del campo, accordo sull’ordine di pesca, trigger e Scoperta3 per ciascuno, messaggio fonte prima dell’entropia spawn, racconto e obiettivo distinti, primo turno e movimento con muro respinto. Esportazione, ripristino su host vuoto senza pack e recupero delle tre identità avvengono dalla UI. Dopo il bootstrap inventato del campo, nessuna API o modifica SQL sostituisce le azioni dei giocatori.

Il driver verifica 320/768/1024/1440, lettore, guida, attesa del proprietario, layout e controlli. Il controller visiona nuove catture parziali di introduzione e obiettivo a320 e del primo movimento dopo sconfitta a320; le altre condizioni sono asserzioni del driver. Nessuna certificazione di ogni viewport, telefoni fisici, LAN, Windows, Safari o parità Unity/JIT. Host e browser propri chiusi; eliminati soltanto i loro profili temporanei, conservando prove e backup.

Le prove fallite restano conservate: nella consegna iniziale una scelta non deterministica della ricevuta da alterare e un singolo `ECONNRESET` non riprodotto; nella correzione del controller un’asserzione nuova trattava `SourceText` come oggetto anziché array. Quest’ultima viene corretta mantenendo il confronto dei contenuti; non è classificata come difetto del prodotto o successo. La causa del vecchio reset non è dichiarata risolta.

Il primo controllo npm mostra un avviso di aggiornamento: non si può certificare l’assenza di traffico implicito verso il registry. Notifier disabilitato prima della canonica; nessuna dipendenza installata né indagine su cache, processi o sessioni esterne. La deviazione non modifica sorgenti o output.

Le modifiche successive alla canonica riguardano esclusivamente questo rapporto e il rinvio dalla verifica iniziale. #33, #89, #65 e #57 restano aperte fino ai rispettivi criteri effettivi.
