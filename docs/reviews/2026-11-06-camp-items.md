# Review e integrazione dei miglioramenti oggetti — #116

Confronto fissato: main `4c3c858b58bdc068f2d33ef15e5f76783e17aac5` e
consegna `634ca3481f4863b926a03cfdd0f1a1c0be772656`. Due review indipendenti
con contesti separati. [Ticket](https://github.com/Ic3b3rg/lotr-table-game/issues/116),
[specifica](../planning/camp-items-spec.md), [rapporto](../development/camp-items.md).

## Standards

Zero violazioni documentate e un'osservazione facoltativa: possibile
Duplicated Code nei piccoli helper amministrativi di
`tests/camp-items-recovery.test.mjs:20` e `tests/camp-items-transaction.test.mjs:57`.
Entrambi clonano il valore e allineano soltanto generation/revision/updatedAt.
L'eventuale estrazione è facoltativa, non un blocco o una violazione.
Nessun altro smell concreto del baseline Fowler. Review dei68file tracciati,
AGENTS, guide, glossario, ADR e baseline di fedeltà; nessuna esecuzione,
host, browser o accesso alle superfici escluse. Totale:0violazioni,1opzionale.

## Spec

Nessun finding statico dimostrato: missing0, partial0, wrong0, scope0.
Seguiti inventario personale/comune, sostituzione di una copia, requisito
dall'oggetto corrente, Sapienza/XP immutati, disponibilità, successore,
Store.once, ricevuta/replay, guardie storiche/pre-seed, freeze e conferma/cancel.

Verificati sigillo pinned e13prove selezionate/1.097.085byte prima della
lettura.78modelli coerenti per identità/tipo/rango/mani/soglia/legami,
83copie e nessun arco base che cambi tipo o mani. Nessun helper, test,
build, host o browser eseguito. La review statica non sostituisce i controlli
runtime del root e non certifica A2 o futuri consumer.

## Controllo UX aggiuntivo del root

Le immagini mostrano un oggetto al rango massimo che invita ancora a
scegliere un'alternativa e presenta un elenco vuoto. Il lettore ripete
l'invito e presenta il valore stampato come requisito di un miglioramento
inesistente. Contraddice il criterio di indicare chiaramente massimo rango
e prossimo passo.

Il root aggiunge una regressione sul componente compilato e sul vero
createCardReader: massimo rango, Sapienza insufficiente e tutte le copie
possedute. Entrambi i difetti sono riprodotti RED; il primo tentativo di
collegamento del reader nel test produce invece una lettura vuota ed è
conservato come errore dello scaffold, non come RED di prodotto.

La lista indica il motivo del blocco e conserva la lettura gratuita;
il massimo non mostra conferme o alternative vuote. Il lettore distingue
il massimo dalle alternative disponibili. Non cambiano carte, inventari,
regole, premi, prezzi, protocolli o formato. Una nuova prova complessiva
copre i tre casi e porta i nuovi test116 da23a24.

La correzione è controllata anche nel browser nativo sul vero applicativo,
ripristinando una copia dell'episodio inventato sigillato su un host nuovo
vuoto senza pack. PC anonimo, HTTP IPv4 senza WebCrypto, quattro larghezze,
otto PNG di lista e lettore. Dopo il bootstrap solo osservazione e input
nativi; payload intero invariato, uscita dei soli processi propri e porta
propria riapribile. Gli hash delle sorgenti effettivamente usate legano
le catture al commit finale. Non è una nuova partita originale.

## Fonti e verifiche del root

Verificati manifest5.880.672byte SHA256
`053d51a37b1b9f19933acdeb4afaddf49bc1cd6c55167747301765f1b6675a78`
e tutte23.932righe/10.776.047.637byte, senza symlink, con due copie proprie
verificate. Solo helper e handle operativi hanno adapter separati; ricevute,
provenienza e identità storiche rimangono intatte.

Nuova rilettura bounded con due reader e oracle indipendente:79oggetti/
22896byte,78ItemModel/13472byte,83copie,71archi base e33puntatori esterni
non eseguibili.46catene/92passi,222dimensioni numeriche,426casi finiti;
34corpi IL/5201code byte/2049istruzioni/205destinazioni di ramo.
Le78carte derivate sono byte-identiche alla consegna.

La derivazione fresca è separata dagli input congelati: cambiano soltanto
le maniglie dei raw e la provenienza operativa degli input dell'audit,
non i campi dei modelli, workbook/localizzazione, carte o semantica.
Il compiler git-show/onLoad ricostruisce tre volte gli input congelati:
114 byte-identico e116829785byte, SHA256
`982996c68598bd8599f49e9eefb7ef54615f676ebed6fb7aa1470942628ba50d`,
fingerprint `e823cb6663fe1af41b835dc6de504c2c7c129b0ddd9ea453c5a62aade6d05492`.
Campi/certificati precedenti e catalogo iniziale74 sono immutati.

Passano503file/398payload distinti/17viste94, tutte le serie96–108
18/14/17/19/13/20/22,40+9snapshot110 degli stessi giochi,32snapshot112
e15snapshot/11distinti più30recovery114.116conserva47snapshot e126file
di recovery dei quattro set distinti: nessuna ripetizione conta come nuovo
gioco. Ogni set completo ha5postcommit,3precommit e26negativi422,
con8snapshot dei tagli. Anche tutti164JSON/24DB della canonica ricevuta
e quelli della nuova canonica root passano.

Il corpus completo è eseguito al commit8cb1bae. L’ultima correzione del
lettore modifica soltanto client/test: sorgenti server/shared/scenario,
script e package sono invariati; BackupSchema/publicSession, StateSchema
e compiler del commit finale hanno esattamente gli stessi byte. Gli
interi payload, viste e origini sono quindi verificati dal medesimo binario,
senza ignorare campi. I test mirati finali24/24 e la canonica907/907
eseguono anche il client/test finale41bfcebc79b83d8fd2270c26afb399be24a7fdf1.

Le immagini della QA inventata consegnata precedono la correzione UX root:
48casi con tre contesti personali e PC anonimo,156PNG delle matrici e
14immagini audit aggiuntive. Tutti170PNG sono decodificati, hash e metriche
ricontrollati; campioni di conferma, comune, conflitto, guida e reader sono
visti direttamente. Il successivo controllo root su lista/reader corretti
è distinto, senza attribuirgli nuove partite o48nuovi flussi completi.

Sole migrazioni strutturali attestate e tre campi amministrativi al restore;
nessuna normalizzazione gameplay o esenzione dal replay. Il tentativo
iniziale parziale di compatibilità è interrotto per applicare la correzione,
non contato come run completo. La prima cattura root resta in attesa dei
frame su una scheda nascosta: osservazioni, interruzione e chiusura propria
sono conservate. Il controllo successivo usa focus nativo nella propria
sessione e una scadenza che rifiuta il mancato completamento dei frame;
nessun fallback fa passare una cattura non dipinta.

Canonica root **907/907**, vero npm exit0, zero fail/cancel/skip/todo,
concorrenza4 da sola dopo i controlli pesanti;1120,538secondi. HEAD
pulito e invariato prima/dopo. I successivi164JSON e24DB prodotti sono
ricontrollati dal validator del medesimo commit;42/30/43/49JSON per i
quattro gruppi, senza inventare ricevute per i vecchi candidati solo-stato.

Tipi/formato/diff/privacy passano. I31file di test storici cambiano soltanto
la versione corrente27→28 e il limite del test sulle ricevute; la nuova
regressione root amplia i casi, senza rimuovere assertion/soglie/deadline.
Niente skip, suppression o dipendenze nuove. Tutti i tentativi rimangono
nelle prove private ignorate, incluse le ripetizioni non contate come nuovi giochi.

## Limiti

57 resta NULL/UNVERIFIED per esplicita preferenza dell'utente;156 statico/
gated e immutato. Nessun nuovo episodio o ripresa originale, filtro o reroll.
89/33/65/57 rimangono aperte. A2 ed effetti futuri delle carte richiedono
consumer attestati; il campo non li esegue implicitamente. Nessun retrofit.
QA su Chrome dello stesso Mac, senza attestazione su telefoni fisici,
Windows o Unity/JIT. Nessun accesso alla sessione del proprietario.
Corpus, testi, carte, IR/IL, DB/JSON e PNG restano privati.

Standards:0violazioni/1suggerimento facoltativo. Spec:0finding statici.
Controllo UX root:1problema su lista e lettore, corretto con regressione e browser.
