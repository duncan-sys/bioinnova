// ── Metas de venta por comercial ─────────────────────────────────────────────
// Cálculo puro: no toca el DOM ni el localStorage. La pantalla vive en index.html.
// Se prueba desde tests.html.

// Índices estacionales de la facturación, calculados sobre 2024+2025+2026 del EERR
// (promedio de mes/media del año, amortiguado al 65% y normalizado a media 1,0).
// Suman 12,0000. Vienen del análisis financiero para el Directorio: si se recalculan
// allá, actualizarlos acá también.
const META_IDX = [1.0186, 1.0172, 0.8103, 0.8459, 1.0464, 0.9471, 0.9091, 1.2979, 1.1185, 1.3269, 0.7180, 0.9441];

function metaIdx(mes){ const i = (Number(mes) || 1) - 1; return META_IDX[i] != null ? META_IDX[i] : 1; }

// 'YYYY-MM' → {a, m}; tolera basura.
function ymParse(ym){
  const p = String(ym || '').split('-');
  const a = parseInt(p[0], 10), m = parseInt(p[1], 10);
  return (a > 0 && m >= 1 && m <= 12) ? { a, m } : null;
}
function ymDe(a, m){ return String(a) + '-' + String(m).padStart(2, '0'); }
// Corre n meses hacia atrás (n>0) o adelante (n<0).
function ymSuma(ym, n){
  const p = ymParse(ym); if(!p) return '';
  let t = p.a * 12 + (p.m - 1) + Number(n || 0);
  return ymDe(Math.floor(t / 12), (t % 12 + 12) % 12 + 1);
}

// Reparte un total anual entre los 12 meses según la estacionalidad.
// El redondeo se acumula en el último mes para que la suma dé exactamente el total.
function metaRepartirAnual(total, idx){
  const I = Array.isArray(idx) && idx.length === 12 ? idx : META_IDX;
  const T = Number(total) || 0;
  const suma = I.reduce((a, b) => a + (Number(b) || 0), 0) || 12;
  const out = []; let acum = 0;
  for(let m = 1; m <= 11; m++){
    const v = Math.round(T * (Number(I[m - 1]) || 0) / suma);
    out.push(v); acum += v;
  }
  out.push(Math.round(T) - acum);
  return out;
}

// Facturación de un comercial en un mes. Normaliza USD con el TC de cada venta.
// cmp: función que devuelve el nombre normalizado del comercial de una venta.
function facturadoMes(ventas, comercial, ym, cmp, gs){
  const C = String(comercial || '');
  return (ventas || []).reduce((a, v) => {
    if(String(v.fecha || '').slice(0, 7) !== ym) return a;
    if(cmp(v) !== C) return a;
    return a + gs(v, v.monto);
  }, 0);
}

// Promedio DESESTACIONALIZADO de los últimos n meses cerrados antes de hastaYm.
// Desestacionalizar es lo que hace comparable a noviembre (índice 0,718) con
// octubre (1,327): sin eso, un buen noviembre parece un mal mes.
// Ignora los meses sin ninguna venta: un mes en cero suele ser que el comercial
// no estaba, no que vendió cero.
function nivelDesest(ventas, comercial, hastaYm, n, cmp, gs){
  const N = Math.max(1, Number(n) || 3);
  let suma = 0, cuenta = 0, meses = [];
  for(let k = 1; k <= N; k++){
    const ym = ymSuma(hastaYm, -k); const p = ymParse(ym); if(!p) continue;
    const f = facturadoMes(ventas, comercial, ym, cmp, gs);
    meses.push({ ym, facturado: f, desest: f / metaIdx(p.m) });
    if(f > 0){ suma += f / metaIdx(p.m); cuenta++; }
  }
  return { nivel: cuenta ? suma / cuenta : 0, meses_usados: cuenta, meses };
}

// Meta anual sugerida = nivel desestacionalizado × 12 × (1 + crecimiento).
function sugerirMetaAnual(ventas, comercial, opts, cmp, gs){
  const o = opts || {};
  const hasta = o.hastaYm || '';
  const d = nivelDesest(ventas, comercial, hasta, o.meses || 6, cmp, gs);
  const g = Number(o.crecimiento) || 0;
  return {
    nivel: d.nivel,
    meses_usados: d.meses_usados,
    detalle: d.meses,
    anual: Math.round(d.nivel * 12 * (1 + g)),
    mensual_prom: Math.round(d.nivel * (1 + g))
  };
}

