# Preparazione della compagnia — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking. Esecuzione nello stesso percorso autorizzato dal proprietario, con revisione indipendente finale.

**Goal:** scegliere eroi, ruoli e oggetti reali da PC e telefoni e ottenere mazzi iniziali esatti, salvati e recuperabili.

**Architecture:** estendere l’host e la UI esistenti con un catalogo privato validato e una preparazione autoritativa sull’host. Il salvataggio contiene catalogo testuale, assegnazioni e copie ordinate; la proiezione pubblica non espone l’ordine dei mazzi coperti. I comandi usano le ricevute idempotenti e le transazioni già presenti.

**Tech Stack:** Node 24, TypeScript, Zod, SQLite nativo, esbuild, HTML/CSS e DOM; test HTTP con node:test.

**Spec:** [Preparazione della compagnia con carte reali](party-preparation-spec.md).

## Global Constraints

- Nessun nuovo framework, servizio Internet o dipendenza di runtime.
- Sei eroi Base, sei ruoli; solitario 2–4 eroi, gruppi 2–5 persone con un eroe ciascuna.
- Massimo due mani e un’armatura per eroe, sole copie Base di rango I alla partenza; nessun monile non acquisito.
- Quindici carte iniziali: sei Base, cinque eroe, tre ruolo, una debolezza; ruolo 1 preparato e quattordici coperte.
- Originali, traduzioni integrali, immagini originali e salvataggi rimangono privati e ignorati da Git.
- Ogni testo conserva provenienza e stato della verifica; Guardian 1 conserva l’eccezione documentata.
- Salvataggio dopo ogni comando accettato; nessun nuovo mescolamento durante lettura, polling o ripristino.
- Sessioni e backup precedenti migrabili; versioni sconosciute rifiutate senza sostituire lo stato.
- Interfaccia italiana, tastiera e focus leggibili, obiettivi tattili di almeno 44 pixel, prefers-reduced-motion.

## Review Focus

1. Un pacchetto aggiornato o assente al riavvio non deve cambiare nomi, carte o copie di una compagnia già salvata.
2. Un secondo partecipante che entra mentre il primo aveva selezionato più eroi deve ricevere una preparazione correggibile, senza cancellazioni automatiche; la conferma impone un eroe per persona.
3. Due telefoni che scelgono l’ultima copia di un oggetto devono ottenere un solo proprietario e un rifiuto comprensibile per l’altro.
4. Un arresto dopo la conferma, prima che il telefono riceva la risposta, non deve creare un secondo mazzo al reinvio.
5. Un backup con riferimenti validi come stringhe ma copie/ruoli incoerenti deve essere rifiutato prima di modificare il tavolo.

## File structure and interfaces

Seguire l’organizzazione attuale; non importare il motore sintetico del prototipo.

- `src/shared/catalog.ts`: `CatalogSchema`, `LocalizedTextSchema` e tipi `Catalog`, `HeroDefinition`, `SkillDefinition`, `ItemDefinition`. Identificativi di definizione stabili; numero stampato e quantità separati dagli identificativi dei modelli dell’app. Testo: valore, tipo originale/traduzione, fonte e verifica. Il catalogo include versione, fonti con hash, sei riferimenti Basic e venti riferimenti alle debolezze fisiche. I riferimenti a immagini sono opzionali e limitati a nomi sicuri.
- `src/server/catalog.ts`: `loadCatalog(path: string): Catalog`, validazione anche semantica di riferimenti, quantità, appartenenza e gruppi iniziali. Il pacchetto viene letto solo come input locale e congelato nel salvataggio. Asset opzionali serviti per nome con allowlist, senza accesso arbitrario al filesystem.
- `src/shared/preparation.ts`: schemi `PreparationSchema` e `PreparationViewSchema`, tipi di assegnazione, copie fisiche e mazzi. `status` distingue `draft` e `prepared`; ogni eroe appartiene a un partecipante. Nella vista pubblica i mazzi sono conteggio e composizione, senza sequenza.
- `src/server/preparation.ts`: `applyPreparation(state: State, playerId: string, command: PreparationCommand): void`; validazione della scelta e della conferma finale; mescolamento Fisher–Yates con `randomInt` dell’host.
- `src/shared/protocol.ts`, `src/server/state.ts`, `store.ts`, `commands.ts`, `identity.ts`, `backup-format.ts`, `main.ts`: integrazione catalogo, stato e viste, migrazioni, comandi, blocco nuovi posti dopo conferma e API di consultazione.
- `src/client/company.ts`, `cards.ts`, `app.ts`, `index.html`, `style.css`: area compagnia/personale e dettaglio carte. `createCompany(): { update(session: Session, player: Player | null): void }` integra il polling esistente; dettaglio carta conserva focus e ritorno al controllo chiamante.
- `tests/catalog.test.mjs`, `preparation.test.mjs`, `preparation-recovery.test.mjs`, `fixtures/catalog.mjs`: prove comportamentali sul vero host con dati esclusivamente sintetici.
- `scripts/` e documentazione operativa: importatore riproducibile dai materiali privati e istruzioni del percorso locale. Python può essere usato per la lettura offline degli input, senza diventare dipendenza dell’host distribuito.

### Task 1: Catalogo privato consultabile dal tavolo

**Deliverable:** il vero host mostra eroi e carte del pacchetto locale e distingue contenuto assente, tradotto e incerto.

**Interfaces:** `CatalogSchema` e `loadCatalog(path)`; `GET /api/catalog` restituisce il catalogo congelato o uno stato assente esplicito. La sessione pubblica ne espone solo metadati/versione; le immagini opzionali usano un endpoint limitato ai nomi autorizzati.

