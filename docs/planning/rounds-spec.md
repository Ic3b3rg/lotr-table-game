# Turni e fasi persistenti della compagnia

Incremento successivo a Scoperta #27. La PR #28 è stata unita prima di iniziare,
su richiesta del proprietario: base `main` a `b3088ba`.

## Contratto

- Dopo la preparazione e senza rivelazioni pendenti, un partecipante può
  avviare i round con conferma del gruppo. I salvataggi precedenti conservano
  la modalità delle prove indipendenti finché il gruppo non avvia i round.
- Ogni round contiene Azione, Ombra e Riorganizzazione. Un identificativo
  distinto accompagna ogni round; un altro identifica il turno in corso.
- Il gruppo concorda l'ordine degli eroi. Il proprietario avvia un proprio
  eroe non ancora concluso; un turno termina prima dell'inizio del successivo.
  Nessuna iniziativa deriva dal dispositivo o dalla velocità delle richieste.
- Ogni turno permette zero, una o due azioni, anche ripetute. Per questo
  incremento è disponibile l'interazione con prova: avvia la prova standard
  e consuma una sola azione nella stessa transazione. Viaggio e attacco
  verranno collegati ai rispettivi motori; non si registrano azioni fittizie.
- Soltanto il proprietario dell'eroe attivo avvia un'interazione o termina il
  turno. Un'interazione rifiutata non consuma azioni. I reinvii non consumano
  altre azioni. Con una prova o Scoperta aperta non si chiude turno o fase.
- Le prove e Scoperta richieste da effetti, già determinati dal gruppo, non
  consumano azioni. Le prove generiche restano possibili in Azione e Ombra;
  le finestre precise delle capacità seguono con il motore degli effetti.
- Dopo tutti gli eroi, qualsiasi partecipante può aprire Ombra con conferma
  del gruppo. Attivazione nemica, oscurità e minaccia sono tre passaggi
  distinti nell'ordine ufficiale. Il gruppo li risolve o ne verifica la non
  applicabilità e conferma ciascuno. Questo incremento non calcola nemici,
  paura, minaccia o soglie: la limitazione è visibile nell'interfaccia.
- La terza conferma avvia Riorganizzazione: tutti gli eroi ricompongono i
  mazzi nella stessa transazione, anche senza scarti. Solo dopo si scoprono
  due carte per ogni eroe, in ordine concordato. Ogni eroe lo fa una volta.
  La Scoperta già implementata prepara fino a una carta, impone il limite e
  restituisce le altre nell'ordine scelto; non rimescola una seconda volta.
- Durante Riorganizzazione sono ammesse soltanto le Scoperte dedicate: niente
  prove generiche, Scoperta libera, scarti manuali o ricomposizioni ripetute.
  Completata la Scoperta di tutti e senza richieste pendenti, una conferma
  comune apre il round successivo con budget azioni e progressi azzerati.
- Restano distinti giocatore, eroe e dispositivo: solitario 2–4 eroi e gruppi
  2–5; recuperare il posto conserva turno, contatori e scelte pendenti.
- Generazione, revisione, identificativi di round/turno/richiesta, ricevuta e
  salvataggio atomico proteggono tutti i comandi. Backup incoerenti sono
  rifiutati senza sostituire il tavolo.
- Lo schema diventa 5. Stati e backup 1/2/3/4, compresa Scoperta aperta e
  formati intermedi, migrano con `round: null`, senza ripescare o riordinare.
  Le vecchie rivelazioni sono indipendenti dai round. Downgrade con backup
  precedente all'aggiornamento.
- Interfacce PC e telefono mostrano fase, eroe attivo, azioni e progressi.
  La vista condivisa osserva; tutte le conferme sono disponibili dai telefoni.
  Moduli e focus rimangono stabili al polling e durante riconnessione.

## Fonti e perimetro

[Rules Reference ufficiale](https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf),
§§2–3 p. 6, §§73 e 76 p. 21, §79 p. 22, §83 p. 23, verificati il
2 novembre 2026. Contratto di gruppo e salvataggio: ADR-0002.
Questo è il coordinamento dei round, ancora separato da mappa, combattimento,
effetti automatici dell'Ombra e campagna giocabile. La conferma manuale dei
passaggi dell'Ombra è una scelta di questo incremento, non un comportamento
automatico attribuito all'app ufficiale.

## Piano e verifica

`implement` e `tdd`, confine approvato dell'host HTTP reale; nessuna nuova
dipendenza. Test pubblici con contenuti inventati.

1. Round, turno e transizioni di Azione: test rosso, stato e comandi tipizzati,
   budget per interazione, proprietà, zero/due azioni, esclusione e reinvii.
2. Passaggi di Ombra, ricomposizione collettiva e Scoperta una volta per eroe;
   nuovo round soltanto a completamento. Verificare copie e ordine.
3. SIGKILL e ripristino durante turno, Ombra e Scoperta di Riorganizzazione;
   migrazione 4 aperta, formati 1/2/3 e rifiuto di stati incoerenti.
4. Interfaccia e prove reali desktop/390 px, compresa interazione con costo.
   Suite completa, typecheck, formattazione, revisione Standards/Spec e PR.
