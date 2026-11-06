# Review del contratto primo campo → avventura 2 — #120

Confronto fisso: main `2106fd06b1e66030bffa384bd725dc896f900ca3` e consegna
`2d170a8cd2b725c6d92d42470571097a4ac8e1a9`. Un solo rapporto di ricerca,
due review indipendenti con contesti separati.
[Mandato](https://github.com/Ic3b3rg/lotr-table-game/issues/120),
[contratto sorgente](../research/first-camp-transition-runtime-contract.md).

## Standards

P0 0, P1 0, P2 0, P3 0; nessuna osservazione facoltativa Fowler pertinente.
Verificati AGENTS, istruzioni dominio/tracker, glossario, baseline e ADR1–3.
Il rapporto distingue autorità dell'app, norma fisica e requisiti del
digitale, conservando registro e origine immutabile. Provenienza, quantità
non verificate, partenza gated e assenza di retrofit restano esplicite.

Tutti i 23 rimandi locali distinti risolvono nel commit. Il testo contiene
locatori e sintesi tecniche; nessun corpo di carta o narrativa estesa,
immagine, raw JSON, IR o IL pubblico. La review Standards è statica e
non attribuisce a sé la riesecuzione dei checker o la certificazione delle
primarie. Totale: zero finding, severità massima assente.

## Spec

Missing 0, partial 0, wrong 0, scope 0; nessun difetto riprodotto.
Le norme RR p3/p5 e §§105/109/112 sostengono pulizia, restituzione di
debolezze/accessori, ricomposizione e carta ruolo iniziale preparata.
I callee verificati distinguono saldi XP per ruolo, abilità comprate,
titoli e bonus condizionale della conclusione.

FSM e IL confermano entrambi gli esiti, destinazione S806, Scoperta 3,
ramo post-sconfitta, budget nell'ordine fonte e Sapienza all'ingresso dello
stato previsto. Attivazione concorrente, template, inizializzazioni e
callback ereditate sono distinti. S806 è verificato anche direttamente nei
raw: 396 byte, mappa battaglia, due impostazioni; il loader salta generatore
viaggio e relativa assegnazione del seed.

Scene/topologia, ResourceManager, istruzione B1_WEAKNESS e realizzazione
RNG restano dipendenze dichiarate. Il mandato permette di fermarsi a un
prerequisito mancante identificato; non sono trasformati in primo turno
legale o in effetti inventati. L'handoff proposto mantiene la partenza A2
gated e rispetta ADR2/3. Verifica statica, senza attestazione runtime.

## Riproduzione indipendente del root

Manifest ricevuto: 228.674 byte, SHA256
`14945ec5e80b6426454f52226bedae12bac46a4dfb55979893d18296d0e9fd27`.
Verificate tutte le 1.405 righe, 237.452.416 byte, prima della lettura/copia;
percorsi unici senza traversal o componenti symlink. Ricevuto e copie
operative proprie restano separati. L'unico adapter cambia il riferimento
al repository del helper di audit; identità e provenienze non sono riscritte.

Sette passaggi terminano con exit 0: ingressi pinned, oggetti, IL,
contratto, checker indipendente, PDF e audit pubblico. Risultati:

- 165 oggetti, 1.949.301 byte, due reader e consumo esatto; 1.649 puntatori
  non nulli risolti e 1.569 nulli.
- 178 corpi A, 28.003 code byte e 10.074 istruzioni; 22 corpi P,
  5.364 code byte e 1.931 istruzioni.
- 16 combinazioni finite, 8 fallback, 11 alterazioni respinte e 7.292
  locatori di campo/parametro; primo turno A2 non certificato.
- Oggetti selezionati, FSM derivate, contratto, checker, selezioni IL e
  quattro estrazioni PDF risultano byte-identici alla consegna.

Il checker indipendente rilegge byte e header PE senza i decoder del
produttore. Il lettore binario degli oggetti condivide lo schema: non è una
prova indipendente del layout stesso. Le combinazioni sono verifiche del
contratto statico, senza esecuzione Unity/JIT o gameplay.

L'audit del rapporto confronta 3.505 testi lunghi del corpus privato senza
corrispondenze, controlla link, diff e storia Git. Il rapporto di 40.995 byte
ha SHA256 `68e3fe302a34125e84c06611408c254e9bfc596af45f1e934163104aa02d6fae`.
Ricevute, originali, tentativi, adapter e prove nuove restano nella scratch
ignorata del root. Nessuna suite, build, host, browser, DB o partita avviata
per questa modifica documentale; codice, dipendenze, pack e schema invariati.

## Decisione

Il contratto soddisfa la ricerca #120, senza abilitare A2. Il seguito può
implementare il passaggio dal campo alla preparazione nel registro
esistente; topologia battaglia, istruzione ambigua, casualità e consumer
fisici rimangono prerequisiti della partenza.

#57 conserva le tre quantità `null/unverified` e il blocco richiesto dal
proprietario. Nessuna riserva provvisoria, nuova partita originale,
ripresa di 156 o retrofit dei freeze storici. #57/#89/#33/#65 rimangono
aperte; nessuna partita completa o prova su telefoni fisici/Windows/Safari
è dedotta da questi controlli statici.
