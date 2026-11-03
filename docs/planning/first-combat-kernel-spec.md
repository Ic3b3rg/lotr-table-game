# Nucleo del primo combattimento — #77

Base `e198cc79c19708df7a26cd8e5205edec36ae65c5`, schema15, baseline541.
Autorità: issue77, [contratto75](../research/first-combat-runtime-contract.md),
relativa review, ADR1–3 e contratti fisici/P2/incontro/esplorazione citati.
Specifica, piano ed esecuzione autonoma nel checkout assegnato sono autorizzati.
Review Standards/Spec, integrazione e merge appartengono al root.

## Risultato e confine

Un modulo TypeScript e una CLI offline compilano il sottoinsieme fonte privato
e consumano realmente spawn, equipaggiamento, slot, colpi per figura e
selezione nemica. Il risultato termina a una continuazione tipizzata per
conseguenze fisiche o callback scenario. Nessun premio o Lore implicito.
Il controller delle prove/finestre, gli agganci persistenti, conseguenze/P2,
scenario, UI e Ombra restano consumer successivi. Nessuna modifica ai run,
pack, schema o gate correnti dell'app. #33/#65/#57 rimangono aperte.

Il compiler legge record fonte bounded, parametri effettivi e binding,
non nomi narrativi né le conclusioni semantiche del rapporto75. Conserva
record, origini/hash, ordine e dipendenze nell'artifact privato versionato.
Le quantità di spawn derivano dall'azione e dal modello; la casella deriva
dalla catena GO/Tile/Spaces e dalla proiezione congelata validata. Le armi
derivano da righe fonte e modelli equipaggiati; gli slot sono posizionali.
Istruzioni, statistiche di negazione e aggiunte restano legate ai rispettivi
campi/localizzazioni verificati. Nessuna esecuzione di testo o IL.

Input e artifact sono JSON strict, con limiti prima della traversata;
accessor, cicli, prototipi, collisioni, riferimenti/binding irrisolti,
azioni sconosciute, quantità/stat/dipendenze invalide sono rifiutati.
La verifica ricompila l'artifact e confronta tutti gli output. Un hash
dimostra integrità: il checker privato separato rilegge le primarie bounded
per controllare l'associazione fonte/effetto, senza importare l'algoritmo.

## API e stato

Interfaccia: `compileCombatSource`, `verifyCombatArtifact`,
`combatCapability`, `createCombatKernel` e `restoreCombatKernel`.
Il kernel possiede un seed immutabile, journal di intenti/risultati,
receipt, stato dei gruppi, spese e selezioni materializzate. Checkpoint
esportabile con fingerprint artifact/proiezione e replay integrale.
Retry identico restituisce la stessa receipt; intento diverso con lo
stesso ID e dati alterati/cross-source sono respinti.

Il risultato della prova entra solo da una porta host fidata, fornita
alla costruzione del kernel. I comandi scelgono oggetti e slot, mai
successi, colpi, salute o vittoria. La CLI usa un adattatore tecnico
esplicitamente dichiarato e i suoi risultati non provano gameplay.
Ogni successo e slot può pagare una sola capacità per attacco. Il piano
è calcolato e vincolato allo stato; applicarlo non accetta un totale libero.
Gli effetti esterni hanno una porta e una causa distinte.

Spawn verifica disponibilità/budget prima della mutazione: successo e
fallimento conservano i rami fonte; disponibilità positiva ma insufficiente
produce un gate, senza riduzione inventata. Il budget segue la formula
fonte e il limite per eroe; punti e figure non condividono un contatore.
Colpi attraversano armatura, stregoneria e salute di ciascuna figura in
ordine; i superstiti conservano salute e ripristinano le difese temporanee.
Supportati solo i modificatori verificati Perforante/Stordire. Altri hook
richiesti danno un gate prima della spesa.

La continuazione distingue attacco, provocazione, effetto esterno e
interruzione di attivazione. Usa dimensione corrente, stato pronto/esaurito,
Stordire e distanza dal medesimo attaccante. La selezione precede il
controllo di range quando previsto; include tutta la popolazione fonte,
anche l'aggiunta che richiede benefici57. Stream nemico separato e
versionato, nessuna equivalenza Unity. Un callback di gruppo compare una
volta alla rimozione dell'ultima figura; nessun premio per singola barra.

`combatCapability` distingue il sottopercorso tecnico eseguibile dalle
dipendenze mancanti per persona/attacco originale. `runtimeReady` resta
falso per il combattimento originale: nessun costo per scoprirne i gate.
Benefici5/5/5 restano non confermati, senza nuova domanda al proprietario.

## Verifica e privacy

Fixture pubbliche interamente inventate; matrice privata su modello,
istruzioni e oggetti effettivi. TDD RED→GREEN alle API e alla CLI;
typecheck durante gli incrementi; suite completa una volta alla fine.
Controlli di source hash e sigillo della sola scratch propria.
Nessun originale, mapping o artifact privato in Git, anche nella storia.
Nessuna installazione, host/browser o QA UI fittizia; nessun accesso a4339
o alla scratch protetta. Solo commit locali puliti, nessuna scrittura GitHub.
