/* log.js
 * Session journal — LocalStorage-backed observing log.
 * Each entry: {id, date, siteId, gear:{camera,lens}, targets:[], conditions:{bortle,cloudPct,moonPct},
 *              shots:{frames, secondsEach, iso, aperture, focalMm}, notes, createdAt}
 */

const SessionLog = (() => {
  const KEY = 'astroapp.log.v1';

  function _load(){
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch(_){ return []; }
  }
  function _save(arr){
    try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch(_){}
  }

  function list(){
    return _load().sort((a,b) => new Date(b.date) - new Date(a.date));
  }

  function get(id){ return _load().find(e => e.id === id) || null; }

  function add(entry){
    const arr = _load();
    if(!entry.id) entry.id = 'log-' + Date.now() + '-' + Math.floor(Math.random()*1000);
    entry.createdAt = entry.createdAt || new Date().toISOString();
    if(!entry.date) entry.date = entry.createdAt.slice(0,10);
    arr.push(entry);
    _save(arr);
    return entry;
  }
  function update(id, patch){
    const arr = _load();
    const idx = arr.findIndex(e => e.id === id);
    if(idx < 0) return null;
    arr[idx] = {...arr[idx], ...patch};
    _save(arr);
    return arr[idx];
  }
  function remove(id){
    _save(_load().filter(e => e.id !== id));
  }

  /* Total integration time across all sessions for stats */
  function stats(){
    const arr = _load();
    let totalSec = 0, totalFrames = 0, sessions = arr.length;
    const targets = new Map();
    for(const e of arr){
      const f = e.shots?.frames || 0;
      const s = e.shots?.secondsEach || 0;
      totalFrames += f;
      totalSec += f*s;
      for(const t of e.targets || []){
        targets.set(t, (targets.get(t)||0) + 1);
      }
    }
    return {
      sessions, totalFrames, totalSec,
      totalHours: (totalSec/3600).toFixed(1),
      topTargets: [...targets.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10)
    };
  }

  function exportJson(){
    return JSON.stringify(_load(), null, 2);
  }
  function importJson(json){
    try {
      const arr = JSON.parse(json);
      if(!Array.isArray(arr)) throw new Error('not array');
      _save(arr);
      return arr.length;
    } catch(e){ throw new Error('Invalid JSON: ' + e.message); }
  }

  return {list, get, add, update, remove, stats, exportJson, importJson};
})();

if(typeof module !== 'undefined') module.exports = SessionLog;
if(typeof window !== 'undefined') window.SessionLog = SessionLog;
