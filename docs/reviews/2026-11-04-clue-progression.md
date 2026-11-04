# Review e integrazione parziale degli indizi — #89

Base `2f8e28f81618f19dfe2f14053aabf43f9eb1d95a`; sei commit esaminati fino a
`29c226184bd91715c8da52731e80a9e5afe89ee8`. Due contesti indipendenti, stesso
provider/modello/settings. Autorità: [issue89](https://github.com/Ic3b3rg/lotr-table-game/issues/89),
[spec](../planning/clue-progression-spec.md), ADR2–3 e contratti38/55.

**#89 rimane aperta:** il codice degli indizi è verificato, il criterio UI
autentico di almeno un indizio fino agli effetti della missione è mancante.
Nessuna chiusura dell'accettazione attraverso le sole fixture.

## Standards

**P1**, `scenario/runtime.ts`: il preflight controllava soltanto che il mazzo
della conseguenza non fosse vuoto, senza riservare le carte richieste. Violava
la regola della spec che include i figli fisici nella continuazione prima
dell'impegno. Probe inventato, stato fisico validato: una carta disponibile,
due richieste, azione pagata e prima carta trasferita prima del gate sul mazzo
esaurito. Non è una carenza osservata nel percorso originale.

Giudizio facoltativo: **possibile Duplicated Code** in `scenario/pack.ts`;
estrazione dei riferimenti di somma/limiti ripetuta nei controlli di presenza
e tipo. Differito, senza violazione documentata o difetto aggiuntivo.
Undici test puri compiler/runtime/reveal e probe eseguiti; nessun host/browser,
suite completa o modifica del checkout/evidenze da parte del reviewer.

## Spec

**P2**, stesso difetto della riserva non vuota ma insufficiente. La spec
richiede il controllo dell'intera continuazione prima del costo. Il probe
lascia il padre non restituito con una carta ancora dovuta. I packet originali
comprendono conseguenze da due carte; la raggiungibilità della scarsità con
la compagnia autentica non è provata. È un difetto del consumer, non il motivo
del fallimento della partita nativa.

Lacuna di accettazione separata: il report finale conferma che nessun indizio
autentico è stato completato. Il fallimento di Ultimo Sforzo richiede il
consumer della sconfitta alla successiva Ombra. Tentativi preparatori parziali,
fixture e nuovo sorteggio non suppliscono al criterio UI. Nessuna ulteriore
estensione di perimetro o difetto sostanziato. Undici test puri e probe in
memoria; nessuna scrittura alle evidenze o nuova prova browser.

## Correzione del root

Un difetto unico corretto localmente, conservando le priorità distinte dei
due assi. Il preflight riserva separatamente danni/paure lungo ogni percorso
ammesso dalla fonte, prima dell'impegno. Non pesca carte, modifica RNG o
confida in prevenzioni/restituzioni future. Ogni fork ricomincia dalla riserva
reale; nessuna sostituzione inventata quando le carte non bastano.

Regressione RED→GREEN al confine `interactScenario`: stato fisico valido
costruito dal consumer, entrambe le famiglie, conseguenza singola2 o due
conseguenze successive1+1 con una sola carta. Stato intero invariato al rifiuto;
con due carte la conseguenza2 resta ammessa. Capacità eroiche della fixture
inventate e dichiarate, senza attribuirle alla compagnia originale.

## Verifica indipendente

- **647/647 test**, zero fail/skip/todo, circa246s. Typecheck, formato e diff
  verdi; nessun test eliminato o soglia abbassata.
- Sigillo **1.778 file/1.413.826.654 byte**,28 file pubblici confrontati;
  SHA256 manifest `bebd53f3517c0fa37c19bd9eeb4d2bf9fad6a4891f60c04543d8fba0883b1906`.
  Copie proprie con timestamp conservati. Nessun helper eseguito nelle prove
  ricevute o driver contro il DB finale.
- Pack ricostruito identico byte per byte:34 definizioni,192 stati,184 azioni,
  43 confini differiti. Quattro owner/52 stati/50 azioni,350.000 dispatch e10
  percorsi del principale confrontati dall'oracle indipendente. Dieci corpi IL
  ricatturati dalle primarie con hash identici, otto anchor verificati con
  aritmetica float32 indipendente. Nessuna esecuzione Unity/JIT o parità RNG.
- Fixture tecnica con IR originale riprodotta in memoria: tre eventi del
  principale, esplorazione del covo, obiettivo, Sapienza e spawn nella sezione
  dovuta; quarto evento/sentinella senza duplicati. È una fixture, priva dei
  costi e delle prove giocate dalla UI.
- Validatore ricompilato dai sorgenti integrati: **52 payload nativi distinti**
  con un solo pack/origine, intero gameplay e ricevute identici; **299 backup
  storici** pertinenti conservati. Otto backup nativi alterati, con checksum
  coerente, respinti anche dal validatore corrente.
- Letture dei driver confermano DOM/Input/filepicker e GET osservativi;
  Runtime osservativo. Il root non ha avviato un nuovo host/UI. Ispezionate
  catture finali della guida320 e del lettore1024; il nome della cattura della
  mappa non costituisce una prova dei controlli degli indizi fuori viewport.
  Quattro larghezze e focus riguardano lo stato raggiunto, non un indizio
  completato. Il log distingue409/422 attesi e disconnessioni dei SIGKILL da
  errori runtime: nessuna eccezione/errore console, nessun500 registrato.
- Privacy su aggiunte, untracked e intera storia:245 needle fonte senza leak.
  Originali, mapping, backup e immagini restano ignorati. Prove e risultati
  propri in `.scratch/clue-progression-root-review/`.

## Stato autentico e integrazione

L'ultimo payload è round3/Azione, revisione127, dopo un ripristino esatto
amministrativo del checkpoint126. Un eroe sconfitto e `lossDue` sono presenti;
**minaccia21, limite64**. Si tratta della perdita dovuta all'eroe sconfitto,
non del raggiungimento del limite di minaccia e non di una issue numerata64.
Il rifiuto dell'Ombra conserva lo stato. Nessun rewind per evitare l'esito.

Il codice può essere integrato come avanzamento di89 con riferimento, senza
chiudere l'issue. Il seguito necessario è il consumer originale di sconfitta
e ingresso al campo; successivamente resta da ottenere l'accettazione degli
indizi dalla UI. Non va riscritto retroattivamente il pack della partita
bloccata o la sua origine per trasformarla in una prova riuscita.

Quantità57 sempre non verificate e gated per scelta del proprietario.33/65/57
rimangono aperte; soglie successive, fine vittoriosa, campo completo/A2 e
partita integrale restano da realizzare/verificare. Schema15 con capacità
facoltativa prima dello startup: rollback dopo attivazione richiede backup
antecedente. Tavolo protetto intoccato; processi/contesti propri chiusi.

Esito: Standards1 difetto corretto e1 giudizio facoltativo differito;
Spec1 difetto corretto, criterio UI ancora incompleto. Nessuna partita
completa o accettazione89 dichiarata.
