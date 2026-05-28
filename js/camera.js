/* camera.js
 * Astrophotography camera calculators:
 *   - NPF rule (true max exposure before trailing, for any pixel pitch)
 *   - 500/300 rules (classic shortcuts)
 *   - Hyperfocal distance + near/far DOF
 *   - Field of view (horizontal/vertical/diagonal)
 *   - Integration time / number of subs given target SNR
 */

const Camera = (() => {

  /* NPF rule (Frédéric Michaud) — accurate max exposure for stars to appear sharp.
   * Pixel-aware version:
   *   shutterMax_s ≈ (k*N + μ*p + 35*N) / (f * cos(δ))
   *     k  = 35 (tightness coefficient; loosen to 50 for prints, 14 for 100% crop)
   *     N  = f-number
   *     μ  = pixel pitch in microns
   *     p  = print/critical-viewing scaling (we treat as 1.0)
   *     f  = focal length in mm
   *     δ  = star declination (rad) — we use 0 (equator) for the worst case
   * The conventional formula simplifies to:
   *     shutter = (35*N + 30*p_pitch_um) / focal_mm     (cos(0)=1)
   * which matches PhotoPills's "default accuracy" output.
   */
  function npfRule(focalMm, fNumber, pixelPitchUm, opts={}){
    const k = opts.tightness ?? 35;
    const cosDec = opts.declination != null ? Math.cos(opts.declination*Math.PI/180) : 1;
    const t = (k * fNumber + 30 * pixelPitchUm) / (focalMm * cosDec);
    return {seconds: t, formula: `(${k}*N + 30*μ) / (f * cos(δ))`};
  }

  function rule500(focalMm, cropFactor=1){
    return {seconds: 500 / (focalMm * cropFactor)};
  }
  function rule300(focalMm, cropFactor=1){
    return {seconds: 300 / (focalMm * cropFactor)};
  }

  /* Hyperfocal distance (m), near/far DOF (m) for a given subject distance */
  function hyperfocal(focalMm, fNumber, circleOfConfusionMm = 0.030){
    return (focalMm * focalMm) / (fNumber * circleOfConfusionMm) / 1000; // m
  }
  function depthOfField(focalMm, fNumber, subjectM, circleOfConfusionMm = 0.030){
    const H = hyperfocal(focalMm, fNumber, circleOfConfusionMm); // m
    const fM = focalMm / 1000;
    const near = (subjectM * (H - fM)) / (H + subjectM - 2*fM);
    let far;
    if(subjectM >= H){ far = Infinity; }
    else { far = (subjectM * (H - fM)) / (H - subjectM); }
    return {hyperfocal:H, near, far};
  }

  /* Default circle of confusion: sensor diagonal / 1500 in mm */
  function cocForSensor(widthMm, heightMm){
    return Math.sqrt(widthMm*widthMm + heightMm*heightMm) / 1500;
  }

  /* Field of view in degrees, given focal length and sensor dims (mm) */
  function fov(focalMm, sensorWidthMm, sensorHeightMm){
    const hF = 2*Math.atan(sensorWidthMm  / (2*focalMm)) * 180/Math.PI;
    const vF = 2*Math.atan(sensorHeightMm / (2*focalMm)) * 180/Math.PI;
    const dF = 2*Math.atan(Math.sqrt(sensorWidthMm*sensorWidthMm + sensorHeightMm*sensorHeightMm)
                           / (2*focalMm)) * 180/Math.PI;
    return {h:hF, v:vF, d:dF};
  }

  /* 35mm-equivalent focal length */
  function eq35(focalMm, cropFactor){ return focalMm * cropFactor; }

  /* Stacking math */
  function snrGain(numSubs){ return Math.sqrt(numSubs); }
  function integrationTime(numSubs, secsEach){
    const total = numSubs * secsEach;
    return {
      totalSec: total,
      humanReadable: humanDuration(total),
      snrMultiplier: snrGain(numSubs)
    };
  }
  function humanDuration(sec){
    const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = Math.round(sec%60);
    return (h?h+'h ':'') + (m?m+'m ':'') + s+'s';
  }
  function subsNeededFor(snrMultiplier){
    return Math.ceil(snrMultiplier*snrMultiplier);
  }

  /* Sample suggested settings given target type + camera + lens */
  function suggestSettings(target, camera, lens){
    /* target: 'milky-way' | 'star-field' | 'moon' | 'planets' | 'deep-sky-tracked' | 'star-trails' */
    const f = lens.focalMin === lens.focalMax ? lens.focalMin : Math.round((lens.focalMin + lens.focalMax)/2);
    const fnum = lens.apertureMin;
    const pitch = camera.pixelPitch;
    const npf = npfRule(f, fnum, pitch);
    const baseShutter = Math.max(1, Math.floor(npf.seconds*10)/10);
    switch(target){
      case 'milky-way':
        return {iso: 3200, aperture: fnum, shutter: baseShutter,
                whiteBalance: 4000, format:'RAW',
                notes:`NPF rule = ${npf.seconds.toFixed(1)}s for ${f}mm @ f/${fnum} on ${pitch}µm pixels`};
      case 'star-field':
        return {iso: 1600, aperture: fnum*1.4, shutter: baseShutter,
                whiteBalance: 4000, format:'RAW', notes:'Stop down slightly for sharper corners'};
      case 'moon':
        return {iso: 100, aperture: 8, shutter: 1/250,
                whiteBalance: 4000, format:'RAW',
                notes: f>=200 ? 'Use shutter 1/250 at f/8 for full moon at 200mm+' : 'Use longest lens you have'};
      case 'planets':
        return {iso: 400, aperture: 5.6, shutter: 1/30,
                whiteBalance: 4000, format:'RAW',
                notes:'Stack 1000+ frames at 60fps from video for lucky imaging'};
      case 'deep-sky-tracked':
        return {iso: 800, aperture: fnum*1.4, shutter: 120,
                whiteBalance: 4000, format:'RAW',
                notes:'Requires star tracker. Take 20-50 subs and stack in Siril.'};
      case 'star-trails':
        return {iso: 400, aperture: fnum*1.4, shutter: 30,
                whiteBalance: 4000, format:'RAW',
                notes:'Take 100-300 consecutive 30s exposures, stack in StarStaX or Siril.'};
    }
    return null;
  }

  return {
    npfRule, rule500, rule300,
    hyperfocal, depthOfField, cocForSensor,
    fov, eq35,
    snrGain, integrationTime, subsNeededFor, humanDuration,
    suggestSettings
  };
})();

if(typeof module !== 'undefined') module.exports = Camera;
if(typeof window !== 'undefined') window.Camera = Camera;
