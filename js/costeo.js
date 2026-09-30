// ══════════════════════════════════════════════════════════════════════════
// BioInnova · MOTOR DE COSTEO
// Extraído de index.html para poder probarlo aislado (ver tests.html).
// Son funciones puras de cálculo: NO tocan el DOM.
// Dependen de globales que viven en index.html (PL_FORMULAS, PL_INSUMOS,
// getArr/setArr, getMovs, getVentas, hoy). Se resuelven en tiempo de llamada,
// así que este archivo se carga ANTES del script principal sin problema.
// ══════════════════════════════════════════════════════════════════════════

// Bolsas de un producto por kg de producción
function plKgBolsa(f){ return (f&&f.kg)||30; }
function plInsumo(cod){ return PL_INSUMOS.find(x=>x.c===cod); }
function plFormula(cod){ return PL_FORMULAS.find(x=>x.c===cod); }
// ── Lista de precios: respaldo manual para productos SIN fórmula (los que tienen fórmula se calculan) ──
const PL_PRECIOS_MANUAL=[];   // vaciado: el Excel es el maestro; los productos salen de sus fórmulas
const COND_LBL={p0:'Contado',p30:'Crédito 30 días',p60:'Crédito 60 días',p90:'Crédito 90 días',c2:'2 pagos (30 y 60)',c3:'3 pagos (30, 60 y 90)',c4:'4 pagos (30, 60, 90 y 120)'};
const COND_ORDER=['p0','p30','p60','p90','c2','c3','c4'];
// Vencimientos (días desde la fecha base) de cada forma de pago. Un solo pago = una sola fecha.
const FORMA_TERMS={p0:[0],p30:[30],p60:[60],p90:[90],c2:[30,60],c3:[30,60,90],c4:[30,60,90,120]};
// Meses de financiación para el COSTO FINANCIERO del precio = promedio ponderado de los vencimientos.
// Para las 4 condiciones simples da 0/1/2/3 (idéntico al cálculo anterior); las multi-pago suman el promedio.
function plazoMeses(cond){ const t=FORMA_TERMS[cond]; if(!t||!t.length) return 0; return t.reduce((a,d)=>a+d/30,0)/t.length; }
// Para productos SIN fórmula (lista manual) sólo hay precios p0/p30/p60/p90: a las multi-pago las
// aproximamos a la condición simple más cercana (conservador: cobra el plazo mayor de la cuota final).
function condManual(cond){ return {p0:'p0',p30:'p30',p60:'p60',p90:'p90',c2:'p60',c3:'p90',c4:'p90'}[cond]||'p0'; }
function getPreciosOv(){ return getArr('bio:precios'); }        // ediciones/altas del gerente (sync)
function savePreciosOv(a){ setArr('bio:precios',a); }
function precioKey(x){ return (x.c&&String(x.c).trim())?String(x.c).trim().toUpperCase():('N:'+String(x.n||'').trim().toUpperCase()); }
// ── MOTOR DE COSTEO ──────────────────────────────────────────
// Precio base ₲/kg de cada insumo (lo actualiza Guillermo). Base sembrada del Excel.
const PL_INSPREC={
'INS038':13987,'INS056':7420,'INS040':155,'INS007':1619,'INS050':4367,'INS075':331,'INS019':90,'INS039':20687,'INS048':12602,'INS014':3649,'INS074':565282,'INS049':26305,'INS037':7420,'INS071':11181,'INS058':1175,'INS047':15264,'INS041':1755,'INS046':3407,'INS045':5813,'INS042':1329,'INS002':1303,'INS008':1847,'INS031':2455,'INS001':1078,'INS015':5476,'INS070':4229,'INS030':1936,'INS003':876,'INS027':11327,'INS022':436,'INS076':54900,'INS077':67100,'INS073':156000
};
// Parámetros de costeo (globales, editables por el gerente)
// `margen` y `margen_sal` son MARGEN SOBRE VENTA NETA (no markup sobre costo).
// Calibrados el 30/09/2026 para que el precio de CONTADO no se moviera al pasar
// del markup encadenado a la fórmula inversa: markup 25% ≡ margen 19,08% y
// markup 15% (sal) ≡ margen 12,39%. Las condiciones a crédito suben hasta ~1%
// porque antes el recargo por plazo no alcanzaba a cubrir el costo financiero.
// mano_obra / bolsa / etiqueta_bolsa quedan sólo como respaldo: el costo sale
// del código que declara la fórmula (ver costoProduccionKg).
const PL_COSTCFG={ merma:0.03, mano_obra:90, bolsa:90, etiqueta_bolsa:331, gastos_adm:0.04, comision:0.04, margen:0.1908, margen_sal:0.1239, plazo_mes:0.01, iva:0.10, flete_kg:0, dolar:6100 };
const PL_MARGEN={};   // margen por producto (override); default = cfg.margen
function getInsPrecOv(){ return getArr('bio:insprec'); }
function saveInsPrecOv(a){ setArr('bio:insprec',a); }
// Promedio ponderado del costo del stock EN MANO (promedio móvil perpetuo), por insumo, desde los movimientos.
// Una compra barata se mezcla con el stock viejo más caro según las cantidades → no tira el precio de golpe.
let _wavgCache=null;
function _computeWavg(){ const map={}, byIns={};
  (typeof getMovs==='function'?getMovs():[]).forEach(m=>{ if(!m.insumo_c) return; (byIns[m.insumo_c]=byIns[m.insumo_c]||[]).push(m); });
  Object.keys(byIns).forEach(c=>{ const movs=byIns[c].slice().sort((a,b)=>String(a.fecha||'').localeCompare(String(b.fecha||''))||String(a.ts||'').localeCompare(String(b.ts||'')));
    let stock=0, avg=0, hubo=false;
    movs.forEach(m=>{ const q=Math.abs(Number(m.cant)||0);
      if(m.tipo==='ingreso'){ const cu=(m.costo!=null&&m.costo!=='')?Number(m.costo):avg; const ns=stock+q; avg = ns>0 ? (stock*avg + q*cu)/ns : cu; stock=ns; if(m.costo!=null&&Number(m.costo)>0) hubo=true; }
      else if(m.tipo==='egreso'){ stock=Math.max(0,stock-q); }
      else { stock=Math.max(0, stock+(Number(m.cant)||0)); } });   // ajuste: al costo promedio vigente
    if(hubo && avg>0) map[c]=Math.round(avg);
  });
  return map;
}
function insWavg(c){ if(!_wavgCache) _wavgCache=_computeWavg(); return _wavgCache[c]!=null?_wavgCache[c]:null; }
// Precio ₲/kg de un insumo para cotizar: override manual (🧪) → promedio ponderado de compras → default de fábrica
function insPrecio(c){ const o=getInsPrecOv().find(x=>x.c===c); if(o) return Number(o.gskg)||0; const w=insWavg(c); if(w!=null&&w>0) return w; return PL_INSPREC[c]||0; }
function getCostCfg(){ let o={}; try{ o=JSON.parse(localStorage.getItem('bio:costcfg'))||{}; }catch{} return Object.assign({},PL_COSTCFG,o); }
function saveCostCfg(o){ try{ localStorage.setItem('bio:costcfg',JSON.stringify(o)); }catch{} if(typeof pushPricingCfg==='function') pushPricingCfg(); }
function getMargenOv(){ let o={}; try{ o=JSON.parse(localStorage.getItem('bio:margen'))||{}; }catch{} return o; }
// `pct` entra como MARGEN sobre venta (lo que muestra la interfaz) y se guarda
// convertido a markup, que es el formato histórico de esta clave.
function setMargenOv(cod,pct){ const o=getMargenOv(); if(pct==null||pct==='') delete o[cod]; else o[cod]=_margenAMarkup(Number(pct)); try{ localStorage.setItem('bio:margen',JSON.stringify(o)); }catch{} if(typeof pushPricingCfg==='function') pushPricingCfg(); }
// ¿Es sal mineral? (código BIOSAL o nombre lo indica) → usa el margen de sal por defecto
function esSalMineral(cod,nombre){ return /^BIOSAL/i.test(cod||'') || /biosal|sal\s*mineral/i.test(nombre||''); }
// ── Markup ↔ margen sobre venta ─────────────────────────────────────────────
// Hasta el 30/09/2026 el precio se formaba con markup encadenado:
//     precio_neto = C × (1+markup) × (1+comisión)
// Ahora se forma despejando el margen sobre la venta:
//     precio_neto = C / (1 − margen − comisión − financiación)
// Los porcentajes por producto guardados en `bio:margen` siguen estando en
// unidades de MARKUP (así se cargaron), así que se convierten al leerlos y se
// re-convierten al guardarlos: el formato almacenado no cambia y no hizo falta
// ninguna migración. La equivalencia se calibra a CONTADO (financiación 0), que
// es el precio de referencia de la lista.
function _markupAMargen(mk, com){ const c=(com!=null?com:(getCostCfg().comision||0));
  return 1 - c - 1/((1+(Number(mk)||0))*(1+c)); }
