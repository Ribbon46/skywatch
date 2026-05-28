/* app.js — main controller, hash router, all tab renderers */

const App = (() => {

  /* ============== State ============== */
  const state = {
    site: null,
    forecast: null,
    nights: null,
    messier: null,
    ngc: null,
    stars: null,
    cameras: null,
    lenses: null,
    targetFilter: 'all',
    targetSearch: '',
    smart: {
      cameraId: localStorage.getItem('astroapp.smart.cam')  || 'sony-a7iii',
      lensId:   localStorage.getItem('astroapp.smart.lens') || 'tamron-17-28',
      goal:     localStorage.getItem('astroapp.smart.goal') || 'milky-way',
      tracked:  localStorage.getItem('astroapp.smart.tracked') === '1'
    },
    autoRefreshHandle: null
  };

  /* ============== Utilities ============== */
  const $  = sel => document.querySelector(sel);
  const $$ = sel => document.querySelectorAll(sel);
  const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function fmtTime(d, tz){
    if(!d || isNaN(d)) return '—';
    return new Date(d).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit', timeZone: tz || siteTz()});
  }
  function fmtDate(d, tz){
    if(!d) return '—';
    return new Date(d).toLocaleDateString('en-GB',
      {weekday:'short', day:'numeric', month:'short', timeZone: tz || siteTz()});
  }
  function fmtDay(d, tz){
    if(!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', {weekday:'short', timeZone: tz || siteTz()});
  }
  function fmtDayNum(d, tz){
    if(!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', {day:'numeric', month:'short', timeZone: tz || siteTz()});
  }
  function fmtMin(m){ return m == null ? '—' : Math.round(m) + ' min'; }
  function fmtKm(km){ return km < 10 ? km.toFixed(1)+' km' : Math.round(km)+' km'; }
  function fmtDuration(m){
    if (m == null) return '—';
    const h = Math.floor(m/60), mm = Math.round(m%60);
    return h ? (h+'h '+mm+'m') : (mm+'m');
  }
  function siteTz(){
    if(!state.site) return 'UTC';
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  function toast(msg, kind='ok', ms=2400){
    const t = $('#toast');
    t.className = 'toast ' + kind;
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(t._h);
    t._h = setTimeout(()=>{ t.hidden = true; }, ms);
  }
  function cloudClass(c){
    if(c == null) return '';
    if(c <= 30) return 'go';
    if(c <= 60) return 'warn';
    return 'bad';
  }
  function compass(deg){
    const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    return dirs[Math.round(((deg%360)/22.5)) % 16];
  }

  async function fetchJson(url){
    const r = await fetch(url);
    if(!r.ok) throw new Error('HTTP '+r.status+' on '+url);
    return r.json();
  }

  /* ============== Data loading ============== */
  async function loadStaticData(){
    if(state.messier) return;
    const hasInline = window.MESSIER_DATA && window.NGC_DATA && window.STARS_DATA
                   && window.CAMERAS_DATA && window.LENSES_DATA;
    if(hasInline){
      state.messier = window.MESSIER_DATA;
      state.ngc     = window.NGC_DATA;
      state.stars   = window.STARS_DATA;
      state.cameras = window.CAMERAS_DATA;
      state.lenses  = window.LENSES_DATA;
    } else {
      const [messier, ngc, stars, cameras, lenses] = await Promise.all([
        fetchJson('data/messier.json'),
        fetchJson('data/ngc.json'),
        fetchJson('data/stars.json'),
        fetchJson('data/cameras.json'),
        fetchJson('data/lenses.json')
      ]);
      state.messier = messier; state.ngc = ngc; state.stars = stars;
      state.cameras = cameras; state.lenses = lenses;
    }
    if(window.METEOR_SHOWERS_DATA && typeof AstroCalendar.setShowers === 'function'){
      AstroCalendar.setShowers(window.METEOR_SHOWERS_DATA);
    } else {
      await AstroCalendar.loadShowers();
    }
    /* Seed planner */
    if (window.Planner && window.PLANNER_SPOTS_DATA) Planner.setSpots(window.PLANNER_SPOTS_DATA);
  }

  /* ============== Site management ============== */
  function setSite(site){
    state.site = site;
    Sites.setActive(site.id);
    $('#siteLabel').textContent = `${site.name} · B${site.bortle}`;
    refreshForecast();
  }

  function renderSiteList(){
    const list = Sites.list();
    const root = $('#siteList');
    root.innerHTML = list.map(s => `
      <div class="site-row${state.site && s.id===state.site.id ? ' active':''}">
        <div>
          <div><b>${escape(s.name)}</b> <span class="bortle">B${s.bortle}</span></div>
          <div class="lat">${s.lat.toFixed(4)}, ${s.lon.toFixed(4)} · ${s.elevation||0}m</div>
          ${s.notes ? `<div class="mut" style="font-size:12px;margin-top:3px">${escape(s.notes)}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:4px">
          <button class="btn primary" onclick="App.selectSite('${s.id}')">Use</button>
          ${s.id!=='home-bucharest' ? `<button class="btn ghost" onclick="App.deleteSite('${s.id}')">Delete</button>` : ''}
        </div>
      </div>
    `).join('') + `<div class="btn-row" style="margin-top:12px">
        <a class="btn ghost" href="#sites" onclick="document.getElementById('siteDlg').close()">Manage all sites →</a>
      </div>`;
  }

  function openSiteSwitcher(){ renderSiteList(); $('#siteDlg').showModal(); }
  function selectSite(id){
    const s = Sites.get(id);
    if(!s) return;
    setSite(s);
    $('#siteDlg').close();
    toast(`Switched to ${s.name}`);
  }
  function openSiteEditor(site){
    const f = $('#siteEditForm'); f.reset();
    if(site){
      f.id.value = site.id; f.name.value = site.name;
      f.bortle.value = site.bortle; f.lat.value = site.lat; f.lon.value = site.lon;
      f.elevation.value = site.elevation; f.notes.value = site.notes || '';
      $('#siteEditTitle').textContent = 'Edit site';
    } else {
      $('#siteEditTitle').textContent = 'Add site';
      f.lat.value = ''; f.lon.value = '';
    }
    $('#siteEditDlg').showModal();
  }
  function saveSite(ev){
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const site = {
      id: fd.get('id') || undefined,
      name: fd.get('name'),
      lat: parseFloat(fd.get('lat')),
      lon: parseFloat(fd.get('lon')),
      elevation: parseFloat(fd.get('elevation')) || 0,
      bortle: parseInt(fd.get('bortle'), 10),
      notes: fd.get('notes') || ''
    };
    const saved = Sites.save(site);
    $('#siteEditDlg').close();
    if(state.site && state.site.id === saved.id) setSite(saved);
    if(!state.site) setSite(saved);
    if($('#view-sites').children.length) viewSites();
    renderSiteList();
    toast(`Saved ${saved.name}`);
  }
  function deleteSite(id){
    if(!confirm('Delete this site?')) return;
    Sites.remove(id);
    if(state.site && state.site.id === id){
      const next = Sites.list()[0];
      if(next) setSite(next);
    }
    renderSiteList();
    if($('#view-sites').children.length) viewSites();
    toast('Site deleted');
  }
  async function useCurrentLocation(){
    try {
      toast('Locating…');
      const pos = await Sites.geolocate();
      const site = Sites.save({
        name: 'Current location',
        lat: pos.lat, lon: pos.lon,
        elevation: pos.elevation || 0,
        bortle: 8,
        notes: `GPS accuracy ${Math.round(pos.accuracy||0)}m`
      });
      setSite(site);
      $('#siteDlg').close();
      toast(`Got location: ${pos.lat.toFixed(3)}, ${pos.lon.toFixed(3)}`);
    } catch(e){
      toast('Location failed: ' + (e.message || e), 'bad', 4000);
    }
  }

  /* ============== Forecast lifecycle ============== */
  async function refreshForecast(){
    if(!state.site) return;
    const dot = $('#statusDot');
    dot.style.background = 'var(--mut)';
    try {
      const f = await Forecast.fetchForecast(state.site.lat, state.site.lon, {forecastDays: 14});
      state.forecast = f;
      state.nights = Forecast.evaluateAll(f, Astro, state.site.lat, state.site.lon);
      const summary = Forecast.summarize(state.nights);
      dot.style.background = summary.status==='GO' ? 'var(--ok)' : 'var(--bad)';
      try { localStorage.setItem('astroapp.lastForecast.'+state.site.id,
        JSON.stringify({t: Date.now(), f})); } catch(_){}
      router();
    } catch(e){
      console.error(e);
      dot.style.background = 'var(--warn)';
      try {
        const cached = JSON.parse(localStorage.getItem('astroapp.lastForecast.'+state.site.id));
        if(cached){
          state.forecast = cached.f;
          state.nights = Forecast.evaluateAll(cached.f, Astro, state.site.lat, state.site.lon);
          toast('Offline — using cached forecast from '+new Date(cached.t).toLocaleString(), 'bad', 4000);
          router();
          return;
        }
      } catch(_){}
      $('#view-tonight').innerHTML = `<div class="error">Could not load forecast: ${escape(e.message)}</div>`;
    }
  }

  /* ============== Tonight tab ============== */
  function viewTonight(){
    const root = $('#view-tonight');
    if(!state.nights){ root.innerHTML = '<div class="notice">Loading forecast…</div>'; return; }
    const summary = Forecast.summarize(state.nights);
    const target = summary.night || summary.best;
    const tz = siteTz();
    const now = new Date();

    /* Hero */
    let html = '';
    if (summary.status === 'GO' && target) {
      html += `<div class="hero go">
        <div class="eyebrow">Tonight</div>
        <h1 class="headline">Clear sky ahead</h1>
        <p class="sub">${target.darkStart > now
          ? `Astronomical dark begins <b>${fmtTime(target.darkStart, tz)}</b>.`
          : `You're in the dark window now — ends ${fmtTime(target.darkEnd, tz)}.`}
          Cloud peak ${target.cloudMax}%, moon ${Math.round(target.moonIllumPct)}%, usable dark ${fmtDuration(target.usableMin)}.</p>
        <div class="hero-cta">
          <a class="btn primary" href="#planner">Where to go →</a>
          <a class="btn" href="#gear">My settings</a>
        </div>
      </div>`;
    } else if (target) {
      html += `<div class="hero bad">
        <div class="eyebrow">No-go tonight</div>
        <h1 class="headline">${cloudStatusHeadline(target)}</h1>
        <p class="sub">No qualifying night in the next ${state.nights.length} days.
          Closest chance is <b>${fmtDate(target.darkStart, tz)}</b> — moon ${Math.round(target.moonIllumPct)}%, cloud max ${target.cloudMax}%, usable dark ${fmtDuration(target.usableMin)}.</p>
        <div class="hero-cta">
          <a class="btn" href="#planner">Plan ahead anyway →</a>
        </div>
      </div>`;
    } else {
      html += `<div class="hero"><div class="eyebrow">No data</div>
        <h1 class="headline">No forecast yet</h1>
        <p class="sub">Check your connection or pick a site.</p></div>`;
    }

    /* Key stats for the target night */
    if (target) {
      html += `<div class="section"><h2>Key facts <small>${fmtDate(target.darkStart, tz)}</small></h2>
        ${statTiles(target)}
      </div>`;
    }

    /* Hourly strip for the target night */
    if (target && target.hours && target.hours.length) {
      html += `<div class="section"><h2>Hour-by-hour cloud <span class="right">${fmtTime(target.darkStart, tz)} → ${fmtTime(target.darkEnd, tz)}</span></h2>
        <div class="card flat">
          <div class="hourly">${target.hours.map(h => {
            const isNow = (h.t.getTime() <= now.getTime() && now.getTime() < h.t.getTime() + 3600000);
            return `<div class="h ${cloudClass(h.cloud)}${isNow?' now':''}"><b>${fmtTime(h.t, tz)}</b>${h.cloud!=null ? h.cloud+'%' : '—'}</div>`;
          }).join('')}</div>
          <div class="legend"><span>≤30% clear</span><span class="l2">31–60% partial</span><span class="l3">&gt;60% overcast</span></div>
        </div>
      </div>`;
    }

    /* Active meteor showers */
    try {
      const active = AstroCalendar.showerStatus(now.getFullYear(), now).filter(s => s.active);
      if (active.length) {
        html += `<div class="section"><h2>Active meteor showers <a href="#calendar" class="right">All events →</a></h2>
          ${active.slice(0,3).map(s => `<div class="card"><div class="row">
            <b>${escape(s.shower.name)}</b>
            <span class="chip ok">active</span>
            <span class="mut" style="margin-left:auto">ZHR ~${s.shower.zhr}</span>
          </div>
          <div class="mut" style="font-size:12.5px;margin-top:4px">${escape(s.shower.notes||'')}</div>
        </div>`).join('')}
        </div>`;
      }
    } catch(_){}

    /* Visible right now: a few good DSO ideas above 30° */
    if (state.site && state.messier) {
      const visibleNow = [
        ...state.messier.map(t=>({...t,catalog:'M'})),
        ...state.ngc.map(t=>({...t,catalog:'NGC'}))
      ].map(t => {
        const p = Astro.equatorialToHorizon(t.ra, t.dec, now, state.site.lat, state.site.lon);
        return {...t, alt: p.alt, az: p.az};
      }).filter(t => t.alt > 40 && t.mag <= 8.5)
        .sort((a,b)=> b.alt - a.alt).slice(0, 5);
      if (visibleNow.length) {
        html += `<div class="section"><h2>Up right now <a href="#targets" class="right">All targets →</a></h2>
          ${visibleNow.map(t => `<div class="target up">
            <div>
              <div><span class="id">${escape(t.id)}</span> <span class="meta">${escape(t.name||'')}</span></div>
              <div class="meta">${t.type} · ${t.con} · mag ${t.mag}</div>
            </div>
            <div class="alt"><b>+${t.alt.toFixed(0)}°</b>${compass(t.az)}</div>
          </div>`).join('')}
        </div>`;
      }
    }

    /* Coming nights — compact list */
    html += `<div class="section"><h2>Coming nights <small>${state.nights.length} days</small></h2>
      <div class="night-list">
        ${state.nights.map((n, idx) => nightRow(n, idx===0, tz)).join('')}
      </div>
      <div class="legend" style="justify-content:center;margin-top:10px">
        <span>cloud ≤30%</span><span class="l2">30–60%</span><span class="l3">&gt;60%</span>
      </div>
    </div>`;

    /* Footer */
    html += `<div class="card mut" style="text-align:center;font-size:12px">
      <div>Forecast from Open-Meteo · refreshes every 30 min · last fetch ${new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div>
      <div class="btn-row" style="justify-content:center">
        <button class="btn ghost" onclick="App.refreshForecast()">↻ Refresh now</button>
      </div>
    </div>`;

    root.innerHTML = html;
  }

  function cloudStatusHeadline(n){
    if (!n.cloudOk && !n.moonOk) return 'Cloudy and bright moon';
    if (!n.cloudOk) return 'Too cloudy';
    if (!n.moonOk)  return 'Moon too bright';
    if (!n.intervalOk) return 'Dark window too short';
    return 'No qualifying night';
  }

  function statTiles(n){
    const cloudClassN = (n.cloudMax==null) ? '' : (n.cloudMax <= 30 ? 'ok' : (n.cloudMax <= 60 ? 'warn' : 'bad'));
    const moonClassN  = (n.moonIllumPct <= 40) ? 'ok' : (n.moonIllumPct <= 70 ? 'warn' : 'bad');
    const darkClassN  = (n.usableMin >= 180) ? 'ok' : (n.usableMin >= 90 ? 'warn' : 'bad');
    const windClassN  = (n.windAvg==null) ? '' : (n.windAvg < 15 ? 'ok' : (n.windAvg < 25 ? 'warn' : 'bad'));
    return `<div class="stat-grid four">
      <div class="stat ${cloudClassN}">
        <div class="lab">Cloud peak</div>
        <div class="val">${n.cloudMax==null?'—':n.cloudMax+'%'}</div>
        <div class="sub">avg ${n.cloudAvg==null?'—':n.cloudAvg.toFixed(0)+'%'}</div>
      </div>
      <div class="stat ${moonClassN}">
        <div class="lab">Moon</div>
        <div class="val">${Math.round(n.moonIllumPct)}%</div>
        <div class="sub">${n.moonUpAtStart?'up at dark':'down at dark'}</div>
      </div>
      <div class="stat ${darkClassN}">
        <div class="lab">Usable dark</div>
        <div class="val">${fmtDuration(n.usableMin)}</div>
        <div class="sub">of ${fmtDuration(n.durationMin)} total</div>
      </div>
      <div class="stat ${windClassN}">
        <div class="lab">Wind</div>
        <div class="val">${n.windAvg==null?'—':Math.round(n.windAvg)+' km/h'}</div>
        <div class="sub">${n.dewRisk?'dew likely':'low dew risk'}</div>
      </div>
    </div>`;
  }

  function nightRow(n, isTonight, tz){
    const cloudIcon = n.cloudMax == null ? '—' : (n.cloudMax <= 30 ? '☀' : (n.cloudMax <= 60 ? '⛅' : '☁'));
    const moonIcon  = n.moonIllumPct < 5 ? '🌑' : n.moonIllumPct < 30 ? '🌒' : n.moonIllumPct < 55 ? '🌓' : n.moonIllumPct < 80 ? '🌔' : '🌕';
    const hourly = n.hours.map(h => `<div class="h ${cloudClass(h.cloud)}"><b>${fmtTime(h.t, tz)}</b>${h.cloud!=null ? h.cloud+'%' : '—'}</div>`).join('');
    return `<div class="night ${n.qualifies?'qualify':''} ${isTonight?'tonight':''}">
      <div class="nd-day">${fmtDay(n.darkStart, tz)}<small>${fmtDayNum(n.darkStart, tz)}</small></div>
      <div class="nd-mid">
        ${cloudIcon} <b>${n.cloudMax==null?'—':n.cloudMax+'%'}</b> cloud
        <span class="sep">·</span> ${moonIcon} <b>${Math.round(n.moonIllumPct)}%</b> moon
        <span class="sep">·</span> <b>${fmtDuration(n.usableMin)}</b> usable
      </div>
      <div class="nd-end">
        <span class="badge">${n.qualifies?'GO':'skip'}</span>
      </div>
      <details>
        <summary>Hourly · dark ${fmtTime(n.darkStart, tz)}–${fmtTime(n.darkEnd, tz)}</summary>
        <div class="hourly" style="margin-top:8px">${hourly}</div>
      </details>
    </div>`;
  }

  /* ============== Planner tab ============== */
  /* Discovery state lives on App for inspection in DevTools */
  const _discovery = {busy: false, fromCache: null, t: null};

  function viewPlanner(){
    const root = $('#view-planner');
    if(!state.site){ root.innerHTML = '<div class="notice">Pick a site first.</div>'; return; }
    if(!window.Planner || !window.PLANNER_SPOTS_DATA){
      root.innerHTML = '<div class="empty">Planner data not loaded.</div>'; return;
    }

    /* Pull cached discovered spots (sync read, no network) */
    let discovered = [];
    let cached = null;
    if (window.SpotsDiscovery) {
      cached = SpotsDiscovery.getCached(state.site);
      if (cached) discovered = cached.spots || [];
    }

    /* Merge curated with discovered, dedupe by ~2.5 km proximity */
    const allSpots = window.SpotsDiscovery
      ? SpotsDiscovery.merge(window.PLANNER_SPOTS_DATA, discovered)
      : window.PLANNER_SPOTS_DATA;
    /* Hand merged list to Planner for tiering */
    Planner.setSpots(allSpots);

    const tiers = Planner.recommend(state.site, {distanceKm: Sites.distanceKm});
    const best  = Planner.bestSpot(state.site, {distanceKm: Sites.distanceKm});

    let html = '';
    if (best) {
      const km = Sites.distanceKm(state.site, best);
      html += `<div class="hero">
        <div class="eyebrow">Top pick from ${escape(state.site.name)}</div>
        <h1 class="headline">${escape(best.name)}</h1>
        <p class="sub">${fmtKm(km)} away · ~${Planner.driveMinutes(km)} min drive · Bortle ${best.bortle}${best.bortleDelta ? ` (you save ${best.bortleDelta} steps)` : ''}</p>
        <div class="hero-cta">
          <a class="btn primary" href="${Planner.mapsUrl(best)}" target="_blank">Open in Maps →</a>
          <button class="btn" onclick="App.saveSpotAsSite('${best.id}')">Save as site</button>
        </div>
      </div>`;
    }

    /* Discovery toolbar — different state depending on busy / cached / first-run */
    const curatedCount = window.PLANNER_SPOTS_DATA.length;
    const discoveredCount = discovered.length;
    html += `<div class="card flat" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;font-size:12.5px">
      <span class="lab">Catalogue</span>
      <span>${curatedCount} curated${discoveredCount ? ` <span class="chip acc">+${discoveredCount} from OpenStreetMap</span>` : ''}</span>
      <span class="mut" style="margin-left:auto">${cached ? 'Updated ' + _agoLabel(cached.t) : 'Discovery not run yet for this site.'}</span>
      <button class="btn ghost" id="discBtn" ${_discovery.busy ? 'disabled' : ''}>
        ${_discovery.busy ? 'Searching…' : (cached ? '↻ Refresh' : '🛰 Discover near ' + escape(state.site.name))}
      </button>
    </div>`;
    if (_discovery.busy) {
      html += `<div class="card flat" style="padding:10px 14px;margin-top:6px">
        <div class="lab" id="discStage">connecting…</div>
        <div class="meter"><div id="discBar" style="width:5%"></div></div>
      </div>`;
    }

    if (!tiers.length) {
      html += '<div class="empty">No catalogued spots within range. Run discovery, or add a custom site.</div>';
    } else {
      for (const t of tiers) {
        html += `<div class="tier t-${t.key}"><h2>${t.label}</h2><div class="sub">${t.sub} · ${t.spots.length} spot${t.spots.length===1?'':'s'}</div></div>`;
        for (const s of t.spots) html += spotCard(s);
      }
    }

    html += `<div class="card mut" style="font-size:12px;margin-top:14px;line-height:1.6">
      <div>Curated spots ship inside the app (<code>data/planner-spots.json</code>). Discovered spots come from <a href="https://www.openstreetmap.org/" target="_blank">OpenStreetMap</a> via the public Overpass API and are cached in your browser for 30 days.</div>
    </div>`;

    root.innerHTML = html;
    const btn = $('#discBtn');
    if (btn) btn.addEventListener('click', () => discoverSpots(state.site));
  }

  function _agoLabel(t){
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + ' min ago';
    const h = Math.round(m/60);
    if (h < 24) return h + ' h ago';
    const d = Math.round(h/24);
    return d + ' d ago';
  }

  async function discoverSpots(site){
    if (!window.SpotsDiscovery) return toast('Discovery module not loaded', 'bad');
    if (_discovery.busy) return;
    _discovery.busy = true;
    viewPlanner();
    try {
      const r = await SpotsDiscovery.forSite(site, {
        force: true,
        onProgress: ({stage, pct}) => {
          const s = $('#discStage'); const b = $('#discBar');
          if (s) s.textContent = stage + '…';
          if (b) b.style.width = pct + '%';
        }
      });
      _discovery.fromCache = false; _discovery.t = r.t;
      toast(`Found ${r.spots.length} new candidates from OSM`);
    } catch (e) {
      toast('Discovery failed: ' + e.message, 'bad', 4000);
    } finally {
      _discovery.busy = false;
      viewPlanner();
    }
  }

  function spotCard(s){
    const hazards = (s.hazards || []).map(h => `<span class="chip warn">${escape(h)}</span>`).join('');
    const facilities = (s.facilities || []).map(f => `<span class="chip">${escape(f)}</span>`).join('');
    const best = (s.bestFor || []).map(b => `<span class="chip acc">${escape(b)}</span>`).join('');
    const sourceChip = s.source === 'osm'
      ? '<span class="chip" title="Discovered via OpenStreetMap" style="font-size:10px;letter-spacing:.4px">OSM</span>'
      : '';
    return `<div class="spot">
      <div class="top">
        <b>${escape(s.name)}</b>
        <span class="badge b${s.bortle}">Bortle ${s.bortle}${s.source==='osm'?'~':''}</span>
        ${sourceChip}
        <span class="mut" style="margin-left:auto;font-size:12px">${fmtKm(s.distanceKm)} · ~${s.driveMin} min</span>
      </div>
      <div class="meta">${escape(s.region||'—')} · ${escape(s.type||'—')} · ${s.elevation||0} m elev · ${escape(s.accessibility||'—')} access</div>
      <div class="notes">${escape(s.notes||'')}</div>
      <div class="extras">${best}${facilities}${hazards}</div>
      <div class="actions">
        <a class="btn primary" href="${Planner.mapsUrl(s)}" target="_blank">Maps</a>
        <a class="btn ghost" href="${Planner.lightPollutionUrl(s)}" target="_blank">Lt. pollution</a>
        <button class="btn" onclick="App.saveSpotAsSite('${s.id}')">Save as site</button>
      </div>
    </div>`;
  }

  function saveSpotAsSite(id){
    /* Look in merged catalogue — Planner.spots() reflects whatever was last set */
    const all = (window.Planner && Planner.spots()) || (window.PLANNER_SPOTS_DATA || []);
    const s = all.find(x => x.id === id);
    if (!s) return toast('Spot not found', 'bad');
    const site = Sites.save({
      name: s.name, lat: s.lat, lon: s.lon, elevation: s.elevation || 0,
      bortle: s.bortle, notes: `Bortle ${s.bortle} · ${s.region || (s.source==='osm'?'OSM-discovered':'curated')}`
    });
    toast(`Added ${s.name} to your sites`);
    if ($('#view-sites').children.length) viewSites();
    renderSiteList();
  }

  /* ============== Sky tab ============== */
  function viewSky(){
    const root = $('#view-sky');
    if(!state.site){ root.innerHTML = '<div class="notice">Pick a site first.</div>'; return; }
    const now = new Date();
    const lat = state.site.lat, lon = state.site.lon;

    const sun = Astro.getSunPosition(now, lat, lon);
    const moon = Astro.getMoonPosition(now, lat, lon);
    const moonIllum = Astro.getMoonIllumination(now);
    const mw = Astro.getMilkyWayCorePosition(now, lat, lon);

    const bodies = [
      {name:'Sun',     alt: sun.altitude*180/Math.PI,  az: sun.azimuth*180/Math.PI + 180},
      {name:'Moon',    alt: moon.altitude*180/Math.PI, az: moon.azimuth*180/Math.PI + 180, extra: `${(moonIllum.fraction*100).toFixed(0)}% illum`},
      {name:'MW Core', alt: mw.alt, az: mw.az, extra: 'Sgr A*'}
    ];
    for(const p of Astro.PLANETS){
      const pos = Astro.getPlanetPosition(p, now, lat, lon);
      if(pos) bodies.push({name: p, alt: pos.alt, az: pos.az, extra: `Δ=${pos.dist.toFixed(2)} AU`});
    }

    const cards = bodies.map(b => {
      const up = b.alt > 0;
      const dir = compass(b.az);
      return `<div class="sky-card ${up?'up':'down'}">
        <div class="name">${b.name}</div>
        <div class="alt">${b.alt > 0 ? '+' : ''}${b.alt.toFixed(1)}°</div>
        <div class="az">${dir} · ${b.az.toFixed(0)}°${b.extra ? ' · '+b.extra : ''}</div>
      </div>`;
    }).join('');

    const times = Astro.getSunTimes(now, lat, lon, state.site.elevation || 0);
    const moonTimes = Astro.getMoonTimes(now, lat, lon);
    const tz = siteTz();

    root.innerHTML = `
      <button class="ar-launch" onclick="App.launchAR()">
        <svg viewBox="0 0 24 24"><path d="M12 2v6M12 16v6M2 12h6M16 12h6"/><circle cx="12" cy="12" r="3"/></svg>
        Open AR sky view
      </button>

      <div class="section">
        <h2>Sky right now <small>${new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</small></h2>
        <div class="sky-now">${cards}</div>
      </div>

      <div class="section">
        <h2>Today's sun &amp; moon</h2>
        <div class="card">
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px 12px;font-size:13.5px">
            <div><span class="lab">Sunrise</span> ${fmtTime(times.sunrise, tz)}</div>
            <div><span class="lab">Sunset</span> ${fmtTime(times.sunset, tz)}</div>
            <div><span class="lab">Civil dusk</span> ${fmtTime(times.dusk, tz)}</div>
            <div><span class="lab">Civil dawn</span> ${fmtTime(times.dawn, tz)}</div>
            <div><span class="lab">Nautical dusk</span> ${fmtTime(times.nauticalDusk, tz)}</div>
            <div><span class="lab">Nautical dawn</span> ${fmtTime(times.nauticalDawn, tz)}</div>
            <div><span class="lab">Astro dusk</span> ${fmtTime(times.astroDusk, tz)}</div>
            <div><span class="lab">Astro dawn</span> ${fmtTime(times.astroDawn, tz)}</div>
            <div><span class="lab">Moonrise</span> ${fmtTime(moonTimes.rise, tz)}</div>
            <div><span class="lab">Moonset</span> ${fmtTime(moonTimes.set, tz)}</div>
            <div><span class="lab">Phase</span> ${moonPhaseLabel(moonIllum.phase)}</div>
            <div><span class="lab">Illumination</span> ${(moonIllum.fraction*100).toFixed(1)}%</div>
          </div>
        </div>
      </div>

      <div class="section">
        <h2>Milky Way core rise/set <small>next 24 h</small></h2>
        ${mwCurve(now, lat, lon)}
      </div>
    `;
  }

  function launchAR(){
    if (!window.AR) return toast('AR module not loaded', 'bad');
    if (!state.site) return toast('Pick a site first', 'bad');
    AR.start(state.site, Astro);
  }

  function moonPhaseLabel(phase){
    if(phase < 0.03 || phase > 0.97) return 'New';
    if(phase < 0.23) return 'Waxing crescent';
    if(phase < 0.27) return 'First quarter';
    if(phase < 0.48) return 'Waxing gibbous';
    if(phase < 0.52) return 'Full';
    if(phase < 0.73) return 'Waning gibbous';
    if(phase < 0.77) return 'Last quarter';
    return 'Waning crescent';
  }

  function mwCurve(now, lat, lon){
    const ra = (17 + 45/60 + 40.04/3600) * 15;
    const dec = -(29 + 0/60 + 28.1/3600);
    const start = new Date(now); start.setHours(now.getHours()-2);
    const end = new Date(now); end.setHours(now.getHours()+22);
    const curve = Astro.altCurve(ra, dec, start, end, lat, lon, 30);
    const max = Math.max(...curve.map(p=>p.alt), 30);
    const min = Math.min(...curve.map(p=>p.alt), -30);
    const W=320, H=120, pad=20;
    const xScale = i => pad + i*(W-2*pad)/(curve.length-1);
    const yScale = a => H-pad - (a-min)/(max-min) * (H-2*pad);
    const pts = curve.map((p,i)=>[xScale(i), yScale(p.alt)]);
    const path = pts.map((p,i)=>(i===0?'M':'L')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
    const horizonY = yScale(0);
    const targetY = yScale(30);
    const nowIdx = curve.findIndex(p => p.t >= now);
    const nowX = nowIdx >= 0 ? xScale(nowIdx) : pad;
    return `<div class="curve">
      <svg viewBox="0 0 ${W} ${H}" width="100%">
        <line x1="${pad}" x2="${W-pad}" y1="${horizonY}" y2="${horizonY}" stroke="#3a4566" stroke-dasharray="2 4"/>
        <line x1="${pad}" x2="${W-pad}" y1="${targetY}"  y2="${targetY}"  stroke="#1f5a3b" stroke-dasharray="2 4"/>
        <path d="${path}" fill="none" stroke="#79c5ff" stroke-width="2"/>
        <line x1="${nowX}" x2="${nowX}" y1="${pad}" y2="${H-pad}" stroke="#5fe2a8" stroke-width="1" opacity=".7"/>
        <text x="${pad}" y="14" fill="#8a93ad" font-size="10">altitude</text>
        <text x="${W-pad}" y="14" fill="#8a93ad" font-size="10" text-anchor="end">next 24h</text>
        <text x="${pad+2}" y="${horizonY-2}" fill="#8a93ad" font-size="9">0°</text>
        <text x="${pad+2}" y="${targetY-2}" fill="#5fe2a8" font-size="9">30°</text>
      </svg>
    </div>`;
  }

  /* ============== Targets tab ============== */
  function viewTargets(){
    const root = $('#view-targets');
    if(!state.site || !state.messier){ root.innerHTML = '<div class="notice">Loading…</div>'; return; }
    const lat = state.site.lat, lon = state.site.lon;
    const now = new Date();

    const all = [
      ...state.messier.map(t => ({...t, catalog:'Messier'})),
      ...state.ngc.map(t => ({...t, catalog:'NGC/IC'}))
    ];

    const types = {all:'All', GX:'Galaxies', GC:'Globular Cl.', OC:'Open Cl.', EN:'Em. Neb.', PN:'Planet. Neb.', SNR:'Supernova Rem.', RN:'Refl. Neb.', DN:'Dark Neb.'};
    const filterButtons = Object.entries(types).map(([k,v]) =>
      `<button class="${state.targetFilter===k?'on':''}" onclick="App.setTargetFilter('${k}')">${v}</button>`
    ).join('');

    let filtered = all;
    if(state.targetFilter !== 'all') filtered = filtered.filter(t => t.type === state.targetFilter);
    if(state.targetSearch){
      const q = state.targetSearch.toLowerCase();
      filtered = filtered.filter(t =>
        t.id.toLowerCase().includes(q) || (t.name||'').toLowerCase().includes(q) || t.con.toLowerCase().includes(q));
    }
    filtered = filtered.map(t => {
      const p = Astro.equatorialToHorizon(t.ra, t.dec, now, lat, lon);
      return {...t, alt: p.alt, az: p.az};
    }).sort((a,b)=> b.alt - a.alt);

    const items = filtered.slice(0, 200).map(t => {
      const up = t.alt > 0, above30 = t.alt > 30;
      const dir = compass(t.az);
      return `<div class="target ${above30 ? 'up' : (up ? '' : 'below')}">
        <div>
          <div><span class="id">${escape(t.id)}</span> <span class="meta">${escape(t.name||'')}</span></div>
          <div class="meta">${t.catalog} · ${t.type} · ${t.con} · mag ${t.mag} · ${t.size}</div>
        </div>
        <div class="alt"><b>${t.alt>=0?'+':''}${t.alt.toFixed(0)}°</b>${dir}</div>
      </div>`;
    }).join('');

    root.innerHTML = `
      <div class="section">
        <input class="search" placeholder="Search 158 targets (Messier + NGC)…"
               value="${escape(state.targetSearch)}"
               oninput="App.setTargetSearch(this.value)">
        <div class="filter-chips">${filterButtons}</div>
      </div>
      <div class="section">
        <div class="mut" style="font-size:12px;margin-bottom:6px">
          ${filtered.length} targets · sorted by current altitude · ${filtered.filter(t=>t.alt>30).length} above 30°
        </div>
        ${items || '<div class="empty">No matches.</div>'}
      </div>
    `;
  }
  function setTargetFilter(f){ state.targetFilter = f; viewTargets(); }
  function setTargetSearch(s){ state.targetSearch = s; viewTargets(); }

  /* ============== Gear / Smart Setup tab ============== */
  function viewGear(){
    const root = $('#view-gear');
    if(!state.cameras) { root.innerHTML = '<div class="notice">Loading…</div>'; return; }

    /* Group cameras by brand */
    const byBrand = state.cameras.reduce((acc, c) => { (acc[c.brand] = acc[c.brand] || []).push(c); return acc; }, {});
    const camOpts = Object.entries(byBrand).map(([brand, list]) =>
      `<optgroup label="${escape(brand)}">${list.map(c =>
        `<option value="${c.id}" ${c.id===state.smart.cameraId?'selected':''}>${escape(c.model)} · ${c.pixelPitch.toFixed(2)}µm</option>`
      ).join('')}</optgroup>`
    ).join('');

    /* Filter lenses by selected camera's mount */
    const cam = state.cameras.find(c => c.id === state.smart.cameraId) || state.cameras[0];
    const compatLenses = state.lenses.filter(l => !cam.mount || l.mount === cam.mount || l.mount.startsWith('Phone') === cam.mount.startsWith('Phone'));
    const lensSource = compatLenses.length ? compatLenses : state.lenses;
    const lensOpts = lensSource.map(l =>
      `<option value="${l.id}" ${l.id===state.smart.lensId?'selected':''}>${escape(l.brand)} ${escape(l.model)}</option>`
    ).join('');

    root.innerHTML = `
      <div class="smart">
        <h3>Smart setup</h3>
        <div class="pick">
          <label>Camera <select id="s_cam">${camOpts}</select></label>
          <label>Lens <select id="s_lens">${lensOpts}</select></label>
          <label>What do you want to shoot?
            <select id="s_goal">
              <option value="milky-way">Milky Way (untracked wide)</option>
              <option value="star-field">Generic star field</option>
              <option value="moon">Moon</option>
              <option value="planets">Planets</option>
              <option value="deep-sky-tracked">Deep-sky (requires tracker)</option>
              <option value="star-trails">Star trails</option>
              <option value="meteor-shower">Meteor shower</option>
              <option value="nightscape">Nightscape (sky + landscape)</option>
            </select>
          </label>
          <label style="flex-direction:row;align-items:center;gap:8px">
            <input type="checkbox" id="s_tracked" ${state.smart.tracked?'checked':''} style="width:auto"> I'm using a star tracker
          </label>
        </div>
        <div id="s_recipe"></div>
        <button class="adv-toggle" id="advToggle">Show advanced calculators</button>
        <div id="s_advanced" hidden></div>
      </div>
    `;

    /* Wire selects */
    ['s_cam','s_lens','s_goal','s_tracked'].forEach(id =>
      $('#'+id).addEventListener('change', () => {
        state.smart.cameraId = $('#s_cam').value;
        state.smart.lensId   = $('#s_lens').value;
        state.smart.goal     = $('#s_goal').value;
        state.smart.tracked  = $('#s_tracked').checked;
        localStorage.setItem('astroapp.smart.cam', state.smart.cameraId);
        localStorage.setItem('astroapp.smart.lens', state.smart.lensId);
        localStorage.setItem('astroapp.smart.goal', state.smart.goal);
        localStorage.setItem('astroapp.smart.tracked', state.smart.tracked ? '1' : '0');
        if (id === 's_cam') return viewGear(); /* re-render to refilter lens list */
        renderRecipe();
      }));
    $('#advToggle').addEventListener('click', () => {
      const a = $('#s_advanced');
      const visible = !a.hidden;
      a.hidden = visible;
      $('#advToggle').textContent = visible ? 'Show advanced calculators' : 'Hide advanced calculators';
      if (!visible) renderAdvanced();
    });
    /* Default goal */
    $('#s_goal').value = state.smart.goal;
    renderRecipe();
  }

  function renderRecipe(){
    const cam = state.cameras.find(c => c.id === state.smart.cameraId);
    const lens = state.lenses.find(l => l.id === state.smart.lensId);
    if (!cam || !lens) return;

    const focal = lens.focalMin === lens.focalMax
      ? lens.focalMin
      : Math.round((lens.focalMin + lens.focalMax) / 2);
    const aperture = lens.apertureMin;
    const goal = state.smart.goal;
    const tracked = state.smart.tracked;

    const npf = Camera.npfRule(focal, aperture, cam.pixelPitch);
    const fovDim = Camera.fov(focal, cam.width, cam.height);
    const hyper = Camera.hyperfocal(focal, aperture);

    /* Compose recipe */
    let recipe;
    if (goal === 'milky-way' || goal === 'nightscape' || goal === 'star-field') {
      const shutter = tracked ? 120 : Math.max(1, Math.floor(npf.seconds * 10) / 10);
      const iso = tracked ? 800 : (cam.sensor.startsWith('Phone') ? 3200 : 3200);
      const subs = tracked ? 30 : 12;
      const integ = Camera.integrationTime(subs, shutter);
      recipe = {
        kind: 'ok',
        what: goal === 'milky-way' ? 'Milky Way' : goal === 'nightscape' ? 'Nightscape' : 'Star field',
        items: [
          {lab:'Shutter', val: shutter + 's'},
          {lab:'Aperture', val: 'f/'+aperture.toFixed(1)},
          {lab:'ISO',     val: 'ISO ' + iso},
          {lab:'Focus',   val: 'Infinity (live-view-zoom on a bright star)'},
          {lab:'White bal', val: '4000K'},
          {lab:'Stack',   val: `${subs} × ${shutter}s = ${integ.humanReadable.trim()}`}
        ],
        why: `${tracked ? 'Tracked' : 'Untracked'} ${focal}mm @ f/${aperture}. NPF says ${npf.seconds.toFixed(1)}s before stars trail at ${cam.pixelPitch}µm. FOV ${fovDim.h.toFixed(0)}°×${fovDim.v.toFixed(0)}°.`
      };
    } else if (goal === 'moon') {
      recipe = {
        kind: focal < 200 ? 'warn' : 'ok',
        what: 'Moon',
        items: [
          {lab:'Shutter', val: '1/250 s'},
          {lab:'Aperture', val: 'f/8'},
          {lab:'ISO', val: 'ISO 100'},
          {lab:'Focus', val: 'Manual on moon limb'},
          {lab:'Format', val: 'RAW'},
          {lab:'Frames', val: 'Stack 100+ for sharp lucky imaging'}
        ],
        why: focal < 200
          ? `Only ${focal}mm — moon will be small (~${(0.5*focal/35).toFixed(2)}° in frame). Use a longer lens for detail.`
          : `${focal}mm gives a clean moon. Aperture f/8 keeps it sharp without diffraction softening.`
      };
    } else if (goal === 'planets') {
      recipe = {
        kind: focal < 400 ? 'warn' : 'ok',
        what: 'Planets',
        items: [
          {lab:'Shutter', val: '1/30 s'},
          {lab:'Aperture', val: 'f/'+(aperture+1.4).toFixed(1)},
          {lab:'ISO', val: 'ISO 400–800'},
          {lab:'Focus', val: 'Manual, live-view zoom'},
          {lab:'Mode', val: 'Video @ 60fps, stack 1000+'},
          {lab:'Sw stack', val: 'AutoStakkert + RegiStax'}
        ],
        why: focal < 400
          ? `Planet imaging really wants 400mm+ (and a Barlow). ${focal}mm only resolves the largest disks.`
          : `Use video capture and lucky-imaging stack. f/8 sweet-spot for most telescopes.`
      };
    } else if (goal === 'deep-sky-tracked') {
      const each = 120;
      const subs = 30;
      const integ = Camera.integrationTime(subs, each);
      recipe = {
        kind: tracked ? 'ok' : 'warn',
        what: 'Deep-sky (tracked)',
        items: [
          {lab:'Shutter',  val: each + 's'},
          {lab:'Aperture', val: 'f/'+aperture.toFixed(1)+' (or +1 stop)'},
          {lab:'ISO',      val: 'ISO 800'},
          {lab:'Focus',    val: 'Bahtinov mask or live-view zoom'},
          {lab:'Stack',    val: `${subs} × ${each}s = ${integ.humanReadable.trim()}`},
          {lab:'Calibration', val: 'Plus 30 darks, 30 flats, 30 biases'}
        ],
        why: tracked
          ? `${subs}×${each}s gives ~${Camera.snrGain(subs).toFixed(1)}× SNR over a single frame. Process in Siril or PixInsight.`
          : `You haven't checked the tracker box. ${each}s on a static tripod would smear stars — toggle "I'm using a star tracker" first.`
      };
    } else if (goal === 'star-trails') {
      recipe = {
        kind: 'ok',
        what: 'Star trails',
        items: [
          {lab:'Shutter',  val: '30 s each'},
          {lab:'Aperture', val: 'f/'+(aperture+1).toFixed(1)},
          {lab:'ISO',      val: 'ISO 400–800'},
          {lab:'Focus',    val: 'Infinity'},
          {lab:'Frames',   val: '120–300 consecutive shots'},
          {lab:'Stack',    val: 'StarStaX / Siril (lighten mode)'}
        ],
        why: `Stop down one stop for round trails. 30 s × 200 = 1h40m of arc. Frame Polaris for circular trails.`
      };
    } else if (goal === 'meteor-shower') {
      const shutter = Math.max(15, Math.floor(npf.seconds * 1.5));
      recipe = {
        kind: 'ok',
        what: 'Meteor shower',
        items: [
          {lab:'Shutter',  val: shutter + 's'},
          {lab:'Aperture', val: 'f/'+aperture.toFixed(1)},
          {lab:'ISO',      val: 'ISO 3200'},
          {lab:'Focus',    val: 'Infinity'},
          {lab:'Mode',     val: 'Intervalometer, back-to-back'},
          {lab:'Aim',      val: '~45° away from radiant, 50–60° altitude'}
        ],
        why: `Wide & fast wins. ${shutter}s lets bright meteors etch. Don't aim at the radiant — trails look shorter there.`
      };
    } else {
      recipe = {kind:'ok', what:'—', items:[], why:''};
    }

    /* Render */
    let html = `<div class="recipe ${recipe.kind==='warn'?'warn':recipe.kind==='bad'?'bad':''}">
      <span class="badge">${escape(recipe.what)}</span>
      <div class="recipe-grid">${recipe.items.map(it => `
        <div class="ri">
          <div class="lab">${escape(it.lab)}</div>
          <div class="val">${escape(it.val)}</div>
        </div>`).join('')}</div>
      ${recipe.why ? `<div class="why">${escape(recipe.why)}</div>` : ''}
    </div>`;
    $('#s_recipe').innerHTML = html;
  }

  /* Advanced panel — preserves the old per-calculator UI */
  function renderAdvanced(){
    const cam  = state.cameras.find(c => c.id === state.smart.cameraId);
    const lens = state.lenses.find(l => l.id === state.smart.lensId);
    const focal = lens.focalMin === lens.focalMax ? lens.focalMin : Math.round((lens.focalMin + lens.focalMax)/2);

    $('#s_advanced').innerHTML = `
      <div class="calc-block">
        <h3>NPF rule (manual)</h3>
        <div class="calc-row">
          <label>Focal length (mm)<input id="a_focal" type="number" value="${focal}" /></label>
          <label>Aperture (f/)<input id="a_fnum" type="number" step="0.1" value="${lens.apertureMin}" /></label>
        </div>
        <div class="calc-row">
          <label>Tightness (k)
            <select id="a_k">
              <option value="14">14 — strict (100% crop)</option>
              <option value="35" selected>35 — default (PhotoPills)</option>
              <option value="50">50 — loose (small prints)</option>
            </select>
          </label>
          <label>Declination (°)<input id="a_dec" type="number" value="0"/></label>
        </div>
        <div class="result" id="a_npfResult">—</div>
      </div>

      <div class="calc-block">
        <h3>Hyperfocal &amp; depth of field</h3>
        <div class="calc-row">
          <label>Subject (m)<input id="a_hf_d" type="number" step="0.1" value="100" /></label>
          <label>CoC (mm)<input id="a_hf_c" type="number" step="0.001" value="${Camera.cocForSensor(cam.width, cam.height).toFixed(3)}" /></label>
        </div>
        <div class="result" id="a_hfResult">—</div>
      </div>

      <div class="calc-block">
        <h3>Integration time / stack planner</h3>
        <div class="calc-row">
          <label>Number of subs<input id="a_st_n" type="number" value="30" /></label>
          <label>Seconds each<input id="a_st_s" type="number" value="60" /></label>
        </div>
        <div class="result" id="a_stResult">—</div>
      </div>

      <div class="calc-block">
        <h3>Sensor</h3>
        <div class="mut" style="font-size:12.5px">
          ${escape(cam.brand)} ${escape(cam.model)} · ${escape(cam.sensor)} · ${cam.width}×${cam.height} mm · ${cam.pixelsX}×${cam.pixelsY} px · ${cam.pixelPitch}µm pixels · ${cam.crop}× crop
        </div>
      </div>
    `;

    const recalc = () => {
      const f = parseFloat($('#a_focal').value)||focal;
      const n = parseFloat($('#a_fnum').value)||lens.apertureMin;
      const k = parseInt($('#a_k').value,10)||35;
      const dec = parseFloat($('#a_dec').value)||0;
      const npf = Camera.npfRule(f, n, cam.pixelPitch, {tightness:k, declination:dec});
      const r500 = Camera.rule500(f, cam.crop);
      const r300 = Camera.rule300(f, cam.crop);
      $('#a_npfResult').innerHTML = `<div class="big">${npf.seconds.toFixed(1)}s</div>
        <div>NPF · ${cam.pixelPitch}µm @ ${f}mm f/${n}, dec ${dec}°</div>
        <div class="mut">500: ${r500.seconds.toFixed(1)}s · 300: ${r300.seconds.toFixed(1)}s</div>`;

      const hf_d = parseFloat($('#a_hf_d').value);
      const hf_c = parseFloat($('#a_hf_c').value);
      const dof = Camera.depthOfField(f, n, hf_d, hf_c);
      $('#a_hfResult').innerHTML = `<div class="big">H = ${dof.hyperfocal.toFixed(1)} m</div>
        <div>at ${hf_d} m: near ${dof.near.toFixed(2)} m, far ${isFinite(dof.far)?dof.far.toFixed(2)+' m':'∞'}</div>`;

      const subs = parseInt($('#a_st_n').value,10), each = parseFloat($('#a_st_s').value);
      const stk = Camera.integrationTime(subs, each);
      $('#a_stResult').innerHTML = `<div class="big">${stk.humanReadable.trim()}</div>
        <div>SNR × ${stk.snrMultiplier.toFixed(1)} vs 1 frame</div>`;
    };
    $$('#s_advanced input, #s_advanced select').forEach(el => el.addEventListener('input', recalc));
    recalc();
  }

  /* ============== Sites tab ============== */
  function viewSites(){
    const root = $('#view-sites');
    const list = Sites.list();
    const ll = state.site;
    const rows = list.map(s => {
      const isActive = ll && s.id === ll.id;
      const dist = ll && s.id !== ll.id ? Sites.distanceKm(ll, s).toFixed(1) + ' km' : '';
      return `<div class="site-row ${isActive?'active':''}">
        <div>
          <div><b>${escape(s.name)}</b> <span class="bortle">B${s.bortle} · ${escape(Sites.bortleLabel(s.bortle))}</span></div>
          <div class="lat">${s.lat.toFixed(4)}, ${s.lon.toFixed(4)} · ${s.elevation||0}m · SQM~${Sites.bortleSQM(s.bortle)?.toFixed(1) || '—'}${dist?' · '+dist:''}</div>
          ${s.notes ? `<div class="mut" style="font-size:12px;margin-top:3px">${escape(s.notes)}</div>` : ''}
          <div class="btn-row" style="margin-top:8px">
            ${isActive ? '' : `<button class="btn primary" onclick="App.selectSite('${s.id}')">Use</button>`}
            <button class="btn" onclick="App.openSiteEditor(Sites.get('${s.id}'))">Edit</button>
            <a class="btn ghost" href="${Sites.mapsUrl(s)}" target="_blank">Maps</a>
            <a class="btn ghost" href="${Sites.lightPollutionMapUrl(s.lat, s.lon)}" target="_blank">Lt. pollution</a>
            ${s.id!=='home-bucharest' ? `<button class="btn danger" onclick="App.deleteSite('${s.id}')">Delete</button>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');

    root.innerHTML = `
      <div class="section">
        <h2>Observing sites <a href="#planner" class="right">Find more →</a></h2>
        ${rows || '<div class="empty">No sites yet.</div>'}
        <div class="btn-row" style="margin-top:10px">
          <button class="btn primary" onclick="App.useCurrentLocation()">📍 Add current location</button>
          <button class="btn" onclick="App.openSiteEditor()">＋ New site</button>
        </div>
      </div>
      <div class="section card">
        <h3 style="margin:0 0 6px;font-size:14px">Bortle scale reference</h3>
        <div class="mut" style="font-size:12px;line-height:1.7">
          1: excellent dark · zodiacal light visible · Milky Way casts shadows · SQM &gt;21.8<br>
          2: typical dark · clouds appear dark<br>
          3: rural sky · some light on horizon<br>
          4: rural/suburban transition<br>
          5: suburban · Milky Way weak, M31 visible<br>
          6: bright suburban · Milky Way only with averted vision<br>
          7: suburb/urban · sky washed out<br>
          8: city sky · only brightest objects naked-eye<br>
          9: inner city · moon &amp; planets only
        </div>
      </div>
    `;
  }

  /* ============== Calendar / Events tab ============== */
  async function viewCalendar(){
    const root = $('#view-calendar');
    await AstroCalendar.loadShowers();
    const now = new Date();
    const year = now.getFullYear();
    const showerStatus = AstroCalendar.showerStatus(year, now);
    const upcoming = showerStatus.filter(s => s.peakDate >= now).sort((a,b)=>a.peakDate-b.peakDate);
    const active = showerStatus.filter(s => s.active);

    let conjs = [];
    if(state.site){
      conjs = AstroCalendar.findConjunctions(Astro, state.site.lat, state.site.lon,
        now, new Date(now.getTime() + 90*86400000), 3, 12);
    }

    const showerRow = s => `<div class="card" style="margin-bottom:6px">
      <div class="row">
        <b>${escape(s.shower.name)}</b>
        ${s.active ? '<span class="chip ok">active</span>' : ''}
        <span class="mut" style="margin-left:auto">ZHR ~${s.shower.zhr}</span>
      </div>
      <div class="mut" style="font-size:12.5px;margin-top:4px">Peak ${fmtDate(s.peakDate)} · radiant RA ${s.shower.radiantRA}° Dec ${s.shower.radiantDec}° · ${s.shower.velocity} km/s</div>
      <div class="mut" style="font-size:12px;margin-top:4px">${escape(s.shower.notes||'')}</div>
    </div>`;

    const conjRow = c => `<div class="card" style="margin-bottom:6px">
      <div class="row"><b>${escape(c.pair)}</b> <span class="mut">sep ${c.sep.toFixed(1)}°</span></div>
      <div class="mut" style="font-size:12.5px">${fmtDate(c.t)} · ${fmtTime(c.t)}</div>
    </div>`;

    root.innerHTML = `
      <div class="section">
        <h2>Active meteor showers <small>${active.length}</small></h2>
        ${active.length ? active.map(showerRow).join('') : '<div class="empty">No active showers right now.</div>'}
      </div>
      <div class="section">
        <h2>Upcoming meteor showers</h2>
        ${upcoming.slice(0,6).map(showerRow).join('')}
      </div>
      <div class="section">
        <h2>Conjunctions <small>next 90 d · ≤3° sep</small></h2>
        ${conjs.length ? conjs.map(conjRow).join('') : '<div class="empty">No close conjunctions in window.</div>'}
      </div>
      <div class="section card">
        <h3 style="margin:0 0 6px;font-size:14px">Equinoxes &amp; solstices ${year}</h3>
        <div class="mut" style="font-size:13px;line-height:1.6">
          ${AstroCalendar.seasonalEvents(year).map(e => `${escape(e.name)}: ${fmtDate(e.date)}`).join('<br>')}
        </div>
      </div>
    `;
  }

  /* ============== Log tab ============== */
  function viewLog(){
    const root = $('#view-log');
    const entries = SessionLog.list();
    const stats = SessionLog.stats();

    const rows = entries.map(e => `<div class="card" style="margin-bottom:8px">
      <div class="row" style="align-items:center">
        <b>${escape(e.date)}</b>
        <span class="mut">${escape((e.targets||[]).join(', ')||'—')}</span>
        <span class="mut" style="margin-left:auto">${e.gear?.camera||'—'} · ${e.gear?.lens||''}</span>
      </div>
      <div class="mut" style="font-size:12px;margin-top:4px">
        ${e.shots?.frames || 0} × ${e.shots?.secondsEach || 0}s
        ${e.shots?.iso ? ' · ISO '+e.shots.iso : ''}
        ${e.shots?.aperture ? ' · f/'+e.shots.aperture : ''}
        ${e.conditions?.cloudPct != null ? ' · cloud '+e.conditions.cloudPct+'%' : ''}
        ${e.conditions?.bortle ? ' · B'+e.conditions.bortle : ''}
      </div>
      ${e.notes ? `<div style="font-size:13px;margin-top:6px">${escape(e.notes)}</div>` : ''}
      <div class="btn-row" style="margin-top:8px">
        <button class="btn" onclick="App.editLog('${e.id}')">Edit</button>
        <button class="btn danger" onclick="App.deleteLog('${e.id}')">Delete</button>
      </div>
    </div>`).join('');

    root.innerHTML = `
      <div class="section card">
        <h3 style="margin:0 0 6px;font-size:14px">Log stats</h3>
        <div class="mut" style="font-size:13px">
          ${stats.sessions} sessions · ${stats.totalFrames} frames · ${stats.totalHours} hours integration
        </div>
        ${stats.topTargets.length ? `<div class="mut" style="font-size:12px;margin-top:6px">
          Top targets: ${stats.topTargets.map(([t,n])=>`${escape(t)} (${n})`).join(', ')}
        </div>` : ''}
      </div>
      <div class="section">
        <div class="btn-row" style="margin-bottom:10px">
          <button class="btn primary" onclick="App.newLog()">＋ New entry</button>
          <button class="btn ghost" onclick="App.exportLogJson()">Export JSON</button>
          <label class="btn ghost" style="cursor:pointer">Import JSON
            <input type="file" hidden accept=".json,application/json" onchange="App.importLogJson(event)" />
          </label>
        </div>
        ${rows || '<div class="empty">No entries yet. Tap "New entry" after your first session.</div>'}
      </div>
    `;
  }

  function newLog(){
    $('#logEditForm').reset();
    $('#logEditForm').date.value = new Date().toISOString().slice(0,10);
    populateLogSites();
    if(state.site){
      $('#logEditForm').elements['siteId'].value = state.site.id;
      $('#logEditForm').elements['conditions'].placeholder = `B${state.site.bortle}`;
    }
    $('#logEditDlg').showModal();
  }
  function editLog(id){
    const e = SessionLog.get(id); if(!e) return;
    const f = $('#logEditForm'); f.reset();
    populateLogSites();
    f.id.value = e.id; f.date.value = e.date; f.siteId.value = e.siteId || '';
    f.camera.value = e.gear?.camera || ''; f.lens.value = e.gear?.lens || '';
    f.targets.value = (e.targets||[]).join(', ');
    f.conditions.value = e.conditions?.label || '';
    f.frames.value = e.shots?.frames || ''; f.secondsEach.value = e.shots?.secondsEach || '';
    f.iso.value = e.shots?.iso || ''; f.aperture.value = e.shots?.aperture || '';
    f.notes.value = e.notes || '';
    $('#logEditDlg').showModal();
  }
  function populateLogSites(){
    const sel = $('#logEditSiteSelect');
    sel.innerHTML = '<option value="">—</option>' + Sites.list().map(s =>
      `<option value="${s.id}">${escape(s.name)}</option>`).join('');
  }
  function saveLog(ev){
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const entry = {
      id: fd.get('id') || undefined,
      date: fd.get('date'),
      siteId: fd.get('siteId') || null,
      gear: {camera: fd.get('camera') || '', lens: fd.get('lens') || ''},
      targets: (fd.get('targets') || '').split(',').map(s=>s.trim()).filter(Boolean),
      conditions: {label: fd.get('conditions') || '', bortle: state.site?.bortle},
      shots: {
        frames: parseInt(fd.get('frames'), 10) || 0,
        secondsEach: parseFloat(fd.get('secondsEach')) || 0,
        iso: parseInt(fd.get('iso'), 10) || null,
        aperture: parseFloat(fd.get('aperture')) || null
      },
      notes: fd.get('notes') || ''
    };
    if(entry.id) SessionLog.update(entry.id, entry); else SessionLog.add(entry);
    $('#logEditDlg').close();
    viewLog();
    toast('Entry saved');
  }
  function deleteLog(id){
    if(!confirm('Delete this entry?')) return;
    SessionLog.remove(id);
    viewLog();
    toast('Entry deleted');
  }
  function exportLogJson(){
    const blob = new Blob([SessionLog.exportJson()], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `skywatch-log-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  }
  function importLogJson(ev){
    const file = ev.target.files?.[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { const n = SessionLog.importJson(reader.result); toast(`Imported ${n} entries`); viewLog(); }
      catch(e){ toast(e.message, 'bad'); }
    };
    reader.readAsText(file);
  }

  /* ============== Help / Settings sheet (accessed via header gear icon) ============== */
  function openSettings(){ viewHelp(); $('#settingsDlg').showModal(); }
  function viewHelp(){
    const root = $('#settingsBody');
    root.innerHTML = `
      <div class="section">
        <h2>About SkyWatch</h2>
        <div class="card">
          <p style="margin:0 0 8px"><b>What it does.</b> Picks the next clear, dark, moonless night for astrophotography, recommends where to go from your active site, gives you the exact camera settings to bring, and lets you log what you actually captured.</p>
          <p style="margin:0 0 8px"><b>Live data.</b> Cloud forecast: Open-Meteo. Sun/moon: SunCalc + Meeus implementation. Planets: Schlyter elements.</p>
          <p style="margin:0"><b>Privacy.</b> Everything runs in your browser. No tracking. Sites and log live in <code>localStorage</code>.</p>
        </div>
      </div>
      <div class="section">
        <h2>Catalogues loaded</h2>
        <div class="stat-grid four">
          <div class="stat"><div class="lab">Cameras</div><div class="val">${(state.cameras||[]).length}</div></div>
          <div class="stat"><div class="lab">Lenses</div><div class="val">${(state.lenses||[]).length}</div></div>
          <div class="stat"><div class="lab">Targets</div><div class="val">${(state.messier||[]).length + (state.ngc||[]).length}</div></div>
          <div class="stat"><div class="lab">Spots</div><div class="val">${(window.PLANNER_SPOTS_DATA||[]).length}</div></div>
        </div>
      </div>
      <div class="section card">
        <h3 style="margin:0 0 6px;font-size:14px">NPF vs 500 vs 300 rules</h3>
        <p class="mut" style="font-size:13px;margin:0">
          The 500 / 300 rules use a single magic number, ignoring sensor pixel pitch.
          The NPF rule (Frédéric Michaud) gives a pixel-aware maximum exposure that's typically 30-60% shorter, but actually keeps stars round at 100% crop. Smart Setup uses NPF.
        </p>
      </div>
      <div class="section card">
        <h3 style="margin:0 0 6px;font-size:14px">Threshold tuning</h3>
        <p class="mut" style="font-size:13px;margin:0">
          Edit <code>Forecast.defaults</code> in <code>js/forecast.js</code> for cloud / moon / dark-window cutoffs. Current defaults: cloud ≤30%, moon ≤40% (or below horizon all night), usable dark ≥90 min.
        </p>
      </div>
      <div class="section card">
        <h3 style="margin:0 0 6px;font-size:14px">References</h3>
        <ul class="mut" style="font-size:12.5px;line-height:1.7;padding-left:18px;margin:0">
          <li>Meeus, J. — <i>Astronomical Algorithms</i>, 1991</li>
          <li>Schlyter, P. — <a href="https://stjarnhimlen.se/comp/ppcomp.html" target="_blank">computing planetary positions</a></li>
          <li>SunCalc — <a href="https://github.com/mourner/suncalc" target="_blank">github.com/mourner/suncalc</a></li>
          <li>Open-Meteo — <a href="https://open-meteo.com/" target="_blank">open-meteo.com</a></li>
          <li>Bortle scale — <i>Sky &amp; Telescope</i>, John Bortle, 2001</li>
        </ul>
      </div>
      <div class="section card">
        <h3 style="margin:0 0 6px;font-size:14px">Open source · MIT</h3>
        <p class="mut" style="font-size:13px;margin:0">
          PRs &amp; bug reports welcome. See <code>README.md</code> + <code>CONTRIBUTING.md</code>.
        </p>
      </div>
      <div class="btn-row" style="margin-top:10px">
        <a class="btn" href="#calendar" onclick="document.getElementById('settingsDlg').close()">Events tab</a>
        <a class="btn" href="#sites" onclick="document.getElementById('settingsDlg').close()">All sites</a>
        <button class="btn ghost" onclick="document.getElementById('settingsDlg').close()">Close</button>
      </div>
    `;
  }

  /* ============== Router ============== */
  const VIEWS = {
    tonight: viewTonight, planner: viewPlanner, sky: viewSky, targets: viewTargets,
    gear: viewGear, sites: viewSites, calendar: viewCalendar, log: viewLog
  };

  function router(){
    const h = (location.hash || '#tonight').slice(1);
    const which = VIEWS[h] ? h : 'tonight';
    for(const v of Object.keys(VIEWS)){
      const el = $('#view-'+v); if (el) el.hidden = v !== which;
    }
    $$('.bottomnav a').forEach(a => a.classList.toggle('active', a.dataset.view === which));
    try { VIEWS[which](); } catch(e){ console.error(e); toast('Render error: '+e.message, 'bad'); }
  }

  /* ============== Init ============== */
  async function init(){
    $('#sitePill').addEventListener('click', openSiteSwitcher);
    $('#settingsBtn')?.addEventListener('click', openSettings);
    await loadStaticData();
    const s = Sites.active();
    setSite(s);
    window.addEventListener('hashchange', router);
    document.addEventListener('visibilitychange', () => { if(!document.hidden) refreshForecast(); });
    state.autoRefreshHandle = setInterval(refreshForecast, 30*60*1000);
    if('serviceWorker' in navigator &&
       (location.protocol === 'https:' || location.protocol === 'http:')){
      navigator.serviceWorker.register('sw.js').catch(()=>{});
    }
  }

  window.addEventListener('DOMContentLoaded', init);

  /* Public API */
  return {
    refreshForecast, useCurrentLocation, selectSite, openSiteEditor, saveSite, deleteSite,
    setTargetFilter, setTargetSearch,
    saveSpotAsSite, discoverSpots, launchAR, openSettings,
    newLog, editLog, saveLog, deleteLog, exportLogJson, importLogJson
  };
})();
