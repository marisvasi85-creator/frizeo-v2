# Meta ad demo — link → programare → calendar

Video vertical 9:16 (~20s) pentru Reels / Stories / Ads, care arată un singur flux Frizeo:

1. **Distribuie linkul** — dashboard admin (dark): „Copiază” → „Copiat!”
2. **Programare publică** — pagina client: serviciu → dată → oră → „Confirmă programarea”
3. **Salvează în calendar** — confirmare: „Adaugă în Google Calendar” / Apple·Outlook

## Surse

- Demo UI auto-play: [`/public/demo/meta-ad/index.html`](../public/demo/meta-ad/index.html)
- Script înregistrare: [`/scripts/record-meta-ad.mjs`](../scripts/record-meta-ad.mjs)

## Regenerare video

```bash
# din rădăcina proiectului
npx playwright install chromium
node scripts/record-meta-ad.mjs
```

Scriptul scrie un `.webm` în `public/demo/meta-ad/raw/`. Export MP4:

```bash
ffmpeg -y -i public/demo/meta-ad/raw/*.webm \
  -vf "fps=30,format=yuv420p" \
  -c:v libx264 -preset slow -crf 18 -movflags +faststart -an \
  public/demo/meta-ad/frizeo-meta-ad-9x16.mp4
```

## Spec Meta

- Format: **1080×1920** (9:16)
- Durată: ~20s
- Fără audio (adaugi voiceover / muzică în Ads Manager sau CapCut)
- CTA sugerat: **Creează cont gratuit** → `https://www.frizeo.ro`
