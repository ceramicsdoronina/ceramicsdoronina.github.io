# Sfondo del salotto/showroom

- **Modello**: `gpt-5.6-terra` (Codex CLI; il predefinito `gpt-5.5` non e' accettato dall'account ChatGPT)
- **Immagini di riferimento (`-i`)**: forestaDiAnna/img/studio-bg.png (riferimento di stile)
- **Risultato**: `img/showroom-bg.png`
- **Post-produzione**: quantizzato a 128 colori (Pillow); le posizioni degli oggetti sono in `scene.js`
- **Comando**: `codex exec -m gpt-5.6-terra --skip-git-repo-check -i forestaDiAnna/img/studio-bg.png (riferimento di stile) - < prompt.txt` (il testo qui sotto va in `prompt.txt` e arriva da stdin; `-i` va prima del `-`)

## Prompt

```text
The attached reference image is the left part of a pixel-art game level (a ceramic studio). Use your image generation tool to create ONE new image: the NEXT room of the same level, in exactly the same 16-bit pixel-art style, palette (cream plaster wall, wooden beams on top, terracotta tile floor), pixel size and perspective, wide aspect ratio about 3:1 (same size as the reference). It is a cozy Italian living-room showroom: from left to right a plush sofa with cushions, a small round wooden coffee table next to it, an armchair, a long wooden console/sideboard with an EMPTY clear top, a small dining table with two wooden chairs, a wooden stool and a floor plant, plus a wall window with a curtain and a framed picture. ALL furniture surfaces, sofa seats and chairs must be completely EMPTY (no vases, no objects, no cups). The terracotta floor must start at exactly the same height as in the reference (about 84% down the image) and the wall left edge should blend with a plain cream wall. Furniture stands on the floor line. No characters, no text. Reply only with the exact saved file path.
```
