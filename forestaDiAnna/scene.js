// forestaDiAnna/scene.js - posizioni degli oggetti in vendita sulle superfici delle scene.
// bg = scena ("start" = ingresso con gli attrezzi, "room" = salotto, "studio" = forno e mensola principale);
// (la scena "start" e' tagliata all'80% dell'immagine generata: x gia' riferiti all'immagine tagliata)
// x, y = frazioni della larghezza/altezza di QUELL'immagine; y e' la linea della superficie su cui l'oggetto poggia.
// I vasi occupano VASE_SLOTS nell'ordine del foglio, le carte regalo CARD_SLOTS in ordine di importo.
// Ordine pensato per far trovare subito i vasi: ingresso (sgabello, poltrona, tavolini, sedie), salotto, mensola; gli avanzi dopo.
window.__ANNA_SCENE = {
  VASE_SLOTS: [
    { bg: "start", x: 0.307, y: 0.734 },    // sgabello del tornio
    { bg: "start", x: 0.645, y: 0.733 },    // poltrona
    { bg: "start", x: 0.736, y: 0.734 },    // tavolino rotondo
    { bg: "start", x: 0.800, y: 0.748 },    // sedia sinistra
    { bg: "start", x: 0.870, y: 0.696 },    // tavolo
    { bg: "room", x: 0.085, y: 0.74 },      // divano, cuscino sinistro
    { bg: "room", x: 0.345, y: 0.745 },     // poltrona del salotto
    { bg: "room", x: 0.715, y: 0.618 },     // tavolo del salotto
    { bg: "studio", x: 0.50, y: 0.235 }, { bg: "studio", x: 0.70, y: 0.235 }, { bg: "studio", x: 0.87, y: 0.235 },   // mensola principale
    // avanzi (vasi nuovi nel foglio)
    { bg: "start", x: 0.938, y: 0.748 },    // sedia destra
    { bg: "room", x: 0.165, y: 0.74 }, { bg: "room", x: 0.2575, y: 0.697 }, { bg: "room", x: 0.77, y: 0.618 },
    { bg: "room", x: 0.665, y: 0.718 }, { bg: "room", x: 0.815, y: 0.71 }, { bg: "room", x: 0.889, y: 0.697 },
    { bg: "studio", x: 0.61, y: 0.400 }, { bg: "studio", x: 0.83, y: 0.400 }
  ],
  CARD_SLOTS: [   // credenza del salotto, da sinistra a destra (importo crescente)
    { bg: "room", x: 0.44, y: 0.613 }, { bg: "room", x: 0.495, y: 0.613 }, { bg: "room", x: 0.55, y: 0.613 }, { bg: "room", x: 0.605, y: 0.613 }
  ]
};
