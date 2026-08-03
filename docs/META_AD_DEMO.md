# Meta ad — Agency cut (1080×1920)

Reclamă premium SaaS (~23s) pentru Meta Reels / Instagram / TikTok / YouTube Shorts.

**Mesaj:** de la crearea contului la prima programare, în câteva minute — automat, inclusiv Google Calendar.

## Scene

| # | Durată VO | Text pe ecran |
|---|-----------|----------------|
| 1 Hook | 0.1–3.0s | Prima programare în doar câteva minute. |
| 2 Signup | 3.0–4.8s | Creezi contul. |
| 3 Google connect | 4.8–7.2s | Conectezi Google Calendar. |
| 4 Link | 7.2–9.3s | Distribui linkul tău. |
| 5 Booking | 9.3–11.8s | Clientul se programează online. |
| 6 Instant Frizeo | 11.8–14.6s | Programarea apare **instant** în Frizeo. |
| 7 Auto GCal | 14.6–17.8s | Se sincronizează **automat** în Google Calendar. |
| 8 End | 17.8–22.4s | De la cont la prima programare. În doar câteva minute. |

## Proiect (editabil)

```
public/demo/meta-ad/
  index.html                 # animații UI + subtitrări
  frizeo-logo-512.png
  assets/
    voiceover.mp3            # edge-tts ro-RO-AlinaNeural
    voiceover.vtt
    music.wav / music.mp3    # bed original (fără copyright terț)
    mix.mp3                  # VO + music
  raw/                       # webm Playwright (gitignored)
```

## Regenerare

```bash
# 1) VO (opțional, dacă schimbi textul)
edge-tts --voice ro-RO-AlinaNeural --rate="+8%" \
  --file public/demo/meta-ad/assets/vo-script.txt \
  --write-media public/demo/meta-ad/assets/voiceover.mp3 \
  --write-subtitles public/demo/meta-ad/assets/voiceover.vtt

# 2) Visual
node scripts/record-meta-ad.mjs

# 3) Mix audio + export
ffmpeg -y -i public/demo/meta-ad/raw/*.webm \
  -i public/demo/meta-ad/assets/mix.mp3 \
  -vf "fps=30,format=yuv420p" \
  -c:v libx264 -preset slow -crf 17 -c:a aac -b:a 192k \
  -shortest -movflags +faststart \
  public/demo/meta-ad/frizeo-meta-ad-9x16.mp4
```

## Audio notes

- **Voice-over:** generat cu Microsoft Edge TTS (`ro-RO-AlinaNeural`), ritm +8%.
- **Muzică:** bed instrumental original generat pentru acest proiect (nu e track terț) — liber de folosit în reclame Frizeo, fără atribuire CC.
- Subtitrările animate sunt în HTML, sincronizate pe VO.

## Spec export

- **1080×1920**, H.264 + AAC
- ~23s
- CTA: Începe acum → frizeo.ro
