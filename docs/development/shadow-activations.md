# Attivazioni e seguito25 — #87

La nuova capacità congelata prima dello startup completa una vera Ombra nel
ciclo autorevole: attivazioni, conseguenze fisiche, oscurità applicabile,
eventi, minaccia, seguito25, refresh, Scoperte e nuovo turno.
Base `031f4ab`, schema15; [spec](../planning/shadow-activations-spec.md) e
[piano](../planning/shadow-activations-plan.md). Grounding:
[83](../research/second-shadow-combat-runtime-contract.md),
[85](combat-controller.md), [review85](../reviews/2026-11-04-combat-controller.md)
e ADR2–3. Review Standards/Spec e integrazione spettano al root.

## Contratto e implementazione

`source-shadow-activations-v1` estende l'artefatto di combattimento con policy
source-linked per tutte le48 istruzioni, chiavi primaria/alternativa/ripresa,
compagnia, controller, difficoltà, terreno e soglia. Compagnia, deployment e
projection sono legati da hash. I pack precedenti mantengono impronta, forma,
origine round1/Azione e gate. Nessuna nuova origine al round3.

Il controller85 seleziona il primo gruppo vivo e pronto nell'ordine salvato;
completa carte, aggiunte e ritorno prima di riscorrere dall'inizio. Gruppi
esauriti e figure rimosse non attivano. Bersaglio iniziale nell'ordine della
compagnia e istruzione hanno stream separati dalla riduzione. Fallback,
parità e passi dei percorsi minimi derivano dal grafo visibile congelato;
la UI invia soltanto una scelta offerta. L'alternativa parte senza movimento
primario. Packet, bonus e figure rimaste usano le primitive77/85; una selezione
trattenuta non viene filtrata nuovamente. La riduzione cresce soltanto per un
attacco eseguito e si azzera al refresh.

Il preflight controlla attivazioni e dipendenze, movimenti imposti e loro
provocazioni/esplorazioni, oscurità, eventi, soglie raggiunte, refresh e
ROUND_START prima degli effetti. Il seguito dello spawn viene attraversato
strutturalmente senza estrarre un risultato casuale. Le nuove collocazioni
attendono l'Ombra successiva. Consumo di un beneficio assente e acquisizione
restano operazioni distinte; le popolazioni mantengono ordine e molteplicità.

Oscurità usa la stessa funzione per contesto fisico, aggiunte e fase:
casella, globale e segnalini fonte; un override non compilato mantiene il gate.
Il consumer riusa esiti diretti offerto/negato/prevenuto/subito e frontiera
P2/addizioni. Il movimento ancora dovuto al nemico sopravvive alla sconfitta
del destinatario e torna una volta. La compagnia fonte non possiede una
concessione di attacco durante l'attivazione: la UI non offre attacchi gratuiti.
I test tecnici delle interruzioni77 restano distinti dalle prove UI.

R27777→GO4758/FSM24517 è compilato e certificato: quattro stati, cinque azioni,
default25 con override false, moltiplicatore9, pool completo e disponibilità
viva. Il seguito registra GO3667/R22474 al default40 dopo i piazzamenti.
GetDifficulty/SelectNormal e A3902 sono ricontrollati staticamente: normale=0
non applica il bonus iniziale di punti del ramo difficile. EnemyPoints,
figure disponibili e residuo dello spawn sono grandezze separate.

## Percorso autentico

Un solo nuovo avvio, tre identità autentiche in contesti propri, host/profilo
propri e freeze ante-startup importato dal filepicker. Tastiera, controlli
browser nativi e GET osservativi hanno completato startup e tre round;
nessuna write API/SQL ha avanzato l'accettazione. Seed, pack e pool non sono
stati sostituiti o ripetuti per evitare dipendenze.

La seconda Ombra ha collocato naturalmente un gruppo con due figure, già a
portata del bersaglio della successiva attivazione. La terza Ombra ha scelto
istruzione e destinatario reali:2 danni/2 paure offerti,1 danno negato,
1 danno/2 paure subiti direttamente, poi un'aggiunta separata di1 danno
coperto. Una conversione ha consumato l'ispirazione disponibile. Il ritorno
ha esaurito il gruppo e contato un attacco; il timer concluso è rimasto fermo.

