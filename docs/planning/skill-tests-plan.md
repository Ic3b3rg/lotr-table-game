# Piano: prove abilità persistenti

**Obiettivo:** completare dal telefono una prova standard e ritrovarla identica
dopo un riavvio. **Specifica:** [contratto](skill-tests-spec.md).

**Architettura:** un modulo condiviso descrive prova e totali, un modulo server
applica i comandi nella transazione esistente; il client aggiunge un'area di
prova alla compagnia senza cambiare la preparazione. Esecuzione nella sessione
corrente, con TDD all'HTTP e revisione indipendente finale contro `main`.

## Vincoli globali

- Node 24.11.1–24.x, TypeScript, HTTP, SQLite; nessuna nuova dipendenza.
- Italiano, contenuti originali privati fuori da Git, ordine del mazzo nascosto.
- Conferma dopo il salvataggio; conservare le quindici copie di ogni eroe.

## Rischi da verificare

Moduli modificati da un altro dispositivo; ricevute reinviate dopo ripristino;
mazzo vuoto durante una rivelazione; backup valido nel formato ma incoerente;
polling che cancella la scelta o il focus di un modulo.

## 1. Rivelare e concludere

File: `src/shared/skill-tests.ts`, `src/shared/protocol.ts`,
`src/shared/preparation.ts`, `src/server/skill-tests.ts`,
`src/server/{state,store,commands}.ts`, `tests/skill-tests.test.mjs`.

- [x] Test HTTP rosso: compagnia preparata, pesca tre carte, soglia tre,
  risultato positivo; quindici copie conservate, ordine nascosto.
- [x] Aggiungere `START_SKILL_TEST` e `RESOLVE_SKILL_TEST`, stato versione 3,
  migrazione 1/2 e vista pubblica con totali/esito derivati dal catalogo.
- [x] Eseguire test mirato e typecheck, quindi salvare l'incremento.

## 2. Ispirazione, esaurimento e ripresa

Stessi moduli; aggiungere `tests/skill-test-recovery.test.mjs`.

- [x] Un test rosso per volta: ottenere ispirazione entro limite; convertire
  un fato una sola volta; controllo proprietario/revisione/prova corrente.
- [x] Aggiungere `GAIN_INSPIRATION` e `CONVERT_FATE` con ricevute idempotenti.
- [x] Testare ricomposizione anche a metà pesca, minimo una carta, conteggio
  e fallimento; usare backup HTTP per fissare casi iniziali controllati.
- [x] Testare SIGKILL, recupero, ripristino su altro host, migrazione schema 2
  e rifiuto dei backup con copie o ispirazione incoerenti.
- [x] Eseguire test mirati e typecheck, quindi salvare l'incremento.

## 3. Interfaccia e consegna

File: `src/client/skill-tests.ts`, `src/client/company.ts`,
`src/client/index.html`, `src/client/style.css`, README e verifiche.

- [x] Aggiungere area personale e vista condivisa, carte leggibili, totali,
  limite esplicito sulle capacità non automatizzate e moduli stabili al polling.
- [x] Provare realmente desktop e telefono nel browser; correggere i difetti
  osservati in un passaggio e verificare il risultato.
- [ ] Eseguire typecheck, formattazione e suite completa; revisione standard e
  specifica in parallelo. Correggere i rilievi, documentare le evidenze e commit.
