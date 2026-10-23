# Riferimento di fedeltà della scatola base — proposta

Proposta del 23 ottobre 2026 per [Fissare versione di riferimento e completezza dei contenuti](https://github.com/Ic3b3rg/lotr-table-game/issues/3). La decisione resta aperta. Il perimetro approvato rimane scatola base e campagna iniziale complete, interamente digitali, in italiano, con sessione locale e diorama 2.5D.

## Fonti da seguire

- **Regole e carte:** manuale italiano, Rules Reference ufficiale inglese dove manca il Compendio italiano, FAQ italiane 2.0 e carte corrette ufficiali. Applicare le correzioni esplicite alle carte interessate; registrare i conflitti fra fonti prima di scegliere un comportamento.
- **Campagna e automazioni dell’app:** installazione Steam del proprietario, **1.6.6#1128**, build **24301165**, Unity **2022.3.62f2**. È un riferimento identificato, senza assumere che sia la versione più recente o che ogni suo comportamento prevalga sulle regole.
- **Catalogo fisico:** workbook V1.10 fornito dal proprietario, JiME Cards DB e materiali ufficiali. Preservare originali, provenienza, edizione quando nota e anomalie. Il materiale Custom e le espansioni sono esclusi dalla base; Guardian 1 resta da verificare.

Impronte, percorsi e conteggi sono negli inventari di [fonti ufficiali](../research/official-source-inventory.md), [workbook](../research/card-workbook-inventory.md) e [app](../research/official-app-inventory.md). L’assembly di riferimento ha SHA-256 `8869ef87b7d49f4993911904e35d78b72f8339e91158bbe8784c9691a9d743c6`; il workbook `833edd0f9235d559253c6c0d43e61bcc0b5d955103bb2001e37a2e3ddef88ca4`.

## Cosa è verificato e cosa manca

La [matrice dei componenti](../research/base-component-coverage.md) distingue le undici famiglie e le **343 copie fisiche** da modelli, facce e riferimenti dell’app. Sono censiti sei eroi, sei ruoli, 78 modelli oggetto con quantità complessiva 83 e 44 facce delle 22 tessere viaggio. I dati dell’app non costituiscono da soli il catalogo completo delle carte.

Restano da riconciliare riferimenti e quantità delle abilità, associazioni di nomi degli oggetti, simboli e testi delle carte, molteplicità di alcune famiglie e quattro facce delle tessere battaglia. La ricerca indica per ciascuna voce quale verifica locale è possibile e quale materiale originale manca. Un nome irrisolto non viene trattato come carta assente; un ritratto o un’icona non viene trattato come fronte completo.

La [progressione della campagna](../research/base-campaign-routing.md) è ricostruita staticamente per le 14 avventure, con collegamenti ai prefab/FSM, biforcazioni e conclusioni anticipate. Non equivale ancora alla verifica di ogni evento, ricompensa, generazione della mappa o comportamento durante salvataggio e ripresa.

## Italiano delle carte: scelta da chiarire

**Proposta:** usare i nomi italiani dell’app quando l’associazione è verificata e tradurre fedelmente i testi inglesi disponibili, controllando numeri, simboli, condizioni e parole chiave contro le fonti e le errata. Conservare la provenienza per ogni campo; distinguere traduzione di lavoro e testo italiano originale verificato. Le incongruenze sostanziali rimangono aperte e non vengono riempite con effetti inventati.

Questa strada permette di sviluppare il catalogo italiano mentre prosegue il confronto con le carte originali. L’alternativa è utilizzare soltanto testi trascritti da originali italiani: le carte prive di quella fonte attenderebbero il relativo materiale. La scelta riguarda i testi; la fedeltà degli effetti e le verifiche rimangono richieste in entrambi i casi.

## Condizioni per dichiarare il risultato fedele

- Identità, copie, fronti/retri pertinenti, ranghi ed effetti riconciliati con il catalogo base e le correzioni applicabili.
- Regole collegate a fonti e casi di prova; nessun comportamento derivato dalle sole animazioni del prototipo.
- Prima avventura completa e poi percorsi della campagna confrontabili con l’app, comprese condizioni, esiti e casualità. Salvare e riprendere deve preservare anche lo stato dei componenti fisici digitalizzati.

Le prove runtime ancora necessarie sono registrate in [Definire le prove di fedeltà delle regole e della campagna base](https://github.com/Ic3b3rg/lotr-table-game/issues/7). La specifica e i ticket del motore seguiranno questa decisione e la matrice delle prove. Le lacune dei contenuti non impediscono di specificare importazione, identità e contratti del motore; impediscono di dichiarare già completo il gioco 1:1.
