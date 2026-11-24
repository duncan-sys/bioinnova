// ══════════════════════════════════════════════════════════════════════════
//  MI TABLERO — la gestión del comercial en una pantalla que invita a mejorar
//  Visitas y llamadas de la semana contra su mínimo, cotizaciones del mes,
//  meta de ventas, embudo, racha y alertas: clientes que visita seguido sin
//  resultado y clientes que compraron y dejó de visitar.
//  El cálculo (mtbDatos) es puro y está probado en tests.html; el dibujo va aparte.
// ══════════════════════════════════════════════════════════════════════════
const MTB_LLAM_DEFAULT = 10;   // llamadas / WhatsApp por semana (Martín, 24-11-2026)
const MTB_COT_DEFAULT  = 8;    // cotizaciones pedidas a gerencia por mes
const MTB_REP_N = 3, MTB_REP_DIAS = 60;   // 3+ contactos en 60 días sin cotización ni venta → alerta
const MTB_DORM_DIAS = 45;      // compró en el último año y hace 45+ días que no lo contacta

function mtbMinimos(cfg, nombre){
  const c=cfg||{};
  return { vis:(typeof cmMinimo==='function'?cmMinimo(c,nombre):8),
    llam:Number(c.min_llamadas)>0?Number(c.min_llamadas):MTB_LLAM_DEFAULT,
    cot:Number(c.min_cotiz_mes)>0?Number(c.min_cotiz_mes):MTB_COT_DEFAULT };
}
// d = { visitas, clientes, ventas }
function mtbDatos(d, nombre, hoyIso, cfg){
  const min=mtbMinimos(cfg,nombre);
  const sem=cmSemana(hoyIso), lunAnt=cmAddDias(sem.desde,-7);
  const cont=(a,b)=>cmContactos(d.visitas,d.clientes,nombre,a,b);
  const cuenta=arr=>({ vis:arr.filter(x=>x.presencial).length, llam:arr.filter(x=>!x.presencial).length });
  const cs=cont(sem.desde,sem.hasta), ca=cont(lunAnt,cmAddDias(lunAnt,6));
  const s=cuenta(cs), sa=cuenta(ca);
  // Ritmo: cuánto debería llevar a esta altura de la semana (lunes a sábado).
  const dias=Math.min(6, cmDiffDias(sem.desde,hoyIso)+1), frac=dias/6;
  // Mes: cotizaciones pedidas y presentadas, contactados y ventas.
  const ym=String(hoyIso).slice(0,7), ini=ym+'-01', fin=cmAddDias(cmAddDias(ini,32).slice(0,7)+'-01',-1);
  const cm=cont(ini,fin);
  const cotSol=cm.filter(x=>x.cotiz).length, cotPres=cm.filter(x=>x.cotiz && (CM_COT_PRES||[]).includes(x.cotiz.estado)).length;
  const vMes=(d.ventas||[]).filter(v=>cmMismo(v.comercial,nombre) && String(v.fecha||'').slice(0,7)===ym);
  const monto=v=>(typeof finGs==='function'?finGs(v,v.monto):Math.round(Number(v.monto)||0));
  const embudo={ contactados:new Set(cm.map(x=>x.cliente_id).filter(Boolean)).size, cotSol, cotPres,
    conVenta:new Set(vMes.map(v=>v.cliente_id).filter(Boolean)).size, ventas:vMes.reduce((a,v)=>a+monto(v),0) };
  // Racha: semanas seguidas cumpliendo el mínimo de visitas (la actual cuenta si ya lo cumplió).
  let racha=0; if(s.vis>=min.vis) racha=1;
  for(let k=1;k<=52;k++){ const l=cmAddDias(sem.desde,-7*k); if(cuenta(cont(l,cmAddDias(l,6))).vis>=min.vis) racha++; else break; }
  // Repetidos sin resultado: muchos contactos con el mismo cliente y ni una cotización ni una venta.
  const desdeR=cmAddDias(hoyIso,-MTB_REP_DIAS), cr=cont(desdeR,hoyIso);
  const porCli={}; cr.forEach(x=>{ if(!x.cliente_id) return; const g=porCli[x.cliente_id]=porCli[x.cliente_id]||{n:0,cot:false,ult:''}; g.n++; if(x.cotiz||x.resultado==='pedido') g.cot=true; if(x.fecha>g.ult) g.ult=x.fecha; });
  const cli={}; (d.clientes||[]).forEach(c=>cli[c.id]=c);
  const repetidos=Object.entries(porCli).filter(([id,g])=>g.n>=MTB_REP_N && !g.cot && !(d.ventas||[]).some(v=>v.cliente_id===id && v.fecha>=desdeR))
    .map(([id,g])=>({ id, nombre:(cli[id]&&cli[id].nombre)||'—', n:g.n, ult:g.ult })).sort((a,b)=>b.n-a.n);
  // Dormidos: clientes suyos que compraron en el último año y hace rato no contacta.
  const hace1=cmAddDias(hoyIso,-365), limD=cmAddDias(hoyIso,-MTB_DORM_DIAS);
  const dormidos=(d.clientes||[]).filter(c=>cmMismo(c.comercial,nombre) && c.estado!=='Perdido' && c.estado!=='Inactivo').map(c=>{
      const vs=(d.ventas||[]).filter(v=>v.cliente_id===c.id && v.fecha>=hace1); if(!vs.length) return null;
      const ult=cmUltimoContacto(c,d.visitas); if(ult && ult>=limD) return null;
      const uv=vs.reduce((m,v)=>v.fecha>m?v.fecha:m,''); return { id:c.id, nombre:c.nombre, ult, ultVenta:uv, total:vs.reduce((a,v)=>a+monto(v),0) }; })
    .filter(Boolean).sort((a,b)=>b.total-a.total);
  const pend=(typeof cmPendientes==='function')?cmPendientes(d.clientes,nombre,hoyIso).length:0;
  return { min, s, sa, dias, frac, embudo, racha, repetidos, dormidos, pend, ym };
}

