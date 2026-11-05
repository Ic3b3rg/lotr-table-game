# Incontro con oggetto — #106

Incremento personale dal main `24fa97e8342e6114c519f733d02b989ea0e24f0f`,
schema22/773 test, dopo #104. [Specifica](../planning/item-encounter-spec.md)
e [piano](../planning/item-encounter-plan.md) precedono il codice. Review
Standards/Spec e integrazione spettano al root. Nessun altro agente,
checkout, installazione, GH write, push, PR o merge.

## Capacità e percorso verticale

La capacità facoltativa `source-item-inventory-v1` congela prima dello
startup prodotti base `[0]`, inventario iniziale esplicitamente vuoto,
modelli, quantità specifica1, carta, policy, owner e lifecycle. I riferimenti
devono appartenere ai file fonte dichiarati. Nessun input mancante viene
interpretato come inventario vuoto e nessuna origine viene aggiornata nel
run. Il pack completo e il certificato conservano9 stati e tutte10 azioni.

Lo stato non sequenziale ha due azioni che usano lo stesso popup. Il
lifecycle proprietario mostra la prima; la seconda attende il popup
occupato. La callback della prima cambia stato prima del successivo
aggiornamento. `modalWait` conserva origine, parametri, ordine e certificato
della seconda azione: non la trasforma in un’altra prova o costo. La prova,
la soglia, i messaggi e il retry provengono dai packet, non dai titoli degli
stati. Non è possibile inviare esiti o successi liberi dal client.

Ispezione e annullamento sono gratuiti. La conferma paga un’azione, usa
carte e conversioni reali nel kernel condiviso e conserva i movimenti
residui. Il fallimento ritorna all’attesa: riprovare richiede un nuovo costo.
Il successo attraversa il messaggio, il consumer fisico di acquisizione,
la scelta attestata del destinatario e la callback; solo allora rimuove
il segnalino e restituisce il controllo al turno.

La copia guadagnata è unica. La scelta iniziale ammette l’attore e gli eroi
vicini previsti dal messaggio proprietario; il destinatario la equipaggia
nel momento dell’acquisizione. Il possesso esatto già presente non duplica
copia, consumo o messaggio. Durante l’avventura non esiste un trasferimento
libero. Al termine la copia torna nell’inventario comune del campo. Il test
attraversa la vera vittoria fonte e il primo campo, mantenendo separata e
immutata la custodia nell’episodio concluso.

L’oggetto base usa la sua vera carta nella finestra raggiungibile: consuma
un uso e cambia la faccia di tutte le paure subite, senza prevenirne una.
Il nuovo effetto `fear-facedown-only` distingue questa regola dal precedente
effetto storico, che resta immutato nei vecchi artefatti e replay. Sono
verificati proprietario, due consumi, esaurimento e assenza dell’offerta a
zero. Inventario e lettore mostrano copia, proprietario, consumo residuo e
istruzioni; non aggiungono equipaggiamento fittizio o bonus gratuiti.

Le regole di custodia e ritorno sono controllate contro §§25/50/109 del
[riferimento ufficiale delle regole](https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf).

## Callee e confini

Sono riletti tutti i dieci corpi della classe proprietaria, con upgrade,
ricerca del possesso esatto, aggiunta al gruppo, abilità condizionale,
messaggio, callback e controllo del titolo. Il catalogo esplicito del
prodotto base esclude l’abilità condizionale. Con inventario iniziale vuoto,
una sola aggiunta ammessa e PlayerCount invariato, la condizione del titolo
non può scattare. Queste sono condizioni validate degli input ammessi;
non sono consumer simulati o rami esclusi per convenienza.

La catena upgrade e la scelta proprietaria sono verificate staticamente,
compreso il caso con un solo candidato che non consuma RNG. Raggiungere la
soglia del primo upgrade è un gate prima dell’intera interazione: carte e
finestre delle versioni avanzate non sono certificate da questo incremento.
Non avvengono effetti anticipati, filtri, sostituzioni o reroll.

