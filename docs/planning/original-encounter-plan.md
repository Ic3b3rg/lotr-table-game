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

- [x] RED: fixture inventata compila conferma/test/conteggio/scelta/premio;
      alterare stat/quantità/istruzione o guardia nulla è respinto.
- [x] Implementare manifest originale esplicito e sole capacità certificate.
- [x] RED→GREEN: prova fonte vera, conversione e figlio, risultato del padre
      distinto, nessuna negazione/premio implicito; eseguire test mirati/typecheck.
- [x] Commit del primo incremento verificato.

## 2. Ledger originale e percorso HTTP

File: shared/physical-cycle/protocol, server/physical-cycle/commands/state,
scenario/runtime/physical/validate e nuovo raccordo originale se necessario.
Interfacce: conferma interazione source-bound; SCENARIO_INPUT per continuare;
ledger originale versionato con seed startup immutabile e intenti ordinati.
I consumer storici mantengono il percorso precedente.

- [x] RED: conferma nella casella dopo movimento spende una sola azione,
      conserva viaggio e restituisce soltanto dopo la fonte.
- [x] Implementare replay ordinario/fonte interlecciato, frame separati,
      finestra before-interact, prove/rami/Lore/hide/finish e ricevute atomiche.
- [x] RED→GREEN: ownership/casella/budget/stale/cross-source, primo fallimento,
      primo successo seguito da fallimento/cambio eroe, conteggio2+1, premio singolo,
      altro ramo senza premio inventato, ramo nullo e conseguenza/P2.
- [x] RED→GREEN: retry/concorrenza, SIGKILL prima/dopo commit, packless restore,
      backup risignati con cronologie rimosse e costo/progresso/ritorno/pose falsi.
- [x] Verificare migrazioni e run storici reali pending/result; commit.

## 3. UI e fonte privata

File: client/scenario/journey-map/physical/guide/style se necessari,
shared/scenario-map; tutti gli script originali nella scratch propria.
Interfacce: proiezione scenario e fisica, controlli nativi, nessun comando libero.

- [x] Collegare ispezione/conferma e scelta obbligatoria; mostrare progressi
      condivisi, prova corrente, attore, costo e movimenti residui; guida/focus.
- [x] Copiare input/helper in scratch propria prima di eseguirli; riusare
      compiler38/raw/fronti/P2 e asset verificati. Compilare soltanto la closure
      raggiunta; checker indipendente contro Message/binding/IL e hash bloccati.
- [x] Preparare backup compagnia/freeze autentico e dichiararlo. Tre contesti
      indipendenti, import UI, startup/turno/movimento/incontro/prove/esiti/ritorno.
      Tutti gli avanzamenti solo via UI. Restart/restore nel pending e confronto
      integrale dei campi gameplay/ricevute. Screenshot e viewport320/768/1024/1440.
- [x] Se un fix invalida catture, classificarle e rifare la sequenza coinvolta
      sul codice finale; commit.

## 4. Verifica e consegna

- [x] npm test; npm run typecheck; npm run format:check; git diff --check.
      Zero skip/suppression e criteri invariati.
- [x] Report pubblico conteggi/hash/locatori con confini reali e distinzione
      test/replay/artefatti/browser/precondizioni; manifesto privato riproducibile.
- [x] Verificare storia Git priva di originali, chiudere soltanto processi e
      schede propri, commit ordinati e status pulito; consegnare HEAD/lista commit.

Esecuzione completata sul codice `6c237f2`; risultati e confini nel
[report di verifica](../testing/original-encounter-verification.md).
Review Standards/Spec e integrazione rimangono al root.