// ── dibujo ──
function mtbBarra(l, v, min, ant, esperado, ico, sufijo){
  const pct=min>0?Math.min(1,v/min):1, ok=v>=min, enRitmo=v>=Math.floor(esperado);
  const col=ok?'var(--green)':(enRitmo?'#b54708':'var(--red)');
  const dif=v-ant, fl=dif>0?`<span style="color:var(--green)">▲ ${dif}</span>`:dif<0?`<span style="color:var(--red)">▼ ${-dif}</span>`:'<span style="color:var(--gray-400)">= </span>';
  const txt=ok?'✔ cumplido':(enRitmo?`vas en ritmo · faltan ${min-v}`:`atrasado · faltan ${min-v}`);
  return `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;align-items:baseline">
      <span style="font-size:13px;font-weight:700">${ico} ${l}</span><span style="font-size:18px;font-weight:800;color:${col}">${v}<span style="font-size:12px;color:var(--gray-400);font-weight:600"> / ${min}</span></span></div>
    <div style="height:9px;background:var(--gray-200);border-radius:5px;overflow:hidden;margin:4px 0"><div style="height:9px;width:${Math.round(pct*100)}%;background:${col};border-radius:5px"></div></div>
    <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--gray-500)"><span style="color:${col};font-weight:600">${txt}</span><span>${ant==null?(sufijo||''):'vs. semana pasada '+fl}</span></div></div>`;
}
function mtbHtml(nombre, propio){
  const d={ visitas:getVisitas(), clientes:getClientes(), ventas:getVentas() }; const h=hoy();
  const x=mtbDatos(d,nombre,h,getComCfg()); const m=x.min;
  // Mensaje: qué le falta para cumplir la semana, o el reconocimiento si ya está.
  const fV=Math.max(0,m.vis-x.s.vis), fL=Math.max(0,m.llam-x.s.llam);
  let msg;
  if(!fV && !fL) msg=`🔥 ¡Semana cumplida! ${x.racha>1?'Llevás '+x.racha+' semanas seguidas cumpliendo.':'Seguí así la próxima.'}`;
  else { const partes=[]; if(fV) partes.push(fV+' visita'+(fV>1?'s':'')); if(fL) partes.push(fL+' llamada'+(fL>1?'s':''));
    const atras=x.s.vis<Math.floor(m.vis*x.frac)||x.s.llam<Math.floor(m.llam*x.frac);
    msg=`${atras?'⏱':'💪'} Te ${partes.length>1||fV>1||fL>1?'faltan':'falta'} ${partes.join(' y ')} para cumplir la semana${atras?' — vas atrasado para el día de hoy.':'. Vas en ritmo.'}`; }
  if(!propio) msg=msg.replace(/^(\S+) Te /,'$1 Le ').replace('Llevás','Lleva').replace('Seguí así','Si sigue así,').replace('vas atrasado','va atrasado').replace('Vas en ritmo','Va en ritmo');
  let meta=''; try{ const f=rankingMes(d.ventas,getMetas(),x.ym,_finComDe,finGs).find(r=>cmMismo(r.comercial,nombre)); if(f){ const pv=_mtVista; _mtVista='mes'; meta=_mtMiCardHtml(f,x.ym,ymParse(x.ym),''); _mtVista=pv; } }catch(e){}
  const e=x.embudo; const paso=(l,v,sub)=>`<div style="flex:1;min-width:64px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--green-d)">${v}</div><div style="font-size:10.5px;color:var(--gray-500);line-height:1.2">${l}${sub?'<br>'+sub:''}</div></div>`;
  const flecha='<div style="align-self:center;color:var(--gray-300);font-size:16px">›</div>';
  const fila=(id,t,s,col)=>`<div class="li" onclick="openFicha('${id}')"><div style="min-width:0"><div class="li-t" style="font-size:13px">${esc(t)}</div><div class="li-s" style="color:${col||'var(--gray-500)'}">${s}</div></div><span style="color:var(--green);font-weight:700">›</span></div>`;
  return `
    <div class="card" style="border-left:4px solid ${(!fV&&!fL)?'var(--green)':'#b54708'}"><div class="card-b" style="font-size:13.5px;font-weight:600">${msg}</div></div>
    <div class="card"><div class="card-h"><span>📊 ${propio?'Tu':'Su'} semana</span><span style="font-weight:500;color:var(--gray-400);font-size:12px">${x.racha?'🔥 racha '+x.racha+' sem.':''}</span></div><div class="card-b">
      ${mtbBarra('Visitas presenciales',x.s.vis,m.vis,x.sa.vis,m.vis*x.frac,'🚜')}
      ${mtbBarra('Llamadas y WhatsApp',x.s.llam,m.llam,x.sa.llam,m.llam*x.frac,'📞')}
      ${mtbBarra('Cotizaciones pedidas (mes)',e.cotSol,m.cot,null,m.cot*(Number(h.slice(8,10))/30),'🧾','en el mes')}
      ${x.pend?`<div style="font-size:12px;color:var(--red);font-weight:600">⏰ ${x.pend} seguimiento${x.pend>1?'s':''} vencido${x.pend>1?'s':''}</div>`:''}
    </div></div>
    ${meta||`<div class="card"><div class="card-b" style="font-size:12px;color:var(--gray-500)">${propio?'Todavía no tenés':'Todavía no tiene'} meta cargada para este mes.</div></div>`}
    <div class="card"><div class="card-h"><span>🎯 El mes, de contacto a venta</span></div><div class="card-b" style="display:flex;gap:4px">
      ${paso('clientes contactados',e.contactados)}${flecha}${paso('cotizaciones pedidas',e.cotSol)}${flecha}${paso('presentadas',e.cotPres)}${flecha}${paso('clientes con venta',e.conVenta,e.ventas?finGsFmt(e.ventas):'')}
    </div></div>
    ${x.repetidos.length?`<div class="card" style="border-left:4px solid var(--red)"><div class="card-h"><span>🔁 Visitas que no rinden</span><span style="color:var(--red);font-weight:700">${x.repetidos.length}</span></div>
      <div style="padding:2px 12px 6px;font-size:11.5px;color:var(--gray-600)">${MTB_REP_N} o más contactos en ${MTB_REP_DIAS} días y ni una cotización ni una venta. ¿Hace falta otra propuesta, otro interlocutor, o soltar el cliente?</div>
      <div>${x.repetidos.slice(0,8).map(r=>fila(r.id,r.nombre,r.n+' contactos · último '+fmtFecha(r.ult)+' · sin cotización ni venta','var(--red)')).join('')}</div></div>`:''}
    ${x.dormidos.length?`<div class="card" style="border-left:4px solid #b54708"><div class="card-h"><span>💤 Clientes que compran y no visitás</span><span style="color:#b54708;font-weight:700">${x.dormidos.length}</span></div>
      <div style="padding:2px 12px 6px;font-size:11.5px;color:var(--gray-600)">Compraron en el último año y hace más de ${MTB_DORM_DIAS} días que no hay contacto. Es venta segura que se puede enfriar.</div>
      <div>${x.dormidos.slice(0,8).map(r=>fila(r.id,r.nombre,'compró '+finGsFmt(r.total)+' en el año · última compra '+fmtFecha(r.ultVenta)+' · '+(r.ult?'último contacto '+fmtFecha(r.ult):'sin contactos'),'#b54708')).join('')}</div></div>`:''}
    ${!x.repetidos.length&&!x.dormidos.length?`<div class="card"><div class="card-b" style="font-size:12px;color:var(--green)">✔ Sin alertas: ningún cliente repetido sin resultado ni clientes que compran sin visitar.</div></div>`:''}`;
}

