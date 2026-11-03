# Review del catalogo fisico #57

Diff indipendente fissato: `b9c0f465e79f6002d3ea8773ba5207000d4df921...44580c7be50d6361f7746340896e0776d394f489`. Review indipendenti Standards/Spec; integrazione root sulla base `cba8ad5a7d0709990faae0cbed3d407d35bb10f0`. Autorità: [issue #57](https://github.com/Ic3b3rg/lotr-table-game/issues/57), [specifica](../planning/physical-content-spec.md), [piano](../planning/physical-content-plan.md), AGENTS, glossario e ADR.

## Standards

Due P2 riprodotti dal reviewer e confermati dal root:

- `validation.ts`, input: il prototipo degli array non veniva controllato e un getter ereditato per `cards[0]` veniva eseguito. Violava «Input JSON strict» e la garanzia «senza eseguire getter». Corretto prima di Zod rifiutando prototipi array personalizzati; regressione conferma errore e zero letture del getter.
- `validation.ts`, binding: il controllo `sourceId + locator` lasciava passare carte con uguale identità `sourceId/modelId` e locator diversi. Violava «Rifiutare […] binding cross-card». Conservato il controllo sui locator e aggiunta unicità delle identità per fonte/tipo, sia TitleModel sia SkillModel. Due regressioni RED→GREEN, anche attraverso l'export famiglia; caso positivo per fonti/tipi distinti.

Nessuno smell facoltativo aggiuntivo. Il reviewer conferma il confine privato e la distinzione fra pack diagnostico e famiglie consumabili. Nessun executor gameplay richiesto da questa issue.

## Spec

Due P2 riprodotti dal reviewer e corretti dal root:

- Confine JSON: «Input JSON strict» veniva aggirato da un indice ereditato in `aliases.value`. Oltre ai prototipi personalizzati già respinti, ora sono rifiutati indici propri mancanti prima di Zod. Regressione RED→GREEN con getter su `Array.prototype`: da una lettura a zero; prototipo ripristinato nel `finally` del test.
- Ruoli modello: «binding cross-card» lasciava usare il riferimento TitleModel di una carta come SkillModel di un'altra. Aggiunta unicità congiunta dei locator fra entrambi i ruoli; due regressioni RED→GREEN, anche alterando il modelId. Gli ID numerici restano distinti per fonte/tipo: il medesimo numero in oggetti diversi è valido.

Il reviewer conferma le 60 voci, gli errata e i 21 titoli, inclusi 10/13/21 e l'assenza del binding 17. Nessun ulteriore difetto sostanziato; quantità beneficio correttamente diagnostiche.

## Verifica root e limiti

`npm test`: **389/389**, nessuno saltato; suite focalizzata **88/88**. Typecheck, format:check e diff check verdi. Confrontati 94 artefatti, 25 fonti bloccate e 80 binding; riletti 42 modelli. Confronto indipendente 60 definizioni per otto dimensioni, 13 mutazioni respinte. Input e CLI aggiornati producono gli stessi byte; fonti immutate. [Rapporto](../research/physical-content-catalog.md).

Tre quantità beneficio ancora sconosciute: nessun 5/5/5 dedotto dal totale 15. #57 rimane aperta anche dopo l'eventuale integrazione del codice; #33 e i consumer gameplay restano successivi. Danni/paure/titoli verificati possono essere consumati indipendentemente.

Rilievi per asse: Standards **2 P2 corretti**; Spec **2 P2 corretti**, incluso il difetto JSON condiviso. Nessun P2 aperto.