function _margenAMarkup(mg, com){ const c=(com!=null?com:(getCostCfg().comision||0));
  const d=1-(Number(mg)||0)-c; return d>0 ? (1/(d*(1+c)))-1 : 0; }
// Margen objetivo (sobre venta neta) de un producto: override individual → default por línea
function margenDe(cod, nombre){ const ov=getMargenOv();
  if(cod&&ov[cod]!=null) return _markupAMargen(Number(ov[cod]));   // lo guardado es markup
  const cfg=getCostCfg(); return esSalMineral(cod,nombre) ? (cfg.margen_sal!=null?cfg.margen_sal:0.1239) : cfg.margen; }
// Costo ₲/kg de la mezcla. Incluye el secuestrante en las fórmulas que llevan
// maíz: la Zeolítica se agrega al 0,3% POR ENCIMA del 100% y se consume de
// verdad en la producción, así que su costo tiene que estar en el precio.
function costoBaseFormula(f){
  let base=(f.ins||[]).filter(i=>i.t==='p').reduce((a,i)=>a+(Number(i.p)/100)*insPrecio(i.c),0);
  // Secuestrante: ya NO se agrega automáticamente. Las fórmulas del Excel que llevan Zeolita (INS070) la traen como componente.
  return base; }
// Envase ₲/kg: el precio real de LA bolsa de esta fórmula, repartido en sus kg.
// Una sola constante no sirve porque el precio depende del tamaño (57x80 a
// 2.045 para 30 kg, 60x100 a 2.455 para 40 kg, Confi 4 a 3.409 para 20 kg).
// Si la fórmula no declara bolsa, o esa bolsa no tiene precio, cae en cfg.bolsa.
function bolsaKgDe(f){ const cfg=getCostCfg(); const kgB=plKgBolsa(f)||0;
  const l=(f&&f.ins||[]).find(i=>i.t==='b' && !/etiq/i.test(i.n||''));
  const p=l?insPrecio(l.c):0;
  return (p>0 && kgB) ? p/kgB : (cfg.bolsa||0); }
