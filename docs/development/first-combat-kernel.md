# API e CLI del nucleo di combattimento

Issue77 aggiunge una libreria Node e una CLI offline. L'app schema15 conserva
i propri gate e salvataggi. Il modulo non esegue persona, prove con carte,
finestre, conseguenze fisiche/P2, scenario o Ombra. Non abilita il
combattimento originale e non completa33/65/57.

## Interfaccia

La build produce `dist/combat-library.mjs` e `dist/combat.mjs`.
L'interface pubblica espone sei funzioni:

| Funzione                                                   | Contratto                                                                                                                           |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `compileCombatSource(source)`                              | Compila record fonte verificati nel formato `combat-source-v1`; restituisce l'artifact privato `combat-artifact-v1`.                |
| `verifyCombatArtifact(artifact, expected?)`                | Ricompila e confronta tutto l'artifact. `expected` può fissare `fingerprint`, `sourceFingerprint` e `projectionFingerprint`.        |
| `combatCapability(artifact, request)`                      | Preflight in sola lettura per `kernel`, `original-person` o `original-attack`, con eroe, hook richiesti ed eventuale confine Ombra. |
| `createCombatKernel(artifact, seed, trustedPort?)`         | Inizializza il nucleo da compagnia/proiezione compilate e contesto host fidato.                                                     |
| `restoreCombatKernel(checkpoint, expected?, trustedPort?)` | Ricostruisce il journal e confronta stato, prove, piani, ricevute e selezioni. `expected` fissa artifact/proiezione.                |
| `kernel.checkpoint()`                                      | Esporta il checkpoint privato completo; è un metodo del kernel, insieme ai comandi descritti sotto.                                 |

Il kernel offre `spawn`, `planAttack`, `applyPlan`, `applyExternal`, `provoke`,
`view` e `checkpoint`. `view` e checkpoint sono interfacce private dell'host,
non proiezioni da inoltrare direttamente ai telefoni. Tutte le uscite sono
copie difensive. L'host futuro dovrà salvare checkpoint, continuazione e
receipt nella stessa Store.once del controller.

```ts
const artifact = verifyCombatArtifact(savedArtifact, pinnedSource);
const kernel = createCombatKernel(artifact, trustedHostSeed, {
  attackResult(query) {
    return completedTests.requireBoundResult(query);
  },
  externalEffect(query) {
    return sourceEffects.requireBoundResult(query);
  },
});

kernel.spawn({ id: sourceEntryId, spawnId: artifact.compiled.spawns[0].id });
const planned = kernel.planAttack({
  id: attackId,
  heroId,
  itemCopies,
  stat,
  slots: selectedPrintedSlots, // soltanto {copyId, slotId}
});
if (planned.status === 'planned') {
  const result = kernel.applyPlan({
    id: applicationId,
    planFingerprint: planned.plan.fingerprint,
  });
  // Il proprietario indicato dalla continuazione deve ancora eseguirla.
}
```

La porta fidata legge risultati **già completati**, senza pagare costi né
pescare durante questa lettura. La risposta è legata a query, artifact,
proiezione, eroe e caratteristica. Contiene identità distinte dei successi,
posizione/sconfitta dell'attaccante dopo le finestre della prova e hook
ancora necessari. Il fingerprint della query usa la canonicalizzazione
condivisa in `src/map-freeze/hash.ts`. Il kernel verifica questi legami;
l'autenticità del risultato compete al controller host. Il client non può
fornire successi, colpi o salute nei comandi del nucleo. La porta non è
esposta da alcuna route HTTP di questa modifica.

Oggetti, copie, caratteristica e slot sono verificati prima della lettura
del risultato. Gli slot selezionati ricevono successi distinti in ordine;
ogni slot stampato è utilizzabile una sola volta. I successi residui non
generano colpi. Il piano non modifica le figure; l'applicazione usa soltanto
il suo fingerprint. Un risultato già usato non può finanziare un altro
attacco. Gli hook non implementati restituiscono un gate, senza spesa.

`applyExternal({id,effectId})` consulta una porta host distinta, che possiede
fonte, quantità e modificatori dell'effetto già determinato. Il comando non
accetta un numero di colpi. `provoke({id,heroId,returnTo})` conserva la
continuazione del movimento/interazione ed esamina stato e casella del
gruppo; non esaurisce il gruppo.

Ogni intento ha un ID stabile. Retry identico restituisce la receipt;
riuso dell'ID con payload diverso fallisce. Anche i limiti del checkpoint
sono verificati prima della mutazione. Il ripristino riusa i risultati
materializzati e non richiama la porta per gli intenti già registrati.

## Fonte e limiti

