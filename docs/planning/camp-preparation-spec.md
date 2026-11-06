# Ruoli e accessori per la prossima avventura — #122

Base `c4220e203fc3b70c8b365f6b77c19d65a86f4962`, schema28, baseline907.
Mandato e scelte ordinarie già autorizzati; implementazione unica nel checkout
T3, senza deleghe, altre worktree, installazioni o scritture GitHub.

## Obiettivo e autorità

Dal primo campo raggiunto attraverso vittoria o sconfitta, ciascun proprietario
sceglie ruolo e accessorio comune facoltativo per il proprio eroe e conferma
il riepilogo autorevole. Gli altri partecipanti e il PC anonimo osservano
scelte, inventari correnti, saldi e progresso. Reload, recupero e restore
conservano tutto. Il gruppo torna al campo e rientra senza annullare scelte.

Autorità: [baseline](fidelity-baseline.md),
[contratto120](../research/first-camp-transition-runtime-contract.md),
[review120](../reviews/2026-11-06-first-camp-transition.md), ADR1–3 e glossario.
RR p3/p5 e §§105/109/112 stabiliscono composizione e proprietà; callback
`UIRestScene.OnRoleSelected`/`OnBackClicked` stabiliscono assegnazione e ritorno.
Primarie e derivazioni private restano nella scratch ignorata. Si verificano
byte/SHA prima del parse e si usano solo i riferimenti esplicitamente
allowlisted, senza seguire identità storiche o eseguire helper in place.

## Contratto di dominio

- Si inizializza dai ruoli correnti. Selezionare un ruolo lo assegna al proprio
  eroe e libera quel ruolo da ogni altro; nessuno scambio automatico. La
  liberazione server invalida la conferma dell'eroe liberato. I saldi XP
  rimangono nel ruolo premiato e non si aggiunge qui una voce XP0.
- Accessori: massimo uno per eroe e un eroe per copia. Solo il proprietario
  della selezione la può rilasciare. Una copia occupata non si può sottrarre.
  Nessun accessorio è una scelta valida. Proprietà comune, selezione futura
  e custodia fisica dell'episodio1 sono dati distinti; il limite dell'inventario
  A1 resta invariato. Gli upgrade usano le versioni di campagna correnti.
- La ricetta usa identità fonte: base1–6, eroe1–5, nuovo ruolo1–3, tutte le
  abilità ancora acquistate di ogni ruolo e titoli posseduti. Ruolo1 è
  indicata come futura preparata. Una debolezza è una futura pesca comune,
  senza identificare copia o ordine. Le vecchie zone non sono una lista
  pronta; vecchi core gratuiti e debolezze non vengono trascinati.
- I testi mantengono status e provenienza, incluso Guardian1. Nessuna nuova
  certificazione degli effetti futuri; un'identità necessaria non attestata
  produce un gate pertinente prima di selezione/conferma.
- Ogni conferma personale è legata al riepilogo autorevole corrente. Cambiare
  ruolo/accessorio invalida la propria conferma; liberare un ruolo invalida
  anche l'altro. Veri acquisti, rimborsi e upgrade invalidano le conferme
  delle ricette/equipaggiamenti cambiati. Ritorno/rientro conserva quelle
  ancora valide. Confermare è consentito anche se A2 non è disponibile.
- La partenza resta `requires-content`, anche con tutte le conferme. Nessuna
  pesca, mescolata, debolezza identificata, preparazione fisica, trigger,
  reset o RNG anticipato. L'archivio1 non diventa un falso episodio2.

## Architettura e dati

Stack esistente: Node24.11.1/npm11.6.2, TypeScript5.9.3, Zod4.6.7,
SQLite nativo, esbuild0.28.2, DOM/CSS senza framework. Niente nuove dipendenze.
Si conserva lo stile dei moduli `camp-skills`/`camp-items`, con schema condiviso,
validator capability, modulo profondo delle transazioni e UI del campo.

Capability opzionale `campPreparation`, versione `source-camp-preparation-v1`:
binding del catalogo, delle capacità campo precedenti, delle identità delle
carte iniziali e dei metodi fonte pertinenti. Il compiler richiede il
certificato corrispondente. Freeze prospettico prima dello startup; pack
storici senza capability mantengono il gate e non ricevono retrofit.

