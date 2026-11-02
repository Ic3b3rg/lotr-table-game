# Adiacenze di movimento e grafo del generatore

Follow-up di #48, 2 novembre 2026. Questo documento fissa il confine del
prossimo incremento; il movimento non è ancora un consumatore dell'assemblatore.

## Due dati con responsabilità diverse

`TileSpace.Reset` (`A0ea8`) svuota ConnectedSpaces. Il generatore originale
`CalculateConnectedSpaces` (`A1332`) lo ricostruisce dai vicini esagonali e
da due bordi espliciti accettati da `Edge.IsConnection`. `Tile.GetEdge`
(`A0e90`) restituisce null per un bordo non dichiarato. L'assemblatore #48
conserva questa semantica nel proprio `graph`, usato dal successivo algoritmo
di collocazione degli incontri. Non aggiungere archi a questo dato per
raggiungere tutte le caselle.

Per il gioco fisico, il regolamento definisce invece l'adiacenza tramite
il bordo grigio condiviso; vale per il movimento di eroi e nemici e per
«vicino» (stessa casella o casella adiacente). I bordi neri non sono
attraversabili, salvo gli abbinamenti indicati dalle frecce grigie.
[Rules Reference, §6–6.4](https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf).
Le eccezioni dei segnalini muro/corso d'acqua sulla mappa di battaglia
restano un livello successivo delle regole, fuori dal presente generatore.

I collegamenti intratessera authoring sono conservati come
`serializedConnectedSpaces` nel pacchetto geometrico. Sono indispensabili:
due esagoni di caselle diverse possono toccarsi senza che quella coppia
di caselle condivida un bordo attraversabile. La sola vicinanza cubica non
autorizza un collegamento di movimento. La verifica visiva della tessera
iniziale e i suoi riferimenti authoring confermano la distinzione.

Il prossimo adattatore deve produrre un `movementGraph` distinto, da
collegamenti intratessera authoring reciproci e contatti tra tessere
attraversabili/consentiti. Deve validare riferimenti e reciprocità senza
riparare dati incoerenti inventando l'arco inverso. Deve conservare
isolamenti/componenti e non consumare RNG o osservazioni del clock.
Eroi, nemici e abilità che richiedono adiacenza useranno questo contratto
quando verrà integrato nel runtime. Gli incontri continueranno a usare
il grafo fonte previsto dal loro algoritmo.

## Evidenza limitata

Nel caso privato H3/seed1 di #48, il grafo fonte ha componenti `[3,18,1]`.
Un calcolo separato in sola lettura, applicando il contratto sopra, produce
una componente di **22 caselle / 43 archi reciproci**. I collegamenti
authoring dei 45 prefab normalizzati sono reciproci, senza duplicati o
autoarchi. Evidenza privata:
`.scratch/assembly-root-review/movement-candidate-evidence.json`.

Questo controllo non è un'implementazione di movimento, una prova di
esecuzione Unity o un audit di tutti i possibili writer runtime originali.
Non certifica #41, l'avvio #38 o la partita completa #33. Il successivo
incremento deve verificare il contratto con fixture sintetiche e con
la matrice privata, mantenendo intatto il risultato del grafo fonte.
