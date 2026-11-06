# Ruoli e accessori per la prossima avventura — #122

Dal primo campo, dopo vittoria o sconfitta, ogni proprietario sceglie e
conferma il proprio ruolo e un accessorio comune facoltativo. Gli altri
partecipanti e il PC anonimo vedono progressi, inventari, saldi e carte
previste. Ritorno al campo, rientro, reload, recupero del posto e restore
conservano selezioni e conferme ancora valide.

Se si sceglie un ruolo occupato, il server lo libera dall'altro eroe e ne
invalida la conferma, senza scambio automatico. Una copia comune può essere
scelta da un solo eroe; soltanto il proprietario della selezione può rilasciarla.
L'upgrade comune conserva la selezione sullo stesso eroe usando la nuova
copia. Cambiamenti effettivi a ruolo, accessorio, abilità acquistate o
equipaggiamento invalidano i riepiloghi interessati; le altre conferme
restano valide. Gli XP rimangono nei rispettivi ruoli; la Sapienza non si spende.

## Contratto e persistenza

La ricetta deterministica deriva dalle identità fonte: base1–6, eroe1–5,
nuovo ruolo1–3, tutte le abilità ancora acquistate di ogni ruolo e i titoli
posseduti, anche se rimossi dalle zone attive. Ruolo1 è indicata come futura
preparata. La debolezza è una futura pesca comune non identificata. Le vecchie
zone restano archivio dell'episodio1: non diventano il prossimo mazzo pronto.

La capability opzionale `source-camp-preparation-v1` è certificata dal compiler,
legata a catalogo e capacità del campo precedenti, congelata prima dello startup.
I pack storici privi della capability restano gated, senza retrofit. Le selezioni
risiedono in `campaign.preparation`; i nuovi intenti tipizzati usano gli stessi
`SCENARIO_INPUT`, `Store.once`, registro e replay del ciclo. Nessun nuovo journal.
Il server deriva la ricetta e verifica la conferma personale contro il suo hash;
le ricevute complete del vincitore sono verificate anche nel retry e nel replay.

Schema29 è una migrazione strutturale. Le forme nuove sono rifiutate nei
formati1–28 ai percorsi esatti di stato, origine, intento e ricevuta; i dizionari
ordinari con chiavi omonime restano validi. Il restore cambia soltanto
generation, revision e updatedAt. Nessuna normalizzazione del gameplay.

## Fonti

Autorità: [baseline di fedeltà](../planning/fidelity-baseline.md),
[contratto120](../research/first-camp-transition-runtime-contract.md) e
[review120](../reviews/2026-11-06-first-camp-transition.md).
La [Rules Reference ufficiale, p3/p5 e §§105/109/112](https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf)
stabilisce composizione e proprietà; le callback fonte `OnRoleSelected`
e `OnBackClicked` stabiliscono assegnazione e ritorno.

Verifica statica sulla build fissata: sei modelli ruolo,54 identità iniziali,
tre corpi IL confrontati con i byte del PE originale. Catalogo74, testi,
provenienze e certificati precedenti restano invariati; Guardian1 conserva
il gate della propria identità. Nessun effetto futuro è certificato o eseguito.
114 e116 sono stati ricompilati byte-identici prima dell'estensione; il nuovo
pack è stato compilato tre volte con output identico dal commit prodotto.
Primarie, associazioni, raw/IL e pack restano nella scratch privata ignorata.

## Verifiche

Base `c4220e203fc3b70c8b365f6b77c19d65a86f4962`, baseline907.
Specifica e piano precedono il codice. Commit prodotto verificato
`116852d094babde8f57a20f479e7db270c4d4c61`.
Tutti i nuovi test e le partite QA usano fixture dichiarate inventate.

| Controllo                                         | Risultato                                                                                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| TDD HTTP/SQLite                                   | Nuove scelte, proprietà, contese200/409, retry e ricevute intere; gate di fase/fonte/cursore/revisione/generazione e ricette estranee |
| Invalidazioni reali                               | Acquisti, rimborsi e upgrade personali/comuni; conservazione delle altre conferme e della scelta comune durante upgrade               |
| Recovery122                                       | 5 tagli postcommit,4 precommit con vere righe SQLite,26 negativi risignati422; host nuovi vuoti packless e confronti integrali        |
| Corpus corrente e serie96–108                     | 503file/398payload distinti/17viste94;18/14/17/19/13/20/22 snapshot più export/finali                                                 |
| Serie110–116, canonica906 storica e prove proprie | 998 artefatti:810 backup completi/359 payload distinti/726 viste,40 candidati,123 file SQLite;227 validazioni negative                |
| Canonica finale isolata                           | 923/923,exit npm0,ALONE4;1207,630s;footer reale,HEAD pulito invariato; nessun fail/skip/cancelled/todo                                |
| Tipi, formato, diff e privacy                     | exit0; file nuovi/diff/storia contro859 testi lunghi privati;31 test storici cambiano solo versione corrente28→29                     |

