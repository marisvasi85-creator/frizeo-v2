# Meta ad 1 — Creată de un frizer pentru frizeri

Reclamă de încredere (~20–21s, **1080×1920**). Stil Apple / Linear / Stripe.

**Nu vinde funcții.** Vinde că Frizeo e făcută de cineva care înțelege meseria.

## Storyboard

| Timp | Cadru |
|------|--------|
| 0–2s | Hook: „Creată de un frizer. Pentru frizeri.” + logo |
| 2–5s | Atmosferă barbershop real (lumini calde) |
| 5–8s | Dashboard Frizeo — zoom lent |
| 8–12s | Programare publică (UI real, static) |
| 12–16s | Programarea apare în dashboard |
| 16–20s | CTA: Creează cont gratuit |

## Proiect

```
public/demo/meta-ad/trust/
  index.html
  barber-atmosphere.png
  frizeo-logo-512.png
  music.wav          # cinematic discret (gitignored; regenerabil)
```

## Regenerare

```bash
# din /opt/cursor/artifacts/frizeo-trust-ad sau cu playwright local
node scripts/record-trust-ad.mjs
ffmpeg -y -i public/demo/meta-ad/trust/raw/*.webm \
  -i public/demo/meta-ad/trust/music.wav \
  -filter_complex "[1:a]volume=0.32,afade=t=in:st=0:d=1.2,afade=t=out:st=18.5:d=1.8[a]" \
  -map 0:v -map "[a]" -vf "fps=30,format=yuv420p" \
  -c:v libx264 -preset slow -crf 17 -c:a aac -b:a 192k -shortest \
  -movflags +faststart frizeo-trust-ad-9x16.mp4
```

Deliverable artifact: `frizeo-trust-ad-9x16.mp4`
