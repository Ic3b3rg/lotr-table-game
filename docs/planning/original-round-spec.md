# Primo round originale — #79

Base `6efeb876a839d3f57c47045b6c16901de89ac2c0`, schema15. Il risultato è
il percorso senza gruppi nemici: tre turni conclusi, prima Ombra effettiva,
Riorganizzazione dei tre proprietari, round2/Azione e primo turno legale.
Combattimento, benefici, ulteriori rami, finale e #33 restano separati.

La nuova capacità `source-rounds-v1` è facoltativa, versionata e congelata
nel pack fonte. I pack pubblicati restano immutabili e conservano il gate.
L'accettazione parte dal freeze precedente allo startup, importato tramite
UI; nessun run storico viene reinterpretato o migrato sul tavolo utente.
L'origine del ledger v2 rimane lo startup completo round1/Azione.

Il compiler attesta dati del controller, configurazione normale, binding
globali, proprietà native delle caselle, token e receiver. A `06003902`
possiede l'ordine: attivazioni, oscurità, ROUND_END ai timer e al principal,
minaccia, soglie, refresh, Riorganizzazione, incremento round, ROUND_START.
Il tick non dipende dalla visibilità. Le dipendenze raggiunte sono verificate
su copie private delimitate; non si ricostruisce tutta l'avventura.

Prima di iniziare Ombra si verifica su uno stato separato l'intero seguito
fonte deterministico: receiver mancanti, scadenze, soglie, perdita e capacità
non disponibili bloccano prima di tick, pesca o delta. Le diramazioni derivano
dalle variabili vive, senza scorciatoia sul numero del round. Le attivazioni
vuote e l'assenza di oscurità si eseguono senza conferme fittizie. La sola
presentazione della minaccia separa il calcolo dal suo aggiornamento fonte.

L'oscurità deriva da posizione, proprietà native, token e flag/override;
negazione, prevenzioni, fronti, reazioni e P2 riusano il consumer fisico.
Il percorso originale verificato non è in oscurità; una fixture inventata
deve esercitare il caso positivo. Il reset e Scoperta usano lo stesso consumer,
compresi limiti, ordine sopra/sotto e hook. Ogni proprietario risolve il proprio
eroe. Il nuovo round attende tutti i completamenti.

Frame, eventi, RNG fisico, carte, richieste, risultati e ricevute sono output
del comando nella stessa Store.once. Replay confronta tutti gli output;
restart e restore packless conservano anche i pending. Mappa, casualità del
generatore, obiettivo, indizi e Lore estranei al passaggio restano invariati.
I fingerprint derivati sono calcolati sull'host, anche su HTTP LAN.

La UI segue lo stile esistente, nomina il prossimo passo e chi deve agire,
consente guida e lettore e spiega le attese. Nessuna identità delle carte
coperte o ordine del mazzo viene esposto nelle viste ordinarie.

Prove: TDD alle interfacce compiler/HTTP/SQLite/replay, fixture pubbliche
inventate e oracle primario privato distinto; minaccia con token attivo/nascosto
e tessere esplorate/inesplorate; ownership, concorrenza e richieste stale;
SIGKILL/restore nei confini e alterazioni coerentemente risignate.
Accettazione nativa con tre identità, viewport320/768/1024/1440, HTTP IPv4
senza WebCrypto, nessun avanzamento tramite API/SQL. Host/profili/PID propri.
Suite completa una volta finale, typecheck incrementale, formato/diff/privacy,
sigillo privato con byte/SHA e commit locali. Review e integrazione al root.
