# Sprite sheet di Anna (camminata)

- **Modello**: `gpt-5.6-terra` (Codex CLI; il predefinito `gpt-5.5` non e' accettato dall'account ChatGPT)
- **Immagini di riferimento (`-i`)**: foto di Anna 5, 7, 9 (non nel repository)
- **Risultato**: `img/anna-walk.png` (4 fotogrammi verso destra)
- **Post-produzione**: fondo crema reso trasparente, 4 fotogrammi ricentrati in celle uguali, palette a 128 colori
- **Comando**: `codex exec -m gpt-5.6-terra --skip-git-repo-check -i foto di Anna 5, 7, 9 (non nel repository) - < prompt.txt` (il testo qui sotto va in `prompt.txt` e arriva da stdin; `-i` va prima del `-`)

## Prompt

```text
The attached photos show Anna, a ceramist. Use your image generation tool to create ONE image: a 16-bit pixel-art walking sprite sheet of a pixel-art character inspired by her (long straight light-brown hair with soft fringe, fair skin, light eyes, slim; wearing a terracotta-red ceramist apron over a cream shirt and light trousers, clay smudges), 4 walking frames facing right in a row, evenly spaced, each frame the same size and baseline, plain flat uniform cream background (#F3E6D3), warm terracotta/cream palette. Stylized pixel art, not a realistic portrait. Reply only with the exact saved file path.
```
