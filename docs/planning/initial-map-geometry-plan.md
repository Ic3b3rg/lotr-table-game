# Initial Map Geometry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Comporre e congelare una sezione geometrica con giunzioni delle fonti.

**Architecture:** Un modulo tipizzato conserva geometria e semantica dei bordi,
un adattatore CLI valida file/scelte e scrive il risultato. L'host e la sua
sessione restano indipendenti da questo compilatore; il generatore #41 lo
riuserà prima dell'orchestrazione #38.

**Tech Stack:** Node 24, TypeScript, Zod 4.6.7, esbuild 0.28.2; nessun pacchetto nuovo.

**Spec:** [initial-map-geometry-spec.md](initial-map-geometry-spec.md).

## Global Constraints

- Pacchetto versione 1, `scope: geometry-only`, due forme distinte.
- Input ≤1 MB; forme ≤32 caselle/esagoni, coordinate locali ±512, somma zero.
- Sei rotazioni e scelte di giunzione esplicite; nessuna dichiarazione di parità RNG.
- Nessuna modifica di UI, host, salvataggio o materiali originali.
- Dati originali/output reali privati; test pubblici inventati.

## Review Focus

- Un secondo contatto incompatibile invalida anche un aggancio iniziale valido.
- Il bordo 700 può combaciare ma non crea movimento; rive e passaggi sono distinti.
- Rotazione globale e direzione locale non devono essere confuse.
- Una forma non può perdere esagoni o caselle durante normalizzazione/compilazione.
- Errori o output già esistente non devono lasciare file parziali o alterati.

### Task 1: confine CLI, modello e aggancio minimo

**Files:** `src/map-geometry/model.ts`, `geometry.ts`, `main.ts`,
`tests/fixtures/map-geometry.mjs`, `tests/map-geometry.test.mjs`, `scripts/build.mjs`.

**Interfaces:** `GeometryPackSchema/GeometryPack`,
`enumerateAttachments(pack, startRotation)`,
`composeGeometry(pack, startRotation, placementIndex)`.

- [ ] Scrivere il test CLI che elenca 36 agganci di due esagoni standard e
  compone l'indice 0 con una casella per forma e un collegamento reciproco.
- [ ] Eseguire il test: fallisce perché il compilatore non esiste.
- [ ] Definire gli schemi e le trasformazioni intere; validare al confine CLI.
- [ ] Aggiungere entry point build e produrre JSON versione 1 senza mutate l'input.
- [ ] Verificare il caso e commit del primo incremento funzionante.

### Task 2: compatibilità dei contatti e grafo

**Files:** stesso modulo, fixture e test CLI.

**Interfaces:** i candidati mantengono ancore e `openEdgeCount`; risultato con
pose, caselle, esagoni globali e connessioni canoniche non duplicate.

- [ ] Testare le sei rotazioni, le rive opposte, i passaggi aperti/chiusi,
  il 700, contatti secondari incompatibili e sovrapposizioni.
- [ ] Eseguire ogni nuova prova rossa prima della modifica necessaria.
- [ ] Implementare i controlli di tutti i contatti e il grafo reciproco.
- [ ] Verificare anche input con indici duplicati/assenti e coordinate non cubiche.
- [ ] Commit dopo le prove verdi, senza un nuovo livello di astrazione non usato.

### Task 3: congelamento ed evidenza originale

**Files:** CLI/test, README e rapporti in `docs/testing/` e `docs/reviews/`;
estrazione e dati originali solo `.scratch/map-composition-source/`.

- [ ] Testare output nuovo, determinismo e rifiuto di sovrascrittura senza alterazioni.
- [ ] Estrarre in privato custom100A e 302A preservando ordine/indici/provenienza.
- [ ] Eseguire il compilatore sulle sei rotazioni e verificare 4 caselle/16 esagoni,
  giunzioni legali e collegamenti ricavati dai bordi, senza spacciare il risultato
  per l'intera mappa A1.
- [ ] Eseguire suite, tipi, formato; revisioni Standards/Spec e documentazione.
- [ ] PR, merge e chiusura #42, lasciando #41/#38/#33 aperte.
