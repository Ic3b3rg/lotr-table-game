# Fronti persistenti nel ciclo ordinario — verifica #67

Il percorso di #67 attraversa i comandi ordinari, Store.once/SQLite e la UI:
fine turno con persistente e Riposo, viaggio con budget effettivo,
Riorganizzazione e preparazione, ripresa durante una prevenzione figlia.
Questo incremento non completa #65 o l'accettazione originale #33.
La review Standards/Spec e l'integrazione spettano al root.

Base `5cbf06a96efe1b2a2d3cfaeee5c12b706d507149`, schema12,467 test.
[Specifica](../planning/physical-resolution-p1b-spec.md) e
[piano](../planning/physical-resolution-p1b-plan.md) committati in `e8e9d2e`
prima del codice; aggiustamento prestazioni documentato prima della
correzione in `39a18e4`. Autorità: [issue67](https://github.com/Ic3b3rg/lotr-table-game/issues/67),
[parent65](https://github.com/Ic3b3rg/lotr-table-game/issues/65), contratto61,
spec/piano/verifica P1, review P1a e ADR0001/0002. Nessun checkout, subagente,
installazione, push, PR o altra scrittura GitHub creati dall'implementer.

Il raccordo `server/physical-cycle` possiede fonte e ritorno dei comandi;
il runtime fisico conserva copie, costi, risorse, casualità e discendenti.
`shared/physical-cycle` ammette intenti stretti: il client non invia un
evento, oscurità, importo o budget. Round, proprietario, comando, geometria
e posizione determinano la fonte. Ogni run conserva il proprio contesto
spaziale; le posizioni iniziali e i run precedenti restano invariati.
La vicinanza del bonus di Scoperta usa il grafo; Protezione richiede ancora
la stessa casella.

Schema13 migra1–12 preservando i pending P0/P1a. Il formato fisico3 aggiunge
il ledger ordinario: confine iniziale, intenti ordinati, continuazione e
ricevute riconciliati mediante replay. Preparazione, ispirazione, mazzi e
scarti proseguono nello stesso conto fisico, senza snapshot arbitrari fra
run o esenzioni nuove ai validatori. I premi iniziali restano validati
sulla preparazione storica e sul catalogo confermato. Restore e restart
non richiedono i pack esterni.

FINE TURNO risolve ordine simultaneo, trigger, Riposo e tutti i figli prima
di segnare concluso il turno e azzerarne i residui. Il ritorno è singolo;
la barriera Ultimo Sforzo conserva turno, azioni e viaggio. Riposo è una
policy confermata e hash-bound: paga la copia preparata, restituisce fino
alla quantità consentita di coperte miste e risolve dopo-Riposo. Uno scarto
imposto non attiva capacità; il seguito di una Protezione pagata conserva
l'identità della copia dopo il costo.

Il viaggio consuma una vera azione e salva la concessione modificata dalle
passive nella ricevuta, verificata con i movimenti successivi. La
Riorganizzazione ricompone i veri mazzi, esegue Scoperta con bonus effettivo,
divieto di cima, limite delle preparate e trigger di preparazione. Le prove
figlie supportate usano le passive e le conversioni del runtime; una prova
libera non abilita un incontro privo di executor. I quattro fix PR66
restano coperti: premio iniziale storico, costi composti condivisi,
identità stabile delle prevenzioni e ricalcolo dopo figli.

La UI usa i normali comandi di turno, mappa e Scoperta; `CYCLE_INPUT` risponde
soltanto alla richiesta corrente legata a fonte/pending/proprietario.
Guida e stato indicano chi deve agire e che turno/residui restano sospesi.
La sezione Scoperta è raggiungibile durante Riorganizzazione anche senza
un reveal già aperto; una regressione DOM ha riprodotto e corretto la
precedente sezione nascosta.

**Verifica automatica finale: 482/482 test, zero skip**, baseline467 più15.
`npm test`, `npm run typecheck`, `npm run format:check` e `git diff --check`
passano. HTTP, SQLite e processi reali nei test di ciclo, recovery,
transazione e Store. Coprono reazioni/costi/copie, quantità/facce/posizioni,
negativi di proprietà/fonte/revisione, grant modificati, Riposo, preparate,
Scoperta e barriera. Retry identico e concorrente applicano una volta;
intento diverso o stale fallisce. SIGKILL prima del commit annulla costo,
ritorno e ricevuta; dopo commit/restart conserva tutto. Backup alterati e
risignati cambiano contesto, posizioni storiche, risorse, parametri,
ricevute o rimuovono più cronologie: rifiuto422 senza modificare il tavolo.
Nessuna suppression, soglia abbassata o dipendenza aggiunta.

Journal e risposte ammettono100.000 record rispetto alle100.000 operazioni
del runtime; ogni decisione registrata consuma un'operazione. Il formato3
ammette1.000 run e4.000 comandi ordinari, entro il limite Store di5.000
ricevute. I limiti P0 e le relative regressioni non sono stati ridotti.

La prova browser ha trovato un timeout reale a registro cresciuto: un POST
veniva annullato dal client dopo5.003s pur applicando una volta. Il profilo
ha misurato replay ripetuti, non un costo SQLite. Store riusa la validazione
solo per identici byte di stato **e** ricevute letti dal DB; un cambiamento
esterno o una mutazione del clone impone nuova verifica. Il raccordo riusa
un solo prefisso canonico con contesto completo e record identici, copiato
difensivamente; gli output persistiti continuano a essere confrontati.
Sul medesimo artefatto il controllo ricevute è passato da1409 a22ms;
il successivo POST ordinario nel browser ha risposto200 in493ms, senza
abort o alert. Sono misure locali, non una certificazione di piattaforma.
I test di alterazione/ripristino sono stati ripetuti dopo la correzione,
poi è stata eseguita nuovamente l'intera suite.

**Browser effettivo, tre identità indipendenti.** Preview è stato provato
prima; due verifiche hanno riprodotto condivisione della prima identità
tra schede dichiarate incognito. Gli errori esatti e le schede chiuse sono
registrati nella scratch. Il fallback ha usato un Chrome headless proprio,
tre BrowserContext isolati e una vista condivisa, su127.0.0.1:4357.
Avanzamento con focus/Input nativi e selettore file; nessun fetch browser,
scrittura HTTP/SQL ausiliaria o comando sintetico inviato a mano. Node GET
ha soltanto osservato e salvato evidenze.

La precondizione è dichiaratamente preparata offline: freeze autentico
UI38 invariato, fonte iniziale inventata, annotazioni originali già
verificate, stream casuale registrato scelto prima del primo run,
preparate realmente possedute. Non è il percorso originale #33 e non
certifica l'Ombra originale. L'accettazione UI inizia dall'importazione
del backup preparato, revisione45.

| Passaggio UI                                                                                       | Evidenza privata                                                   |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Turno, viaggio con1 movimento, spostamento sul grafo, fine turno sospeso                           | revisioni46–49                                                     |
| Riposo pagato e reazione che fa cessare la passiva; turno concluso                                 | revisione50                                                        |
| Altri turni; trigger persistente, ordine e Protezione di un'altra identità                         | revisioni51–57                                                     |
| Export UI, SIGKILL dell'host proprio, restart senza pack, restore UI e recupero delle tre identità | figlio57, restore58; payload/risorse/round/viaggio/ricevute uguali |
| Risoluzione figlia e ritorno singolo                                                               | revisione59                                                        |
| Conferme Ombra manuali della fonte sintetica, poi vera ricomposizione                              | revisioni60–63                                                     |
| Tre Scoperte ordinarie, una preparazione effettiva                                                 | revisioni64–69                                                     |
| Nuovo round, turno e viaggio con2 movimenti dopo la cessazione                                     | revisioni70–72                                                     |

Nei pending57 e64 soltanto il proprietario corretto vede il form; tre nomi
indipendenti, guida apribile, Escape riporta il focus al pulsante guida,
controlli di almeno44px e nessun overflow a320/768/1024/1440. Screenshot
realmente acquisiti e ispezionati. I due run hanno zero errori console.
Le prime prove conservano anche gli errori del driver e i404 dei ritratti
mancanti nella cartella di prova, poi copiati dalle risorse già disponibili.
Il controllo finale della mappa conserva un404 del favicon preesistente,
senza errori runtime o alert di gioco; non viene contato come zero console.

**Artefatti e fonti private.** `.scratch/physical-p1b/` contiene sorgenti QA,
precondizioni dichiarate, backup, screenshot, profili, log, checker e
manifesto con SHA256:161 file,74.890.755 byte, escluso il profilo browser.
[Metadati verificabili](physical-resolution-p1b-verification.json) riportano
hash del manifesto e del log finale. Originali, testi, IR e associazioni rimangono ignorati
anche nella storia Git. Il raw bloccato ha SHA256
`3d06fbbf8f767b3e5e78e859c7187986041ed77d7af173917c4c72f2126b0c52`.
Il corpus P1a corretto dal root è stato riusato; lettura primaria aggiuntiva
limitata a due capacità Riposo confermate nel workbook, con locatori e hash
privati. Nessuna nuova ricognizione globale.

Un checker Python indipendente dal prodotto verifica i quattro file
bloccati,36 corpi invariati,21 policy legate al catalogo confermato, freeze
e catalogo invariati e56 copie uniche conservate in17 backup. Separatamente,
parser/replay del prodotto e validazione ricevute verificano gli stessi17
backup. Il finale contiene26 comandi ordinari,8 run/ritorni e round2 con
grant2. Questo è controllo strutturale/replay degli artefatti; non viene
presentato come una nuova esecuzione indipendente dei36 corpi, già verificati
in P1a. Nessun main QA di altri checkout è stato eseguito o modificato.

Il seguito resta distinto da67:

| Consumer o capacità                                                             | Stato e blocco                                                                                                                                                                  |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Interazioni originali, costo obbligatorio prima dell'interazione, prove libere  | executor fonte assente; `PHYSICAL_INTERACTION_CAPABILITY` prima di costo/effetto. Nessun ACK presentato come esecuzione                                                         |
| Oscurità reale e reazione al lotto effettivamente subito                        | `PHYSICAL_DARKNESS_CAPABILITY` quando casella/finestra lo richiedono; la conferma manuale sintetica non emette l'evento. La paura figlia non viene riclassificata come oscurità |
| Attacchi, rivelazioni di attacco, colpi aggiuntivi, nemici e minaccia originali | consumer ancora assenti; nessun combattimento o prefab ampliato da67                                                                                                            |
| Scarto facoltativo durante il turno con beneficio condizionale                  | IR/finestra esistenti; manca il percorso ordinario autorevole di acquisizione/attivazione. Resta seguito65/P4                                                                   |
| Ultimo Sforzo, eliminazione e limiti effettivi non disponibili                  | P2 non implementata; barriera diagnostica conservata, nessun completamento forzato                                                                                              |
| Acquisizioni di benefici/accessori e loro effetti                               | P4 non completata; #57 aperta,5/5/5 resta ipotesi del proprietario, nessuna copia/conferma inventata                                                                            |
| Incontri originali e accettazione completa                                      | P3/#33 e ulteriori requisiti65 aperti; P1b non certifica partita completa                                                                                                       |
| Mazzo fisico necessario realmente vuoto                                         | diagnosi P0 e continuazione conservate; nessuna carta, reshuffle o ignore inventati                                                                                             |

Telefoni, LAN, Windows e Safari non certificati. Port4339/PID12892 e la
scratch browser del root non sono stati usati. Il root riceve commit
locali, checkout pulito e processi/schede propri chiusi; nessuna issue è
stata chiusa o aggiornata dall'implementer.

## Integrazione root

Le [review indipendenti](../reviews/2026-11-03-physical-resolution-p1b.md)
riscontrano Standards1 P1 e Spec1 P2, corretti con due regressioni RED→GREEN.
La nuova continuazione della capacità pagata non viene imposta ai run storici
P1a: i nuovi run versione2 dichiarano la versione delle regole, quelli
ordinari spaziali conservano il proprio formato3. I run precedenti senza
marcatore mantengono il risultato pubblicato, anche durante una ripresa.
Un confronto compilando in memoria il codice della base5cbf06a conferma due
stati storici accettati e la continuazione pendente strutturalmente identica.
Le nuove capacità mantengono il seguito dopo il costo.

Il confine del ledger conserva inoltre il vincolo del handoff: il primo
round è1 in Fase di Azione. Il validator usa il round iniziale conservato,
non esenta il controllo quando esiste il ciclo. Una storia risignata con
round999 e ricevute coerentemente alterate è ora rifiutata senza modificare
il tavolo; i round successivi reali continuano a derivare dal replay.

Il root ricontrolla161 hash/74.890.755byte, esegue il checker indipendente
su copie proprie e riconvalida17 backup con il codice corretto. Il
confronto aggiuntivo include tutti i campi di gameplay e le ricevute del
restore, esclusi generation/revision/updatedAt previsti; il freeze completo
resta invariato in tutti i backup. Sono prove sugli artefatti della QA già
descritta, non una nuova sessione browser né un nuovo percorso originale.
Le evidenze originali rimangono immutate. Suite finale root482/482,
typecheck, formato e diff verdi;4339/PID12892 intatto. #65/#33/#57 aperte.
