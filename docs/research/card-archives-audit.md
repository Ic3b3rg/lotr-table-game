# Audit JiME Cards DB: inventario e limiti

Consultazione: 23 ottobre 2026. Navigazione e markup verificati; controllo visivo limitato a Gimli e alle prime cavalcature. Obiettivo del progetto: scatola base e campagna iniziale completamente digitali, personali/offline, con UI adattiva PC/telefono. Le carte costituiscono contenuto essenziale.

## Verificato nell'archivio

La [home JiME Cards DB](https://sites.google.com/view/jime-carddb/home/) dichiara l'assenza di affiliazione/approvazione FFG. La struttura effettivamente accessibile è:

| Sezione | Contenuto osservato, senza certificazione di completezza |
| --- | --- |
| [Heroes](https://sites.google.com/view/jime-carddb/home/heroes) | 17 collegamenti a eroi; campioni [Gimli](https://sites.google.com/view/jime-carddb/home/heroes/gimli) e [Beorn](https://sites.google.com/view/jime-carddb/home/heroes/beorn). |
| [Roles](https://sites.google.com/view/jime-carddb/home/roles) | 18 ruoli; [Captain](https://sites.google.com/view/jime-carddb/home/roles/captain) presenta 12 riferimenti immagine. |
| [Items](https://sites.google.com/view/jime-carddb/home/items) | [Armors](https://sites.google.com/view/jime-carddb/home/items/armors), [Hands](https://sites.google.com/view/jime-carddb/home/items/hands), [Trinkets](https://sites.google.com/view/jime-carddb/home/items/trinkets), [Mounts](https://sites.google.com/view/jime-carddb/home/items/mounts). |
| [Common Cards](https://sites.google.com/view/jime-carddb/home/common-cards) | [Basic](https://sites.google.com/view/jime-carddb/home/common-cards/basic), [Titles](https://sites.google.com/view/jime-carddb/home/common-cards/titles), [Weaknesses](https://sites.google.com/view/jime-carddb/home/common-cards/weaknesses): rispettivamente 6, 33, 20 riferimenti immagine. |
| [Terrain](https://sites.google.com/view/jime-carddb/home/terrain) | 20 riferimenti immagine. |
| [Damage](https://sites.google.com/view/jime-carddb/home/damage) | 18 riferimenti immagine e indicazione «11x». |
| [Fear](https://sites.google.com/view/jime-carddb/home/fear) | 18 riferimenti immagine e indicazione «11x». |
| [Boons and Banes](https://sites.google.com/view/jime-carddb/home/conditions) | Pagina intitolata Conditions: sezioni Boons, Banes, Captured Escapes. |

[Hands](https://sites.google.com/view/jime-carddb/home/items/hands) comprende sezioni interne Axes, Blades, Blunt Weapons, Staves and Spears, Ranged Weapons e Support; non sono ulteriori pagine autonome.

Gli indici non separano esplicitamente prodotti/ristampe. Il perimetro supera la base: le cavalcature osservate appartengono a una tipologia inclusa in [Venti di Guerra](https://www.asmodee.it/product/il-signore-degli-anelli-viaggi-nella-terra-di-mezzo-venti-di-guerra/), assente nell'inventario base. Nessuna carta esplicitamente contrassegnata fan/custom osservata; ciò non dimostra che tutto l'archivio contenga soltanto carte ufficiali.

## Immagini, lingua e identificazione

Il campione [Gimli](https://sites.google.com/view/jime-carddb/home/heroes/gimli) mostra fronte/retro dell'eroe e cinque immagini abilità: sette immagini non equivalgono a sette carte fisiche. Sono leggibili gli identificativi stampati **Gimli 1–4**; **Gimli 2** e **Gimli 3** condividono il nome. Il nome da solo non identifica quindi una carta. Nessun catalogo strutturato degli ID è emerso dal markup campionato.

Carte Gimli e prime [Mounts](https://sites.google.com/view/jime-carddb/home/items/mounts) osservate sono **inglesi**. Messaggi Google Sites possono apparire italiani: non attestano carte italiane. Nessun selettore IT o campione di carta IT trovato nelle pagine esaminate; disponibilità italiana dell'intero archivio **ignota**.

Le carte campionate sono immagini raster incorporate, con `alt` vuoto, non trascrizioni nel testo della pagina. Il DOM espone `src` Google Sites nel formato `https://sites.google.com/sitesv-images-rt/<riferimento-opaco>=w1280`; [Beorn](https://sites.google.com/view/jime-carddb/home/heroes/beorn) espone anche collegamenti immagini `lh3.googleusercontent.com`. I riferimenti osservati variano fra sessioni: non costituiscono ID editoriali né un'API documentata. Provenienza verificata: pagina ospitante e immagini con marchi FFG; autore della digitalizzazione, edizione e cronologia delle correzioni restano ignoti. Non verificata l'affermazione «screenshot di tutte le carte».

## Verifica necessaria delle 343 carte base

L'[inventario ufficiale Asmodee](https://www.asmodee.it/product/il-signore-degli-anelli-viaggi-nella-terra-di-mezzo/) elenca: **6 eroe + 83 oggetto + 15 beneficio + 28 danno + 28 paura + 10 terreno + 30 abilità base + 30 abilità eroe + 72 abilità ruolo + 20 debolezza + 21 titolo = 343 carte fisiche**. È una somma dei quantitativi ufficiali, non un conteggio delle voci del DB.

Restano necessari:

1. Fissare edizione/ristampa e applicare le [FAQ italiane 2.0](https://cdn.svc.asmodee.net/production-asmodeeit/uploads/2022/09/jme_faq_ita.pdf), usando le [Carte Corrette ufficiali](https://cdn.svc.asmodee.net/production-asmodeeit/uploads/2022/09/JME_Carte_Aggiornate.pdf) collegate da Asmodee; verificare il recepimento carta per carta.
2. Costruire un registro di soli metadati: prodotto, categoria, ID stampato, lingua, faccia, rango/livello, molteplicità, revisione, URL e data di verifica. Separare stesso nome, ID distinti, copie identiche e fronte/retro.
3. Riconciliare ciascun subtotale con le copie fisiche, filtrando espansioni e provenienze incerte: per esempio sei abilità Base numerate contro trenta copie complessive ([Manuale, pp. 3–5](https://cdn.svc.asmodee.net/production-asmodeeit/uploads/2022/09/Viaggi_nella_Terra_di_Mezzo.pdf#page=3)).
4. Validare contenuti ufficiali italiani completi, leggibilità su telefono e disponibilità locale/offline. **Inferenza:** l'archivio aiuta l'inventario, ma il campione non soddisfa questi requisiti; nessun grafo della campagna osservato.

La [scheda BGG segnalata](https://boardgamegeek.com/filepage/203251/character-equipment-and-skill-cards-spreadsheet) non è stata investigata qui; nel campione non emerge un collegamento dal DB. Versione 1.10, aggiornamento 2025-11-24 e presenza di carte custom rimangono **non verificati** in questo audit.

Verifica successiva e distinta: i metadati BGG sono stati controllati nel [registro della fonte](card-source-download.md); l'utente ha poi fornito l'XLSX, analizzato nell'[inventario del workbook](card-workbook-inventory.md). Questi risultati non certificano la copertura delle immagini dell'archivio Google Sites.