// ═══════════════════════════════════════════════════════════════════════════
//  MOTOR ÚNICO DE COSTO Y RENTABILIDAD
//  Todas las pantallas de cotización pasan por acá. Si hay que cambiar una
//  fórmula, se cambia una sola vez.
//
//  Orden comercial (el flete va AL FINAL, después del IVA):
//     costo producción → margen → comisión → financiación = VENTA NETA
//     VENTA NETA + IVA = precio del producto c/IVA
//     precio del producto c/IVA + FLETE = precio final al cliente
//
//  Bases: la comisión y la financiación se calculan sobre la VENTA NETA.
//  Nunca sobre el IVA (no es ingreso) ni sobre el flete (es un pasamanos).
// ═══════════════════════════════════════════════════════════════════════════

// Costo de producción ₲/kg, con el detalle de dónde salió cada parte.
// La FÓRMULA manda: mano de obra, bolsa y etiqueta se cobran al precio del
// código que la fórmula declara. cfg.* queda sólo como respaldo para fórmulas
// viejas o incompletas, y cuando se usa queda anotado en `fallbacks` para poder
// auditarlo.
function costoProduccionKg(f){
  const cfg=getCostCfg(), kgB=plKgBolsa(f)||0, fallbacks=[];
  const materias = costoBaseFormula(f);                         // NO se normaliza: las Z suman 100,30 a propósito
  const conMerma = materias*(1+(cfg.merma||0));                 // la merma es sólo sobre materias primas
  const lMano = (f&&f.ins||[]).find(i=>i.t==='m');
  let mano = lMano ? insPrecio(lMano.c) : 0;
  if(!mano){ mano = cfg.mano_obra||0; fallbacks.push('mano_obra'); }
  const lBolsa = (f&&f.ins||[]).find(i=>i.t==='b' && !/etiq/i.test(i.n||''));
  let bolsa = (lBolsa && kgB) ? insPrecio(lBolsa.c)/kgB : 0;
  if(!bolsa){ bolsa = cfg.bolsa||0; fallbacks.push('bolsa'); }
  const lEtiq = (f&&f.ins||[]).find(i=>i.t==='b' && /etiq/i.test(i.n||''));
  let etiq = (lEtiq && kgB) ? insPrecio(lEtiq.c)/kgB : 0;
  if(!etiq){ etiq = kgB ? (cfg.etiqueta_bolsa||0)/kgB : 0; fallbacks.push('etiqueta'); }
  const subtotal = conMerma + mano + bolsa + etiq;
  const adm = subtotal*(cfg.gastos_adm||0);
  return { materias, merma:conMerma-materias, mano_obra:mano, bolsa, etiqueta:etiq,
           subtotal_produccion:subtotal, gastos_adm:adm, costo_kg:subtotal+adm, fallbacks };
}

