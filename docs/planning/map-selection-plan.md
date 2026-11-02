# Piano di implementazione #46

Esecuzione continua autorizzata, nello stesso checkout, senza subagenti.
Specifica: [map-selection-spec.md](map-selection-spec.md).

1. **CLI e contratto.** Scrivere `tests/map-selection.test.mjs` con costruttori
   inventati e processi reali, vedere fallire la CLI assente. Implementare
   `src/map-selection/model.ts`, `main.ts` e IO condiviso con geometria solo per
   read bounded / write exclusive. Build CLI e libreria. Test input incompleti,
   referenze/indici, replay e overwrite; typecheck, test CLI geometria.
2. **Pool/preludio.** Test prima per filtri, capacità gruppo/per eroe, upgrade
   transitivi, null, retained pools, mixture fuori [0,1], singleton e conteggi.
   Implementare `pools.ts` con SourceRandom condiviso con `selection.ts`.
   Verificare normal/chain/item order e scaling H3 su 120 tessere/four builders.
3. **Selezione.** Test prima per starts-before-required, shadow/ownership/flags,
   matching multi-tratto e backtracking, prenotazioni/opposite/max/set, trait e
   minimum con rollback/trie, optional con float e fallimenti distinti.
   Implementare stato privato in `selection.ts`, helper trie/matching interni.
   Nessun draw dopo optional. Eseguire suite focalizzata e typecheck per slice.
4. **Originali privati ed evidenza.** Normalizzare read-only i pacchetti fonte
   nella scratch ignorata del checkout; mantenere indici, qualifiche e hash.
   Script privato di matrice H1..5, compagnie e seed documentati, con controlli
   indipendenti sulle proprietà e checkpoint. Scrivere report in docs/testing,
   mantenendo output selezioni privati. Eseguire i quattro gate finali e commit
   locale, consegnando SHA/path. Review indipendenti pending root.

Rischi coperti dai test: nessun fallback standard quando custom usato; phantom
rollback senza ritorno artificiale; conteggio una volta per eroe; fixed reference
esclusa solo da normal; criterio matching più forte dell'euristica; Count trie
dei nodi, cancellazione figli finali e reset tra le fasi; nessun partial success
quando il budget interrompe il lavoro. Piano verificato contro ogni criterio
della issue prima di iniziare codice.
