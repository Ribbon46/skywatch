import ephem, json, datetime, math
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Europe/Bucharest")
UTC = ZoneInfo("UTC")

obs = ephem.Observer()
obs.lat = '44.4268'
obs.lon = '26.1025'
obs.elevation = 70
obs.pressure = 0  # ignore refraction for astronomical twilight

# Today's local date (forecast starts at 2026-05-26 local)
forecast = json.load(open('forecast_raw.json'))
days_iso = forecast['daily']['time']  # list of YYYY-MM-DD

def to_local(d): 
    return d.replace(tzinfo=UTC).astimezone(TZ)

results = []
for i, d_iso in enumerate(days_iso[:7]):  # 7 nights: night of d_iso (sunset that day -> sunrise next day)
    y,m,day = map(int, d_iso.split('-'))
    # Set observer date to noon local that day in UTC
    noon_local = datetime.datetime(y,m,day,12,0,0,tzinfo=TZ)
    obs.date = noon_local.astimezone(UTC).strftime('%Y/%m/%d %H:%M:%S')
    sun = ephem.Sun()
    moon = ephem.Moon()
    
    # Astronomical twilight: sun -18 deg
    obs.horizon = '-18'
    try:
        eve_astro_end = obs.next_setting(sun, use_center=True)
    except Exception as e:
        eve_astro_end = None
    try:
        morn_astro_start = obs.next_rising(sun, use_center=True)
    except Exception as e:
        morn_astro_start = None
    
    # Sunset / Sunrise (civil sun)
    obs.horizon = '-0:34'
    sunset = obs.next_setting(sun)
    obs.date = sunset
    sunrise = obs.next_rising(sun)
    
    # Moonrise/set, illumination for the night
    obs.date = noon_local.astimezone(UTC).strftime('%Y/%m/%d %H:%M:%S')
    obs.horizon = '-0:34'
    moon.compute(obs)
    illum = moon.phase  # percent illuminated
    
    # Get moon rise/set within the night window [sunset, sunrise next]
    obs.date = sunset
    try:
        moonrise = obs.next_rising(moon)
        if moonrise > sunrise: moonrise = None
    except (ephem.AlwaysUpError, ephem.NeverUpError):
        moonrise = None
    obs.date = sunset
    try:
        moonset = obs.next_setting(moon)
        if moonset > sunrise: moonset = None
    except (ephem.AlwaysUpError, ephem.NeverUpError):
        moonset = None
    
    # Is moon currently up at astro twilight end?
    if eve_astro_end:
        obs.date = eve_astro_end
        moon.compute(obs)
        moon_up_at_dark_start = moon.alt > 0
    else:
        moon_up_at_dark_start = False
    
    def fmt(t):
        if t is None: return None
        return to_local(ephem.Date(t).datetime()).strftime('%H:%M')
    def fmt_iso(t):
        if t is None: return None
        return to_local(ephem.Date(t).datetime()).isoformat()
    
    results.append({
        'date': d_iso,
        'sunset_local': fmt(sunset),
        'sunset_iso': fmt_iso(sunset),
        'sunrise_local': fmt(sunrise),
        'sunrise_iso': fmt_iso(sunrise),
        'astro_twilight_end_local': fmt(eve_astro_end),
        'astro_twilight_end_iso': fmt_iso(eve_astro_end),
        'astro_twilight_start_local': fmt(morn_astro_start),
        'astro_twilight_start_iso': fmt_iso(morn_astro_start),
        'moonrise_local': fmt(moonrise),
        'moonset_local': fmt(moonset),
        'moonrise_iso': fmt_iso(moonrise),
        'moonset_iso': fmt_iso(moonset),
        'moon_illum_pct': round(illum, 1),
        'moon_up_at_dark_start': moon_up_at_dark_start,
    })

json.dump(results, open('astro.json', 'w'), indent=2)
print(json.dumps(results, indent=2))
