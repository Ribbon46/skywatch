/* ar.js
 * Augmented-reality sky overlay for phones.
 * Requests rear-camera video + DeviceOrientationEvent compass/tilt, then
 * projects Sun / Moon / planets / Milky Way core / brightest stars onto the
 * live video feed.
 *
 * Coordinate convention:
 *   alpha (compass heading) — 0=N, 90=E, increases clockwise viewed from above
 *   beta  (front/back tilt)  — 0 = lying flat face-up, 90 = upright vertical
 *   gamma (left/right tilt)  — -90..90
 *
 * Camera FOV is assumed 60° horizontal × 45° vertical (typical phone main lens).
 * Override with AR.setFov(hDeg, vDeg) if you know your device's actual FOV.
 */

const AR = (() => {

  const state = {
    on: false,
    stream: null,
    videoEl: null,
    canvasEl: null,
    hudEl: null,
    footEl: null,
    raf: null,
    orient: {alpha: 0, beta: 90, gamma: 0, hasReading: false},
    fovH: 60, fovV: 45,
    site: null, astroMod: null,
    /* Compass calibration offset (deg) applied to alpha */
    compassOffset: 0
  };

  function setFov(hDeg, vDeg){ state.fovH = hDeg; state.fovV = vDeg; }

  /* Build the overlay DOM if it doesn't exist yet */
  function _ensureOverlay(){
    let el = document.getElementById('arOverlay');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'arOverlay';
    el.innerHTML = `
      <video autoplay playsinline muted></video>
      <canvas></canvas>
      <div class="ar-hud">
        <b>AR Sky</b>
        <span class="mut" id="arBearing">—</span>
        <button id="arCloseBtn">Close</button>
      </div>
      <div class="ar-foot" id="arFoot">Initialising sensors…</div>
    `;
    document.body.appendChild(el);
    state.videoEl  = el.querySelector('video');
    state.canvasEl = el.querySelector('canvas');
    state.hudEl    = el.querySelector('#arBearing');
    state.footEl   = el.querySelector('#arFoot');
    el.querySelector('#arCloseBtn').addEventListener('click', stop);
    return el;
  }

  async function _requestOrientationPermission(){
    /* iOS 13+ requires an explicit permission grant from a user gesture. */
    const T = typeof DeviceOrientationEvent !== 'undefined' ? DeviceOrientationEvent : null;
    if (T && typeof T.requestPermission === 'function') {
      try {
        const result = await T.requestPermission();
        if (result !== 'granted') throw new Error('orientation permission denied');
      } catch (e) {
        throw new Error('Compass permission was not granted.');
      }
    }
  }

  function _onOrient(ev){
    /* webkitCompassHeading is the cleaner iOS heading; alpha is correct on Android */
    const heading = (ev.webkitCompassHeading != null)
      ? ev.webkitCompassHeading
      : (ev.alpha != null ? (360 - ev.alpha) : null);
    if (heading == null) return;
    state.orient.alpha = (heading + state.compassOffset + 360) % 360;
    state.orient.beta  = ev.beta  ?? 90;
    state.orient.gamma = ev.gamma ?? 0;
    state.orient.hasReading = true;
  }

  async function start(site, astroMod){
    if (state.on) return;
    state.site = site; state.astroMod = astroMod;
    const overlay = _ensureOverlay();
    overlay.classList.add('on');
    state.on = true;
    state.footEl.textContent = 'Asking for camera and compass permission…';

    try {
      await _requestOrientationPermission();
      window.addEventListener('deviceorientation', _onOrient, true);
      window.addEventListener('deviceorientationabsolute', _onOrient, true);
    } catch (e) {
      state.footEl.textContent = e.message + ' Tap a body name above to confirm position manually.';
    }

    try {
      state.stream = await navigator.mediaDevices.getUserMedia({
        video: {facingMode: {ideal: 'environment'}, width: {ideal: 1920}, height: {ideal: 1080}},
        audio: false
      });
      state.videoEl.srcObject = state.stream;
      await state.videoEl.play();
      _autoSize();
      state.footEl.textContent = 'Point your phone at the sky. Labels track Sun / Moon / planets / Milky Way core / bright stars.';
    } catch (e) {
      state.footEl.textContent = 'Camera unavailable (' + e.name + '). AR works on phones with rear-camera access.';
      /* Still draw the overlay on a dark canvas so people can verify positions */
      state.videoEl.style.display = 'none';
    }

    _autoSize();
    window.addEventListener('resize', _autoSize);
    window.addEventListener('orientationchange', _autoSize);
    _loop();
  }

  function stop(){
    if (!state.on) return;
    state.on = false;
    cancelAnimationFrame(state.raf); state.raf = null;
    window.removeEventListener('deviceorientation', _onOrient, true);
    window.removeEventListener('deviceorientationabsolute', _onOrient, true);
    window.removeEventListener('resize', _autoSize);
    window.removeEventListener('orientationchange', _autoSize);
    if (state.stream) {
      state.stream.getTracks().forEach(t => t.stop());
      state.stream = null;
    }
    const el = document.getElementById('arOverlay');
    if (el) el.classList.remove('on');
  }

  function _autoSize(){
    if (!state.canvasEl) return;
    const c = state.canvasEl;
    c.width  = window.innerWidth;
    c.height = window.innerHeight;
  }

  /* Project a body at (alt, az) onto screen given device pointing (devAlt, devAz)
   * Returns {x, y, visible} where visible is true if it falls within the FOV. */
  function _project(bodyAlt, bodyAz, devAlt, devAz, w, h){
    /* Difference in azimuth, normalised to -180..180 */
    let dAz = bodyAz - devAz;
    if (dAz > 180)  dAz -= 360;
    if (dAz < -180) dAz += 360;
    const dAlt = bodyAlt - devAlt;
    /* Inside FOV? */
    if (Math.abs(dAz)  > state.fovH/2 + 5) return {visible: false};
    if (Math.abs(dAlt) > state.fovV/2 + 5) return {visible: false};
    const x = w/2 + (dAz  / (state.fovH/2)) * (w/2);
    const y = h/2 - (dAlt / (state.fovV/2)) * (h/2);
    return {x, y, visible: Math.abs(dAz) <= state.fovH/2 && Math.abs(dAlt) <= state.fovV/2};
  }

  function _bodies(now){
    const out = [];
    const A = state.astroMod;
    const lat = state.site.lat, lon = state.site.lon;
    const sun  = A.getSunPosition(now, lat, lon);
    const moon = A.getMoonPosition(now, lat, lon);
    const mw   = A.getMilkyWayCorePosition(now, lat, lon);
    out.push({name: 'Sun',     alt: sun.altitude*180/Math.PI,  az: (sun.azimuth*180/Math.PI + 180 + 360) % 360, color: '#ffd166', big: true});
    out.push({name: 'Moon',    alt: moon.altitude*180/Math.PI, az: (moon.azimuth*180/Math.PI + 180 + 360) % 360, color: '#e7ecf7', big: true});
    out.push({name: 'MW Core', alt: mw.alt, az: mw.az, color: '#b39dff'});
    for (const p of A.PLANETS) {
      const pos = A.getPlanetPosition(p, now, lat, lon);
      if (pos) out.push({name: p, alt: pos.alt, az: pos.az, color: '#79c5ff'});
    }
    /* Brightest stars (top 12 by mag) */
    if (window.STARS_DATA) {
      const stars = window.STARS_DATA.slice().sort((a,b) => a.mag - b.mag).slice(0, 12);
      for (const s of stars) {
        const p = A.equatorialToHorizon(s.ra, s.dec, now, lat, lon);
        if (p.alt > 0) out.push({name: s.name, alt: p.alt, az: p.az, color: '#9aa3bf', faint: true});
      }
    }
    return out;
  }

  function _loop(){
    if (!state.on) return;
    state.raf = requestAnimationFrame(_loop);

    const c = state.canvasEl; if (!c) return;
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h);

    /* Device pointing — beta is tilt from face-up. 90 = phone vertical (camera forward).
     * altitude angle above horizon ≈ beta - 90 (clamped). */
    const devAlt = state.orient.hasReading ? (state.orient.beta - 90) : 0;
    const devAz  = state.orient.alpha;
    if (state.hudEl) {
      state.hudEl.textContent = state.orient.hasReading
        ? `bearing ${devAz.toFixed(0)}° / alt ${devAlt.toFixed(0)}°`
        : 'no compass';
    }

    /* Crosshair */
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w/2 - 12, h/2); ctx.lineTo(w/2 + 12, h/2);
    ctx.moveTo(w/2, h/2 - 12); ctx.lineTo(w/2, h/2 + 12);
    ctx.stroke();

    /* Compass bar at top */
    const compassY = 16;
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    ctx.fillRect(0, 0, w, 28);
    ctx.fillStyle = '#fff'; ctx.font = '11px ui-monospace,Menlo,Consolas';
    const dirs = [['N',0], ['NE',45], ['E',90], ['SE',135], ['S',180], ['SW',225], ['W',270], ['NW',315]];
    for (const [name, deg] of dirs) {
      const off = ((deg - devAz + 540) % 360) - 180;
      if (Math.abs(off) > 70) continue;
      const x = w/2 + (off / 70) * (w/2);
      ctx.textAlign = 'center';
      ctx.fillText(name, x, 18);
    }

    if (!state.site || !state.astroMod) return;
    const now = new Date();
    const list = _bodies(now);

    for (const b of list) {
      const p = _project(b.alt, b.az, devAlt, devAz, w, h);
      if (!p.visible) continue;
      const r = b.big ? 14 : (b.faint ? 5 : 8);
      /* Marker ring */
      ctx.strokeStyle = b.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 2*Math.PI); ctx.stroke();
      /* Label */
      ctx.fillStyle = b.color;
      ctx.font = (b.big ? 'bold 14px' : '12px') + ' -apple-system, "SF Pro Text", "Segoe UI", Roboto';
      ctx.textAlign = 'left';
      ctx.shadowColor = 'rgba(0,0,0,.9)'; ctx.shadowBlur = 4;
      ctx.fillText(b.name, p.x + r + 4, p.y + 4);
      ctx.shadowBlur = 0;
    }

    /* "Off-screen" arrows for the Sun & Moon when they're outside FOV */
    for (const b of list) {
      if (!b.big) continue;
      const p = _project(b.alt, b.az, devAlt, devAz, w, h);
      if (p.visible) continue;
      let dAz = b.az - devAz; if (dAz > 180) dAz -= 360; if (dAz < -180) dAz += 360;
      const dAlt = b.alt - devAlt;
      const angle = Math.atan2(-dAlt, dAz);
      const cx = w/2, cy = h/2;
      const len = Math.min(w, h) * 0.38;
      const ax = cx + Math.cos(angle) * len;
      const ay = cy + Math.sin(angle) * len;
      ctx.strokeStyle = b.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ax, ay); ctx.stroke();
      ctx.fillStyle = b.color; ctx.font = 'bold 12px -apple-system';
      ctx.shadowColor = 'rgba(0,0,0,.9)'; ctx.shadowBlur = 4;
      ctx.fillText(b.name + ' →', ax + 6, ay + 4);
      ctx.shadowBlur = 0;
    }
  }

  return { start, stop, setFov, get on(){ return state.on; } };
})();

if (typeof module !== 'undefined') module.exports = AR;
if (typeof window !== 'undefined') window.AR = AR;