// Tasa financiera total de una condición de pago (ej. crédito 90 → 3 meses × 1% = 3%).
function tasaFinanciera(cond){ const cfg=getCostCfg(); return plazoMeses(cond)*(cfg.plazo_mes||0); }

// ── LA función. Dado el precio del producto c/IVA, devuelve toda la economía.
// Es la única fuente de verdad: la usan el detalle de costos, el lector de
// margen del modal, los totales y el snapshot.
function economiaLinea(o){
  const cfg=getCostCfg();
  const iva     = (o.iva!=null?o.iva:(cfg.iva||0));
  const kg      = Number(o.kg)||0;
  const pProdIva= Number(o.precioProductoIva)||0;          // ₲/kg del producto, IVA incluido, SIN flete
  const fleteKg = Number(o.fleteKg)||0;
  const comPct  = (o.comPct!=null?o.comPct:(cfg.comision||0));
  const finPct  = (o.finPct!=null?o.finPct:tasaFinanciera(o.cond));
  const costoKg = Number(o.costoProdKg)||0;

  const ventaNetaKg = iva ? pProdIva/(1+iva) : pProdIva;
  const ivaKg       = pProdIva - ventaNetaKg;
  const venta_neta  = ventaNetaKg*kg;
  const comision_gs = venta_neta*comPct;                    // sobre venta neta: ni IVA ni flete
  const fin_gs      = venta_neta*finPct;                    // ídem
  const costo_produccion = costoKg*kg;
  const margen_gs   = venta_neta - costo_produccion - comision_gs - fin_gs;
  return {
    version_costeo:2, kg,
    costo_produccion_kg:costoKg, costo_produccion,
    venta_neta_kg:ventaNetaKg, venta_neta,
    iva_pct:iva, iva_gs:ivaKg*kg,
    precio_producto_iva_kg:pProdIva, precio_producto_iva:pProdIva*kg,
    flete_kg:fleteKg, flete_gs:fleteKg*kg,
    precio_final_kg:pProdIva+fleteKg, precio_final:(pProdIva+fleteKg)*kg,
    comision_pct:comPct, comision_gs,
    fin_pct:finPct, fin_gs,
    margen_gs, margen_pct: venta_neta? (margen_gs/venta_neta)*100 : 0,
    // Markup sobre costo: OTRO indicador, se muestra aparte y nunca se llama margen.
    markup_pct: costo_produccion? ((venta_neta-costo_produccion)/costo_produccion)*100 : 0
  };
}

