# Ripresa UI degli indizi — #89

Base `a96b0711bb8ea82355fac306029b5f11039e59e8`, schema16.
Contratto: [issue89](https://github.com/Ic3b3rg/lotr-table-game/issues/89),
[spec/piano residui](../planning/clue-ui-acceptance.md),
[implementazione90](clue-progression.md), [conclusione92](adventure-failure.md),
ADR2–3. Esecuzione personale nel checkout assegnato; review Standards/Spec
e integrazione spettano al root.

**Il minimo originale UI di89 non è raggiunto.** Nessun incontro-indizio è
stato impegnato o completato; nessun evento di indizio ha aggiornato il
principale. Il contatore resta3. Due indizi sono stati rivelati e
ispezionati gratuitamente dalla casella adiacente. Tre indizi,
rivelazioni conseguenti e covo non sono provati da questo episodio.

## Episodio e percorso

Un solo nuovo avvio autorizzato, tramite filepicker del freeze ante-startup,
con tre identità autentiche in tre BrowserContext propri. HTTP IPv4 senza
`crypto.subtle`, host/DB/profilo propri. Gli episodi precedenti89 e91 restano
distinti. L’import non costituisce il tavolo nuovo richiesto da33.

Il pack completo91 è stato ricompilato prima dello startup e confrontato
byte per byte:34 definizioni,196 stati,192 azioni,42 confini differiti;
fingerprint `0047087307ef2cdf1cd0c51aed5a3a62d116e94584bc729b9983e897455ce3b2`.
Scenario436061 byte, SHA256
`9a15ef82634468155c2f073176661b1e675032c40bc1120d12c5f106b7360b65`.
I quattro programmi configurati sono rimossi dopo startup e rimangono
assenti; le copie congelate sono identiche. Nessuna sostituzione live.

Il piano ante-startup usa soltanto carte preparate e istruzioni visibili.
Le Scoperte successive scelgono fra carte realmente rivelate, senza leggere
il mazzo futuro. Avanzamento e risultati provengono da controlli nativi e
carte; nessun Pass/Fail manuale, API/SQL write ausiliario o seed/pool alterato.

- Startup originale completo: tre Scoperte e tre prove iniziali.
- Round1: due tessere esplorate, ispezioni gratuite con annullamento e stato
  intero invariato; interazione iniziale disponibile conclusa con prove vere,
  conversione del fato e rimozione del segnalino. Primo passaggio a minaccia6.
- Round2: seguito originale del timer, nuovo obiettivo di ricerca con tre
  tracce richieste e nuova sezione. Sono effetti del timer, non di un indizio.
  Prove di gruppo, conversioni e collocazioni reali; minaccia effettiva15.
- Round3: altre tre tessere esplorate e due indizi ispezionati. I due eroi al
  centro combattono il nemico presente; spese dei successi, contrattacchi,
  figli fisici, rimozione di un gruppo e premio di ispirazione sono registrati.
  Una capacità preparata converte il fato e concede Scoperta1; viene preparata
  una Protezione2 autentica. Tutti e tre gli eroi restano vivi.
- Fine round3/Azione: tutti i turni conclusi, nessuna richiesta aperta. La
  prossima Ombra viene respinta prima di iniziare. Nessun turno aggiuntivo o
  checkpoint precedente viene usato per modificare le scelte.

## Confine corrente

Il gruppo nemico ancora pronto ha una figura. La sua popolazione completa
contiene12 istruzioni,10 ammissibili per la dimensione corrente; un ramo
ammesso richiede acquisizione di benefici. Il movimento primario può
raggiungere due eroi: non è un’alternativa irraggiungibile da eliminare.

`preflightSourceShadow` → `preflightActivations` →
`preflightCombatOperation` → `preflightCombatGroup` restituisce
`boon-quantities-57` e l’HTTP409 `ROUND_SOURCE_CAPABILITY`. Il controllo
precede inizializzazione della fase, scelta dell’istruzione, movimento,
carte, timer e minaccia. Non è stata estratta l’istruzione del ramo bloccante.
Il ricontrollo bounded della primaria consuma integralmente244 byte, con
accordo C/Python, e verifica la corrispondente chiave italiana contro il
pack congelato. Locator, parametri e output completi restano privati.

57 è una decisione già risolta: mantenere il gate fino a quantità verificate.
Il consumer di acquisizione è inoltre un confine successivo esplicito del
codice. Non sono introdotte quantità, domande, filtri del pool, nuovi motori
o modifiche ai limiti. Questo stato corrente non consente il passaggio al
round successivo; non si deduce che ogni possibile percorso abbia lo stesso
blocco. La minaccia resta15, sotto40/48/55 e64; non si tratta di sconfitta.

Il gate finale del covo rimane quello integrato, precedente al costo.
Non essendo raggiunto, non viene presentato come una prova UI di questa run.

## Prove, tentativi e limiti

Due richieste native concorrenti della fase sono respinte con409, mantenendo
identico l’intero payload, comprese ricevute e casualità. Sono prove di
concorrenza al rifiuto; non certificano la concorrenza di un premio d’indizio.

SIGKILL/reload packless a startup e confine corrente conservano il payload
integrale. Il restore usa il percorso esatto della ricevuta dell’export155,
verificandone hash, revisione e round/fase; produce soltanto la revisione
amministrativa156. Gameplay, origine round1/Azione, gruppi, mazzi, RNG e
ricevute sono identici. Nessun rewind o gameplay dopo un restore precedente.
Sei backup alterati con checksum ricalcolato sono realmente confermati nel
filepicker e respinti con422, stato e ricevute invariati. Un settimo restore
negativo confermato termina nel timeout client, senza stato modificato:
non è contato tra i sei422. L’ottavo caso predisposto non è inviato.

La QA valida riguarda lo stato raggiunto:12 combinazioni dei tre proprietari
e320/768/1024/1440, guida, lettore, Tab/Escape e ritorno del focus;36 PNG reali,
assenza di overflow e payload invariato. I rettangoli del lettore sono dentro
il viewport e sono state ispezionate direttamente catture a320 e1440 e la
guida a768. Le prime catture del lettore precedevano la fine dello scorrimento
e restano conservate/escluse; i nomi dei file non valgono come prova visuale.

Il driver iniziale ha concluso una prova di gruppo senza usare una capacità
preparata offerta e ha poi scelto di subire senza usare una prevenzione
offerta: due danni sono rimasti applicati. Le scelte legali sono conservate,
senza correggerle retroattivamente. Il driver successivo si ferma sulle
alternative da valutare. Altri tentativi di helper sono esclusi quando non
inviano comandi: etichetta/selettore non corrispondente, controllo disabilitato,
download non partito o contesto nascosto. Il restore155→156 era già applicato
quando il recupero identità si è fermato; sono stati completati soltanto i
recuperi e il confronto integrale, senza un secondo restore. Le finestre e
il focus nativo corretti appartengono esclusivamente al browser del task.

Il prodotto non cambia funzionalmente. Il validatore corrente riconvalida
75 payload nativi distinti da96 file, compresi i salvataggi catturati dai
tentativi di helper: payload e ricevute interamente identici, unica origine
round1/Azione. Gli80 input copiati sono identici per byte/hash. Build corrente,
controlli di script/documentazione, formato,
diff e privacy sono le verifiche di questa consegna. La suite662 della base
verificata non viene ripetuta per soli rapporti; la compatibilità storica
resta quella verificata in PR92. Nessun nuovo test sintetico sostituisce
il criterio originale mancante, né vengono ripresi stati precedenti per
simulare i confini di costo/prova/evento/rivelazione dell’indizio non giocato.

Export finale156 confrontato integralmente prima della chiusura dei tre
contesti, del browser, dell’osservatore e dell’host propri. Originali,
identità, input, comandi, tentativi e sigillo restano nella scratch ignorata,
anche nella storia Git. Nessun altro agente/checkout, installazione,
push/PR o scrittura GitHub. Tavolo protetto intoccato.

#89 rimane aperta per l’accettazione originale.33/65/57 rimangono aperte;
nessuna partita completa, vittoria, campo aggiuntivo o A2 è dichiarata.
