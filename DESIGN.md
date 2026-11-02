# Direzione visiva — Diorama 2.5D

Scelta del proprietario, 23 ottobre 2026. Si applica al tavolo di gioco e al prototipo in `src/client/prototypes/diorama/`; la lobby tecnica esistente non viene ridisegnata da questa decisione.

La mappa è un ambiente dipinto a strati; l'eroe è una figura separata che si muove e reagisce. Carta preparata, destinazione selezionata, azione confermata ed esito sono momenti distinti e leggibili. La priorità è sentire il controllo del proprio eroe sul terreno.

## Materiali e gerarchia

- Ambiente: bosco dipinto, pietra consumata, acqua e profondità atmosferica. Le zone restano distinguibili, anche quando il dettaglio decorativo è ricco.
- Tavolo: occupa il centro della schermata. Obiettivo e fase rimangono visibili; ritratto, carte e comandi accompagnano il bordo inferiore.
- Colori: fondi `#101c20` e `#19282b`; testo avorio `#f3ead6`; secondario `#c4bcaa`; ottone `#ba985a`; destinazione attiva `#edc77a`; esito ostile `#ce7f65`.
- Titoli: Cormorant Garamond, distribuito localmente con licenza OFL. Testi e controlli: carattere di sistema leggibile. Corpo di lettura 14–16 px; comandi utilizzabili con tocco.
- Pannelli: superfici scure opache, bordi sottili e gerarchia compatta. Il paesaggio dà l'atmosfera; i controlli restano comprensibili.

## Movimento e interazione

Selezione e anteprima precedono la conferma. Il personaggio ha pose separate per camminata, attacco e reazione; gli effetti seguono l'esito, senza calcolarlo. La camera si può spostare e centrare. Movimento ridotto e audio disattivabile sono disponibili. Su telefono la mappa resta esplorabile e i comandi si dispongono sotto di essa.

## Riscontro sulla scala

Il 23 ottobre 2026 il proprietario ha completato una battaglia e apprezzato la prova; ha indicato come sproporzionati personaggio e nemici rispetto al terreno. La rifinitura riduce le figure di circa un terzo e usa la stessa profondità del suolo per entrambe, con variazione continua durante il movimento. Nomi e comandi conservano la leggibilità e un'area di tocco minima da 44 CSS pixel. La scala è una scelta visiva del diorama, non una proporzione certificata dell'originale.

## Direzione confermata dopo la prova

Il 23 ottobre 2026 il proprietario ha confermato di apprezzare questa impostazione dopo aver chiarito che le quattro zone della demo non rappresentano la dimensione delle avventure originali. Il diorama 2.5D resta il riferimento visivo per il gioco completo. Estensione, collegamenti e rivelazione delle mappe devono seguire gli scenari originali; le mappe di viaggio si ampliano dove previsto dall'avventura. La conferma risolve la domanda di coinvolgimento del prototipo, senza attestare una nuova prova della scala su dispositivi fisici.

## Limite del prototipo

La scena e le abilità della prova sono dichiaratamente dimostrative, con stato soltanto in memoria. La prova non stabilisce valori, carte o eccezioni alle regole del catalogo definitivo. Il salvataggio della sessione reale non viene letto o modificato.