// ── La inversa: dado un margen objetivo, qué precio hay que cobrar.
// venta_neta = C / (1 − margen − comisión − financiación)
function precioDesdeMargen(o){
  const cfg=getCostCfg();
  const iva   = (o.iva!=null?o.iva:(cfg.iva||0));
  const C     = Number(o.costoProdKg)||0;
  const m     = Number(o.margen)||0;
  const c     = (o.comPct!=null?o.comPct:(cfg.comision||0));
  const fi    = (o.finPct!=null?o.finPct:tasaFinanciera(o.cond));
  const base  = 1 - m - c - fi;
  if(base<=0) return { error:'Margen + comisión + financiación dejan una base inválida para formar el precio.', base };
  const ventaNetaKg = C/base;
  return { venta_neta_kg:ventaNetaKg, precio_producto_iva_kg:ventaNetaKg*(1+iva), base };
}

// Precio ₲/kg del producto CON IVA y SIN flete, para una condición y un margen objetivo.
function precioBaseKg(f, cond, margen, comPct){
  const r = precioDesdeMargen({ costoProdKg:costoProduccionKg(f).costo_kg, margen, comPct, cond });
  return r.error ? 0 : Math.round(r.precio_producto_iva_kg);
}
function precioProducto(f){ const kg=plKgBolsa(f); const m=margenDe(f.c, f.n); const fk=(getCostCfg().flete_kg||0);
  return { c:f.c||'', n:f.n, kg, base:Math.round(costoBaseFormula(f)), p0:precioBaseKg(f,'p0',m)+fk, p30:precioBaseKg(f,'p30',m)+fk, p60:precioBaseKg(f,'p60',m)+fk, p90:precioBaseKg(f,'p90',m)+fk, calc:true }; }
// ── Productos INACTIVOS ─────────────────────────────────────────────────────
// Productos que dejaron de venderse. NO se borran: la fórmula sigue entera en
// PL_FORMULAS, así que formulaDeKey() la resuelve y una cotización, venta u OT
// vieja se abre completa — nunca como "producto inexistente".
// Lo único que cambia es que desaparecen del lado COMERCIAL: lista de precios,
// catálogo, nueva cotización y nueva OT.
// Va como constante y no como fila en la nube a propósito: es una decisión
// comercial, viaja con el deploy, queda igual en todos los equipos al instante
// y es rastreable en el historial de git. El overlay `borrado` de bio_precios
// sigue funcionando en paralelo para las bajas que se hacen desde la app.
// Para reactivar un producto: sacarlo de esta lista y publicar.
const PRODUCTOS_INACTIVOS = new Set([
  'BAL013',      // Terminacion OR - 40kg
  'BIOSAL06',    // Biosal Ureada - 30kg
  'PRO006-GP',   // Bioinnovas Secas Extras - GP - 30 KG
  'BAL007',      // Bioinnova Terminacion 18% - 40 kg
  'PRO010',      // Bioinnova Creep Feeding B - 30 kg
  'NCL003',      // Bioinnova Confi 4 AS - 25 KG
  'NCL006',      // Bioinnova Confi 4 L - 25 KG
  'NCL007',      // Bioinnova Confi 4 O - 25 KG
  'BAL003-GP'    // su composición pasó a ser la de BAL003 (30/09/2026). Se conserva la
                 // fórmula para que las cotizaciones y OT que lo usaron sigan costeando.
]);
// ¿Se puede usar este producto en una operación NUEVA?
function esActivo(key){ return !PRODUCTOS_INACTIVOS.has(String(key||'').trim().toUpperCase()); }

