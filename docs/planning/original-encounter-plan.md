# Primo incontro originale — piano di implementazione

> Esecuzione inline nel checkout assegnato; nessun subagente. Specifica:
> [original-encounter-spec.md](original-encounter-spec.md). Autonomia e seam
> già autorizzati dall'incarico; review e integrazione al root.

Obiettivo: rendere giocabile la closure originale certificata dal compiler
alla UI, conservando startup/freeze e compatibilità main082a86d.
Stack: Node24.11.1, TypeScript, Zod4.6.7, SQLite e DOM esistenti; nessuna installazione.

## Vincoli trasversali e rischi da verificare

Originali/mapping soltanto scratch ignorata; GitHub read-only; nessun nuovo
checkout/processo condiviso. I tre fixPR70 e semantichePR68 sono regressioni
obbligatorie. Il seed ordinario rimane round1/Azione. Controllare soprattutto:
figlio scambiato per prova padre, primo successo perso dopo fallimento,
conteggio condiviso resettato, spesa/posizione cancellata eliminando registri,
e ricompensa ripetuta dopo restore. Ogni rischio è verificato nei passi sotto.

## 1. Compiler e frame prova

File: shared/scenario, scenario/compiler/handlers/pack, shared/physical,
physical-resolution/front-runtime/front-state/view; fixture e test dedicati.
Interfacce: compileScenarioPack resta l'ingresso pubblico; nuovi handler
stretti con attestazione dell'istruzione; openPhysical/answerPhysical restano
il seam per prove e conseguenze con risultato persistito del padre.

- [ ] RED: fixture inventata compila conferma/test/conteggio/scelta/premio;
  alterare stat/quantità/istruzione o guardia nulla è respinto.
- [ ] Implementare manifest originale esplicito e sole capacità certificate.
- [ ] RED→GREEN: prova fonte vera, conversione e figlio, risultato del padre
  distinto, nessuna negazione/premio implicito; eseguire test mirati/typecheck.
- [ ] Commit del primo incremento verificato.

## 2. Ledger originale e percorso HTTP

File: shared/physical-cycle/protocol, server/physical-cycle/commands/state,
scenario/runtime/physical/validate e nuovo raccordo originale se necessario.
Interfacce: conferma interazione source-bound; SCENARIO_INPUT per continuare;
ledger originale versionato con seed startup immutabile e intenti ordinati.
I consumer storici mantengono il percorso precedente.

- [ ] RED: conferma nella casella dopo movimento spende una sola azione,
  conserva viaggio e restituisce soltanto dopo la fonte.
- [ ] Implementare replay ordinario/fonte interlecciato, frame separati,
  finestra before-interact, prove/rami/Lore/hide/finish e ricevute atomiche.
- [ ] RED→GREEN: ownership/casella/budget/stale/cross-source, primo fallimento,
  primo successo seguito da fallimento/cambio eroe, conteggio2+1, premio singolo,
  altro ramo senza premio inventato, ramo nullo e conseguenza/P2.
- [ ] RED→GREEN: retry/concorrenza, SIGKILL prima/dopo commit, packless restore,
  backup risignati con cronologie rimosse e costo/progresso/ritorno/pose falsi.
- [ ] Verificare migrazioni e run storici reali pending/result; commit.

## 3. UI e fonte privata

File: client/scenario/journey-map/physical/guide/style se necessari,
shared/scenario-map; tutti gli script originali nella scratch propria.
Interfacce: proiezione scenario e fisica, controlli nativi, nessun comando libero.

- [ ] Collegare ispezione/conferma e scelta obbligatoria; mostrare progressi
  condivisi, prova corrente, attore, costo e movimenti residui; guida/focus.
- [ ] Copiare input/helper in scratch propria prima di eseguirli; riusare
  compiler38/raw/fronti/P2 e asset verificati. Compilare soltanto la closure
  raggiunta; checker indipendente contro Message/binding/IL e hash bloccati.
- [ ] Preparare backup compagnia/freeze autentico e dichiararlo. Tre profili
  indipendenti, import UI, startup/turno/movimento/incontro/prove/esiti/ritorno.
  Tutti gli avanzamenti solo via UI. Restart/restore nel pending e confronto
  integrale dei campi gameplay/ricevute. Screenshot e viewport320/768/1024/1440.
- [ ] Se un fix invalida catture, classificarle e rifare la sequenza coinvolta
  sul codice finale; commit.

## 4. Verifica e consegna

- [ ] npm test; npm run typecheck; npm run format:check; git diff --check.
  Zero skip/suppression e criteri invariati.
- [ ] Report pubblico conteggi/hash/locatori con confini reali e distinzione
  test/replay/artefatti/browser/precondizioni; manifesto privato riproducibile.
- [ ] Verificare storia Git priva di originali, chiudere soltanto processi e
  schede propri, commit ordinati e status pulito; consegnare HEAD/lista commit.
