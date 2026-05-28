/* forecast.js
 * Open-Meteo wrapper + nightly threshold evaluator.
 * No API key required. CORS-enabled. Free.
 */

const Forecast = (() => {
  const BASE = 'https://api.open-meteo.com/v1/forecast';

  const defaults = {
    cloudMaxPct: 30,
    moonMaxPct: 40,
    minUsableDarkMin: 90,
    forecastDays: 14
  };

  async function fetchForecast(lat, lon, opts={}){
    const days = opts.forecastDays || defaults.forecastDays;
    const tz = opts.timezone || 'auto';
    const url = BASE + '?latitude=' + lat + '&longitude=' + lon
      + '&hourly=cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,'
      + 'visibility,relative_humidity_2m,temperature_2m,dew_point_2m,'
      + 'wind_speed_10m,wind_direction_10m,precipitation_probability'
      + '&daily=sunrise,sunset,uv_index_max,precipitation_sum'
      + '&timezone=' + encodeURIComponent(tz) + '&forecast_days=' + days;
    const r = await fetch(url);
    if(!r.ok) throw new Error('Open-Meteo HTTP ' + r.status);
    return r.json();
  }

  function buildHourlyMaps(forecast){
    const t = forecast.hourly.time;
    const m = {};
    const keys = ['cloud_cover','cloud_cover_low','cloud_cover_mid','cloud_cover_high',
                  'visibility','relative_humidity_2m','temperature_2m','dew_point_2m',
                  'wind_speed_10m','wind_direction_10m','precipitation_probability'];
    keys.forEach(k => { m[k] = new Map(); });
    t.forEach((ts, i) => {
      const key = ts.slice(0,13);
      keys.forEach(k => { if(forecast.hourly[k]) m[k].set(key, forecast.hourly[k][i]); });
    });
    return m;
  }

  function localHourKey(date, utcOffsetSeconds){
    const shifted = new Date(date.getTime() + utcOffsetSeconds*1000);
    return shifted.toISOString().slice(0,13);
  }

  function evaluateNight({darkStart, darkEnd, moonUpAtStart, moonset, moonrise, moonIllumPct},
                         forecast, maps, thresholds = defaults){
    const dur = (darkEnd - darkStart)/60000;
    let moonDownMin = 0;
    const events = [];
    if(moonset && moonset >= darkStart && moonset <= darkEnd) events.push({t: moonset, type:'set'});
    if(moonrise && moonrise >= darkStart && moonrise <= darkEnd) events.push({t: moonrise, type:'rise'});
    events.sort((a,b) => a.t - b.t);
    let cursor = darkStart, up = moonUpAtStart;
    for(const ev of events){
      if(!up) moonDownMin += (ev.t - cursor)/60000;
      cursor = ev.t;
      up = (ev.type === 'rise');
    }
    if(!up) moonDownMin += (darkEnd - cursor)/60000;

    const offsetSec = forecast.utc_offset_seconds || 0;
    const cur = new Date(darkStart); cur.setMinutes(0,0,0);
    const hours = [];
    while(cur <= darkEnd){
      const k = localHourKey(cur, offsetSec);
      hours.push({
        t: new Date(cur),
        cloud:   maps.cloud_cover.get(k),
        cloudLo: maps.cloud_cover_low.get(k),
        cloudMid:maps.cloud_cover_mid.get(k),
        cloudHi: maps.cloud_cover_high.get(k),
        vis:     maps.visibility.get(k),
        rh:      maps.relative_humidity_2m.get(k),
        t_c:     maps.temperature_2m.get(k),
        dew:     maps.dew_point_2m.get(k),
        wind:    maps.wind_speed_10m.get(k),
        windDir: maps.wind_direction_10m.get(k),
        precip:  maps.precipitation_probability.get(k)
      });
      cur.setHours(cur.getHours() + 1);
    }
    const cvs = hours.map(h=>h.cloud).filter(x=>x!=null);
    const cloudAvg = cvs.length ? cvs.reduce((a,b)=>a+b,0)/cvs.length : null;
    const cloudMax = cvs.length ? Math.max(...cvs) : null;
    const cloudMin = cvs.length ? Math.min(...cvs) : null;

    const fullDarkMoonDown = moonDownMin >= dur*0.99;
    const moonOk = (moonIllumPct <= thresholds.moonMaxPct) || fullDarkMoonDown;
    const usableMin = (moonIllumPct <= thresholds.moonMaxPct) ? dur : moonDownMin;
    const cloudOk = (cloudMax != null) && (cloudMax <= thresholds.cloudMaxPct);
    const intervalOk = usableMin >= thresholds.minUsableDarkMin;

    const dewRisk = hours.some(h => h.t_c != null && h.dew != null && h.dew >= h.t_c - 2);
    const windAvg = (() => {
      const w = hours.map(h=>h.wind).filter(x=>x!=null);
      return w.length ? w.reduce((a,b)=>a+b,0)/w.length : null;
    })();

    return {
      darkStart, darkEnd, durationMin: dur,
      moonDownMin, moonIllumPct, moonUpAtStart, moonset, moonrise,
      cloudAvg, cloudMin, cloudMax, hours,
      usableMin, cloudOk, moonOk, intervalOk,
      qualifies: cloudOk && moonOk && intervalOk,
      dewRisk, windAvg
    };
  }

  function evaluateAll(forecast, Astro, lat, lon, thresholds = defaults){
    const maps = buildHourlyMaps(forecast);
    const days = forecast.daily.time;
    const nights = [];
    for(let i = 0; i < days.length - 1; i++){
      const [y,m,d] = days[i].split('-').map(Number);
      const offsetSec = forecast.utc_offset_seconds || 0;
      const noonLocal = new Date(Date.UTC(y, m-1, d, 12 - offsetSec/3600, 0, 0));
      const times = Astro.getSunTimes(noonLocal, lat, lon, 70);
      const nextNoon = new Date(noonLocal.getTime() + 86400000);
      const nextTimes = Astro.getSunTimes(nextNoon, lat, lon, 70);
      const darkStart = times.astroDusk;
      const darkEnd   = nextTimes.astroDawn;
      if(!darkStart || !darkEnd || isNaN(darkStart) || isNaN(darkEnd)) continue;
      const moonAtStart = Astro.getMoonPosition(darkStart, lat, lon).altitude > 0;
      const mt1 = Astro.getMoonTimes(darkStart, lat, lon);
      const mt2 = Astro.getMoonTimes(new Date(darkStart.getTime() + 86400000), lat, lon);
      const all = [];
      ['rise','set'].forEach(k=>{
        if(mt1[k]) all.push({type:k, t:mt1[k]});
        if(mt2[k]) all.push({type:k, t:mt2[k]});
      });
      all.sort((a,b) => a.t - b.t);
      let moonset = null, moonrise = null;
      for(const ev of all){
        if(ev.t >= darkStart && ev.t <= darkEnd){
          if(ev.type === 'set' && !moonset)  moonset  = ev.t;
          if(ev.type === 'rise' && !moonrise) moonrise = ev.t;
        }
      }
      const illum = Astro.getMoonIllumination(new Date((darkStart.getTime() + darkEnd.getTime())/2));
      const result = evaluateNight({
        darkStart, darkEnd,
        moonUpAtStart: moonAtStart,
        moonset, moonrise,
        moonIllumPct: illum.fraction * 100
      }, forecast, maps, thresholds);
      result.dateISO = days[i];
      result.sunset = times.sunset;
      result.sunrise = times.sunrise;
      nights.push(result);
    }
    return nights;
  }

  function summarize(nights){
    const firstGo = nights.find(n => n.qualifies);
    if(firstGo) return {status:'GO', night:firstGo, nights};
    const ranked = nights.map(n => ({
      n,
      score: (n.cloudOk?0:30) + (n.moonOk?0:20) + (n.intervalOk?0:20)
           + (n.cloudMax || 50)*0.2
           + (n.moonIllumPct > 40 ? n.moonIllumPct : 0)
    })).sort((a,b)=>a.score-b.score);
    return {status:'SILENCE', best: ranked[0] ? ranked[0].n : null, nights};
  }

  return {fetchForecast, buildHourlyMaps, evaluateNight, evaluateAll, summarize, defaults};
})();

if(typeof module !== 'undefined') module.exports = Forecast;
if(typeof window !== 'undefined') window.Forecast = Forecast;