// Lista efectiva: productos con fórmula = calculados; sin fórmula = manual (respaldo) + altas/ediciones del gerente
function precioList(){ const m={};
  PL_FORMULAS.forEach(f=>{ const p=precioProducto(f); m[precioKey(p)]=p; });
  PL_PRECIOS_MANUAL.forEach(p=>{ const k=precioKey(p); if(!m[k]) m[k]=Object.assign({calc:false},p); });
  getPreciosOv().forEach(o=>{ if(o&&o.borrado){ delete m[precioKey(o)]; return; } const k=precioKey(o); m[k]=Object.assign({},m[k]||{},o,{calc:false}); });
  return Object.values(m).filter(p=>!p.borrado && esActivo(precioKey(p))).sort((a,b)=>String(a.n||'').localeCompare(String(b.n||''))); }

// ── Cuotas (vencimientos y reparto del monto) ──
function _finAddDays(fecha,d){ const dt=new Date((fecha||hoy())+'T00:00:00'); dt.setDate(dt.getDate()+d); const y=dt.getFullYear(),m=String(dt.getMonth()+1).padStart(2,'0'),da=String(dt.getDate()).padStart(2,'0'); return y+'-'+m+'-'+da; }
function finGenCuotas(fecha,monto,terms){ const n=terms.length||1; const base=Math.round(monto/n); return terms.map((d,i)=>({ n:i+1, venc:_finAddDays(fecha,d), monto:(i===n-1?monto-base*(n-1):base), abonos:[] })); }

// ---- Costo real de una venta ----------------------------------------------
// Costo de producción por kg: la misma cadena que arma el precio pero SIN
// margen, plazo ni IVA — insumos + merma + mano de obra + bolsa + etiqueta,
// más gastos administrativos.
// Se conserva el nombre por compatibilidad: ahora es un atajo a costoProduccionKg,
// que toma mano de obra, bolsa y etiqueta del código que declara la fórmula.
function costoProdKg(f){ return costoProduccionKg(f).costo_kg; }
// ── Sucesión de fórmulas ───────────────────────────────────────────────────
// Cuando un código comercial cambia de fórmula, el código sigue siendo el mismo
// pero la composición no. Los documentos viejos guardan el CÓDIGO, así que sin
// esto una cotización de antes del cambio se recostearía con la fórmula nueva y
// mostraría un margen que nunca existió.
// Acá se anota desde cuándo rige la fórmula nueva y bajo qué código quedó la
// vieja: un documento anterior a esa fecha se resuelve contra la fórmula que
// regía ese día. Así "BAL003 histórico" y "BAL003 nuevo" conviven sin tocar un
// solo documento emitido.
const FORMULA_SUCESION = {
  // BAL003 pasó a llevar la composición que tenía BAL003-GP (30/09/2026).
  // La fórmula anterior se conserva íntegra bajo el código BAL003-M.
  'BAL003': [ { hasta:'2026-09-30', codigo:'BAL003-M' } ]
};
// Fórmula de un código. Con `fecha` (la del documento) devuelve la que regía ese
// día; sin fecha, la vigente. Un código inactivo también se resuelve: inactivar
// no borra, así que los históricos nunca quedan huérfanos.
function formulaDeKey(key, fecha){
  const k = String(key||'').trim().toUpperCase();
  const hist = FORMULA_SUCESION[k];
  if(hist && fecha){ const f = String(fecha).slice(0,10);
    for(const tramo of hist){ if(f < tramo.hasta){ const ant = PL_FORMULAS.find(x=>precioKey(x)===tramo.codigo); if(ant) return ant; } } }
  return PL_FORMULAS.find(f2=>precioKey(f2)===k)||null;
}
// Comisión efectiva de un documento (cotización/venta). tipo: 'pct' (default) usa un % ; 'monto' un ₲ fijo.
// val = número crudo del formulario (porcentaje ej. 4, o monto en ₲). Devuelve {tipo, pct, monto}.
function comisionDoc(tipo, val){ const cfg=getCostCfg();
  if(tipo==='monto'){ return {tipo:'monto', pct:Number(cfg.comision)||0, monto:Math.round(Number(val)||0)}; }
  const p=(val!=null&&val!=='')?(Number(val)/100):(Number(cfg.comision)||0);
  return {tipo:'pct', pct:p, monto:null}; }
