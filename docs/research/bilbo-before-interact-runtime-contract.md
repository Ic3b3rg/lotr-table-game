# Bilbo prima di interagire: contratto della fonte e del consumer

Ricerca per [#135](https://github.com/Ic3b3rg/lotr-table-game/issues/135), 7 novembre 2026, sul commit **4a3b867c93ef538607b71b84cf9dd1721931f2ab**, schema 31. La capacità è attestata; manca il consumer che esegue il look e la ricompensa nella vera interazione. Questo documento non implementa quel consumer e non chiude #135, #33 o #65. Le quantità originali di #57 restano **NULL / UNVERIFIED / BLOCKED** e il checkpoint originale 156 resta **STATIC / GATED**.

**Esito:** implementare una lettura privata, senza spostamento, nel kernel fisico esistente e legarla a un solo impegno d'interazione. Conservare la scelta dell'ordine fra effetti simultanei. Non usare la carta nascosta per decidere pubblicamente se offrire o accettare l'interazione. Quando la prosecuzione dipende da un possibile premio non ancora noto, oppure non esiste alcuna carta disponibile, occorre un gate circoscritto prima dell'impegno; le fonti lette non autorizzano un rimedio inventato. I casi ordinari hanno un contratto implementabile; i casi combinati sotto non possono essere dichiarati risolti da un ordine fisso.

## Autorità e perimetro delle prove

**E** indica una fonte letta; **I** una deduzione o scelta della trasposizione digitale; **U** un punto che le fonti consultate non chiudono. Le pagine sono quelle stampate. Il workbook e le annotazioni private sono dati forniti, non pubblicazioni ufficiali: la verifica del catalogo non trasforma una traduzione in una carta italiana ufficiale.

| Sigla | Fonte e verifica |
| --- | --- |
| B | [Immagine ufficiale FFG con la carta eroe Bilbo][B], collegata dal [prodotto FFG, esempio della prova][P]. PNG scaricato il 7 novembre 2026: **648693 byte**, SHA256 **971f76e5a813f7f2be1869232a41c08945579b0e9ea9b1bb0b76ccc7cdb29783**; fronte letto visivamente. È una carta inglese primaria, non una trascrizione comunitaria. |
| R | [Rules Reference EN, supporto FFG attuale][R], 32 pagine. **1153490 byte**, SHA256 **f94dfcf5d5118b7fedadb3634edf41fefb97975c1f0732caa8d4519e9a89a260**. Il nuovo download coincide byte per byte con il PDF fornito. Testo pertinente letto; render selezionati delle pagine 2, 6, 16, 20, 21, 31 e 32, con controllo visivo delle pagine 16, 21 e 32. |
| F | [FAQ EN 2.0, 28 luglio 2021][F], entrambe le pagine lette dal supporto FFG corrente. **8633628 byte**, SHA256 **a7495b1d519b862786b8086bd0dbcaf0c3ce9faa4f87fc7aae7697d3a38a546a**. La data di caricamento CDN del 2026 non è una nuova edizione delle regole. |
| FI / C | [FAQ IT 2.0, 10 novembre 2021][FI] e [carte corrette IT][C], testi completi forniti. SHA256 **f9ab990fbb8ddb74e037806adb3692ba1245442389af2c9d8f277aff1b46962e** e **686b5f041f6af042b5fc78ef34996d69d61c3e634c39e6bd2219c60fd088da32**. |
| W | Workbook fornito V1.10, **610648 byte**, SHA256 **833edd0f9235d559253c6c0d43e61bcc0b5d955103bb2001e37a2e3ddef88ca4**. Lettura OOXML indipendente di `Characters!13`, in particolare `M13` e `J13`, e della riga pertinente in `DamageFear`; nessuna formula eseguita. |
| K | Codice di questo checkout alla base indicata sopra. Le funzioni collegate sotto sono state soltanto lette: nessun gameplay, FSM o IR originale eseguito. |

R p.2 stabilisce la precedenza sulle istruzioni introduttive, la precedenza delle carte nei rispettivi casi e il carattere assoluto di un divieto. F/FI rimuovono R §1.3: non usare quella vecchia restrizione sulle capacità multiple per imporre un ordine. Nessuna correzione di Bilbo compare nelle FAQ 2.0 e nelle carte corrette lette. [E, R p.2; F/FI p.1; C fogli 1-2.]

L'unico input privato esterno al checkout è la capsula autorizzata: manifest **3243 byte**, SHA256 **66debc84fd7c545e684e0594154c1be5df35022c164ddee6ca6a548c07720195**; **15 file / 54672692 byte**. Ogni riga è stata verificata come file ordinario, relativo, senza traversal o symlink, con dimensione e SHA256 corrispondenti, prima dell'analisi del contenuto. I path storici annidati sono rimasti dati. Originali, estratti, immagini, associazioni e registri delle acquisizioni restano ignorati; nessuno viene pubblicato qui.

Le ricerche ufficiali mirate non hanno fornito una risposta specifica alla combinazione Bilbo/provocazione/costo non pagabile o al mazzo realmente senza carte. L'articolo storico FFG “Become Legend” è ancora indicizzato, ma il suo URL reindirizza oggi all'indice delle notizie; il dominio drafts non era raggiungibile. Non è stato usato come prova del testo della capacità. I tentativi falliti, compresi il problema TLS del lettore Python e il primo limite di download della FAQ, sono conservati nelle prove private; i download riusciti usano TLS verificato.

## Capacità attestata e confine della vera interazione

**E:** il fronte B e W concordano: prima di interagire Bilbo deve guardare la carta superiore del proprio mazzo; la presenza dell'icona fato dà **1 ispirazione**. Il testo non concede una scelta di usare la capacità, non aggiunge un costo e non contiene un limite per round. La carta eroe mostra limite d'ispirazione **6**, coerente con `Characters!J13`. La restrizione di una mano è già `catalog.maxHands` e non richiede un secondo sistema. [B; W `Characters!M13/J13`; R §45.3, p.16.]

**E/I:** verificare l'icona fato stampata sulla carta abilità, non il suo titolo, la sua prosa, il numero di ispirazioni possedute o il risultato di una prova. Un'icona presente dà il premio una sola volta; un'eventuale quantità maggiore di icone non moltiplica il premio. Nessuna icona significa nessun premio. Una carta guardata non diventa preparata e non si risolve la sua capacità testuale. [B; R §§1.1, 38.1-38.3 e 69; F/FI p.2, fato distinto dall'ispirazione.]

