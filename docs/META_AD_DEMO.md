# Meta ad demo — cont → link → programare → calendar

Video vertical 9:16 (~26s) pentru Reels / Stories / Ads. Mesaj: **durează foarte puțin de la crearea contului până la prima programare**.

## Flux

1. **Creezi contul** — `/signup`: formular, tip activitate, „Creează cont”
2. **Distribuie linkul** — dashboard: „Copiază” → „Copiat!”
3. **Clientul se programează** — pagina publică: serviciu → dată → oră → confirmare
4. **Salvează în calendar** — confirmare client: Google Calendar / Apple·Outlook
5. **Apare în agenda frizerului** — „Programările de azi” + badge **Confirmată**

## Surse

- Demo UI auto-play: [`/public/demo/meta-ad/index.html`](../public/demo/meta-ad/index.html)
- Script înregistrare: [`/scripts/record-meta-ad.mjs`](../scripts/record-meta-ad.mjs)

## Regenerare video

```bash
npx playwright install chromium
node scripts/record-meta-ad.mjs
ffmpeg -y -i public/demo/meta-ad/raw/*.webm \
  -vf "fps=30,format=yuv420p" \
  -c:v libx264 -preset slow -crf 18 -movflags +faststart -an \
  public/demo/meta-ad/frizeo-meta-ad-9x16.mp4
```

## Spec Meta

- Format: **1080×1920** (9:16)
- Durată: ~26s
- Fără audio (voiceover / muzică în Ads Manager)
- CTA: **Creează cont gratuit** → `https://www.frizeo.ro`