Il source JSON conserva file/hash, record nativi, object hash, parametri
effettivi, variabili, transizioni, origini, righe oggetto e localizzazioni.
Il compiler deriva spawn, catena GO/Tile/Spaces, statistiche, costi, slot e
istruzioni dai campi. Le aggiunte in linguaggio naturale hanno policy
private esplicite, legate alla chiave e all'hash del testo revisionato;
non sono codice dedotto automaticamente dalla prosa.

Il manifest dichiara configurazione normale e prove delle tre meccaniche
bounded. Una sola famiglia nemica, gruppi fino a3 figure, nessuna variante
named/unique/linked, bonus o arma a distanza in questo incremento. Per le
difese sono supportati Perforante e Stordire; altri modificatori non hanno
un fallback. Record fonte nativi non consumati rimangono dati inerti.
Le altre azioni del slice hanno proprietari espliciti e non vengono eseguite.

Si riusano limiti e guardia JSON del catalogo fisico:8MiB,100.000 nodi,
profondità24 e stringhe fino a16.384 caratteri. I contratti del modulo sono
strict; accessor, prototipi non JSON, cicli, array sparsi e valori non JSON
sono rifiutati prima della lettura dei campi. Journal fino a1.000 intenti,
entro lo stesso budget totale; eccedenza senza registrare metà risultato.

Hash e ricompilazione controllano integrità e coerenza, non autenticità
editoriale. L'ingresso produttivo dovrà fissare i fingerprint attesi dal
pack verificato. Il checker privato separato confronta i record con byte,
binding, CSV e righe OOXML primari senza importare l'algoritmo del prodotto.
Nessun file fonte viene aperto dal compiler attraverso un locator del JSON.

## Continuazioni e capability

Il risultato distingue `source-event`, `physical`, `after-attack`,
`external-complete`, `provocation-skipped`, `resume-activation` e
`scenario-callback`. Una continuazione fisica conserva causa, destinatario,
importi, negazione, aggiunta, dipendenze e ritorno. Non esiste un ACK che
la completi. Il kernel sospende nuovi comandi quando occorrono il consumer
fisico, quello scenario o la ripresa dell'attivazione.

Il callback di gruppo viene emesso una sola volta dopo l'ultima figura;
conserva causa e logica destinataria. Nessun premio o Lore è applicato dal
nucleo. La sconfitta di una sola figura non emette il callback di gruppo.

La selezione usa `combat-enemy-sha256-rejection-v1`, stream
`enemy-instruction`: popolazione ordinata dalla fonte, dimensione corrente,
indice, identità/hash e cursore materializzati. È separata da mappa e fisica,
senza certificazione della sequenza Unity. L'istruzione viene conservata
anche quando il successivo controllo di distanza impedisce il contrattacco.
Il destinatario del contrattacco è sempre l'attaccante.

`kernelReady` indica le primitive compilate. `enabled` può essere vero per
il solo sottopercorso `kernel`; `runtimeReady` resta falso. Per il gioco
originale sono espliciti controller prove/finestre, persistenti, fisica/P2,
scenario e benefici57; Ombra e perdita quando raggiunte. Il candidato con
beneficio rimane nella popolazione. Le quantità5/5/5 sono ancora non
confermate: il kernel non le inventa e non riapre la domanda al proprietario.

## CLI

Gli output sono nuovi file privati0600, pubblicati atomicamente senza
sovrascrittura. Exit0 indica esecuzione tecnica riuscita,2 un gate con
output conservato,1 input/comando non valido. Nessuna installazione o host.

```sh
npm run build
node dist/combat.mjs compile --input source.private.json --output artifact.private.json
node dist/combat.mjs verify --input artifact.private.json --output verification.private.json
node dist/combat.mjs run --artifact artifact.private.json --input run.private.json --output checkpoint.private.json
node dist/combat.mjs replay --input checkpoint.private.json --output replay.private.json
node dist/combat.mjs capability --artifact artifact.private.json --input request.private.json --output capability.private.json
```

Il run dichiara `format:combat-technical-run-v1` e una porta
`technical-fixture-v1`. Contiene seed, risultati completati forniti per ID,
effetti esterni tecnici e comandi. Il comando CLI di applicazione riferisce
il `planId` precedente; il suo fingerprint viene ricavato dal piano reale.
Il formato è definito in `src/combat/technical-run.ts`; una fixture completa
inventata è esercitata da `tests/combat-cli.test.mjs`.

Lo stdout del run dichiara `evidence:technical-adapter` e
`gameplayAcceptance:false`. Un run con dati originali conserva lo stesso
limite: prova il nucleo con risultati fidati forniti, non la pesca reale,
il controller, la fisica o una partita originale giocabile dalla UI.
