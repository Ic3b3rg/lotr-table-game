# Benefici — piano di implementazione #94

Eseguire personalmente con implement/TDD, una capacità verificata per commit.
Spec: [boons-spec.md](boons-spec.md). Stack esistente TypeScript/Zod,
Node24/node:test, SQLite/Store.once; nessuna installazione.

## Slice e confini

1. **Compiler e freeze** (`physical-resolution/boon-program.ts`, model/runtime,
   scenario/physical, manifest, schema): test RED sul compiler pubblico per
   provenienza completa, definizioni verificate con quantità ignote e stock
   sintetico2/4/9, alterazioni/limiti. Artefatto verificabile/versionato e
   marker ante-startup; gate e replay storici invariati. Commit dopo GREEN.
2. **Acquisizione e ritorno** (front-runtime, combat/group/preflight/controller):
   test RED tramite openPhysical/answerPhysical e HTTP su concessione fonte,
   scelta, duplicato, receiver, unknown/empty, copie conservate, perdita con
   ripiego stampato, subito diretto contro figli. Collegare il consumer reale
   e il preflight senza filtrare popolazioni. Commit dopo GREEN.
3. **Finestre prova/attacco** (front-runtime): test RED per sostituzione,
   identità/conversioni pagate e riciclo, bonus una volta anche a zero successi,
   difesa prima della prova/divieto/scarto. Hook sul trasferimento effettivo
   e fine turno con prossimità congelata. Commit dopo GREEN.
4. **Consumer raggiungibili e UI** (titoli, view/shared, client): test RED sui
   costi con seguito obbligatorio e sul gate noto. Collegare titoli solo con
   closure disponibile; in caso contrario rifiuto prima dell'intero costo.
   Lettore beneficio/custodia e attese, disponibilità Ombra comprensibile.
   Verifiche browser sintetiche con tre identità e quattro larghezze.
5. **Recovery e consegna**: HTTP retry/stale/concorrenza, SIGKILL ai confini,
   restore senza file sorgente e alterazioni risignate; riconvalida payload
   autorizzati senza avanzare episodi. Oracle privato3/3 e stock reale ignoto.
   Suite completa finale, typecheck/formato/diff/privacy; commit locali puliti
   e report/sigillo privati, distinguendo ogni limite dall'accettazione originale.

## Casi da sorvegliare

- Copia ritornata e riacquisita nella stessa catena: una sola custodia reale.
- Padre sospeso dopo conversione: sostituzioni non rimborsano risorse e non
  rimettono in circolo le altre carte trattenute.
- Danno diretto zero con figlio che fa subire: predicato e scarti distinguono
  le due cause senza cancellare ricevute e risultato del padre.
- Difesa vietata: scarto obbligatorio resta obbligatorio prima della prova.
- Stock esauribile in una continuazione: diagnosi prima del costo, mai
  quantità illimitate, copie inventate o risorteggio della fonte.

Comandi incrementali: `npm run build`, `node --test tests/boons*.test.mjs`
più regressioni della slice, `npm run typecheck`. Finali: `npm test`,
`npm run format:check`, `git diff --check` e helper privati propri.