// Desglose de costo CONGELABLE de una línea: separa el costo de producción en sus partes y
// snapshotea los insumos con su costo unitario del momento. Se guarda tal cual en la venta para
// que el margen histórico no cambie si después se mueven los precios de insumos.
function desgloseCostoLinea(f, it, fleteKg, com, cond){ const cfg=getCostCfg();
  const kg=Number(it.kg)||0; const kgB=Number(it.kg_bolsa)||plKgBolsa(f)||0;
  const bolsas = it.unidad==='bolsa' ? (Number(it.cantidad)||0) : (kgB?Math.round(kg/kgB):0);
  const cp = costoProduccionKg(f);
  // precio_base = ₲/kg del producto CON IVA y SIN flete (el flete se suma después).
  // En documentos viejos sin precio_base se cae a precio_kg, que sí lo incluye: se descuenta.
  const fk = Number(fleteKg)||0;
  const pProdIva = Number(it.precio_base!=null ? it.precio_base : ((Number(it.precio_kg)||0)-fk))||0;
  const e = economiaLinea({ kg, precioProductoIva:pProdIva, fleteKg:fk, costoProdKg:cp.costo_kg,
                            comPct:(com&&com.tipo==='monto')?0:((com&&com.pct)||0),   // el monto fijo se prorratea aparte
                            cond:(cond||it.cond||'') });
  // Detalle de insumos al precio del momento (código, nombre, cantidad, ₲/u, ₲ total)
  const insumos=[];
  (f.ins||[]).forEach(i=>{ if(i.t==='p'){ const cant=Math.round(kg*(i.p/100)*100)/100; const cu=insPrecio(i.c); insumos.push({c:i.c,n:i.n,cant,unidad:'kg',cu,ct:Math.round(cant*cu)}); } });
  const bl=(f.ins||[]).find(x=>x.t==='b'&&!/etiq/i.test(x.n||'')); if(bl){ const cu=insPrecio(bl.c); insumos.push({c:bl.c,n:bl.n,cant:bolsas,unidad:'u',cu,ct:Math.round(bolsas*cu)}); }
  const et=(f.ins||[]).find(x=>x.t==='b'&&/etiq/i.test(x.n||'')); if(et){ const cu=insPrecio(et.c); insumos.push({c:et.c,n:et.n,cant:bolsas,unidad:'u',cu,ct:Math.round(bolsas*cu)}); }
  const lm=(f.ins||[]).find(x=>x.t==='m'); if(lm){ const cu=insPrecio(lm.c); insumos.push({c:lm.c,n:lm.n,cant:kg,unidad:'kg',cu,ct:Math.round(kg*cu)}); }
  return Object.assign({}, e, {
    fecha_costeo:new Date().toISOString(), bolsas, fallbacks:cp.fallbacks,
    // partes del costo de producción, ya multiplicadas por los kg de la línea
    c_materias:Math.round(cp.materias*kg), c_merma:Math.round(cp.merma*kg), c_mano:Math.round(cp.mano_obra*kg),
    c_bolsa:Math.round(cp.bolsa*kg), c_etiqueta:Math.round(cp.etiqueta*kg), c_adm:Math.round(cp.gastos_adm*kg),
    insumos,
    // Compatibilidad con los snapshots v1 y con el HTML del detalle
    sub:e.venta_neta, c_insumos:Math.round((cp.materias+cp.merma)*kg), c_flete:e.flete_gs,
    c_comision:Math.round(e.comision_gs), c_iva_info:Math.round(e.iva_gs),
    costo_total:Math.round(e.costo_produccion+e.comision_gs+e.fin_gs),
    margen:Math.round(e.margen_gs), margen_pct:e.margen_pct
  }); }
