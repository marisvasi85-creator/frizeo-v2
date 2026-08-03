# Meta ad demo — cont → Google Calendar → programare

Video vertical 9:16 (~32s) pentru Reels / Stories / Ads. Mesaj: **durează foarte puțin de la crearea contului până la prima programare**, inclusiv sync automat în Google Calendar.

## Flux

1. **Creezi contul** — `/signup`
2. **Conectezi Google Calendar** — Profil: „Conectează Google Calendar” → „Calendar conectat”
3. **Distribuie linkul** — dashboard: „Copiază”
4. **Clientul se programează** — pagina publică
5. **Clientul salvează în calendar** — Google / Apple
6. **Apare în agenda Frizeo** — „Programările de azi” + **Confirmată**
7. **Apare automat în Google Calendar** — eveniment creat de Frizeo, fără acțiune din partea frizerului

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
- Durată: ~32s
- Fără audio
- CTA: **Creează cont gratuit** → `https://www.frizeo.ro`