I confronti storici ammettono soltanto schema29, il precedente physical:null
nei formati fino a10 e i tre campi amministrativi del restore. Validator e
compiler provengono dal commit esatto mediante git-show/onLoad; nessun binario
storico è usato per validare il codice nuovo. Nessun test saltato, assertion,
deadline o soglia ridotta; nessuna nuova dipendenza o installazione.

QA nativa finale Chrome su Mac: tre contesti personali e PC anonimo, HTTP IPv4
senza WebCrypto,320/768/1024/1440.40 casi e112 PNG con paint/focus/deadline
verificati e sette campioni visivi ispezionati. Veri consumer di vittoria e
sconfitta portano al campo; dopo bootstrap avanzano soltanto DOM/Input/filepicker.
Coperti ruolo occupato/liberato, accessorio conteso/nessuno, tre conferme,
ritorno e transazioni reali, reload, recupero in nuovo profilo, export e restore
corrente e in host nuovo vuoto packless, guida/lettori e partenza gated. I processi e contesti propri sono
chiusi con exit/rebind provati sulle sole porte proprie.

Non è una prova su telefoni fisici, Windows o Safari. Tentativi precedenti e
fallimenti degli helper sono conservati separatamente, senza contarli come QA
finale. I log conservati non mostrano eccezioni JavaScript; tre404 favicon e
un409 stale di un tentativo sono documentati. Nessun test sul tavolo del proprietario.

## Limiti e riproduzione

Le tre conferme sono consentite anche se A2 non è disponibile. La partenza
rimane `requires-content`: nessuna pesca, mescolata, nuova preparazione fisica,
trigger, XP0 futuro o avvio dell'episodio2. Quantità57 tutte null/unverified,
blocco mantenuto;156 solo statico/gated, nessuna partita originale nuova,
ripresa o retrofit. #57/#89/#33/#65 restano fuori dal mandato e aperte.
Nessuna attestazione di gioco completo, A2 giocabile o esecuzione Unity/JIT.

Comandi pubblici: `npm run typecheck`, `npm run format:check`, `npm test`
(build e test con concurrency4). Le prove private sono in
`.scratch/camp122/`, con README, lock riferimenti/copie/adapter/output/tentativi
e manifest byte/SHA senza autoriferimento.25337 file/11013837850 byte dei
riferimenti ricevuti sono stati verificati in streaming e usati read-only,
senza copiare11GB o seguire identità storiche. Root esegue review fresche,
verifica indipendente e integrazione; nessun push, PR o GH write da questo checkout.

## Integrazione del root

[Review e verifiche indipendenti](../reviews/2026-11-06-camp-preparation.md):
Standards zero violazioni e due suggerimenti facoltativi P3; Spec senza finding.
Il root mostra per primi gli eroi del proprietario sul telefono, conservando
l'ordine del gruppo sul PC anonimo. Il test UI esistente ha RED/GREEN e nuove
asserzioni su proprietà, ordine e immutabilità; nessun caso Node aggiunto.

Canonica root **923/923**, npm exit0, ALONE4, HEAD pulito e invariato;
corpus503, serie complete e nuovi208JSON/51SQLite verificati con validator
del commit finale. Il backend è byte-identico alla consegna. Un controllo
nativo distinto sul vero applicativo ripristinato inventato verifica tre
identità, PC anonimo, ruolo occupato, conferme e reload, quattro larghezze e
sei PNG. I112PNG della QA consegnata precedono la correzione dell'ordine
personale e rimangono distinti. Sorgenti e asset nativi testati coincidono
con quelli ricostruiti dalla canonica; soli processi propri chiusi.

Pack e quantità non cambiano; #57 rimane bloccata,156 statico/gated e A2
indisponibile. Nessuna nuova accettazione originale #33 o aggiornamento della
sessione del proprietario.
