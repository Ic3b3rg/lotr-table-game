# Review e integrazione delle attivazioni — #87

Base `031f4ab60640ed5e43aeb58f02205624f60aab44`; implementazione esaminata
`7bfd16fb795210decbfba8e7f9d7497925f92f10`, tre commit locali. Due contesti
indipendenti, stesso provider/modello/settings, senza modifiche o nuove deleghe.
Spec: [issue87](https://github.com/Ic3b3rg/lotr-table-game/issues/87),
[contratto](../planning/shadow-activations-spec.md),
[fonte83](../research/second-shadow-combat-runtime-contract.md).

## Standards

Un difetto **P1**: il controllo iniziale saltava un gruppo incapace di attaccare
dalle posizioni correnti, senza includere l'attacco reso possibile da un
movimento imposto precedente. Viola la closure obbligatoria della fonte83.
Probe inventato: percorso a–b–c, eroe in a, primo gruppo in a che lo sposta
verso b, gruppo successivo in c con movimento1 e acquisizione di beneficio.
La fase inizialmente passava; dopo lo spostamento emergeva il gate57.

Giudizio facoltativo **P3, possibile Duplicated Code**: il grafo visibile di
`movement.ts` ripete la selezione di caselle/archi già usata dal movimento
verso minaccia. Differito: nessuna violazione documentata o difetto aggiuntivo.
Nove test puri mirati e probe in memoria; nessun host/browser o suite completa.

## Spec

Tre difetti riprodotti:

- **P1**, stesso controesempio del controllo dell'intera Ombra descritto sopra.
  Contratto: controllo prima di casualità, movimento, carte, tick o minaccia.
- **P2**, gruppo scollegato da tutti gli eroi: apriva una scelta con zero
  opzioni e restava attivo. Contratto: completare l'alternativa e riscorrere
  i gruppi dall'inizio, anche quando non esiste un bersaglio raggiungibile.
- **P2**, esplorazione imposta durante Ombra: salvava `turnId:null` nel formato
  dei turni, che richiedeva UUID. La scelta legale non superava la persistenza.
  Contratto: esplorazione e figli nello stesso registro autorevole.

Nessuna estensione di perimetro sostanziata. Tre probe puri eseguiti, due test
mirati conclusi; nessun host/browser, modifica o nuova suite completa.

## Correzioni del root

Tre difetti unici, corretti localmente senza riavviare review/deleghe:

1. La closure finita del movimento comprende i gruppi successivi il cui
   attacco diventa raggiungibile. Il controllo usa una copia ed esaurisce
   strutturalmente i gruppi già attraversati, conservando l'ordine fonte.
   Le alternative effettivamente irraggiungibili restano ammesse. Regressione
   RED→GREEN con spostamento precedente, assenza di spostamento e ordine inverso;
   stato originale interamente identico anche nel rifiuto.
2. Il ciclo completa i ritorni automatici senza opzioni prima di ripresentare
   la fase. Regressione RED→GREEN con due gruppi senza percorso: esaurimento,
   nessun packet, due ritorni e passaggio a oscurità esattamente una volta.
3. L'esplorazione forzata ha una variante strict
   `source-shadow-exploration-v1`: turno nullo ammesso soltanto con origine
   versionata, frame dell'Ombra e attacco causante. L'host risale anche i figli
   di provocazione e verifica capacità, fase, round e frame prima di muovere.
   I turni ordinari conservano il formato precedente con UUID obbligatorio;
   il comando pubblico non accetta un turno nullo. Regressione RED→GREEN su
   serializzazione/ripresa e vista senza entropia; origini assenti, estranee
   e cicliche rifiutate prima delle modifiche.

Aggiornato anche il riepilogo UI dei nuovi pack: non annuncia più le attivazioni
appena abilitate come indisponibili. Nessuna modifica dei vecchi pack o del seed
v2 al round1/Azione.

## Verifica indipendente

- **633/633 test**, zero fail/skip/todo; durata circa260s. Typecheck, formato,
  build finale e diff check verdi. La modifica finale di solo testo UI è stata
  compilata e ricontrollata senza ripetere la suite del motore.
- Sigillo: **1.106 file,901.750.712 byte**,37 file pubblici confrontati;
  SHA256 manifest `6502efe5b067fbaae25ca08f292967b8a7abe029d56416bca3328f549d76faa1`.
  Copie proprie con timestamp conservati; nessun helper eseguito nelle prove
  ricevute. Il primo probe di metadati cercava una consegna finale esclusa e
  assente: tentativo del verificatore, non prova del prodotto.
- Scenario ricompilato identico byte per byte; artefatto e certificati
  confrontati. Nove corpi IL ricatturati staticamente dalle primarie bloccate,
  con hash identici; nessuna esecuzione dell'app originale/Unity/JIT.
- Matrice83:12 popolazioni/130 elementi,258 riprese,213 insiemi bonus,
  13.694 packet/13.436 riduzioni. Nuova matrice:48 policy,480 bersagli,
  1.440 controlli di percorso,576 packet primari. Non certifica il RNG originale.
- Validatore ricompilato dai sorgenti integrati:58 backup UI, origine immutabile,
  intero payload delle otto coppie SIGKILL,13 restore,quattro sorgenti assenti;
  **241 backup storici** con stato e ricevute conservati. Ripetuto dopo le tre
  correzioni perché modificano controllo della fase e formato di esplorazione.
  Quattro backup alterati e risignati respinti anche dal validatore integrato.
- Script/input nativi esaminati: CDP DOM/Input/filepicker, Runtime osservativo,
  HTTP Node GET. Nessuna nuova accettazione UI costruita dal root. Ispezionate
  negazione/aggiunta320 e piazzamento1024; il vecchio ritorno320 conserva il
  testo poi corretto, la consegna successiva mostra il nuovo testo ma ritrae
  una riconnessione. Queste catture non provano assenza di errori di rete.
  Il log conserva4 risposte422 attese dalle alterazioni,318 connessioni
  rifiutate e67 richieste interrotte nelle prove di arresto/navigazione;
  nessuna eccezione runtime o errore console registrato.
- Privacy verificata su diff, untracked pubblici e storia dei commit:195
  identificatori/nomi fonte senza corrispondenze. Corpus, backup, IR/IL,
  associazioni e immagini restano ignorati. Prove del root in
  `.scratch/shadow-activation-root-review/`; report pubblico dell'implementatore
  [qui](../development/shadow-activations.md).

## Perimetro e ritorno alla versione precedente

La prova autentica arriva al primo turno del round4, dopo attivazione reale,
seguito25, collocazioni e tre Scoperte. Oscurità, P2, movimento primario e
interruzioni non sono raggiunti nel run autentico: fixture/matrici separate.
La compagnia posseduta non concede un attacco d'interruzione gratuito.

Il proprietario mantiene il blocco57 finché le quantità sono verificate.
Nessuna ipotesi5/5/5, filtro di candidati o assimilazione di dato ignoto a
riserva vuota. Restano indizi/altri incontri, soglie successive, conclusione,
campo/A2 e accettazione integrale33. Non è una partita completa.

Schema15, capacità facoltativa congelata prima dello startup. Il software
precedente rifiuta i nuovi pack/frame: dopo l'attivazione il ritorno richiede
un backup antecedente. Nessuna migrazione o consultazione del tavolo protetto;
host/browser/contesti dell'implementatore risultano chiusi. Root non ha avviato
un host UI.

Esito: Standards1 difetto corretto e1 giudizio facoltativo differito;
Spec3 difetti corretti. Nessun rilievo funzionale aperto per questo perimetro.
