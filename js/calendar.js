/* calendar.js
 * Annual astronomical event calendar: meteor showers + computed conjunctions.
 */

const AstroCalendar = (() => {

  let showers = [];

  if(typeof window !== 'undefined' && window.METEOR_SHOWERS_DATA){
    showers = window.METEOR_SHOWERS_DATA;
  }

  function setShowers(arr){ showers = arr || []; return showers; }

  async function loadShowers(url='data/meteor-showers.json'){
    if(showers.length) return showers;
    if(typeof window !== 'undefined' && window.METEOR_SHOWERS_DATA){
      showers = window.METEOR_SHOWERS_DATA;
      return showers;
    }
    if(url === 'inline://') return showers;
    try {
      const r = await fetch(url);
      showers = await r.json();
    } catch(e){
      console.warn('shower data missing:', e);
      showers = [];
    }
    return showers;
  }

  function showerStatus(year, now = new Date()){
    return showers.map(s => {
      const start = new Date(year, s.startMonth-1, s.startDay, 22, 0, 0);
      const peak  = new Date(year, s.peakMonth-1,  s.peakDay,  3, 0, 0);
      const end   = new Date(year, s.endMonth-1,   s.endDay,   3, 0, 0);
      if(s.startMonth > s.endMonth) start.setFullYear(year-1);
      const active = now >= start && now <= end;
      const daysFromPeak = (now - peak)/86400000;
      return {shower:s, active, startDate:start, peakDate:peak, endDate:end, daysFromPeak};
    });
  }

  function nextShower(now = new Date()){
    const year = now.getFullYear();
    const status = showerStatus(year, now)
      .concat(showerStatus(year+1, now))
      .filter(s => s.peakDate >= now)
      .sort((a,b) => a.peakDate - b.peakDate);
    return status[0];
  }

  function findConjunctions(Astro, lat, lon, startDate, endDate, thresholdDeg = 3, stepHours = 6){
    if(!Astro) return [];
    const planets = ['Mercury','Venus','Mars','Jupiter','Saturn'];
    const conjs = new Map();
    const start = new Date(startDate), end = new Date(endDate);
    for(let t = new Date(start); t <= end; t = new Date(t.getTime() + stepHours*3600000)){
      const pos = {};
      for(const p of planets) pos[p] = Astro.getPlanetPosition(p, t, lat, lon);
      const moon = Astro.getMoonPosition(t, lat, lon);
      const moonRADec = _moonRaDec(t);
      pos['Moon'] = {ra: moonRADec.ra, dec: moonRADec.dec, alt: moon.altitude*180/Math.PI};
      const bodies = ['Mercury','Venus','Mars','Jupiter','Saturn','Moon'];
      for(let i=0;i<bodies.length;i++) for(let j=i+1;j<bodies.length;j++){
        const a=pos[bodies[i]], b=pos[bodies[j]];
        if(!a || !b) continue;
        const sep = angularSeparation(a.ra,a.dec,b.ra,b.dec);
        if(sep <= thresholdDeg){
          const key = bodies[i]+' & '+bodies[j];
          const prev = conjs.get(key);
          if(!prev || sep < prev.sep) conjs.set(key, {pair:key, t:new Date(t), sep});
        }
      }
    }
    return Array.from(conjs.values()).sort((a,b)=>a.t-b.t);
  }

  function _moonRaDec(date){
    const PI=Math.PI, sin=Math.sin, cos=Math.cos, tan=Math.tan,
          asin=Math.asin, atan=Math.atan2, rad=PI/180;
    const dayMs=86400000, J1970=2440588, J2000=2451545;
    const toJulian = d => d.valueOf()/dayMs - 0.5 + J1970;
    const toDays = d => toJulian(d) - J2000;
    const e = rad*23.4397;
    const d = toDays(date);
    const L=rad*(218.316+13.176396*d), M=rad*(134.963+13.064993*d), F=rad*(93.272+13.229350*d),
          l=L+rad*6.289*sin(M), b=rad*5.128*sin(F);
    const ra  = atan(sin(l)*cos(e) - tan(b)*sin(e), cos(l)) * 180/PI;
    const dec = asin(sin(b)*cos(e) + cos(b)*sin(e)*sin(l)) * 180/PI;
    return {ra: (ra+360)%360, dec};
  }

  function angularSeparation(ra1, dec1, ra2, dec2){
    const rad = Math.PI/180;
    const D = Math.acos(
      Math.sin(dec1*rad)*Math.sin(dec2*rad) +
      Math.cos(dec1*rad)*Math.cos(dec2*rad)*Math.cos((ra1-ra2)*rad)
    );
    return D*180/Math.PI;
  }

  function seasonalEvents(year){
    return [
      {name:'March Equinox', date: new Date(year, 2, 20, 0, 0)},
      {name:'June Solstice', date: new Date(year, 5, 21, 0, 0)},
      {name:'September Equinox', date: new Date(year, 8, 22, 0, 0)},
      {name:'December Solstice', date: new Date(year, 11, 21, 0, 0)}
    ];
  }

  function moonPhaseEvents(Astro, year){
    if(!Astro || !Astro.getMoonIllumination) return [];
    const events = [];
    let prev = null, prev2 = null;
    for(let d = new Date(year,0,1); d.getFullYear() === year; d.setDate(d.getDate()+1)){
      const ill = Astro.getMoonIllumination(new Date(d)).fraction;
      if(prev2 != null && prev != null){
        if(prev > prev2 && prev > ill) events.push({name:'Full Moon', date: new Date(d.getFullYear(), d.getMonth(), d.getDate()-1), value: prev});
        if(prev < prev2 && prev < ill) events.push({name:'New Moon',  date: new Date(d.getFullYear(), d.getMonth(), d.getDate()-1), value: prev});
      }
      prev2 = prev; prev = ill;
    }
    return events;
  }

  return {loadShowers, setShowers, showerStatus, nextShower, findConjunctions,
          angularSeparation, seasonalEvents, moonPhaseEvents};
})();

if(typeof module !== 'undefined') module.exports = AstroCalendar;
if(typeof window !== 'undefined') window.AstroCalendar = AstroCalendar;
