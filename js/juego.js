// ══════════════════════════════════════════════════════════════════════════
//  JUEGO COMERCIAL — que la presión se sienta como un juego que quieren ganar
//  · Ranking semanal por PUNTOS de actividad (no por montos), visible para todos
//  · Medallas que se ganan solas con la gestión
//  · Desafíos que lanza el gerente, con premio (guardados en la config comercial)
//  · Confeti para festejar: semana cumplida, medalla nueva, hitos de la meta,
//    desafío logrado, subir en el ranking y cada contacto registrado.
// ══════════════════════════════════════════════════════════════════════════
const JG_PTS={ visita:10, llamada:3, cotiz:15 };
// Ventas: suman por monto, 1 punto por cada ₲1.000.000 vendido (las en USD se pasan a ₲ con su tipo de cambio).
const JG_GS_X_PUNTO=1000000;
function jgMontoGs(v){ return (typeof finGs==='function')?finGs(v,v.monto):Math.round(Number(v.monto)||0); }
function jgMillones(gs){ const m=gs/1e6; return '₲'+(m>=10?Math.round(m):Math.round(m*10)/10).toLocaleString('es-PY')+' M'; }

function jgDatos(){ return { visitas:getVisitas(), clientes:getClientes(), ventas:getVentas(), cotiz:(typeof getCotiz==='function'?getCotiz():[]) }; }
// Cotizaciones del módulo con Vendedor = el comercial. Si esa misma cotización la pidió él
// desde una visita (mismo cliente, en los 30 días previos), ya sumó por la visita y no se repite.
function jgCotizModulo(d, nombre, desde, hasta){
  const cliNomOf=id=>{ const c=(d.clientes||[]).find(x=>x.id===id); return c?c.nombre:''; };
  const pedidas=(d.visitas||[]).filter(v=>v.tipo==='rapida' && v.comercial && v.comercial.cotiz && cmDeComercial(v,nombre));
  return (d.cotiz||[]).filter(c=>{
    if(!cmMismo(c.vendedor,nombre) || !(c.fecha>=desde && c.fecha<=hasta)) return false;
    const ini=cmAddDias(c.fecha,-30);
    return !pedidas.some(v=>v.fecha>=ini && v.fecha<=c.fecha &&
      ((c.cliente_id && v.cliente_id===c.cliente_id) || cmMismo(c.cliente, cliNomOf(v.cliente_id)||v.comercial.prospecto)));
  }).length;
}
function jgSemanaPts(d, nombre, desde, hasta){
  const cs=cmContactos(d.visitas,d.clientes,nombre,desde,hasta);
  const vis=cs.filter(x=>x.presencial).length, llam=cs.filter(x=>!x.presencial).length, cot=cs.filter(x=>x.cotiz).length + jgCotizModulo(d,nombre,desde,hasta);
  const vs=(d.ventas||[]).filter(v=>cmMismo(v.comercial,nombre) && v.fecha>=desde && v.fecha<=hasta);
  const ven=vs.length, monto=vs.reduce((a,v)=>a+jgMontoGs(v),0), ptsVen=Math.max(0,Math.round(monto/JG_GS_X_PUNTO));
  return { vis, llam, cot, ven, monto, ptsVen, pts: vis*JG_PTS.visita + llam*JG_PTS.llamada + cot*JG_PTS.cotiz + ptsVen };
}
function jgRanking(d, desde){ const hasta=cmAddDias(desde,6);
  return cmComerciales().map(n=>({ nombre:n, ...jgSemanaPts(d,n,desde,hasta) })).sort((a,b)=>b.pts-a.pts||a.nombre.localeCompare(b.nombre)); }

