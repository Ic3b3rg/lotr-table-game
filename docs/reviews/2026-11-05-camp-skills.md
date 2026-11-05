# Review e integrazione del negozio abilità — #114

Confronto fissato: main `5db5cf5134a3f38e5a917f45be43d4037bc30d9e` e
consegna `572089cac46adbfeb8ec46eac826577685164367`. Due review indipendenti
con contesti separati. [Ticket](https://github.com/Ic3b3rg/lotr-table-game/issues/114),
[specifica](../planning/camp-skills-spec.md), [rapporto](../development/camp-skills.md).

## Standards

Zero violazioni documentate. Un giudizio facoltativo di priorità bassa:
possibile Duplicated Code nei piccoli helper di allineamento amministrativo
in tests/camp-skills-transaction.test.mjs e tests/camp-skills-recovery.test.mjs.
L'estrazione comune rimane facoltativa; non viene mescolata alle correzioni
di comportamento. Nessun altro smell concreto del baseline Fowler.
Review statica dei file tracciati, senza suite, host, scratch o scritture.
Totale: zero violazioni, un rilievo facoltativo.

## Spec

Un P2: il riepilogo finanziario facoltativo di una ricevuta non era
vincolato al tipo di comando e al replay della vera transazione del campo.
Una ricevuta START storica poteva contenere il riepilogo; il controllo
pre-seed confrontava soltanto i vecchi campi e la migrazione precedeva
la lettura delle ricevute. Viola il requisito di verificare per intero
la ricevuta del vero vincitore e rifiutare forme nuove nei vecchi formati.

Il root riproduce tre RED distinti: forma del riepilogo su altri comandi,
backup reali startup risignati nei formati10–27, e falsa transazione con
metadati coerenti nel registro dello startup. La correzione lega tipo,
kind e riepilogo in entrambe le direzioni; controlla i percorsi effettivi
delle ricevute prima della migrazione≤26; esclude le ricevute finanziarie
dal prefisso antecedente al ciclo. Le vere transazioni rimangono verificate
a oggetto intero dal replay. Tre GREEN e19 test mirati passano; nessun
prezzo, premio o quantità cambia. Fix `3c0e112e0dba2dbccbec4ef69a87b9abf7ab79bd`.

Nessun altro requisito mancante/parziale o ampliamento sostanziato. Il
reviewer verifica byte/hash delle prove statiche pertinenti prima della
lettura; non esegue helper, suite, host o browser. Totale: un P2, corretto.

## Verifiche del root

Controllate tutte11.476righe/4.976.286.933byte e due copie proprie per
byte/hash, senza symlink. Manifest2.708.651byte, SHA256
`3e9292a507f4ca41a8afca21e5384d7b085e2f00e2362a957a7041086589b035`.
Nella copia operativa cambiano1103handle e16helper per i percorsi;
ricevute, provenienza e identità storiche rimangono immutate. Gli ulteriori
controlli e la correzione delle traduzioni sono soltanto nelle copie proprie.

Rilettura bounded con due reader: sei ruoli,12 CoreSkills e54 UpgradeSkills,
72oggetti/8560byte; incluso il registro pertinente73/17984. Oracle
indipendente su54offerte/54copie,113dimensioni numeriche e3402casi finiti.
Closure pertinente18corpi IL/2105code byte/783istruzioni/47branch target.
Rimangono52binding individuali e due copie in un insieme di equivalenza,
con candidati espliciti; nessuna identità individuale inventata.

Nel confronto integrale delle54 traduzioni il root trova quattro termini
da allineare al [manuale italiano ufficiale, pp.14 e16](https://cdn.svc.asmodee.net/production-asmodeeit/uploads/2022/09/Viaggi_nella_Terra_di_Mezzo.pdf):
Infervorato, Nascondiglio, accessorio e Incalzare. PDF locale verificato
prima dell'estrazione nativa e nuovamente prima della derivazione del pack.
Il confronto indipendente ammette soltanto quei cambiamenti testuali in14
carte e la provenienza del manuale. Tutti gli altri campi delle54 offerte,
prezzi, copie, simboli, testi inglesi, annotazioni meccaniche e audit restano
identici. Il pack ricevuto rimane conservato come consegnato, solo statico.

Pack112 ricostruito byte-identico. Tre compilazioni del nuovo pack sono
byte-identiche: fingerprint
`8f1b22eafa1f90b99e90ef2954eb0010b868bce683b7e62b6a5e967c3c296986`,
658484byte, SHA256
`307852652f7c49e8a7220ea84fa65302d1cd60bd9973a1ec6984f3e0f8703386`.
37definizioni/301stati/322azioni/27deferred; definizioni, certificati e
altre capacità precedenti sono immutati. Catalogo iniziale74 invariato.

Validator git-show/onLoad dal prodotto corretto:1.660.139byte, SHA256
`d91fbd22c47c992e6b3745d12b0808333ce6f316eeeb0b019395e5463d0f2b4d`.
Passano503file/398payload distinti/17viste94 e tutte le serie96–108
18/14/17/19/13/20/22snapshot,40+9serie110 degli stessi giochi e32serie112,
export/finali, viste e origini interi. Le sole migrazioni ammesse sono
strutturali; nessuna normalizzazione gameplay o esenzione dal replay.

La QA ricevuta usa dati inventati: tre contesti personali più un PC anonimo,
quattro larghezze, HTTP IPv4 senza WebCrypto,80casi e15snapshot/11payload
distinti. Il root rivalida tutti i backup e le viste dal binario corretto;
non avvia una nuova partita browser. Venti file/18.855eventi: zero eccezioni
Runtime o caricamenti falliti, due409 di concorrenza e due422 intenzionali.
Tutti278PNG sono decodificati e verificati;240appartengono alla QA accettata,
36al tentativo precedente fallito e due sono audit aggiuntivi. Il root vede
nove immagini, comprese carte, guida, CTA, saldo zero e PC anonimo.

Il controllo opzionale che riusa il minimo osservato586colori fallisce
sull'immagine aggiuntiva della guida con292colori. Il tentativo e la soglia
rimangono intatti; le276immagini precedenti hanno byte e metriche identici,
senza rimuovere o indebolire alcuno degli80casi accettati.

Recovery:30file interamente verificati, cinque SIGKILL postcommit, quattro
precommit e21negativi422. Il candidato SQL comprende vere ricevute e
registro; restore su host nuovi senza pack, payload/viste/origine interi.
Soltanto generation/revision/updatedAt possono cambiare al restore.

Canonica root **883/883**, vero exit code npm0, zero fail/cancel/skip/todo,
concorrenza4 da sola dopo tutti i controlli pesanti;1038,112secondi.
HEAD pulito e invariato prima/dopo il run.

Tipi, formato, diff e privacy passano. I29file di test storici modificati
aggiornano soltanto la versione corrente26→27; le tre regressioni del root
si aggiungono alle16prove nuove del child. Nessuna assertion, soglia o
deadline viene ridotta; niente skip/suppression o nuove dipendenze.
RED, tentativi falliti e correzioni dello scaffold restano nelle prove
private. Il primo GREEN root fallisce soltanto sul timestamp di un secondo
export; il confronto corretto preserva l'intero payload/checksum e verifica
separatamente il timestamp amministrativo, senza normalizzare gameplay.

Il commit documentale non modifica src/tests/scripts/package. I validator
finali vengono confrontati byte per byte con quelli del prodotto verificato;
le prove e i tentativi rimangono nella sola scratch ignorata del root.

## Limiti

57 resta null/unverified per la preferenza esplicita del proprietario.
156 rimane statico/gated e immutato; nessuna nuova partita originale o
ripresa.89/33/65/57 rimangono aperte e non si certifica l'avventura completa.
Upgrade oggetti, A2 ed effetti futuri delle nuove abilità rimangono gated
al rispettivo confine. Nessun retrofit su campagne già congelate.
QA su Chrome dello stesso Mac, senza attestazione su telefoni fisici,
Safari o Windows. Il tavolo live del proprietario non viene aggiornato.
Corpus, testi delle carte, immagini e prove grezze restano privati.

Standards:0violazioni e1rilievo facoltativo. Spec:1P2corretto con regressioni.
