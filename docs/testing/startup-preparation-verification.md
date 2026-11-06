# Preparazione nello startup — verifica del seguito #65/#33

6 novembre 2026. Base `d89132020df2ba0393ed7c665bb70525411a5118`.
[Specifica](../planning/startup-preparation-spec.md) e
[piano](../planning/startup-preparation-plan.md) committati prima del prodotto.
Singolo implementer nel checkout assegnato; integrazione e review indipendenti
rimangono a Root.

## Risultato

I pack con capacità `source-startup-preparation-v1` risolvono preparazione
iniziale di ruolo, Scoperta iniziale e prova iniziale nel controller fisico.
La capacità lega catalogo, artifact dei fronti e prova; il compiler richiede
il relativo certificato. Le policy storiche interessate devono corrispondere
agli executor congelati prima dell'avvio.

I figli tipizzati riusano `afterPrepare`, selezione, Scoperta e prova già
implementati. Non esiste un secondo motore di ricompense. I risultati di setup
sono proiezioni dei padri ricostruiti. Task, fonte/entry/azione, ordine degli
eroi, programmi, risorse continue, richieste e ricevute sono riconciliati.
Il trigger precede il ritorno al messaggio e al successivo eroe.

Schema30 migra strutturalmente1–29 e respinge le nuove forme mascherate da
schema storico. Senza il marker restano il gate e il replay storici: nessuna
preparazione o ricompensa viene aggiunta a un salvataggio preesistente.

## Prove automatiche

Il RED HTTP distingue il gate storico intenzionale dal consumer mancante:
con artifact compilato e input corrispondenti il percorso storico respinge
la preparazione prima di cambiare le carte; il percorso nuovo richiede sia
attestazione sia aggancio effettivo al kernel. RED/GREEN separati coprono
certificato e migrazione.

I test nuovi verificano zero/una/più paure, proprietà della scelta, scarto
della quinta preparata, ordine degli effetti durante la sospensione,
ispirazione cappata, preparazione iniziale del ruolo, seguito completo e
primo turno. Gli input sorgente assenti o diversi sono respinti senza scrittura.
Actor estraneo, fonte/revisione superate, retry e concorrenza conservano una
sola applicazione.

Il test SIGKILL osserva una vera mutazione del comando immediatamente prima
della scrittura Store.once: carta preparata, continuazione e ricevuta tornano
al prefisso precedente. Restart e restore senza pack confrontano l'intero
stato di gameplay e le ricevute. Backup risignati con origine, cursore,
risorse, task, risultati o doppia cronologia alterati sono respinti.

Le regressioni mirate già pubblicate comprendono ricompense legacy, P0/P1,
parent fisici e recovery dello startup. La prima verifica mirata passa32/32;
le nuove prove di recovery/SIGKILL e ruolo iniziale passano separatamente.
Un RED successivo ha mostrato che un'azione sorgente poteva incorporare
marker o figli riservati al controller di startup. Il parser/compiler ora
respinge tutte e cinque le forme provate, anche con manifest attestato;
questi programmi sono derivati soltanto dal consumer. I10 test HTTP dello
startup restano verdi dopo la correzione.
La prima canonica registra995/995, exit npm0. La nuova guardia richiede una
modifica effettiva dopo quel passaggio: la sola canonica sul prodotto finale
registra **996/996, exit npm0**, zero fail/skip/cancel/todo e
1.213.114,443375 ms, con concorrenza4 e senza altri carichi pesanti del task.
Tipi, formato e diff sono exit0; nessuna dipendenza, soglia o timeout è
modificata. Entrambe le canoniche e il motivo del secondo passaggio sono
conservati, insieme ai fallimenti intermedi e ai comandi effettivi.

## Browser reale

Chrome157, profilo temporaneo proprio e contesti isolati. Due profili
aggiuntivi non erano disponibili nel preview; il Chrome MCP configurato
era già occupato e non è stato ispezionato o fermato. Il fallback usa soltanto
il browser creato dal task. Un pilot di configurazione è distinto dalla
successiva prova positiva.

Tre identità personali e una vista condivisa attraversano ingresso, gruppo,
eroi, preparazione, generazione della mappa, avvio e carte dalla UI normale.
Il pack inventato viene compilato dalla proiezione generata, prima del comando
di avvio. Tutti gli avanzamenti sono controlli UI; HTTP/SQLite esterni sono
letture diagnostiche. Non sono stati usati comandi liberi o modifiche del DB
per costruire o superare la prova positiva.

La preparazione del primo eroe apre la scelta fra tre paure scoperte. Il
proprietario sceglie una copia, le altre viste attendono; le preparazioni
degli altri due eroi con zero paure proseguono senza scelta vuota. Sei servizi
di setup, otto padri restituiti una volta, obiettivo0 e primo turno legale.
Le tre copie di paura rimangono nella stessa area: due scoperte e una coperta.

Guida dello startup, lettore, focus da tastiera e controlli etichettati sono
stati usati. Audit e screenshot verificano le larghezze CSS effettive
320/768/1024/1440, assenza di overflow, attesa, assenza di ACK sostitutivo e
assenza di identità/entropia/fronti fisici nascosti nelle proiezioni ordinarie.

Un export UI durante la scelta è identico dopo riavvio senza file esterni.
La stessa partita prosegue fino al primo turno, esportato e ripristinato dalla
UI senza pack: gameplay e ricevute sono identici, generation rinnovata.
Questa verifica UI termina alla proiezione anonima del turno ripristinato;
il recupero personale successivo è coperto dal test HTTP reale.

Dopo l'ultima correzione del parser,27 backup UI completi vengono rivalidati
dal prodotto finale senza modificare gameplay o ricevute. Il bundle UI è
identico a quello usato nel browser; entrambe le compilazioni, inventata per
la UI e originale storica, restano identiche. Il guard aggiunto non altera
il programma sorgente valido attraversato dalla prova positiva.

Nessuna eccezione JavaScript dell'applicazione o chiamata console warning/error catturata.
I log conservano gli errori di rete attesi durante l'arresto volontario del
proprio host. Tutti i contesti, profilo temporaneo e host del task sono chiusi.

## Autorità e limiti

Tredici input statici autorizzati sono stati verificati e copiati con pin,
senza seguire i percorsi storici annidati. Le due policy startup originali
corrispondono ai digest del catalogo corrente e alle celle selezionate del
workbook. Il vecchio registro delle finestre ha un digest di definizione
precedente: identità e localizzatore coincidono; non viene usato per accettare
un hash corrente diverso. Il compiler ricostruisce identico il pack originale
fornito,37 definizioni. È una verifica statica, non un avvio originale.

Le prove positive sono inventate. Non è stata rigenerata qui un'intera
matrice privata delle36 definizioni, né attestata l'accettazione originale33/89.
#57 conserva tutte e tre le quantità null/unverified/blocked;156 resta
statico/gated. Nessuna nuova partita originale, email, scrittura GitHub,
push, PR o merge. Telefoni fisici, LAN, Windows e Safari non sono certificati.
#65/#33 restano aperte per i requisiti residui; Root esegue Standards/Spec e
integrazione prima di chiudere questo seguito.

Report completo, input, comandi, fallimenti intermedi e prove sono nella
directory ignorata propria `.scratch/startup-prepare/`, con manifesto ordinato
e pin esterno. La consegna distingue identità del prodotto e ultimo commit
documentale senza rieseguire una verifica già verde sullo stesso codice.
