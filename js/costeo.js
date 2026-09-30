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
const PL_COSTCFG={ merma:0.03, mano_obra:90, bolsa:90, etiqueta_bolsa:331, gastos_adm:0.04, comision:0.04, margen:0.25, margen_sal:0.15, plazo_mes:0.01, iva:0.10, flete_kg:0, dolar:6100 };
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
function setMargenOv(cod,pct){ const o=getMargenOv(); if(pct==null||pct==='') delete o[cod]; else o[cod]=Number(pct); try{ localStorage.setItem('bio:margen',JSON.stringify(o)); }catch{} if(typeof pushPricingCfg==='function') pushPricingCfg(); }
// ¿Es sal mineral? (código BIOSAL o nombre lo indica) → usa el margen de sal por defecto
function esSalMineral(cod,nombre){ return /^BIOSAL/i.test(cod||'') || /biosal|sal\s*mineral/i.test(nombre||''); }
// Margen de un producto: override individual → default por línea (sal mineral vs general)
function margenDe(cod, nombre){ const ov=getMargenOv(); if(cod&&ov[cod]!=null) return Number(ov[cod]);
  const cfg=getCostCfg(); return esSalMineral(cod,nombre) ? (cfg.margen_sal!=null?cfg.margen_sal:0.15) : cfg.margen; }
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
// Precio ₲/kg (SIN flete) para una condición y un margen dado
function precioBaseKg(f, cond, margen, comPct){ const cfg=getCostCfg(); const base=costoBaseFormula(f); const kg=plKgBolsa(f);
  const com=(comPct!=null?comPct:cfg.comision);                                                        // comisión de la cotización (o la general)
  const bruto = base*(1+(cfg.merma||0)) + cfg.mano_obra + bolsaKgDe(f) + (kg?cfg.etiqueta_bolsa/kg:0);  // TOTAL BRUTO
  const conCom = bruto*(1+cfg.gastos_adm)*(1+margen)*(1+com);                                           // × gastos adm × margen × comisión
  const t=plazoMeses(cond);
  return Math.round( conCom*(1+t*(cfg.plazo_mes||0))*(1+(cfg.iva||0)) ); }                             // × plazo × IVA
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
  'NCL007'       // Bioinnova Confi 4 O - 25 KG
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
function costoProdKg(f){ const cfg=getCostCfg(); const kgB=plKgBolsa(f);
  const bruto = costoBaseFormula(f)*(1+(cfg.merma||0)) + cfg.mano_obra + bolsaKgDe(f) + (kgB?cfg.etiqueta_bolsa/kgB:0);
  return bruto*(1+(cfg.gastos_adm||0)); }
function formulaDeKey(key){ return PL_FORMULAS.find(f=>precioKey(f)===key)||null; }
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
  const sub=Number(it.subtotal)||0;
  const merma=cfg.merma||0, adm=cfg.gastos_adm||0;
  // partes por kg → × kg
  const insRaw = costoBaseFormula(f)*kg;                    // insumos a precio del momento (sin merma)
  const insMerma = Math.round(insRaw*(1+merma));            // insumos con merma
  const cMano  = Math.round((cfg.mano_obra||0)*kg);
  const cBolsa = Math.round(bolsaKgDe(f)*kg);
  const cEtiq  = Math.round((kgB?(cfg.etiqueta_bolsa||0)/kgB:0)*kg);
  const subProd= insMerma+cMano+cBolsa+cEtiq;
  const cAdm   = Math.round(subProd*adm);                   // gastos administrativos ("otros")
  const cProd  = subProd+cAdm;                              // = costoProdKg(f)*kg (redondeado)
  const cFlete = Math.round((Number(fleteKg)||0)*kg);
  const cCom   = (com&&com.tipo==='monto') ? 0 : Math.round(sub*((com&&com.pct)||0));  // el monto fijo se prorratea aparte
  const costoTotal = cProd+cFlete+cCom;
  // informativos (van EN el precio al cliente, no restan margen): financiero e IVA implícitos en el precio
  const pbase=Number(it.precio_base!=null?it.precio_base:it.precio_kg)||0;             // precio ₲/kg sin flete (con IVA incluido)
  const iva=cfg.iva||0; const t=plazoMeses(cond||it.cond||''); const pm=cfg.plazo_mes||0;
  const sinIva = iva? pbase/(1+iva) : pbase; const cIvaKg = pbase - sinIva;
  const sinFin = (t&&pm)? sinIva/(1+t*pm) : sinIva; const cFinKg = sinIva - sinFin;
  // detalle de insumos (código, nombre, cantidad, unidad, costo unit, costo total) al precio del momento
  const insumos=[];
  (f.ins||[]).forEach(i=>{ if(i.t==='p'){ const cant=Math.round(kg*(i.p/100)*100)/100; const cu=insPrecio(i.c); insumos.push({c:i.c,n:i.n,cant,unidad:'kg',cu,ct:Math.round(cant*cu)}); } });
  // La Zeolita (INS070) ya viene como componente 'p' en las fórmulas que la usan → entra sola en el bucle de insumos.
  const bl=(f.ins||[]).find(x=>x.t==='b'&&!/etiq/i.test(x.n||'')); if(bl){ const cu=insPrecio(bl.c); insumos.push({c:bl.c,n:bl.n,cant:bolsas,unidad:'u',cu,ct:Math.round(bolsas*cu)}); }
  const et=(f.ins||[]).find(x=>x.t==='b'&&/etiq/i.test(x.n||'')); if(et){ const cu=insPrecio(et.c); insumos.push({c:et.c,n:et.n,cant:bolsas,unidad:'u',cu,ct:Math.round(bolsas*cu)}); }
  return { kg, bolsas, sub, ins_raw:Math.round(insRaw), c_insumos:insMerma, c_mano:cMano, c_bolsa:cBolsa, c_etiqueta:cEtiq, c_adm:cAdm, c_flete:cFlete, c_comision:cCom,
    c_iva_info:Math.round(cIvaKg*kg), c_financiero_info:Math.round(cFinKg*kg), costo_total:costoTotal,
    margen: sub-costoTotal, margen_pct: sub? (sub-costoTotal)/sub*100 : 0, insumos }; }
