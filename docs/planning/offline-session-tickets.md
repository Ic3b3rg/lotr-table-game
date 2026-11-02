# Bozza dei ticket: sessione locale

**Stato: suddivisione e prove approvate dal proprietario il 23 ottobre 2026.** Questo documento conserva la proposta approvata; lo stato dei task è sul tracker GitHub. [Specifica](offline-session-spec.md).

Tracker: [specifica e task collegati](https://github.com/Ic3b3rg/lotr-table-game/issues/9).

## Suddivisione approvata

1. **Aprire il tavolo e accogliere fino a cinque giocatori tramite QR.** Nessun blocco di implementazione. Consegna: avvio locale, vista condivisa, ingresso da telefono o PC e partecipanti visibili su tutti gli schermi.
2. **Riprendere la sessione e recuperare il proprio posto.** Bloccato dal ticket 1. Consegna: salvataggio, riavvio dell'host e recupero su uno stesso dispositivo o su un altro, senza duplicare i giocatori.
3. **Confermare azioni comuni dai telefoni con un unico esito.** Bloccato dal ticket 2. Consegna: prova di collegamento condivisa, gestione di conferme simultanee e reinvii, esito conservato dopo il riavvio.
4. **Esportare e ripristinare una copia della sessione.** Bloccato dal ticket 3. Consegna: copia consistente del tavolo e ripristino verificato, disponibile anche da telefono.

Le dipendenze sono intenzionalmente lineari: ciascun ticket estende un comportamento già dimostrabile. Il terzo usa identità, persistenza e recupero del secondo; il quarto verifica anche lo stato delle azioni comuni del terzo. Nessuno dei quattro dipende dalle carte italiane o dai dati della campagna.

Il [ticket esistente della prova LAN](https://github.com/Ic3b3rg/lotr-table-game/issues/5) raccoglie il riscontro fisico su macOS, Windows e telefoni; i nuovi ticket non lo chiudono automaticamente.

## 1. Aprire il tavolo e accogliere fino a cinque giocatori tramite QR

### What to build

Dal PC il proprietario avvia un host locale e apre il tavolo nel browser. Il tavolo mostra QR e indirizzo leggibile. I partecipanti entrano dal browser del telefono o del PC, scelgono un nome e vedono lo stesso elenco delle persone presenti.

### Acceptance criteria

- [ ] Esistono istruzioni riproducibili di preparazione e avvio per macOS e Windows; il processo non richiede servizi esterni durante l'uso.
- [ ] Il tavolo mostra un QR generato localmente e un indirizzo LAN con porta. Nessun QR usa localhost o un indirizzo di ascolto come destinazione per i telefoni.
- [ ] Con più interfacce il proprietario può scegliere l'indirizzo pubblicato, senza modificare il codice.
- [ ] Una persona entra scegliendo un nome, senza account; il risultato compare sia nella vista personale sia nella vista condivisa.
- [ ] La sessione accoglie da uno a cinque giocatori. Una sesta nuova persona riceve un messaggio comprensibile e non modifica i posti esistenti.
- [ ] La vista condivisa non occupa un posto. Una persona può comunque partecipare dal PC senza telefono.
- [ ] Un nome uguale a quello di un partecipante esistente non trasferisce il controllo di quel partecipante.
- [ ] La vista mobile è utilizzabile a larghezza di telefono e permette di digitare l'indirizzo senza dipendere dalla scansione.
- [ ] Risorse e QR sono disponibili senza richieste Internet; sono presenti verifiche di ingresso e limite dei partecipanti attraverso l'interfaccia pubblica dell'host.
- [ ] La documentazione distingue piattaforme provate da piattaforme ancora da verificare con dispositivi reali.

### Blocked by

Nessuno: può iniziare immediatamente.

## 2. Riprendere la sessione e recuperare il proprio posto

### What to build

Il gruppo ritrova sul PC la sessione registrata. Un partecipante ricarica il browser, si riconnette dopo una sospensione oppure recupera il proprio posto su un altro dispositivo tramite il meccanismo concordato. Un'interruzione non viene scambiata per una nuova partecipazione.

### Acceptance criteria

- [ ] Salvataggio automatico dopo ogni azione accettata e recupero tramite codice personale, senza account.
- [ ] Riaprire l'host con la stessa cartella dati ripristina la sessione invece di crearne o sovrascriverne una senza avviso.
- [ ] una conferma positiva di modifica arriva soltanto dopo la registrazione durevole; un errore di scrittura appare come errore e conserva lo stato precedente.
- [ ] Ricarica e riconnessione ripristinano lo stesso partecipante; il recupero da un altro dispositivo non consuma un posto aggiuntivo, anche a tavolo pieno.
- [ ] il codice è distinto dal collegamento pubblico e non viene mostrato agli altri partecipanti.
- [ ] Un collegamento interrotto è visibile. Prima di riprendere le azioni il client riceve lo stato corrente dall'host.
- [ ] Un codice non valido non assegna il controllo di un partecipante e produce un messaggio comprensibile.
- [ ] Un test riavvia un processo host dopo una conferma positiva e ritrova partecipanti e identità; un altro verifica recupero e limite dei cinque posti attraverso il confine pubblico.

### Blocked by

Ticket 1 — Aprire il tavolo e accogliere fino a cinque giocatori tramite QR.

## 3. Confermare azioni comuni dai telefoni con un unico esito

### What to build

Una sezione dichiaratamente dimostrativa presenta una richiesta condivisa con due possibili esiti. Qualunque partecipante può confermarne uno dal proprio dispositivo. Tutti gli schermi ricevono l'esito effettivamente accettato, anche quando arrivano conferme simultanee o ripetute.

Questa prova verifica il collegamento e la consistenza della sessione; non presenta contenuti narrativi o regole provvisorie come parte del gioco ufficiale.

### Acceptance criteria

- [ ] Le dinamiche di gioco seguono le regole ufficiali. Nella prova di collegamento un partecipante conferma la scelta concordata dal gruppo; non viene introdotta una votazione né una regola di precedenza fra giocatori.
- [ ] Un partecipante apre la prova e conferma un esito interamente dal telefono, senza un passaggio obbligatorio sul PC.
- [ ] due conferme concorrenti della stessa richiesta producono un solo esito valido; l'altra vista riceve lo stato aggiornato e sa che la richiesta è già risolta.
- [ ] Ripetere lo stesso comando dopo una risposta persa non ripete l'effetto e restituisce un risultato coerente.
- [ ] Una conferma riferita a una richiesta già risolta non viene applicata a una successiva richiesta.
- [ ] Tutti i client tornano allo stato autorevole dopo una riconnessione. Non vengono applicate automaticamente azioni accumulate su uno stato superato.
- [ ] Il riavvio conserva sia l'esito registrato sia le informazioni necessarie a non eseguire nuovamente un comando già accettato.
- [ ] Verifiche attraverso il confine pubblico coprono concorrenza, reinvio dopo perdita di risposta, richiesta superata e riavvio; una prova nel browser verifica l'azione mobile e l'esito condiviso.

### Blocked by

Ticket 2 — Riprendere la sessione e recuperare il proprio posto.

## 4. Esportare e ripristinare una copia della sessione

### What to build

Dal PC o dal telefono un partecipante esporta la sessione registrata in un file e può ripristinarla su un host. L'interfaccia chiarisce quale stato verrà sostituito e chiede una conferma prima di sostituire un tavolo esistente. La funzione riguarda il recupero della propria sessione, non la distribuzione del catalogo del gioco.

### Acceptance criteria

- [ ] Il backup esportabile/importabile contiene una versione di formato verificabile.
- [ ] Esportare mentre arrivano modifiche produce uno stato consistente, senza mescolare parti di revisioni diverse.
- [ ] Il ripristino conserva partecipanti, identità recuperabili, richiesta condivisa ed esito della prova, compresa la protezione dai reinvii già accettati.
- [ ] Il ripristino su una cartella dati vuota funziona con lo stesso file e permette di riprendere il proprio posto.
- [ ] Un file corrotto, non pertinente o con versione non supportata viene rifiutato senza modificare la sessione corrente.
- [ ] Prima di sostituire un tavolo esistente l'interfaccia ne mostra le conseguenze e richiede una conferma esplicita.
- [ ] I client già collegati vengono riallineati o invitati a recuperare il posto; nessuno continua ad agire silenziosamente su uno stato precedente al ripristino.
- [ ] Esportazione e importazione si usano dal browser anche su telefono, con messaggi di riuscita o errore.
- [ ] Una verifica dell'host copre esportazione/ripristino, file invalido e conservazione del tavolo precedente in caso di errore; il percorso nel browser viene verificato.

### Blocked by

Ticket 3 — Confermare azioni comuni dai telefoni con un unico esito.
