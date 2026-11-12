# Sprite della busta carta regalo

- **Modello**: `gpt-5.6-terra` (Codex CLI; il predefinito `gpt-5.5` non e' accettato dall'account ChatGPT)
- **Immagini di riferimento (`-i`)**: forestaDiAnna/img/studio-bg.png (riferimento di stile)
- **Risultato**: `img/gift.png`
- **Post-produzione**: sfondo verde/nero rimosso con riempimento dal bordo (key.py), ritaglio sul contorno, altezza 64 px, palette 48 colori, alpha binaria; salvato in `img/vases/<id>.png`
- **Comando**: `codex exec -m gpt-5.6-terra --skip-git-repo-check -i forestaDiAnna/img/studio-bg.png (riferimento di stile) - < prompt.txt` (il testo qui sotto va in `prompt.txt` e arriva da stdin; `-i` va prima del `-`)

## Prompt

```text
Use your image generation tool to create ONE image: a 16-bit pixel-art sprite of a gift-card envelope (cream envelope with a terracotta-red ribbon and a bow, slightly tilted card peeking out), same warm cozy pixel-art game style as the attached reference scene (hard pixel edges, limited palette, subtle dark outline). Single object, centered, with margin, no text, no shadow. Background must be one flat solid pure green (#00FF00). Reply only with the exact saved file path.
```