Oscurità non applicabile in questo percorso. La minaccia effettiva è passata
21→33 con delta12, attraversando25. Budget27 da tre eroi e moltiplicatore9,
EnemyPoints0; due nuovi gruppi realmente collocati. I residui di entrambi gli
spawn sono risultati2 per coincidenza: il secondo budget non usa il residuo
precedente. Nessuna attivazione retroattiva. Tre gruppi sono tornati pronti,
con riduzione0; ogni proprietario ha concluso Scoperta. Round4/Azione e primo
turno legale, con zero azioni consumate. L'origine v2 è identica allo startup.

## Verifiche e recupero

- **630/630 test**, zero fail/skip/todo, typecheck, formato e diff verdi.
  Le ripetizioni della suite sono motivate dalle correzioni trovate in QA:
  ritorno della UI e separazione della vista pubblica dal salvataggio.
- Fixture inventate RED→GREEN: compiler/versione, bersaglio/fallback, parità,
  percorsi minimi, riduzione normale/elite, oscurità globale/segnalino/override,
  gate57 e soglie tardive prima della fase, autenticazione, once/concorrenza,
  stale, P2/movimento dovuto, source replay e Scoperte dopo restore packless.
- Matrice privata ereditata83 riprodotta:12 popolazioni/130 elementi,
  258 riprese,213 insiemi di bonus,13.694 packet. Nuovi controlli indipendenti:
  48 policy,480 casi di bersaglio,1.440 controlli di percorso e576 packet di
  riduzione primaria. Nessuna equivalenza con RNG Unity/JIT.
- Recovery UI: selezione, negazione, aggiunta, soglia, piazzamenti, Scoperta e
  nuovo turno; otto coppie SIGKILL confrontano l'intero payload, più un primo
  SIGKILL confrontato dal vivo e registrato in ricevuta. Quattro file sorgente
  configurati assenti durante i recuperi. Quattro alterazioni di backup
  originali, risignate e inviate dal filepicker, respinte senza modifiche.
  Validati58 backup propri, compresa la precondizione ante-startup;13 restore
  UI comprendono i controlli di sola lettura descritti sotto.
- Compatibilità:180 backup storici e61 della consegna85, con stato e ricevute
  conservati dal validatore corrente. I backup propri, restore e catture sono
  enumerati con byte/hash nella verifica privata e nel sigillo.
- UI a320/768/1024/1440: bersaglio/attese, negazione, aggiunta, piazzamento e
  ritorno, guida e lettore da tastiera con ripristino del focus. Le verifiche
  supplementari di stati precedenti sono restore di sola lettura; nessun
  comando di gioco ha avanzato quei rami prima del ritorno al round4 accettato.
  Le32 catture coprono otto stati; quattro sono state ispezionate direttamente.

La QA ha corretto il simbolo di attacco a distanza non riconosciuto e l'export
formattato che superava il limite del filepicker. L'export compatto conserva
l'intero payload senza aumentare limiti o indebolire validatori. Il riepilogo
dell'ultima attivazione ora descrive la fase corrente.

Una proiezione pubblica tipizzata separa lo scenario dal salvataggio privato:
API ordinarie senza entropia di deployment/esplorazione; backup e replay la
conservano integralmente. Coperte e ordine dei mazzi restano privati. La suite
copre il contratto pubblico e il mantenimento dei dati autorevoli. Dopo
l'aggiornamento dei client, HTTP IPv4 senza crypto.subtle resta supportato.

## Confini e consegna

Il proprietario ha espresso la preferenza: **«Mantieni il blocco finché le
quantità sono verificate»**. I conteggi57 restano null/non verificati; nessuna
configurazione provvisoria o domanda ripetuta. Le acquisizioni raggiungibili
mantengono il gate prima dei costi e dell'intera closure obbligatoria. Il
consumo di un beneficio autenticamente assente conserva il ripiego stampato.

Il percorso autentico non ha richiesto movimento primario, oscurità, P2,
sconfitta o concessioni d'interruzione. Questi limiti sono distinti dai test
con fixture e dalle matrici fonte. Le soglie oltre25, nuovi terreni/logiche,
perdita finale, campo/A2 e optional non raggiunte restano confini successivi;
cap64 e gate della perdita sono conservati. Questa consegna non conclude
l'avventura e non chiude33/65/57.

Originali, parametri, input/byte/hash, comandi e tentativi sono in
`.scratch/issue87/README.private.md`; sigillo proprio
`.scratch/issue87/evidence-lock.json`. Host, osservatore, browser e tre contesti
propri vengono chiusi prima del sigillo. Nessuna installazione, altro checkout,
agente, push, PR o write GitHub. Il tavolo protetto non è stato consultato.
