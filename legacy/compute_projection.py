import ephem, json, datetime
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Europe/Bucharest"); UTC = ZoneInfo("UTC")
obs = ephem.Observer(); obs.lat='44.4268'; obs.lon='26.1025'; obs.elevation=70; obs.pressure=0

forecast = json.load(open('forecast_16d.json'))
days = forecast['daily']['time']
hourly_times = forecast['hourly']['time']
hourly_cloud = forecast['hourly']['cloud_cover']
cloud_by_iso = {t: c for t, c in zip(hourly_times, hourly_cloud)}

from datetime import datetime as dt, timedelta
def hour_key(d): return d.strftime('%Y-%m-%dT%H:00')

def night_analysis(d_iso):
    y,m,day = map(int, d_iso.split('-'))
    noon = dt(y,m,day,12,0,0,tzinfo=TZ)
    obs.date = noon.astimezone(UTC).strftime('%Y/%m/%d %H:%M:%S')
    sun = ephem.Sun(); moon = ephem.Moon()
    obs.horizon = '-18'
    eve_end = obs.next_setting(sun, use_center=True)
    morn_start = obs.next_rising(sun, use_center=True)
    obs.horizon = '-0:34'
    obs.date = noon.astimezone(UTC).strftime('%Y/%m/%d %H:%M:%S')
    moon.compute(obs)
    illum = moon.phase
    
    dark_start = ephem.Date(eve_end).datetime().replace(tzinfo=UTC).astimezone(TZ)
    dark_end = ephem.Date(morn_start).datetime().replace(tzinfo=UTC).astimezone(TZ)
    
    # Moon up at dark_start?
    obs.date = eve_end
    moon.compute(obs)
    moon_up_at_start = moon.alt > 0
    
    # Find moonrise/moonset within window
    obs.date = eve_end
    try:
        moonset = obs.next_setting(moon)
        moonset_dt = ephem.Date(moonset).datetime().replace(tzinfo=UTC).astimezone(TZ)
        if moonset_dt > dark_end: moonset_dt = None
    except (ephem.AlwaysUpError, ephem.NeverUpError):
        moonset_dt = None
    obs.date = eve_end
    try:
        moonrise = obs.next_rising(moon)
        moonrise_dt = ephem.Date(moonrise).datetime().replace(tzinfo=UTC).astimezone(TZ)
        if moonrise_dt > dark_end: moonrise_dt = None
    except (ephem.AlwaysUpError, ephem.NeverUpError):
        moonrise_dt = None
    
    # moon-down minutes in window
    if not moon_up_at_start:
        # moon is down at dark_start; up until moonrise (if any in window)
        end_down = moonrise_dt if moonrise_dt else dark_end
        moon_down_min = (end_down - dark_start).total_seconds()/60
    else:
        # moon up; down once it sets
        if moonset_dt:
            moon_down_min = (dark_end - moonset_dt).total_seconds()/60
        else:
            moon_down_min = 0
    
    dark_total_min = (dark_end - dark_start).total_seconds()/60
    if illum <= 40:
        usable_min = dark_total_min
    else:
        usable_min = moon_down_min
    
    # cloud
    cb = []
    cur = dark_start.replace(minute=0, second=0, microsecond=0)
    while cur <= dark_end:
        c = cloud_by_iso.get(hour_key(cur))
        cb.append({'time': cur.strftime('%H:%M'), 'cloud': c})
        cur += timedelta(hours=1)
    cv = [c['cloud'] for c in cb if c['cloud'] is not None]
    avg = sum(cv)/len(cv) if cv else None
    mx = max(cv) if cv else None
    
    return {
        'date': d_iso,
        'dark_window': f"{dark_start.strftime('%H:%M')}–{dark_end.strftime('%H:%M')}",
        'dark_total_min': round(dark_total_min,1),
        'moon_illum_pct': round(illum,1),
        'moon_up_at_dark_start': moon_up_at_start,
        'moonset_local': moonset_dt.strftime('%H:%M') if moonset_dt else None,
        'moonrise_local': moonrise_dt.strftime('%H:%M') if moonrise_dt else None,
        'moon_down_min': round(moon_down_min,1),
        'usable_dark_min': round(usable_min,1),
        'cloud_avg': round(avg,1) if avg is not None else None,
        'cloud_max': mx,
        'cloud_ok': (mx is not None and mx<=30),
        'moon_ok': (illum<=40) or moon_down_min>=dark_total_min*0.99,
        'interval_ok': usable_min>=90,
        'qualifies': None,
        'cloud_breakdown': cb,
    }

results = []
for d_iso in days:
    r = night_analysis(d_iso)
    r['qualifies'] = r['cloud_ok'] and r['moon_ok'] and r['interval_ok']
    results.append(r)

json.dump(results, open('analysis_16d.json','w'), indent=2)
print("=== 16-DAY PROJECTION ===")
for r in results:
    flag = "✅" if r['qualifies'] else "❌"
    print(f"{flag} {r['date']}: dark {r['dark_window']} | moon {r['moon_illum_pct']}% set={r['moonset_local']} rise={r['moonrise_local']} | usable {r['usable_dark_min']}min | cloud avg {r['cloud_avg']}% max {r['cloud_max']}% | cloud={r['cloud_ok']} moon={r['moon_ok']} interval={r['interval_ok']}")
