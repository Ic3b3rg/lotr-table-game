# Fronti fisici e continuazioni P1 — #65

3 novembre 2026. Base `5378c0b702d7362f4badea1daf4b84fab30beac4`,
schema11, baseline444. Autorità: [issue65](https://github.com/Ic3b3rg/lotr-table-game/issues/65),
[contratto61](../research/physical-resolution-runtime-contract.md), review61,
spec/verifica/review63, ADR0001/0002. Esecuzione inline autorizzata, senza
checkout, delega, installazioni, scritture GitHub o nuove approvazioni.

## Obiettivo e uscita

P1 complessiva richiede le36 definizioni originali, executor sequenziali,
passive/trigger, finestre/costi e figli prova/Scoperta/debolezza. Questa
implementazione procede per incrementi verticali. L'uscita iniziale P1a
attraversa compiler privato, freeze, risoluzione annidata, consumer scenario,
Store.once e UI. Include compilazione36/36, operazioni fisiche interne,
risorse disponibili, negazione fonte e prevenzione con costi reali, figli
prova/Scoperta e replay. Le finestre persistenti sono rappresentate da eventi
tipizzati e le passive sono derivate dalle sole copie attualmente scoperte.
L'aggancio di ogni evento al ciclo ordinario (turni, Riposo, oscurità,
interazioni, attacchi) deve essere verificato separatamente: se incompleto,
P1 non è completata e il rapporto elenca il seguito P1b. Nessun evento
inventato è presentato come evento originale, né un contatore come executor.

P2/Ultimo Sforzo, P3/incontri e P4/acquisizione benefici restano separati.
#57 resta aperta,5/5/5 non confermato. Un mazzo necessario realmente vuoto
conserva diagnosi e continuazione, senza sostituzioni. Nessuna partita completa.

## Moduli e seam autorizzati

1. `physical-resolution`: piccola interface freeze/open/answer/validate/view;
   compiler privato rigoroso come ingresso separato, senza nomi/prosa eseguibili.
2. `scenario/physical`: adapter fonte esclusivo, risorse riconciliate con la
   preparazione e tutte le cronologie/ricevute, nessuna esenzione dal replay.
3. UI: solo proiezione pubblica, decisioni correnti di actor autorizzato.

I seam TDD sono queste interface, HTTP/SQLite e controlli UI. Approvazione già
contenuta nell'incarico; root esegue successivamente Standards/Spec.

## Compiler, fonte e salvataggio

IR versionato con opcode enumerati e schemi stretti; quantità, destinatari,
sequenza, alternative, simultaneità, condizioni e trigger espliciti. Un input
privato associa ogni definizione a hash della carta normalizzata, campi
originali, localizzatori e fronti verificati. Il compiler verifica tutte le
36 definizioni e il fingerprint delle due famiglie raw. Non interpreta testo,
non ignora opcode, non usa eval o fallback. Artifact e dipendenze/policy
congelati diventano autosufficienti; le associazioni restano ignorate.

Schema12 migra1–11 senza reinterpretare le richieste P0. Versione fisica1
conservata; versione2 include artifact e contesto iniziale delle risorse,
con replay completo. P0 continua ad accettare32×32 programmi; journal almeno
2050 record e cursore7084800. I nuovi limiti derivano dal budget di esecuzione
esplicito e non riducono quello preesistente. Eccesso diagnosticato senza
commettere metà di una nuova risposta.

La fonte scenario resta esplicitamente sintetica per QA: profilo distinto P1,
parametri hash-bound, programma non fornito dal client, freeze autentico
preservato. Carte originali e programmi inventati sono distinti nel rapporto.
Actor/eroe/copia, pack/proiezione, request/cursor, generation/revision,
source-history/task/instance/request e ricevute sono ricostruiti. Costi,
trasferimenti, casualità, figli e receipt nello stesso Store.once.

## Semantica

Una carta scoperta e tutti i suoi discendenti terminano prima della successiva.
Flip casuale materializza bersagli senza sostituzione, li mantiene nella zona
reale, controlla ancora l'eleggibilità alla ripresa e non li sostituisce.
Scarto restituisce sotto il mazzo proprio; sostituzioni precedono lo scarto.
Flip in giù non è nuovo subire e spegne immediatamente passive/trigger.
Selezioni miste distinguono scoperte identificabili e coperte casuali.

Alternative proposte solo se integralmente fattibili; perdita obbligatoria
con carenza risolve quanto possibile, come inferenza dichiarata in61.
Conservazione56 copie fisiche e riserva comune delle debolezze; prove/Scoperta
non riciclano carte temporaneamente rivelate dal padre. Nessuna risorsa negativa.

Negazione soltanto se concessa dalla fonte, successi non riusati, subire
volontario lecito. Finestra prima della pesca, negazione prima di prevenzione.
Protezione richiede copia preparata, actor, stessa casella, destinatario,
costo distinto; più contributi e un beneficiario per uso. Crediti P0 restano
esclusivamente sintetici e non pagano capacità originali. Divieti assoluti
prevalgono; scarto imposto non attiva Protezione. Policy selezionate legate a
hash della definizione verificata, nessun motore implicito di tutte le carte.
Limiti effettivi derivati da stato/copie/policy; soglia dopo l'intera fonte,
gate P2 preciso senza fingere Ultimo Sforzo.

## UI, privacy e accettazione

Fronte/testo solo delle scoperte; retro/conteggi per coperte, scelta/costo,
attore/destinatario, persistenti e fonte sospesa. Niente ACK sostitutivi,
annullamento delle conseguenze obbligatorie o conferme automatiche superflue.
Guida sempre disponibile, label native, focus/status,320/768/1024/1440.
Nessuna identità/ordine/entropia nascosta in API/eventi/receipt/DOM/reader/log;
backup completo è esportazione amministrativa privata.

Criterio8: matrice privata36/36 e checker distinto dal generatore verificano
IR e risultati rispetto a raw/matrice bloccati; manifesto con hash. T03–12/15
pertinenti e regressione P0. HTTP/SQLite reali: input illegali/cross-source,
retry/concorrenza, SIGKILL, restart/restore senza pack, backup alterati
risignati e cancellazione concorde di cronologie. Browser con tre identità,
almeno una cascata con scelta e figlio prova o Scoperta, usando veri raw/IR
privati e dichiarando ogni precondizione. Solo UI per avanzare l'accettazione:
nessun HTTP/SQLite scrivente per preparare o superare il percorso.

Materiali root read-only. Risultati nuovi in `.scratch/physical-p1/`; nessun
main altrui. Porta4355 solo se libera,4339/PID12892 e skill-tests-browser
intoccabili. Solo processi/schede propri chiusi. Telefoni/LAN/Windows/Safari
non certificati. Consegna distingue test, artefatti e browser effettivo;
npm test/typecheck/format:check/diffcheck, storia Git privata pulita, HEAD e
commit. Nessuna suppression, skip o dipendenza nuova.
