/* sites.js
 * Saved observing sites: GPS + LocalStorage-backed list with custom Bortle ratings.
 * Each site: {id, name, lat, lon, elevation, bortle, notes, createdAt}.
 *
 * Bortle scale (very brief):
 *  1: excellent dark / 21.99 mag/arcsec², SQM > 21.8 — Milky Way casts shadows
 *  2: typical truly dark
 *  3: rural sky — light pollution on horizon
 *  4: rural/suburban transition
 *  5: suburban sky — Milky Way weak, M31 visible
 *  6: bright suburban — only stronger Messier objects naked-eye
 *  7: suburb/urban transition — washed-out sky
 *  8: city sky — only brightest stars visible
 *  9: inner-city — moon and planets only
 */

const Sites = (() => {
  const KEY = 'astroapp.sites.v1';
  const ACTIVE_KEY = 'astroapp.activeSite.v1';

  function _load(){
    try {
      const raw = localStorage.getItem(KEY);
      const arr = raw ? JSON.parse(raw) : [];
      if(arr.length === 0) return _seed();
      return arr;
    } catch(_){ return _seed(); }
  }
  function _seed(){
    const seed = [
      {id:'home-bucharest', name:'Home — Bucharest', lat:44.4268, lon:26.1025,
       elevation:70, bortle:8, notes:'Default city site.', createdAt:new Date().toISOString()}
    ];
    _save(seed);
    return seed;
  }
  function _save(arr){
    try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch(e) {}
  }

  function list(){ return _load(); }

  function get(id){
    return _load().find(s => s.id === id) || null;
  }

  function active(){
    const id = localStorage.getItem(ACTIVE_KEY) || _load()[0]?.id;
    return get(id) || _load()[0];
  }

  function setActive(id){
    if(get(id)) localStorage.setItem(ACTIVE_KEY, id);
  }

  function save(site){
    const arr = _load();
    if(!site.id) site.id = (site.name || 'site').toLowerCase().replace(/[^a-z0-9]+/g,'-') + '-' + Date.now();
    if(!site.createdAt) site.createdAt = new Date().toISOString();
    const idx = arr.findIndex(s => s.id === site.id);
    if(idx >= 0) arr[idx] = site; else arr.push(site);
    _save(arr);
    return site;
  }

  function remove(id){
    const arr = _load().filter(s => s.id !== id);
    _save(arr);
    if(localStorage.getItem(ACTIVE_KEY) === id) localStorage.removeItem(ACTIVE_KEY);
  }

  /* Browser geolocation — returns Promise<{lat,lon,elevation}> */
  function geolocate(opts={}){
    return new Promise((resolve, reject) => {
      if(!navigator.geolocation) return reject(new Error('Geolocation not supported'));
      navigator.geolocation.getCurrentPosition(
        pos => resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          elevation: pos.coords.altitude || 0,
          accuracy: pos.coords.accuracy
        }),
        err => reject(err),
        Object.assign({enableHighAccuracy:true, timeout:10000, maximumAge:600000}, opts)
      );
    });
  }

  /* Haversine distance in km between two lat/lon pairs */
  function distanceKm(a, b){
    const R = 6371;
    const φ1 = a.lat*Math.PI/180, φ2 = b.lat*Math.PI/180;
    const Δφ = (b.lat-a.lat)*Math.PI/180;
    const Δλ = (b.lon-a.lon)*Math.PI/180;
    const x = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
    return 2*R*Math.asin(Math.sqrt(x));
  }

  function bortleLabel(b){
    return ['','Class 1 — Excellent dark','Class 2 — Typical dark','Class 3 — Rural',
            'Class 4 — Rural/suburban','Class 5 — Suburban','Class 6 — Bright suburban',
            'Class 7 — Suburb/urban','Class 8 — City','Class 9 — Inner city'][b] || '—';
  }

  function bortleSQM(b){
    /* Approx SQM (mag/arcsec²) midpoint per Bortle class */
    return [0, 22.0, 21.7, 21.5, 21.3, 21.0, 20.5, 19.5, 18.5, 17.5][b] ?? null;
  }

  /* Build a Google Maps URL for opening directions to a site */
  function mapsUrl(site){
    return `https://www.google.com/maps?q=${site.lat},${site.lon}`;
  }

  function lightPollutionMapUrl(lat, lon){
    return `https://www.lightpollutionmap.info/#zoom=10&lat=${lat}&lon=${lon}&layers=B0FFFFFFTFFFFFFFFFFF`;
  }

  return {list, get, active, setActive, save, remove, geolocate,
          distanceKm, bortleLabel, bortleSQM, mapsUrl, lightPollutionMapUrl};
})();

if(typeof module !== 'undefined') module.exports = Sites;
if(typeof window !== 'undefined') window.Sites = Sites;
