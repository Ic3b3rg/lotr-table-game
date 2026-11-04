# Review della sconfitta e del primo campo — #91

Base `738bc8a1835e8a59b119296a48367b9259e5e0c9`; consegna
`7184621d0178ff78794fe49fd0651d803936bdb9`, cinque commit. Confronto fissato:
`git diff 738bc8a...7184621`. Requisiti: [issue91](https://github.com/Ic3b3rg/lotr-table-game/issues/91),
[spec](../planning/adventure-failure-spec.md), ADR2–3 e vocabolario del progetto.
Due reviewer indipendenti, con contesti separati, hanno esaminato Standards e
Spec. Il root ha integrato la consegna e verificato separatamente le prove.

## Standards

Nessuna violazione documentata o difetto funzionale confermato. Store.once,
replay unico e origine immutabile restano conservati. La conclusione mantiene
padri fisici, risultati e movimenti; lo stato ripulito della campagna è
separato dalla prova dell’episodio. Le modifiche ai test storici aggiornano
soltanto la versione attesa da15 a16. Nessun validatore indebolito, esenzione
di replay, test rimosso o saltato, o contenuto privato pubblicato rilevato.

**P3, possibile Duplicated Code, suggerimento facoltativo:** la stessa forma
`camp-role` con `heroId` e `roleId` compare nei validatori del protocollo e
degli input persistiti. Un unico schema esportato eviterebbe divergenze future.
Le due forme attuali coincidono. Il root rinvia l’estrazione: non corregge
un comportamento errato e non è necessaria per accettare questo incremento.

## Spec

Nessun requisito mancante, ampliamento improprio del perimetro o difetto
dimostrato nella closure91. Il reviewer ha confrontato gli owner IL di
trigger, conclusione, XP, reset, navigazione e trasferimento del ruolo;
ha inoltre validato cinque checkpoint nativi rappresentativi con il
BackupSchema corrente e il replay integrale.

La perdita avviene prima degli effetti della prossima Ombra, sotto il limite
di minaccia. Il campo contiene tre premi nei ruoli corretti, Sapienza,
modello successivo e un solo passaggio; cambiare ruolo conserva gli XP nel
ruolo premiato. Origine round1/Azione e pack rimangono invariati.
Assenza di superstiti e sconfitta durante un’Ombra già iniziata sono coperture
sintetiche esplicitamente distinte dalla partita originale. Vittoria, campo
completo, A2 giocabile, soglie successive e benefici57 sono confini futuri
ammessi dal ticket, non funzionalità dichiarate complete.

## Verifica indipendente del root

Il sigillo contiene **1.127 file, 1.092.580.181 byte**; tutti gli hash e i
48 file pubblici coincidono con la consegna. SHA256 del manifest:
`d5fd2d527907da04bcdaa88149750dfe8dd50604d26215cbb4d5a59b2165681b`.
Copie APFS in una scratch propria, timestamp conservati; nessun helper
eseguito nelle prove ricevute o contro i loro database.

Il root ha riletto due modelli completi, il principale, le nove chiavi
localizzate e i binding delle abilità: quattro output oracle identici.
Ha ricatturato **35 corpi IL, 9.644 byte, 3.249 istruzioni** dalle primarie:
byte, hash e target di salto concordano. Il nuovo pack ricompilato è
identico byte per byte al pack congelato prima dello startup; fingerprint
`0047087307ef2cdf1cd0c51aed5a3a62d116e94584bc729b9983e897455ce3b2`,
34 definizioni,196 stati,192 azioni,42 confini differiti. Nessuna esecuzione
Unity/JIT o affermazione di parità della casualità.

Il percorso nativo ricevuto usa tre contesti personali, input reali e un
nuovo avvio necessario per congelare la capacità. Completa sconfitta,
messaggi, premi, mappa della campagna, racconto e primo campo. Il root ha
ispezionato catture reali di campo320 e lettore1440; le dodici combinazioni
dei tre proprietari e quattro larghezze sono documentate dalla consegna.
Non ha avviato un secondo host o ripetuto la partita.

Il tentativo di restore con puntatore errato resta conservato ed escluso
dall’accettazione. Non vi è gameplay da quel checkpoint; il successivo
restore del download corrente verifica l’intero payload e le ricevute,
salvo i campi amministrativi. Le prove packless e gli errori di rete causati
dagli arresti intenzionali rimangono distinti dagli errori del prodotto.

La suite completa sul checkout integrato passa **662/662 test**, zero
fallimenti, cancellazioni, skip o todo; durata308.320,807709ms. Build,
typecheck, formato e diff check sono verdi. Dieci backup nativi alterati
e coerentemente risignati sono respinti anche dal validatore del root.
Controllo privacy su248 needle originali: zero corrispondenze nelle
aggiunte pubbliche e nella nuova storia Git.

## Compatibilità e decisione

**351/351 backup storici** riconvalidati dal root, compresi i52 nativi89:
ogni campo di gameplay e tutte le ricevute coincidono con l’input; unica
modifica la migrazione esplicita della versione dello schema a16.
**59 payload nativi distinti da88 catture/download** sono inoltre accettati
dal validatore corrente, senza modifiche all’intero payload. Conservano
un unico pack e un’unica origine round1/Azione; lo stato iniziale vuoto
non possiede ancora quell’origine. Il restore con puntatore errato resta
esplicitamente escluso dall’accettazione, anche se è un salvataggio valido.

Schema16, migrazione strutturale senza aggiungere capacità ai pack storici.
L’attivazione richiede il nuovo materiale prima dello startup; il vecchio
checkpoint89 non viene aggiornato retroattivamente. Per tornare a un host
precedente serve una copia antecedente alla migrazione: quel codice non
legge schema16. Il tavolo protetto non viene migrato o riavviato.

#91 copre la sconfitta da eroe e il primo campo. #89 rimane aperta per la
prova nativa degli indizi. #33/#65/#57 restano aperte; benefici bloccati
fino a quantità verificate, per decisione esplicita del proprietario.
La partita completa con entrambi gli esiti e la prosecuzione ad A2 resta
da realizzare e verificare.

Standards: zero difetti confermati, un suggerimento P3 facoltativo rinviato.
Spec: zero difetti confermati.
