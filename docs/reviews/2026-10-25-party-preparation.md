# Preparazione della compagnia — revisione indipendente

Due revisori freschi hanno esaminato separatamente gli assi **Standards** e **Spec** del diff fissato `1882195…6e481e9`, prima delle correzioni finali. Specifica: [preparazione della compagnia](../planning/party-preparation-spec.md). Nessun corpus originale è incluso nel diff.

| Asse | Rilievi dimostrati | Risoluzione verificata |
| --- | --- | --- |
| Standards | P2: polling aggiorna la revisione inviata da un modulo rimasto vecchio; P2: il chiamante di una carta annidata viene rimosso e il focus non torna | Revisione del modulo conservata fino al riallineamento; rifiuto visibile; chiamante esterno persistente e destinazione alternativa connessa |
| Spec | Stessi due P2, riprodotti anche sulla conferma definitiva; nessuno scope creep dimostrato | Prove browser prima/dopo: 200 con sovrascrittura → 409 senza sovrascrittura; perdita focus → ritorno al pulsante esterno |

Il revisore Standards non ha rilevato ulteriori violazioni certe delle convenzioni documentate. Ha indicato come facoltativa la possibile duplicazione dei controlli sull'equipaggiamento iniziale tra catalogo e preparazione. È differita: le due validazioni presidiano input e stato salvato, i test verificano i vincoli; non è stato dimostrato un difetto funzionale. La correzione dei P2 è stata verificata dal costruttore con il vero host e Chromium, senza dichiarare una seconda revisione indipendente del codice.

## Interfaccia

Il reviewer shipped `impeccable_finish_reviewer`, fresco e in sola lettura, ha esaminato catture complete desktop e telefono, sorgenti, PRODUCT.md e DESIGN.md. Palette, tipografia e materiale sono risultati coerenti; la disposizione desktop/mobile è un adattamento alla specifica approvata. L'estensione conserva la lobby esistente. Mancavano una carta QUALITY BAR e un contratto THESIS–FORM separati: il reviewer ha dichiarato il limite e valutato il brief di estensione.

La prima disposizione è stata **fix** per M1: il rifiuto di un salvataggio poteva mostrare errore e recupero fuori schermo sul telefono. Correzione: focus e scroll istantaneo all'alert, input conservati e blocco del riallineamento automatico durante il polling. Il successivo verdict pass indipendente ha valutato M1 **resolved**, senza regressioni introdotte rilevate, **disposition: ship**. Il verdetto riguarda questa correzione elencata, non una nuova revisione generale della superficie.

L'etichetta tecnica del catalogo è stata segnalata come rifinitura facoltativa ed è conservata per identificarne la versione congelata. Il detector è stato eseguito una sola volta; i rilievi della lobby fuori perimetro non sono stati trasformati in un ridisegno. Padding e contrasti della nuova area sono stati controllati; il rilievo sul padding non risultava confermato.

Il documenter shipped `impeccable_documenter` ha confrontato il sistema con cinque artefatti e concluso **No changes**: palette, Cormorant locale, lettura 14–16 px, comandi 44–48 px, carte e comportamento del focus coerenti. Formato storico di DESIGN.md, sidecar assente e sollevamento hover già esistente sono riportati come drift preesistente, senza normalizzazione non richiesta. PRODUCT.md è aggiornato allo stato implementato.

## Verifica e limiti

[Evidenze dell'host e dei browser](../testing/party-preparation-verification.md): 29/29 test, typecheck e formattazione superati. Catalogo reale riprodotto con fonti immutate. Restano quattro testi con verifica incompleta e le prove fisiche del [ticket 5](https://github.com/Ic3b3rg/lotr-table-game/issues/5). Nessuna revisione attesta ancora gli effetti delle carte o una campagna giocabile completa.