// ── medallas: se calculan sobre la historia, no se guardan ──
const JG_MEDALLAS=[
  { id:'perfecta',   ico:'🏆', nombre:'Semana perfecta',  como:'Cumplí en la misma semana el mínimo de visitas y el de llamadas' },
  { id:'racha4',     ico:'🔥', nombre:'Racha de fuego',   como:'4 semanas seguidas cumpliendo el mínimo de visitas' },
  { id:'arranque',   ico:'🚀', nombre:'Arranque fuerte',  como:'5 visitas presenciales antes del miércoles' },
  { id:'telefono',   ico:'📞', nombre:'Teléfono caliente',como:'20 llamadas o WhatsApp en una semana' },
  { id:'cerrador',   ico:'🎯', nombre:'Cerrador',         como:'Una cotización pedida que terminó en venta (dentro de 60 días)' },
  { id:'rescatador', ico:'🛟', nombre:'Rescatador',       como:'Venderle a un cliente que no compraba hace 6 meses o más' },
  { id:'prospector', ico:'🌱', nombre:'Prospector',       como:'3 clientes nuevos en un mes' },
  { id:'meta',       ico:'💯', nombre:'Meta cumplida',    como:'Llegar al 100% de la meta de ventas de un mes' }
];
function jgMedallas(d, nombre, hoyIso, cfg){
  const min=mtbMinimos(cfg,nombre); const cnt={}; JG_MEDALLAS.forEach(m=>cnt[m.id]=0);
  // Semanas: últimas 26
  const lun=cmSemana(hoyIso).desde; let racha=0, maxR=0;
  for(let k=25;k>=0;k--){ const l=cmAddDias(lun,-7*k), s=jgSemanaPts(d,nombre,l,cmAddDias(l,6));
    if(s.vis>=min.vis && s.llam>=min.llam) cnt.perfecta++;
    if(s.llam>=20) cnt.telefono++;
    if(jgSemanaPts(d,nombre,l,cmAddDias(l,2)).vis>=5) cnt.arranque++;
    if(s.vis>=min.vis){ racha++; if(racha>=4 && racha%4===0) cnt.racha4++; } else racha=0; }
  const cs=cmContactos(d.visitas,d.clientes,nombre,'2000-01-01',hoyIso);
  const mias=(d.ventas||[]).filter(v=>cmMismo(v.comercial,nombre));
  cs.filter(x=>x.cotiz && x.cliente_id).forEach(x=>{ const lim=cmAddDias(x.fecha,60); if(mias.some(v=>v.cliente_id===x.cliente_id && v.fecha>=x.fecha && v.fecha<=lim)) cnt.cerrador++; });
  mias.forEach(v=>{ if(!v.cliente_id) return; const prev=(d.ventas||[]).filter(o=>o.cliente_id===v.cliente_id && o.fecha<v.fecha).map(o=>o.fecha).sort().pop(); if(prev && cmDiffDias(prev,v.fecha)>=180) cnt.rescatador++; });
  const nuevos={}; (d.clientes||[]).forEach(c=>{ const m=/^CL-(\d{12,})/.exec(String(c.id||'')); if(!m || !cmMismo(c.comercial,nombre)) return; const ym=new Date(Number(m[1])).toISOString().slice(0,7); nuevos[ym]=(nuevos[ym]||0)+1; });
  Object.values(nuevos).forEach(n=>{ if(n>=3) cnt.prospector++; });
  try{ for(let k=0;k<12;k++){ const dt=new Date(hoyIso+'T00:00:00'); dt.setMonth(dt.getMonth()-k); const ym=dt.toISOString().slice(0,7);
    const f=rankingMes(d.ventas,getMetas(),ym,_finComDe,finGs).find(r=>cmMismo(r.comercial,nombre)); if(f && f.meta>0 && (f.pct||0)>=1) cnt.meta++; } }catch(e){}
  return JG_MEDALLAS.map(m=>({ ...m, veces:cnt[m.id], ok:cnt[m.id]>0 }));
}

// ── desafíos del gerente (config comercial compartida) ──
const JG_METRICAS={ visitas:'visitas presenciales', llamadas:'llamadas / WhatsApp', cotiz:'cotizaciones pedidas', ventas:'ventas facturadas', puntos:'puntos' };
function jgDesafios(){ return (getComCfg().desafios||[]); }
function jgDesafiosDe(nombre){ const h=hoy(); return jgDesafios().filter(x=>x.activo!==false && x.hasta>=h && (x.para==='todos'||cmMismo(x.para,nombre))); }
function jgAvance(dsf, nombre, d){ const s=jgSemanaPts(d||jgDatos(),nombre,dsf.desde,dsf.hasta);
  const v={visitas:s.vis,llamadas:s.llam,cotiz:s.cot,ventas:s.ven,puntos:s.pts}[dsf.metrica]||0; return { v, ok:v>=dsf.objetivo, pct:Math.min(1,v/(dsf.objetivo||1)) }; }
