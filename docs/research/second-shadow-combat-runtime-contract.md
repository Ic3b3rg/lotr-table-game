# Combattimento dopo la seconda Ombra: contratto runtime

Ricerca bounded per [#83](https://github.com/Ic3b3rg/lotr-table-game/issues/83),
4 novembre 2026, base `4b2e2c20242a0bb2b05a9d9c5e8aeb545cc5ebfb`, schema15.
**Il controller deve coprire quattro modelli, tredici record bonus e tutte le
istruzioni eleggibili. Il combattimento originale resta da implementare.**
Il nucleo [#77](../development/first-combat-kernel.md) offre primitive riusabili;
il suo singolo modello senza bonus non copre lo spawn obbligatorio di
[#81](../planning/second-shadow-spec.md).

L'unico file pubblico è questo rapporto. Contratto normalizzato, originali,
associazioni delle carte, inventario, helper adattati e checker separato sono
in `.scratch/issue83-runtime-contract/`, ignorata da Git. Nessun executor di
combattimento viene aggiunto. Review Standards/Spec e integrazione spettano
al root; #33/#65/#57 rimangono aperte.

## Fonti e freeze

**E** indica evidenza primaria letta o ricalcolata; **I** un requisito della
trasposizione digitale; **U** un limite. Indici FSM/azioni zero based;
S/R indicano `sharedassets0.assets`/`resources.assets`; A indica un MethodDef
di Assembly-CSharp, con eventuali offset IL relativi al codice.

| Fonte           | Identità e proprietario                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App statica     | JiME1.6.6#1128, Unity2022.3.62f2, stessa installazione dei contratti precedenti. Assembly-CSharp SHA256 `8869ef87b7d49f4993911904e35d78b72f8339e91158bbe8784c9691a9d743c6`; asset S `dd2a2285cc1b94ab567c6a6b895872bd97bb2bf8fe9e08d152c5f1103d1687be`, R `0250e91823b98c0f9fceb6b1ee517d880c6f9934359f849749779b7a5b0c835e`.                                                                           |
| Freeze81        | Export UI ricevuto al round3/Azione, due gruppi vivi. Pack `fc02acdc18ef405f7d7da36ef786bb3aff42ce9aa54ff63d18213af582bf09e3`; deployment `3d9a4515adbdb587d3970ca471ce0a79ed25eda184b65fd476fa89f5e3797a05`. Byte/hash dell'export, oggetti, figure, pose, binding e proprietari sono fissati nel contratto privato e negli input lock. Qui è confrontato staticamente, senza ripetere il percorso UI. |
| Testi effettivi | Due TextAsset italiani già identificati: Main_it `-7439224213581943799` e BonesOfArnor_it `-2938581942859744165`. Bundle SHA256 `c6b5dd76a635eb7082a24b7dbfca146460b8131f85aff9f07e7e9e3713d29cdf` e `021cb0f200afd2d87369bc6663d1cbd6c157b21ee9dfcab1bd532d3ebe330606`. Chiavi, originali, lingua e hash per campo restano privati.                                                                    |
| Regole e carte  | Copie primarie locali già bloccate: [Rules Reference][R], §§1/10–12/15/21–24/30–35/43/54/59–61/71/74/83/93/100, [FAQ IT2.0][F], pp.1–2, [Manuale IT][M]. Workbook V1.10 SHA256 `833edd0f9235d559253c6c0d43e61bcc0b5d955103bb2001e37a2e3ddef88ca4`: rilettura delle sole righe possedute e dei tre testi beneficio già riconciliati. Nessuna nuova attestazione delle loro quantità.                     |

Si riusano [75](first-combat-runtime-contract.md),
[61](physical-resolution-runtime-contract.md),
[P1/65](../planning/physical-resolution-p1-spec.md),
[P1b/67](../planning/physical-resolution-p1b-spec.md),
[P2/69](../planning/physical-resolution-p2-spec.md), GLOSSARY e ADR1–3.
Le fonti locali chiudono questa ricerca: nessuna nuova ricerca web o lettura
globale di nemici, carte, avventura o scratch. Le attestazioni ricevute non
vengono presentate come nuove prove UI o esecuzioni dell'app originale.

## Pool, istruzioni e dimensioni

**E — Origine:** S2319 conserva i **21 record** del prodotto posseduto,
nell'ordine fonte. Il filtro globale di S805, quello locale di R20900.s0.a1,
unicità, disponibilità e costo determinano la selezione; non si sostituisce
il prodotto con i soli due modelli estratti nel freeze. PlayerCount effettivo3
e moltiplicatore7 danno budget21; il binding dei punti globali è distinto dal
residuo locale dello spawn. Limite del gruppo, figure in gioco/pending/riserva
e quantità fisiche non diventano la stessa misura.
[S2319/S805; R20900.s0.a0–1; A0ba4/0b94/122a–122c; contratto81.]

| Modello, solo locator | Istruzioni ordinarie | Eleggibili con1 figura | Con2 | Con3 | Riferimenti speciali |
| --------------------- | -------------------: | ---------------------: | ---: | ---: | -------------------: |
| S1618                 |                   12 |                     10 |   11 |   10 |                    1 |
| S1629                 |                   12 |                     11 |   12 |   11 |                    0 |
| S1640                 |                   12 |                     12 |   10 |   10 |                    0 |
| S1651                 |                   12 |                     11 |   11 |   11 |                    0 |

**E — Closure:** 48 istruzioni ordinarie, 12 casi modello/dimensione,
**130 posizioni eleggibili** complessive; 20 aggiunte non vuote, tutte
normalizzate privatamente. Si filtrano MinGroupSize/MaxGroupSize sulle
figure **rimaste**, preservando ordine e molteplicità delle posizioni.
Uguali testi, statistiche o chiavi non fondono candidati. La prima riga
Damage corrispondente alla dimensione fornisce gli importi; una riga assente
restituisce0 nell'IL, senza inventare una progressione.
[S1687–1734; A0ba5/0d7d/0ad6/3894/389a.]

**E/I — Riprese distinte:** sono conservati anche258 contesti di ripresa
con figure rimaste positive. Dopo un'interruzione non si applica nuovamente
il filtro del sorteggio: quattro associazioni istruzione/dimensione possono
restare attive sotto il minimo di una nuova selezione. Gli importi vengono
letti sulla dimensione attuale all'apertura dell'attacco, non su quella
dell'estrazione; a zero figure si termina senza attaccare. Non si perde così
un'istruzione già scelta né si sostituisce il suo effetto.
[A387c:023b–0255; A3882:014a–0167; A389a:00e5–0148; A0d7d.]

**E — Override distinto:** S1791 è conservato con parametri e testi, ma non
entra nel sorteggio ordinario. Richiede la ricerca speciale per override;
il costruttore imposta `ActivationOverrideId=-1` e questo deployment non lo
sostituisce. Contrattacco e provocazione usano comunque il pool ordinario.
Non è una rimozione per capacità mancante. Le dimensioni1–3 sono chiuse
contrattualmente; ciò non certifica che ogni configurazione massima sia
acquistabile con budget21.
[A0c4c:0000–0007; A388e:0047–0099; A0d84/3894/3c41.]

## Bonus: stato già materializzato e lavoro del consumer

**E — Inventario:** i tredici riferimenti sono S2037–2039, S2045, S2056,
S2067, S2072, S2078, S2088–2089, S2095–2097. Uno è escluso dalla lingua
italiana; resta nel contratto con il filtro originale. Costi per dimensione,
duplicati, incompatibilità per intersezione dei tratti e massimo tre bonus
sono conservati. GetCost usa la **prima corrispondenza** e restituisce−1 in
assenza: la tabella con Num ripetuto non viene corretta artificialmente.
Sono enumerati213 insiemi strutturalmente compatibili, separati da budget,
ordine di acquisto e storia RNG. Non sono213 configurazioni di gameplay
dimostrate. [EnemyBonusModel; A0c41/0c33/0d7f/122b–122c.]

**E/I — Esecuzione:** #81 ha già applicato salute/armatura/stregoneria alle
singole figure e materializzato bonus, banner e posizione. Non sommarli
nuovamente al primo attacco. Il consumer deve invece applicare gli importi
bonus di danno/paura **una volta per attacco di gruppo**, le immunità e la
distanza effettiva. L'OR di BlocksModifiers usa un enum diverso dai tratti
che vietano combinazioni. Un'immunità sopprime il modificatore; i colpi di
uno slot legalmente pagato restano. Elite deriva dai bonus attivi, non dal
solo banner. Tutte le descrizioni sono state confrontate con i campi e i
consumer IL: in questa closure non emergono ulteriori trigger testuali di
movimento o prima/dopo attacco/attivazione. Tale verifica non autorizza a
ignorare immunità o distanza perché già descritte nel tracker.
[A0c21–0c22/38d0/0c37–0c39/0c48–0c4b/0c4f:0293–02d7/0c5f; R §§21/35/59/74.]

## Attacco, contrattacco, provocazione e attivazione

**I — Parte comune75:** proprietario vivo autorizzato, turno e costo o
concessione precisa, equipaggiamento e caratteristica comuni, bersaglio
legale; prova reale, sostituzioni prima delle carte, conversioni e successi
distinti, ciascuno slot stampato al massimo una volta. Dopo il calcolo si
scartano le rivelate e si completano i figli dopo-prova; il contrattacco è
il passo4, precedente alle reazioni dopo-attacco dell'eroe. Il risultato
acquisito sopravvive ai figli; uno sconfitto non riceve un nuovo attacco.
Zero colpi resta un risultato valido; colpi applicati da un effetto esterno
conservano la propria causa. [Contratto75; R §§1/12/21/100; F p.2.]

**E/I — Differenze necessarie:** un normale esaurito non contrattacca;
un elite può farlo anche esaurito, salvo Stordire effettivo e gli altri
vincoli. Il destinatario resta l'attaccante. La selezione dell'istruzione
precede la verifica di distanza: registrarla anche quando il contrattacco
non viene eseguito. Distanza e sopravvivenza derivano dallo stato autorevole.
Una provocazione richiede invece un gruppo pronto nella stessa casella,
non lo esaurisce e non usa la riduzione progressiva. Mantiene il ritorno
al movimento/interazione e ricalcola la legalità dopo i figli.
[A38e5:020b–024b; A38a0:01d9–0215; A3894/389a; A0c7a:0027–006d;
R §§21/35/60/71/74.]

**E — Riduzione progressiva:** nei contrattacchi elite e nell'attacco
primario dell'attivazione l'IL usa il contatore del gruppo. Per ogni unità
di riduzione toglie uno all'unica famiglia non nulla, oppure sceglie
casualmente fra le due; non scende sotto un importo totale1. Incrementa
il contatore dopo un attacco effettivamente eseguito, anche quando il limite
impedisce altre riduzioni. Nessun incremento per distanza negata o ramo
senza bersaglio. Il refresh emette BEFORE_UNEXHAUST e poi azzera sia
esaurimento sia riduzione, dopo la minaccia e prima di Riorganizzazione.
Il nuovo consumer deve persistere anche queste decisioni casuali.
[A389a:014d–01fe; A38a0:01e1–01f6; A387c:0281–0292; A0ac9;
A38df:001e–0053; A3902:0b09–0b89.]

**E/I — Vera attivazione:** l'istruzione determina movimento, distanza,
bersaglio e alternativa; non basta chiamare il contrattacco del nucleo77.
Il packet primario estrae un eroe attivo nell'ordine della compagnia. Prima
si conserva quel bersaglio, poi si valuta il percorso; se irraggiungibile
si usa il più vicino raggiungibile. Il gruppo decide parità fra bersagli
e percorsi minimi. Se nessuno è attaccabile, non si esegue prima il
movimento primario: si segue soltanto l'alternativa fonte. Nel privato
sono fissati i parametri di tutte le famiglie, inclusa la destinazione
alternativa a distanza e le chiavi d'interruzione. Un attacco che interrompe
l'attivazione non provoca contrattacco: conserva l'istruzione selezionata,
attende la rimozione se sconfitto, termina se esaurito, altrimenti riprende
con la chiave d'interruzione. Senza placeholder non estrae un nuovo eroe.
[A0bbb:00a2–00ae; A0b7c/0b80/0b84:005c–008b/0cb4; A387c/3882/388e;
R §§30/60.]

**E/I — Posizioni:** i gruppi81 hanno ID di casella fonte; gli eroi hanno
ID ordinari. Il contratto conserva la bijezione spaceBindings, il grafo
congelato, figure e pose: niente confronto fra stringhe di sistemi diversi.
I percorsi usano il movementGraph delle caselle visibili, distinto da
ConnectedSpaces. La verifica statica delle posizioni attuali conserva le
distanze e le possibili sostituzioni; non anticipa le posizioni della futura
Ombra. I rami terreno speciali sono chiusi come irraggiungibili nel contesto
attuale: mappa Viaggio, sette modelli di tessera visibile senza il bit fonte
pertinente e nessun segnalino attivo corrispondente. Un contesto successivo
che li abilita richiede un nuovo controllo, non una scelta libera.
[Freeze81; A0d66/0dad/387c:0075–0131; R §§6/30/60/74.]

**E/I — Rimozioni:** figura, gruppo e logica restano identità distinte.
I due gruppi del freeze hanno logica nulla: la loro sconfitta non deve
richiamare il seguito75 o concederne Sapienza. La ricompensa ordinaria
richiede una vera sconfitta dell'intero gruppo e la scelta fonte con cap;
nessun premio per barra rimossa o fuga. Il DEFEATED mirato già consegnato
dal timer81 non diventa un nuovo evento di combattimento.
[A0c3b/0c3e/38d3/38d9/38a0; freeze81; R §§10/48.]

## Esiti fisici e finestre richieste

**E/I — Riutilizzo concreto:** il [consumer P1/P2](../../src/physical-resolution/front-runtime.ts)
risolve vere carte, negazione concessa dalla fonte, allocazioni dei successi,
prevenzioni, figli, capovolgimenti, debolezze e Ultimo Sforzo. Ogni successo
nega una sola unità del tipo scelto e può rimanere inutilizzato. Sono
distinte prevenzione normale, solo-coperto e divieti assoluti. Le aggiunte
non ricevono automaticamente un'altra prova per negare.
[R §§22/43/54; F pp.1–2; contratti61/65/67/69.]

**I — Seam mancante:** occorre un esito per attacco e per famiglia,
legato a causa, gruppo, istruzione/hash, destinatario e ritorno. Registrare
offerto, negato, prevenuto e realmente subito al momento della sofferenza;
congelare l'esito dopo tutte le carte e i discendenti della fonte, prima
di valutare le aggiunte. Scarto, cura o capovolgimento successivi non
cancellano quanto subito. La sofferenza di un fronte figlio mantiene la
propria causa. Né il saldo nell'area né i contatori globali `transferred`
dimostrano questo risultato. Il privato distingue tutte le20 policy,
predicati, finestre stampate, parametri, dipendenze e hash dei testi.
[R §§22/54; contratto61, frontiera successiva;
front-runtime.ts:suffer/test; [stato fisico](../../src/physical-resolution/front-state.ts).]

**I — Frontiera persistente:** alla chiusura completa della fonte si
conservano l'esito e gli effetti dovuti nella loro finestra. Obblighi P2
e reazioni concorrenti senza precedenza specifica ammettono l'ordine del
gruppo; ogni figlio termina prima della ripresa. Si ricontrollano i limiti
dopo nuove conseguenze, senza interrompere a metà una carta o saltare un
obbligo successivo. Un'aggiunta di movimento mantiene ordine legale dei
movimenti, parità, provocazioni, eventuale esplorazione e ritorno: non è
un piazzamento esente dalle regole. [R §§1/22/54/60/71; F p.2;61/69.]

**E/I — Compagnia autentica:** tre eroi, sei oggetti/sette copie, sette slot
stampati, 33 abilità/45 copie e45 clausole selezionate. Il freeze81 ha
quattro preparate, non le tre iniziali75; nessun beneficio posseduto.
Il contratto mantiene tutte le definizioni possedute, anche quelle
preparabili dopo Scoperta. Servono sostituzioni prima della prova, successi
aggiunti dalle preparate, Assalto e relativa reazione dell'eroe, figli
Scoperta con carte del padre trattenute, concessioni dopo-attacco e costi
con ritorno conservato. Le conversioni già presenti coprono soltanto le
policy effettivamente compilate: il test fisico corrente non offre ancora
tutte queste clausole. Dei fronti persistenti già chiusi si riusano le
definizioni; vanno collegati anche modificatori delle rivelazioni d'attacco,
colpi aggiunti e divieti di prevenzione. Nessun nuovo catalogo74.
[W selezionato; contratti75/61/67/69;
[programma fronti](../../src/physical-resolution/front-program.ts).]

## Prossima Ombra e gate57

**E/I — Ordine:** A3902 riscorre EnemiesInPlay dall'inizio e attiva il
primo gruppo pronto, completa il suo seguito e ricomincia. L'ordine del
freeze81 è conservato privatamente; non si ordina nuovamente per modello
o banner. I gruppi nati nella minaccia81 non si attivano retroattivamente.
Dopo le attivazioni seguono oscurità applicabile, ROUND_END/ricevitori,
minaccia ricalcolata, soglie, refresh e vere Scoperte di Riorganizzazione.
Il timer81 è già fermo e il suo seguito già concluso.
[A3902:02cc–03a8/03b0–06a3/06b1–0b89;81; R §83.]

**E/U — Soglia successiva:** se il tavolo restasse invariato, minaccia21
più12 raggiungerebbe33, attraversando la soglia25. R27777 mantiene il suo
default25: `OverrideDefaultThreat=false` non usa il campione serializzato0.
Il seguito R24517 non è compilato nel pack81; richiede il deployment fonte
con moltiplicatore9, disponibilità viva e registrazione successiva, il cui
default è40. Parametri e proprietari sono nel privato. Serve questa ulteriore
compilazione/certificazione prima di poter completare l'Ombra; nessuna soglia
viene alzata, saltata o reinterpretata. Cap64 e perdita originale restano
confini fonte distinti. La previsione33 è condizionata: movimenti,
esplorazioni, segnalini o sconfitte impongono un nuovo calcolo.
[R24517.s1/s3; R4758/R3667/R22474; A3902; round-source.ts.]

**U — Quantità benefici57:** i tre conteggi sono ancora irrisolti.
L'ipotesi5/5/5 e la preselezione di una domanda senza risposta non sono
approvazione. Tre policy aggiuntive raggiungono acquisizioni obbligatorie;
altre capacità possedute o titoli possono raggiungere acquisizione e uso.
Non si elimina alcun candidato per evitarle e non si ripete la domanda.
Il contratto conserva anche le regole dei benefici già riconciliate, senza
inventare copie o trasformare disponibilità sconosciuta in riserva vuota.
[Catalogo57; W BoonsBanes!B2–B4; R §15; F p.2.]

**I — Gate:** prima di azione, carta o risorsa verificare l'intera closure
obbligatoria dell'operazione, inclusi i candidati non estratti. Un possibile
guadagno beneficio richiede dato fisico e consumer; una capacità opzionale
non disponibile ha il proprio gate prima del suo costo. Compiler, finestre,
esiti per causa e interfaccia della riserva sono implementabili già ora.
L'assenza autentica di un beneficio può determinare un ripiego stampato;
non autorizza a certificare nuove acquisizioni con dati sintetici.
Il preflight dell'intera Ombra deve comprendere anche le soglie raggiunte,
prima di selezioni, tick o aumento minaccia. [61/69/75/81; ADR0002/0003.]

## Prossimo incremento UI e verifica della ricerca

**I — Confine implementabile:** estendere in sede compiler e nucleo77
con questi quattro modelli, bonus, immunità, distanza, elite e gruppi
senza logica; aggiungere al ciclo autorevole il controller dell'attacco
e il consumer fisico dell'esito, riusando P1/P2. La prima uscita UI è
un attacco dell'eroe completo, compreso eventuale contrattacco, aggiunte,
P2, finestre dopo-attacco e ritorno; quindi una provocazione collegata
al movimento/interazione sospeso. Le quantità57 restano un gate reale
per le closure che le richiedono. La successiva uscita Ombra richiede
anche le vere attivazioni e il seguito25 sopra, non tre conferme legacy.

Criteri per quell'incremento, **non prove eseguite qui**:

- Nuova capacità congelata prima dello startup, stessi tre proprietari
  autentici; nessuna sostituzione del pack o nuova origine a round3.
- UI con bersagli e capacità legali; prove, successi, costi e conseguenze
  effettivi; nessun campo client per importi, salute o esito libero.
- Continuazioni nello stesso Store.once del ledger v2: restart, retry,
  stale, concorrenza, restore packless e alterazioni risignate confrontano
  popolazione, scelte, bersaglio, cause, figure, risorse e ritorni.
- Casualità separata per istruzione, bersaglio, riduzione elite, mazzi e
  Ultimo Sforzo; deployment81 e mappa restano congelati. Nessuna parità
  della sequenza Unity viene promessa.
- Accettazione dalla UI a tre identità con figli e attese reali; fixture
  inventate e configurazioni provvisorie non provano gameplay originale.

**E — Controlli effettivi**, senza suite completa o QA browser:

| Controllo        | Risultato                                                                                                                                                                                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Input            | 80 copie puntuali,170.727.425 byte, fonti altrui immutate; altri29 owner di codice/documentazione fissati sulla base.                                                                                                                                                |
| Asset freschi    | 97 oggetti,35.986 byte, lettori C/Python concordi, consumo completo e1.085 puntatori non nulli risolti. Include il pool21 e soltanto la closure richiesta, più sette modelli delle tessere visibili per il ramo terreno.                                             |
| IL fresco        | 67 corpi,17.074 byte di codice,6.285 istruzioni,607 destinazioni di salto e una regione eccezione controllate; cinque enum proprietari distinti. Nessun opcode originale eseguito.                                                                                   |
| Testi/carte      | 117 chiavi italiane;42 righe OOXML/664 celle della compagnia e tre celle beneficio. Definizioni fronti/P2 ricevute riusate, non un nuovo audit del loro catalogo.                                                                                                    |
| Closure/negativi | 12 popolazioni/130 posizioni,258 contesti di ripresa,13 bonus,213 insiemi strutturali,20 policy aggiuntive;51/51 alterazioni dei dati e della closure respinte, inclusa una modifica coerentemente ricalcolata nell'hash. Non sono51 partite o prove del controller. |

Il README privato registra input, byte/hash, copie/adattamenti degli helper,
comandi riproducibili, tentativi e limiti. `contract.private.json` è separato
da `check.py`, che non importa builder o prodotto e rilegge le primarie.
`inventory.private.json`, `verification.private.json` e il sigillo collegano
record, owner, lingue, parametri serializzati/default/override e policy
interpretative. Il contratto ha1.436.706 byte, SHA256
`80672a68f6db58ace4c4127f2df34518dfb325ee146f7c8d6272ea2f45c19fc1`.
Il sigillo e il receipt del rapporto restano privati; formato, collegamenti,
privacy e diff vengono verificati prima del commit locale.

**U — Limiti:** nessuna Unity/JIT, sequenza RNG originale, host, browser,
nuova partita o prova della giocabilità del combattimento. Le baseline
598/598 test e129 backup sono consegne del root, non esecuzioni ripetute
per questo rapporto. Ricerca ulteriore serve quando un nuovo contesto
abilita altri terreni, logiche o seguito oltre il confine descritto;
consumer e certificazione della soglia25, perdita finale, campo e A2
restano lavoro successivo. Nessuna fonte privata entra nel commit.

[R]: https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf
[F]: https://cdn.svc.asmodee.net/production-asmodeeit/uploads/2022/09/jme_faq_ita.pdf
[M]: https://cdn.svc.asmodee.net/production-asmodeeit/uploads/2022/09/Viaggi_nella_Terra_di_Mezzo.pdf
