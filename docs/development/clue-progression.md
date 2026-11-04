# Indizi e seguito della missione — #89

Base `2f8e28f`, schema 15. Contratto: [issue 89](https://github.com/Ic3b3rg/lotr-table-game/issues/89),
[spec](../planning/clue-progression-spec.md), [piano](../planning/clue-progression-plan.md),
[fonte 38](../research/first-adventure-runtime-contract.md),
[realizzazione 55](../research/first-adventure-realized-runtime-contract.md),
[attivazioni 87](shadow-activations.md) e ADR 2–3.
Review Standards/Spec e integrazione spettano al root.

## Implementazione

La capacità facoltativa `source-clues-v1` viene congelata prima dello startup.
Estende gli stessi compiler, consumer fonte, servizi fisici e controller,
conservando generatore, RNG mappa, Store.once e origine v2 round 1/Azione.
Il vecchio manifest mantiene una sola interazione; la nuova capacità possiede
separatamente quattro incontri. Nessun cambio del pack durante una partita.

I quattro owner sono chiusi: 52 stati/50 azioni. Il pack completo ha 34
definizioni, 192 stati, 184 azioni e 43 confini differiti. Le primitive aggiunte
mantengono uguaglianze ordinate, fallback FINISHED, copia di binding interi,
somma letterale temporanea, somma persistente e limiti dinamici. Prove e
conversioni usano le carte e le risorse del proprietario. Ispezione e
annullamento sono gratuiti; la conferma paga un'azione una sola volta e
conserva i movimenti residui. Danni, ispirazione, Sapienza e messaggi hanno
un unico proprietario; un premio automatico attende comunque la conferma
del messaggio fonte prima del seguito.

Il contatore condiviso scende da 3. Confronti e rami conservano ordine ed
uguaglianza, compresa la sentinella −1. La prima traccia rivela la sezione
prevista, le successive aggiornano l'obiettivo; il terzo indizio segue il
binding del covo e la condizione effettiva di esplorazione. Il valore annunciato
dal precedente seguito del timer rimane distinto dal valore globale.

Il covo usa tessera e posa congelate. Se già esplorato riceve il broadcast;
altrimenti l'esplorazione imposta presenta l'introduzione originale e chiama
PRE_REVEAL. Premio, obiettivo e spawn seguono la fonte: budget 10 per eroe,
pool intero e restrizione alla sezione 3. La sua interazione finale è gated
prima del costo. Le cinque rivelazioni necessarie di altri incontri sono
compilate; le loro interazioni facoltative mantengono i rispettivi confini.
La catena 119↔123 rimane separata dagli indizi richiesti.

Il preflight riusa il consumer su stato mutabile separato e attraversa i
risultati ammessi dalla fonte senza pescare carte o selezionare uno spawn.
Comprende receiver nascosti, esplorazioni e ritorni; provocazioni e movimenti
riusano le correzioni 87. Quantità 57 non verificate: **blocco mantenuto per
preferenza esplicita del proprietario**. Nessuna quantità inventata, filtro del
pool o conversione di disponibilità ignota in riserva vuota. Consumo di un
beneficio assente e ripiego stampato restano distinti. Mazzi fisici realmente
vuoti conservano la diagnosi.

## Grounding e test

59 chiavi italiane/43 packet ricontrollati da due TextAsset puntuali; 10 owner
IL riletti staticamente. Otto anchor di esplorazione provengono da 48 oggetti,
7.668 byte consumati integralmente con accordo C/Python e parent del vero
Tile. I cinque anchor ereditati sono identici bit per bit; un oracle float32
indipendente verifica tutti e otto nella posa generata congelata. Il pack
incompleto viene rifiutato prima dello startup. Nessuna posizione authoring
mondiale sostituisce la posa giocata.

L'oracle privato separato verifica 350.000 dispatch statici, 10 percorsi del
principale e l'irraggiungibilità dell'uguaglianza nel primo tentativo pertinente,
mantenendo quel ramo nel consumer. Una fixture tecnica in memoria con dati
originali percorre tre eventi del principale fino a esplorazione del covo,
receiver, obiettivo 3 e spawn; un quarto evento raggiunge −1 senza duplicare
premio o spawn. Sono verifiche tecniche, senza costi/prove giocati dalla UI.

Le fixture pubbliche sono interamente inventate. Coprono tipi/certificati,
limiti dinamici, risorse, conferma del premio, receiver nascosto prima del
costo, esplorazione imposta o già compiuta, autenticazione, stale, retry,
concorrenza e rivelazioni. SIGKILL reali con recupero packless a costo, carte,
premio, evento/rivelazione, segnalini, obiettivo e ritorno confrontano l'intero
payload. Nove alterazioni risignate sono respinte; origine, gruppi, mazzi,
causalità e ricevute restano nel singolo replay.

Suite finale: **646/646 test**, senza skip; typecheck, formato, diff e privacy
anche della storia Git verdi. I 299 backup storici pertinenti, compresi 58
originali di 87, passano con il validatore finale; ogni campo del gameplay e
le ricevute restano identici, salvo la migrazione di versione già prevista.

## Percorso nativo e limite di accettazione

Host, profilo e tre contesti propri, HTTP IPv4 senza `crypto.subtle`. Import
nativo via filepicker dello stesso freeze ante-startup, recupero delle tre
identità autentiche e nuovo pack completo congelato prima dello startup.
Startup, seguito del timer, rivelazione della sezione 2 e prime esplorazioni
sono stati giocati con costi, provocazioni e carte effettive.

**La prova definitiva si arresta prima degli indizi:** un eroe fallisce
l'Ultimo Sforzo. L'inizio dell'Ombra del round 3 viene rifiutato perché
richiede il consumer della perdita dell'avventura. La minaccia è21, sotto il
limite64: il blocco è dovuto all'eroe sconfitto. Nessun
avanzamento viene applicato. Non è stata ripetuta la partita per cambiare
questo esito. I tre indizi e il ricevitore del covo sono pertanto verificati
con fixture; non viene dichiarata accettazione UI autentica del loro seguito.

SIGKILL packless e ricarica dei tre contesti conservano l'intero payload
nativo. Otto alterazioni risignate, inviate tramite filepicker, sono respinte
senza modifiche; il ripristino esatto del backup corrente conserva gameplay
e ricevute. I controlli nativi a 320/768/1024/1440, guida, lettore e tastiera
riguardano lo stato raggiunto. Il report privato distingue questi controlli
dalla UI di una prova d'indizio.

Due tentativi preparatori sono conservati separatamente. Il primo raggiunge
una prova d'indizio parziale e trova il messaggio del premio automatico
saltato: regressione RED→GREEN e correzione. Il secondo viene fermato prima
dei costi degli indizi quando il controllo trova tre anchor finali mancanti
nel bundle ereditato. Primarie, binding e regressione chiudono la dipendenza.
Questi tentativi non sono presentati come accettazione finale e nessun gate
57 è stato rimosso.

Originali, narrativa, mapping, IR/IL, backup, immagini e credenziali restano
nella scratch ignorata, anche nella storia Git. Input, comandi, byte/hash,
tentativi e limiti sono nel README privato e nel sigillo della consegna.
Solo checkout assegnato e dipendenze esistenti: nessun altro agente o checkout,
installazione, write GitHub, push o PR. Il tavolo protetto non è stato consultato.

Soglie 40/48/55, perdita/cap 64, combattimento finale, vittoria, campo e A2
rimangono confini successivi. Nessun terminale viene sostituito con un ritorno
ordinario. Nessuna chiusura 33/65/57, parità Unity/JIT/RNG o partita completa
viene dichiarata. Il ritorno al software precedente richiede un backup
antecedente al nuovo startup.

[Review Standards/Spec e verifica del root](../reviews/2026-11-04-clue-progression.md):
corretta una carenza nel controllo della riserva fisica prima dei costi,
con regressione RED→GREEN; suite integrata647/647. Il codice verificato viene
integrato come avanzamento, mantenendo89 aperta per l'accettazione UI mancante.
