# Attacco e provocazione dalla UI — #85

Base `a58a0607`, schema15. Autorità: contratti [75](../research/first-combat-runtime-contract.md),
[77](../development/first-combat-kernel.md), [81](second-shadow-spec.md) e
[83](../research/second-shadow-combat-runtime-contract.md); ADR2–3.
Originali e interpretazioni delle carte restano nella scratch ignorata.

## Risultato e confine

Il proprietario vivo di turno può scegliere un gruppo vivo e armi equipaggiate
con caratteristica comune, controllare costo e slot, annullare gratuitamente,
poi pagare e rivelare vere carte. Conversioni, capacità, spesa distinta dei
successi, scarto, figli dopo-prova, colpi, contrattacco e dopo-attacco terminano
con il ritorno al turno. Zero colpi è ammesso. Movimento e interazione risolvono
prima ogni provocazione dovuta e conservano il comando originale.

La vera attivazione Ombra e il seguito25 restano indisponibili prima dell'intera
fase. Nessuna chiusura33/65/57, nuova quantità fisica o parità RNG originale.

## Contratto di implementazione

- Estendere compiler, selezione e applicazione colpi77; riusare fronti P1/P2.
  Nuovo artefatto source-linked versionato, congelato nel pack prima dello
  startup. I run storici conservano pack e comportamento. Origine v2 sempre
  startup completo round1/Azione.
- Modelli, bonus, istruzioni e clausole della compagnia derivano dal freeze
  privato83, con hash e locator. Ordine e molteplicità delle popolazioni restano
  completi. Le statistiche delle figure81 non ricevono nuovamente i bonus.
- La selezione precede la distanza. Una selezione sospesa resta valida anche
  sotto il minimo di una nuova estrazione. Immunità e tratti usano enum distinti;
  sopprimere un modificatore conserva i colpi legalmente acquistati.
- Stato dei gruppi unico in scenario81: salute, esaurimento, riduzione e posa.
  Nessun callback o Sapienza per i gruppi senza logica; premio ordinario solo
  alla vera sconfitta completa, una volta, con destinatario vivo e cap.
- Controller e consumer fisico fanno parte del ledger v2 e di Store.once.
  Intenti strict/bounded prima delle letture; nessun importo, hit o esito libero
  dal client. Retry/stale/concorrenza non duplicano pagamenti o carte.
- Finestre prima-prova, conversioni, Assalto/Protezione, reazione eroe,
  Scoperta figlia con rivelate trattenute, dopo-prova e dopo-attacco conservano
  copia pagata e ritorno. Tutte le definizioni possedute sono disponibili al
  consumer quando diventano preparate; le capacità opzionali non supportate
  restano bloccate prima del proprio costo.
- Ogni attacco nemico conserva causa, destinatario, istruzione/hash, figure,
  ritorno e importi per famiglia: offerto, negato, prevenuto, subito direttamente.
  Registrare il subito al trasferimento; cure/scarti e figli non lo riscrivono.
  Chiudere fonte e discendenti prima di aggiunte/frontiera. P2 e reazioni senza
  priorità stampata ammettono l'ordine del gruppo e ricontrollano i limiti.
- Preflight di tutta la closure obbligatoria, anche candidati non estratti,
  prima dei costi. Riserva benefici sconosciuta distinta da vuota e dal possesso
  noto del soggetto. Consumo di un beneficio assente usa il ripiego stampato;
  guadagni non verificabili restano bloccati. Nessun filtro per ottenere verde.
- Contrattacco al medesimo attaccante al passo4; normale pronto/elite anche
  esaurito, Stordire effettivo, distanza viva, riduzione progressiva persistita.
  Provocazione solo pronto nella stessa casella, senza esaurimento o riduzione.
  Dopo figli ricalcolare legalità del ritorno e impedire nuove scelte agli sconfitti.
- UI personale utilizzabile a320/768/1024/1440, lettore/guida accessibili,
  tastiera/focus, attore e prossimo passo chiari. Coperte senza identità/ordine
  in viste/API/DOM/log ordinari; hash disponibili anche su HTTP IPv4.

## Prove necessarie

Test pubblici inventati RED→GREEN alle interfacce compiler, consumer, comandi,
replay e HTTP. Matrice privata indipendente dalle fonti83. Accettazione autentica
con tre identità, solo input browser nativi e filepicker: import pre-startup,
percorso originale, attacco completo e provocazione con ritorno. Nessuna write
API/SQL per avanzarla o manipolazione di seed. Restart/SIGKILL e restore packless
ai confini critici, alterazioni risignate respinte, compatibilità dei backup
storici autorizzati. Typecheck incrementale e una suite completa finale.

Prove proprie sigillate con input/byte/hash/comandi e limiti; distinguere runtime
autentico, fixture, baseline e tentativi falliti. Nessun accesso al tavolo protetto,
nessuna installazione, altro agente/checkout, push, PR o write GitHub.
