/* Luna: fase y horas de salida y puesta, calculadas en local (sin red). Las fórmulas de posición y la búsqueda de
   cruces con el horizonte son las de SunCalc (Vladimir Agafonkin, BSD-2), reducidas a lo que se usa aquí.
   Luna.fase(fecha) → { p, ilum, nombre, diasLlena }; Luna.horas(fecha, lat, lon) → { sale?: Date, pone?: Date }. */
(function () {
  'use strict';

  const rad = Math.PI / 180, diaMs = 86400000, J1970 = 2440588, J2000 = 2451545, e = rad * 23.4397;
  const dias = d => d.valueOf() / diaMs - 0.5 + J1970 - J2000;
  const ascension = (l, b) => Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
  const declinacion = (l, b) => Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
  const sidereo = (d, lw) => rad * (280.16 + 360.9856235 * d) - lw;
  const refraccion = h => { if (h < 0) h = 0; return 0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179)); };

  function altura(fecha, lat, lon) {
    const d = dias(fecha), lw = rad * -lon, phi = rad * lat;
    const L = rad * (218.316 + 13.176396 * d), M = rad * (134.963 + 13.064993 * d), F = rad * (93.272 + 13.229350 * d);
    const l = L + rad * 6.289 * Math.sin(M), b = rad * 5.128 * Math.sin(F);
    const ra = ascension(l, b), dec = declinacion(l, b);
    const H = sidereo(d, lw) - ra;
    const h = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
    return h + refraccion(h);
  }

  // Salida y puesta del día de «fecha» (desde la medianoche local), buscando cruces con el horizonte cada 2 h.
  function horas(fecha, lat, lon) {
    const t = new Date(fecha);
    t.setHours(0, 0, 0, 0);
    const mas = h => new Date(t.valueOf() + h * 3600000);
    const hc = 0.133 * rad;
    let h0 = altura(t, lat, lon) - hc, sale, pone;
    for (let i = 1; i <= 24; i += 2) {
      const h1 = altura(mas(i), lat, lon) - hc, h2 = altura(mas(i + 1), lat, lon) - hc;
      const a = (h0 + h2) / 2 - h1, b = (h2 - h0) / 2, xe = -b / (2 * a), ye = (a * xe + b) * xe + h1, d = b * b - 4 * a * h1;
      let raices = 0, x1 = 0, x2 = 0;
      if (d >= 0) {
        const dx = Math.sqrt(d) / (Math.abs(a) * 2);
        x1 = xe - dx; x2 = xe + dx;
        if (Math.abs(x1) <= 1) raices++;
        if (Math.abs(x2) <= 1) raices++;
        if (x1 < -1) x1 = x2;
      }
      if (raices === 1) { if (h0 < 0) sale = i + x1; else pone = i + x1; }
      else if (raices === 2) { sale = i + (ye < 0 ? x2 : x1); pone = i + (ye < 0 ? x1 : x2); }
      if (sale !== undefined && pone !== undefined) break;
      h0 = h2;
    }
    return { sale: sale !== undefined ? mas(sale) : null, pone: pone !== undefined ? mas(pone) : null };
  }

  function fase(fecha) {
    const sinodico = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14) / diaMs;
    const p = ((fecha.valueOf() / diaMs - ref) % sinodico + sinodico) % sinodico / sinodico;
    const ilum = (1 - Math.cos(2 * Math.PI * p)) / 2;
    let nombre;
    if (p < .03 || p > .97) nombre = 'Luna nueva';
    else if (p < .22) nombre = 'Luna creciente';
    else if (p < .28) nombre = 'Cuarto creciente';
    else if (p < .47) nombre = 'Gibosa creciente';
    else if (p < .53) nombre = 'Luna llena';
    else if (p < .72) nombre = 'Gibosa menguante';
    else if (p < .78) nombre = 'Cuarto menguante';
    else nombre = 'Luna menguante';
    return { p, ilum, nombre, diasLlena: Math.round(((.5 - p + 1) % 1) * sinodico) };
  }

  // Trazado del disco iluminado (círculo de radio 11 centrado en 16,16), para un <path> dentro de viewBox 0 0 32 32.
  function trazo(f) {
    if (f.ilum < .02) return '';
    const r = 11, rx = Math.abs(Math.cos(2 * Math.PI * f.p)) * r, crece = f.p < .5, giba = f.ilum > .5;
    const ter = crece ? (giba ? 1 : 0) : (giba ? 0 : 1);
    return `M16 5 A${r} ${r} 0 0 ${crece ? 1 : 0} 16 27 A${rx.toFixed(2)} ${r} 0 0 ${ter} 16 5Z`;
  }

  window.Luna = { fase, horas, trazo };
})();
