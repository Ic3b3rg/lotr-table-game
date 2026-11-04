# Attivazioni e seguito della terza Ombra — #87

Base `031f4ab`, schema15. Autorità: [issue87](https://github.com/Ic3b3rg/lotr-table-game/issues/87),
[contratto83](../research/second-shadow-combat-runtime-contract.md),
[controller85](../development/combat-controller.md),
[review85](../reviews/2026-11-04-combat-controller.md), ADR2–3.
Originali, policy source-linked, input e controlli indipendenti restano privati.

## Contratto

La capacità facoltativa `source-shadow-activations-v1` estende l'artefatto85
con parametri delle istruzioni, owner del controller, difficoltà effettiva,
limiti del terreno e seguito della soglia. È congelata prima dello startup,
legata a compagnia, deployment e projection. Nessun cambiamento ai vecchi pack,
alle origini round1/Azione o ai gate storici.

Prima dell'intera Ombra si controllano tutti i gruppi pronti e tutte le loro
istruzioni raggiungibili, aggiunte e dipendenze, movimenti imposti e relative
provocazioni/esplorazioni, oscurità, ricevitori, soglie, refresh e ROUND_START.
Un guadagno beneficio57 possibile blocca prima di qualsiasi effetto; un beneficio
autenticamente assente usa il ripiego stampato. Nessuna quantità viene inventata,
nessuna popolazione filtrata per evitare dipendenze. Le optional indisponibili
non pagano costi. Il controllo strutturale non sceglie un risultato RNG.

Il proprietario ha deciso esplicitamente: «Mantieni il blocco finché le quantità
sono verificate». I conteggi restano null/non verificati; il gate57 è anche una
preferenza espressa, oltre che la conseguenza del dato mancante. Nessuna
configurazione provvisoria e nessuna nuova domanda sul conteggio o sulla scelta.

A3902:023a–03a8 determina difficoltà, punti iniziali, ordine EnemiesInPlay e
rescan dal primo elemento dopo ogni seguito completo. Saltare gruppi esauriti o
senza figure. Un gruppo collocato durante minaccia non si attiva retroattivamente.
A387c/A3882/A388e e i tre campi chiave dell'istruzione possiedono movimento,
bersaglio, alternativa e ripresa. Il destinatario casuale è conservato prima
del percorso; fallback al più vicino raggiungibile, parità e percorsi minimi
scelti dalla UI. Se nessuno è attaccabile si esegue soltanto l'alternativa.
Le posizioni si aggiornano nello stesso stato85, attraverso il grafo visibile
congelato. Nessun bersaglio, importo o esito libero dal client.

Il packet legge le figure rimaste all'apertura e conserva l'istruzione dopo
i figli, anche sotto il minimo di una nuova selezione. Riduzione progressiva
per ogni attacco primario realmente eseguito, minimo totale1; stream separati
e journaled per istruzione, bersaglio e riduzione. Riutilizzare negate, esiti
diretti, frontiera P2/addizioni e ritorni85; salute e bonus già materializzati
non vengono sommati di nuovo. Il movimento ancora dovuto al gruppo sopravvive
alla rimozione del destinatario. Solo concessioni fonte possedute possono
interrompere; un eventuale attacco interrompente non contrattacca e trattiene
la chiave e l'istruzione precisa. La compagnia83 non ha tale concessione.

Dopo i gruppi: oscurità condivisa fra contesto fisico, aggiunte e fase
(casella/globale/segnalini; override con consumer oppure gate), ROUND_END,
minaccia ricalcolata, soglie in ordine, BEFORE_UNEXHAUST e reset dei gruppi,
Riorganizzazione con Scoperta di ciascun proprietario, Round++ e ROUND_START.
Il timer81 concluso resta fermo. A3902:03b0–0b89/A38df possiedono quest'ordine.

R27777→GO4758/FSM24517 mantiene default25, override false. Compilare i quattro
stati/cinque azioni ricevuti83: moltiplicatore9, spawn completo con disponibilità
viva distinta da EnemyPoints/residuo precedente, piazzamenti reali e successiva
registrazione GO3667/R22474 default40. Un'altra soglia non compilata o cap64
blocca prima dell'intera fase. `21+12=33` rimane una previsione condizionata.

## Verifica e confine

TDD con fixture inventate per compiler, controller, transazioni, scelta,
causalità, restore/replay e alterazioni risignate. UI nativa su host/profilo
propri, tre identità autentiche, freeze ante-startup via filepicker; nessuna
write API/SQL, manipolazione di seed, backup o pool per avanzare l'accettazione.
Viewport320/768/1024/1440, tastiera/focus, guida/lettore e HTTP IPv4 senza
WebCrypto. Recovery packless e compatibilità storica senza indebolire validator.

Se un obbligo57 o perdita impedisce l'Ombra autentica, il report identifica
il gate e distingue le prove con fixture: nessuna fase completa dichiarata.
Nessuna chiusura33/65/57, campo/A2, ulteriori soglie o fine dell'avventura.
Solo checkout assegnato, dipendenze esistenti e commit locali; root possiede
review Standards/Spec e integrazione. Nessun agente, altro checkout o GHwrite.