// Costea las líneas de una cotización. COSTO COMPLETO = producción + flete +
// comisión. Se calcula UNA vez, al vincular la factura, y queda congelado: si
// después cambian los precios de insumos, el margen de esta venta no se mueve.
// Los productos sin fórmula no tienen costo calculable → quedan "sin costeo",
// que no es lo mismo que costo cero.
function costearItems(items, fleteKg, com, cond, fechaDoc){ const cfg=getCostCfg(); com=com||comisionDoc('pct',null); let total=0, sin=0;
  let lineas=(items||[]).map(it=>{
    const f=formulaDeKey(it.key, fechaDoc), kg=Number(it.kg)||0, sub=Number(it.subtotal)||0;   // fechaDoc: costear con la fórmula que regía ese día
    if(!f){ sin++; return Object.assign({},it,{sin_costeo:true, subtotal:sub}); }
    const dg=desgloseCostoLinea(f, it, fleteKg, com, cond);
    total+=dg.costo_total;
    return Object.assign({},it,{costo_prod:Math.round(dg.costo_produccion), costo_flete:dg.c_flete, costo_comision:dg.c_comision, costo:dg.costo_total, desglose:dg});
  });
  // Comisión en monto fijo: se reparte entre las líneas costeadas a prorrata de la
  // VENTA NETA de cada una (no del subtotal bruto: el IVA y el flete no generan comisión).
  if(com.tipo==='monto' && com.monto>0){ const conF=lineas.filter(l=>!l.sin_costeo);
    const totNeto=conF.reduce((a,l)=>a+((l.desglose&&l.desglose.venta_neta)||0),0)||1; let acc=0;
    conF.forEach((l,i)=>{ const cm=(i===conF.length-1)?(com.monto-acc):Math.round(com.monto*((l.desglose&&l.desglose.venta_neta)||0)/totNeto); acc+=cm;
      l.costo_comision=cm; l.costo=(l.costo||0)+cm;
      if(l.desglose){ const d=l.desglose; d.c_comision=cm; d.comision_gs=cm;
        d.costo_total=Math.round(d.costo_produccion+cm+d.fin_gs);
        d.margen_gs=d.venta_neta-d.costo_produccion-cm-d.fin_gs; d.margen=Math.round(d.margen_gs);
        d.margen_pct=d.venta_neta? (d.margen_gs/d.venta_neta)*100 : 0; } });
    total+=com.monto; }
  return { lineas, costo_total:total, sin_costeo:sin>0, sin_costeo_n:sin, comision:com }; }

// Totales de una cotización a partir de sus líneas ya costeadas.
// El % global es margen total / venta neta total — NUNCA el promedio de los % de línea.
function totalesCotiz(lineas){
  const T={ costo_produccion:0, venta_neta:0, iva_gs:0, precio_producto_iva:0, flete_gs:0,
            precio_final:0, comision_gs:0, fin_gs:0, margen_gs:0, sin_costeo_n:0 };
  (lineas||[]).forEach(l=>{ const d=l.desglose; if(!d){ T.sin_costeo_n++; return; }
    T.costo_produccion+=d.costo_produccion; T.venta_neta+=d.venta_neta; T.iva_gs+=d.iva_gs;
    T.precio_producto_iva+=d.precio_producto_iva; T.flete_gs+=d.flete_gs; T.precio_final+=d.precio_final;
    T.comision_gs+=d.comision_gs; T.fin_gs+=d.fin_gs; T.margen_gs+=d.margen_gs; });
  T.margen_pct = T.venta_neta ? (T.margen_gs/T.venta_neta)*100 : 0;
  return T;
}
// ¿Esta cotización ya se facturó? Se deduce de las ventas, no se guarda: así
// nunca queda un estado colgado si después se borra la factura.
function cotizFacturada(id,exceptoVenta){ return getVentas().some(v=>v.cotiz_id===id && v.id!==exceptoVenta); }
function ventaMargen(v){ if(!v || v.costo==null) return null;
  const neto=Number(v.monto)||0, costo=Number(v.costo)||0;
  return { costo, margen:neto-costo, pct: neto?(neto-costo)/neto*100:0 }; }
