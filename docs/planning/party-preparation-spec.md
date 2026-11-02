# Preparazione della compagnia con carte reali

## Problem Statement

Il tavolo locale conserva partecipanti e una prova tecnica, ma non gli eroi e i componenti necessari a una partita reale. Il proprietario ha approvato il 25 ottobre 2026 i [criteri di fedeltà](game-fidelity-checks.md) e l’avvio da eroi, ruoli, equipaggiamento e mazzi persistenti. Il risultato finale resta tutta la scatola base e Le Ossa di Arnor.

## Solution

Sul tavolo esistente, PC e telefoni mostrano la compagnia e un’area personale per scegliere eroi, ruolo e oggetti iniziali. La preparazione assegna copie fisiche disponibili, prepara la carta ruolo 1 e mescola una sola volta le altre quattordici carte. Scelte, carte e ordine dei mazzi sopravvivono a ricarica, recupero del posto, riavvio e backup. La schermata usa la direzione visiva approvata: ritratti, carte leggibili, colori e movimento discreto coerenti con il diorama 2.5D.

## User Stories

1. Come giocatore voglio consultare i sei eroi della base e le loro caratteristiche per scegliere chi impersonare.
2. Come giocatore voglio leggere in italiano abilità, carte e oggetti, riconoscendo testo originale e traduzione verificata.
3. Come giocatore voglio vedere provenienza e discrepanze di una carta senza confondere un’ipotesi con una fonte confermata.
4. Come giocatore voglio scegliere un eroe ancora disponibile e ritrovarlo al successivo accesso.
5. Come giocatore solitario voglio controllare da due a quattro eroi con aree e mazzi separati.
6. Come gruppo di due a cinque persone vogliamo un eroe per persona, anche quando una persona usa più dispositivi.
7. Come giocatore voglio scegliere liberamente un ruolo disponibile; il suggerimento dell’eroe non deve diventare un obbligo.
8. Come giocatore voglio ricevere gli oggetti iniziali consigliati e poterli cambiare prima della preparazione definitiva.
9. Come gruppo vogliamo rispettare le copie disponibili, il rango iniziale e i limiti di armatura e mani senza ottenere monili non ancora acquisiti.
10. Come giocatore voglio modificare solo i miei eroi; le scelte comuni concordate restano confermabili da qualsiasi partecipante.
11. Come gruppo vogliamo una conferma della preparazione che controlli tutti gli eroi prima di creare i mazzi.
12. Come giocatore voglio ricevere sei carte base, cinque eroe, tre ruolo e una debolezza dalla riserva mescolata.
13. Come giocatore voglio vedere la carta ruolo 1 preparata e le altre quattordici nel mazzo coperto.
14. Come giocatore voglio consultare la composizione del mazzo senza rivelare l’ordine coperto.
15. Come gruppo vogliamo che due conferme simultanee o il reinvio della stessa richiesta producano un solo risultato.
16. Come giocatore voglio recuperare il posto su un altro dispositivo senza perdere l’associazione ai miei eroi.
17. Come gruppo vogliamo recuperare esattamente carte, ordine e scelte dopo un arresto dell’host, senza un nuovo mescolamento.
18. Come gruppo vogliamo esportare e ripristinare una copia completa, compreso il catalogo testuale necessario a leggere la partita.
19. Come proprietario voglio aggiornare il software senza reinterpretare una partita usando una nuova versione dei contenuti.
20. Come utilizzatore da telefono voglio carte espandibili, controlli da almeno 44 pixel e un’interfaccia senza scorrimento orizzontale obbligatorio.
21. Come utilizzatore della mappa condivisa voglio osservare tutta la compagnia dal PC senza occupare un posto giocatore.
22. Come proprietario voglio mantenere materiali originali e traduzioni private fuori dalla repository pubblica.

## Implementation Decisions

