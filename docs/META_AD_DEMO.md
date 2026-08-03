# Meta ad — Agency cut (1080×1920)

Reclamă premium SaaS (~21s) pentru Meta Reels / Instagram / TikTok / YouTube Shorts.

**Mesaj:** de la crearea contului la prima programare, în câteva minute — automat, inclusiv Google Calendar.

## Scene (agency refine)

| # | Text pe ecran |
|---|----------------|
| 1 Hook | Prima programare poate veni în câteva minute. |
| 2 Signup | ✓ Creezi cont |
| 3 Google connect | ✓ Conectezi Google Calendar |
| 4 Link | ✓ Distribui linkul |
| 5 Booking | ✓ Clientul rezervă |
| 6 Climax | ✓ Gata! (+ notificare, 0→1, highlight verde) |
| 7 Auto GCal | Sincronizare **AUTOMATĂ** cu Google Calendar. |
| 8 End | Creează cont gratuit. / Prima programare poate veni chiar astăzi. |

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
