# Map Source Primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rendere verificabili le scelte del generatore originale, con ripresa.

**Architecture:** Un modulo di casualità con stato validato e un ordinamento
Comparison riproducono le primitive delle assembly fissate. La build espone
un'interfaccia piccola; il futuro generatore conserva clock e ricerca separati.

**Tech Stack:** Node 24, TypeScript, Zod, esbuild e node:test esistenti.

**Spec:** [map-source-primitives-spec.md](map-source-primitives-spec.md).

## Global Constraints

- Nessuna modifica al tavolo attivo, ai mazzi o ai salvataggi originali.
- Oracolo/IL privati; fixture pubbliche inventate e verificabili.
- Stato e contatore dei campioni ripristinabili; niente Math.random.
- Float32 con politica identificata; nessuna falsa certificazione Unity.

## Review Focus

- Overflow int32 nell'inizializzazione, seme minimo e percorso large-range.
- Consumo di casualità per intervalli vuoti/unitari e singleton shuffle.
- Snapshot senza alias e indici coerenti; errore prima di una mutazione parziale.
- Identità a chiave uguale e ordine dei confronti, anche nel ramo heapsort.
- Un sort stabile o un ciclo di shuffle diverso non soddisfa la specifica.

### Task 1: oracolo e casualità ripristinabile

**Files:** `src/map-generation/primitives.ts`, `scripts/build.mjs`,
`tests/map-primitives.test.mjs`, `tests/fixtures/map-source-vectors.json`;
oracolo soltanto `.scratch/map-primitives/`.

- [x] Eseguire i corpi IL selezionati e derivare vettori sintetici indipendenti.
- [x] Scrivere prove sulla build pubblica e osservarne il rosso.
- [x] Implementare Random, stato validato, contatore e float32 nominato.
- [x] Verificare vettori, ripresa, alias e input; commit del primo nucleo.

### Task 2: shuffle e Comparison sort

**Files:** stesso modulo e prove, `src/map-generation/comparison-sort.ts`.

- [x] Osservare il rosso su shuffle e sort con identità/confronti originali.
- [x] Implementare percorso introsort/insertion/heap e shuffle a range intero.
- [x] Verificare taglie limite, pari, comparatore originale delle sezioni,
  heapsort e input invalido; commit.

### Task 3: verifica e consegna

**Files:** rapporti `docs/testing/`, `docs/reviews/`, istruzioni README.

- [ ] Matrice privata più ampia, vettori e impronte dell'oracolo.
- [ ] Suite completa, tipi, formato e review fresca Standards/Spec.
- [ ] Documentare risultati e limiti, correggere rilievi importanti con regressione.
- [ ] PR/merge/chiusura dell'incremento; #41/#38/#33 restano aperte.
