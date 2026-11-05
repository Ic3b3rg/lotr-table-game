# Covo, vittoria e primo campo — #100

Base `c38a8c6ce8e3b62ddd1ce95b424af186d2769ff4`, schema19,719 test.
[Contratto canonico](https://github.com/Ic3b3rg/lotr-table-game/issues/100),
[spec](../planning/lair-victory-spec.md) e
[piano](../planning/lair-victory-plan.md) antecedenti al codice (`e4d22ec`).
Implementazione personale nel checkout assegnato. Review Standards/Spec fresche
e integrazione spettano al root; nessuna delega, installazione o scrittura GitHub.

## Fonte e perimetro

Il covo ora usa i controller condivisi per conferma, prova con carte,
conversioni, somma persistente, fallimento e nuovo tentativo. Solo il suo
EndGame certificato raggiunge la vittoria del principale e il primo campo.
Non è stato dedotto un combattimento obbligatorio dal nome del luogo.

Il sigillo ricevuto98 comprende2169 file/1446920021 byte, SHA256
`4c450bd02b83c72b125fe81c30610d42aa34dadfdb21c52671905d74b6a8944c`.
Tutti verificati prima del parse;1245 file pertinenti copiati nella scratch
propria. I27 input originali mantengono le proprie ricevute, separate dai
path rilocati e dagli helper adattati. La sola primaria ulteriore necessaria
è stata seguita tramite README91 e relativo lock, verificandone byte/hash.
Nessun helper o DB ricevuto è stato eseguito in posto.

R27686 è stato riletto integralmente:18 stati/23 azioni,82712 byte;
R20275:35 stati/50 azioni,188796 byte. Due lettori concordi e puntatori
controllati. Due modelli di avventura aggiungono740 byte. La closure
confrontata comprende tutti i18 stati del covo e il ramo30/32/33 del principale,
con29 azioni verificate. Il vecchio pack ne conservava soltanto10 nel covo:
il nuovo freeze compila anche l’interazione precedentemente differita.

Gli owner bounded di challenge, callback, EndGame, segnale, bonus, XP e
passaggio comprendono17 corpi IL/1077 byte di codice/376 istruzioni;
`PlayMaker.ActivateActions` aggiunge154 byte/68 istruzioni. Lunghezze e salti
controllati. Sedici chiavi provengono dai due TextAsset italiani puntuali.
Originali, packet, prosa, carte e dump FSM/IL restano soltanto nella scratch.

L’oracle è separato dal generatore del pack e dal runtime. Confronta parametri,
binding, ordine dei ResultPairs, messaggi/stili/icone, condizioni, effetti,
owner e transizioni della closure. Verifica50000 combinazioni finite di
somma e risultati, compresi uguaglianza, valore successivo, limite dinamico
e fallback. Il caso di una sola figura è statico; le prove eseguibili usano
Compagnie supportate di2–5 eroi, inclusi uno o più superstiti.
Nessuna esecuzione Unity/JIT, parità RNG o partita originale è dichiarata.

## Contratto di esecuzione

`manifest.lair` è facoltativo e attestato prima dello startup. Congela
prefab, indizi, conclusione, definizioni complete e owner del controller.
La nuova istruzione EndGame è ammessa soltanto nel suo owner. Il validator
degli indizi conserva l’esclusione precedente: è la nuova capacità ad
abilitare quel solo prefab. Il permesso per mutazioni di campagna resta
limitato ai due rami certificati del principale e alla destinazione comune.
I premi della missione non aprono un permesso generale per XP o Sapienza.

Ispezione e annullamento sono gratuiti. Il comando confermato paga una sola
azione; prove, carte, conversioni, effetti fisici e provocazioni usano i frame
esistenti. Un altro telefono riprende il totale salvato. La Compagnia conserva
la propria numerosità dopo una sconfitta; budget, minaccia, proprietà e XP
non vengono ridotti. Non è stato aggiunto polling della perdita: con
superstiti la vittoria può precedere la finestra differita; senza superstiti
resta il confine immediato della fisica.

Il ledger della conclusione conserva attore, tentativo, effetto, comando
causale, contesto e principale sospeso. Il covo termina e ritorna una volta;
lo stesso consumer assegna premi per ruolo, bonus equipaggiato, destinazione,
passaggio e campo una volta. L’episodio, le carte, i discendenti e le ricevute
restano integri. Il campo possiede separatamente lo stato del seguito.

Il preflight attraversa anche il termine, i premi, la mappa della campagna,
il racconto e l’ingresso nel campo prima di costi, carte o RNG. Conserva
popolazioni intere e gate specifici. Nessuna selezione o riduzione di pool
per evitare una dipendenza.

Schema20 migra19 e precedenti solo strutturalmente. Nessuna capacità viene
aggiunta a un run; origine round1/Azione immutabile. I vecchi formati
rifiutano capacità, opcode ed esito nuovi anche nel seed. P1/P2, failure e
replay storici restano senza normalizzazioni di gameplay o esenzioni.

## Prove eseguite

Quattordici nuovi test sono passati insieme a concorrenza4. I RED pertinenti
comprendono opcode/capacità assenti, mancato preflight terminale, migrazione
e sostituzione dell’assembly del controller. Gli errori iniziali di setup
sono registrati separatamente e non vengono contati come RED validi.

I test sul vero programma scenario coprono uguaglianza e valore successivo,
fallimento e retry, somma fra eroi, conversioni pagate, carte/copie, discendenti
P1/P2, sconfitta di un attore e di tutti, priorità delle finestre fonte,
proprietà e premi di tutti gli eroi, ritorno e campo singoli.
HTTP/Store.once esercitano attore, sorgente, copia, richiesta, cursor,
stale, retry e concorrenza, confrontando l’intero payload quando un input
viene respinto. Il preflight negativo conserva integralmente lo stato.

Undici SIGKILL riprendono su host nuovi vuoti senza pack, prima/dopo carte,
fallimento, retry, premi e passaggi. Payload e viste interi sono confrontati;
solo generation/revision/updatedAt differiscono per il restore amministrativo.
Tredici alterazioni risignate sono respinte; una anche da HTTP con payload
corrente intatto. Altri sette SIGKILL al vero confine del commit SQLite
provano rollback di costo, pesca, callback, premi, passaggio e campo insieme
alle ricevute. Il retry ricostruisce l’intero candidato, salvo updatedAt.

## QA nativa inventata

Precondizioni ante-startup dichiarate nel manifest privato: catalogo, mappa,
testi, valori e identità inventati; tre eroi preparati, covo noto senza
premio iniziale, progresso nullo e nessuna conclusione impostata. La fixture
aggiunge una conseguenza P1/P2 inventata al tentativo fallito. Non è un
salvataggio originale né una simulazione del successo impostando il flag.

Tre contesti Chrome propri con tre identità indipendenti, HTTP IPv4 sulla
porta propria4401, crypto.subtle assente. Startup e seguito sono stati
giocati con DOM/Input; Node HTTP soltanto GET per osservare. Il primo eroe
fallisce e viene sconfitto dalla conseguenza; un altro proprietario riprende
le carte e il totale fino alla vittoria. Il campo conserva i premi di tutti.

Sedici checkpoint QA ×12 combinazioni di identità/larghezza320/768/1024/1440:
192 casi, inclusi ispezione e annullamento gratuiti.600 PNG acquisiti;
sono state ispezionate direttamente viste di prova/carte320, esito768 e
campo320, senza dichiarare ispezione manuale di tutte le immagini.
Nessun overflow; guida, lettore, focus di ritorno e tastiera verificati.
Nessun controllo libero per esiti, vittoria, importi, benefici o minaccia.

Dodici file eventi/19870 eventi registrati: zero eccezioni runtime e zero
loading failure, due HTTP422 intenzionali per negativi risignati via UI.
Export nativo, restore esatto, recupero dei tre posti e finale verificati.
Diciassette snapshot con viste intere sono conservati separatamente dalle
copie identiche. Contesti, browser e host propri chiusi; uscita dei PID
propri e riapertura/chiusura della porta4401 verificate.

## Compatibilità e verifica finale

Il validator proviene dal commit prodotto `02ec47f`, con quattro export
runtime verificati:1521208 byte, SHA256
`e2a111bd2855f1dbcb3ff9bffeec740c2ead17aacf83f5fb7f53c58426180720`.
È byte-identico al validator utilizzato per i negativi nativi. Il rapporto
privato conserva ciascun input, hash, confronto, comando e tentativo.

Il confronto finale passa503/503 file autorizzati,398 payload distinti e17
viste94 intere:913356631 byte includendo le viste. Passano anche18/18
snapshot/viste96 ed export/finale e14/14 snapshot/viste98 ed export/finale
(13 payload distinti). Le17 catture native proprie hanno16 payload distinti,
con viste intere ed export/finale verificati. Copie identiche non sono nuove
prove indipendenti.

Le sole migrazioni ammesse sono schemaVersion20 e il default physical:null
preesistente per formati≤10. Origine, impronta, packet, carte, RNG, stock,
programmi e ricevute sono confrontati integralmente. Nessun gameplay è stato
eseguito su dati ricevuti. Il checkpoint originale156 conserva il gate delle
quantità non verificate e l’intero payload immutato.

La suite canonica completa è passata733/733, zero failure/skip/cancel/todo,
551171.402167ms, con `--test-concurrency=4` invariato, dopo QA/validator pesanti
conclusi e superfici proprie chiuse. Passano typecheck, formato e diff check.
Le22 modifiche ai test precedenti sono soltanto aspettative dello schema
corrente19→20; nessuna deadline, asserzione, caso o soglia indebolita.
Il controllo privacy confronta269 needle con diff, file pubblici nuovi e
intera storia della consegna: zero corrispondenze.

## Limiti e consegna

Le quantità57 restano null/unverified per decisione esplicita del proprietario.
Nessun proxy, banca infinita, unknown=empty, filtro, reroll o nuova domanda.
Nessuna nuova partita originale, ripresa156, accettazione89/33 o chiusura
57/65/89/33. Altri rami,119↔123, campo completo/acquisti e A2 restano successivi.
Le prove native inventate non equivalgono alla partita autentica completa.

La scratch privata contiene README, ricevute originali e rilocate, oracle,
compilazione, log dei tentativi, checkpoint, input lock, chiusura delle sole
superfici proprie e sigillo finale. Non vengono distribuiti contenuti originali.
I commit sono locali: nessun push, PR, merge o scrittura GitHub.

## Integrazione del root

[Review Standards/Spec e verifica indipendente](../reviews/2026-11-05-lair-victory.md):
nessun rilievo bloccante, un suggerimento di manutenzione facoltativo.
Il root riproduce primarie, oracle e tre output del compiler identici,
503 confronti interi e le viste17/18/14/17 con export/finali. Suite733/733,
552249,210708ms a concorrenza4, codice consegnato invariato. Audit UI distinto
fra168 casi completi e24 ispezioni/annullamenti, tutti inventati; nessuna
nuova partita originale o accettazione89/33. Quantità57 e gate preservati.