// Id estable de la fila. Normaliza acentos (í→i, ñ→n) para que dos nombres
// distintos no caigan en el mismo slug: sin eso "Peña" y "Pea" colisionarían
// y una meta pisaría a la otra.
function metaId(com, anio){
  const s = String(com || '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return 'META-' + anio + '-' + (s || 'sin-nombre');
}

// Meta de un comercial para un mes, desde la fila anual {anio, meses:[12]}.
function metaDelMes(fila, mes){
  if(!fila || !Array.isArray(fila.meses)) return 0;
  return Number(fila.meses[(Number(mes) || 1) - 1]) || 0;
}

function cumplimientoPct(facturado, meta){
  const M = Number(meta) || 0;
  if(M <= 0) return null;          // sin meta cargada no hay % que mostrar
  return (Number(facturado) || 0) / M;
}

// Tabla de posiciones de un mes. Incluye a los que tienen meta aunque no hayan
// facturado, y a los que facturaron aunque no tengan meta: esconder cualquiera
// de los dos casos es justo lo que haría perder credibilidad al cuadro.
// Ordena por % de cumplimiento (los sin meta van al final, por monto).
function rankingMes(ventas, metasFilas, ym, cmp, gs){
  const p = ymParse(ym); if(!p) return [];
  const nombres = new Set();
  (ventas || []).forEach(v => { if(String(v.fecha || '').slice(0, 7) === ym) nombres.add(cmp(v)); });
  (metasFilas || []).forEach(f => { if(Number(f.anio) === p.a && metaDelMes(f, p.m) > 0) nombres.add(String(f.comercial || '')); });
  const filas = [...nombres].map(c => {
    const fila = (metasFilas || []).find(f => String(f.comercial || '') === c && Number(f.anio) === p.a);
    const meta = metaDelMes(fila, p.m);
    const fact = facturadoMes(ventas, c, ym, cmp, gs);
    const pct = cumplimientoPct(fact, meta);
    return { comercial: c, meta, facturado: fact, pct, falta: Math.max(0, meta - fact), nfact: (ventas || []).filter(v => String(v.fecha || '').slice(0, 7) === ym && cmp(v) === c).length };
  });
  filas.sort((a, b) => {
    if(a.pct == null && b.pct == null) return b.facturado - a.facturado;
    if(a.pct == null) return 1;
    if(b.pct == null) return -1;
    return b.pct - a.pct;
  });
  filas.forEach((f, i) => f.pos = i + 1);
  return filas;
}

// Primer mes del año con alguna meta cargada. Es el arranque del programa:
// acumular desde enero cuando las metas empiezan en octubre compara las ventas
// de todo el año contra la meta de un mes solo, y el cumplimiento sale inflado.
// Devuelve 0 si ese año no tiene ninguna meta.
function primerMesConMeta(metasFilas, anio){
  let min = 13;
  (metasFilas || []).forEach(f => {
    if(Number(f.anio) !== Number(anio)) return;
    for(let m = 1; m <= 12; m++) if(metaDelMes(f, m) > 0 && m < min) min = m;
  });
  return min <= 12 ? min : 0;
}

// Acumulado DEL PERÍODO CON METAS, hasta el mes inclusive. No arranca en enero:
// arranca en el primer mes con meta cargada, así ventas y meta cubren el mismo
// tramo. Si el mes pedido es anterior a ese arranque, no hay nada que comparar.
function acumuladoAnio(ventas, metasFilas, ym, cmp, gs){
  const p = ymParse(ym); if(!p) return [];
  const desde = primerMesConMeta(metasFilas, p.a);
  if(!desde || p.m < desde) return [];
  const nombres = new Set();
  (ventas || []).forEach(v => { const q = ymParse(String(v.fecha || '').slice(0, 7)); if(q && q.a === p.a && q.m >= desde && q.m <= p.m) nombres.add(cmp(v)); });
  (metasFilas || []).forEach(f => { if(Number(f.anio) === p.a) nombres.add(String(f.comercial || '')); });
  return [...nombres].map(c => {
    const fila = (metasFilas || []).find(f => String(f.comercial || '') === c && Number(f.anio) === p.a);
    let meta = 0, fact = 0;
    for(let m = desde; m <= p.m; m++){
      meta += metaDelMes(fila, m);
      fact += facturadoMes(ventas, c, ymDe(p.a, m), cmp, gs);
    }
    return { comercial: c, meta, facturado: fact, pct: cumplimientoPct(fact, meta), falta: Math.max(0, meta - fact), desde };
  }).sort((a, b) => {
    if(a.pct == null && b.pct == null) return b.facturado - a.facturado;
    if(a.pct == null) return 1; if(b.pct == null) return -1;
    return b.pct - a.pct;
  });
}

// Lo que falta por mes para cerrar el año en meta: sirve para empujar en el
// tramo final, cuando el acumulado ya se desvió.
function proyeccionCierre(acum, metaAnual, mesActual){
  const mesesRestantes = 12 - (Number(mesActual) || 1);
  const falta = Math.max(0, (Number(metaAnual) || 0) - (Number(acum) || 0));
  return { falta, meses_restantes: mesesRestantes, por_mes: mesesRestantes > 0 ? Math.round(falta / mesesRestantes) : falta };
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = { META_IDX, primerMesConMeta, metaId, metaIdx, ymParse, ymDe, ymSuma, metaRepartirAnual, facturadoMes, nivelDesest, sugerirMetaAnual, metaDelMes, cumplimientoPct, rankingMes, acumuladoAnio, proyeccionCierre };
}
