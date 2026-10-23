# Pianificazione del gioco base digitale

La [mappa wayfinder su GitHub](https://github.com/Ic3b3rg/lotr-table-game/issues/1) è il riferimento del percorso e delle decisioni. Le sue sub-issue e dipendenze native indicano quali domande sono lavorabili.

La [richiesta dei materiali](https://github.com/Ic3b3rg/lotr-table-game/issues/2) descrive la prima consegna e come verranno richiesti i contenuti mancanti dopo l’inventario.

Perimetro confermato: [decisione di prodotto](../adr/0001-gioco-digitale-completo-in-rete-locale.md). Vocabolario: [glossario](../../GLOSSARY.md). Fonti reperite: [inventario delle fonti ufficiali](../research/official-source-inventory.md).

Riferimento concordato: [app, regole, errata e traduzioni italiane delle carte](fidelity-baseline.md). Il proprietario ha scelto la traduzione fedele dall’Excel con verifica degli effetti; i testi originali e quelli tradotti conservano la propria provenienza.

Carte: [inventario del workbook fornito dall'utente](../research/card-workbook-inventory.md) e [audit dell'archivio immagini](../research/card-archives-audit.md). Host offline: [confronto delle opzioni](../research/offline-host-options.md).

Questa fase chiarisce materiali, fedeltà e funzionamento della sessione. Il primo traguardo tecnico può procedere senza attendere tutti i contenuti: [specifica della sessione locale](offline-session-spec.md) e [quattro ticket approvati](offline-session-tickets.md). Suddivisione, dipendenze e prove sono approvate; lo stato dei task resta su GitHub.

L'implementazione della sessione è disponibile con [evidenze automatiche e nei browser](../testing/offline-session-verification.md) e [revisione indipendente](../reviews/2026-10-23-offline-session.md). La prova fisica su Mac, Windows e telefoni senza Internet rimane nel [ticket LAN](https://github.com/Ic3b3rg/lotr-table-game/issues/5).
