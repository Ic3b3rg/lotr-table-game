# Congelamento A1 — implementation plan

Esecuzione inline nel solo checkout assegnato, autorizzata dall'utente.
Goal: integrare generazione e freeze nella sessione preparata, con ripresa e
backup, mantenendo il confine pre-startup.
Architettura: pacchetto privato e contesto verificato → worker per attempt →
proiezione minima validata → transazioni Store/receipt. UI nel percorso esistente.
Stack: Node24.11.1, TypeScript strict, SQLite/Zod/esbuild già presenti.
Spec: [map-freeze-spec.md](map-freeze-spec.md).

## Vincoli e review focus

Nessuna dipendenza, materiale originale pubblico, scrittura GitHub o altro
checkout. Host root4339 e relativi dati intoccabili. La review indipendente
Standards/Spec e l'integrazione spettano al root.

- Compagnia diversa dalla fixture e inventario modificato: derivazione reale.
- Processo ucciso durante lavoro o dopo commit: niente effetti doppi.
- Restore mentre un worker lavora: risultato superato scartato.
- Backup manomesso con checksum ricalcolato: validazione semantica.
- Sessioni legacy con richieste aperte: migrazione senza modifiche di gioco.

## Incrementi (ognuno test rosso → implementazione → test verde → commit)

- [x] Pacchetto e contesto: `src/map-freeze/pack.ts`, fixture inventata e
      `tests/map-freeze.test.mjs`. API parseGeneratorPack/deriveContext; hash
      catalogo, mapping, upgrade, ordine, H e inventario. Rifiutare pack incompleti.
- [x] Pipeline e proiezione: `src/map-freeze/{pipeline,projection,validate}.ts`,
      `src/shared/generated-map.ts`, build libreria/worker. API runGenerationAttempt
      da input grezzo; ricalcolo deterministico assembly verificato; validatore
      semantico/fingerprint, geometria e due grafi, incontri/storia/continuazione.
      Test completezza, grafi, mutazioni con rehash, size e pending closure.
- [x] Comando e worker: `src/server/{map-generation,store,commands,main}.ts`,
      protocollo e state9. API offer/start/resume con Store.once e finalizzazione
      atomica; worker async, retry/pool trattenuti e limiti espliciti. Test HTTP
      readiness, identità, stale fingerprint/revisione, duplicati/concorrenza.
- [x] Recupero e backup: state/backup validator e test HTTP di crash pending,
      commit prima risposta, ripresa nuova identità, restore senza pack e durante
      lavoro, migrazioni 1–8 incluse richieste/viaggio aperti e ricevute.
- [x] UI: `src/client/{map-generation,guided-start,company,game-actions}.ts`,
      HTML/CSS esistenti. Stato condiviso e comandi personali, progress/error/resume,
      nessun percorso legacy che salta startup. Test backend separati, poi browser
      reale con3 identità e sole operazioni UI per preparazione e backup/recupero.
- [x] Prove private mirate: costruire pack verificato da fonti/source locks
      già disponibili e normalizzare solo input necessari in `.scratch/freeze`.
      Eseguire H3 reale, roundtrip/pending/crash; documentare comandi, hash e limiti
      in `docs/testing/map-freeze-verification.md`.
- [x] Eseguire npm test, npm run typecheck, npm run format:check,
      git diff --check; controllare requisiti e diff; commit finale e checkout
      pulito. Restituire HEAD/branch/checkout, prove riproducibili e limiti concreti.

Esecuzione e verifiche concluse: [rapporto](../testing/map-freeze-verification.md).
Review indipendenti e integrazione restano al root, fuori dal lavoro del child.