**E:** al limite il premio non viene ottenuto; la lettura resta dovuta. Non accumulare credito oltre il limite e non rinviare quel premio a una spesa successiva. [B; R §48.2, p.16.]

**E:** selezionare un segnalino per leggerne il prompt non equivale a interagire. R §8.1 permette la consultazione; §49.2 distingue il pulsante con icona interazione dal pulsante per rinunciare. L'interazione vera richiede un effetto che la autorizzi, la posizione corretta e la scelta del pulsante impegnativo. Anche un'interazione concessa da una capacità può avere gli stessi effetti senza essere un'azione aggiuntiva. [R §§2.1-2.3, p.6; §8.1, p.7; §§49.1-49.4, pp.16-17.]

**I / requisito #135:** nel consumer A1 autorizzato il trigger appartiene all'impegno valido `INTERACT_SCENARIO`, non all'apertura/chiusura del dialogo, a Escape, a un refresh o a una scelta gratuita successiva della stessa fonte. Una singola interazione risolve la capacità una volta; due interazioni vere possono risolverla due volte, anche nello stesso round. L'acknowledgement del look completa quel trigger, non lo attiva di nuovo. Se la prosecuzione non modifica il mazzo, una seconda interazione può legittimamente incontrare la stessa carta superiore: non occorre rimescolare per cambiare esito.

## Ordine, provocazioni e costi concorrenti

**E:** le capacità “prima” si risolvono immediatamente prima dell'evento. Per capacità simultanee decide il gruppo; R p.2 estende la regola agli effetti simultanei in generale. La scelta dell'ordine dei gruppi nemici da provocare prima dell'interazione spetta invece all'eroe che interagisce. Ogni gruppo pronto pertinente deve essere risolto prima dell'interazione; un gruppo esaurito non può essere provocato. Le conseguenze dell'attacco e i figli obbligatori devono terminare prima del ritorno. [R p.2, §§1.12/1.15, p.6; §35.4, p.14; §49.3, p.16; §71.3, p.21.]