function jgNuevoDesafio(){
  if(!esGerente()) return; const h=hoy(), sem=cmSemana(h); const coms=cmComerciales();
  gs('modalBox').innerHTML=`<h3>🎯 Nuevo desafío</h3>
    <label class="fl">Nombre</label><input id="dsTit" placeholder="Ej: Semana de cotizaciones">
    <div class="row2"><div><label class="fl">Qué se mide</label><select id="dsMet">${Object.entries(JG_METRICAS).map(([k,l])=>`<option value="${k}">${l}</option>`).join('')}</select></div><div><label class="fl">Objetivo</label><input type="number" id="dsObj" inputmode="numeric" placeholder="Ej: 6"></div></div>
    <div class="row2"><div><label class="fl">Desde</label><input type="date" id="dsDesde" value="${sem.desde<h?h:sem.desde}"></div><div><label class="fl">Hasta</label><input type="date" id="dsHasta" value="${sem.hasta}"></div></div>
    <label class="fl">Para</label><select id="dsPara"><option value="todos">Todos los comerciales</option>${coms.map(n=>`<option>${esc(n)}</option>`).join('')}</select>
    <label class="fl">Premio</label><input id="dsPremio" placeholder="Ej: almuerzo pago, día libre, bono…">
    <div class="row2" style="margin-top:12px"><button class="btn btn-sec" onclick="cerrarModal()">Cancelar</button><button class="btn btn-primary" onclick="jgGuardarDesafio()">Lanzar desafío</button></div>`;
  gs('modal').classList.add('show'); }
function jgGuardarDesafio(){
  const tit=(gs('dsTit').value||'').trim(), obj=Number(gs('dsObj').value), desde=gs('dsDesde').value, hasta=gs('dsHasta').value;
  if(!tit||!(obj>0)||!desde||!hasta||hasta<desde){ showToast('Completá nombre, objetivo y fechas'); return; }
  const cfg=getComCfg(); cfg.desafios=[{ id:'DS-'+Date.now(), titulo:tit, metrica:gs('dsMet').value, objetivo:obj, desde, hasta, para:gs('dsPara').value, premio:(gs('dsPremio').value||'').trim(), activo:true }, ...(cfg.desafios||[])].slice(0,40);
  cfg.ts=new Date().toISOString(); setComCfg(cfg); pushComCfg(); cerrarModal(); showToast('🎯 Desafío lanzado'); if(typeof refreshVista==='function') refreshVista(); }
function jgCerrarDesafio(id){ if(!esGerente()||!confirm('¿Terminar este desafío?')) return; const cfg=getComCfg(); (cfg.desafios||[]).forEach(x=>{ if(x.id===id) x.activo=false; }); cfg.ts=new Date().toISOString(); setComCfg(cfg); pushComCfg(); if(typeof refreshVista==='function') refreshVista(); }