// Costea las líneas de una cotización. COSTO COMPLETO = producción + flete +
// comisión. Se calcula UNA vez, al vincular la factura, y queda congelado: si
// después cambian los precios de insumos, el margen de esta venta no se mueve.
// Los productos sin fórmula no tienen costo calculable → quedan "sin costeo",
// que no es lo mismo que costo cero.
function costearItems(items, fleteKg, com, cond){ const cfg=getCostCfg(); com=com||comisionDoc('pct',null); let total=0, sin=0;
  let lineas=(items||[]).map(it=>{
    const f=formulaDeKey(it.key), kg=Number(it.kg)||0, sub=Number(it.subtotal)||0;
    if(!f){ sin++; return Object.assign({},it,{sin_costeo:true, subtotal:sub}); }
    const dg=desgloseCostoLinea(f, it, fleteKg, com, cond);
    total+=dg.costo_total;
    return Object.assign({},it,{costo_prod:dg.c_insumos+dg.c_mano+dg.c_bolsa+dg.c_etiqueta+dg.c_adm, costo_flete:dg.c_flete, costo_comision:dg.c_comision, costo:dg.costo_total, desglose:dg});
  });
  // Comisión monto fijo: se prorratea por subtotal entre las líneas costeadas y se suma al total.
  if(com.tipo==='monto' && com.monto>0){ const conF=lineas.filter(l=>!l.sin_costeo); const totSub=conF.reduce((a,l)=>a+(Number(l.subtotal)||0),0)||1; let acc=0;
    conF.forEach((l,i)=>{ const cm=(i===conF.length-1)?(com.monto-acc):Math.round(com.monto*(Number(l.subtotal)||0)/totSub); acc+=cm;
      l.costo_comision=cm; l.costo=(l.costo||0)+cm; if(l.desglose){ l.desglose.c_comision=cm; l.desglose.costo_total=(l.desglose.costo_total||0)+cm; l.desglose.margen=(Number(l.subtotal)||0)-l.desglose.costo_total; l.desglose.margen_pct=(Number(l.subtotal)||0)?l.desglose.margen/(Number(l.subtotal))*100:0; } });
    total+=com.monto; }
  return { lineas, costo_total:total, sin_costeo:sin>0, sin_costeo_n:sin, comision:com }; }
// ¿Esta cotización ya se facturó? Se deduce de las ventas, no se guarda: así
// nunca queda un estado colgado si después se borra la factura.
function cotizFacturada(id,exceptoVenta){ return getVentas().some(v=>v.cotiz_id===id && v.id!==exceptoVenta); }
function ventaMargen(v){ if(!v || v.costo==null) return null;
  const neto=Number(v.monto)||0, costo=Number(v.costo)||0;
  return { costo, margen:neto-costo, pct: neto?(neto-costo)/neto*100:0 }; }
