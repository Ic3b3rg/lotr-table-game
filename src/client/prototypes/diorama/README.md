# Diorama 2.5D — prototipo da provare

La direzione è stata scelta dal proprietario il 23 ottobre 2026. La domanda della prova è: **guidare il personaggio, preparare un'abilità e vedere il combattimento sul terreno dà il coinvolgimento desiderato?**

È una scena autonoma con stato in memoria: un eroe, quattro zone, una sentinella e tre abilità dimostrative. Non legge o modifica il database del tavolo; non sincronizza più dispositivi. Ricaricando la pagina si ricomincia. Nomi, valori e abilità della scena sono esempi per studiare l'interfaccia, non il catalogo ufficiale.

## Avvio

Dopo la preparazione del repository descritta nel README principale:

```sh
npm run prototype
```

Aprire [il diorama](http://127.0.0.1:4320/prototype/diorama). Il comando usa le dipendenze già installate e le risorse locali: non effettua download. `LOTR_PROTOTYPE_PORT` cambia la porta. Il processo resta separato dall'host della sessione sulla porta 4317; Ctrl+C chiude soltanto la prova.

## Giro rapido

1. Toccare **Tiro mirato**, leggere l'effetto e premere **Usa Tiro mirato**.
2. Selezionare **Il sentiero** sul terreno e confermare; selezionare poi **Il ponte** e confermare. Il viaggio usa un'azione per due movimenti.
3. Premere **Attacca**, poi **Conferma attacco**. L'eroe tende l'arco, la freccia raggiunge il bersaglio e la sentinella reagisce.
4. Aprire **All'accampamento** e acquisire **Difesa salda** con l'esperienza della prova.

Per vedere un combattimento su più turni, usare **Guardia** al posto di Tiro mirato: il primo attacco lascia la sentinella in gioco. Avviare la **fase Ombra**, poi attaccare nel turno successivo. Provare anche Passo rapido e Interagisci dal ponte.

Il ritratto e il personaggio aprono la scheda dell'eroe. La cronaca conserva gli esiti della prova. Il terreno si trascina; i comandi della visuale permettono zoom e ritorno all'eroe. L'audio contiene brevi segnali sintetici, è spento inizialmente e si attiva con un gesto. Movimento ridotto rispetta la preferenza del sistema ed è modificabile.

## Risorse e confine della prova

Ambiente, ritratto e atlanti delle pose sono risorse generate per questo prototipo. `assets/direction-comp.png` conserva la proposta scelta ed è anche la sorgente delle piccole illustrazioni delle carte; i controlli e i testi dell'applicazione sono HTML. I prompt sono incorporati nei PNG; il riferimento scelto ha anche il proprio file di approvazione. Il carattere Cormorant Garamond è distribuito localmente con la licenza `assets/OFL.txt`.

Il codice della prova viene conservato sul ramo `prototype/diorama-25d`, come fonte per la successiva implementazione. Non va promosso direttamente a motore completo delle regole. Mappa reale, contenuti italiani, mazzi, multiplayer e salvataggio della partita richiedono i rispettivi moduli di prodotto.

## Riscontro del proprietario

Il 23 ottobre 2026 il proprietario ha riferito di aver completato una battaglia e apprezzato la prova. Il punto da correggere riguarda personaggio e nemici troppo grandi rispetto al terreno. La rifinitura li riduce di circa un terzo, con una scala comune legata alla profondità e aggiornata durante la camminata; anche la freccia e i testi degli esiti seguono la nuova altezza. Le proporzioni della scena rimangono dimostrative e non attestano la fedeltà al gioco originale.

## Verifiche

TypeScript e formattazione controllati. Prova in Chrome su Mac con viewport 1440×900 e 390×844, quest'ultimo con tocco e movimento ridotto emulati: viaggio, Tiro mirato, attacco, vittoria, crescita, Guardia e fase Ombra. Bersagli delle zone da 44 CSS pixel anche quando la mappa è ridotta; nessun overflow orizzontale nel formato telefono verificato. Nessun errore o avviso console durante i flussi controllati.

La prova con telefoni fisici, Safari e Windows rimane da svolgere. Non sono state introdotte nuove suite di test per il prototipo; la suite della sessione reale viene mantenuta separata.