Il preflight riusa scenario/frame, P1/P2, carte, owner/receiver,
provocazioni e pool interi. Verifica entrambi gli esiti e i discendenti
prima di costi, carte e RNG. Il test di provocazione porta legalmente
sul luogo tutti i gruppi pronti vivi, con viaggio e attivazioni fonte,
senza assumere una disposizione favorevole. L’esaurimento fisico conserva
la diagnostica del contratto61/T25.

## Persistenza e prove

Schema23 aggiunge le forme di inventario con migrazioni strutturali.
I formati1–22 rifiutano le nuove capacità, istruzioni, programmi e risorse,
anche nel seed. Il controllo segue i percorsi del contratto: normali nomi
nei dizionari di variabili/eventi restano validi. Una regressione10–22
conserva la correzione root di #104. Pack, impronte, ledger, origine
round1/Azione, ricevute e replay storici non sono normalizzati o esentati.

Sedici test nuovi esercitano compiler, lifecycle, carte/conversioni,
fallimento/retry, acquisizione e consumo, vero ritorno al campo, schema,
HTTP/SQLite/Store.once, concorrenza, retry, stale e autorizzazioni. I rifiuti
di attore, eroe, spazio, fonte, carta e cursor confrontano payload e viste
interi. Sei SIGKILL dopo commit ripristinano su host vuoti e senza pack ai
confini costo, carte, conversione, esito, acquisizione e callback. Altri
sei SIGKILL prima del commit SQLite verificano rollback e ricostruzione
intera del candidato al retry. Alterazioni risignate sono respinte anche
via HTTP422 senza mutazioni.

## Primarie e oracle

Il manifest ricevuto originale resta immutato:549728 byte, SHA256
`9b595c295700904baa06f1738108cab24fee7eb9172b5460409ccda5d1783110`.
Tutte2764 righe,2035240405 byte, sono verificate prima del parse/copia;
anche i PNG non copiati conservano il proprio audit. Gli input supplementari
sono verificati contro il loro lock prima della lettura. Helper adattati e
database lavorano soltanto in un’area propria, mantenendo ricevute e hash
degli originali.

Due reader indipendenti sulle copie primarie concordano sui sei oggetti
centrali,60091 byte, con consumo completo e puntatori. Sono inoltre riletti
modelli/callee pertinenti, tutti i114 riferimenti alle abilità base e la
carta nel workbook primario. Riferimenti duplicati non sono contati come
prove indipendenti. Sessantacinque corpi IL pertinenti,4223 byte di codice e
1521 istruzioni, comprendono tutte10 le letture iniziali del root,
ricontrollate byte/hash. Nessun gameplay Unity/JIT o riscan globale.

L’oracle Python separato non importa compiler o runtime. Confronta tutte
le10 azioni,9 stati, transizioni, parametri, lifecycle, carta e1536 casi
finiti dei rami proprietari. Il vecchio freeze104 resta identico; tre
compilazioni ripetute del nuovo freeze sono byte identiche. Il pack statico
ha37 definizioni,260 stati,268 azioni e35 confini differiti. Le primarie
restano static/compiler/oracle; tutti i positivi di gioco sono inventati.

## QA e verifica finale

La QA nativa usa tre identità indipendenti e320/768/1024/1440 su HTTP IPv4
con crypto.subtle assente. Tutte le precondizioni sono dichiarate prima
dello startup. Dopo l’avvio, soltanto DOM/Input modifica il gioco;
Node GET ed evaluate osservano. Il percorso include fallimento naturale,
nuovo tentativo, conversione pagata, acquisizione, scelta del destinatario
vicino e consumo della copia in una vera conseguenza di un altro incontro
nella stessa partita. Guida, lettore, focus, tastiera, overflow, export
esatto, restore corrente e recupero dei tre posti sono controllati.