// ── El tablero es lo primero que ve el comercial ──
// Al entrar a la app (o al iniciar sesión) va directo a su tablero. Si tiene un
// bloqueo (vencidos, cierre, agenda), arriba de esa pantalla ve el resumen: así
// sabe qué se espera de él aunque primero tenga que resolver lo pendiente.
function mtbAlEntrar(){ try{ if(!cmEsComercial()) return; const a=document.querySelector('.screen.active'); if(a && a.id==='sHome') openGestion('tablero'); }catch(e){} }
function mtbResumenHtml(nombre){
  let x; try{ x=mtbDatos({ visitas:getVisitas(), clientes:getClientes(), ventas:getVentas() },nombre,hoy(),getComCfg()); }catch(e){ return ''; }
  const m=x.min; let meta='';
  try{ const f=rankingMes(getVentas(),getMetas(),x.ym,_finComDe,finGs).find(r=>cmMismo(r.comercial,nombre)); if(f&&f.meta>0) meta=`<div style="flex:1;min-width:70px"><div style="font-size:9.5px;color:var(--gray-500);font-weight:700">META MES</div><div style="font-size:16px;font-weight:800;color:${_mtColor(f.pct)}">${Math.round((f.pct||0)*100)}%</div></div>`; }catch(e){}
  const k=(l,v,mn)=>`<div style="flex:1;min-width:70px"><div style="font-size:9.5px;color:var(--gray-500);font-weight:700">${l}</div><div style="font-size:16px;font-weight:800;color:${v>=mn?'var(--green)':'var(--gray-800)'}">${v}<span style="font-size:11px;color:var(--gray-400)">/${mn}</span></div></div>`;
  return `<div class="card" style="border-left:4px solid var(--green)"><div class="card-b" style="padding:10px 12px">
    <div style="font-size:11px;font-weight:700;color:var(--green-d);margin-bottom:6px">🏁 TU SEMANA ${x.racha?'· 🔥 racha '+x.racha+' sem.':''}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">${k('VISITAS',x.s.vis,m.vis)}${k('LLAMADAS',x.s.llam,m.llam)}${k('COTIZ. MES',x.embudo.cotSol,m.cot)}${meta}</div>
    <div style="font-size:11px;color:var(--gray-500);margin-top:6px">Resolvé esto primero y después ves tu tablero completo.</div></div></div>`;
}
(function(){
  const _aa=applyAuth; applyAuth=function(){ const r=_aa.apply(this,arguments); mtbAlEntrar(); return r; };
  const pre=(fn,bodyId)=>{ const o=window[fn]; if(typeof o!=='function') return; window[fn]=function(){ const r=o.apply(this,arguments); try{ if(cmEsComercial()){ const b=gs(bodyId); if(b && !b.querySelector('[data-mtbres]')) b.insertAdjacentHTML('afterbegin', mtbResumenHtml(cmYo()).replace('<div class="card"','<div data-mtbres="1" class="card"')); } }catch(e){} return r; }; };
  pre('cmRenderPlan','psBody'); pre('cmRenderPendientes','pdBody'); pre('cmRenderCierre','ciBody');
})();
