// forestaDiAnna/scene.js - posizioni degli oggetti in vendita sulle superfici degli sfondi.
// x, y = frazioni della larghezza/altezza dell'immagine di sfondo ("studio" = studio-bg.png, "room" = showroom-bg.png);
// y e' la linea della superficie su cui l'oggetto poggia (mensola, ripiano, seduta...).
// I vasi occupano VASE_SLOTS nell'ordine del foglio, le carte regalo CARD_SLOTS in ordine di importo.
// Ordine pensato per distribuire i vasi: prima mensola dello studio, poi i mobili del salotto, poi gli avanzi.
window.__ANNA_SCENE = {
  VASE_SLOTS: [
    { bg: "studio", x: 0.77, y: 0.235 }, { bg: "studio", x: 0.86, y: 0.235 }, { bg: "studio", x: 0.94, y: 0.235 },   // mensola principale
    { bg: "room", x: 0.085, y: 0.74 },     // divano, cuscino sinistro
    { bg: "room", x: 0.2575, y: 0.697 },   // tavolino rotondo
    { bg: "room", x: 0.345, y: 0.745 },    // poltrona
    { bg: "room", x: 0.715, y: 0.618 },    // tavolo, sinistra
    { bg: "room", x: 0.665, y: 0.718 },    // sedia sinistra
    { bg: "room", x: 0.889, y: 0.697 },    // sgabello
    { bg: "room", x: 0.165, y: 0.74 },     // divano, cuscino destro
    { bg: "room", x: 0.815, y: 0.71 },     // sedia destra
    { bg: "room", x: 0.77, y: 0.618 },     // tavolo, destra
    { bg: "studio", x: 0.82, y: 0.400 }, { bg: "studio", x: 0.92, y: 0.400 }                                         // avanzi: seconda mensola
  ],
  CARD_SLOTS: [   // credenza, da sinistra a destra (importo crescente)
    { bg: "room", x: 0.44, y: 0.613 }, { bg: "room", x: 0.495, y: 0.613 }, { bg: "room", x: 0.55, y: 0.613 }, { bg: "room", x: 0.605, y: 0.613 }
  ]
};
