# Review della ricerca sulle quantità dei benefici — #118

Confronto fissato: main `01221fd08040ce91f48e90079ef9ce4539e81f78` e
consegna `282e65f7024d9d88bbacb3ecbe8cd8ee4c2dc054`. Due review indipendenti,
con contesti separati, sul solo
[rapporto](../research/boon-copy-quantity-evidence.md) richiesto da
[#118](https://github.com/Ic3b3rg/lotr-table-game/issues/118).

## Standards

Zero finding: P0/P1/P2/P3 tutti zero. Conclusioni limitate alle acquisizioni,
distinzione fra campionamento e filmato integrale, nessuna quantità adottata.
Nessun testo di carta, immagine, IL o JSON normalizzato nel nuovo Git;
due link interni validi, otto righe byte/hash coerenti col manifest e
rapporto identico alla copia sigillata. La baseline Fowler non è pertinente
al documento. Nessun controllo live degli URL o esame audio/video integrale
attribuito alla review Standards.

## Spec

Missing 0, partial 0, wrong 0, scope 0; nessun difetto sostanziato. Il mandato
ammette un limite esplicito con candidati non conclusivi. Verificati i
metadati dei quattro video contro gli HTML originali e il collegamento
sito FFG → canale → video. Foto e storyboard pertinenti sostengono le
osservazioni circoscritte; non attestano un insieme completo conteggiabile.
Ricevute, query/scarti, regioni fotografiche e mapping consentono la
riproduzione statica. Il riscontro indipendente resta necessario prima
di adottare il conteggio di una sola scatola.

I limiti restano reali: audio/video integrali non esaminati, tirature non
identificate, foto incomplete, BGG inaccessibile e alcune schede lette
soltanto nella rappresentazione del motore web. Nessuno di questi limiti
viene trasformato in prova dell'assenza di informazioni nella fonte.

## Verifica del root e decisione

Manifest ricevuto: 55.594 byte, SHA256
`f9cf26371840e48dd2bf821182015a3862679354fd27e02360e8753b13d5bc7c`.
Tutte le 314 righe, per 67.192.218 byte, sono verificate prima della lettura e
ricopiate privatamente con identità dei byte; percorsi relativi senza
traversal e file ordinari senza symlink. Rapporto: 12.477 byte, SHA256
`e340f19c04726251ffb6e5ac2d97202203f283af7793d77703df823c29960695`.
Le tre fotografie F1/F2/P1-04 sono viste direttamente negli originali.

Un nuovo accesso del root alla pagina originale V1 conferma titolo,
canale FFG, durata di 4067 secondi e player accessibile. I sei formati elencati
non espongono URL diretti; la traccia inglese restituisce HTTP200 con
zero byte. HTML, metadati e ricevuta sono conservati privatamente.
La lettura web della stessa pagina fallisce: non è una prova sul contenuto.
Non vengono tentate autenticazioni o elusioni; l'audio/video completo
rimane una pista aperta, senza attribuirgli un conteggio o la sua assenza.

La consegna soddisfa la ricerca #118 con esito negativo circoscritto.
Non soddisfa la verifica quantitativa #57: Determinato, Infervorato e
Nascosto restano `null/unverified`, secondo la decisione del proprietario.
Nessuna riserva provvisoria, modifica ai pack o al gioco, nuova partita
originale o ripresa di 156. #57/#89/#33/#65 rimangono aperte.

Controllati diff, link locali, confine pubblico/privato e identità del
rapporto. Nessuna suite, build o host avviato per questa modifica
documentale; sorgenti, test, dipendenze e formati del gioco sono invariati.
Le prove indipendenti e quelle ricevute sono conservate separatamente
nella scratch ignorata del root.
