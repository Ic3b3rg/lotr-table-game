# Prove collettive dei superstiti — #98

Implementazione personale di [#98](https://github.com/Ic3b3rg/lotr-table-game/issues/98)
su `645e74e1313b9bb88c671c0a8ce30d0dab86b448`, dopo PR97.
[Specifica e piano](../planning/live-groups-spec.md) precedono il codice.
Review Standards/Spec e integrazione spettano al root.

## Comportamento e capacità

Le prove collettive dello scenario proseguono per i superstiti quando lo
slot0 o un altro eroe è già sconfitto. Dopo ogni ammontare fisico completo,
compresi i fronti discendenti, il controller Ultimo Sforzo esistente risolve
gli obblighi prima della successiva scelta del gruppo. Anche un destinatario
futuro sconfitto da un discendente esce dall'ordine. Un chooser sconfitto
passa la registrazione della scelta a un superstite.

Prova, conseguenza collettiva, oscurità e reset collettivo condividono il
controller fisico. Nell'oscurità sono conservate le reazioni simultanee
pertinenti. Al ritorno, il reset raggiunge i superstiti anche con slot0
sconfitto; la nuova fase sincronizza la sconfitta già registrata. Nessun
polling della perdita viene aggiunto nel mezzo delle pescate o delle scelte.

Chooser della richiesta, destinatari fisici e numerosità fonte sono distinti.
Il gruppo concorda l'ordine; il proprietario indicato registra la scelta;
il proprietario dell'eroe scelto nega e subisce. La UI rende espliciti attesa
e ritorno alla fonte, mantenendo guida, lettore e controlli esistenti.
Nessuna conferma o regolazione libera aggiunta.

`PlayerCount`, formula della minaccia, budget, campagne e proprietà non
perdono un eroe quando viene sconfitto. Carte, risorse pagate, risultati e
continuazioni restano conservati. Con superstiti il padre ritorna una volta;
senza superstiti resta sospeso nella conclusione immediata. La perdita
differita conserva la finestra fonte e la priorità eroe/cap.

`manifest.liveGroups`, versione `source-live-groups-v1`, richiede attestazione
e hash dei controller rounds/followup/failure prima dello startup. Soltanto
quel freeze produce programmi con `groupRules` corrispondente. Programmi
fisici inseriti arbitrariamente nel pack non possono dichiararlo.
Nessun comando aggiorna una capacità o l'origine durante il run.

Schema19 aggiunge la forma nuova. La migrazione18→19 è strutturale;
formati precedenti rifiutano il marker anche nell'origine del replay.
Pack e programmi storici conservano forma, impronta, origine round1/Azione,
ricevute e semantica. Il replay confronta tutti gli output, senza esenzioni
o normalizzazioni di gameplay. Il preflight completo rimane prima di costi,
RNG e minaccia, con popolazioni e gate originali.

## Grounding e prove

Sigillo96 verificato integralmente: 1.393 file, 1.166.317.557 byte;
manifest SHA256 `9110f4fef3bb336d346d4b5ad9d6db2c48080152d1ceab1ea6dfe0c56fd47844`.
Copie e adapter soltanto nella scratch propria, nessun DB ricevuto aperto.
Grounding finale ristretto a 13 corpi IL degli owner pertinenti, 5.809 byte
codice e 1.889 istruzioni. `A0cb0` legge la lunghezza della Compagnia;
`A3902`, `A3bf4`, `A1229` e `A3908` attestano priorità, superstiti e ritorni.
Il [Rules Reference ufficiale](https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf)
integra la lacuna del PDF nel lock ricevuto: ordine del gruppo, negazione,
sconfitta e confine dopo il completo subito (§§22–24 e54, p.2).

Rilettura statica dei receiver96 e oracle bounded riprodotti. Tutti e tre
gli output storici del compiler sono identici byte per byte; impronta
`6540d71d0feb7a643133cd01fadfd2cc17918a5b9886dff3d1b146ccd0c03b85`.
Il nuovo freeze statico differisce soltanto per la capacità esplicita.
Nessuna esecuzione Unity/JIT, parità RNG o partita originale dichiarata.

Quattordici test nuovi: RED→GREEN del difetto sul vero programma scenario,
attestazione e confini storici, due/uno/zero superstiti, morte del chooser
e di un futuro destinatario, negazione e oscurità, reset e carte conservate.
HTTP/Store.once verifica attore errato, concorrenza, retry e stale;
cinque SIGKILL e cinque restore packless confrontano payload e viste interi.
Nove alterazioni risignate sono respinte; una anche via HTTP422 immutato.

Suite canonica finale **719/719**, zero fail/skip/cancel/todo,
491.597,976375ms, concorrenza4 invariata, eseguita separatamente da QA e
validator pesanti. Typecheck, formato e diff passano. Audit dei21 file di
test preesistenti modificati: soltanto aspettative di schema18→19; nessun
caso, deadline, asserzione, soglia, script o dipendenza indebolito.

Validator finale dal codice committato: **503/503** file autorizzati,
**398 payload distinti**, tutte le17 viste pubbliche94 complete. Passano
anche i18 snapshot/viste96, export e stato finale. Ogni file è confrontato
interamente una volta nella verifica finale; le copie identiche non sono
nuove prove indipendenti. Sono ammessi soltanto schema19 e il default
storico physical:null per schema≤10. Il gate156 rimane invariato.

UI nativa finale inventata: **132 casi**,11 checkpoint ×3 identità ×4
larghezze320/768/1024/1440, su HTTP IPv4 senza crypto.subtle. Percorso
reale dall'oscurità alla sconfitta, scelta dei superstiti, entrambe le prove,
negazione, deployment, reset e ritorno alla Riorganizzazione. Guida, lettore,
focus, tastiera e assenza di overflow verificati. La ripetizione finale usa
lo stesso checkpoint proprio, entropia e risultati conservati. Il primo
passaggio precedente alla correzione del reset è escluso dai conteggi finali.

492 PNG prodotti, alcuni ispezionati direttamente; nessuna ispezione manuale
di tutti i492 dichiarata. Quindici file eventi: zero eccezioni pagina e
loadingFailed, due HTTP422 intenzionali. Export e restore correnti nativi
confrontati integralmente; due alterazioni risignate respinte senza mutazioni.
I14 snapshot/viste propri contengono13 payload distinti, tutti validati.
Solo generation/revision/updatedAt sono amministrativi nel confronto del
restore. Host, browser e tre contesti propri chiusi, porta propria rilasciata.

Privacy:260 needle delle fonti, zero corrispondenze in diff aggiunto,
untracked pubblici e nuova storia. Corpus, ricevute, comandi, tentativi,
byte/hash, manifest e README rimangono nella scratch ignorata. Il validator
è ricostruito anche dalla consegna e confrontato byte per byte con quello
usato per l'intera compatibilità; nessuna esenzione replay.

## Limiti

Le prove positive e la UI sono interamente inventate. Le quantità57 restano
null/non verificate per decisione del proprietario; nessuna riserva o proxy
aggiunto. Il checkpoint156 viene soltanto confrontato e preflightato senza
mutazioni, mai ripreso. Nessuna nuova partita originale o accettazione89/33.
Vittoria/covo, altri incontri/terreni, campo completo e A2 restano nel seguito;
#57/#65/#89/#33 rimangono aperte. I dati schema19 richiedono il nuovo lettore;
un rollback usa un backup precedente. Nessuna installazione, agente,
checkout aggiuntivo, scrittura GitHub, push, PR o merge.

## Integrazione del root

[Review Standards/Spec e verifica indipendente](../reviews/2026-11-05-live-groups.md):
zero rilievi bloccanti nei due assi, un suggerimento facoltativo di manutenzione.
Il root riproduce fonti e compilazioni,503 confronti interi e le viste17/18/14,
export/finali; suite719/719 a concorrenza4,494088,483417ms. Codice consegnato
invariato. Il sigillo ricevuto resta intatto; adapter e prove root separati.
Quantità57 e accettazione originale rimangono bloccate come sopra.
