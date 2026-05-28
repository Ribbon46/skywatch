import json
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Europe/Bucharest")
forecast = json.load(open('forecast_raw.json'))
astro = json.load(open('astro.json'))

# Build hourly cloud lookup
hourly_times = forecast['hourly']['time']  # local naive YYYY-MM-DDTHH:MM
hourly_cloud = forecast['hourly']['cloud_cover']
cloud_by_iso = {t: c for t, c in zip(hourly_times, hourly_cloud)}

def parse_local(iso):
    # iso has TZ; strip and align to hour
    dt = datetime.fromisoformat(iso)
    return dt.astimezone(TZ)

def hour_key(dt):
    return dt.strftime('%Y-%m-%dT%H:00')

THR_CLOUD = 30
THR_MOON_ILLUM = 40
THR_DARK_MINUTES = 90

results = []
for night in astro:
    dark_start = parse_local(night['astro_twilight_end_iso'])
    dark_end = parse_local(night['astro_twilight_start_iso'])
    illum = night['moon_illum_pct']
    moonset_iso = night.get('moonset_iso')
    moonrise_iso = night.get('moonrise_iso')
    
    # Compute "moon-down dark window"
    # Within [dark_start, dark_end]:
    # If moon is up at dark_start and will set before dark_end -> moon-down starts at moonset
    # If moon rises during dark window -> moon-down ends at moonrise
    # If moon up entire interval -> no moon-down
    # If moon down entire interval -> full dark window
    moon_up_start = night.get('moon_up_at_dark_start', False)
    moon_down_intervals = []
    if not moon_up_start:
        # moon down at dark_start; ends when it rises (if it does within window)
        if moonrise_iso:
            mr = parse_local(moonrise_iso)
            if mr < dark_end:
                moon_down_intervals.append((dark_start, max(min(mr, dark_end), dark_start)))
            else:
                moon_down_intervals.append((dark_start, dark_end))
        else:
            moon_down_intervals.append((dark_start, dark_end))
    else:
        # moon up at dark_start; check moonset within window
        if moonset_iso:
            ms = parse_local(moonset_iso)
            if ms < dark_end:
                moon_down_intervals.append((max(ms, dark_start), dark_end))
    
    # Total moon-down minutes in dark window
    moon_down_min = sum((b-a).total_seconds()/60 for a, b in moon_down_intervals if b > a)
    
    # Compute cloud cover hourly during dark window
    cloud_breakdown = []
    cur = dark_start.replace(minute=0, second=0, microsecond=0)
    while cur <= dark_end:
        c = cloud_by_iso.get(hour_key(cur))
        cloud_breakdown.append({'time': cur.strftime('%H:%M'), 'cloud': c})
        cur += timedelta(hours=1)
    
    cloud_values = [c['cloud'] for c in cloud_breakdown if c['cloud'] is not None]
    avg_cloud = sum(cloud_values)/len(cloud_values) if cloud_values else None
    max_cloud = max(cloud_values) if cloud_values else None
    min_cloud = min(cloud_values) if cloud_values else None
    
    # Threshold logic
    # If moon illum <= 40 OR moon below horizon for the FULL dark window:
    full_dark_moon_down = len(moon_down_intervals) > 0 and \
                          moon_down_intervals[0][0] <= dark_start and \
                          moon_down_intervals[-1][1] >= dark_end
    moon_ok = (illum <= THR_MOON_ILLUM) or full_dark_moon_down
    
    # Usable dark interval (when both moon-down AND inside dark window): >= 90 min
    usable_min = moon_down_min if illum > THR_MOON_ILLUM else (dark_end - dark_start).total_seconds()/60
    # Actually: usable dark = intersection of (dark window) and (moon-down OR moon-illum-low-enough-to-not-matter)
    # The spec says "Usable dark interval ≥ 90 minutes (between astronomical twilight end and start, minus moon-up time)"
    # So usable = dark window minus moon-up minutes
    dark_total_min = (dark_end - dark_start).total_seconds()/60
    usable_min = moon_down_min  # If moon illum is high, only moon-down portion counts
    # But if moon illum is low (<=40%), the entire dark window is usable
    if illum <= THR_MOON_ILLUM:
        usable_min = dark_total_min
    
    cloud_ok = (max_cloud is not None and max_cloud <= THR_CLOUD)
    # Allow average cloud cover for "during window" check; spec says "Cloud cover ≤ 30%" — interpret as during the usable window
    
    interval_ok = usable_min >= THR_DARK_MINUTES
    
    qualifies = cloud_ok and moon_ok and interval_ok
    
    results.append({
        'date': night['date'],
        'dark_window': f"{dark_start.strftime('%H:%M')}–{dark_end.strftime('%H:%M')}",
        'dark_total_min': round(dark_total_min, 1),
        'moon_illum_pct': illum,
        'moon_up_at_dark_start': moon_up_start,
        'moonset_local': night.get('moonset_local'),
        'moonrise_local': night.get('moonrise_local'),
        'moon_down_minutes': round(moon_down_min, 1),
        'usable_dark_minutes': round(usable_min, 1),
        'cloud_avg_pct': round(avg_cloud, 1) if avg_cloud is not None else None,
        'cloud_min_pct': min_cloud,
        'cloud_max_pct': max_cloud,
        'cloud_breakdown': cloud_breakdown,
        'cloud_ok': cloud_ok,
        'moon_ok': moon_ok,
        'interval_ok': interval_ok,
        'qualifies': qualifies,
    })

json.dump(results, open('analysis.json', 'w'), indent=2)

print("=== SUMMARY ===")
for r in results:
    flag = "✅" if r['qualifies'] else "❌"
    print(f"{flag} {r['date']}: dark {r['dark_window']} ({r['dark_total_min']}min) | moon {r['moon_illum_pct']}% (up_at_dark_start={r['moon_up_at_dark_start']}, set {r['moonset_local']}, rise {r['moonrise_local']}) | usable_dark {r['usable_dark_minutes']}min | cloud avg {r['cloud_avg_pct']}% max {r['cloud_max_pct']}% | cloud_ok={r['cloud_ok']} moon_ok={r['moon_ok']} interval_ok={r['interval_ok']}")
