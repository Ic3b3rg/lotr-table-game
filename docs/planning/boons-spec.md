# Benefici: consumer e riserva verificabile — #94

Base `f9d9db890ac25adf7d1cfa6970454155f94eaf6c`, schema16, 662 test.
Contratto: [issue94](https://github.com/Ic3b3rg/lotr-table-game/issues/94),
ADR2–3 e baseline di fedeltà. Implementazione personale nel checkout assegnato;
il root possiede review Standards/Spec e integrazione.

## Risultato

Collegare i tre programmi beneficio ai consumer fisico e combattimento esistenti:
concessione fonte, custodia per copia, uso nelle prove/attacchi, scarti obbligatori
e ritorno alla riserva. Nessun motore parallelo, dipendenza o assegnazione libera.
I confini pubblici di prova sono compiler/API fisica e HTTP dell'host, inclusi
backup/restore e Store.once. Le fixture pubbliche sono interamente inventate.

## Fonti e precedenze

Grounding limitato alle tre definizioni di57, Rules Reference p.2, §§15.1–15.4,
27.3, prove/attacchi e FAQ IT2.0 pp.1–2; concessioni e ritorni tramite le
istruzioni già compilate e la primaria puntuale del gate89. Testi, mapping,
identità, IR e confronto indipendente restano privati. Il programma strutturale
deve essere legato agli hash dei campi originali, alle fonti e alle meccaniche;
non si interpreta prosa o nome a runtime. I divieti assoluti prevalgono.

Il primo programma scarta facoltativamente il beneficio per sostituire un
numero scelto di carte della prova con altrettante rivelazioni. Conservare
identità, carte dei padri, ricicli e pagamenti precedenti: la carta sostituita
non conserva simboli convertiti, le risorse pagate non sono restituite.
Il secondo aggiunge colpi all'attacco una volta e viene scartato quando si
subiscono realmente danni/paure e a fine turno senza nemici vicini.
Il terzo previene obbligatoriamente i danni prima della prova di un attacco
subito e si scarta anche quando un divieto impedisce la prevenzione; in un
attacco proprio può invece essere scartato facoltativamente per successi.
Valori, finestre, famiglie e modalità provengono dagli input attestati.

## Dati e conservazione

Artefatto `source-boons-v1` distinto dal catalogo57: tre definizioni con
programmi e provenienza; stock `unverified` oppure copie/quantità interamente
verificate. Il compiler non certifica autenticità editoriale dai flag input.
Il catalogo57 mantiene tutte le sue invarianti e rimane diagnostico quando
le quantità sono null. Stock sconosciuto, verificato vuoto e disponibile sono
stati diversi. L'esaurimento senza norma attestata resta un motivo specifico
di rifiuto prima dei costi, senza sostituzioni inventate.

Ogni copia è in riserva oppure scoperta presso un eroe; un eroe non acquisisce
una seconda copia dello stesso tipo. Benefici fuori da mazzi e quattro slot
preparati. La custodia e la provenienza della concessione non attribuiscono
proprietà di campagna. Lo scarto restituisce la stessa copia, senza crearne.

## Integrazione e compatibilità

Capacità esplicita nel manifest, legata al fingerprint dell'artefatto e
congelata prima dello startup. Schema17 migra strutturalmente i salvataggi
precedenti senza ricostruire copie né abilitare la capacità; marcatori nuovi
in schemi storici sono rifiutati. Pack senza marker conservano gate e replay.
Artefatto, stock, contesti e ricevute sono autosufficienti nel backup.

Il consumer riusa le decisioni fisiche, il singolo ledger v2 e Store.once.
Il predicato della concessione usa il subito diretto sigillato, senza saldi
delle aree o conseguenze figlie. P1/P2, movimento dovuto, attori e ritorno
del padre rimangono ordinabili e ricostruibili. Il preflight attraversa l'intera
closure obbligatoria prima di costi/RNG. Fronti e titoli raggiungibili usano
questo consumer oppure conservano un confine esplicito prima dell'intero costo.
Nessuna apertura di nuove famiglie di incontri o capacità non compilate.

## UI e verifica

Italiano per fonte, carta, proprietario, attese, uso/costo e prossimo passo;
lettore e guida accessibili. Un blocco noto della prossima Ombra è visibile
prima di offrire un avanzamento impossibile, senza rivelare istruzioni future.
Nessun controllo libero per benefici o quantità.

RED→GREEN per compiler/provenienza, unknown, duplicati, esaurimento,
conservazione, tre programmi e divieti, conversioni pagate e riciclo,
subito diretto/figli, concatenazioni, attori, stale e concorrenza. Recovery
SIGKILL/restore packless, confronto intero, alterazioni risignate respinte;
oracle privato distinto3/3. UI sintetica con tre identità, HTTP IPv4 senza
crypto.subtle,320/768/1024/1440 e tastiera/focus. Suite completa finale dopo
gli ultimi cambi; typecheck, formato, diff e privacy anche nella storia.
Se cambia replay/validator, riconvalidare75 payload89,351 storici e59 nativi91.

## Vincoli e confini

Quantità originali null/non verificate: mantenere il gate57 e lo stato intero
del checkpoint156. Nessuna nuova partita originale, rewind o selezione
alternativa. Nessuna accettazione89/33 con fixture. Nessun altro agente,
checkout, installazione, GHwrite, push o PR. Prove ricevute in sola lettura;
helper letti e adattati nella scratch propria prima dell'esecuzione.
Directory e porta protette non consultate. Sigillo privato con input,
byte/hash, comandi, tentativi e limiti; processi propri chiusi alla consegna.