**I:** applicare la regola generale di simultaneità agli effetti che condividono questo confine; le fonti non prescrivono “Bilbo sempre primo”, “spesa sempre prima” o “provocazione sempre prima di ogni capacità dell'eroe”. Per la coppia Bilbo/provocazione questa è una deduzione dalle finestre e da R p.2, non una FAQ specifica ritrovata. Non convertire l'ordine attuale del controller in una regola ufficiale. Se il consumer non sa conservare una scelta di ordine materialmente rilevante, quel caso combinato resta gated.

**E:** il costo attestato nella capsula è su una carta **danno** scoperta, non paura: W `DamageFear!A6:C6` identifica Dazed e richiede una spesa d'ispirazione prima di interagire con una **minaccia**. Il testo è confermato anche dal raw/matrice forniti, la cui attestazione dei fronti è pregressa e non è stata riacquisita. Non estendere quel costo a ogni segnalino o a ogni carta paura. Gli esempi con una paura inventata che abbia lo stesso effetto sono validi come fixture, non come prova di una carta originale. [W; capsula fisica verificata; R §§1.5-1.8, p.6.]

La concorrenza cambia concretamente il risultato:

- Con 6 ispirazioni, fato superiore e spesa obbligatoria di 1: look prima della spesa lascia **5**; spesa prima del look lascia **6**. Entrambi gli ordini pagano la spesa. Imporre uno dei due perde una scelta del gruppo.
- Con 1 ispirazione e la stessa spesa: entrambi gli ordini sono finanziabili anche se la carta non ha fato. La spesa è distinta dal premio, e resta obbligatoria quando applicabile.
- Con 0 ispirazioni: la spesa per prima non è pagabile; look per primo potrebbe finanziare la spesa soltanto nel ramo fato. Le norme generali permettono di scegliere l'ordine delle capacità, ma non forniscono una procedura specifica per questo tentativo con lettura nascosta e costo eventualmente impossibile.

**U:** non è stata trovata una norma primaria che autorizzi a conservare un bonus gratuito, a restituire i costi, a ripetere il look, a scegliere un'altra carta o a dichiarare completata l'interazione quando il suo prerequisito non è stato risolto. Neppure il testo delle FAQ sugli eroi sconfitti definisce una regola universale per un costo non pagabile. Se una provocazione può interrompere il tentativo dopo un look anticipato, va dimostrata la prosecuzione legale e il trattamento del trigger già risolto; non basta un nuovo booleano “completato”. Non inventare un rimborso retroattivo o un'assegnazione tardiva che cambi le risorse disponibili durante i figli. Questo limite non autorizza a eliminare gli ordini leciti nei casi non problematici.

## Preflight senza oracolo sulla carta nascosta

Questa sezione è un **requisito della trasposizione digitale / #135**, non una nuova regola cartacea.

Prima di azioni, costi, entropia o informazioni private, verificare l'intero seguito fonte, i figli obbligatori, le capacità e riserve necessarie, attore, casella, copia, round/turno, richiesta, revisione e generation. La verifica deve essere indipendente dall'identità/fato effettivi della carta superiore. Eseguire una prova mutabile su una copia dello stato non la rende innocua se il suo esito pubblico dipende dalla carta segreta.

Nel caso 0 ispirazioni + spesa di 1, accettare soltanto quando la cima ha fato rivelerebbe quell'informazione prima del look. Offrire il look in entrambi i casi e fallire soltanto dopo averlo mostrato non soddisfa il preflight richiesto. Far ottenere il premio, lasciare annullare e riprovare crea inoltre un bonus per un'interazione che non avviene.

**I, scelta conservativa implementabile:** verificare obblighi e ordini senza fare affidamento su un premio condizionale nascosto. Se non esiste una prosecuzione attestata per tutti gli esiti ancora ignoti, presentare lo stesso gate di capacità in entrambi gli stati, prima di impegno/look/reset/costi; conservare lo stato identico. Questo è un limite esplicito del consumer, non la pretesa che la carta vieti ogni possibile interazione da 0 ispirazioni. Un altro effetto garantito e già disponibile può cambiare la fattibilità: un semplice confronto iniziale “ispirazioni >= somma costi” non è una soluzione generale.

