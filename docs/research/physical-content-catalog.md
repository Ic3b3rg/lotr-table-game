# Catalogo fisico base: implementazione e verifica #57

3 novembre 2026, base `b9c0f465e79f6002d3ea8773ba5207000d4df921`. [Issue #57](https://github.com/Ic3b3rg/lotr-table-game/issues/57), [specifica](../planning/physical-content-spec.md), [piano](../planning/physical-content-plan.md).

**Modulo, API e CLI implementati; catalogo complessivo ancora diagnostico per le sole quantità dei benefici.** Sono disponibili tutte le 60 definizioni, con testo e annotazioni confrontati. Danni, paure e titoli sono esportati come tre cataloghi privati verificati e consumabili. Le tre quantità beneficio rimangono `null`, senza copie inventate. #57 non va dichiarata integralmente completata finché manca questo dato; #33 e il gioco completo restano fuori da questo incremento.

## Risultato e copertura

| Famiglia | Definizioni presenti | Copie attestate | Copie fisiche attese | Stato |
| --- | ---: | ---: | ---: | --- |
| Danni | 18 | 28 | 28 | Verificata e consumabile |
| Paure | 18 | 28 | 28 | Verificata e consumabile |
| Benefici | 3 | Non allocate per identità | 15 | Contenuto verificato; quantità irrisolte |
| Titoli | 21 | 21 | 21 | Verificata e consumabile |

Le 77 copie materializzate appartengono alle tre famiglie complete; non sono un nuovo totale fisico della scatola. Il totale atteso delle quattro famiglie è 92. Le definizioni mantengono identità, ordine sorgente e copie con ID/ordinale distinti; i numeri stampati sono presenti solo nei titoli, senza inventarne per danni/paure/benefici. Sono 1.020 fatti verificabili: 1.017 verificati e tre quantità irrisolte.

## Fonti e riconciliazione

La [baseline approvata](../planning/fidelity-baseline.md) autorizza la traduzione fedele con controllo degli effetti. Workbook V1.10 originale, 610.648 byte, SHA-256 `833edd0f9235d559253c6c0d43e61bcc0b5d955103bb2001e37a2e3ddef88ca4`: lettura mirata di `DamageFear!2:37`, `BoonsBanes!2:4`, `Skill Cards!332:352`. Nessuna modifica all'originale o al suo percorso.

Riletti **42 oggetti**: S2319, 21 TitleModel e 20 SkillModel pertinenti. Consumo esatto, accordo C/Python e puntatori verificati tramite gli helper esistenti. Non è una scansione dell'app. Tutti i 21 nomi titolo provengono dalle chiavi Main_it riconciliate. Il riferimento applicativo rimane JiME **1.6.6#1128**, Steam **24301165**, assembly SHA-256 `8869ef87b7d49f4993911904e35d78b72f8339e91158bbe8784c9691a9d743c6`.

Confrontati visivamente tutti i 60 fronti inglesi pertinenti, conservati privatamente con pagina ospitante, ordinale e hash: [danni](https://sites.google.com/view/jime-carddb/home/damage), [paure](https://sites.google.com/view/jime-carddb/home/fear), [benefici](https://sites.google.com/view/jime-carddb/home/conditions), primi 21 [titoli](https://sites.google.com/view/jime-carddb/home/common-cards/titles). Sono immagini originali ospitate da un mirror comunitario; ristampa e storia editoriale rimangono ignote. Le espansioni e i contenuti Custom non entrano nel pack.

Il [Manuale IT, pp.3–4](https://cdn.svc.asmodee.net/production-asmodeeit/uploads/2022/09/Viaggi_nella_Terra_di_Mezzo.pdf) e il [Rules Reference](https://images-cdn.fantasyflightgames.com/filer_public/01/a0/01a0c9f7-4427-4113-9406-f53d6bde2ff5/journeys_in_middle-earth_rules_reference.pdf), §§15,22,43,45,77,85,89,105,108, danno quantità aggregate, facce comuni, acquisizione e disponibilità. Una [fotografia originale di componenti](https://www.ebay.com/itm/406144652803) riscontra il retro comune dei benefici; non è una copia del fronte né una nuova capacità. Metadati e immagini rimangono privati.

**Quantità danni/paure:** W.C3/W.C20 e le etichette degli archivi attestano 11 copie delle rispettive identità. I 17 altri fronti distinti base richiedono almeno 17 copie; il totale ufficiale 28 lascia esattamente 17 copie. Pertanto ciascuna delle altre identità ha una sola copia: deduzione vincolata da premesse indipendenti, registrata per identità, senza margine o conflitto normalizzato. **Titoli:** W.B332:B352 riporta esplicitamente una copia ciascuno; numeri stampati e 21 TitleModel confermano le identità.

**Dato indispensabile ancora mancante:** la ripartizione per identità delle 15 copie beneficio. W non ha una colonna quantità per queste tre righe. Manuale e R §15 danno totale/tipi/regole, senza ripartizione. La ricerca mirata in fonti FFG/Asmodee, archivio originario e fotografie di componenti non ha fornito una prova di 5/5/5. La simmetria non viene usata come prova. È stata posta al proprietario una sola domanda concreta sui tre conteggi; il pack mantiene lo stato irrisolto fino alla risposta o a nuova evidenza primaria.

## Italiano, effetti e titoli

Testi: **54 traduzioni di lavoro** e **6 trascrizioni IT da fonti ufficiali**, con normalizzazione dichiarata di spazi e icone rese tramite nomi leggibili. Nomi: 33 traduzioni di lavoro, 6 da fonti IT ufficiali, 21 localizzazioni app. Non si attestano 60 fronti editoriali italiani. Originale inglese, riferimento alla cella, confronto e stato rimangono per ogni testo; lingua/edizione delle prove sono nelle fonti referenziate. Le stringhe descrittive dei fatti ereditano la lingua italiana del pack.

Per tutte le voci sono controllati **numeri, simboli, costi, bersagli, condizioni, tempi, durata e operazioni**. Le annotazioni separano queste dimensioni e citano i fronti, W, il confronto privato e le regole pertinenti. Si conservano le distinzioni tra girare/subire/scartare, prevenire/negare, scartare/consumare/spendere, collocare/muovere e rimuovere dall'avventura. Le operazioni sono descrizioni: il modulo non le esegue.

Le [FAQ IT 2.0](https://cdn.svc.asmodee.net/production-asmodeeit/uploads/2022/09/jme_faq_ita.pdf) e le [carte corrette, foglio2](https://cdn.svc.asmodee.net/production-asmodeeit/uploads/2022/09/JME_Carte_Aggiornate.pdf) sono registrate esplicitamente: Titolo21 usa il testo IT corretto; il contenuto W principale e il fronte EN includono già il possessore. La colonna derivata AF352 divergente non sostituisce K352. Le annotazioni di Protezione/Scatto conservano le correzioni applicabili, con originali e disposizione dell'erratum.

I titoli **10/13/21** mantengono le acquisizioni verificate nella [ricerca #55](first-adventure-realized-runtime-contract.md), oltre alle capacità della carta: destinatario e unicità nel ramo pertinente, difficoltà effettiva dell'ultimo sforzo, assenza di altri eroi attivi e possibilità che due condizioni si verifichino insieme. Preparazione immediata salvo diversa istruzione, capacità solo preparata, proprietà per la campagna e rimozione limitata all'avventura sono dati del catalogo. Nessuna di queste regole è un nuovo executor.

**Titolo17:** identità, contenuto e copia presenti; il binding SkillModel rimane esplicitamente `absent-in-checked-base`. I 21 TitleModel, i 20 SkillModel, le 21 carte e le copie sono unità distinte. L'anomalia non viene riparata con un riferimento inventato.

## Contratto software

Nuovo modulo isolato `src/physical-content/`:

- `inspectPhysicalContent(unknown)`: schema strict, limiti e invarianti; risultato profondamente congelato e distinto dall'input. `verified` espone `catalog`; `diagnostic` espone copertura/motivi e non contiene un catalogo completo.
- `requirePhysicalCatalog(unknown)`: rifiuta un diagnostico.
- `requirePhysicalFamily(unknown, family)`: esporta solo una famiglia interamente verificata, con profilo distinto `base-physical-family-v1`; consente l'uso delle tre famiglie complete senza certificare il pack complessivo.

Input `formatVersion:1`, `profile:base-physical-v1`, lingua IT. Fonti/locator, stati, originali, lingue, correzioni bidirezionali, alias, ID, ordine, quantità/copie e binding sono validati. Prove mancanti o incompatibili non diventano fatti verificati. Un risultato/certificato non è accettato come nuovo input. I locator non vengono aperti o scaricati dal modulo; la fedeltà alle fonti è il confronto privato separato, non una firma editoriale derivata dai flag del chiamante.

Limiti: **8 MiB** CLI, 100 definizioni, 200 copie complessive, 128 fonti, 128 errata, 16.384 caratteri per stringa, profondità24 e 100.000 nodi; sotto-strutture bounded. Rifiutati anche cicli, accessor, proprietà extra degli array e campi non enumerabili, senza eseguire getter. Nessuna trasformazione silenziosa di testo o ordine.

CLI reale via `map-io`, UTF-8 rigoroso, SHA-256 dei byte input, output atomico esclusivo 0600. Exit **0** verificato, **2** diagnostico, **1** errore. Input intatto; output esistente, alias hardlink/symlink e scrittori concorrenti non sovrascrivono dati. Opzione `--family` per gli export indipendenti.

## Verifica e riproduzione

Specifica/piano committati prima del codice (`4747613`); successiva estensione dell'export per famiglia specificata prima dell'implementazione (`98202a7`). Slice TDD RED→GREEN per libreria, invarianti, CLI e affinamenti guidati dalle fonti. Fixture pubbliche interamente inventate, processo CLI e filesystem reali.

- **356/356 test** (`275` baseline + `81` nuovi), nessuno saltato; `npm run typecheck`, `npm run format:check`, `git diff --check` passano.
- Confronto privato indipendente per **60/60 voci**, con lettura OOXML distinta dal builder, numeri/simboli, frasi e casi di ambito/costo/durata. Otto dimensioni meccaniche per voce; 60 fronti controllati.
- **13/13 alterazioni di fedeltà respinte**, incluse quantità beneficio inventate, costo rimosso, numero/simbolo/bersaglio/condizione/durata/operazione alterati, copia/binding/front errati e omissione della correzione sul possessore.
- Mutazione reale di un controllo di completezza nella libreria intercettata dal test pubblico; sorgente ripristinato byte per byte e test nuovamente verde.
- Rilettura sorgenti/modelli e ricostruzione in directory distinta riproducono i dati byte per byte. **25 hash delle fonti originali/helper invariati**; **80 sorgenti del pack** risolte ai rispettivi file/hash. Input CLI preservato e tre export reali verificati; export beneficio rifiutato senza output.

Artefatti privati sotto `.scratch/physical-content/`: `delivery/pack.input.json`, `delivery/manifest.json`, `delivery/validated.json`, tre `*.catalog.json`, confronto indipendente, helper, traduzioni, ricevute, immagini e ZIP. README privato e manifest riportano percorsi originali, comandi completi, stato per identità/famiglia e hash. In Git rimangono solo codice generico, fixture inventate e questa documentazione tecnica.

| Artefatto privato | SHA-256 |
| --- | --- |
| Input normalizzato, 780.002 byte | `3d06fbbf8f767b3e5e78e859c7187986041ed77d7af173917c4c72f2126b0c52` |
| Manifest di consegna | `c5cc950c7ec0d405b1eafa7738bc57ce5964b0341cdc733b255dc5e2aaaf08da` |
| ZIP `physical-content-base-v1.zip`, 7.037.034 byte | `ce52bb40b3efbebe09399fc55668501849ad3cfed45ccb6bef1a541ea1a5ca73` |
| Export danni | `c689951d614c48049d34fa0754193605e47733b73e228484f997ce4464333ab5` |
| Export paure | `b6b473e21294e6f912c6a514d96079790ddc8a10665c3f953b4a79ddec6dbcf9` |
| Export titoli | `343a83dafb5c8d93900bab0f8a246528d94813a8ed2f005eb04e473f0d5f2360` |

```sh
npm run build
node --test tests/physical-content*.test.mjs
npm test
npm run typecheck
npm run format:check
git diff --check

# File output nuovi: il pack complessivo produce exit 2 finché manca il dato.
node dist/physical-content.mjs --input .scratch/physical-content/delivery/pack.input.json --output .scratch/physical-content/review-diagnostic.json
node dist/physical-content.mjs --input .scratch/physical-content/delivery/pack.input.json --output .scratch/physical-content/review-damage.json --family damage
node dist/physical-content.mjs --input .scratch/physical-content/delivery/pack.input.json --output .scratch/physical-content/review-fear.json --family fear
node dist/physical-content.mjs --input .scratch/physical-content/delivery/pack.input.json --output .scratch/physical-content/review-title.json --family title
```

Nessuna modifica a host/sessione/protocollo/UI, schema condiviso, map-generation/assembly/encounters o freeze; sole due entry build aggiunte. Nessuna dipendenza installata, app/salvataggio originale modificato, prova sul tavolo utente o scrittura GitHub. Review Standards/Spec e integrazione spettano al root; questo report non le anticipa.
