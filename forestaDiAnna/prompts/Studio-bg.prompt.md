# Sfondo dello studio di ceramica

- **Modello**: `gpt-5.6-terra` (Codex CLI; il predefinito `gpt-5.5` non e' accettato dall'account ChatGPT)
- **Immagini di riferimento (`-i`)**: nessuna
- **Risultato**: `img/studio-bg.png`
- **Post-produzione**: quantizzato a 128 colori; le tre mensole a destra restano vuote (posizioni in `scene.js`)
- **Comando**: `codex exec -m gpt-5.6-terra --skip-git-repo-check - < prompt.txt` (il testo qui sotto va in `prompt.txt` e arriva da stdin; `-i` va prima del `-`)

## Prompt

```text
Use your image generation tool to create ONE image: a wide 16-bit pixel-art side-view scene of a cozy Italian ceramic artist's studio interior, to be used as a horizontally scrolling game background (aspect ratio about 3:1). Left to right: entrance door with a plant, a pottery wheel with a clay pot, a wooden worktable with tools, a big window with soft daylight, a kiln, and long empty wooden wall shelves at mid height (leave the shelves EMPTY, no vases on them), terracotta tile floor along the bottom 20% with a clear flat walkable floor line. Warm terracotta, cream and wood palette, consistent with the character style of a pixel-art ceramist in a red apron. No characters, no text. Reply only with the exact saved file path.
```