Un ordine che si offre deve restare eseguibile con le risorse della sua finestra. Non scegliere prima l'esito favorevole di un test/provocazione o una permutazione favorevole per far passare il preflight. Un fallimento di prova è un ramo del gioco, non un motivo per ripetere l'interazione. Eventuali gate #57 e altre closure mancanti restano operativi.

Le offerte, i motivi di rifiuto, gli identificativi e le impronte pubbliche non devono diventare una prova indovinabile dell'identità della cima. Il cambiamento d'ispirazione dovuto a una capacità effettivamente risolta è un esito di gioco; non giustifica un oracolo anticipato nella disponibilità del comando.

## Mazzo vuoto e identità della carta

**E:** R §76.1 impone il reset quando non rimangono carte nel mazzo: rimescolare gli scarti per creare il nuovo mazzo. Il reset esplicito può anche rimescolare un mazzo non vuoto; questo non rende ogni look un reset esplicito. Le preparate non rientrano nel mazzo. **I locatori corretti nella copia verificata sono p.21 per §76.1 e p.32 per la consultazione rapida**, non p.20/p.31. [R §76, p.21; “Resetting Skill Decks”, p.32; render letti.]

**I, contratto:** se il mazzo è vuoto e ci sono scarti, applicare il reset ordinario una sola volta attraverso la casualità già registrata del kernel, poi guardare la nuova cima. Se il mazzo contiene già una carta, leggerla senza shuffle, prelievo o reinserimento. In particolare, guardare l'ultima carta non svuota il mazzo e non autorizza il reset degli scarti.

Il look conserva **copia, zona e intero ordine** di mazzo/scarti/preparate. Non è Scoperta 1, non permette riordino, preparazione o scarto, non è una prova e non consuma un'icona fato. Non deve usare `reveal()` per poi rimettere la carta: quel metodo può eseguire il refill dopo il prelievo dell'ultima carta. [B; R §§38/69/76/81; K `FrontReplay.reveal/scout`.]

**U / gate circoscritto:** con mazzo e scarti entrambi vuoti, il reset non crea una carta. Nessuna fonte letta fornisce una sostituzione per il look di Bilbo in questa condizione. Non prendere carte preparate, carte trattenute da un figlio o carte di altri eroi; non creare una carta né concedere automaticamente il premio. Se le carte sono temporaneamente in un test/Scoperta figlio, prima deve tornare quel figlio: non aprire una seconda interazione concorrente e non sottrargli le carte. Se dopo il ritorno nessuna carta è disponibile, il consumer deve conservare un gate esplicito, senza spese, entropia o nuova informazione. L'eventuale futura regola per questo stato richiede una fonte aggiuntiva.

## Seams esistenti e incremento minimo proposto

Questi sono **fatti K e proposte I**, non un'implementazione già presente.

