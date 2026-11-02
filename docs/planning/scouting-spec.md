# Scoperta e carte preparate persistenti

Incremento successivo alle prove abilità #25, integrate con PR #26 in `main`
(`666e1c6`). Il proprietario ha chiesto di continuare le issue del gioco.
Stesso stack, contenuti privati e confine HTTP reale già approvati.

## Contratto

- Solo il proprietario di un eroe della compagnia preparata può scoprirne le
  carte, scegliere il loro ordine o registrare lo scarto di una preparata.
- Scoperta X rivela le prime X carte, fra 1 e 15 richieste. Si applica quando
  una regola o un effetto già determinato dal gruppo lo richiede; non è un
  permesso aggiunto alle azioni del futuro turno.
- La ricomposizione con Scoperta 2 mescola prima mazzo e scarti, anche senza
  scarti, lasciando escluse le preparate. È l'operazione dell'eroe durante la
  riorganizzazione; questo incremento non introduce ancora le fasi del round.
- Durante Scoperta si può preparare zero o una delle rivelate. Ogni altra
  carta viene restituita sopra o sotto il mazzo, in ordine scelto: prima
  nell'elenco significa più vicina alla prossima pesca. Sono ammessi tutti
  sopra, tutti sotto o una divisione fra i due gruppi.
- Se la nuova preparata supera il limite di quattro, si sceglie esattamente
  una carta da scartare fra le cinque, inclusa quella appena preparata. Se
  non si supera il limite non si introduce uno scarto durante la scelta.
- Le debolezze sono preparabili e contano nel limite. La carta ruolo 1 può
  lasciare le preparate; rimane una delle quindici copie dell'eroe.
- Un comando separato registra lo scarto di una preparata quando un effetto
  già risolto dal gruppo lo richiede. Non automatizza la sua capacità.
- Una sola rivelazione resta aperta sul tavolo: prova abilità e Scoperta si
  escludono. Durante Scoperta non si scartano altre preparate. Il recupero
  non ripete pesca o mescolamento; la scelta pendente è nello stato salvato.
- Mazzo vuoto: si ricompongono soltanto gli scarti disponibili, anche a metà
  pesca. Se le carte disponibili sono meno di X si rivela il possibile.
  Preparate, mazzo, scarti e rivelate conservano sempre quindici copie.
- La sessione ordinaria non espone la sequenza coperta; espone le rivelate e
  le preparate. Le scelte dei moduli non vengono cancellate dal polling.
- Richieste con proprietà, generazione, revisione o scelta superate non
  modificano il tavolo. Reinvii identici restituiscono la stessa ricevuta.
- Lo schema passa a 4. Stati e backup 1/2/3, inclusi formati intermedi senza
  preparazione e prove abilità già aperte, migrano senza cambiare copie,
  ordine, identità o ricevute. Per un downgrade serve una copia precedente.
- La prova abilità mantiene anche il numero di carte disponibili al momento
  della pesca: il limite non resta fissato a 14 quando cambia la preparazione.
  La cronologia dell'ultima prova resta valida se poi una carta viene preparata.

## Fonti e limiti

[Rules Reference ufficiale](https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf),
§27.2 p. 12, §69 p. 20, §§73 e 76 p. 21, §81 p. 22, §112.4 p. 27,
verificati il 2 novembre 2026. Riga 23 della matrice delle regole.
Nessuna capacità viene inventata o certificata: effetti delle carte, round,
mappa, movimento, combattimento e avventure restano nei successivi incrementi.

## Verifica ed esecuzione

Implementazione nella sessione corrente con `implement` e `tdd`.

1. Test HTTP rosso per pesca e scelta con ordine esatto; aggiungere moduli
   `shared/scouting.ts` e `server/scouting.ts`, comandi e migrazione 4.
2. Un caso alla volta: quattro preparate e sostituzione, debolezze, scarto,
   ricomposizione, disponibilità variabile nelle prove, vincoli e reinvii.
3. SIGKILL durante scelta, recupero e backup su altro host; migrazioni 1/2/3
   e rifiuto atomico di copie, partizioni o stati pendenti incoerenti.
4. Interfaccia nello stile esistente, ordinamento utilizzabile al tocco e da
   tastiera, verifica reale desktop e 390 px con moduli stabili al polling.
5. Suite completa, typecheck, formattazione, revisione Standard/Spec e PR.
