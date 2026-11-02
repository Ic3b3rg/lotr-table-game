# Piano implementazione #51

Specifica: [map-encounters-spec.md](map-encounters-spec.md).
Esecuzione inline nel checkout assegnato; TDD e commit ordinati. L'utente
esclude subagenti e gate di conferma. Node24/TypeScript strict/Zod esistenti.

1. [x] Committare specifica e piano prima del codice; verificare baseline193.
2. [x] RED CLI/libreria: input grezzo, formato/provenienza, allSpaces shuffle,
   fixed e RNG singleton, output esclusivo e immutabile. Implementare
   `src/map-encounters/model.ts`, `encounters.ts`, `main.ts`, entry build e
   `tests/fixtures/map-encounters.mjs`; GREEN e commit.
3. [x] RED section/adventure: traits/specific identity, Threat2 min prefix,
   history/trie, first-model failure/rollback/failure/advanced RNG. Implementare
   nucleo placement in `placement.ts` e `search.ts` secondo owning IL; GREEN,
   tipi e commit. Null/empty arrays mantengono scope fonte.
4. [x] RED gruppi/item/fill/spawn: filtro tutti membri, Comparison sort oltre16,
   specified, persistent trie e cleanup; first fit item, inclusive float32 fill,
   owned lookup e storia addUnique. Implementare `groups.ts` e orchestration;
   GREEN, tipi e commit. Nessun fallback o FSM.
5. [x] RED limiti: work/trace/clock e replay, source failure distinto da unchecked,
   raw validation e input/output bounded. Completare diagnostici/stato avanzato;
   GREEN e commit. Verificare assenza di payload geometrico gigante nel successo.
6. [x] Normalizzazione selettiva privata con fonti già auditate; eseguire CLI
   su47 casi senza copiare assembly4GiB. Checker Python indipendente da src/dist
   per decisioni, shuffle/draw/snapshot, fixed6, compatibilità, gruppi, spawn e
   history. Metadati/prefab selezionati e selected302A con closure pendente.
7. [x] Documentare comandi/digest/conteggi/limiti e cicli RED→GREEN; verifiche
   finali suite/tipi/formato/diff, commit e checkout pulito. Consegnare SHA,
   branch, path e prove al root senza operazioni GitHub.

Rischi da verificare nei test: ordine builder diverso da Map order; shadowing
TileModel/hash; trie nonterminale e cleanup di ID preesistenti; lookup all vs
owned e indicizzazione unchecked del log fonte; best-effort senza history.

Completato:51 test nuovi,244/244 complessivi; typecheck/formato/diff verdi.
Matrice47/47 con checker indipendente, metadati dei72 prefab selezionati e
closure302A privata ancora pendente. Nessuna modifica a map-assembly.
[Report riproducibile](../testing/map-encounters-verification.md).