// ── confeti ──
function jgConfeti(msg, chico){
  try{ const cv=document.createElement('canvas'); cv.style.cssText='position:fixed;inset:0;z-index:100001;pointer-events:none'; cv.width=innerWidth; cv.height=innerHeight; document.body.appendChild(cv);
    const ctx=cv.getContext('2d'), cols=['#0a6640','#22c55e','#f59e0b','#ef4444','#3b82f6','#a855f7','#facc15'];
    const ps=Array.from({length:chico?45:150},()=>({ x:innerWidth/2+(Math.random()-0.5)*120, y:innerHeight*0.35, vx:(Math.random()-0.5)*14, vy:-Math.random()*13-4, r:Math.random()*6+3, c:cols[Math.floor(Math.random()*cols.length)], a:Math.random()*6 }));
    let t=0; (function fr(){ ctx.clearRect(0,0,cv.width,cv.height); ps.forEach(p=>{ p.x+=p.vx; p.y+=p.vy; p.vy+=0.38; p.vx*=0.99; p.a+=0.2; ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.a); ctx.fillStyle=p.c; ctx.fillRect(-p.r/2,-p.r/2,p.r,p.r*0.6); ctx.restore(); });
      if(++t<(chico?70:130)) requestAnimationFrame(fr); else cv.remove(); })();
  }catch(e){}
  if(msg){ const b=document.createElement('div'); b.style.cssText='position:fixed;left:50%;top:22%;transform:translateX(-50%);z-index:100002;background:#fff;border:2px solid #0a6640;border-radius:16px;padding:14px 20px;font-size:16px;font-weight:800;color:#0a6640;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.25);max-width:86vw';
    b.innerHTML=msg; document.body.appendChild(b); setTimeout(()=>{ b.style.transition='opacity .5s'; b.style.opacity='0'; setTimeout(()=>b.remove(),600); }, chico?1600:3200); }
}
// Qué ya se festejó: por comercial, en el equipo (no hace falta sincronizarlo).
function jgVisto(nombre){ try{ return JSON.parse(localStorage.getItem('bio:jg:'+cmNorm(nombre)))||{}; }catch{ return {}; } }
function jgVistoSet(nombre,o){ try{ localStorage.setItem('bio:jg:'+cmNorm(nombre),JSON.stringify(o)); }catch{} }
function jgCelebrar(nombre){
  if(typeof vcActivo==='function' && vcActivo()) return;   // el gerente mirando no dispara festejos
  const d=jgDatos(), h=hoy(), sem=cmSemana(h), cfg=getComCfg(); const v=jgVisto(nombre); const cola=[];
  const meds=jgMedallas(d,nombre,h,cfg); v.med=v.med||{};
  meds.forEach(m=>{ if(m.veces>(v.med[m.id]||0)){ if(v.inicial) cola.push(`${m.ico} ¡Medalla nueva!<br><span style="font-size:14px">${m.nombre}</span>`); v.med[m.id]=m.veces; } });
  const x=mtbDatos(d,nombre,h,cfg); const llave=sem.desde;
  if(x.s.vis>=x.min.vis && x.s.llam>=x.min.llam && v.semana!==llave){ if(v.inicial) cola.push('🔥 ¡Semana cumplida!'); v.semana=llave; }
  try{ const f=rankingMes(d.ventas,getMetas(),x.ym,_finComDe,finGs).find(r=>cmMismo(r.comercial,nombre)); if(f && f.meta>0){ v.hitos=v.hitos||{}; const ya=v.hitos[x.ym]||0;
    [50,75,100].forEach(p=>{ if((f.pct||0)*100>=p && ya<p){ if(v.inicial) cola.push(p===100?'💯 ¡META DEL MES CUMPLIDA!':`🚀 ¡${p}% de tu meta!`); v.hitos[x.ym]=p; } }); } }catch(e){}
  v.des=v.des||{}; jgDesafiosDe(nombre).forEach(ds=>{ if(jgAvance(ds,nombre,d).ok && !v.des[ds.id]){ if(v.inicial) cola.push(`🎯 ¡Desafío logrado!<br><span style="font-size:14px">${esc(ds.titulo)}${ds.premio?' · 🎁 '+esc(ds.premio):''}</span>`); v.des[ds.id]=1; } });
  const rk=jgRanking(d,sem.desde); const pos=rk.findIndex(r=>cmMismo(r.nombre,nombre))+1;
  if(pos>0 && v.rkSem===llave && v.rkPos && pos<v.rkPos && v.inicial) cola.push(`⬆️ ¡Subiste al puesto ${pos}!`);
  v.rkSem=llave; v.rkPos=pos; v.inicial=true;   // la primera vez sólo registra: no festeja la historia entera
  jgVistoSet(nombre,v);
  cola.slice(0,2).forEach((m,i)=>setTimeout(()=>jgConfeti(m),i*3600));
}

// ── explicación de los puntos (botón del ranking) ──
function jgComoPuntos(){
  const fila=(ico,q,p,de)=>`<tr><td style="padding:7px 6px;font-size:18px">${ico}</td><td style="padding:7px 6px"><b>${q}</b><div style="font-size:11.5px;color:var(--gray-600)">${de}</div></td><td style="padding:7px 6px;text-align:right;font-size:16px;font-weight:800;color:var(--green-d);white-space:nowrap">${p} pts</td></tr>`;
  gs('modalBox').innerHTML=`<h3>🏁 ¿Cómo se calculan los puntos?</h3>
    <div style="font-size:12.5px;color:var(--gray-600);margin-bottom:6px">Se cuenta lo que cada comercial carga en la app durante la semana, de <b>lunes a domingo</b>. Cada lunes el ranking arranca de cero.</div>
    <table style="width:100%;border-collapse:collapse">
      ${fila('🚜','Visita presencial',JG_PTS.visita,'Visita técnica o comercial, visita rápida con medio “Visita”, o seguimiento tipo Visita o Reunión.')}
      ${fila('📞','Llamada o WhatsApp',JG_PTS.llamada,'Visita rápida o seguimiento por Llamada o WhatsApp. Las notas no suman.')}
      ${fila('📨','Cotización',JG_PTS.cotiz,'Pedida desde una visita, o hecha en el módulo Cotizaciones con vos como Vendedor. Si la pediste en una visita, no se cuenta dos veces.')}
      ${fila('🤝','Ventas, por monto','1 por cada ₲1 M','Ventas de la semana a tu nombre como comercial. Por ejemplo, una venta de ₲35.000.000 da 35 puntos. Las ventas en dólares se pasan a guaraníes.')}
    </table>
    <div style="font-size:12px;color:var(--gray-600);margin-top:8px;background:#f0fdf4;border-radius:8px;padding:8px 10px">Ejemplo: 4 visitas + 6 llamadas + 1 cotización + una venta de ₲20 M = ${4*JG_PTS.visita} + ${6*JG_PTS.llamada} + ${JG_PTS.cotiz} + 20 = <b>${4*JG_PTS.visita+6*JG_PTS.llamada+JG_PTS.cotiz+20} puntos</b>.<br>Si hay empate, se ordena por nombre. ▲ / ▼ muestra cuántos puestos subiste o bajaste contra la semana pasada.</div>
    <button class="btn btn-primary" style="margin-top:12px;width:100%" onclick="cerrarModal()">Entendido</button>`;
  gs('modal').classList.add('show');
}

