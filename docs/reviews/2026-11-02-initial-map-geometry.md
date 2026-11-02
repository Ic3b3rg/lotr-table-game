# Revisione della geometria iniziale

Base `5a911ed`, revisione indipendente di `085d3dc`, issue #42 e
[specifica](../planning/initial-map-geometry-spec.md).
Due revisori freschi hanno controllato Standards e Spec separatamente.

## Standards

Nessuna violazione documentata. Vocabolario, ADR, isolamento del compilatore
e confine dei materiali privati sono rispettati. Un suggerimento facoltativo:
estrarre un iteratore comune per i contatti geometrici e i passaggi.
Rinviato: la costruzione del grafo considera anche bordi interni facoltativi,
mentre la validazione dell'aggancio considera solo contatti esterni obbligatori.
Non costituisce un blocco; l'eventuale helper sarà valutato nel generatore #41.

## Spec

Un difetto importante: il grafo aggiungeva soltanto collegamenti fra le due
tessere, omettendo caselle adiacenti della stessa tessera con bordi compatibili
e `links: []`. L'originale `CalculateConnectedSpaces` visita tutti gli esagoni
confinanti, saltando soltanto coppie della stessa casella.

Correzione verificata nella stessa sessione: nuova regressione CLI rossa,
poi scansione globale di tutti i vicini. Bordi interni assenti o bloccati non
aggiungono movimento, quelli standard sì; i collegamenti dichiarati restano.
Gli otto test CLI includono il caso, i sei output privati conservano le
impronte precedenti. Suite completa 91/91, tipi e formato verificati dopo la correzione.

Nessun altro rilievo Spec: compatibilità, rotazioni, contatti secondari,
candidati duplicati, forme e scrittura esclusiva corrispondono alle fonti.
La revisione non certifica RNG, mappa completa, esecuzione dello scenario
o parità con l'app originale; tali capacità restano esplicitamente fuori #42.

Decisione di implementazione: i controlli condivisi dei task 1/2 sono stati
realizzati nello stesso ciclo, con tutti i casi rossi già osservati, evitando
una composizione temporaneamente incompleta. Costo se la suddivisione fosse
necessaria: separare il commit del nucleo; nessun dato utente coinvolto.

Esito: Standards 0 violazioni / 1 suggerimento facoltativo rinviato;
Spec 1 difetto importante corretto con regressione rosso→verde.
