# Pianificazione del gioco base digitale

La [mappa wayfinder su GitHub](https://github.com/Ic3b3rg/lotr-table-game/issues/1) è il riferimento del percorso e delle decisioni. Le sue sub-issue e dipendenze native indicano quali domande sono lavorabili.

La [richiesta dei materiali](https://github.com/Ic3b3rg/lotr-table-game/issues/2) descrive la prima consegna e come verranno richiesti i contenuti mancanti dopo l’inventario.

Perimetro confermato: [decisione di prodotto](../adr/0001-gioco-digitale-completo-in-rete-locale.md). Vocabolario: [glossario](../../GLOSSARY.md). Fonti reperite: [inventario delle fonti ufficiali](../research/official-source-inventory.md).

Riferimento concordato: [app, regole, errata e traduzioni italiane delle carte](fidelity-baseline.md). Il proprietario ha scelto la traduzione fedele dall’Excel con verifica degli effetti; i testi originali e quelli tradotti conservano la propria provenienza.

Carte: [inventario del workbook fornito dall'utente](../research/card-workbook-inventory.md) e [audit dell'archivio immagini](../research/card-archives-audit.md). Host offline: [confronto delle opzioni](../research/offline-host-options.md).

Questa fase chiarisce materiali, fedeltà e funzionamento della sessione. Il primo traguardo tecnico può procedere senza attendere tutti i contenuti: [specifica della sessione locale](offline-session-spec.md) e [quattro ticket approvati](offline-session-tickets.md). Suddivisione, dipendenze e prove sono approvate; lo stato dei task resta su GitHub.

L'implementazione della sessione è disponibile con [evidenze automatiche e nei browser](../testing/offline-session-verification.md) e [revisione indipendente](../reviews/2026-10-23-offline-session.md). La prova fisica su Mac, Windows e telefoni senza Internet rimane nel [ticket LAN](https://github.com/Ic3b3rg/lotr-table-game/issues/5).

Il proprietario ha approvato i [criteri di fedeltà e il primo incremento di preparazione](game-fidelity-checks.md): eroi, ruoli, equipaggiamento e mazzi reali persistenti, poi prove, movimento, combattimento e scenari.

Incremento autorizzato: [preparazione della compagnia](party-preparation-spec.md), con [piano di implementazione](party-preparation-plan.md). Il primo risultato verificabile comprende catalogo privato consultabile, scelte della compagnia e mazzi definitivi recuperabili.

La [PR 24 della preparazione](https://github.com/Ic3b3rg/lotr-table-game/pull/24) e la [PR 13 della fondazione](https://github.com/Ic3b3rg/lotr-table-game/pull/13) sono integrate in `main` (`e3f3255`), verificato il 2 novembre 2026. Evidenze: [preparazione](../testing/party-preparation-verification.md), [metadati del catalogo privato](../testing/party-content-metadata.json) e [revisione indipendente](../reviews/2026-10-25-party-preparation.md). La specifica #20 e i task #21–23 sono quindi consegnati.

Le [prove abilità e ispirazione #25](https://github.com/Ic3b3rg/lotr-table-game/issues/25) sono integrate in `main` (`666e1c6`) con PR #26: [contratto](skill-tests-spec.md), [piano](skill-tests-plan.md) e [verifiche](../testing/skill-tests-verification.md).

Integrata in `main` (`b3088ba`) con PR #28: [Scoperta e carte preparate #27](https://github.com/Ic3b3rg/lotr-table-game/issues/27), [contratto e piano](scouting-spec.md), [verifiche](../testing/scouting-verification.md). Si preparano e riordinano le carte, con limite, ricomposizione e ripresa; le capacità delle carte rimangono nel motore successivo.

Per completare il gioco restano: capacità e finestre degli effetti, risoluzione automatica dell’Ombra, composizione e rivelazione delle mappe, combattimento e nemici, prima avventura fino al campo e passaggio alla seconda, poi tutti i percorsi della campagna base. Restano anche riconciliazione completa delle 343 copie, contenuti italiani e confronto runtime degli scenari. La prova fisica LAN #5 procede separatamente con i dispositivi del proprietario. Non è ancora possibile attribuire una percentuale affidabile di completamento alla campagna.

Integrato in `main` (`1687ecc`) con PR #30, incremento #29: [turni, azioni e fasi persistenti](rounds-spec.md), con
[verifiche](../testing/rounds-verification.md). Ordine concordato, turni da zero
a due azioni, interazione con prova, tre conferme manuali dell’Ombra e
Riorganizzazione collettiva. Mappa congelata e viaggio interrompibile sono descritti nell’incremento #31.

Incremento #31: [mappa e viaggio persistenti](travel-spec.md), con
[provenienza della topologia](../research/journey-map-topology.md) e
[verifiche](../testing/travel-verification.md). Il tratto reale 302A non
certifica una mappa completa o una campagna giocabile. Le prossime capacità
sono composizione/rivelazione delle mappe, combattimento e nemici, poi
collegamento agli eventi della prima avventura.
