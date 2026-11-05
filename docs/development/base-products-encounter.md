# Incontro nel perimetro base — #104

Incremento personale sulla base `fb6a2bb`, schema21/757 test, dopo PR103.
[Specifica](../planning/base-products-encounter-spec.md) e
[piano](../planning/base-products-encounter-plan.md) precedono il codice.
Review Standards/Spec e integrazione spettano al root. Nessun altro agente,
checkout, installazione, GH write, push, PR o merge.

## Scope e input esplicito

La capacità facoltativa `source-base-products-v1` attesta prima dello startup
un solo prefab, definizione, closure, owner/controller, ProductModel e input
esatto `[0]`. Riusa fonte, ispezione e conferma dell’incontro75. Non elimina
il segnalino né modifica pool o assegnazioni per evitare il ramo prodotti.
Input assente, ignoto o diverso da quello ammesso è respinto prima di
startup e costi; il generatore base conserva già il proprio contratto `[0]`.
La concessione resta immutabile durante la partita e nel replay.

Le primarie confermano ProductModel0/5 e la semantica OwnsProducts: ricerca
per identità nel gruppo dei prodotti posseduti. Il titolo33 appartiene al
prodotto5, non al0, ed è assente dal catalogo base ricevuto. Con input `[0]`
la guardia segue il ramo0 fino alla rimozione/termine, prima del contatore
e del titolo. Non sono inferiti diritti personali da asset, IsLocked o
assenza di dati. Non sono consultati account, licenze o impostazioni Steam.

Il programma ammette9 stati/9 azioni della closure completa14/14. I cinque
stati esterni restano nel certificato e nella diagnostica, con un confine
esplicito non eseguibile. Contatore, confronto esatto con3 e tutti i rami
meno/uguale/più sono verificati staticamente. Nessun incremento anticipato,
modello/copia/policy del titolo33 inventato, né DLC5 abilitato. Questo chiude
il percorso75 per il solo perimetro base approvato.

## Percorso verticale

L’ispezione e la sua chiusura sono gratuite. Conferma e costo precedono la
prova con carte reali e conversioni pagate. Il CANCEL successivo è il ramo
di fallimento della prova, senza cancellazione gratuita dopo il costo.
Il client non invia Pass/Fail o successi liberi. Il successo concede il
premio d’ispirazione previsto, cappato dal consumer esistente, quindi
attraversa la guardia prodotti. Il fallimento concede Scatto1 facoltativo:
restare o muovere di una casella non restituisce il costo della prova.

Lo Scatto riusa provocazione, carte/conseguenze P1/P2, esplorazione,
broadcast, piazzamenti e callback esistenti. Conserva il budget del viaggio.
La richiesta fonte resta sospesa durante la provocazione e viene ripresa
una sola volta dal proprio owner. Con superstiti la sconfitta dell’attore
completa il ritorno attestato; senza superstiti il padre resta sospeso
nella conclusione esistente. Nessun polling della perdita differita,
riduzione di PlayerCount, budget o proprietà degli eroi sconfitti.

Il preflight prova l’intero seguito ammesso prima di costi, carte e RNG:
entrambi gli esiti della prova, tutte le destinazioni visibili adiacenti,
esplorazioni/receiver e tutti i gruppi pronti che provocano. Non filtra
popolazioni né ritenta estrazioni per nascondere una dipendenza mancante.
Le quantità57 e i consumer ancora assenti mantengono i propri gate.

## Contratti, persistenza e test

Schema22 introduce le nuove forme con migrazione21→22 strutturale. Tutti
i formati precedenti rifiutano capacità, istruzioni, richieste, origini e
programmi nuovi anche dentro il seed. Programmi storici, impronte,
origine round1/Azione, ricevute e replay non sono riscritti, normalizzati
o esentati. La vista pubblica accetta l’origine dell’esplorazione da Scatto
senza esporre l’entropia privata.

Quindici nuovi test usano veri programmi scenario da fixture inventate:
compiler/input/guardia, cap e conversioni, fallimento/restare/muovere,
esplorazione e ritorno fra owner. HTTP/SQLite/Store.once esercitano attore,
eroe, spazio, fonte, carte e cursor, richieste concorrenti, stale, retry e
receipt stabili senza doppio costo. Il test delle provocazioni porta
legalmente sul luogo l’intera popolazione dei gruppi vivi tramite viaggio
e attivazione fonte, senza assumerne una disposizione casuale.

Undici SIGKILL ai nuovi confini ripristinano su host vuoti senza pack:
costo, carte, conversione, premio/guardia, Scatto, esplorazione/callback e
cleanup, inclusa la richiesta sospesa nella provocazione. Payload e viste
sono confrontati interi; nel restore cambiano
soltanto generation/revision/updatedAt. Ventuno alterazioni risignate
sono respinte, una anche via HTTP422 senza mutazioni. Nove ulteriori
SIGKILL prima del commit SQLite verificano rollback di payload/receipt e
ricostruzione intera del candidato al retry, salvo updatedAt. Nel test
dei discendenti, il caso senza superstiti verifica espressamente il gate
`adventure-loss-consumer-unavailable`, tutti gli eroi sconfitti e il padre
ancora sospeso: non sostituisce un consumer mancante con una conclusione
fittizia.

## Grounding e oracle

Le primarie ricevute sono verificate byte/hash prima del parse e copiate
nella scratch propria. Sette oggetti pertinenti per68563 byte: due reader
C/Python concordi, consumo completo, puntatori e parametri raw confrontati
col normalizzato. FSM completo14 stati/14 azioni; undici chiavi italiane
rilette dal TextAsset primario. Trentasei corpi IL pertinenti,3185 byte di
codice/1132 istruzioni, con lunghezze e salti verificati. Nessuna esecuzione
Unity/JIT o estrazione globale di modelli.

