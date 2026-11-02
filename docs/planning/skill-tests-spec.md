# Prove abilità e ispirazione persistenti

Incremento scelto il 2 novembre 2026 dalla sequenza già concordata in
[criteri di fedeltà](game-fidelity-checks.md), dopo la preparazione integrata
in `main` con le PR #13 e #24. Il proprietario ha chiesto di proseguire sul
prossimo lavoro eseguibile, prendendo le decisioni di implementazione necessarie.

## Risultato

Dal telefono un giocatore effettua una prova di caratteristica con uno dei
propri eroi preparati. Il PC condiviso osserva carte rivelate, conversioni ed
esito. Ogni passaggio sopravvive a ricarica, recupero, arresto e backup.

## Contratto

- Si mantengono Node 24.11.1–24.x, TypeScript, HTTP e SQLite esistenti, senza
  dipendenze aggiuntive o richieste Internet durante l'uso.
- Una sola prova alla volta sul tavolo. Soltanto il proprietario dell'eroe può
  iniziarla, spendere la sua ispirazione e concluderla. Il tavolo condiviso legge.
- La caratteristica è Forza, Saggezza, Agilità, Spirito o Ingegno. Prima della
  rivelazione si scelgono soglia positiva oppure semplice conteggio, e un
  modificatore intero fra −20 e +20 per un effetto già determinato dal gruppo.
- Si rivelano le prime carte in numero pari alla caratteristica modificata,
  minimo una; si ignorano i testi delle carte rivelate. Se non ci sono altre
  carte disponibili, si rivela il possibile senza includere le preparate.
- Un'ispirazione converte un fato non ancora convertito in un successo. Il
  comando converte un simbolo alla volta. L'ispirazione iniziale è zero; un
  controllo esplicito registra un'ispirazione ottenuta da un effetto già
  risolto dal gruppo, senza superare il limite stampato dell'eroe.
- La conclusione confronta il totale con la soglia, oppure restituisce il
  conteggio, poi scarta le carte rivelate. L'ultima prova resta consultabile.
- Quando il mazzo si svuota si mescolano gli scarti disponibili, anche se
  succede durante la pesca. Carte preparate e carte della prova in corso sono
  escluse dal rimescolamento. Il nuovo ordine viene salvato, mai ricreato al
  recupero. Nessuna equivalenza con il generatore dell'app ufficiale è assunta.
- Preparata, mazzo, scarti e rivelate conservano esattamente le quindici copie
  assegnate all'eroe. L'ordine coperto non compare nella sessione pubblica.
- Generazione, revisione, identità di richiesta e transazione esistenti
  proteggono tutti i comandi. Un reinvio identico restituisce la ricevuta;
  una richiesta superata o su un'altra prova è respinta senza modifiche.
- Lo schema diventa 3. Stati e backup 1/2 vengono migrati senza cambiare
  identità, ricevute, catalogo o ordine; nuovi campi iniziali: ispirazione zero
  e nessuna prova. Copie incoerenti sono rifiutate prima del ripristino.
- L'interfaccia conserva lo stile attuale, funziona a 390 CSS pixel, offre
  controlli di almeno 44 pixel, etichette leggibili e stato di connessione.
  I moduli non vengono ricreati dal polling mentre si stanno compilando.

## Fonti e limiti

[Rules Reference ufficiale](https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf),
§§38, 48, 76, 95 e 100, pp. 15–16, 21, 25–26, verificato il 2 novembre 2026;
[FAQ italiane](https://cdn.svc.asmodee.net/production-asmodeeit/uploads/2022/09/jme_faq_ita.pdf),
p. 2, distinzione fra spendere fato e ispirazione. Corrisponde alle righe 5–6
della [matrice delle regole](../research/rules-fidelity-matrix.md).

Questo incremento consegna le prove standard e il loro stato. Non automatizza
capacità di eroi/carte/oggetti, prove cumulative, attacchi, negazione del danno,
ultimi sforzi, turni, Scoperta, mappa o avventure. L'interfaccia espone questo
limite: non presenta il banco di prove come una campagna giocabile.

## Verifica

Confine già approvato: host HTTP reale, processi separati e SQLite reale;
catalogo sintetico pubblico, nessun testo privato aggiunto a Git.

Verificare pesca ed esiti, minimo una carta, fato insufficiente/già convertito,
limite ispirazione, proprietà e prova esclusiva, reinvii e concorrenza,
rimescolamento a metà pesca, conservazione delle copie e segretezza dell'ordine.
Arrestare durante conversione, recuperare il posto e completare senza ripescare;
esportare e ripristinare su un altro host. Rifiutare rivelate duplicate,
ispirazione fuori limite e copie mancanti anche con checksum ricalcolato.
Verificare browser desktop/mobile, tastiera, assenza di overflow e console.
La prova LAN fisica #5 resta distinta.