La QA iniziale ha trovato un lettore troppo alto a320: il limite ora tiene
conto del masthead e dello spazio di scorrimento. Il tentativo è conservato.
L’ultimo negativo del compiler ha trovato un riferimento modello a file
non dichiarato. Il controllo corretto ha respinto anche la fixture privata
iniziale, che usava due nomi di file inventati incoerenti. Quel tentativo
resta una prova respinta; una nuova fixture è dichiarata prima dello startup
e la QA è ripetuta integralmente, senza adattare salvataggi o origini del
vecchio run.

Passano19 matrici/228 combinazioni:17 complete e2 ispezioni gratuite,
ciascuna su tre identità e quattro larghezze. Conservati924 screenshot e9
file di eventi: zero eccezioni runtime o caricamenti falliti, soltanto i
due422 intenzionali. Sei catture sono ispezionate singolarmente, senza
rivendicare controllo manuale dell’intero insieme. Due catture immediatamente
dopo lo scroll mostrano tile Chromium non ancora dipinte: quei fotogrammi
non costituiscono una verifica visiva positiva; DOM e successivi input
nativi passano. Lettore320, custodia e consumo sono leggibili nelle catture
ispezionate. Host, browser e tre contesti propri sono chiusi, con verifica
dei soli PID propri e riapertura/chiusura della sola porta4407.

Il validator ricostruito da sorgenti committate misura1585954 byte, SHA256
`eab35ae1c1de600b8aa4795e0a247b1e0f06c6e73023e563124959ad24d93289`.
Passano503 file,398 payload distinti,17 viste94 intere e913356631 byte
comprese le viste. Tutti gli indici sono confrontati una volta esatta nella
serie finale, byte/hash prima del parse. Le sole migrazioni sono
schemaVersion23 e il già dichiarato physical:null nei formati≤10 che ne
erano privi. Il156 mantiene il gate57 e il payload intero nel solo preflight
statico, senza gameplay.

Passano18 snapshot/viste96,14/98,17/100,19/102 e13/104, con18/13/16/18/12
payload distinti, più export/finali. Passano20 snapshot/viste106 inventati,
18 payload distinti, export e finale senza migrazioni. Fra export e restore
cambiano solo generation/revision/updatedAt. Copie identiche non sono nuove
prove indipendenti. Le copie ricevute e i lock sono riverificati immutati.

La suite canonica finale passa789/789:773 precedenti e16 nuovi, zero
fail/skip/cancel/todo,705117.418292ms a concorrenza4. Eseguita da sola dopo
QA e tutti i validator pesanti; passano anche16/16 mirati. Un precedente
run completo aveva788/789 per una GET locale con ECONNRESET nel test
storico degli undici restore della vittoria, dopo i controlli negativi.
Quel test passa isolato e nella ripetizione completa sullo stesso codice;
log e stack iniziali restano conservati, senza cambiare asserzioni o deadline.

Typecheck, Prettier e diff check passano. I25 file test preesistenti
modificati cambiano soltanto le attese schema22→23: nessun caso, asserzione,
deadline o soglia abbassato, skip/suppression o dipendenza aggiunta. Privacy
verifica317 stringhe fonte su diff, nuovi file e tutta la nuova storia,
senza corrispondenze. Il rebuild dal commit finale produce gli stessi
byte del validator usato in tutti i confronti: nessuna modifica runtime
successiva alla verifica.

## Limiti e consegna

Le quantità originali57 restano null/non verificate: «Mantieni il blocco
finché le quantità sono verificate». Nessun5/5/5, proxy, infinito,
unknown=empty, filtro, reroll o domanda ripetuta. Nessuna nuova partita
originale o ripresa156; quest’ultimo è verificato solo staticamente e resta
gated. Nessuna chiusura89/33/65/57 o dichiarazione di partita originale
completa. Campo completo, negozio, upgrade generici e A2 restano seguiti.
Non si dichiarano parità RNG Unity o prove su telefoni fisici/Safari/Windows.

Primarie, prosa/carte originali, IR/FSM/IL, JSON e immagini restano nella
scratch ignorata, anche nella nuova storia Git. Comandi, tentativi,
provenienza, adattamenti e sigillo sono in `.scratch/item109/`. Il root
esegue le due review fresche e l’integrazione dopo questa consegna.
