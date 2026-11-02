# Scoperta di Riorganizzazione e bonus di Aragorn

Issue #35, base `main` `c869d96`, dopo il merge dell'avvio guidato #36.
Incremento di fedeltà della partita a tre #33; nessun completamento implicito
dell'avventura o delle altre capacità.

## Regola e fonti

Scoperta di Riorganizzazione è 2, con una carta aggiuntiva ad Aragorn e agli
eroi vicini quando Aragorn è nella compagnia. La capacità è quella dell'eroe
canonico `base-hero-aragorn`, non un testo da interpretare o il nome tradotto.
La sua applicazione non consuma azioni o ispirazione e non rimescola di nuovo
i mazzi già ricomposti insieme.

Fonti fornite: manuale italiano, pagina stampata 11 (scheda Aragorn) e 14
(Vicino), Compendio inglese §61.1–61.2. Vicino significa stessa casella o
casella adiacente; l'eroe riceve il proprio bonus per la parola «tu», non
perché sarebbe vicino a sé stesso. Si usa il grafo salvato, non le coordinate
visive. [Manuale ufficiale](https://cdn.svc.asmodee.net/production-asmodeeit/uploads/2022/09/Viaggi_nella_Terra_di_Mezzo.pdf),
[Compendio ufficiale](https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf).

## Contratto dell'incremento

- In Riorganizzazione, Aragorn rivela 3; altro eroe nella stessa casella o
  adiacente 3, lontano 2. Senza Aragorn, tutti 2. La Scoperta libera o lo
  strumento indipendente «Ricomponi e scopri 2» non ricevono questo bonus.
- Quantità decisa dall'host, nessun campo count del client può alterarla.
  Con posizioni note non si può sostituire il grafo con una dichiarazione.
  La Scoperta pendente conserva identità, conteggio e carte salvate.
- **Compatibilità precedente:** se c'è Aragorn ma mancano le posizioni,
  il bonus proprio resta noto. Per un altro eroe la UI chiede al gruppo di
  indicare esplicitamente «vicino» oppure «non vicino» sul proprio tavolo;
  nessun valore predefinito. L'host rifiuta l'omissione. Questa dichiarazione
  è ammessa soltanto senza posizioni registrate. È una scelta di compatibilità
  dell'implementatore per i vecchi strumenti indipendenti, non una nuova regola.
  Il nuovo avvio guidato impone già la mappa prima dei round.
- UI mostra 2 di base e il bonus applicabile prima della pesca, poi il
  conteggio effettivo salvato. Round e guida non promettono più due carte
  identiche per tutti. Ordinamento, preparazione e limite di quattro restano.
- Schema **8**, migrazione 1–7 senza ricomporre, ripescare o cambiare stato,
  gruppo e ricevute. Una Scoperta 2 già aperta rimane 2 fino alla conclusione;
  il bonus si applica alle nuove Scoperte. Conteggi 3 importati devono essere
  compatibili con Aragorn e le posizioni disponibili. Una Scoperta 2 precedente
  è ammessa anche dove oggi il bonus darebbe 3. I vecchi host non leggono lo
  schema 8: per rollback serve la copia precedente.

## Piano e verifiche

1. TDD sul confine HTTP esistente: tre proprietari, stessa/adiacente/lontana
   casella, eroe visivamente vicino ma non adiacente, bonus proprio,
   indipendenza dalle altre capacità e dai nomi, nessun costo/ricomposizione.
2. Dichiarazione legacy richiesta e limitata, reinvii e proprietà; schema 7
   con Scoperta 2 aperta, SIGKILL, backup/recupero con tre carte e invarianti.
3. UI e guida, poi ripresa dei tre profili della prova precedente: completare
   round 2 e verificare tre carte ciascuno nella Riorganizzazione con Aragorn
   adiacente; spostarlo lontano e verificare il conteggio successivo.
4. Suite, tipi, formato, revisioni e PR. Merge, chiusura #35, poi prossimo
   blocco della prima avventura. Nessun dato privato nei commit.
