# Nucleo del primo combattimento — verifica #77

4 novembre2026. Base `e198cc79c19708df7a26cd8e5205edec36ae65c5`, schema15,
baseline541. [Specifica](../planning/first-combat-kernel-spec.md) e
[piano](../planning/first-combat-kernel-plan.md) committati prima del codice;
[API e CLI](../development/first-combat-kernel.md). Esecuzione nel solo
checkout assegnato, senza delega, installazioni o scritture GitHub.
Review Standards/Spec e integrazione/merge al root.

## Risultato eseguito

`src/combat/` compila dati fonte verificati in un artifact privato versionato
e ne esegue il nucleo: spawn sulla posa congelata, disponibilità e budget
distinti, equipaggiamento/slot, colpi per figura, rimozioni, selezione nemica
e continuazioni tipizzate. La CLI esegue compile/verify/run/replay/capability.
Il journal ricostruisce piani, risultati fidati, spese, figure, casualità,
callback e receipt; confronta l'intero checkpoint, anche dopo manomissioni
coerentemente risignate del suo stato derivato.

Il compilatore conserva **46 stati /52 origini d'azione**. Non è un executor
di tutti quegli stati: le altre azioni conservano origine, parametri,
binding e proprietario necessario. Nomi narrativi e hash di una conclusione
semantica non determinano spawn o colpi. Le policy delle aggiunte sono
revisionate esplicitamente e legate ai loro campi/testi privati.

L'API legge il risultato di una prova già completata da una porta host
fidata. I comandi non accettano successi/colpi/salute/esito liberi. Gli slot
vengono pagati una volta con successi distinti; quelli residui non generano
colpi. Gli hook mancanti producono gate prima della spesa. La CLI usa una
porta dichiaratamente tecnica e riporta `gameplayAcceptance:false`.

**Queste esecuzioni verificano il nucleo con input fidati forniti.** Non
verificano una prova dal mazzo, le finestre del controller, il movimento
ordinario degli eroi o gameplay originale. Nella matrice privata le posizioni
degli attaccanti nella casella dello spawn sono precondizioni tecniche
esplicite, non viaggi eseguiti dalla UI.

## Evidenza pubblica e privata

| Verifica eseguita     | Risultato                                                                                                                                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TDD pubblico          | 26 nuovi test API/CLI su fixture inventate; RED→GREEN osservati per compiler, spawn/replay, spesa/applicazione, capability, CLI e budget del checkpoint.                                                                |
| Suite completa finale | **567/567**, zero fallimenti/skip; una sola esecuzione completa,109.872ms. Tutti i541 test precedenti conservati.                                                                                                       |
| Controlli repository  | `npm run typecheck`, `npm run format:check` e `git diff --check` passano. Nessuna modifica ai vecchi run/salvataggi o alle soglie di verifica.                                                                          |
| Provenienza ricevuta  | 41 input e236 artefatti,127.326.674 byte ricontrollati; copie proprie dai percorsi espliciti. Nessuna scansione globale delle scratch.                                                                                  |
| Primarie bounded      | 43 oggetti/380.406 byte,281 puntatori non nulli,6.994 parametri,30 binding;104 corpi IL/19.687 byte/7.208 istruzioni,703 salti e5 regioni di eccezione. Letture statiche, non esecuzione Unity.                         |
| Artifact reale        | 32 record nativi,46/52 origini,12 istruzioni;6 definizioni oggetto/7 copie equipaggiate/7 slot. Configurazione normale esplicita.                                                                                       |
| Spawn reale           | 4 casi: fresco, clamp, indisponibilità completa e carenza non dimostrata. Due barre da5, posa/source-map e riserva corretti; fallimento senza salvare l'aggiunta locale, carenza senza mutazione o riduzione inventata. |
| Spesa reale           | Tutte16 combinazioni dei sette slot sulle tre armi effettive; piano, residui, modificatori e checkpoint confrontati. Fixture inventate coprono anche difese, doppia spesa, copie estranee, zero colpi e hook mancanti.  |
| Istruzioni reali      | 23 selezioni: tutti12 candidati a size2 e tutti11 a size1, in ordine fonte; importi/negazioni/aggiunte e RNG materializzato confrontati. Il beneficio rimane nella popolazione e nella continuazione.                   |
| Rimozione e cause     | Figure2→1→0, singolo callback di gruppo, cause attacco/effetto esterno distinte; contrattacco/provocazione, Stordire, esaurimento, range, attaccante e interruzione conservati. Nessun premio/Lore applicato.           |
| Negativi privati      | 10 compilazioni strutturalmente invalide respinte; il checker della ricerca ripete anche16 corruzioni dei dati. Sono controlli di dati/nucleo, non26 partite.                                                           |
| CLI reale             | Artifact identico byte per byte all'API; checkpoint/replay identici. Eseguiti percorso verso istruzione fisica, callback del gruppo e candidato con beneficio. Capability originale con exit2 e `runtimeReady:false`.   |