// ── bloques del tablero ──
function jgRankingHtml(nombre, propio){
  const d=jgDatos(), sem=cmSemana(hoy()); const rk=jgRanking(d,sem.desde); if(rk.length<2) return '';
  const ant=jgRanking(d,cmAddDias(sem.desde,-7)); const posAnt={}; ant.forEach((r,i)=>posAnt[cmNorm(r.nombre)]=i+1);
  const pod=['🥇','🥈','🥉'];
  return `<div class="card"><div class="card-h"><span>🏁 Ranking de la semana</span><button onclick="jgComoPuntos()" style="background:var(--gray-100,#f1f5f9);color:var(--green-d);border:1px solid var(--gray-200,#e2e8f0);border-radius:14px;padding:4px 10px;font-size:11.5px;font-weight:700;cursor:pointer">ℹ️ ¿Cómo se calculan los puntos?</button></div><div>
    ${rk.map((r,i)=>{ const yo=nombre&&cmMismo(r.nombre,nombre); const pa=posAnt[cmNorm(r.nombre)]; const mov=pa?pa-(i+1):0;
      return `<div class="li" style="cursor:default;${yo?'background:#ecfdf3;':''}"><div style="display:flex;align-items:center;gap:10px;min-width:0"><span style="font-size:${i<3?20:14}px;width:26px;text-align:center;font-weight:800;color:var(--gray-500)">${pod[i]||(i+1)}</span>
        <div style="min-width:0"><div class="li-t" style="font-size:13.5px">${esc(r.nombre)}${yo?(propio?' <span style="font-size:11px;color:var(--green)">(vos)</span>':''):''}</div><div class="li-s">${r.vis} visitas · ${r.llam} llamadas · ${r.cot} cotiz. · ${r.ven} ventas${r.ven?` (${jgMillones(r.monto)})`:""}${mov>0?` · <span style="color:var(--green);font-weight:700">▲${mov}</span>`:mov<0?` · <span style="color:var(--red)">▼${-mov}</span>`:''}</div></div></div>
        <div style="font-size:17px;font-weight:800;color:var(--green-d)">${r.pts}</div></div>`; }).join('')}
  </div></div>`;
}
function jgDesafiosHtml(nombre, propio){
  const ds=jgDesafiosDe(nombre); if(!ds.length) return '';
  const d=jgDatos();
  return `<div class="card"><div class="card-h"><span>🎯 Desafíos</span></div><div class="card-b">${ds.map(x=>{ const a=jgAvance(x,nombre,d);
    return `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;gap:8px"><b style="font-size:13.5px">${esc(x.titulo)}</b><span style="font-size:13px;font-weight:800;color:${a.ok?'var(--green)':'var(--gray-700)'}">${a.ok?'✔ ':''}${a.v}/${x.objetivo}</span></div>
      <div style="font-size:11.5px;color:var(--gray-500)">${JG_METRICAS[x.metrica]||x.metrica} · hasta ${fmtFecha(x.hasta)}${x.premio?` · 🎁 <b>${esc(x.premio)}</b>`:''}</div>
      <div style="height:8px;background:var(--gray-200);border-radius:5px;overflow:hidden;margin-top:4px"><div style="height:8px;width:${Math.round(a.pct*100)}%;background:${a.ok?'var(--green)':'#f59e0b'}"></div></div></div>`; }).join('')}</div></div>`;
}
function jgMedallasHtml(nombre, propio){
  const ms=jgMedallas(jgDatos(),nombre,hoy(),getComCfg()); const n=ms.filter(m=>m.ok).length;
  return `<div class="card"><div class="card-h"><span>🎖 ${propio?'Tus':'Sus'} medallas</span><span style="font-weight:700;color:var(--green-d)">${n}/${ms.length}</span></div><div class="card-b" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
    ${ms.map(m=>`<div title="${esc(m.como)}" onclick="showToast('${m.ico} ${esc(m.nombre)}: ${esc(m.como).replace(/'/g,"\\'")}',4000)" style="text-align:center;cursor:pointer;${m.ok?'':'opacity:.35;filter:grayscale(1)'}">
      <div style="font-size:28px;line-height:1.1">${m.ico}</div><div style="font-size:10.5px;font-weight:700;line-height:1.15">${esc(m.nombre)}</div>${m.veces>1?`<div style="font-size:10px;color:var(--green)">×${m.veces}</div>`:''}</div>`).join('')}
  </div><div style="padding:0 12px 10px;font-size:11px;color:var(--gray-400)">Tocá una medalla para ver cómo se gana.</div></div>`;
}
// Gerente: desafíos con el avance de cada comercial.
function jgGerenteDesafiosHtml(){
  const h=hoy(), d=jgDatos(); const ds=jgDesafios().filter(x=>x.activo!==false && x.hasta>=h);
  return `<div class="card"><div class="card-h"><span>🎯 Desafíos activos</span><span style="color:var(--green);cursor:pointer;font-weight:700" onclick="jgNuevoDesafio()">＋ Nuevo</span></div><div class="card-b">
    ${ds.map(x=>{ const coms=x.para==='todos'?cmComerciales():[x.para];
      return `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between"><b>${esc(x.titulo)}</b><span style="color:var(--red);cursor:pointer;font-size:12px" onclick="jgCerrarDesafio('${x.id}')">terminar</span></div>
        <div style="font-size:11.5px;color:var(--gray-500)">${x.objetivo} ${JG_METRICAS[x.metrica]||''} · ${fmtFecha(x.desde)}–${fmtFecha(x.hasta)}${x.premio?' · 🎁 '+esc(x.premio):''}</div>
        ${coms.map(n=>{ const a=jgAvance(x,n,d); return `<div style="display:flex;justify-content:space-between;font-size:12.5px;margin-top:3px"><span>${esc(n)}</span><b style="color:${a.ok?'var(--green)':'var(--gray-700)'}">${a.ok?'✔ ':''}${a.v}/${x.objetivo}</b></div>`; }).join('')}</div>`; }).join('')||'<div style="font-size:12px;color:var(--gray-400)">No hay desafíos activos. Lanzá uno con un premio: es lo que más mueve.</div>'}
  </div></div>`;
}

