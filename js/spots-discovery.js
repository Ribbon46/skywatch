/* spots-discovery.js
 * Dynamically discover candidate observing spots near a site by querying
 * OpenStreetMap (via the public Overpass API). Estimate Bortle from the
 * surrounding populated-place density and cache results in localStorage so
 * we don't hammer Overpass on every page load.
 *
 *   const r = await SpotsDiscovery.forSite(site);
 *   // r.spots is an array shaped like data/planner-spots.json entries
 *   // r.fromCache tells you if it came from localStorage
 *   // r.t is the fetch timestamp
 *
 * No API key. CORS-enabled. Free. Overpass is rate-limited and shared, so
 * we keep the bbox small (~200 km) and the cache TTL long (30 days).
 */

const SpotsDiscovery = (() => {

  const OVERPASS = 'https://overpass-api.de/api/interpreter';
  const TTL_MS = 30 * 24 * 60 * 60 * 1000; /* 30 days */
  const RADIUS_KM = 220;
  const MIN_PEAK_ELEV = 1100;
  const MAX_PEAKS = 60;
  const MAX_VIEWPOINTS = 40;
  const MAX_KEPT = 40;

  function cacheKey(site){ return 'astroapp.spots.discovered.' + site.id; }

  function getCached(site){
    try {
      const raw = localStorage.getItem(cacheKey(site));
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || !Array.isArray(obj.spots)) return null;
      return obj;
    } catch (_) { return null; }
  }

  function setCached(site, spots){
    try {
      localStorage.setItem(cacheKey(site), JSON.stringify({
        t: Date.now(),
        siteLat: site.lat, siteLon: site.lon,
        spots
      }));
    } catch (_) { /* quota — silent */ }
  }

  function clearCache(site){
    try { localStorage.removeItem(cacheKey(site)); } catch (_) {}
  }

  function isStale(cached, ttlMs = TTL_MS){
    if (!cached) return true;
    if ((Date.now() - cached.t) > ttlMs) return true;
    return false;
  }

  /* Approx-bounding-box for a great-circle radius — fine at small scales. */
  function bbox(lat, lon, radiusKm){
    const dLat = radiusKm / 111;
    const dLon = radiusKm / (111 * Math.cos(lat * Math.PI/180));
    return {
      south: lat - dLat, north: lat + dLat,
      west:  lon - dLon, east:  lon + dLon
    };
  }

  function haversine(a, b){
    const R = 6371;
    const phi1 = a.lat*Math.PI/180, phi2 = b.lat*Math.PI/180;
    const dphi = (b.lat-a.lat)*Math.PI/180;
    const dlam = (b.lon-a.lon)*Math.PI/180;
    const x = Math.sin(dphi/2)**2 + Math.cos(phi1)*Math.cos(phi2)*Math.sin(dlam/2)**2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  /* Three small Overpass queries are cheaper for the public server than one
   * giant union query. Each runs in series with a small delay. */
  async function _overpass(query){
    const r = await fetch(OVERPASS, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: 'data=' + encodeURIComponent(query)
    });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      throw new Error('Overpass ' + r.status + (body ? ': ' + body.slice(0, 80) : ''));
    }
    return r.json();
  }

  async function _peaks(box){
    const q = `[out:json][timeout:25];
      node["natural"="peak"]["ele"](${box.south},${box.west},${box.north},${box.east});
      out ${MAX_PEAKS};`;
    const j = await _overpass(q);
    return (j.elements || []).map(e => ({
      kind: 'peak',
      lat: e.lat, lon: e.lon,
      name: e.tags?.name || ('Peak ' + e.id),
      elevation: parseInt(e.tags?.ele, 10) || null,
      tags: e.tags || {}
    })).filter(p => p.elevation == null || p.elevation >= MIN_PEAK_ELEV);
  }

  async function _viewpoints(box){
    const q = `[out:json][timeout:25];
      node["tourism"="viewpoint"](${box.south},${box.west},${box.north},${box.east});
      out ${MAX_VIEWPOINTS};`;
    const j = await _overpass(q);
    return (j.elements || []).map(e => ({
      kind: 'viewpoint',
      lat: e.lat, lon: e.lon,
      name: e.tags?.name || 'Scenic viewpoint',
      elevation: parseInt(e.tags?.ele, 10) || null,
      tags: e.tags || {}
    }));
  }

  async function _populated(box){
    const q = `[out:json][timeout:25];
      node["place"~"city|town"]["population"](${box.south},${box.west},${box.north},${box.east});
      out;`;
    const j = await _overpass(q);
    return (j.elements || []).map(e => ({
      lat: e.lat, lon: e.lon,
      name: e.tags?.name || '',
      population: parseInt((e.tags?.population || '').replace(/[^0-9]/g, ''), 10) || 0,
      place: e.tags?.place
    })).filter(p => p.population > 0);
  }

  /* Rough Bortle from distance to nearest big/medium town. Calibrated against
   * common Carpathian baseline: 250k+ city is "city sky" zone for ~30 km;
   * 50k town pushes B6 out to ~10 km; deep wilderness is B2-3. */
  function _bortleEstimate(spot, populated){
    let nearestBig = Infinity, nearestMed = Infinity, nearestAny = Infinity;
    for (const p of populated) {
      const d = haversine(spot, p);
      if (d < nearestAny) nearestAny = d;
      if (p.population >= 100000 && d < nearestBig) nearestBig = d;
      if (p.population >= 20000  && d < nearestMed) nearestMed = d;
    }
    let bortle;
    if      (nearestBig > 120 && nearestMed > 40) bortle = 2;
    else if (nearestBig >  80 && nearestMed > 25) bortle = 3;
    else if (nearestBig >  50 && nearestMed > 15) bortle = 4;
    else if (nearestBig >  25 && nearestMed >  8) bortle = 5;
    else if (nearestBig >  10)                    bortle = 6;
    else if (nearestBig >   3)                    bortle = 7;
    else                                          bortle = 8;
    /* Altitude bump: above 1500 m is usually 0.5 step better — round down */
    if (spot.elevation && spot.elevation >= 1500 && bortle > 2) bortle -= 1;
    return bortle;
  }

  function _slug(s){
    return 'osm-' + String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function _accessibility(spot){
    if (spot.kind === 'peak' && (spot.elevation || 0) >= 1800) return 'hard';
    if (spot.kind === 'peak') return 'medium';
    if (spot.tags?.access === 'no' || spot.tags?.access === 'private') return 'restricted';
    return 'medium';
  }

  function _bestFor(bortle, spot){
    const out = [];
    if (bortle <= 3) out.push('narrowband DSO', 'MW core');
    else if (bortle <= 5) out.push('MW core', 'tracked tele');
    else out.push('wide-field MW', 'moon');
    if (spot.elevation && spot.elevation > 1500) out.push('zenith tracked');
    return out;
  }

  function _hazards(spot, bortle){
    const out = [];
    if (spot.kind === 'peak') {
      out.push('wildlife');
      if ((spot.elevation || 0) > 1500) out.push('weather changes');
      out.push('reach by daylight');
    }
    if (bortle <= 3) out.push('no facilities');
    return out;
  }

  function _facilities(spot){
    const t = spot.tags || {};
    const out = [];
    if (t.tourism === 'viewpoint') out.push('viewpoint');
    if (t.parking || spot.kind === 'viewpoint') out.push('parking nearby');
    return out;
  }

  /* Dedupe spots within ~1.5 km of each other (or curated entries) */
  function _dedupe(list, minKm = 1.5){
    const out = [];
    for (const s of list) {
      if (out.some(o => haversine(s, o) < minKm)) continue;
      out.push(s);
    }
    return out;
  }

  /* Convert an OSM raw spot into the planner spot shape used by Planner.js. */
  function _toSpot(raw, populated, fromSite){
    const bortle = _bortleEstimate(raw, populated);
    const id = _slug(raw.name + '-' + raw.lat.toFixed(3) + raw.lon.toFixed(3));
    const km = haversine(fromSite, raw);
    return {
      id,
      name: raw.name,
      region: raw.tags?.['addr:state'] || raw.tags?.is_in || 'discovered',
      country: 'OSM',
      lat: raw.lat, lon: raw.lon,
      elevation: raw.elevation || 0,
      bortle,
      type: raw.kind === 'peak' ? 'mountain-summit' : 'scenic-viewpoint',
      accessibility: _accessibility(raw),
      facilities: _facilities(raw),
      hazards: _hazards(raw, bortle),
      bestFor: _bestFor(bortle, raw),
      notes: raw.kind === 'peak'
        ? `OpenStreetMap peak ${raw.elevation ? '('+raw.elevation+' m) ' : ''}near ${raw.name}. Verify access by daylight first.`
        : `Tagged viewpoint in OpenStreetMap. Approach by daylight, check road conditions in winter.`,
      source: 'osm',
      discoveredAt: new Date().toISOString(),
      _distanceKm: km
    };
  }

  async function fetchForSite(site, opts = {}){
    const onProgress = opts.onProgress || (() => {});
    const radius = opts.radiusKm || RADIUS_KM;
    const box = bbox(site.lat, site.lon, radius);

    onProgress({stage: 'peaks',      pct: 5});
    const peaks = await _peaks(box);
    onProgress({stage: 'viewpoints', pct: 35});
    const views = await _viewpoints(box);
    onProgress({stage: 'populated',  pct: 65});
    const pop = await _populated(box);
    onProgress({stage: 'scoring',    pct: 85});

    /* Filter to the actual radius (the bbox is a square, not a circle) */
    const candidates = [...peaks, ...views]
      .filter(c => haversine(site, c) <= radius);

    /* Map to spot shape, score, sort by (low bortle, low distance) */
    const spots = candidates.map(c => _toSpot(c, pop, site));
    /* Dedupe within OSM results */
    const deduped = _dedupe(spots);
    /* Rank: prefer dark + reasonably close */
    deduped.sort((a, b) => {
      const ka = a.bortle * 30 + a._distanceKm * 0.4;
      const kb = b.bortle * 30 + b._distanceKm * 0.4;
      return ka - kb;
    });
    const kept = deduped.slice(0, MAX_KEPT);
    onProgress({stage: 'done', pct: 100});
    return kept;
  }

  async function forSite(site, opts = {}){
    const cached = getCached(site);
    if (cached && !opts.force && !isStale(cached, opts.ttl)) {
      return {spots: cached.spots, fromCache: true, t: cached.t};
    }
    const spots = await fetchForSite(site, opts);
    setCached(site, spots);
    return {spots, fromCache: false, t: Date.now()};
  }

  function merge(curated, discovered, minKm = 2.5){
    /* Tag origin so the UI can show a badge */
    const c = curated.map(s => ({...s, source: s.source || 'curated'}));
    const d = (discovered || []).map(s => ({...s, source: s.source || 'osm'}));
    /* Drop discovered entries that collide with curated ones */
    const filtered = d.filter(ds => !c.some(cs => haversine(cs, ds) < minKm));
    return [...c, ...filtered];
  }

  return {
    forSite, fetchForSite, getCached, setCached, clearCache, isStale,
    merge, TTL_MS, RADIUS_KM
  };
})();

if (typeof module !== 'undefined') module.exports = SpotsDiscovery;
if (typeof window !== 'undefined') window.SpotsDiscovery = SpotsDiscovery;