Il checker separato non importa compiler, kernel o adattatore per produrre
l'atteso: rilegge byte nativi, CSV italiani e righe OOXML selezionate, poi
calcola budget, barre, slot e selezioni. La rilettura dei binding/IL usa la
copia propria adattata del checker75. Le annotazioni delle capacità non
diventano autenticazione editoriale grazie a un hash; i fingerprint attesi
devono essere fissati dal futuro loader del pack verificato.

La CLI di replay non richiama la porta per i risultati già acquisiti.
L'istruzione è materializzata anche quando il successivo range impedisce
il contrattacco. Nessuna equivalenza della sequenza Unity è asserita.

## Hash, prove e riproduzione

Prove nella sola scratch ignorata di questo checkout:
`.scratch/first-combat-implementation/`. Il README privato distingue le
prove accettate in `cli/` dalle prime catture superate. Le identità int64
delle TextAsset sono conservate esattamente; non passano attraverso un
arrotondamento JavaScript. Narrativa, carte, associazioni e artifact/FSM/IL
rimangono fuori da Git, anche nella storia.

| Identità             | SHA256/fingerprint                                                 |
| -------------------- | ------------------------------------------------------------------ |
| Manifest ricevuto75  | `b9fe2063f8d8f3bade8211d321c5164d5970859b57e837b569561347267c6bc7` |
| Source kernel        | `126be3b8e443fd08e39609430872e379de5c569ec1475697198143ad9341c772` |
| Artifact kernel      | `8dfea00c31dae2d58b1ef76cd36cc85ba6f0bbcced905c60b218360670b720b8` |
| Proiezione congelata | `e4fc8095cc93a23d4fa60457f7570df7d91c780d6e640da102b7ab44a60d7859` |
| Sigillo proprio      | `65929228b87460e8985e97cbcebb1ed0533911279797e176dc672980398ea94c` |

Il sigillo proprio comprende275 file/144.281.843 byte e ricontrolla i41
input originali; esclude soltanto sé stesso e il receipt finale, per evitare
autoriferimenti. Il receipt esterno lega questo report al commit finale.
Le fonti e i sigilli altrui rimangono immutati.

```sh
node --test tests/combat-*.test.mjs
PYTHONDONTWRITEBYTECODE=1 /Users/silvioceccarini/.t3/projects/lotr-interactive-table-game/.scratch/unity-audit-venv/bin/python .scratch/first-combat-implementation/check-primaries.py
PYTHONDONTWRITEBYTECODE=1 /Users/silvioceccarini/.t3/projects/lotr-interactive-table-game/.scratch/unity-audit-venv/bin/python .scratch/first-combat-implementation/check-kernel.py
python3 .scratch/first-combat-implementation/verify-own-seal.py
```

I produttori `build-source.mjs`/`exercise.mjs` scrivono soltanto nella propria
scratch. I comandi CLI completi sono nel documento API; scegliere nuovi file
di output per rispettare la pubblicazione esclusiva. La suite comprende
le regressioni HTTP già presenti. Nessun host/browser per accettazione UI,
app originale o accesso al tavolo protetto è stato usato per questa issue.

## Gate e seguito concreto

`kernelReady:true` abilita solo il sottopercorso tecnico. Il combattimento
originale mantiene `enabled:false` e `runtimeReady:false`: mancano controller
prove/finestre, agganci persistenti, adattatore delle conseguenze/P2,
proprietario scenario/ledger/ricompense e UI. Ombra e conclusione restano
gate quando raggiunte. Il kernel non consuma una continuazione attraverso ACK.

L'app corrente e i pack/salvataggi pubblicati non ricevono nuove capacità
retroattive. Le quantità dei benefici5/5/5 restano non confermate, senza
filtrare il candidato o chiedere di nuovo al proprietario. #33/#65/#57
rimangono aperte. Nessuna accettazione UI o partita completa è dichiarata.

Il prossimo incremento può collegare il controller delle prove reali a
`planAttack/applyPlan`, riusare il consumer fisico esistente per `physical`
e consegnare `scenario-callback` al proprietario della logica. Quelle
operazioni e il checkpoint dovranno entrare nel ledger/Store.once ordinario
prima di abilitare persona o attacco e pagare costi di gioco.
