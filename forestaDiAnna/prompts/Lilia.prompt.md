# Sprite del vaso "Lilia" (v3)

- **Modello**: `gpt-5.6-terra` (Codex CLI; il predefinito `gpt-5.5` non e' accettato dall'account ChatGPT)
- **Immagini di riferimento (`-i`)**: images/catalogue/Lilia.1.jpg
- **Risultato**: `img/vases/v3.png` (sprite pixel art del vaso v3)
- **Post-produzione**: sfondo verde/nero rimosso con riempimento dal bordo (key.py), ritaglio sul contorno, altezza 64 px, palette 48 colori, alpha binaria; salvato in `img/vases/<id>.png`
- **Comando**: `codex exec -m gpt-5.6-terra --skip-git-repo-check -i images/catalogue/Lilia.1.jpg - < prompt.txt` (il testo qui sotto va in `prompt.txt` e arriva da stdin; `-i` va prima del `-`)

## Prompt

```text
The attached photo shows a handmade ceramic vase ("Lilia"). Use your image generation tool to create ONE image: a 16-bit pixel-art sprite of THIS exact vase, faithfully keeping its shape, proportions, colours, glaze and texture, drawn in the same warm cozy pixel-art game style (hard pixel edges, limited palette, subtle dark outline). Just the single vase, centered, full object visible with margin, standing upright, no hands, no table, no shadow, no text. Background must be one flat solid pure green (#00FF00) with nothing else. Reply only with the exact saved file path.
```