| Punto attuale | Conseguenza per l'implementazione |
| --- | --- |
| [`createEncounterInspection`](../../src/client/encounter-inspection.ts) apre/chiude il dialogo senza comando; `submitChoice` emette l'impegno. | Mantenere il look fuori dall'ispezione. Sostituire anche il semplice controllo client dei costi con l'offerta autorevole della nuova capacità; il client non deve valutare la cima. |
| [`interactScenario`](../../src/scenario/runtime.ts), riga 2142 alla base: convalida fonte/attore/posizione/azione e visita il seguito prima di incrementare `actionsUsed`. Il controllo d'ispirazione corrente precede il parent. | Conservare la barriera, estendendo il piano dei costi concorrenti. Il solo controllo iniziale attuale non modella un premio prima della spesa. Non far partire una lettura da un comando rifiutato. |
| [`encounterProgram` / `beginEncounterPhysical`](../../src/scenario/encounter-physical.ts) emettono già `event: before-interact` per conferma e scelta impegnata; il task fisico sospende il callback fonte. | Estendere questo confine una volta per impegno, con policy eroe e obblighi attivi ordinabili. Il callback di conferma/scelta attende il completamento; le scelte gratuite successive non ripetono la capacità. |
| [`PolicyEffectSchema` / `compilePhysicalFronts`](../../src/physical-resolution/front-program.ts) supportano già `kind: hero` e vincolo alla definizione; [`FrontReplay.policy/event/eventEffect`](../../src/physical-resolution/front-runtime.ts) risolvono policy e persistenti. | Aggiungere un effetto tipizzato prospettico per il puro look e il premio automatico, legato a identità e prove congelate. Niente dispatch dal nome/prosa e niente programma scelto dal client. Riutilizzare `inspiration()` per il cap; non riutilizzare `scout()`. |
| [`canResolveAlternative`](../../src/physical-resolution/front-feasibility.ts) pianifica obblighi noti senza rivelare conseguenze; il source probe visita i rami su copie. | Estendere la fattibilità del confine con obblighi e disponibilità garantiti. Validare soltanto lo schema di un programma non dimostra l'assenza di gate futuri o di dipendenze da informazione nascosta. |
| [`executeEpisodeIntent` / `resumeProvocation`](../../src/server/physical-cycle.ts) conservano l'intento interaction durante la provocazione; [`nextProvocation`](../../src/combat/controller.ts) sceglie attualmente il primo gruppo in ordine di deployment. | Serve una continuazione tipizzata del prima-interazione che conservi l'ordine scelto e i figli conclusi, revalidi dopo i figli e riprenda una sola fonte. L'ordine corrente non prova la scelta dell'eroe richiesta da §49.3. Non aggiungere un secondo journal. |
| [`PhysicalDecisionSchema`, programmi/risultati](../../src/shared/physical.ts), [`CyclePendingSchema`](../../src/shared/physical-cycle.ts), [`CombatOperationSchema`](../../src/shared/combat-controller.ts) e [`FrontSnapshotSchema`](../../src/physical-resolution/front-state.ts) hanno richieste e parent persistenti. | Estendere soltanto i tipi necessari per look privato, ordine e ritorno dell'interazione. Se il prelude vive nel ledger ordinario, il pending deve rappresentare anche quel ritorno; attualmente non include `INTERACT_SCENARIO`. Un ack non attesta manualmente fato o premio. |
| [`physicalView`](../../src/physical-resolution/view.ts) clona active e parents; [`publicSession`](../../src/server/store.ts) alimenta la sessione comune e [`main.ts`](../../src/server/main.ts) serve `/api/session` anche senza identità. | Non mettere il fronte guardato in un normale active/options, `revealed`, risultato o receipt pubblico. Occorre una proiezione autenticata del solo proprietario, oppure un canale privato di lettura legato alla stessa richiesta, con messaggio neutro nella sessione comune. Nascondere il DOM degli altri non basta. |
| [`Store.once`](../../src/server/store.ts), replay/validazione del [`physical-cycle`](../../src/server/physical-cycle.ts) e dell'[`episode-state`](../../src/server/episode-state.ts) ricostruiscono storia e ricevute dalla fonte. | Registrare ordine, look, reset, delta capped e ritorno nello stesso ledger e nella stessa transazione del comando. La restituzione per retry deve conservare la ricevuta intera. Confrontare gli output ricostruiti anche dopo restore; due registri risignati che concordano non costituiscono una prova. |

La superficie più piccola è dunque una **policy eroe prospettica + lettura privata non distruttiva + continuazione del confine già esistente**. La continuazione conserva il vero intento, l'effetto fonte, l'ordine residuo, il figlio in corso e la prova degli effetti già risolti; non è un nuovo motore di artifact. Conservare anche il viaggio residuo: l'interazione interrompe i movimenti secondo le regole, non li cancella. [R §108.2 come corretto da F/FI; ADR [0002](../adr/0002-salvataggio-e-conferma-delle-azioni.md) e [0003](../adr/0003-registro-ordinario-e-fonte-dell-incontro.md).]

**Provenienza da correggere nel nuovo freeze:** l'hash della definizione eroe nell'annotazione privata delle finestre non coincide con la definizione del catalogo fornito. La capacità e l'identità sono corroborate da B/W, ma quel digest non può essere copiato in una nuova policy come se validasse il catalogo corrente. Non si conosce da questi input l'origine della differenza. Ricalcolare e attestare il vincolo dalla definizione esatta corrente, conservando i due valori e il confronto nelle prove private; non alterare gli artifact storici per farli combaciare.

Il nuovo comportamento richiede una capacità/schema prospettici espliciti, con prove e definizioni congelate prima dell'avvio. Alla base lo stato è schema 31: la successiva versione va scelta nell'implementazione. I run e i pack storici conservano i propri validatori e il proprio replay. La nuova capacità non va inferita dalla semplice presenza della traduzione nel catalogo.