L’oracle privato separato non importa compiler o runtime. Confronta14/14,
raggiungibilità, tutte le9 istruzioni ammesse, packet/stili/icone, binding,
guardia prodotti e i cinque stati esclusi;24 casi finiti. La ricompilazione
del freeze102 resta identica. Il nuovo freeze statico ha37 definizioni,
254 stati,260 azioni e36 confini differiti. Originali static/compiler/oracle
soltanto; i positivi di prodotto sono interamente inventati.

Lo Scatto e l’esplorazione sono controllati anche contro i paragrafi37.3,
60.2–4 e89 del [riferimento ufficiale delle regole](https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf).
Il contratto delle union mantiene la forma rigorosa descritta nella
[documentazione ufficiale Zod](https://zod.dev/api#discriminated-unions).

## UI nativa inventata

Precondizioni, mappa, programmi, carte, valori e tre identità indipendenti
sono dichiarati prima dello startup. Dopo il bootstrap di Compagnia/mappa,
DOM/Input soltanto per avvio, viaggio, ispezione, conferma, prova,
fallimento dalle carte2<3, Scatto su tessera inesplorata, messaggi,
piazzamenti e ritorno. Node HTTP GET ed evaluate osservano soltanto.
Nessun esito impostato, rewind o reroll.

Dodici matrici per144 combinazioni:120 casi completi e24 ispezioni gratuite,
tre identità e larghezze320/768/1024/1440. Attore/attesa, costo già pagato,
carte/totale, esito e prossimo passo, guida, lettore nel viewport, ritorno
del focus, tastiera e assenza overflow verificati. HTTP IPv4 esercita
crypto.subtle assente.468 screenshot conservati, sei ispezionati direttamente;
non si dichiara ispezione manuale dell’intero insieme.

La QA ha trovato una variante mancante nel contratto della vista pubblica:
il server avanzava correttamente nello Scatto, ma i client rifiutavano
sprintOrigin. Il nuovo controllo sul SessionSchema intero fallisce prima
della correzione e passa dopo. Gli stessi tre browser riprendono la stessa
partita salvata, senza annullare azioni o ripetere estrazioni. Un precedente
errore del driver su un campo risultato inesistente è registrato a parte.

L’export nativo coincide con l’intero payload. Due alterazioni risignate,
input prodotti e contatore, sono respinte422 tramite filepicker/restore,
con payload invariato. Ripristino corrente e recupero dei tre posti passano.
Nessuna eccezione runtime o caricamento fallito rilevato; i due422 sono
intenzionali. Host, browser e tre contesti propri sono chiusi; verifica
sui soli PID propri e riapertura/chiusura della sola porta4405.

## Confronti e verifica finale

Il validator reale ricostruito dal commit misura1566486 byte, SHA256
`d0623451eca1d5c5615d2845575abaabbfff02c7b85f3c279c12a24b7beb5452`.
Espone BackupSchema/publicSession e i due seam del preflight Ombra. I byte
coincidono con il validator usato dalla QA finale e da tutti i confronti;
nessuna modifica runtime successiva.

Passano503 file,398 payload distinti e17 viste94 intere,913356631 byte
comprese le viste. Ogni indice è confrontato esattamente una volta, byte/hash
prima del parse. Sole migrazioni dichiarate: schemaVersion22 e physical:null
nei formati≤10 che già lo prevedevano. Il156 conserva gate57 e payload
intero nel solo preflight statico, senza proseguire il gioco.

Passano separatamente18 snapshot/viste96,14/98,17/100 e19/102, export e finali
inclusi;18/13/16/18 payload distinti. Sola differenza schemaVersion22. Passano
anche13 snapshot/viste104 inventati,12 payload distinti, export e finale,
senza migrazioni. I confronti fra export e restore corrente ammettono solo
generation/revision/updatedAt. Copie identiche non nuove prove indipendenti.

La suite canonica passa772/772,757 precedenti e15 nuovi, zero fail/skip/
cancellazioni/todo,671716.059708ms a concorrenza4. Eseguita da sola dopo QA,
validator pesanti e15/15 mirati finali. Typecheck, Prettier e diff check
passano. I24 file test preesistenti modificati cambiano soltanto le attese
schema21→22; nessun caso/assert/deadline/soglia abbassato o suppression/skip
aggiunto. Privacy controlla307 stringhe fonte su diff, nuovi file e tutta
la nuova storia, senza corrispondenze.

Primarie, compiler e oracle sono ripetuti sul codice congelato: i tre
output compiler restano byte identici, così come il vecchio freeze102.
I log conservano tutti i tentativi, compresi gli errori di fixture/driver
e i RED di prodotto. Nessuna suite fa avanzare salvataggi ricevuti.

## Limiti e consegna

Quantità57 originali null/non verificate: «Mantieni il blocco finché le
quantità sono verificate». Nessun5/5/5, proxy, infinito, unknown=empty,
filtro, reroll o domanda ripetuta. Nessuna nuova partita originale,
ripresa156 o accettazione/chiusura89/33/57/65. Il percorso del prodotto5,
il titolo33,109/inventario, altri incontri, campo completo e A2 restano
fuori incremento. Nessuna parità RNG Unity o prova su telefoni fisici,
Safari o Windows dichiarata.

Originali, prosa, carte, IR/FSM/IL, JSON e immagini restano solo nella
scratch ignorata, anche nella nuova storia Git. README, comandi, tentativi,
input/byte/hash e sigillo privati in `.scratch/encounter75/`. Il root svolge
le due review fresche e l’integrazione; nessun push o modifica GitHub.
