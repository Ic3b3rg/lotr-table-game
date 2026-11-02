# Piano di implementazione #48

1. Leggere issue/contratti/IL e normalizzare privatamente gli input fisici mancanti.
   Scrivere questa specifica e piano prima di implementare. Conservare audit/hash.
2. Test CLI RED per validation/identità/frame e prima mappa sintetica con più
   tessere in quattro sezioni. Implementare schema/catalogo e composizione pose
   con predicati condivisi solo dove #42 conserva il comportamento.
3. TDD layout intra-section: scelta/RNG, boundary, enumerazione e ranking,
   trie/rollback globale, eccezione lista vuota e stati diagnostici.
4. TDD inter-section: due sort, sphere, contatti, required/forbidden, ranking,
   residui/rollback e clock record/replay/budget. Verificare continuamente tipi
   e test focalizzati, correggendo contro IL quando emergono divergenze.
5. TDD graph/reset e output completo al checkpoint pre-incontri. Verificare
   source check separato da componenti e nessuna traversal inventata.
6. Eseguire CLI privata su H3 e matrice H/seed; checker indipendente, preservando
   successi e fallimenti. Documentare comandi, digest, politica numerica e limiti.
7. Suite completa, typecheck, format:check, diff --check. Commit finale pulito,
   consegna SHA/percorsi/evidenza al root; nessuna scrittura GitHub.

Nessun subagente, checkout aggiuntivo, installazione, app Unity, save personale
oppure accesso alla sessione root congelata. Tutti gli artefatti privati stanno
nella `.scratch/assembly/` ignorata di questo checkout.

Completato: nucleo/CLI, 40 nuovi test processuali e di libreria, 47 attempt
originali complete con checker separato, replay H3 e arresti espliciti.
Verifiche finali: 108/108 focalizzati, 191/191 completi, typecheck, formato e
diff. Evidenza e limiti in `docs/testing/map-assembly-verification.md`.
Review indipendenti Standards/Spec e integrazione restano al root.
