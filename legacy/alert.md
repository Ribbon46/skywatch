# Astrophotography Alert — Bucharest

**Status: SILENCE**

> No qualifying window this week. Next potential opening: **night of Tuesday 9 June 2026** (waning moon at ~40% illumination, moonrise 02:05 → ~161 min of moon-down astronomical darkness, cloud forecast averaging ~18% with peaks near 25%). Re-evaluate that date 48 hours out.

---

## Why this week fails (May 26 – June 1, 2026)

This week sits across the full moon (peak full moon on **Sunday 31 May 2026**). The moon is above the horizon for the entire astronomical dark window every single night, and illumination ranges from 78% to 99.8%. Cloud cover also degrades sharply from May 27 onward.

| Date | Dark window (EEST) | Moon | Moon-down dark | Cloud (avg/max) | Verdict |
|------|--------------------|------|----------------|-----------------|---------|
| Tue 26 May | 23:03 – 03:21 | 78.3% — sets 03:15 | 6 min | 3% / 7% | Fail (moon) |
| Wed 27 May | 23:05 – 03:20 | 85.8% — up entire window | 0 min | 65% / 98% | Fail (moon + cloud) |
| Thu 28 May | 23:06 – 03:18 | 91.9% — up entire window | 0 min | 70% / 81% | Fail (moon + cloud) |
| Fri 29 May | 23:08 – 03:17 | 96.3% — up entire window | 0 min | 14% / 30% | Fail (moon) |
| Sat 30 May | 23:10 – 03:15 | 98.9% — up entire window | 0 min | 92% / 100% | Fail (moon + cloud) |
| Sun 31 May | 23:11 – 03:14 | 99.8% (full) — up entire window | 0 min | 95% / 99% | Fail (moon + cloud) |
| Mon 1 Jun | 23:13 – 03:13 | 98.9% — up entire window | 0 min | 89% / 95% | Fail (moon + cloud) |

For deep-sky and Milky Way work the moon is the hard blocker — sky background is washed out and contrast is destroyed even with perfect transparency.

---

## What this week IS good for

If you still want to shoot, the moon itself is the obvious subject:

- **Full moon portraits (May 31)** — 70-300mm at 300mm, ISO 100, 1/250s, f/8. Bracket exposures. Try a moon-rising-over-Bucharest-skyline composition.
- **Star trails around the celestial pole** — Polaris is in Ursa Minor; the bright moon actually helps illuminate the foreground. Tamron 17-28 at 17mm, f/4, ISO 400, 30s exposures stacked for 1–3 hours in StarStaX or Siril.
- **Daylight planetary scouting** — Jupiter is near solar conjunction; Saturn is a morning object low in the SE before twilight; Venus is an evening object low in the WNW. Use the 70-300 for daytime moon detail (craters along the terminator).

---

## Next opening — preview for Tuesday 9 June 2026

Pencilled-in plan, to be confirmed when within 48-hour forecast horizon:

- **Window:** ~23:24 → 02:05 EEST (moon-down astronomical dark, ~161 min)
- **Astronomical twilight:** ends 23:24, begins 03:05
- **Moon:** ~40% illuminated, rises 02:05 (so dark before moonrise)
- **Cloud forecast (today, 14 days out — low confidence):** ~18% average, 25% peak
- **Targets above 30° elevation late evening into night:**
  - **Milky Way core** rising in the SE — Sagittarius / Scorpius region clears 20° by ~midnight
  - **M13** (Hercules Globular) near zenith
  - **M57** (Ring Nebula) high in the east
  - **M27** (Dumbbell) rising
  - **Cygnus complex** (NGC 7000 North America Nebula, IC 5070 Pelican) climbing into the NE
  - Arcturus and Vega well-placed
- **Worth a drive:** Yes if conditions hold. Closest Bortle ≤5 zones from Bucharest are NE toward **Bărăgan plain** (~50 km, Lehliu / Călărași direction) or SW toward the **Argeș fields** beyond Mihăilești. Avoid the haze plume east toward Constanța.

---

## Sony A7 III Reference Settings (kept for the next qualifying alert)

### Wide-field Milky Way / nightscape — Tamron 17-28 f/2.8 @ 17mm
- **ISO:** 3200 base, push to 6400 for faint nebulosity
- **Shutter:** 15s (NPF rule for 17mm full-frame, 5.97µm pixel pitch ≈ 14–15s before trailing visible at 100%)
- **Aperture:** f/2.8 wide open for max light; stop to f/4 if corner stars look smeared
- **WB:** 4000 K manual (kills sodium glow from Bucharest in raw conversion)
- **Format:** RAW (ARW) uncompressed if card capacity allows — required for Siril / DSS
- **Focus:** manual, live-view zoom 11x on Vega or Arcturus, focus peaking high
- **Drive:** 2-second self-timer, or wired remote; consider continuous low for 20–30 frame stacks
- **Long Exposure NR: OFF** (kills stacking workflow; subtract dark frames in Siril instead)
- **High ISO NR: OFF** for RAW
- **Steady Shot: OFF** on tripod
- **Battery:** charge 2× NP-FZ100 — cold drain is real even in June

### 24mm equivalent setting (if shooting 17-28 zoomed to 24mm)
- Shutter cap ≈ 11s (NPF, FF, 5.97µm pitch). At 24mm prefer ISO 6400 / 10s over ISO 3200 / 15s — trailing is visible.

### Telephoto on tracker / moon — 70-300mm
- Moon: ISO 100, 1/250s, f/8, manual focus, 300mm
- Wide-field telephoto deep-sky (only with a star tracker — Move Shoot Move or similar): ISO 800, f/5.6, 120s exposures, 70mm framing for Andromeda/Cygnus regions

---

## Verification

Run `python3 evaluate.py` or `python3 compute_projection.py` inside this folder to regenerate. Source data: Open-Meteo forecast endpoint, ephem 4.2.1 for sun/moon ephemerides.

Files:
- `forecast_raw.json` — 7-day Open-Meteo response (hourly cloud + daily sun)
- `forecast_16d.json` — 16-day projection
- `astro.json` — sun & moon times for 7 days
- `analysis.json` — threshold evaluation
- `analysis_16d.json` — 16-day threshold projection
- `compute_astro.py`, `evaluate.py`, `compute_projection.py` — reproducible scripts
- `alert.html` — mobile-friendly view (Galaxy S25+ ready)
- `s25-camera-notes.md` — Galaxy S25+ Expert RAW / camera notes

---

*Generated 2026-05-26. Re-run nightly for updated alert.*