La proiezione `campaign.preparation` conserva selezioni/conferme; i ruoli
restano anche nel campo autorevole di ciascun eroe di campagna. Nuovi intenti
tipizzati `camp-prepare`, `camp-select-role`, `camp-accessory`, `camp-confirm`,
`camp-return`, nel registro esistente `SCENARIO_INPUT`/Store.once/cycle v2.
Il client invia solo scelta e, per confermare, fingerprint del riepilogo;
non invia ricetta, stock, prezzi, XP, risultati o seed. Ricevute complete
legate bidirezionalmente a tipo/kind; il retry restituisce il risultato
reale del vincitore, con revisione/cursore/fonte/generazione verificati.

Schema29 solo strutturale se necessario: rifiutare forme nuove ai percorsi
esatti di stato, origine, intenti e ricevute nei formati1–28. Dizionari
ordinari con chiavi omonime rimangono validi. Nessun secondo journal,
origine riscritta, normalizzazione gameplay o esenzione dal replay.

## Interfaccia

Estendere il campo esistente con ingresso alla preparazione, riepilogo per
eroe, controlli personali e ritorno. Rendere visibili proprietario, ruolo,
copia comune scelta/disponibile, equipaggiamento corrente, carte previste,
conferma e prossimo passo. Prima della selezione di un ruolo occupato
spiegare chi rimarrà senza ruolo; nessun comando in nome dell'altro eroe.
Mostrare separatamente scelte confermate e partenza ancora indisponibile.
Guida offline e lettori sempre raggiungibili; status, etichette, focus,
tastiera e tap coerenti con gli elementi esistenti. Nessun overflow a
320/768/1024/1440. Il PC anonimo osserva senza occupare un posto.

## Verifiche e comandi

```text
npm run build
npm run typecheck
npm run format:check
node --test --test-concurrency=4 tests/camp-preparation-*.test.mjs
npm test
```

TDD per slice su fixture pubbliche interamente inventate e HTTP/SQLite reali.
Verificare proprietà, unicità, conflitti, retry e ricevuta intera; identità,
fase, capability, fonte, ricetta, cursore, revisione e generazione errate;
payload intero immutato dopo rifiuti e nessun consumo RNG dopo sole scelte.
Verificare invalidazioni dopo veri acquisti/rimborsi/upgrade; titoli rimossi,
eroi sconfitti e accessori consumati restano nel contratto di campagna.

Recovery con SIGKILL prima/dopo commit sui nuovi confini, candidati con
vere righe SQLite, restore in host vuoti packless, negativi coerentemente
risignati422. Confrontare payload, viste, origini e ricevute interi, salvo
soli tre campi amministrativi del restore. Corpus corrente integrale,
serie96–116, finali/export/viste con validator costruito dal commit finale.

QA Chrome nativo su fixture inventata dichiarata prima dello startup,
tre contesti personali e PC anonimo, HTTP IPv4 senza WebCrypto; campi da
entrambi i veri consumer. Dopo bootstrap solo DOM/Input/filepicker avanza.
Screenshot realmente dipinti, deadline che rifiuta paint mancante, campioni
ispezionati; profili, PID e porte propri, chiusura provata senza scansioni
globali. Nessuna attribuzione a dispositivi fisici, Windows o Safari.

## Consegna e limiti

Specifica/piano committati prima del codice; slice compilabili e commit
atomici. Report pubblico generico, README privato, lock distinti per
riferimenti read-only/copie/adapter/output/tentativi, manifest byte/SHA
senza autoriferimento. Privacy scan di diff, file nuovi e intera storia
contro testi lunghi privati. Canonica npm test ALONE4 dopo controlli pesanti
e ultima correzione prodotto, con footer/exit npm reale e HEAD pulito
invariato. Per sola documentazione successiva provare identità degli alberi
prodotto/binari. Root cura review fresche, GitHub e integrazione.

Quantità57 tutte `null/unverified`, blocco mantenuto;156 statico/gated,
nessuna nuova partita originale, ripresa o retrofit. #57/#89/#33/#65 aperte.
Non contattare superfici del proprietario né seguire vecchi handle.
