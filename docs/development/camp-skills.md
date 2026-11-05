# Negozio abilità del primo campo — #114

Base main `5db5cf5134a3f38e5a917f45be43d4037bc30d9e`, schema26,
baseline864, dopo il merge di #112. [Specifica](../planning/camp-skills-spec.md)
e [piano](../planning/camp-skills-plan.md) sono committati prima del codice.
Il nuovo formato è schema27.

## Comportamento

Il campo raggiunto dai controller reali di conclusione permette al
proprietario di comprare e vendere abilità upgrade dal proprio dispositivo.
Per ogni eroe la UI mostra proprietario, ruolo, premio ricevuto, saldo
disponibile, prezzo e disponibilità comune della carta. Lettore e guida
rimangono accessibili anche alla vista PC condivisa senza identità.

Il premio e la ricevuta della conclusione rimangono storici. Il saldo per
eroe/ruolo diminuisce all'acquisto e aumenta alla vendita del costo congelato
della carta. Cambiare ruolo conserva fondi e carte nei rispettivi ruoli;
non crea un nuovo saldo spendibile. La vendita ammette soltanto upgrade
effettivamente acquistate. Carte iniziali, eroe, base, debolezze e titoli
rimangono escluse. Non si aggiunge un limite al numero delle operazioni.

Ogni acquisto modifica l'inventario abilità effettivo della campagna per il
seguito. L'inventario iniziale deriva dalle vere copie e dalle carte trattenute
nell'episodio; l'episodio concluso conserva le sue zone immutate. La disponibilità
di ogni copia è comune a tutti gli eroi. Concorrenza, retry e ricevuta del vero
vincitore sono verificati nel medesimo Store.once e command ledger esistente.

L'intento contiene operazione, eroe, ruolo e copia, senza prezzo o XP liberi.
Server e replay controllano player/hero, fase, fonte, copia, richiesta/cursore,
revisione e generazione. Lettura e annullamento non spendono risorse.

## Grounding e capacità

Le capsule ricevute sono verificate per byte/SHA256 prima del parse:
10539 righe/4380356111 byte e22 file/1204276 byte. Ogni copia viene verificata
di nuovo. Ricevute e identità annidate rimangono immutate; soltanto helper e
handle operativi delle copie proprie hanno adapter e lock separati.

Due reader rileggono i sei RoleModel base, i12 CoreSkills e i54 UpgradeSkills
referenziati:72 oggetti/8560 byte. Con il registro risorsa pertinente il ledger
comprende73 oggetti/17984 byte. Un decoder binario indipendente verifica campi,
puntatori e consumo intero; un secondo oracle indipendente dal prodotto verifica
tutte54 offerte,113 dimensioni numeriche e3402 casi finiti del negozio.
Prezzi e ruolo provengono dai campi Cost e RoleSource, copie e simboli dal
workbook. Il catalogo iniziale74 non viene esteso o reinterpretato.

Le52 associazioni individuali confermate e le due copie in un insieme di
equivalenza rimangono distinte. Per queste ultime la provenienza conserva i
candidati individuali, senza dedurli dall'ordine dei record. Le anomalie del
registro e delle colonne analitiche del workbook restano nel ledger e non
producono stock aggiuntivo. Testo completo, localizzazione ed errata ufficiali
sono confrontati prima del certificato finale.

La closure IL pertinente comprende18 corpi/2105 code byte,783 istruzioni e47
destinazioni di branch. Oltre agli otto ingressi UI, la rilettura raggiunge i
callee GameData reali di proprietà, disponibilità, XP e cambio ruolo. Il modello
di saldo e disponibilità comune concorda con le [Rules Reference §§36.1–36.8,
pp.14–15](https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf).

La capacità facoltativa `manifest.campSkills`, `source-camp-skills-v1`, richiede
il certificato del compiler ed è congelata prima dello startup. Non viene
aggiunta a pack, origini, campagne o copie già congelati. Schema27 migra i
formati precedenti strutturalmente; le forme nuove sono rifiutate nei vecchi
formati anche all'origine, conservando i normali nomi dei dizionari.

Il pack112 è ricostruito byte-identico con fingerprint
`065471143eabbfc15b4dffa16fa787c280b69757f442a6f79bc09b03c98a7704`.
Il nuovo fingerprint è
`8f1b22eafa1f90b99e90ef2954eb0010b868bce683b7e62b6a5e967c3c296986`:
658484 byte, SHA256
`307852652f7c49e8a7220ea84fa65302d1cd60bd9973a1ec6984f3e0f8703386`.
Tre compilazioni sono byte-identiche;37 definizioni/301 stati/322 azioni/27
deferred e i certificati precedenti rimangono invariati.

## Verifica

