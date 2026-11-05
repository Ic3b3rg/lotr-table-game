# Review e integrazione delle ricerche — #110

Confronto fissato: main`cd125df0466878ba808d30b2107a72e1fb66995d` e
consegna`1944e9573c69e28d9cddbc3dae8b8d6596a35d0b`. Due review indipendenti
con contesti separati. [Ticket](https://github.com/Ic3b3rg/lotr-table-game/issues/110),
[specifica](../planning/search-encounters-spec.md) e [rapporto](../development/search-encounters.md).

## Standards

Zero violazioni documentate e nessuno smell di riferimento azionabile.
La capacità segue i compiler, il controller fisico, le guardie ownership,
la migrazione e il replay esistenti. Le modifiche ai vecchi test aggiornano
soltanto l'aspettativa della versione corrente. Review in sola lettura,
senza esecuzione di test, build, host, browser o prove private.
Totale: zero rilievi.

## Spec

Nessun requisito mancante/parziale, ampliamento o errore sostanziato.
Verificati scelta già pagata e cancel iniziale, binding locale e limiti
inclusivi/fallback, preflight delle intere popolazioni, cura/Scoperta/
disposizione/preparazione dagli scarti, sostituzioni/limite quattro/trigger,
reset del mazzo in tutti gli esiti, sconfitta, owner esclusivi, builder storici
senza owner, vecchi formati/seed/dizionari, registro e ricevute.

Il reviewer ha verificato sigillo e artefatti statici selezionati prima della
lettura, inclusi oracle, adapter e IL di selettore/clamp;17stati17azioni
concordano con il codice. Nessuna esecuzione di helper/DB ricevuti, host,
browser, build o gameplay originale. Totale: zero rilievi.

## Verifica del root

Nessuna modifica di prodotto aggiunta dal root. Copia e controllo completo
per byte/hash di8.542file/3.654.464.113byte e due copie proprie, senza link
simbolici; profili operativi esclusi. Fonti/identità/ricevute rimangono
immutate. Solo gli handle operativi sono adattati nella copia di lavoro;
i relativi lock dei percorsi ricevono un digest separato.

Le primarie riproducono8oggetti/92.974byte,17stati17azioni,2003parametri e
35corpi IL/6246byte/2235istruzioni; oracle indipendente e100conteggi.
Tre compilazioni producono identici byte. Selezione, istruzioni precedenti,
altri owner e capacità restano invariati. Verificate anche le regole di
reset e preparazione nel [Rules Reference ufficiale](https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf),
§§69,76.1,112.4; nessuna nuova correzione necessaria.

Il validator dai sorgenti committati confronta integralmente503file/398payload distinti e17viste94. Le serie96/98/100/102/104/106/108 mantengono18/14/17/19/13/20/22 snapshot/viste, export e finali;110conserva40snapshot/37payload distinti e9recheck/6distinti dei medesimi giochi. Payload, viste e origine sono interi; sole migrazioni strutturali attestate. Il binario è identico per byte dopo il solo miglioramento diagnostico del test.156 rimane statico, gated e immutato.

L'audit UI distingue444casi dei tre episodi inventati (372completi,
72di ispezione/cancel) da72ulteriori controlli di restore dei medesimi
stati. Tre identità, quattro larghezze;30+27file di eventi,62.365+10.426eventi,
nessuna eccezione Runtime o caricamento fallito,12restore422 intenzionali.
Verificate integrità, ricevute di pittura e dimensioni di1680+288PNG;
cinque viste positive lette direttamente, incluse guida e lettore mobile.
I duplicati non aggiungono gameplay, e non si afferma di aver letto ogni
immagine. La cura positiva è dimostrata dagli automatici con vere carte
detenute, non dedotta dal ramo nativo senza danni. Ricevute di chiusura proprie
verificate, senza inventario o controllo di processi altrui; nessun nuovo
browser del root. Gli episodi di sviluppo precedenti restano esclusi.

Seconda canonica del root: **840/840**, exit code0, zero fallimenti, skip, cancellazioni e todo. Eseguita da sola a concorrenza4,907,368secondi;HEAD invariato e albero pulito. I43artefatti di crash/negativi del commit e il log completo sono conservati. Tipi, formato, diff e privacy passano.

La prima canonica del root ha concluso839/840 con un HTTP500 in un test storico delle attivazioni Ombra. Lo stesso test passa isolato e in altre quattro esecuzioni parallele; la causa non è riprodotta né dichiarata corretta. Log/ricevute rimangono conservati. La seconda canonica usa diagnostica limitata agli host dei test, senza modificare richieste gameplay, casi, assert o tempi. Il validator resta identico per byte dopo l’aggiunta del solo messaggio diagnostico.

I27file di test preesistenti cambiano solo schema24→25 nelle aspettative. Il root aggiunge inoltre il messaggio del server all’asserzione del helper di followup quando riceve500, conservando la stessa attesa200.
Nessun caso, assert, deadline o soglia indebolito; dipendenze identiche.
La prima canonica del child aveva trovato due regressioni nei builder senza
owner: corrette, con intero validator e suite ripetuti; tentativi conservati.

Quantità57 ancora null/unverified e bloccanti per scelta del proprietario.
Nessuna nuova partita originale o ripresa156; originali soltanto statici.
Accettazioni89/33 e macro65 restano aperte. Queste prove inventate non
certificano avventura completa, campo completo o A2. Nessuna esecuzione Unity
né certificazione di parità numerica/JIT. Tutti i dati reali restano privati.