- Si estende l’host Node 24 con SQLite e il client TypeScript già esistenti, senza servizi Internet o nuovi framework. Il prototipo rimane una fonte di direzione visiva sul proprio ramo; i suoi valori e combattimenti dimostrativi non diventano regole.
- Il catalogo privato è un pacchetto locale versionato e validato: sei eroi, sei ruoli, carte iniziali base/eroe/ruolo, venti debolezze e oggetti della base nei tre ranghi. I ranghi successivi sono consultabili, non ottenibili alla partenza. Ruoli avanzati, titoli e famiglie non necessarie alla preparazione possono essere aggiunti senza dichiarare già completa la scatola da 343 carte.
- Ogni definizione distingue identificativo fisico, numero stampato, quantità e associazione al modello dell’app. Ogni testo distingue originale italiano e traduzione dall’Excel con fonte, hash e stato della verifica. Nessun dato Custom o di espansione entra implicitamente nel catalogo Base. L’eccezione Guardian 1 resta esplicita e consultabile; la sua identità consente la preparazione, ma l’effetto non viene certificato o automatizzato.
- Il pacchetto viene acquisito dai materiali locali già forniti, senza modificarli, e conservato privatamente sull’host. Ritratti e icone, se disponibili, sono risorse locali opzionali; la partita resta leggibile tramite testo anche senza immagini. Nessun originale, traduzione integrale o salvataggio viene aggiunto a Git.
- Il salvataggio congela una copia del catalogo testuale usato, così un aggiornamento dell’input non modifica la partita. Il backup include questa copia. Le immagini possono essere reinstallate e non sono richieste per ripristinare lo stato.
- In preparazione ciascuno modifica i propri eroi. Finché il tavolo ha una sola persona può sceglierne fino a quattro; con più persone la conferma finale richiede un eroe per partecipante. Eroi e copie ruolo non sono condivisi: i vincoli derivano dalla disponibilità fisica delle carte. Le scelte incomplete restano salvabili ma non confermabili.
- L’equipaggiamento iniziale usa gli oggetti Base di rango I che occupano mani o armatura: al massimo due mani e un’armatura per eroe, rispettando le copie dell’intera compagnia. I suggerimenti sono modificabili; non si aggiungono monili alla riserva prima di averli ottenuti. Riferimenti: manuale italiano p. 4; Rules Reference pp. 5, 14 (§34).
- La conferma comune controlla la composizione del gruppo e tutti i componenti, poi assegna le debolezze da una riserva di venti carte mescolata e mescola i mazzi. La carta ruolo 1 è preparata; sei base, cinque eroe, ruolo 2–3 e una debolezza formano le quattordici carte coperte. Riferimenti: manuale pp. 4–5; Rules Reference pp. 5, 22–23 (§78, §84–85).
- Il mescolamento è una permutazione uniforme con casualità dell’host; si salva il risultato. Non si rivendica lo stesso generatore o lo stesso ordine dell’app ufficiale. Identità di copia e ordine restano nello stato privato dell’host; i client ricevono preparata, composizione e conteggi, non la sequenza coperta.
- Dopo la conferma gli eroi della compagnia sono fissati e nessun nuovo posto può entrare; il recupero dei posti esistenti resta disponibile. I cambi di ruolo al campo e una nuova campagna sono incrementi successivi.
- Ogni comando riusa generazione, identità personale, ricevute idempotenti e transazione atomica. Richieste basate su uno stato superato vengono rifiutate con riallineamento visibile, senza sovrascrivere la scelta altrui. La conferma finale registra mazzi e ricevuta nella stessa transazione.
- Si evolve lo schema persistito esplicitamente. Sessioni e backup precedenti restano importabili con migrazione verificata; versioni sconosciute e cataloghi incoerenti vengono rifiutati senza sostituire il tavolo.

## Testing Decisions

La cucitura principale resta l’HTTP dell’host reale già usato dai test della sessione: processi separati, cookie diversi, SQLite reale e riavvio. I test verificano risultati osservabili, atomicità e ripresa, non l’organizzazione interna dei moduli.

- Catalogo sintetico pubblico per le prove automatiche: identità distinte con testi fittizi, quantità e casi limite rappresentativi. Il catalogo reale viene verificato separatamente contro hash e righe delle fonti private; il rapporto pubblico contiene solo conteggi, metadati e limiti.
- Verificare pacchetto assente/corrotto, riferimenti mancanti, copie duplicate, rango improprio, testo non classificato e aggiornamento del pacchetto dopo la creazione della partita.
- Verificare solitario 2/3/4 eroi, gruppi 2–5, unicità eroi/ruoli, proprietà, disponibilità oggetti, limiti mani/armatura, ingresso durante e dopo preparazione.
- Verificare quindici carte totali per eroe, quattordici coperte, ruolo 1 preparato, sei base e cinque eroe distinte anche se condividono un modello, debolezza senza reinserimento, nessuna fuga dell’ordine nei dati pubblici.
- Verificare due conferme concorrenti, reinvio con stesso identificativo, stesso identificativo con contenuto cambiato, vecchia generazione e rifiuto senza modifica parziale.
- Confrontare salvataggio/backup prima e dopo riavvio e recupero del posto: stessi identificativi e stesso ordine privato; ripristino su host vuoto anche senza il pacchetto originale.
- Nel browser provare PC e telefono, scelta reale, consultazione carta, conferma e ricarica; controllare tastiera, focus, riduzione del movimento, errori e assenza di richieste a servizi esterni. La prova fisica LAN su macOS/Windows con telefoni rimane nel ticket dedicato.

## Out of Scope

Questo incremento non esegue ancora effetti delle carte, prove, ispirazione, azioni, movimento, combattimenti, acquisti al campo o scenari. Non dichiara verificato il comportamento runtime dell’intera app, né completa la campagna. Non aggiunge account, multiplayer Internet, pubblicazione del corpus originale o contenuti delle espansioni.

## Further Notes

La [baseline concordata](fidelity-baseline.md), la [riconciliazione delle identità](../research/base-card-identity-reconciliation.md) e la [matrice delle regole](../research/rules-fidelity-matrix.md) restano i riferimenti delle evidenze. La discrepanza Guardian 1 e la verifica degli effetti sono mantenute visibili: una preparazione corretta per identità non certifica da sola il motore futuro. Il completamento di questa specifica abilita l’incremento successivo già approvato.
