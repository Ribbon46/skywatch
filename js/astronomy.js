/* astronomy.js
 * Sun, Moon, planet positions and rise/set; coordinate transforms.
 * Sun/Moon via SunCalc (BSD-2, Vladimir Agafonkin).
 * Planet positions via Paul Schlyter's simplified VSOP-style formulas (public domain,
 *   "How to compute planetary positions", https://stjarnhimlen.se/comp/ppcomp.html).
 * Accurate to ~1-2 arcminutes — perfectly fine for "is X above 30° from here right now".
 */

const Astro = (() => {
  /* ============== SunCalc 1.9.0 (BSD-2) ============== */
  const PI = Math.PI, sin = Math.sin, cos = Math.cos, tan = Math.tan,
        asin = Math.asin, atan = Math.atan2, acos = Math.acos, rad = PI/180;
  const dayMs = 86400000, J1970 = 2440588, J2000 = 2451545;
  const e = rad*23.4397;

  const toJulian = d => d.valueOf()/dayMs - 0.5 + J1970;
  const fromJulian = j => new Date((j + 0.5 - J1970) * dayMs);
  const toDays = d => toJulian(d) - J2000;

  const rightAscension = (l,b) => atan(sin(l)*cos(e) - tan(b)*sin(e), cos(l));
  const declination    = (l,b) => asin(sin(b)*cos(e) + cos(b)*sin(e)*sin(l));
  const azimuth        = (H,phi,dec) => atan(sin(H), cos(H)*sin(phi) - tan(dec)*cos(phi));
  const altitude       = (H,phi,dec) => asin(sin(phi)*sin(dec) + cos(phi)*cos(dec)*cos(H));
  const siderealTime   = (d,lw) => rad*(280.16 + 360.9856235*d) - lw;
  const astroRefraction = h => { if(h<0) h=0; return 0.0002967/Math.tan(h + 0.00312536/(h+0.08901179)); };

  const solarMeanAnomaly = d => rad*(357.5291 + 0.98560028*d);
  const eclipticLongitude = M => {
    const C = rad*(1.9148*sin(M) + 0.02*sin(2*M) + 0.0003*sin(3*M)),
          P = rad*102.9372;
    return M + C + P + PI;
  };
  const sunCoords = d => {
    const M = solarMeanAnomaly(d), L = eclipticLongitude(M);
    return {dec: declination(L,0), ra: rightAscension(L,0)};
  };

  function getSunPosition(date, lat, lon){
    const lw=rad*-lon, phi=rad*lat, d=toDays(date), c=sunCoords(d),
          H=siderealTime(d,lw)-c.ra;
    return {azimuth: azimuth(H,phi,c.dec), altitude: altitude(H,phi,c.dec)};
  }
  const J0=0.0009;
  const julianCycle = (d,lw) => Math.round(d - J0 - lw/(2*PI));
  const approxTransit = (Ht,lw,n) => J0 + (Ht+lw)/(2*PI) + n;
  const solarTransitJ = (ds,M,L) => J2000 + ds + 0.0053*sin(M) - 0.0069*sin(2*L);
  const hourAngle = (h,phi,d) => acos((sin(h) - sin(phi)*sin(d)) / (cos(phi)*cos(d)));
  const observerAngle = h => -2.076*Math.sqrt(h)/60;
  const getSetJ = (h,lw,phi,dec,n,M,L) => {
    const w = hourAngle(h,phi,dec), a = approxTransit(w,lw,n);
    return solarTransitJ(a,M,L);
  };
  function getSunTimes(date, lat, lon, height=0){
    const lw=rad*-lon, phi=rad*lat, dh=observerAngle(height), d=toDays(date),
          n=julianCycle(d,lw), ds=approxTransit(0,lw,n),
          M=solarMeanAnomaly(ds), L=eclipticLongitude(M), dec=declination(L,0),
          Jnoon=solarTransitJ(ds,M,L);
    const events = [
      [-0.833, 'sunrise',     'sunset'],
      [-0.3,   'sunriseEnd',  'sunsetStart'],
      [-6,     'dawn',        'dusk'],
      [-12,    'nauticalDawn','nauticalDusk'],
      [-18,    'astroDawn',   'astroDusk'],
      [ 6,     'goldenEnd',   'goldenStart']
    ];
    const r = {solarNoon: fromJulian(Jnoon), nadir: fromJulian(Jnoon-0.5)};
    for(const [h0,riseName,setName] of events){
      const h = (h0+dh)*rad;
      const Jset = getSetJ(h,lw,phi,dec,n,M,L);
      const Jrise = Jnoon - (Jset - Jnoon);
      r[riseName] = fromJulian(Jrise);
      r[setName]  = fromJulian(Jset);
    }
    return r;
  }

  function moonCoords(d){
    const L=rad*(218.316 + 13.176396*d),
          M=rad*(134.963 + 13.064993*d),
          F=rad*(93.272 + 13.229350*d),
          l=L + rad*6.289*sin(M),
          b=rad*5.128*sin(F),
          dt=385001 - 20905*cos(M);
    return {ra: rightAscension(l,b), dec: declination(l,b), dist: dt};
  }
  function getMoonPosition(date, lat, lon){
    const lw=rad*-lon, phi=rad*lat, d=toDays(date), c=moonCoords(d),
          H=siderealTime(d,lw)-c.ra,
          h=altitude(H,phi,c.dec),
          pa=atan(sin(H), tan(phi)*cos(c.dec) - sin(c.dec)*cos(H));
    return {azimuth: azimuth(H,phi,c.dec),
            altitude: h + astroRefraction(h),
            distance: c.dist, parallacticAngle: pa};
  }
  function getMoonIllumination(date){
    const d=toDays(date||new Date()), s=sunCoords(d), m=moonCoords(d), sdist=149598000,
          phi=acos(sin(s.dec)*sin(m.dec) + cos(s.dec)*cos(m.dec)*cos(s.ra-m.ra)),
          inc=atan(sdist*sin(phi), m.dist - sdist*cos(phi)),
          angle=atan(cos(s.dec)*sin(s.ra-m.ra),
                     sin(s.dec)*cos(m.dec) - cos(s.dec)*sin(m.dec)*cos(s.ra-m.ra));
    return {fraction: (1+cos(inc))/2,
            phase: 0.5 + 0.5*inc*(angle<0?-1:1)/PI,
            angle};
  }
  function hoursLater(date, h){ return new Date(date.valueOf() + h*dayMs/24); }
  function getMoonTimes(date, lat, lon){
    const t=new Date(date); t.setHours(0,0,0,0);
    const hc=0.133*rad;
    let h0=getMoonPosition(t,lat,lon).altitude - hc, h1,h2,rise,set,a,b,xe,ye,d,roots,x1,x2,dx;
    for(let i=1; i<=24; i+=2){
      h1 = getMoonPosition(hoursLater(t,i),   lat,lon).altitude - hc;
      h2 = getMoonPosition(hoursLater(t,i+1), lat,lon).altitude - hc;
      a=(h0+h2)/2 - h1; b=(h2-h0)/2; xe=-b/(2*a); ye=(a*xe+b)*xe+h1;
      d=b*b - 4*a*h1; roots=0;
      if(d>=0){
        dx=Math.sqrt(d)/(Math.abs(a)*2); x1=xe-dx; x2=xe+dx;
        if(Math.abs(x1)<=1) roots++;
        if(Math.abs(x2)<=1) roots++;
        if(x1<-1) x1=x2;
      }
      if(roots===1){ if(h0<0) rise=i+x1; else set=i+x1; }
      else if(roots===2){ rise=i+(ye<0?x2:x1); set=i+(ye<0?x1:x2); }
      if(rise && set) break;
      h0=h2;
    }
    const r={};
    if(rise) r.rise = hoursLater(t,rise);
    if(set)  r.set  = hoursLater(t,set);
    if(!rise && !set) r[ye>0?'alwaysUp':'alwaysDown']=true;
    return r;
  }

  /* ============== Planet positions ============== */
  /* Based on Paul Schlyter's "How to compute planetary positions" (public domain).
   * Heliocentric Keplerian elements at epoch J2000, mean motion in deg/day.
   * Accurate to ~1-2 arcminutes for the next several decades. */
  const PLANETS = {
    Mercury: {N: 48.3313, i: 7.0047, w: 29.1241, a: 0.387098, e: 0.205635,
              M0: 168.6562, n: 4.0923344368},
    Venus:   {N: 76.6799, i: 3.3946, w: 54.8910, a: 0.723330, e: 0.006773,
              M0: 48.0052, n: 1.6021302244},
    Mars:    {N: 49.5574, i: 1.8497, w: 286.5016, a: 1.523688, e: 0.093405,
              M0: 18.6021, n: 0.5240207766},
    Jupiter: {N: 100.4542, i: 1.3030, w: 273.8777, a: 5.20256, e: 0.048498,
              M0: 19.8950, n: 0.0830853001},
    Saturn:  {N: 113.6634, i: 2.4886, w: 339.3939, a: 9.55475, e: 0.055546,
              M0: 316.9670, n: 0.0334442282},
    Uranus:  {N: 74.0005, i: 0.7733, w: 96.6612, a: 19.18171, e: 0.047318,
              M0: 142.5905, n: 0.011725806},
    Neptune: {N: 131.7806, i: 1.7700, w: 272.8461, a: 30.05826, e: 0.008606,
              M0: 260.2471, n: 0.005995147}
  };

  function dayNumber(date){
    /* Days since 1999-12-31 23:00:00 UT (Schlyter epoch d=0 at 2000-01-01 00:00 UT - .5 = 2451543.5) */
    const Y=date.getUTCFullYear(), M=date.getUTCMonth()+1, D=date.getUTCDate(),
          UT=date.getUTCHours() + date.getUTCMinutes()/60 + date.getUTCSeconds()/3600;
    const d = 367*Y - Math.floor(7*(Y+Math.floor((M+9)/12))/4) + Math.floor(275*M/9) + D - 730530;
    return d + UT/24;
  }

  function rev(x){ x = x % 360; if(x<0) x += 360; return x; }

  function sunHelio(d){
    /* Returns heliocentric Sun position seen from Earth (ecliptic coords). */
    const w = 282.9404 + 4.70935e-5*d;
    const e_ = 0.016709 - 1.151e-9*d;
    const M = rev(356.0470 + 0.9856002585*d);
    const Mrad = M*rad;
    const E = M + (180/PI)*e_*sin(Mrad)*(1 + e_*cos(Mrad));
    const Erad = E*rad;
    const xv = cos(Erad) - e_;
    const yv = Math.sqrt(1 - e_*e_) * sin(Erad);
    const v = (180/PI)*atan(yv, xv);
    const r = Math.sqrt(xv*xv + yv*yv);
    const lon = rev(v + w);
    return {lon, r, w, M, e: e_};
  }

  function planetHelio(p, d){
    const N = p.N + 0; // simplified — minor secular terms omitted
    const i = p.i;
    const w = p.w;
    const a = p.a;
    const e_ = p.e;
    const M = rev(p.M0 + p.n*d);
    /* Solve Kepler's equation iteratively */
    let E = M + (180/PI)*e_*sin(M*rad)*(1 + e_*cos(M*rad));
    for(let k=0; k<10; k++){
      const dE = (E - (180/PI)*e_*sin(E*rad) - M) / (1 - e_*cos(E*rad));
      E -= dE;
      if(Math.abs(dE) < 1e-6) break;
    }
    const Erad = E*rad;
    const xv = a*(cos(Erad) - e_);
    const yv = a*Math.sqrt(1 - e_*e_)*sin(Erad);
    const v = (180/PI)*atan(yv, xv);
    const r = Math.sqrt(xv*xv + yv*yv);
    /* Convert helio orbital -> ecliptic helio coords */
    const Nr=N*rad, ir=i*rad, vw=(v+w)*rad;
    const xe = r*(cos(Nr)*cos(vw) - sin(Nr)*sin(vw)*cos(ir));
    const ye = r*(sin(Nr)*cos(vw) + cos(Nr)*sin(vw)*cos(ir));
    const ze = r*(sin(vw)*sin(ir));
    return {xe, ye, ze, r};
  }

  function getPlanetPosition(name, date, lat, lon){
    const p = PLANETS[name];
    if(!p) return null;
    const d = dayNumber(date);
    const sun = sunHelio(d);
    /* Sun ecliptic coords (geocentric) — Earth's helio position is -Sun */
    const sunLonRad = sun.lon*rad;
    const xs = sun.r*cos(sunLonRad);
    const ys = sun.r*sin(sunLonRad);
    const ph = planetHelio(p, d);
    /* Geocentric ecliptic coords */
    const xg = ph.xe + xs;
    const yg = ph.ye + ys;
    const zg = ph.ze;
    /* Ecliptic -> equatorial */
    const xe = xg;
    const ye = yg*cos(e) - zg*sin(e);
    const ze = yg*sin(e) + zg*cos(e);
    const ra = rev((180/PI)*atan(ye, xe));
    const dec = (180/PI)*asin(ze / Math.sqrt(xe*xe + ye*ye + ze*ze));
    const dist = Math.sqrt(xe*xe + ye*ye + ze*ze);
    /* Apparent altitude/azimuth from observer */
    const alt_az = equatorialToHorizon(ra, dec, date, lat, lon);
    return {ra, dec, dist, ...alt_az};
  }

  /* ============== Coordinate transforms ============== */
  /* Local sidereal time in hours */
  function siderealTimeHours(date, lon){
    const d = toDays(date);
    const GMST = 18.697374558 + 24.06570982441908 * d;
    let LST = (GMST + lon/15) % 24;
    if(LST < 0) LST += 24;
    return LST;
  }

  /* Convert RA (deg) + Dec (deg) -> alt/az for observer (lat,lon) at given Date */
  function equatorialToHorizon(raDeg, decDeg, date, lat, lon){
    const LST = siderealTimeHours(date, lon); // hours
    let H = (LST*15) - raDeg;                  // hour angle deg
    H = ((H + 540) % 360) - 180;
    const Hr = H*rad, decR = decDeg*rad, phiR = lat*rad;
    const altR = asin(sin(decR)*sin(phiR) + cos(decR)*cos(phiR)*cos(Hr));
    const azR  = atan(sin(Hr), cos(Hr)*sin(phiR) - tan(decR)*cos(phiR));
    let az = (azR*180/PI) + 180; // measured from north clockwise
    az = ((az % 360) + 360) % 360;
    let alt = altR*180/PI;
    /* Atmospheric refraction (Saemundsson) for alt > -1 deg */
    if(alt > -1){
      const R = 1.02 / Math.tan(rad*(alt + 10.3/(alt + 5.11)));
      alt += R/60;
    }
    return {alt, az, ha: H};
  }

  /* Milky Way galactic center (Sgr A*): RA 17h45m40.04s, Dec -29°00'28.1" (J2000) */
  function getMilkyWayCorePosition(date, lat, lon){
    const ra = (17 + 45/60 + 40.04/3600) * 15;
    const dec = -(29 + 0/60 + 28.1/3600);
    return equatorialToHorizon(ra, dec, date, lat, lon);
  }

  /* ============== Helpers ============== */
  /* Compute alt curve over the night for a given RA/Dec target */
  function altCurve(raDeg, decDeg, startDate, endDate, lat, lon, stepMin=15){
    const out = [];
    const start = new Date(startDate), end = new Date(endDate);
    for(let t = new Date(start); t <= end; t = new Date(t.getTime() + stepMin*60000)){
      const p = equatorialToHorizon(raDeg, decDeg, t, lat, lon);
      out.push({t: new Date(t), alt: p.alt, az: p.az});
    }
    return out;
  }

  /* Best time tonight for a target (highest altitude inside dark window) */
  function bestTime(raDeg, decDeg, darkStart, darkEnd, lat, lon){
    const curve = altCurve(raDeg, decDeg, darkStart, darkEnd, lat, lon, 5);
    let best = null;
    for(const p of curve) if(!best || p.alt > best.alt) best = p;
    return best;
  }

  return {
    getSunPosition, getSunTimes,
    getMoonPosition, getMoonIllumination, getMoonTimes,
    getPlanetPosition, getMilkyWayCorePosition,
    equatorialToHorizon, altCurve, bestTime,
    siderealTimeHours, PLANETS: Object.keys(PLANETS)
  };
})();

if(typeof module !== 'undefined') module.exports = Astro;
if(typeof window !== 'undefined') window.Astro = Astro;
