# Review del primo incontro originale — #71

Diff fissato `082a86d...c8c2ec8`, quattro commit di integrazione. Due reviewer
indipendenti, Standards e Spec, in sola lettura; il root ha corretto i
riscontri senza un ulteriore ciclo di review. Fonti: issue71, specifica/piano,
contratto realizzato55, GLOSSARY e ADR0001–0003.

## Standards

**Un P1: conferma bloccata sul normale HTTP LAN.**
`client/encounter-inspection.ts:104` chiamava `crypto.subtle.digest` prima
del submit, mentre il QR usa l’IP LAN in HTTP. Violazione di ADR0001:
«Tutte le azioni […] devono essere disponibili dai telefoni».
[Web Crypto §10](https://www.w3.org/TR/webcrypto/#crypto-interface) limita
`subtle` ai contesti sicuri. Il componente reale compilato, con fixture
inventata in Chromium non sicuro, lasciava il pulsante abilitato ma generava
TypeError e zero submit. La prova non certificava un telefono fisico.

Nessuno smell facoltativo sufficientemente rilevante. Esaminati anche
compilazione/input, ledger, replay/cache, migrazione e confine privato;
nessun altro difetto sostanziato.

## Spec

**Un P1: stessa incompatibilità HTTP LAN**, contro ADR0001 e il flusso
richiesto da71§3. Le prove precedenti su localhost non la rilevavano.

**Un P2: precedenza errata della guida**, `client/guided-start.ts:291–299`,
contro71§3: «Chi agisce, prova/conseguenza e prossimo passo chiari».
Due witness DOM inventati: END_TURN sospeso in una decisione fisica mostrava
il titolo corretto ma invitava a viaggiare; tutti i turni conclusi con nodo
fermato/nascosto invitavano a scegliere un altro turno e dichiaravano il
segnalino disponibile. Il ramo originale sovrascriveva indicazioni già
corrette.

Nessun ulteriore requisito mancante, scope creep o errore sostanziato per
il solo incontro richiesto. Ombra, altri incontri e prosecuzione restano
limiti espliciti, senza ridurre l’accettazione complessiva33.

## Correzioni e verifica del root

Commit `2dcdd2300bee23549ac1acbb47342993147e9ae4`:

- L’host calcola i fingerprint delle istanze abilitate nella vista derivata
  `encounterFingerprints`; il client li inoltra senza API crittografiche
  riservate a HTTPS. Il campo è escluso dallo stato persistito e dai backup.
  I controlli autorevoli di fonte, revisione e proprietà restano attivi.
- La guida conserva la decisione fisica pendente. A turni conclusi spiega
  che Ombra originale è indisponibile e che i progressi sono salvati; non
  propone un turno impossibile o un segnalino già concluso.
- Tre regressioni sul componente reale, con DOM inventato e WebCrypto
  assente, falliscono prima e passano dopo. Il test HTTP esistente controlla
  anche che il fingerprint nella vista corrisponda al digest dell’istanza.

**526/526 test**, zero skip/todo; typecheck, formato e diff verdi.
Il primo giro completo era522/523 per SQLite «database or disk is full»;
la causa è stata riprodotta con diagnostica dell’host. Le sole copie di
verifica del root sono state sostituite con copie APFS a byte identici;
il caso isolato e la suite completa sono poi passati. Nessun retry è stato
aggiunto al prodotto e nessuna asserzione è stata rimossa.

Prove private e QA finale sono descritte nel
[rapporto di verifica](../testing/original-encounter-verification.md).
Standards:1 finding, massimoP1, corretto. Spec:2 finding, massimoP1,
entrambi corretti; il P1 comune è un solo difetto, non due correzioni diverse.
