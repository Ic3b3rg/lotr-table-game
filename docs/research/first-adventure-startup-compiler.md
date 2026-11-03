# Compiler e closure dello startup A1

3 novembre 2026, #38. Implementazione iniziata su `cba8ad5`, riallineata
localmente a `bc83b16` dopo PR59. Nessun originale, testo, FSM, IL o layout
è incluso in questo documento. Autorità: contratti principal/realizzato,
generatore/movimento e freeze53. I dati e gli script riproducibili sono nella
scratch ignorata del checkout, `.scratch/runtime/`.

## Ambito verificato

Sono distinti tre input: H3/seed1, compagnia UI53/seed-1065703788 e nuova
compagnia preparata dalla UI38/seed898554765. Rispettivamente22/21/22 caselle,
43/36/36 archi di movimento e15/14/15 assegnazioni. Nessuna equivalenza
Unity/JIT o generalizzazione a tutti i seed viene dichiarata.

La lettura bounded copre l'unione di28 prefab effettivi, principal e timer,
più le dipendenze gerarchiche dell'avventura. **463 oggetti / 2.154.210byte**,
letture complete C/Python e riferimenti qualificati verificati. Le gerarchie
scelte non aggiungono script/FSM figli, template o RunFSM. L'animazione non è
autoplay e i clip referenziati sono il singolo R625, senza eventi. Nessuna
app o FSM originale è stata avviata.

Il decoder strutturale normalizza38 FSM e484 azioni:484 hash di tipi correnti
verificati,178 caricamenti posizionali AddToLog→IgnoreLog,119 occorrenze di
binding risolte. Sono lette soltanto le due TextAsset italiane già identificate;
20 chiavi selezionate dai packet effettivi e dagli insert consumati. I flag
IsUsed serializzati non sopprimono gli insert richiesti dai placeholder.
Le57 implementazioni lifecycle/constructor selezionate sono ricatturate
dagli assembly originali; i contratti IL principal e #55 restano autorità
per OnEnter, coroutine e completamenti dei tipi riusati.

## Risultato del compiler

Il pacchetto privato compilato comprende30 definizioni,66 stati e38 azioni
eseguibili. Ogni azione è legata a tipo, indice e hash dei parametri effettivi;
ogni entry/edge proviene dal certificato strutturale.63 archi rinviati hanno
una capacità esplicita. Non costituiscono un executor di interazioni successive.
Il compiler respinge azioni omesse, hash alterati, handler senza fonte,
initialization asincrona non certificata e broadcast con ricevitori omessi.

Il contenuto eseguibile comprende initialization di tutti i prefab scelti,
il prefix principal e i PRE_REVEAL/REVEALED necessari ai tre input. Per la
UI53 il secondo nodo302A è81, con richiesta PLACE_SEARCH; non viene usato
il comportamento del123/H3. La nuova UI38 contiene due ulteriori nodi302A,
anch'essi risolti dalle azioni/packet effettivi. Nessun effetto fisico
obbligatorio è stato rilevato nel loro reveal precedente a obiettivo0.
I segnalini sono classificati dai campi GameNode effettivi insieme ai packet;
NodeType e Token3DType originali rimangono nel manifest. I nomi degli incontri
non determinano i loro effetti.

Il pack è riusabile per input compatibili, senza elenco di seed autorizzati.
Il binding verifica identità/fonti e ciascun prefab realizzato; un prefab
auditato soltanto per initialization non supera il gate se viene collocato
su una tessera che lo startup esplora e richiede hook ancora rinviati.
Nuovi input richiedono la stessa chiusura bounded prima dell'abilitazione.

## Semantica e limiti

L'executor distingue entry delle azioni in ordine, azioni sospese, popup,
ProcessingState e stopped. Anche gli stati senza azioni possono seguire
FINISHED, come richiesto dagli entry path fonte. L'esplorazione usa space
order, mentre l'initialization usa spawn order. Il ricevitore del timer non
dipende dalla visibilità; il BoolFlip deriva da un singolo effetto registrato.

La geometria usa i vertici dei mesh effettivi e i transform della proiezione,
con margine calcolato su tutti i poligoni. Gli ID hanno un mapping stabile;
gli archi sono soltanto movementGraph. La vista distingue visibile/esplorato
e conserva nascosti i nodi senza reveal. I testi diventano nodi DOM tipizzati,
con enfasi e nomi leggibili delle icone; non vengono interpretati come HTML.

Questa closure non certifica le interazioni dei28 prefab, tutti i373 prefab,
le quantità dei benefici, danni/paure/titoli, combattimento, Ombra o camp/ID2.
Il catalogo fisico revisionato di PR59 è disponibile per quei prossimi
incrementi; il prefix qui compilato non ne richiede l'executor.
