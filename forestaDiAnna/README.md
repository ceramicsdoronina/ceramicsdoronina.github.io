# forestaDiAnna

Pagina nascosta (non linkata, `noindex`): Anna cammina nello studio di ceramica e i vasi in vendita sono quadretti pixelati sulle mensole.
Indirizzo: `/forestaDiAnna/`. Usa gli stessi moduli, dati (foglio live, ODS di riserva) e carrello (`cd_stripe_cart_v1`) del sito; il pagamento resta nel sito principale.

- Scena: due sfondi affiancati, studio (`img/studio-bg.png`) e salotto (`img/showroom-bg.png`). `scene.js` contiene le posizioni (frazioni dell'immagine) di ogni oggetto sulle superfici: mensole, divano, tavolini, poltrona, sedie, sgabello (vasi) e credenza (carte regalo).
- Vasi: sprite pixel art `img/vases/<id>.png` (altezza proporzionale ai cm del foglio). Se manca lo sprite di un id (vaso nuovo nel foglio), compare un quadretto con la foto pixelata nello slot libero successivo. Carte regalo: busta `img/gift.png` con l'importo.
- Clic su un oggetto: popup con le FOTO VERE (frecce, miniature, tastiera, swipe), prezzo, "Aggiungi al carrello" (stesso carrello del sito) e link al sito principale (`../#catalogue` o `../#giftcards`).
- Vista elenco = alternativa senza movimento (accessibile da tastiera).

## Immagini
Tutti i prompt usati con Codex sono in `prompts/` (un file `<Nome>.prompt.md` per vaso, piu' Anna, studio, salotto e busta regalo), con modello, immagini di riferimento, comando e post-produzione.

## Comando (Codex CLI, modello `gpt-5.6-terra`; `gpt-5.5` del config non e' accettato dall'account ChatGPT)
```
codex exec -m gpt-5.6-terra --skip-git-repo-check -i foto1.png -i foto2.png - < prompt.txt
```
(`-i` va prima del `-` e il prompt arriva da stdin; l'immagine finisce in `~/.codex/generated_images/…`.)

Prompt personaggio (con foto di Anna come riferimento): sprite sheet 16-bit, 4 fotogrammi di camminata verso destra, capelli lunghi castano chiaro con frangia, grembiule terracotta su camicia crema, fondo crema uniforme (#F3E6D3).
Prompt sfondo: scena laterale larga 3:1 di uno studio di ceramica italiano (porta, tornio, tavolo, finestra, forno, tre mensole VUOTE a destra, pavimento di cotto), palette terracotta/crema/legno, nessun personaggio, nessun testo.
Post-produzione: fondo del personaggio reso trasparente e celle ricentrate (Pillow), immagini quantizzate a 128 colori.
