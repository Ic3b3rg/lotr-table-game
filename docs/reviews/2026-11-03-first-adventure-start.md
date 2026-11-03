# Review dell’avvio originale #38

Diff fissato `bc83b16fae75609472241e916c0a05d066be3f79...ef313c69a1fddcd1067977e946beeae7788884c7`. Review indipendenti Standards/Spec; correzioni e integrazione al root. Autorità: [#38](https://github.com/Ic3b3rg/lotr-table-game/issues/38), [spec](../planning/first-adventure-start-spec.md), [piano](../planning/first-adventure-start-plan.md), ADR e contratti fonte.

## Standards

Due P2 riprodotti su fixture inventate:

- Continuazione di esplorazione: `spaceIndex` entro i limiti, `stage='next'` e `waiting=null` erano accettati al restore, saltando un callback. Violava «auto-explore302A in space order con PRE_REVEAL e REVEALED effettivi». Corretto con riconciliazione di proprietario/azione/tessera, cursore, attesa e prefisso degli eventi, anche dopo il completamento dell’esplorazione.
- Cronologia: eliminare tutte le coppie di ricevute input, o sostituire actor/source nelle due copie, rimaneva valido nonostante i completamenti. Violava il legame fra identità, source cursor, prova di completamento e ricevuta. Ora richieste consumate e loro ordine derivano dalle entry fonte, dai completamenti per eroe e dal cursore aperto. Verificati fingerprint, actor, pending ID, revisioni, conversioni e corrispondenza dei completamenti; le ricevute esterne continuano a dover coincidere.

Nessuno smell facoltativo aggiuntivo. Probe esclusivamente in memoria; nessuna modifica del reviewer a repository o dati.

## Spec

Un P2: `settled=true` con un messaggio pendente veniva accettato, poi il normale ACK bloccava lo startup. Violava consumer «legati alla proiezione e al runtime» e ripresa in ogni richiesta. Corretto riconciliando settled con azioni completate, transizioni FINISHED e stopped.

Requisiti mancanti/parziali **0**, scope creep **0**. Il reviewer verifica 76 hash, compiler/pack, quattro binding, 29 backup e replay freschi di tre compagnie: obiettivo0/round1, sei completamenti, flip/handoff singoli, conversione Cacciatore e freeze immutato. La prova con precondizione HTTP resta dichiarata separatamente dall’accettazione UI.

## Verifica root e limiti

Tre regressioni HTTP osservate RED→GREEN; mutazioni dei backup risignate, rifiuto422 e tavolo invariato. **419/419 test**, **30/30** focalizzati, typecheck/formato/diff verdi. Root ricontrolla 76 artefatti e cinque fonti originali, ricompila e valida quattro binding, 29 backup, sette riavvii e due restore; replay freschi UI53/UI38/Cacciatore validano stato e ricevute dopo ciascun comando. Due schermate ispezionate. [Rapporto](../testing/first-adventure-start-verification.md).

Le correzioni mantengono il formato schema10. #33 resta aperta per interazioni, fisica, combattimento, Ombra, esiti/campo/ID2; #57 per quantità dei benefici. Nessuna certificazione Unity/JIT o dispositivi fisici.

Rilievi per asse: Standards **2 P2 corretti**; Spec **1 P2 corretto**. Nessun P2 aperto.
