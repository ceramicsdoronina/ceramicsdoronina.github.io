# forestaDiAnna

Pagina nascosta (non linkata, `noindex`): Anna cammina nello studio di ceramica e i vasi in vendita sono quadretti pixelati sulle mensole.
Indirizzo: `/forestaDiAnna/`. Usa gli stessi moduli, dati (foglio live, ODS di riserva) e carrello (`cd_stripe_cart_v1`) del sito; il pagamento resta nel sito principale.

- `game.js`: scena in `CFG` (mensole, dimensioni); le mensole dello sfondo sono a x 0.72–0.99; se i vasi superano i posti, la striscia `img/studio-shelf.png` si ripete a destra.
- Foto dei vasi: pixelate nel browser (`pixelate()`), l'originale si vede con "Vedi foto originale".
- Vista elenco = alternativa senza movimento (accessibile da tastiera).

## Immagini (Codex CLI, modello `gpt-5.6-terra`; `gpt-5.5` del config non e' accettato dall'account ChatGPT)
```
codex exec -m gpt-5.6-terra --skip-git-repo-check -i foto1.png -i foto2.png - < prompt.txt
```
(`-i` va prima del `-` e il prompt arriva da stdin; l'immagine finisce in `~/.codex/generated_images/…`.)

Prompt personaggio (con foto di Anna come riferimento): sprite sheet 16-bit, 4 fotogrammi di camminata verso destra, capelli lunghi castano chiaro con frangia, grembiule terracotta su camicia crema, fondo crema uniforme (#F3E6D3).
Prompt sfondo: scena laterale larga 3:1 di uno studio di ceramica italiano (porta, tornio, tavolo, finestra, forno, tre mensole VUOTE a destra, pavimento di cotto), palette terracotta/crema/legno, nessun personaggio, nessun testo.
Post-produzione: fondo del personaggio reso trasparente e celle ricentrate (Pillow), immagini quantizzate a 128 colori.
