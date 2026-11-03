# Review della ricerca sul primo combattimento

Origine [#75](https://github.com/Ic3b3rg/lotr-table-game/issues/75), base
`d10dd70f9ca70574de92cf643a2fdbe0195e2958`, consegna
`fab0fca401df04b9136e8c0ef8668d1ab6aeb52d`. Due review indipendenti, in
contesti distinti, sul solo rapporto aggiunto da quel commit.

## Standards

**0 rilievi P1/P2.** Il diff e la storia del commit contengono soltanto il
rapporto pubblico. Testi, associazioni delle carte, acquisizioni e contratti
normalizzati restano ignorati. Prove, proposte e limiti sono distinti;
nessuna suite o esecuzione gameplay viene attribuita alla ricerca.
Persistenza, proprietari e casualità materializzata rispettano ADR0001–0003.
Nessuno smell ulteriore pertinente a questo diff documentale.

## Spec

**0 rilievi P1/P2.** Coperti persona, spawn, attacco e contrattacco,
conseguenze fisiche/P2, rimozione, timer e primo seguito stabile. Le fonti
sono collegate ai parametri effettivi della compagnia autentica. Gate,
finestre, input distinti dell'obiettivo e futuro incremento sono espliciti.

Una nota editoriale P3 rilevava «cinque esiti» contro sei foglie del
contratto privato: tre opzioni producono rispettivamente uno, tre e due
rami terminali. Il root ha corretto il rapporto in «sei rami terminali»,
senza modificare fonti o prove sigillate.

## Verifica del root e disposizione

- Ricontrollati 41 input e 236 artefatti, 127.326.674 byte; manifest SHA256
  `b9fe2063f8d8f3bade8211d321c5164d5970859b57e837b569561347267c6bc7`.
- Copie proprie verificate byte per byte; checker indipendente ripetuto:
  43 oggetti, 104 corpi IL, 16/16 alterazioni dei dati respinte.
- Rigenerati nella sola copia di lavoro 11 artefatti centrali, identici
  alla consegna. Formato, 20 link relativi, privacy e diff verificati.
- La prima copia del root ometteva due copie fonte chiamate `manifest.json`,
  escluse dall'elenco degli artefatti ma presenti nei lock degli input.
  Completata la copia dai percorsi espliciti e ripetuto il checker con esito
  positivo; nessun file sorgente o sigillo altrui modificato.

Evidenze e log del root nella scratch ignorata
`.scratch/first-combat-root-review/`; prove ricevute separate dalla copia
rigenerata. Nessuna suite, host, Unity/JIT o sessione di gioco eseguita.

Ricerca integrabile; combattimento ancora da implementare. Le quantità dei
benefici di #57, la vera Ombra quando raggiunta e la conclusione originale
restano gate espliciti. #33, #65 e #57 rimangono aperte.

Totali: Standards 0; Spec 0, più una nota editoriale corretta dal root.
