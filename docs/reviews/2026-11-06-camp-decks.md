# Review Root — mazzi abilità dopo il campo (#128)

Base `a70b78a`, implementazione `981fde9`, correzioni Root `2b52852`.
Il componente produce un artifact privato prima dell'attivazione e dei trigger.
Non avvia l'avventura 2.

## Standards

La review indipendente non ha trovato violazioni documentate o smell Fowler
azionabili. Ha riprodotto un P2: il controllo JSON costruiva le tabelle dei
descriptor dell'intero contenitore prima di verificarne la dimensione. Un input
sintetico di 476.713 byte con 200.001 elementi veniva enumerato integralmente
prima del rifiuto, con allocazioni sproporzionate al budget di 100.000 nodi.

Corretto in `model.ts`: proxy rifiutati senza trap, limiti di lunghezza/campi prima
dei descriptor e lettura di un descriptor alla volta. La regressione RED fallisce
sul codice precedente; il probe finale sullo stesso array conferma il rifiuto per
dimensione senza enumerazione. Nessuna soglia di tempo o memoria fragile è stata
aggiunta ai test.

## Spec

La review indipendente conta zero requisiti mancanti/parziali, zero ampliamenti
di perimetro e un P2 di implementazione. Con `Object.prototype` già alterato dal
processo chiamante, un getter `revision` ereditato veniva eseguito durante il
parse di un campo mancante. Un file JSON CLI non può installare quel getter;
il difetto riguarda la garanzia della libreria nel processo già alterato.

Corretto: rifiuto degli accessor inattesi sui prototipi ordinari prima della
canonicalizzazione e dello schema; il parser riceve solo dati JSON propri in
oggetti con prototipo nullo. Anche valori ereditati non possono riempire campi
obbligatori. La regressione copre fonte, entropia e pin, con ripristino dei
prototipi e zero letture. La conservazione di `__proto__` come dato proprio resta
coperta. Una nuova review indipendente delle correzioni conferma entrambi i
finding risolti e nessun nuovo difetto nel diff.

## Verifica finale

- Build, typecheck, formato e diff verdi; **36/36** test mirati dopo le
  correzioni, con evidenze RED reali per entrambi i finding e il dato ereditato.
- Sei casi privati H2–5, mazzo oltre 56 carte e gate del contenuto: 18 comandi CLI
  con 15 exit 0, un exit 1 atteso e due exit 2 attesi. Il checker Python separato
  rilegge catalogo, workbook e norme e deriva multinsiemi, ordini, tracce, risorse
  e pin completi. I 29 documenti confrontati sono byte-identici alla consegna.
- Alterazioni risignate di ordine, multinsieme e traccia respinte; il cambio seed
  richiede nuovi pin di realizzazione/artifact. Gli hash provano coerenza,
  non autenticità editoriale.
- La prima canonica Root sul codice finale ha registrato 974 pass e quattro
  errori, exit npm 1: tre timer di avvio host scaduti e una risposta HTTP 408.
  Log ed errori sono conservati. Le diagnosi successive passano 1/1 e 4/4 senza
  modificare codice, test, timeout, asserzioni o concorrenza. Non è stata provata
  una causa ambientale specifica e non si dichiara impossibile una ricorrenza.
- La successiva canonica completa, ALONE/concurrency 4, registra **978/978**,
  **exit npm 0**, zero fail, skip, cancel e todo; 1.271,858 secondi. Anche i quattro
  casi precedentemente falliti passano nella suite completa. Gli input effettivi
  prima e dopo corrispondono al commit testato `2b52852`.
- Tutti i 24 vecchi output e i 797 file baseline sono conservati, salvo le due
  registrazioni dei nuovi target nel build. Host e client sono byte-identici.
  Nessun cambiamento a schema 29, State, ScenarioPack, Store.once/replay o
  origine/RNG A1. I commit successivi a `2b52852` aggiornano solo documentazione.

## Limiti

Artifact privato non attivo, `runtimeReady:false` e partenza disabilitata.
Attivazione atomica, reset fisici, trigger, XP del nuovo ruolo, Scoperta 3 e
startup restano successivi. Le quantità #57 restano null/unverified e il blocco
esplicito invariato; il checkpoint 156 resta statico/gated. Gli inventari e gli
episodi di prova sono tecnici inventati con definizioni originali. Nessuna partita
originale completa, prova fisica telefoni/Windows/Safari o parità Unity/JIT è
certificata. #33/#89/#65/#57 restano aperte.