- [ ] Scrivere `catalog.test.mjs`: pacchetto valido visibile da un client; catalogo assente non rompe la lobby; riferimento mancante, copie incoerenti e percorso immagine non sicuro rifiutati; dopo riavvio con input diverso rimane il catalogo salvato.
- [ ] Eseguire build e test mirati; verificare fallimento per comportamento ancora assente.
- [ ] Implementare validazione, acquisizione persistente e proiezione; aggiornare schema con migrazione della sessione precedente senza cambiare identità e ricevute.
- [ ] Aggiungere catalogo e dettaglio carte responsive con provenienza consultabile, originale/traduzione distinti, focus e chiusura da tastiera.
- [ ] Acquisire dai materiali locali il pacchetto reale necessario a questa specifica: controllare gli hash, preservare le associazioni candidate, tradurre con confronto degli effetti e conservare una ricevuta privata e un rapporto pubblico senza corpus. Non spostare né modificare gli originali.
- [ ] Eseguire `npm run typecheck`, `npm run build`, `node --test tests/catalog.test.mjs` e verificare nel browser il catalogo reale. Committare solo codice, fixture sintetiche, istruzioni e metadati pubblicabili.

### Task 2: Scelta persistente di eroi, ruoli ed equipaggiamento

**Blocked by:** Task 1.

**Deliverable:** ogni partecipante configura i propri eroi e tutti vedono la stessa compagnia senza doppie assegnazioni.

**Interfaces:** comandi `SELECT_HEROES` con lista di eroi propri e `CONFIGURE_HERO` con eroe, ruolo e lista di copie oggetto. Entrambi hanno generazione, identificativo richiesta e revisione attesa; restituiscono una ricevuta di preparazione. Le copie sono identificatori stabili della definizione più indice fisico, non nomi o quantità libere.

- [ ] Scrivere test HTTP: solitario 2/3/4, cinque persone, selezione concorrente dello stesso eroe/ruolo/ultima copia oggetto, rango II illecito, tre mani, seconda armatura, modifica di eroe altrui e stato superato. Controllare nessun aggiornamento parziale.
- [ ] Eseguire build e test per osservare il fallimento previsto.
- [ ] Implementare assegnazioni e configurazioni atomiche, proposte iniziali dai suggerimenti disponibili, controllo quantità e disponibilità. Scegliere un ruolo non raccomandato deve funzionare.
- [ ] Implementare UI personale con selezione, salvataggio e riepilogo; gli altri eroi sono consultabili. Se un nuovo ingresso rende incompleta la composizione, spiegare come correggerla senza cancellare eroi automaticamente.
- [ ] Verificare ricarica, recupero da cookie diverso e riavvio dell’host con le stesse assegnazioni. Eseguire typecheck e test mirati, poi commit.

### Task 3: Mazzi iniziali definitivi, ripresa e backup

**Blocked by:** Task 2.

**Deliverable:** una conferma comune crea i mazzi una sola volta; PC e telefoni ritrovano carte e stato esatti dopo ripresa o importazione.

**Interfaces:** comando `PREPARE_COMPANY` con revisione attesa e conferma del gruppo. Ricevuta persistente distinta da quella della demo. Catalogo e `PreparationSchema` completi entrano nel backup; la vista pubblica conserva solo composizione non ordinata e conteggi.

- [ ] Scrivere prove: quindici carte per eroe e quattordici coperte, carta ruolo 1 preparata, copie distinte di abilità con identico nome/modello, debolezze senza reinserimento. Conferma con partecipante senza eroe o solitario con un solo eroe rifiutata.
- [ ] Scrivere prove concorrenti e recupero: due conferme simultanee, reinvio dello stesso intento dopo SIGKILL/riavvio, vecchia generazione, nuovo ingresso dopo conferma, recupero ancora valido. Confrontare identificatori e ordine tramite backup prima e dopo.
- [ ] Scrivere prove importazione: precedente backup di sessione migrabile, backup attuale su host vuoto senza pacchetto input, versione sconosciuta e riferimenti/copie incoerenti rifiutati senza sostituzione; nessun ordine coperto nella risposta pubblica.
- [ ] Eseguire test e osservare i fallimenti; implementare validazione, estrazione debolezze e mescolamento, salvataggio e ricevuta atomici, proiezione e migrazioni dei backup.
- [ ] Mostrare preparata, mazzo coperto con conteggio e composizione consultabile, oggetti e capacità dell’eroe. Rendere chiaro che la preparazione è completata e il motore dell’avventura segue nel prossimo incremento.
- [ ] Eseguire `npm test`, `npm run typecheck`, `npm run format:check`; verificare da browser desktop e telefono preparazione reale, ricarica e recupero, tastiera, movimento ridotto e console/rete. Documentare risultati effettivi e prove fisiche ancora pendenti.
- [ ] Committare; eseguire revisione indipendente degli assi specifica e standard sul diff completo, correggere i difetti dimostrati e ripetere solo le verifiche pertinenti. Aprire PR sulla fondazione e collegarla al thread T3; mantenere le issue aperte fino all’integrazione secondo il tracker.

## Plan self-review

La copertura delle user story è distribuita su catalogo (1–3, 19, 22), compagnia (4–10, 16, 20–21) e mazzi/ripresa (11–18). I cinque rischi di Review Focus hanno prove nei task 1–3. Contratti e nomi sono coerenti tra task; le scelte di presentazione che non alterano il contratto restano al costruttore. La revisione builder della specifica del 25 ottobre 2026 non ha trovato domande indispensabili rimaste aperte.
