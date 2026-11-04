# Soglie successive e perdita per minaccia — #96

Base `9cdba430175808ddeeca75270a6ec2823eab31cc`, schema17, 691 test.
Contratto canonico: [issue96](https://github.com/Ic3b3rg/lotr-table-game/issues/96),
glossario, ADR2–3 e baseline di fedeltà. Implementazione personale nel checkout
assegnato; review Standards/Spec e integrazione spettano al root.

## Obiettivo e confini

Completare le tre continuazioni successive della minaccia e la perdita al
limite attraverso gli stessi controller di Ombra, FSM, deployment, fisica,
conclusione e ledger. Capacità compilata e congelata prima dello startup.
Le prove positive sono interamente inventate e dichiarate.

La quantità57 rimane null/non verificata per decisione del proprietario.
Nessuna nuova partita originale o prosecuzione del checkpoint156. Vittoria,
covo, altri incontri/terreni, campo completo e A2 restano gated. Nessuna
accettazione originale89/33, esecuzione Unity/JIT o parità RNG dichiarata.

## Grounding antecedente al codice

Fonti locali ricevute, lette tramite path/lock espliciti e copiate con verifica
byte/hash nella scratch propria. I tre oggetti R25917/R25174/R27029 sono riletti
integralmente da due reader concordi: 12 stati, 15 azioni, 31.280 byte.
Owner, componenti ThreatEvent e modello del limite portano il controllo a
10 oggetti/32.065 byte; tutti i puntatori e i salti FSM sono validi.

Oracle indipendente: `.scratch/threat96/source/oracle.private.json`.
Raw, binding, operandi, narrativa, IR e IL rimangono privati.
I controller ricatturati verificano lunghezze delle istruzioni e salti.

- `A3902:00f3–015c`: sconfitta eroe prima del limite già raggiunto, entrambi
  prima dell'inizio della fase. Nessun polling durante una conseguenza aperta.
- `A3902:0897–08c3`: aumento dopo la conferma del relativo messaggio.
- `A3902:094b–0ab3`, comparator `A38f9`: ordinamento crescente attestato,
  primo evento raggiunto, callback fino a FSM terminata, rimozione del solo
  evento completato, nuova scansione della lista viva. Una registrazione nel
  callback può essere eseguita nello stesso aumento.
- `A1257/A0ad3`: registrazione unica per identità; non esecuzione immediata.
  `Ae73/A3908` legano owner, FSM e ritorno completo.
- `A3902:0ab8–0aef`: perdita dopo tutti i seguiti raggiunti; nessuno spawn
  saltato perché l'aumento supera il limite. `0af0–0b89`: refresh solo se
  la fase continua.
- La seconda forma imposta l'oscurità globale prima del proprio messaggio
  e deployment, dopo l'oscurità già risolta di questa Ombra. La finestra
  fisica successiva usa il valore condiviso, senza danni retroattivi.

Forme certificate separatamente: spawn/registrazione, oscurità/spawn/
registrazione e spawn terminale. Nessun ampliamento del certificato storico
con intervalli di conteggi. Parametri dai campi e dagli owner, mai dai nomi.

## Contratto tecnico

`source-threat-continuations-v1` nel manifest attesta i tre receiver, default,
owner, definizioni, forma, aritmetica, registrazione successiva e metodi.
Il compiler richiede un certificato completo, valida ogni stato/azione,
i legami rounds/followup/deployment/combat/failure e la popolazione completa.
Il seguito della soglia storica viene abilitato solo dall'attestato esplicito
corrispondente, conservando i rifiuti dei pack senza questa capacità.

Schema18 introduce manifest, confine terminale e causa di minaccia tipizzata,
distinta dalla causa storica di eroe. Migrazione17→18 solo strutturale;
formati precedenti rifiutano nuova capacità e causa. Pack, impronta, origine,
ricevute, stock e gate storici restano identici.

Il controller usa disponibilità viva e budget/residuo del deployment esistente.
I nuovi gruppi attendono la prossima Ombra. Messaggio, collocazioni,
registrazione, rimozione e refresh hanno cursori persistenti. Retry e
concorrenza passano da Store.once e replay v2.

La perdita usa il ramo principale e la conclusione91 esistenti. La causa
conserva prima/dopo/limite, frame e owner; non inventa eroe, run o Ultimo Sforzo.
Il confine iniziale precede ogni effetto; quello dell'aumento segue le soglie
e precede refresh/Riorganizzazione. Premi, destinazione, racconto e campo
una volta sullo stesso ledger. Padri e figli conservano ritorni e pending.

Il preflight percorre l'intera continuazione su copia prima di costi, RNG,
carte, movimento, tick o minaccia. Riconosce sia Riorganizzazione sia vera
conclusione terminale, senza forzare reset o ROUND_START nel secondo caso.
Dipendenze tardive e capacità indipendenti conservano i gate.

UI italiana: minaccia prima/dopo, soglia in corso, collocazione, attore,
oscurità e causa della conclusione/campo. Guida e lettore disponibili;
nessun controllo libero per importi, nemici, benefici o quantità.

## Piano sequenziale e verifiche

1. RED→GREEN compiler: tre forme, binding/owner/registrazioni complete,
   attestazione e rifiuti storici. Collegare nello stesso incremento
   controller e UI, freeze ante-startup e fixture inventata.
2. RED→GREEN confini: soglia esatta, più soglie/registrazione nel callback,
   duplicati, cap/superamento, priorità eroe, oscurità, residui/disponibilità;
   preflight terminale e dipendenze tardive con intero payload invariato.
3. HTTP/Store.once/replay, attori/stale/concorrenza, padre sospeso; SIGKILL
   e restore packless nei nuovi confini, alterazioni risignate respinte.
   UI sintetica nativa con tre identità e quattro viewport.
4. Validator ricostruito dal codice finale: confronto intero di 485 payload
   autorizzati, 17 snapshot ed export94, ogni payload contato una volta.
   Nessun gameplay sui salvataggi ricevuti.
5. Suite canonica separata da browser/validator pesanti; typecheck, formato,
   diff/privacy anche nella storia. Report pubblico, README/sigillo privati,
   tentativi e limiti distinti; commit locali e albero pulito.

Comandi: `npm run build`; `node --test --test-concurrency=4 tests/threat-*.test.mjs`;
`npm test` (concorrenza4 canonica); `npm run typecheck`;
`npm run format:check`; `git diff --check`.
Codice in `src/scenario`, `src/server`, `src/shared`, UI in `src/client`,
test Node in `tests/`, fixture inventate in `tests/fixtures/`.
Tipi strict, funzioni nominate e stile Prettier esistente, ad esempio
`if (sc.conclusion) return false;` al confine del controller.

Sempre verificare prima del commit e confrontare l'intero payload.
Mai indebolire test/deadline, installare, creare agenti/checkout, scrivere
GitHub, eseguire helper/DB ricevuti, consultare superfici protette o chiudere
host altrui. Nessuna domanda aperta indispensabile dopo il grounding locale.
