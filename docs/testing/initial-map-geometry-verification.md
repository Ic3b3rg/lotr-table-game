# Geometria iniziale: verifica

Issue [#42](https://github.com/Ic3b3rg/lotr-table-game/issues/42), specifica
[initial-map-geometry-spec.md](../planning/initial-map-geometry-spec.md).

Il compilatore separato compone due forme validate con scelta esplicita,
conservando le ancore nell'ordine originale, anche quando danno la stessa
posa. Non cambia host, UI, schema 8, salvataggio o regole di viaggio.

## Prove pubbliche

`node --test tests/map-geometry.test.mjs`: sette prove attraverso il processo
CLI reale. Il primo esagono standard produce 36 ancore; sono verificati
ordine globale delle sei rotazioni, pose note, rive, ruscelli, strade,
passaggi aperti/chiusi, contatti secondari, sovrapposizione, contatto bloccato
senza movimento, attributi delle caselle e grafo reciproco. Input e scelte
non validi falliscono senza stdout. Due composizioni uguali producono lo
stesso JSON; un file già esistente resta invariato, anche dopo input invalido.
Tutte le forme delle fixture sono inventate.

Il primo ciclo rosso ha mostrato sei fallimenti per compilatore assente;
il caso che rifiuta input invalidi passava ancora senza il programma.
Dopo l'implementazione tutte le sette prove passano contro la CLI funzionante.
Il lettore usa un buffer limitato a 1 MB + 1 byte, anche se il file cambia
dopo il controllo iniziale. La pubblicazione avviene collegando in modo
esclusivo un file completo e sincronizzato nella stessa directory.

## Dati originali privati

JiME 1.6.6#1128, assembly SHA-256
`8869ef87b7d49f4993911904e35d78b72f8339e91158bbe8784c9691a9d743c6`.
L'estrazione custom100A legge 21 oggetti / 1.968 byte con lettori concordi,
consumo completo e puntatori verificati. La 302A riusa la topologia standard
già verificata; non viene sostituita dalla 100A standard, che ha forma diversa.

Pacchetto compilato SHA-256
`f730a191f6e52ccf89e4bbcd800ef8b08db0dca4a72470341678e17884804a6f`.
Script, inventario, pacchetto, liste, composizioni e impronte degli output
restano in `.scratch/map-composition-source/`.

| Rotazione iniziale | Candidati | Pose distinte | Contatti verificati | Caselle / esagoni |
| --- | ---: | ---: | ---: | ---: |
| 0 | 258 | 120 | 722 | 4 / 16 |
| 1 | 258 | 120 | 722 | 4 / 16 |
| 2 | 258 | 120 | 722 | 4 / 16 |
| 3 | 258 | 120 | 722 | 4 / 16 |
| 4 | 258 | 120 | 722 | 4 / 16 |
| 5 | 258 | 120 | 722 | 4 / 16 |

Un verificatore Python indipendente ricostruisce tutti i 1.548 candidati con
trasformazioni cubiche esplicite e conta i lati liberi dall'occupazione
globale. Verifica 4.332 contatti, somma zero, nessuna sovrapposizione e ancore
opposte. Per ogni rotazione compone una scelta esplicita e controlla tutti
gli attributi, l'origine iniziale e il grafo dai bordi effettivi: quattro
collegamenti reciproci e trenta lati liberi in ciascuna scelta.

Queste invarianti non attestano parità del generatore originale: RNG,
ordinamento/clump, pool, backtracking, altre sezioni e incontri restano in
#41; l'orchestrazione iniziale rimane in #38. L'app originale non è stata
avviata né sono stati letti o modificati salvataggi personali.
