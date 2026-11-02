# Revisione della sessione offline — 23 ottobre 2026

Revisione prevista da [code-review](/Users/silvioceccarini/.agents/skills/code-review/SKILL.md), con due agenti indipendenti sugli assi standard e specifica. Base `26ce56d`, primo head `63f54bf`, correzione `7959789`. Nessuna prova fisica sostituita dalla revisione statica.

## Standards

Nessuna violazione certa degli standard documentati nel diff `26ce56d…63f54bf`, limitatamente al primo traguardo tecnico. Due rilievi facoltativi:

- **P3 — possibile Duplicated Code, transazioni.** In [store.ts:63](https://github.com/Ic3b3rg/lotr-table-game/blob/63f54bfb6519ee0e4d064de33b03d0ee530cfee5/src/server/store.ts#L63) e [store.ts:156](https://github.com/Ic3b3rg/lotr-table-game/blob/63f54bfb6519ee0e4d064de33b03d0ee530cfee5/src/server/store.ts#L156), come in `backup` e `restore`, ricorrono `this.db.exec('COMMIT');` e `if (this.db.isTransaction) this.db.exec('ROLLBACK');`. Un helper transazionale privato potrebbe centralizzare questa gestione, mantenendo esplicita la distinzione fra `BEGIN` e `BEGIN IMMEDIATE`. Ridurrebbe i punti da aggiornare quando cambia la gestione degli errori.

- **P3 — possibile Duplicated Code, messaggi d’errore.** [personal.ts:12](https://github.com/Ic3b3rg/lotr-table-game/blob/63f54bfb6519ee0e4d064de33b03d0ee530cfee5/src/client/personal.ts#L12), [backups.ts:10](https://github.com/Ic3b3rg/lotr-table-game/blob/63f54bfb6519ee0e4d064de33b03d0ee530cfee5/src/client/backups.ts#L10) e [demo.ts:24](https://github.com/Ic3b3rg/lotr-table-game/blob/63f54bfb6519ee0e4d064de33b03d0ee530cfee5/src/client/demo.ts#L24) ripetono il ramo `cause instanceof RequestError`, l’assegnazione di `cause.message` e `error.hidden = false;`. Si potrebbe estrarre una funzione comune che riceva nodo, errore e testo alternativo, conservando i messaggi specifici delle operazioni.

Entrambi sono giudizi di manutenibilità, senza un difetto funzionale dimostrato. Revisione statica in sola lettura; nessuna nuova esecuzione dei test o verifica fisica Windows/telefoni.

Risposta: le due estrazioni restano facoltative. Le transazioni mantengono visibili i modi di apertura e i punti di commit; i tre messaggi alternativi descrivono operazioni differenti. Per questo traguardo non si aggiungono astrazioni esclusivamente per eliminare questi rami brevi. Nessuna soglia o verifica è stata ridotta.

## Spec

Due rilievi sul confronto `26ce56d…63f54bf`:

- **(c) P2 — Indirizzi pubblicati incompatibili con il bind.** La specifica richiede: «Il QR contiene un indirizzo LAN raggiungibile dai telefoni, con alternativa testuale» ([spec:51](https://github.com/Ic3b3rg/lotr-table-game/blob/63f54bfb6519ee0e4d064de33b03d0ee530cfee5/docs/planning/offline-session-spec.md#L51)). [network.ts:8](https://github.com/Ic3b3rg/lotr-table-game/blob/63f54bfb6519ee0e4d064de33b03d0ee530cfee5/src/server/network.ts#L8) pubblica tutte le interfacce IPv4, mentre [main.ts:167](https://github.com/Ic3b3rg/lotr-table-game/blob/63f54bfb6519ee0e4d064de33b03d0ee530cfee5/src/server/main.ts#L167) ascolta soltanto su `LOTR_BIND`. Impostando un singolo IP LAN, restano selezionabili QR verso altre interfacce sulle quali l’host non ascolta; inoltre viene annunciato comunque `127.0.0.1`, anch’esso irraggiungibile in questa configurazione. Filtrare gli indirizzi secondo il bind e annunciare un URL effettivamente servito.

- **(a) P2 — Versione del modello persistito mancante.** La specifica dice: «Il modello di sessione e il formato di esportazione devono poter dichiarare la propria versione» ([spec:56](https://github.com/Ic3b3rg/lotr-table-game/blob/63f54bfb6519ee0e4d064de33b03d0ee530cfee5/docs/planning/offline-session-spec.md#L56)). [protocol.ts:35](https://github.com/Ic3b3rg/lotr-table-game/blob/63f54bfb6519ee0e4d064de33b03d0ee530cfee5/src/shared/protocol.ts#L35) e lo stato iniziale in [store.ts:36](https://github.com/Ic3b3rg/lotr-table-game/blob/63f54bfb6519ee0e4d064de33b03d0ee530cfee5/src/server/store.ts#L36) non includono una versione dello schema. `revision` identifica le modifiche e `generation` i ripristini; nessuna identifica il formato persistito. Aggiungere una versione esplicita, verificata durante la lettura.

**(b)** Nessuno scope creep sostanziale rilevato. La dimostrazione rimane distinta dal futuro motore delle regole.

Revisione in sola lettura. Le prove fisiche Windows/iOS/Android e cinque dispositivi senza WAN restano pendenti nel ticket #5, come previsto nei [ticket approvati:16](https://github.com/Ic3b3rg/lotr-table-game/blob/63f54bfb6519ee0e4d064de33b03d0ee530cfee5/docs/planning/offline-session-tickets.md#L16).

### Correzione e verifica indipendente

**Entrambi i P2 risultano risolti** nel diff `63f54bf…7959789`.

- **Indirizzi pubblicati:** [network.ts:11](https://github.com/Ic3b3rg/lotr-table-game/blob/79597897f6c7dc3c76efed1b68462784be1e87fb/src/server/network.ts#L11) filtra gli indirizzi secondo il bind; whitelist HTTP e URL `HOST_READY` seguono la stessa configurazione. Il loopback non produce QR LAN e mostra una spiegazione. Soddisfatto il requisito «Il QR contiene un indirizzo LAN raggiungibile dai telefoni» ([spec:51](https://github.com/Ic3b3rg/lotr-table-game/blob/79597897f6c7dc3c76efed1b68462784be1e87fb/docs/planning/offline-session-spec.md#L51)).

- **Versione persistita:** `schemaVersion: 1` è obbligatoria nello schema, verificata in lettura e inclusa nell’esportazione. La [migrazione:58](https://github.com/Ic3b3rg/lotr-table-game/blob/79597897f6c7dc3c76efed1b68462784be1e87fb/src/server/store.ts#L58) valida e aggiorna atomicamente gli stati senza versione, preservando identità, revisione, generazione e ricevute; versioni esplicite sconosciute impediscono l’avvio senza sostituire il tavolo. Soddisfatto «Il modello di sessione e il formato di esportazione devono poter dichiarare la propria versione» ([spec:56](https://github.com/Ic3b3rg/lotr-table-game/blob/79597897f6c7dc3c76efed1b68462784be1e87fb/docs/planning/offline-session-spec.md#L56)).

Nel follow-up **non rilevo nuove regressioni sostanziali, requisiti mancanti o scope creep** rispetto al perimetro approvato e agli ADR0001/0002. L’accesso ai backup dal PC tramite l’IP LAN mantiene disponibile il ripristino su host vuoto.

Le prove fisiche restano pendenti come previsto dalla [spec:74](https://github.com/Ic3b3rg/lotr-table-game/blob/79597897f6c7dc3c76efed1b68462784be1e87fb/docs/planning/offline-session-spec.md#L74); carte, regole e campagna restano successive ([spec:78](https://github.com/Ic3b3rg/lotr-table-game/blob/79597897f6c7dc3c76efed1b68462784be1e87fb/docs/planning/offline-session-spec.md#L78)).

Revisione statica del solo asse SPEC; test e build non rieseguiti.

Standard: 0 violazioni certe e 2 osservazioni P3 facoltative sulla duplicazione; specifica: 2 P2 corretti e verificati, nessun rilievo sostanziale residuo nel follow-up.
