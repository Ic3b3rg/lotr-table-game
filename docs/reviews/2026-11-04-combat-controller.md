# Review #85 — attacco e provocazione

Diff ricevuto: `a58a0607de2c1c0a5514ebd6e2967495cd8bd895...88d29322d128601714af9085fd6fccfa637bbb4e`.
Due commit, 56 percorsi. Review Standards e Spec in contesti indipendenti,
senza modificare checkout o evidenze ricevuti. Autorità: issue85, spec/piano
locali, contratti75/77/81/83 e ADR1–3.

## Standards

**Un P2, corretto dal root.** La scelta del premio offriva tutti gli eroi vivi;
il contratto75 richiede l'attaccante oppure un eroe vicino. Aggiunto il filtro
di vicinanza. La regressione include attaccante, stessa casella e adiacenza;
esclude distante e sconfitto e respinge una scelta distante forgiata senza
mutare lo stato. Nessun altro difetto obbligatorio o smell sostanziato;
14 test puri mirati passano sul codice ricevuto.

Il calcolo dell'oscurità nel controller usa il flag della casella. Nel contesto
fonte83 non è stato dimostrato un percorso che richieda altri fattori: resta
un controllo esplicito prima delle future Ombre, senza elevarlo a difetto85.

## Spec

**Tre P2, corretti dal root.**

- Il premio poteva andare a un destinatario lontano, contro il requisito del
  destinatario legale. È lo stesso difetto rilevato dall'asse Standards.
- Il preflight richiedeva i benefici57 anche quando il contrattacco era
  impossibile: normale già esaurito oppure fuori portata. Ora applica la
  closure soltanto quando il contrattacco può eseguire. Range condiviso con
  il runtime; normale pronto ed elite esaurito conservano il gate. Popolazioni
  e selezione prima della distanza non sono state cambiate. Le finestre
  pre-counter implementate non possono cambiare queste precondizioni.
- La sconfitta del destinatario durante P2 cancellava anche il movimento
  ancora dovuto al gruppo nemico. Ora il movimento acquisito resta disponibile:
  il superstite sceglie, il gruppo si muove, l'eroe rimosso non riceve movimenti
  e la continuazione torna una sola volta. Le conseguenze rivolte soltanto
  al destinatario sconfitto restano distinte.

L'asse Spec ha verificato i tre casi con probe sintetici in memoria e 14 test
mirati. Nessuna nuova review per le correzioni circoscritte: il root ha
riprodotto ciascun RED e verificato tre regressioni GREEN.

## Verifica e limiti del root

Sigillo ricevuto verificato: 936 elementi, inclusa una symlink dichiarata,
731.405.469 byte; manifest SHA256
`3aa432e2dce11e5eaf8f5ab34dbfddf251886c3a1857b1816b43c94ddd297d2e`.
Copie di lavoro separate dalle evidenze; helper adattati prima dell'esecuzione.
Artefatto e metadati del pack ricompilati identici byte per byte.

La matrice fonte conferma quattro modelli, 48 istruzioni, 13 bonus,
12 popolazioni/130 elementi, 258 riprese, 213 insiemi, 13.694 pacchetti,
20 aggiunte e 45 clausole su 33 definizioni. Sono confronti sui dati fonte,
non nuove partite o certificazioni della sequenza RNG originale.

Il percorso UI ricevuto usa tre identità reali e un freeze autentico importato
prima dello startup. Ha completato una provocazione con ritorno al movimento
e un attacco con carte, conversione, slot, difese, contrattacco, negazione e
conseguenza reale. I due gruppi sono stati estratti naturalmente; uno con
dipendenza57 è rimasto bloccato. Nessun seed, pool o backup manipolato per
forzare l'accettazione. Un attacco con due colpi assorbiti dalle difese non
dimostra la sconfitta del gruppo: premio, P2, concessione e movimento aggiuntivo
hanno prove sintetiche dichiarate, incluse le regressioni del root.

Riconvalidati **61 backup UI e 180 storici** con il verifier corrente: sette
coppie SIGKILL, sette restore e dieci alterazioni risignate respinte. Le 12 viste
ricevute coprono spesa, negazione e ritorno a quattro larghezze. Ispezionate
direttamente tre catture. Client e CSS eseguibili identici; soltanto commenti
esbuild di percorso differenti. Nessuna nuova corsa browser o host del root.
QA limitata a Chrome headless sullo stesso Mac via HTTP IPv4 senza WebCrypto.

Vecchi pack e ricevute conservano i propri gate. La vera Ombra, il seguito25,
le acquisizioni57 non verificate, conclusione e campo/A2 restano fuori.
Il tavolo protetto non è stato consultato. Log, copie e metadati del root
sono privati in `.scratch/combat-ui-root-review/`.

Verifica finale sul codice corretto: **621/621 test**, zero fail/skip/todo,
232.607 ms; typecheck, formato e diff check verdi. La suite è stata ripetuta
dopo le correzioni funzionali; i log dei passaggi precedenti restano separati.
Privacy controllata anche nei due commit ricevuti: 56 percorsi, 61 snapshot
di blob, 85 stringhe private lunghe e controllo aggiuntivo di 195 identificatori
fonte, nessuna corrispondenza. Nessun originale introdotto nella storia Git.

Standards: **1 P2 risolto, 0 aperti**. Spec: **3 P2 risolti, 0 aperti**.