Le16 nuove prove usano fixture inventate e i controller HTTP/SQLite reali:
compiler, migrazione, acquisto/rimborso, ruoli distinti, saldo esatto e
insufficiente, proprietà, copie comuni, fonti/cursori superati e UI. Cinque
SIGKILL postcommit, quattro precommit e21 negativi coerentemente risignati422
confrontano payload, viste e origini interi. I restore usano host nuovi vuoti
senza pack; cambiano soltanto generation/revision/updatedAt. Il candidato SQL
precommit contiene la vera ricevuta e l'intero registro. Nessun hook entra
nel prodotto.

La QA nativa inventata raggiunge il campo dal consumer reale con premi e
prerequisiti dichiarati prima dello startup. Dopo bootstrap gioca soltanto
tramite DOM/Input/filepicker. Tre contesti personali e una quarta vista PC
anonima operano su HTTP IPv4 senza WebCrypto a320/768/1024/1440:80 casi in
cinque matrici,240 PNG accettati e sette immagini ispezionate direttamente.
Sono verificati lettore, guida, tastiera, focus, nessun overflow, acquisti,
rimborsi, conflitto, export/current restore e recupero dei tre posti.
I15 snapshot completi rappresentano11 payload distinti. I quattro contesti
e i soli processi propri risultano chiusi; rebind della porta4417 riuscito.

La QA ha rilevato che il refresh globale riattivava controlli disabilitati
localmente per ownership o saldo. Una regressione RED→GREEN esercita il vero
setOnline; i controlli ora conservano il blocco. Gli snapshot di accettazione
sono successivi alla correzione, sulla medesima campagna. I tentativi falliti
rimangono nelle ricevute private e non aumentano i casi di accettazione.

Il validator finale git-show/onLoad verifica503 file/398 payload/17 viste94,
serie96–108 con18/14/17/19/13/20/22 snapshot,40+9 historical110 degli stessi
giochi,32 native112, export/finali e tutte le prove proprie. Byte/hash precedono
il parse. Sono ammesse soltanto schemaVersion27 e physical:null storico≤10;
nessuna normalizzazione gameplay.156 rimane statico, gated e immutato.
Il validator runtime e quello di stato finale sono byte-identici ai binari
usati per tutte le serie, dopo il solo commit documentale.

`npm test` è eseguito da solo a concorrenza4 dopo tutti i controlli pesanti,
al commit `f83c03d5bd7f1963694b088e4684c394f7b2b862`: **880/880**, vero exit
code npm0, zero fail/cancel/skip/todo,1033.029 secondi. Il runner conserva
il footer Node spec effettivo e HEAD pulito e invariato prima/dopo il run.
I30 nuovi output recovery del campo,43 search110 e49 threat112 sono
conservati integralmente, senza contarli come gameplay originale aggiuntivo.

Typecheck, formato, diff e privacy sull'intera nuova storia passano. Le29
modifiche ai test storici aggiornano soltanto l'aspettativa corrente26→27;
nessuna assertion, soglia o deadline è ridotta, né si aggiungono dipendenze,
skip o suppression.
Log, comandi, lock, tutti i tentativi, PNG e ricevute restano nella sola scratch
ignorata `.scratch/skill-store114/`, con README e sigillo privati.

## Limiti e consegna

L'acquisto non esegue effetti delle nuove carte nell'avventura. Le carte hanno
reader e dati meccanici reali, ma ogni futuro consumer non attestato conserva
il proprio gate. Upgrade oggetti, partenza/A2 e altri rami/quantità rimangono
esclusi.57 resta null/unverified per la scelta esplicita dell'utente; nessuna
nuova partita originale o ripresa156 è usata per aggirarlo.89/33/65/57 non
vengono chiuse e non si dichiara completo il gioco o l'avventura.

Implementer unico nel checkout assegnato, senza deleghe, installazioni,
checkout aggiuntivi o scritture GitHub/push/PR/merge. Le superfici protette e
il live del proprietario non sono stati toccati. Root esegue Standards/Spec
fresche e integrazione.

## Integrazione del root

[Standards/Spec e verifica indipendente](../reviews/2026-11-05-camp-skills.md):
zero violazioni Standards e un suggerimento facoltativo; un P2 Spec sulle
ricevute finanziarie corretto con tre regressioni RED→GREEN. Il root
allinea inoltre quattro termini al manuale italiano, senza cambiare
prezzi, quantità o meccaniche. Il fingerprint sopra è quello del pack
statico corretto; la consegna originale rimane conservata privatamente.

Sul prodotto corretto passano19/19 prove mirate, l’intero corpus e tutte
le serie storiche/proprie,80 casi QA inventati e30 prove recovery.
Canonica root **883/883**, npm exit0, concorrenza4 da sola,1038,112secondi,
HEAD pulito e invariato. I limiti57/156 e l’assenza di una partita originale
completa rimangono invariati. Il rapporto distingue la QA accettata dal
fallimento opzionale conservato su un’immagine aggiuntiva della guida.
