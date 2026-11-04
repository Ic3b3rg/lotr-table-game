# Ripresa dell’accettazione UI degli indizi — #89

Base esatta `a96b0711bb8ea82355fac306029b5f11039e59e8`, schema16.
Contratto: [issue89](https://github.com/Ic3b3rg/lotr-table-game/issues/89),
[spec](clue-progression-spec.md), [piano](clue-progression-plan.md), ADR2–3.
Il codice di PR90 e la conclusione di PR92 sono già integrati. Questa
specifica riguarda soltanto il criterio originale UI ancora mancante.

## Risultato e invarianti

Un solo nuovo avvio con tre proprietari autentici, mediante import nativo
del freeze ante-startup. Il pack completo91 viene ricompilato dalla base
corrente, confrontato e congelato prima dell’avvio. Nessun cambiamento di
programmi, seed, entropia, pool, risultati o ricevute durante l’episodio.
I checkpoint precedenti89 e91 restano prove distinte e immutate.

Minimo: un incontro-indizio completo con evento al principale, contatore,
obiettivo e rivelazioni conseguenti. Proseguire verso tre indizi e covo se
il percorso autentico lo permette, fermandosi al primo confine sostanziale
non implementato. Il gate finale del covo precede ogni costo. Il minimo
non raggiunto va dichiarato, con causa fonte precisa, senza reroll o fixture
presentate come accettazione. Questa prova non soddisfa il tavolo nuovo33.

Le mosse dipendono soltanto dalla UI e dai dati già rivelati: privilegiare
obiettivo e frontiera visibile, impiegare ruoli, ispirazione, prevenzioni e
Rest/Guard/Scout quando concessi; risolvere carte e provocazioni legalmente.
Nessuna conoscenza di carte future guida le scelte.57 resta bloccata fino
a quantità verificate; soglie40/48/55 mantengono il gate prima della fase.

## Piano e verifiche

1. Copiare soltanto input puntuali sigillati, verificando byte/hash; leggere
   gli helper e adattarli in una scratch propria. Ricompilare pack e validatore.
2. Preparare host/DB/profilo e tre BrowserContext propri. Dichiarare il piano
   di mosse prima dello startup; importare e giocare con DOM/Input/filepicker.
3. Tentare subito il percorso dell’obiettivo. Se emerge un difetto entro89,
   riprodurlo RED→GREEN nel vero consumer, senza nuovi motori o esenzioni.
4. Ai confini raggiunti di costo/prova/esito/evento/rivelazione/ritorno,
   SIGKILL e ripresa packless con confronto integrale di gameplay e ricevute,
   origine round1/Azione invariata. Restore solo dell’esatto export corrente,
   verificato dalla ricevuta; negativi risignati realmente confermati, stale,
   retry e concorrenza senza duplicati. UI, guida, lettore, focus/Tab/Escape e
   320/768/1024/1440 sugli stati raggiunti, catture dentro il viewport.
5. Build/validatore e controlli appropriati. Solo se cambia il prodotto:
   typecheck/formato incrementali, una suite completa finale dopo gli ultimi
   cambi; se toccati validator/replay, compatibilità351 e59 nativi91 completa.
   Rapporto pubblico, README privato con output/comandi/input/byte/hash e
   sigillo; commit locali puliti e chiusura dei soli processi propri.

Esecuzione personale nel checkout assegnato, senza altri agenti/checkout,
installazioni, push/PR o scritture GitHub. Root possiede review Standards/Spec
e integrazione. Originali e identità restano nella scratch ignorata anche
nella storia.33/65/57 rimangono aperte; nessuna vittoria, partita completa o A2.
