/* planner.js
 * Recommend observing spots from a curated catalogue, ranked into tiers by
 * distance from the active site. Each tier balances how far you'd drive vs.
 * how dark the sky is when you get there.
 *
 *   Local       ≤  30 km   (quick-hit / weeknight)
 *   Mid          30–100 km (weekend escape)
 *   Far         100–300 km (planned trip)
 *   Expedition  > 300 km   (multi-day, rare clear sky needed)
 */

const Planner = (() => {

  const TIERS = [
    {key:'local', label:'Close to home',  sub:'≤30 km — quick weeknight',  maxKm: 30,  color:'acc'},
    {key:'mid',   label:'Weekend drive',  sub:'30–100 km — better skies',  maxKm: 100, color:'vio'},
    {key:'far',   label:'Day trip',       sub:'100–300 km — real darkness', maxKm: 300, color:'warn'},
    {key:'exp',   label:'Expedition',     sub:'>300 km — once a season',    maxKm: Infinity, color:'gold'}
  ];

  /* Spot data is injected from window.PLANNER_SPOTS_DATA at load time */
  let _spots = [];
  function setSpots(arr){ _spots = Array.isArray(arr) ? arr : []; }
  function spots(){ return _spots; }

  /* Score: lower is better. Heavy weight on Bortle improvement vs the active
   * site, light weight on distance — driving 60 min to drop from B6 to B4 is
   * a much better deal than 10 min to drop from B6 to B5. */
  function rank(spot, fromSite, distKm) {
    const bortleDelta = Math.max(0, (fromSite.bortle || 8) - spot.bortle);
    /* Subtract 7×bortleDelta (a 3-step drop is worth ~20 km of penalty),
     * add log-driveTime so close-and-dark wins. */
    return distKm * 0.6 - bortleDelta * 8 - (spot.elevation > 1000 ? 4 : 0);
  }

  function driveMinutes(km){
    /* Crude — assumes 70 km/h average including stops. Real driving will vary. */
    return Math.round(km / 70 * 60);
  }

  function recommend(fromSite, geo){
    if (!fromSite || !_spots.length) return [];
    const tiers = TIERS.map(t => ({...t, spots: []}));
    for (const s of _spots) {
      if (!geo) continue;
      const km = geo.distanceKm(fromSite, s);
      const tier = tiers.find(t => km <= t.maxKm);
      if (!tier) continue;
      tier.spots.push({
        ...s,
        distanceKm: km,
        driveMin: driveMinutes(km),
        bortleDelta: (fromSite.bortle || 8) - s.bortle,
        _rank: rank(s, fromSite, km)
      });
    }
    /* Sort each tier by rank (best first), keep top 5 per tier */
    for (const t of tiers) {
      t.spots.sort((a, b) => a._rank - b._rank);
      t.spots = t.spots.slice(0, 6);
    }
    return tiers.filter(t => t.spots.length > 0);
  }

  function bestSpot(fromSite, geo){
    const tiers = recommend(fromSite, geo);
    /* Pick the highest-ranked spot across all tiers (lowest score = best) */
    const all = tiers.flatMap(t => t.spots);
    all.sort((a, b) => a._rank - b._rank);
    return all[0] || null;
  }

  function mapsUrl(spot){
    return `https://www.google.com/maps?q=${spot.lat},${spot.lon}`;
  }
  function lightPollutionUrl(spot){
    return `https://www.lightpollutionmap.info/#zoom=10&lat=${spot.lat}&lon=${spot.lon}&layers=B0FFFFFFTFFFFFFFFFFF`;
  }

  return { TIERS, setSpots, spots, recommend, bestSpot, driveMinutes, mapsUrl, lightPollutionUrl };
})();

if (typeof module !== 'undefined') module.exports = Planner;
if (typeof window !== 'undefined') window.Planner = Planner;