Il perimetro A1 è definito da [`playableScenarioPrefab`](../../src/shared/clues.ts): interazione iniziale abilitata, indizi, covo, prodotti base, oggetto, primo combattimento, ricerche, segnalini minaccia e luoghi collegati. Tutte le conferme e scelte impegnative di queste famiglie devono attraversare il confine una volta; non soltanto un prefab dimostrativo. Non scambiare una conferma di esplorazione o un messaggio successivo per un'altra interazione. I consumer di incontri A2 non compilati restano gated.

## Accettazione mirata da consegnare all'implementer

I positivi usano fixture inventate. Questa ricerca non esegue suite/build invariati né prove originali.

1. **Confine e quantità:** apertura/cancel/Escape/refresh non cambiano carte, ispirazione, azioni o entropia; comando vero con fato/non fato dà rispettivamente 1/0, con reward 0 al cap. Due vere interazioni sono due trigger; retry/ack duplicato dello stesso impegno è uno.
2. **Conservazione:** identità/copia/cima e interi array di zone invariati dopo il look; ultima carta con scarti presenti non causa refill. Nessuna preparazione, scarto o riordino disponibile nell'UI del look.
3. **Ordine:** fixture con spesa prima/dopo e cap pieno produce 6/5; costi distinti si pagano ciascuno. Provocazioni multiple rispettano la scelta dell'eroe e gli effetti simultanei la scelta del gruppo; figli/Ultimo Sforzo sospendono e ritornano senza doppio trigger. Verificare anche interruzione per sconfitta e perdita di legalità, senza inventare un premio per una fonte mai impegnata.
4. **Preflight:** 0 ispirazioni + costo obbligatorio presenta la stessa offerta/rifiuto per cima fato/non fato quando il seguito non è garantito; nessun effetto su stato o RNG. Ripetere con costi multipli, altra risorsa garantita, cap, child e ramo fonte non compilato. Un gate #57 non viene aggirato.
5. **Reset:** mazzo vuoto con scarti fa il reset ordinario e una sola lettura; seed/ordine si riproducono. Mazzo e scarti vuoti mantengono il gate; tutte le carte trattenute da figli non vengono recuperate anticipatamente. Lo stesso limite non viene etichettato come regola cartacea provata.
6. **Autorità e durata:** attore/casella/copia/round/turno/revisione/generation errati o stale non producono look, premio o costo; richieste concorrenti producono un impegno e un ritorno. Verificare tutti i tipi A1 sopra e viaggio residuo.
7. **Privacy:** proprietario autenticato può leggere il fronte; altri due proprietari e PC condiviso non trovano identità/copia/testo/immagine in API, event payload, receipt, fingerprint indovinabili, DOM, reader, log o asset URL. Il reward applicato non è un input del client. Backup amministrativo trattato come esportazione privata.
8. **Persistenza reale, da fare nel prodotto:** HTTP/SQLite, arresto SIGKILL durante ordine/look/figlio, restart e restore su host proprio vuoto senza pack; stato, ricevute complete e stessa richiesta recuperati. Rigettare alterazioni risignate di cima, premio, ordine e di entrambi i registri coerentemente modificati. UI nativa con tre identità e PC, istruzioni d'ordine/look e quattro larghezze; avanzamento solo dalla UI dopo il bootstrap dichiarato.

La verifica di questa consegna riguarda soltanto pin, provenienza, collegamenti locali, Markdown, diff e privacy del report. Il consumer, i suoi test, il recupero e la prova UI restano lavoro del parent; il completamento della ricerca non chiude #135.

[B]: https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/jme01_a1_diagram.png
[P]: https://www.fantasyflightgames.com/product/the-lord-of-the-rings-journeys-in-middle-earth/
[R]: https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/journeys_in_middle-earth_rules_reference.pdf
[F]: https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/jme_faq_v20_1.pdf
[FI]: https://cdn.svc.asmodee.net/production-asmodeeit/uploads/2022/09/jme_faq_ita.pdf
[C]: https://cdn.svc.asmodee.net/production-asmodeeit/uploads/2022/09/JME_Carte_Aggiornate.pdf