// ── enganches ──
(function(){
  if(typeof mtbHtml==='function'){ const _m=mtbHtml; mtbHtml=function(nombre,propio){ const h=_m.apply(this,arguments);
    // Después del mensaje y de "tu semana": desafíos, ranking y medallas.
    const extra=jgDesafiosHtml(nombre,propio)+jgRankingHtml(nombre,propio)+jgMedallasHtml(nombre,propio);
    if(propio) setTimeout(()=>{ try{ jgCelebrar(nombre); }catch(e){} },400);
    const i=h.indexOf('<div class="card"><div class="card-h"><span>🎯 El mes');
    return i>0 ? h.slice(0,i)+extra+h.slice(i) : h+extra; }; }
  if(typeof gsRenderGestCom==='function'){ const _g=gsRenderGestCom; gsRenderGestCom=function(){ const r=_g.apply(this,arguments); try{ if(_gst.gtab==='equipo'){ const el=gs('sGestComBody');
      if(el) el.insertAdjacentHTML('afterbegin', jgGerenteDesafiosHtml()+jgRankingHtml('')); } }catch(e){} return r; }; }
  // Cada contacto registrado suma puntos: un festejo chico en el momento.
  if(typeof cmVrGuardar==='function'){ const _v=cmVrGuardar; cmVrGuardar=function(){ const yo=cmYo(); const sem=cmSemana(hoy()); let antes=0; try{ antes=jgSemanaPts(jgDatos(),yo,sem.desde,sem.hasta).pts; }catch(e){}
    const r=_v.apply(this,arguments); setTimeout(()=>{ try{ if(typeof vcActivo==='function'&&vcActivo()) return; const des=jgSemanaPts(jgDatos(),yo,sem.desde,sem.hasta).pts-antes; if(des>0) jgConfeti('+'+des+' puntos 💪',true); }catch(e){} },300); return r; }; }
})();
