// ══════════════════════════════════════════════════════════
//  SEGUIMIENTO COMERCIAL
//  Visita rápida · pendientes primero · mínimo semanal · tableros.
//  Se carga DESPUÉS del script principal: envuelve showScreen, applyRoleUI,
//  refreshVista y reopenScreen para engancharse sin tocar su lógica.
//  La parte de arriba son funciones puras (probadas en tests.html).
// ══════════════════════════════════════════════════════════

const CM_RESULTADOS = [
  ['presentacion','Presentación'], ['seguimiento','Seguimiento'], ['pide_cotiz','Pide cotización'],
  ['pedido','Pedido confirmado'], ['reclamo','Reclamo / problema'], ['cobranza','Cobranza'], ['sin_interes','Sin interés']
];
const CM_MEDIOS = ['Visita','Llamada','WhatsApp'];
const CM_PROX = [['visitar','Volver a visitar'],['llamar','Llamar'],['enviar','Enviar info / muestra'],['ninguno','Sin próximo paso']];
// Sólo estos resultados pueden quedar sin próximo paso: los demás exigen fecha.
const CM_SIN_PROX_OK = ['sin_interes','pedido','cobranza'];
const CM_MIN_DEFAULT = 8;          // visitas presenciales por semana si el gerente no fijó otra
const CM_DIAS_VENTA = 30;          // ventana para "venta sin visita"
const CM_DIAS_SIN_CONTACTO = 30;   // cliente asignado sin contacto → "a visitar"
const CM_EXIGIR_DESDE = '2026-10-19';   // el bloqueo arranca este lunes (editable por gerencia en Mínimos)

function cmResLbl(k){ const r=CM_RESULTADOS.find(x=>x[0]===k); return r?r[1]:(k||''); }
function cmProxLbl(k){ const r=CM_PROX.find(x=>x[0]===k); return r?r[1]:(k||''); }

// Nombres: el comercial aparece escrito a mano en varios lados (CRM, visitas, ventas, metas).
function cmNorm(s){ return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').trim().toLowerCase().replace(/\s+/g,' '); }
function cmMismo(a,b){ const x=cmNorm(a); return !!x && x===cmNorm(b); }

function cmAddDias(iso, n){ const d=new Date(String(iso)+'T00:00:00'); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }
function cmDiffDias(desde, hasta){ return Math.round((new Date(hasta+'T00:00:00')-new Date(desde+'T00:00:00'))/86400000); }
// Semana de lunes a domingo que contiene la fecha.
function cmSemana(iso){ const d=new Date(String(iso)+'T00:00:00'); const dw=(d.getDay()+6)%7; const lun=cmAddDias(iso,-dw); return { desde:lun, hasta:cmAddDias(lun,6) }; }

// ¿La visita fue presencial? Las técnicas y comerciales completas siempre; la rápida según el medio.
function cmEsPresencial(v){ if(!v) return false; if(v.tipo==='rapida') return ((v.comercial||{}).medio||'Visita')==='Visita'; return true; }
function cmDeComercial(v, nombre){ return cmMismo(v && v.tecnico, nombre); }

function cmVisitasEnRango(visitas, nombre, desde, hasta, soloPresencial){
  return (visitas||[]).filter(v=>cmDeComercial(v,nombre) && v.fecha>=desde && v.fecha<=hasta && (!soloPresencial || cmEsPresencial(v)));
}
function cmVisitasSemana(visitas, nombre, hoyIso){ const s=cmSemana(hoyIso); return cmVisitasEnRango(visitas,nombre,s.desde,s.hasta,true).length; }

function cmMinimo(cfg, nombre){
  const c=cfg||{}; const por=c.por||{};
  for(const k of Object.keys(por)){ if(cmMismo(k,nombre) && Number(por[k])>0) return Number(por[k]); }
  return Number(c.min_semana)>0 ? Number(c.min_semana) : CM_MIN_DEFAULT;
}

// Clientes asignados al comercial con el próximo contacto vencido (hoy incluido).
function cmPendientes(clientes, nombre, hoyIso){
  return (clientes||[]).filter(c=>cmMismo(c.comercial,nombre) && c.prox_fecha && c.prox_fecha<=hoyIso)
    .sort((a,b)=>String(a.prox_fecha).localeCompare(String(b.prox_fecha)));
}

// Último contacto con un cliente: visita de cualquier tipo o seguimiento del CRM.
function cmUltimoContacto(cliente, visitas){
  let ult='';
  (visitas||[]).forEach(v=>{ if(v.cliente_id===cliente.id && v.fecha>ult) ult=v.fecha; });
  (cliente.seguimientos||[]).forEach(s=>{ if(s.fecha>ult) ult=s.fecha; });
  return ult;
}
function cmSinContacto(clientes, visitas, nombre, hoyIso, dias){
  const lim=cmAddDias(hoyIso,-(dias||CM_DIAS_SIN_CONTACTO));
  return (clientes||[]).filter(c=>cmMismo(c.comercial,nombre) && c.estado!=='Perdido' && c.estado!=='Inactivo')
    .map(c=>({ c, ult:cmUltimoContacto(c,visitas) })).filter(x=>!x.ult || x.ult<lim)
    .sort((a,b)=>String(a.ult||'').localeCompare(String(b.ult||'')));
}

// Ventas facturadas a un cliente que su comercial no visitó ni contactó en los N días previos.
function cmVentasSinVisita(ventas, visitas, clientes, desdeIso, dias){
  const n=dias||CM_DIAS_VENTA; const cli={}; (clientes||[]).forEach(c=>cli[c.id]=c);
  return (ventas||[]).filter(v=>v.fecha>=desdeIso && v.cliente_id && String(v.comercial||'').trim())
    .filter(v=>{
      const ini=cmAddDias(v.fecha,-n);
      const visto=(visitas||[]).some(x=>x.cliente_id===v.cliente_id && x.fecha>=ini && x.fecha<=v.fecha && cmMismo(x.tecnico,v.comercial));
      if(visto) return false;
      const c=cli[v.cliente_id]; const seg=c && (c.seguimientos||[]).some(s=>s.fecha>=ini && s.fecha<=v.fecha && cmMismo(s.por,v.comercial));
      return !seg;
    }).sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha)));
}

function cmSolicitudes(visitas){
  return (visitas||[]).filter(v=>v.tipo==='rapida' && v.comercial && v.comercial.cotiz && v.comercial.cotiz.estado)
    .sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha)));
}
function cmResultados(visitas, nombre, desde, hasta){
  const o={}; cmVisitasEnRango(visitas,nombre,desde,hasta,false).forEach(v=>{ const k=v.tipo==='rapida'?((v.comercial||{}).resultado||'seguimiento'):(v.tipo==='comercial'?'presentacion':'seguimiento'); o[k]=(o[k]||0)+1; });
  return o;
}
// Reprogramaciones: seguimientos que el propio comercial marcó como reprogramados.
function cmReprogramaciones(clientes, nombre, desde){
  let n=0; (clientes||[]).forEach(c=>(c.seguimientos||[]).forEach(s=>{ if(s.reprog && cmMismo(s.por,nombre) && s.fecha>=desde) n++; })); return n;
}

// Agenda de la semana del comercial (módulo Agenda, tabla bio_agenda).
function cmPlanSemana(agenda, nombre, hoyIso){ const s=cmSemana(hoyIso);
  return (agenda||[]).filter(a=>cmMismo(a.comercial,nombre) && a.fecha>=s.desde && a.fecha<=s.hasta)
    .sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha))); }
// Cuántos contactos faltan planificar para llegar al mínimo de la semana.
function cmPlanFalta(agenda, nombre, hoyIso, minimo){ return Math.max(0, (minimo||CM_MIN_DEFAULT) - cmPlanSemana(agenda,nombre,hoyIso).length); }

// ── estado / configuración compartida (bio_config id='comercial') ──
function getComCfg(){ try{ return JSON.parse(localStorage.getItem('bio:comcfg'))||{}; }catch{ return {}; } }
function setComCfg(d){ localStorage.setItem('bio:comcfg', JSON.stringify(d||{})); }
async function pullComCfg(){ if(typeof AUTH_ON==='undefined'||!AUTH_ON) return; try{ const rows=await sb.query('bio_config',{id:'comercial'}); if(rows&&rows[0]&&rows[0].data){ const d=(typeof rows[0].data==='string')?JSON.parse(rows[0].data):rows[0].data; if(d) setComCfg(d); } }catch(e){} }
async function pushComCfg(){ if(typeof AUTH_ON==='undefined'||!AUTH_ON) return; try{ await sb.upsert('bio_config',{id:'comercial',data:getComCfg()||{},ts:new Date().toISOString()},'id'); }catch(e){} }

function cmYo(){ return (typeof miNombre==='function') ? miNombre() : ''; }
// El bloqueo de pendientes es sólo para el rol comercial (técnico) con sesión.
function cmEsComercial(){ return typeof currentRol!=='undefined' && currentRol==='tecnico'; }
function cmMisPendientes(){ return cmPendientes(getClientes(), cmYo(), hoy()); }
function cmMiPlanFalta(){ const yo=cmYo(); return cmPlanFalta(getAgenda(), yo, hoy(), cmMinimo(getComCfg(),yo)); }
// Qué tiene que resolver antes de usar la app: primero los vencidos, después planificar la semana.
function cmExigirDesde(){ return getComCfg().exigir_desde || CM_EXIGIR_DESDE; }
function cmBloqueo(){ if(!cmEsComercial() || !cmYo()) return ''; if(hoy() < cmExigirDesde()) return ''; if(cmMisPendientes().length) return 'pendientes'; if(cmMiPlanFalta()>0) return 'plan'; return ''; }
function cmBloqueado(){ return !!cmBloqueo(); }
function cmIrBloqueo(){ if(cmBloqueo()==='plan') openPlanSemana(); else openPendientes(); }

// ══════════════════════════════════════════════════════════
//  PANTALLAS (se inyectan al cargar)
// ══════════════════════════════════════════════════════════
function cmInyectar(){
  const home=gs('sHome'); if(!home || gs('sVisitaRapida')) return;
  const cont=home.parentNode;
  const mk=(id,html)=>{ const d=document.createElement('div'); d.className='screen'; d.id=id; d.innerHTML=html; cont.appendChild(d); };
  mk('sVisitaRapida','<div id="vrBody"></div>');
  mk('sPendientes','<div id="pdBody"></div>');
  mk('sPlanSemana','<div id="psBody"></div>');
  mk('sMiTablero','<div id="mtbBody"></div>');
  mk('sTabCom','<div id="tcBody"></div>');
  // Botón grande arriba del inicio + tiles nuevos en el grupo Comercial
  const strip=home.querySelector('.stat-strip');
  const top=document.createElement('div'); top.id='cmHomeTop';
  strip.parentNode.insertBefore(top, strip);
  const grp=gs('grpComercial');
  if(grp){
    grp.insertAdjacentHTML('afterbegin',
      '<div class="tile" id="tileMiTab" onclick="openMiTablero()" style="display:none"><div class="ico">📈</div><div class="tlab">Mi tablero</div><div class="tsub">mis visitas, ventas y meta</div></div>'
     +'<div class="tile" id="tileTabCom" onclick="openTabCom()" style="display:none"><div class="ico">📊</div><div class="tlab">Tablero comercial</div><div class="tsub" id="tileTabComSub">equipo, pendientes y pedidos</div></div>');
  }
  const ha=gs('histAcciones');
  if(ha){ const row=ha.querySelector('div[style*="display:flex"]'); if(row) row.insertAdjacentHTML('afterbegin','<button class="btn btn-primary" style="flex:1.3" onclick="openVisitaRapida()">⚡ Rápida</button>'); }
  const ft=gs('hFiltroTipo'); if(ft && !ft.querySelector('option[value="rapida"]')) ft.insertAdjacentHTML('beforeend','<option value="rapida">Rápidas</option>');
}

function cmHomeTop(){
  const el=gs('cmHomeTop'); if(!el) return;
  const puede = typeof puedeVer==='function' && puedeVer('visita') && canEdit();
  if(!puede){ el.innerHTML=''; return; }
  const yo=cmYo(); const pend=yo?cmMisPendientes().length:0;
  const sem=yo?cmVisitasSemana(getVisitas(),yo,hoy()):0, min=cmMinimo(getComCfg(),yo);
  const col=sem>=min?'var(--green)':(sem>=Math.ceil(min*0.6)?'#b54708':'var(--red)');
  const aviso=(cmEsComercial() && hoy()<cmExigirDesde())?`<div class="card" style="border-left:4px solid #b54708;margin-bottom:8px"><div class="card-b" style="font-size:12px">📢 Desde el <b>${fmtFecha(cmExigirDesde())}</b> la app va a pedir, antes de usar el resto: tener al día los seguimientos vencidos y cargada la agenda de la semana (mínimo ${min} clientes). <span style="color:var(--green);cursor:pointer;font-weight:600" onclick="openPlanSemana()">Planificar ahora ›</span></div></div>`:'';
  el.innerHTML=`<button class="btn btn-primary btn-block" style="font-size:16px;padding:14px;margin-bottom:8px" onclick="openVisitaRapida()">⚡ Registrar visita o contacto</button>
    ${aviso}
    ${(cmEsComercial()&&yo)?`<div style="display:flex;gap:8px;margin-bottom:12px">
      <div class="findet" style="flex:1;padding:8px 10px;cursor:pointer" onclick="openMiTablero()"><div style="font-size:10px;color:var(--gray-500);font-weight:700">VISITAS HECHAS</div><div style="font-size:18px;font-weight:800;color:${col}">${sem} <span style="font-size:12px;color:var(--gray-400);font-weight:600">de ${min}</span></div></div>
      <div class="findet" style="flex:1;padding:8px 10px;cursor:pointer" onclick="openPlanSemana()"><div style="font-size:10px;color:var(--gray-500);font-weight:700">AGENDA SEMANA</div><div style="font-size:18px;font-weight:800;color:${cmPlanSemana(getAgenda(),yo,hoy()).length>=min?'var(--green)':'var(--red)'}">${cmPlanSemana(getAgenda(),yo,hoy()).length} <span style="font-size:12px;color:var(--gray-400);font-weight:600">de ${min}</span></div></div>
      <div class="findet" style="flex:1;padding:8px 10px;cursor:pointer" onclick="openPendientes()"><div style="font-size:10px;color:var(--gray-500);font-weight:700">VENCIDOS</div><div style="font-size:18px;font-weight:800;color:${pend?'var(--red)':'var(--green)'}">${pend}</div></div>
    </div>`:''}`;
}

// ══════════════════════════════════════════════════════════
//  VISITA RÁPIDA
// ══════════════════════════════════════════════════════════
let _vr={};   // estado del formulario
function openVisitaRapida(clienteId){
  if(!(puedeVer('visita')&&canEdit())){ showToast('Sin permiso'); return; }
  _vr={ cliente_id:clienteId||'', medio:'Visita', resultado:'', prox:'', fechaProx:'', items:[{producto:'',kg:''}], gps:null };
  showScreen('sVisitaRapida','Registrar visita','En 20 segundos',true);
  cmVrRender();
  cmVrGps();
}
function cmVrClientesOpts(q){
  const yo=cmYo(); const vis=getVisitas(); const ql=cmNorm(q);
  const ult={}; vis.forEach(v=>{ if(v.cliente_id && cmMismo(v.tecnico,yo) && (!ult[v.cliente_id]||v.fecha>ult[v.cliente_id])) ult[v.cliente_id]=v.fecha; });
  let cl=getClientes().slice();
  if(ql) cl=cl.filter(c=>cmNorm(c.nombre).includes(ql));
  // primero los míos visitados hace poco, después los asignados a mí, después el resto
  cl.sort((a,b)=>{ const ra=(ult[a.id]?2:0)+(cmMismo(a.comercial,yo)?1:0), rb=(ult[b.id]?2:0)+(cmMismo(b.comercial,yo)?1:0);
    if(ra!==rb) return rb-ra; if(ult[a.id]&&ult[b.id]) return ult[b.id].localeCompare(ult[a.id]); return String(a.nombre||'').localeCompare(String(b.nombre||'')); });
  return cl.slice(0,60);
}
function cmChips(grupo, opciones, sel, fn){
  return `<div style="display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 10px">${opciones.map(o=>{ const k=Array.isArray(o)?o[0]:o, l=Array.isArray(o)?o[1]:o; const on=sel===k;
    return `<button type="button" onclick="${fn}('${k}')" style="border:1.5px solid ${on?'var(--green)':'var(--gray-200)'};background:${on?'var(--green)':'#fff'};color:${on?'#fff':'var(--gray-700)'};border-radius:16px;padding:7px 12px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer">${esc(l)}</button>`; }).join('')}</div>`;
}
function cmVrRender(){
  const c=_vr.cliente_id?clienteById(_vr.cliente_id):null;
  const pc=_vr.resultado==='pide_cotiz', pe=_vr.resultado==='pedido';
  const sinProxOk=CM_SIN_PROX_OK.includes(_vr.resultado);
  const proxOpts=CM_PROX.filter(p=>p[0]!=='ninguno'||sinProxOk);
  if(_vr.prox==='ninguno' && !sinProxOk) _vr.prox='';
  gs('vrBody').innerHTML=`
  <div class="card"><div class="card-b">
    <label class="fl">Cliente</label>
    ${c?`<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border:1.5px solid var(--green);border-radius:10px;margin-bottom:6px"><b>${esc(c.nombre)}</b><span style="color:var(--green);cursor:pointer;font-weight:600;font-size:13px" onclick="_vr.cliente_id='';cmVrRender()">cambiar</span></div>`
      :`<input type="search" id="vrBuscar" placeholder="🔎 Buscar cliente… (o escribí un prospecto nuevo)" autocomplete="off" oninput="cmVrFiltrar()" value="${esc(_vr.q||'')}">
        <div id="vrLista" style="max-height:210px;overflow:auto;margin-top:4px"></div>`}
    <label class="fl">¿Cómo fue el contacto?</label>
    ${cmChips('medio',CM_MEDIOS,_vr.medio,'cmVrMedio')}
    <label class="fl">¿Qué pasó?</label>
    ${cmChips('res',CM_RESULTADOS,_vr.resultado,'cmVrRes')}
    ${pc?`<div style="background:#f0f7ff;border-radius:10px;padding:9px 10px;margin-bottom:10px">
        <div style="font-size:12px;font-weight:700;color:#1e3f63;margin-bottom:4px">📨 Pedido de cotización a gerencia</div>
        <div style="font-size:11px;color:var(--gray-500);margin-bottom:6px">Gerencia arma el precio (flete, margen, forma de pago). Acá sólo qué y cuánto.</div>
        <datalist id="vrProdList">${(typeof precioList==='function'?precioList():[]).map(p=>`<option value="${esc(p.n)}">`).join('')}</datalist>
        ${_vr.items.map((it,i)=>`<div style="display:flex;gap:6px;margin-bottom:5px"><input list="vrProdList" placeholder="Producto" value="${esc(it.producto)}" oninput="_vr.items[${i}].producto=this.value" style="flex:1;min-width:0"><input type="number" inputmode="numeric" placeholder="kg aprox" value="${esc(it.kg)}" oninput="_vr.items[${i}].kg=this.value" style="width:92px"></div>`).join('')}
        <span style="color:var(--green);cursor:pointer;font-size:12px;font-weight:600" onclick="_vr.items.push({producto:'',kg:''});cmVrRender()">＋ otro producto</span>
        <label class="fl" style="margin-top:6px">Condición que pide el cliente <span style="color:var(--gray-400);font-weight:400">(opcional)</span></label>
        <input id="vrCond" placeholder="ej: a 60 días, entrega en estancia…" value="${esc(_vr.cond||'')}" oninput="_vr.cond=this.value" autocomplete="off">
      </div>`:''}
    ${pe?`<div style="background:#f0fdf4;border-radius:10px;padding:9px 10px;margin-bottom:10px">
        <div style="font-size:12px;font-weight:700;color:var(--green);margin-bottom:4px">✅ Pedido confirmado</div>
        <label class="fl">Monto aproximado con IVA <span style="color:var(--gray-400);font-weight:400">(opcional)</span></label>
        <input type="number" inputmode="numeric" id="vrMonto" placeholder="₲" value="${esc(_vr.monto||'')}" oninput="_vr.monto=this.value">
        <div style="font-size:11px;color:var(--gray-500)">Administración lo factura; esto queda como aviso en el tablero de gerencia.</div>
      </div>`:''}
    <label class="fl">Nota <span style="color:var(--gray-400);font-weight:400">(podés dictarla con el micrófono del teclado)</span></label>
    <textarea id="vrNota" placeholder="Qué se habló, qué necesita…" oninput="_vr.nota=this.value">${esc(_vr.nota||'')}</textarea>
    <label class="fl">Próximo paso</label>
    ${cmChips('prox',proxOpts,_vr.prox,'cmVrProx')}
    ${(_vr.prox && _vr.prox!=='ninguno')?`<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:-4px 0 10px">
        ${[7,15,30].map(d=>`<button type="button" onclick="cmVrDias(${d})" style="border:1.5px solid var(--gray-200);background:#fff;border-radius:14px;padding:6px 10px;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer">+${d} días</button>`).join('')}
        <input type="date" id="vrFechaProx" value="${_vr.fechaProx||''}" onchange="_vr.fechaProx=this.value" style="flex:1;min-width:130px">
      </div>`:''}
    <div id="vrGps" style="font-size:11px;color:var(--gray-400);margin-bottom:8px">${cmVrGpsTxt()}</div>
    <button class="btn btn-primary btn-block" style="font-size:16px;padding:13px" onclick="cmVrGuardar()">✓ Guardar</button>
  </div></div>
  <div style="font-size:11px;color:var(--gray-400);text-align:center;margin:-2px 0 12px">¿Necesitás el informe técnico con lotes y KPIs? <span style="color:var(--green);cursor:pointer;font-weight:600" onclick="nuevaVisita()">Visita técnica completa</span></div>`;
  if(!c) cmVrFiltrar();
}
function cmVrFiltrar(){
  const inp=gs('vrBuscar'); const q=inp?inp.value:''; _vr.q=q; const box=gs('vrLista'); if(!box) return;
  const ops=cmVrClientesOpts(q);
  box.innerHTML = ops.map(c=>`<div class="li" style="padding:8px 10px" onclick="_vr.cliente_id='${c.id}';_vr.prospecto='';cmVrRender()"><div class="li-t" style="font-size:13px">${esc(c.nombre)}</div>${c.comercial?`<div class="li-s">${esc(c.comercial)}</div>`:''}</div>`).join('')
    + (q.trim()?`<div class="li" style="padding:8px 10px;color:var(--green)" onclick="_vr.prospecto=gs('vrBuscar').value.trim();cmVrProspectoMsg()"><div class="li-t" style="font-size:13px">➕ Prospecto nuevo: <b>${esc(q.trim())}</b></div></div>`:'')
    + (_vr.prospecto?`<div style="font-size:12px;color:var(--green);padding:6px 2px">Se va a crear el prospecto <b>${esc(_vr.prospecto)}</b> asignado a vos.</div>`:'');
}
function cmVrProspectoMsg(){ cmVrFiltrar(); }
function cmVrMedio(k){ _vr.medio=k; cmVrKeep(); cmVrRender(); }
function cmVrRes(k){ _vr.resultado=k; if(!_vr.prox){ _vr.prox = k==='pide_cotiz'?'llamar':(k==='sin_interes'?'ninguno':'visitar'); if(_vr.prox!=='ninguno') _vr.fechaProx=cmAddDias(hoy(), k==='pide_cotiz'?7:15); } cmVrKeep(); cmVrRender(); }
function cmVrProx(k){ _vr.prox=k; if(k==='ninguno') _vr.fechaProx=''; else if(!_vr.fechaProx) _vr.fechaProx=cmAddDias(hoy(),15); cmVrKeep(); cmVrRender(); }
function cmVrDias(d){ _vr.fechaProx=cmAddDias(hoy(),d); const f=gs('vrFechaProx'); if(f) f.value=_vr.fechaProx; }
function cmVrKeep(){ const n=gs('vrNota'); if(n) _vr.nota=n.value; const b=gs('vrBuscar'); if(b) _vr.q=b.value; }
function cmVrGpsTxt(){ const g=_vr.gps; if(g==null) return '📍 Buscando ubicación…'; if(g===false) return '📍 Sin ubicación (no es obligatoria)'; return '📍 Ubicación registrada (±'+Math.round(g.acc||0)+' m)'; }
function cmVrGps(){
  if(!navigator.geolocation){ _vr.gps=false; return; }
  try{ navigator.geolocation.getCurrentPosition(p=>{ _vr.gps={ lat:+p.coords.latitude.toFixed(6), lng:+p.coords.longitude.toFixed(6), acc:p.coords.accuracy }; const el=gs('vrGps'); if(el) el.textContent=cmVrGpsTxt(); },
    ()=>{ _vr.gps=false; const el=gs('vrGps'); if(el) el.textContent=cmVrGpsTxt(); }, { timeout:9000, maximumAge:300000, enableHighAccuracy:false }); }catch(e){ _vr.gps=false; }
}
function cmVrGuardar(){
  cmVrKeep();
  const yo=cmYo(); if(!yo){ showToast('No se reconoce tu nombre de usuario'); return; }
  if(!_vr.cliente_id && !_vr.prospecto){ showToast('Elegí el cliente (o tocá "Prospecto nuevo")'); return; }
  if(!_vr.resultado){ showToast('Marcá qué pasó'); return; }
  if(!_vr.prox){ showToast('Elegí el próximo paso'); return; }
  if(_vr.prox!=='ninguno' && !_vr.fechaProx){ showToast('Poné la fecha del próximo paso'); return; }
  if(_vr.prox!=='ninguno' && _vr.fechaProx<hoy()){ showToast('La fecha del próximo paso no puede ser pasada'); return; }
  let items=[];
  if(_vr.resultado==='pide_cotiz'){ items=_vr.items.filter(x=>String(x.producto||'').trim()).map(x=>({producto:String(x.producto).trim(), kg:Number(x.kg)||null}));
    if(!items.length){ showToast('Indicá al menos un producto para cotizar'); return; } }
  const ahora=new Date().toISOString(); const f=hoy();
  // prospecto nuevo → se crea el cliente, asignado al comercial
  let cl=getClientes(); let c=_vr.cliente_id?cl.find(x=>x.id===_vr.cliente_id):null;
  if(!c){ c={ id:'CL-'+Date.now(), nombre:_vr.prospecto, codigo:'', ruc:'', direccion:'', contacto:'', tel:'', email:'', ubicacion:'', obs:'', estado:'Prospecto', prioridad:'', comercial:yo, prox_fecha:'', prox_nota:'', seguimientos:[], ts:ahora, pending:true }; cl.push(c); }
  const com={ medio:_vr.medio, resultado:_vr.resultado, nota:(_vr.nota||'').trim(), prox_tipo:_vr.prox };
  if(items.length) com.cotiz={ items, cond:(_vr.cond||'').trim(), estado:'pendiente', pedida:ahora };
  if(_vr.resultado==='pedido') com.pedido={ monto:Number(_vr.monto)||null };
  if(_vr.gps) com.gps=_vr.gps;
  const v={ id:'VR-'+Date.now(), tipo:'rapida', cliente_id:c.id, estancia_id:'', fecha:f, tecnico:yo, evaluaciones:[], comercial:com, diagnostico:'', recomendacion:'', proxima:(_vr.prox!=='ninguno'?_vr.fechaProx:''), ts:ahora, pending:true };
  // CRM: el seguimiento queda en la ficha y el próximo contacto se reemplaza
  c.seguimientos=c.seguimientos||[];
  c.seguimientos.unshift({ id:'SG-'+Date.now(), fecha:f, tipo:_vr.medio, nota:cmResLbl(_vr.resultado)+(com.nota?': '+com.nota:''), por:yo, visita_id:v.id });
  c.prox_fecha = _vr.prox!=='ninguno' ? _vr.fechaProx : '';
  c.prox_nota  = _vr.prox!=='ninguno' ? cmProxLbl(_vr.prox) : '';
  if(!String(c.comercial||'').trim()) c.comercial=yo;
  if(_vr.resultado==='pedido' && (c.estado==='Prospecto'||c.estado==='Contactado'||c.estado==='Negociación'||!c.estado)) c.estado='Activo';
  c.ts=ahora; c.pending=true;
  saveClientes(cl); cloudPush('clientes',c);
  const vs=getVisitas(); vs.unshift(v); saveVisitas(vs); cloudPush('visitas',v);
  // Si estaba en la agenda de la semana, queda hecha.
  const ag=getAgenda(); const sm=cmSemana(f);
  const pl=ag.find(a=>(a.cliente_id===c.id || (!a.cliente_id && cmMismo(a.titulo,c.nombre))) && a.estado!=='hecha' && cmMismo(a.comercial,yo) && a.fecha>=sm.desde && a.fecha<=sm.hasta);
  if(pl){ pl.estado='hecha'; pl.ts=ahora; pl.pending=true; saveAgenda(ag); cloudPush('agenda',pl); }
  showToast(items.length?'✓ Guardada · pedido de cotización enviado a gerencia':'✓ Visita guardada');
  _vr={};
  if(cmBloqueado()) cmIrBloqueo(); else goHome();
}

// ── detalle e ítem de lista para el historial ──
function cmVisitaLi(v){
  const c=clienteById(v.cliente_id); const com=v.comercial||{};
  const est=com.cotiz?` · cotización <b>${esc(com.cotiz.estado)}</b>`:'';
  return `<div class="li" onclick="verVisita('${v.id}')">
    <div style="min-width:0"><div class="li-t">${esc(c?c.nombre:'—')} <span class="chip" style="background:#fef3c7;color:#92400e">${esc(com.medio||'Visita')}</span> <span class="chip" style="background:#f1f5f9;color:#334155">${esc(cmResLbl(com.resultado))}</span></div>
    <div class="li-s">${fmtFecha(v.fecha)}${v.tecnico?' · '+esc(v.tecnico):''}${est}${com.nota?' · '+esc(String(com.nota).slice(0,60)):''}</div></div>
    <div class="li-chev">›</div></div>`;
}
function cmVerVisita(v){
  const c=clienteById(v.cliente_id); const com=v.comercial||{};
  const cot=com.cotiz?`<div class="sect-t">Pedido de cotización · ${esc(com.cotiz.estado)}</div><ul style="font-size:12px;margin:2px 0 0;padding-left:18px">${(com.cotiz.items||[]).map(i=>`<li>${esc(i.producto)}${i.kg?' — '+Number(i.kg).toLocaleString('es-PY')+' kg':''}</li>`).join('')}</ul>${com.cotiz.cond?`<div style="font-size:12px;color:var(--gray-600)">Condición: ${esc(com.cotiz.cond)}</div>`:''}${com.cotiz.ref?`<div style="font-size:12px;color:var(--gray-600)">Ref.: ${esc(com.cotiz.ref)}</div>`:''}`:'';
  gs('modalBox').innerHTML=`<h3>${esc(c?c.nombre:'—')}</h3>
    <div style="font-size:12px;color:var(--gray-600)">${fmtFecha(v.fecha)} · ${esc(com.medio||'Visita')}${v.tecnico?' · '+esc(v.tecnico):''}</div>
    <div style="margin-top:8px"><span class="chip" style="background:#f1f5f9;color:#334155">${esc(cmResLbl(com.resultado))}</span></div>
    ${com.nota?`<div style="font-size:13px;margin-top:8px;white-space:pre-wrap">${esc(com.nota)}</div>`:''}
    ${com.pedido&&com.pedido.monto?`<div style="font-size:12px;margin-top:6px">Monto aprox.: <b>${finGsFmt(com.pedido.monto)}</b></div>`:''}
    ${cot}
    <div style="font-size:12px;margin-top:8px">Próximo paso: <b>${esc(cmProxLbl(com.prox_tipo))}</b>${v.proxima?' · '+fmtFecha(v.proxima):''}</div>
    ${com.gps?`<div style="font-size:11px;margin-top:4px"><a href="https://maps.google.com/?q=${com.gps.lat},${com.gps.lng}" target="_blank" rel="noopener">📍 Ver ubicación</a></div>`:''}
    ${canEdit()&&(esGerente()||cmMismo(v.tecnico,cmYo()))?`<button class="btn btn-sec btn-block" style="margin-top:12px;color:var(--red)" onclick="borrarVisita('${v.id}')">Borrar</button>`:''}
    <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="cerrarModal()">Cerrar</button>`;
  gs('modal').classList.add('show');
}

// ══════════════════════════════════════════════════════════
//  PENDIENTES PRIMERO
// ══════════════════════════════════════════════════════════
function openPendientes(){ showScreen('sPendientes','Seguimientos vencidos','Resolvelos para seguir',!cmBloqueado()); cmRenderPendientes(); }
function cmRenderPendientes(){
  const yo=cmYo(); const lst=cmPendientes(getClientes(), yo, hoy()); const bl=cmBloqueo()==='pendientes';
  gs('pdBody').innerHTML = `
    ${bl?`<div class="card" style="border-left:4px solid var(--red)"><div class="card-b" style="font-size:13px">Tenés <b>${lst.length}</b> seguimiento${lst.length!==1?'s':''} vencido${lst.length!==1?'s':''}. Para usar el resto de la app, registrá qué pasó o reprogramalo con un motivo.</div></div>`
       :`<div class="card"><div class="card-b" style="font-size:13px;color:var(--green)">✔ No tenés seguimientos vencidos.</div></div>`}
    <div class="card"><div>${lst.map(c=>{ const dias=cmDiffDias(c.prox_fecha,hoy());
      return `<div style="padding:10px 12px;border-top:1px solid var(--gray-100)">
        <div style="display:flex;justify-content:space-between;gap:8px"><b style="font-size:14px">${esc(c.nombre)}</b><span style="font-size:11px;color:var(--red);white-space:nowrap">${dias===0?'hoy':'hace '+dias+' día'+(dias!==1?'s':'')}</span></div>
        <div style="font-size:12px;color:var(--gray-600);margin:2px 0 8px">${esc(c.prox_nota||'Contactar')}${c.estado?' · '+esc(c.estado):''}</div>
        <div style="display:flex;gap:8px"><button class="btn btn-primary" style="flex:1;padding:9px" onclick="openVisitaRapida('${c.id}')">✓ Registrar contacto</button><button class="btn btn-sec" style="flex:1;padding:9px" onclick="cmReprogModal('${c.id}')">⏰ Reprogramar</button></div>
      </div>`; }).join('')}</div></div>
    ${bl?'':'<button class="btn btn-ghost btn-block" onclick="goHome()">Volver al inicio</button>'}`;
}
function cmReprogModal(id){
  const c=clienteById(id); if(!c) return;
  gs('modalBox').innerHTML=`<h3>Reprogramar · ${esc(c.nombre)}</h3>
    <label class="fl">Nueva fecha</label><input type="date" id="rpFecha" value="${cmAddDias(hoy(),7)}">
    <label class="fl">Motivo (obligatorio)</label><input id="rpMotivo" placeholder="ej: el cliente pidió llamar la semana que viene" autocomplete="off">
    <div style="font-size:11px;color:var(--gray-500);margin-top:4px">Las reprogramaciones quedan registradas y las ve gerencia.</div>
    <div class="row2" style="margin-top:12px"><button class="btn btn-sec" onclick="cerrarModal()">Cancelar</button><button class="btn btn-primary" onclick="cmReprogGuardar('${id}')">Guardar</button></div>`;
  gs('modal').classList.add('show');
}
function cmReprogGuardar(id){
  const f=gs('rpFecha').value, m=(gs('rpMotivo').value||'').trim();
  if(!f || f<=hoy()){ showToast('La nueva fecha tiene que ser posterior a hoy'); return; }
  if(m.length<5){ showToast('Escribí el motivo'); return; }
  const cl=getClientes(); const c=cl.find(x=>x.id===id); if(!c) return;
  c.seguimientos=c.seguimientos||[];
  c.seguimientos.unshift({ id:'SG-'+Date.now(), fecha:hoy(), tipo:'Nota', nota:'Reprogramado al '+fmtFecha(f)+': '+m, por:cmYo(), reprog:true });
  c.prox_fecha=f; c.ts=new Date().toISOString(); c.pending=true;
  saveClientes(cl); cloudPush('clientes',c); cerrarModal(); showToast('✓ Reprogramado');
  if(cmBloqueo()==='pendientes') cmRenderPendientes(); else if(cmBloqueado()) cmIrBloqueo(); else goHome();
}

// ══════════════════════════════════════════════════════════
//  AGENDA SEMANAL OBLIGATORIA
//  Alcanza con el nombre del cliente (o prospecto) y el día. Se guarda en la
//  misma tabla que el módulo Agenda, así gerencia lo ve también ahí.
// ══════════════════════════════════════════════════════════
let _ps={ dia:'', medio:'Visita', q:'' };
function openPlanSemana(){ _ps={ dia:'', medio:'Visita', q:'' }; showScreen('sPlanSemana','Mi semana','Planificá a quién vas a ver',!cmBloqueado()); cmRenderPlan(); }
function cmDiasSemana(){ const s=cmSemana(hoy()); const n=['Lun','Mar','Mié','Jue','Vie','Sáb']; return n.map((x,i)=>[cmAddDias(s.desde,i),x]); }
function cmRenderPlan(){
  const yo=cmYo(), h=hoy(), min=cmMinimo(getComCfg(),yo);
  const plan=cmPlanSemana(getAgenda(),yo,h); const falta=Math.max(0,min-plan.length);
  const dias=cmDiasSemana(); if(!_ps.dia) _ps.dia=(dias.find(d=>d[0]>=h)||dias[dias.length-1])[0];
  const enPlan=new Set(plan.map(a=>a.cliente_id).filter(Boolean));
  const sm=cmSemana(h);
  const sug=[]; const ya=new Set();
  getClientes().filter(c=>cmMismo(c.comercial,yo) && c.prox_fecha && c.prox_fecha<=sm.hasta && !enPlan.has(c.id)).forEach(c=>{ sug.push({c, por:'seguimiento '+fmtFecha(c.prox_fecha)}); ya.add(c.id); });
  cmSinContacto(getClientes(),getVisitas(),yo,h).filter(x=>!enPlan.has(x.c.id)&&!ya.has(x.c.id)).slice(0,8).forEach(x=>sug.push({c:x.c, por:x.ult?'sin contacto desde '+fmtFecha(x.ult):'nunca contactado'}));
  const q=_ps.q||''; const ops=q.trim()?cmVrClientesOpts(q).filter(c=>!enPlan.has(c.id)).slice(0,12):[];
  gs('psBody').innerHTML=`
    <div class="card" style="border-left:4px solid ${falta?'var(--red)':'var(--green)'}"><div class="card-b" style="font-size:13px">
      ${falta?`Cargá a quién vas a visitar o contactar esta semana: te faltan <b>${falta}</b> de ${min}. Alcanza con el nombre y el día.`:`✔ Semana planificada: ${plan.length} contacto${plan.length!==1?'s':''}.`}
    </div></div>
    <div class="card"><div class="card-b">
      <label class="fl">Día</label>${cmChips('dia',dias,_ps.dia,'cmPsDia')}
      <label class="fl">Tipo</label>${cmChips('medio',['Visita','Llamada'],_ps.medio,'cmPsMedio')}
      <label class="fl">Cliente o prospecto</label>
      <input type="search" id="psBuscar" placeholder="🔎 Buscar o escribir un nombre…" autocomplete="off" value="${esc(q)}" oninput="_ps.q=this.value;cmPsLista()">
      <div id="psLista" style="max-height:200px;overflow:auto;margin-top:4px">${cmPsListaHtml(ops,q)}</div>
    </div></div>
    ${sug.length?`<div class="card"><div class="card-h"><span>Sugeridos · tocá para agregar</span></div><div>${sug.map(x=>`<div class="li" onclick="cmPsAdd('${x.c.id}')"><div style="min-width:0"><div class="li-t" style="font-size:13px">${esc(x.c.nombre)}</div><div class="li-s">${esc(x.por)}</div></div><span style="color:var(--green);font-weight:700">＋</span></div>`).join('')}</div></div>`:''}
    <div class="card"><div class="card-h"><span>Mi semana · ${fmtFecha(sm.desde)} – ${fmtFecha(sm.hasta)}</span><span style="color:var(--gray-400);font-weight:500">${plan.length}</span></div><div>
      ${plan.map(a=>`<div class="li" style="cursor:default"><div style="min-width:0"><div class="li-t" style="font-size:13px">${a.estado==='hecha'?'✅ ':''}${esc(a.titulo)}</div><div class="li-s">${esc((dias.find(d=>d[0]===a.fecha)||[0,fmtFecha(a.fecha)])[1])} · ${esc(a.nota||'Visita')}</div></div>${a.estado!=='hecha'?`<span style="color:var(--red);cursor:pointer;font-size:16px;padding:0 4px" onclick="cmPsQuitar('${a.id}')">✕</span>`:''}</div>`).join('')||'<div style="padding:10px 12px;font-size:12px;color:var(--gray-400)">Todavía no cargaste nada.</div>'}
    </div></div>
    ${falta?'':'<button class="btn btn-primary btn-block" onclick="goHome()">Listo</button>'}`;
}
function cmPsListaHtml(ops,q){
  return ops.map(c=>`<div class="li" style="padding:8px 10px" onclick="cmPsAdd('${c.id}')"><div class="li-t" style="font-size:13px">${esc(c.nombre)}</div><span style="color:var(--green);font-weight:700">＋</span></div>`).join('')
    + (q.trim()?`<div class="li" style="padding:8px 10px;color:var(--green)" onclick="cmPsAdd('',gs('psBuscar').value.trim())"><div class="li-t" style="font-size:13px">➕ Agregar <b>${esc(q.trim())}</b> como prospecto</div></div>`:'');
}
function cmPsLista(){ const box=gs('psLista'); if(!box) return; const yo=cmYo(); const en=new Set(cmPlanSemana(getAgenda(),yo,hoy()).map(a=>a.cliente_id).filter(Boolean)); box.innerHTML=cmPsListaHtml(_ps.q.trim()?cmVrClientesOpts(_ps.q).filter(c=>!en.has(c.id)).slice(0,12):[],_ps.q); }
function cmPsDia(d){ _ps.dia=d; cmRenderPlan(); }
function cmPsMedio(m){ _ps.medio=m; cmRenderPlan(); }
function cmPsAdd(cid, nombre){
  const yo=cmYo(); const c=cid?clienteById(cid):null; const tit=c?c.nombre:String(nombre||'').trim(); if(!tit){ showToast('Escribí un nombre'); return; }
  const a={ id:'AG-'+Date.now(), fecha:_ps.dia||hoy(), hora:'', tipo:'comercial', titulo:tit, lugar:'', cliente_id:cid||'', estancia_id:'', comercial:yo, nota:_ps.medio, estado:'pendiente', ts:new Date().toISOString(), pending:true };
  saveAgenda([a, ...getAgenda()]); cloudPush('agenda',a);
  _ps.q=''; cmRenderPlan(); showToast('✓ '+tit+' agregado');
}
function cmPsQuitar(id){ const ag=getAgenda(); const a=ag.find(x=>x.id===id); if(!a) return; saveAgenda(ag.filter(x=>x.id!==id)); if(typeof cloudDelete==='function') cloudDelete('agenda',id); cmRenderPlan(); }

// ══════════════════════════════════════════════════════════
//  MI TABLERO (comercial: sólo lo suyo)
// ══════════════════════════════════════════════════════════
function openMiTablero(){ showScreen('sMiTablero','Mi tablero',cmYo()||'',true); cmRenderMiTablero(); }
function cmKpi(lbl,val,sub,col){ return `<div class="findet" style="flex:1;min-width:120px;padding:9px 11px"><div style="font-size:10px;color:var(--gray-500);font-weight:700">${lbl}</div><div style="font-size:19px;font-weight:800;color:${col||'var(--gray-800)'}">${val}</div>${sub?`<div style="font-size:10px;color:var(--gray-400)">${sub}</div>`:''}</div>`; }
function cmRenderMiTablero(){
  const yo=cmYo(), h=hoy(), vis=getVisitas(), cl=getClientes();
  const sem=cmSemana(h), nSem=cmVisitasSemana(vis,yo,h), min=cmMinimo(getComCfg(),yo);
  const colSem=nSem>=min?'var(--green)':(nSem>=Math.ceil(min*0.6)?'#b54708':'var(--red)');
  const ym=h.slice(0,7), ini=ym+'-01';
  const res=cmResultados(vis,yo,ini,h);
  const pend=cmPendientes(cl,yo,h), sinC=cmSinContacto(cl,vis,yo,h);
  const sol=cmSolicitudes(vis).filter(v=>cmMismo(v.tecnico,yo)).slice(0,10);
  const mv=getVentas().filter(v=>cmMismo(v.comercial,yo) && String(v.fecha||'').startsWith(ym));
  const tot=mv.reduce((a,v)=>a+finGs(v,v.monto),0);
  let metaHtml='';
  try{ const filas=rankingMes(getVentas(),getMetas(),ym,_finComDe,finGs); const mia=filas.find(f=>cmMismo(f.comercial,yo)); if(mia){ const pv=_mtVista; _mtVista='mes'; metaHtml=_mtMiCardHtml(mia,ym,ymParse(ym),''); _mtVista=pv; } }catch(e){}
  gs('mtbBody').innerHTML=`
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
      ${cmKpi('VISITAS ESTA SEMANA',nSem+' <span style="font-size:12px;color:var(--gray-400)">de '+min+'</span>',fmtFecha(sem.desde)+' – '+fmtFecha(sem.hasta),colSem)}
      ${cmKpi('SEGUIMIENTOS VENCIDOS',pend.length,'',pend.length?'var(--red)':'var(--green)')}
      ${cmKpi('VENTAS DEL MES',finGsFmt(tot),'neto '+finGsFmt(mtNeto(tot)),'var(--gray-800)')}
    </div>
    ${(()=>{ const pl=cmPlanSemana(getAgenda(),yo,h); const hechas=pl.filter(a=>a.estado==='hecha').length; return `<div class="card" style="cursor:pointer" onclick="openPlanSemana()"><div class="card-h"><span>📅 Mi agenda de la semana</span><span style="color:var(--green);font-weight:600;font-size:12px">editar ›</span></div><div class="card-b" style="font-size:13px">${pl.length} planificado${pl.length!==1?'s':''} · <b>${hechas}</b> hecho${hechas!==1?'s':''}${pl.filter(a=>a.estado!=='hecha').slice(0,4).map(a=>'<div style="font-size:12px;color:var(--gray-600)">· '+esc(a.titulo)+' ('+fmtFecha(a.fecha)+')</div>').join('')}</div></div>`; })()}
    ${metaHtml||'<div class="card"><div class="card-b" style="font-size:12px;color:var(--gray-500)">Todavía no tenés meta cargada para este mes.</div></div>'}
    <div class="card"><div class="card-h"><span>Resultados de mis visitas · ${esc(typeof finMesLbl==='function'?finMesLbl(ym):ym)}</span></div><div class="card-b">
      ${Object.keys(res).length?CM_RESULTADOS.filter(r=>res[r[0]]).map(r=>`<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0"><span>${esc(r[1])}</span><b>${res[r[0]]}</b></div>`).join(''):'<div style="font-size:12px;color:var(--gray-400)">Sin visitas este mes.</div>'}
    </div></div>
    <div class="card"><div class="card-h"><span>Mis pedidos de cotización</span></div><div>
      ${sol.length?sol.map(v=>{ const c=clienteById(v.cliente_id), ct=v.comercial.cotiz; return `<div class="li" onclick="verVisita('${v.id}')"><div style="min-width:0"><div class="li-t" style="font-size:13px">${esc(c?c.nombre:'—')}</div><div class="li-s">${fmtFecha(v.fecha)} · ${(ct.items||[]).map(i=>esc(i.producto)).join(', ')}</div></div><span class="chip" style="background:${ct.estado==='pendiente'?'#fef3c7':'#dcfce7'};color:${ct.estado==='pendiente'?'#92400e':'#166534'}">${esc(ct.estado)}</span></div>`; }).join(''):'<div style="padding:10px 12px;font-size:12px;color:var(--gray-400)">Ninguno.</div>'}
    </div></div>
    <div class="card"><div class="card-h"><span>Mis ventas confirmadas del mes</span><span style="color:var(--gray-400);font-weight:500">${mv.length}</span></div><div>
      ${mv.length?mv.slice().sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha))).map(v=>`<div class="li" style="cursor:default"><div style="min-width:0"><div class="li-t" style="font-size:13px">${esc(v.cliente||((clienteById(v.cliente_id)||{}).nombre)||'—')}</div><div class="li-s">${fmtFecha(v.fecha)}${v.factura?' · Fact. '+esc(v.factura):''}</div></div><b style="font-size:13px">${finGsFmt(finGs(v,v.monto))}</b></div>`).join(''):'<div style="padding:10px 12px;font-size:12px;color:var(--gray-400)">Todavía no hay ventas facturadas a tu nombre este mes.</div>'}
    </div></div>
    <div class="card"><div class="card-h"><span>Mis clientes sin contacto hace +${CM_DIAS_SIN_CONTACTO} días</span><span style="color:var(--gray-400);font-weight:500">${sinC.length}</span></div><div>
      ${sinC.slice(0,15).map(x=>`<div class="li" onclick="openVisitaRapida('${x.c.id}')"><div style="min-width:0"><div class="li-t" style="font-size:13px">${esc(x.c.nombre)}</div><div class="li-s">${x.ult?'último contacto '+fmtFecha(x.ult):'nunca contactado'}</div></div><div class="li-chev">›</div></div>`).join('')||'<div style="padding:10px 12px;font-size:12px;color:var(--green)">✔ Todos contactados.</div>'}
    </div></div>`;
}

// ══════════════════════════════════════════════════════════
//  TABLERO COMERCIAL (gerente)
// ══════════════════════════════════════════════════════════
function cmComerciales(){
  const s=new Map(); const add=n=>{ const t=String(n||'').trim(); if(t && !s.has(cmNorm(t))) s.set(cmNorm(t),t); };
  getClientes().forEach(c=>add(c.comercial)); getMetas().forEach(m=>add(m.comercial));
  const desde=cmAddDias(hoy(),-60); getVisitas().forEach(v=>{ if(v.fecha>=desde) add(v.tecnico); });
  return [...s.values()].sort((a,b)=>a.localeCompare(b));
}
function openTabCom(){ if(!esGerente()){ showToast('Sólo gerencia'); return; } showScreen('sTabCom','Tablero comercial','Equipo, pendientes y pedidos',true); cmRenderTabCom(); }
function cmRenderTabCom(){
  const h=hoy(), vis=getVisitas(), cl=getClientes(), cfg=getComCfg(), ym=h.slice(0,7), ini=ym+'-01', hace30=cmAddDias(h,-30);
  const coms=cmComerciales();
  let filasMeta=[]; try{ filasMeta=rankingMes(getVentas(),getMetas(),ym,_finComDe,finGs); }catch(e){}
  const rows=coms.map(n=>{ const sem=cmVisitasSemana(vis,n,h), min=cmMinimo(cfg,n), pend=cmPendientes(cl,n,h).length, rep=cmReprogramaciones(cl,n,hace30);
    const cont=cmVisitasEnRango(vis,n,ini,h,false).length; const fm=filasMeta.find(f=>cmMismo(f.comercial,n));
    const pl=cmPlanSemana(getAgenda(),n,h); const plH=pl.filter(a=>a.estado==='hecha').length;
    return { n, sem, min, pend, rep, cont, fm, pl:pl.length, plH }; });
  const sol=cmSolicitudes(vis).filter(v=>v.comercial.cotiz.estado==='pendiente');
  const ped=vis.filter(v=>v.tipo==='rapida' && (v.comercial||{}).resultado==='pedido' && v.fecha>=cmAddDias(h,-14));
  const svv=cmVentasSinVisita(getVentas(),vis,cl,cmAddDias(h,-60));
  const sc=(ok,mid)=>ok?'var(--green)':(mid?'#b54708':'var(--red)');
  gs('tcBody').innerHTML=`
    <div class="card"><div class="card-h"><span>Equipo · semana actual</span><span style="color:var(--green);cursor:pointer;font-size:12px;font-weight:600" onclick="cmMinModal()">⚙ Mínimos</span></div><div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:var(--gray-100);color:var(--gray-500);font-size:10px;text-align:right"><th style="text-align:left;padding:6px 8px">Comercial</th><th style="padding:6px">Agenda (hechas/plan)</th><th style="padding:6px">Visitas sem.</th><th style="padding:6px">Vencidos</th><th style="padding:6px">Reprog. 30d</th><th style="padding:6px">Contactos mes</th><th style="padding:6px 8px">Venta vs meta</th></tr></thead>
        <tbody>${rows.map(r=>`<tr style="border-top:1px solid var(--gray-100);text-align:right">
          <td style="text-align:left;padding:7px 8px;font-weight:600">${esc(r.n)}</td>
          <td style="padding:6px;color:${r.pl>=r.min?'var(--gray-700)':'var(--red)'}">${r.plH}/${r.pl}${r.pl<r.min?' ⚠':''}</td>
          <td style="padding:6px;font-weight:700;color:${sc(r.sem>=r.min,r.sem>=Math.ceil(r.min*0.6))}">${r.sem}/${r.min}</td>
          <td style="padding:6px;font-weight:700;color:${r.pend?'var(--red)':'var(--green)'}">${r.pend}</td>
          <td style="padding:6px;color:${r.rep>3?'#b54708':'var(--gray-600)'}">${r.rep}</td>
          <td style="padding:6px">${r.cont}</td>
          <td style="padding:6px 8px">${r.fm&&r.fm.meta>0?`<b style="color:${_mtColor(r.fm.pct)}">${Math.round((r.fm.pct||0)*100)}%</b>`:'—'}</td></tr>`).join('')||'<tr><td colspan="7" style="padding:10px;color:var(--gray-400)">Sin comerciales.</td></tr>'}</tbody>
      </table></div></div>
    <div class="card"><div class="card-h"><span>📨 Pedidos de cotización pendientes</span><span style="color:var(--gray-400);font-weight:500">${sol.length}</span></div><div>
      ${sol.map(v=>{ const c=clienteById(v.cliente_id), ct=v.comercial.cotiz; const d=cmDiffDias(v.fecha,h);
        return `<div style="padding:9px 12px;border-top:1px solid var(--gray-100)">
          <div style="display:flex;justify-content:space-between;gap:6px"><b style="font-size:13px">${esc(c?c.nombre:'—')}</b><span style="font-size:11px;color:${d>2?'var(--red)':'var(--gray-500)'}">${d===0?'hoy':'hace '+d+' d'}</span></div>
          <div style="font-size:12px;color:var(--gray-600)">${esc(v.tecnico)} · ${(ct.items||[]).map(i=>esc(i.producto)+(i.kg?' '+Number(i.kg).toLocaleString('es-PY')+' kg':'')).join(' · ')}${ct.cond?' · '+esc(ct.cond):''}</div>
          ${v.comercial.nota?`<div style="font-size:11px;color:var(--gray-500)">${esc(v.comercial.nota)}</div>`:''}
          <div style="display:flex;gap:6px;margin-top:6px"><button class="btn btn-primary" style="flex:1;padding:7px;font-size:12px" onclick="cmSolEstado('${v.id}','cotizada')">✓ Cotizada</button><button class="btn btn-sec" style="flex:1;padding:7px;font-size:12px" onclick="cmSolEstado('${v.id}','enviada')">📤 Enviada</button><button class="btn btn-sec" style="flex:0 0 auto;padding:7px 10px;font-size:12px;color:var(--red)" onclick="cmSolEstado('${v.id}','descartada')">✕</button></div>
        </div>`; }).join('')||'<div style="padding:10px 12px;font-size:12px;color:var(--green)">✔ Ninguno pendiente.</div>'}
    </div></div>
    <div class="card"><div class="card-h"><span>✅ Pedidos informados (14 días)</span><span style="color:var(--gray-400);font-weight:500">${ped.length}</span></div><div>
      ${ped.map(v=>{ const c=clienteById(v.cliente_id); return `<div class="li" onclick="verVisita('${v.id}')"><div style="min-width:0"><div class="li-t" style="font-size:13px">${esc(c?c.nombre:'—')}</div><div class="li-s">${fmtFecha(v.fecha)} · ${esc(v.tecnico)}${v.comercial.pedido&&v.comercial.pedido.monto?' · aprox. '+finGsFmt(v.comercial.pedido.monto):''}</div></div><div class="li-chev">›</div></div>`; }).join('')||'<div style="padding:10px 12px;font-size:12px;color:var(--gray-400)">Ninguno.</div>'}
    </div></div>
    <div class="card"><div class="card-h"><span>⚠️ Ventas sin visita previa (60 días)</span><span style="color:var(--gray-400);font-weight:500">${svv.length}</span></div><div>
      <div style="padding:6px 12px;font-size:11px;color:var(--gray-500)">Facturas de clientes que su comercial no visitó ni contactó en los ${CM_DIAS_VENTA} días anteriores.</div>
      ${svv.slice(0,30).map(v=>`<div class="li" style="cursor:default"><div style="min-width:0"><div class="li-t" style="font-size:13px">${esc(v.cliente||((clienteById(v.cliente_id)||{}).nombre)||'—')}</div><div class="li-s">${fmtFecha(v.fecha)} · ${esc(v.comercial)}${v.factura?' · Fact. '+esc(v.factura):''}</div></div><b style="font-size:12px">${finGsFmt(finGs(v,v.monto))}</b></div>`).join('')||'<div style="padding:10px 12px;font-size:12px;color:var(--green)">✔ Todas las ventas tienen visita o contacto previo.</div>'}
    </div></div>`;
  const sub=gs('tileTabComSub'); if(sub) sub.textContent=sol.length?(sol.length+' cotización'+(sol.length!==1?'es':'')+' por armar'):'equipo, pendientes y pedidos';
}
function cmSolEstado(id, est){
  const vs=getVisitas(); const v=vs.find(x=>x.id===id); if(!v||!v.comercial||!v.comercial.cotiz) return;
  if(est==='cotizada'){ const r=prompt('N° de cotización (opcional):',''); if(r===null) return; v.comercial.cotiz.ref=r.trim(); }
  if(est==='descartada'){ const r=prompt('Motivo:',''); if(r===null) return; v.comercial.cotiz.ref=r.trim(); }
  v.comercial.cotiz.estado=est; v.comercial.cotiz.ts_estado=new Date().toISOString(); v.comercial.cotiz.por=cmYo();
  v.ts=new Date().toISOString(); v.pending=true; saveVisitas(vs); cloudPush('visitas',v);
  showToast('✓ Marcada como '+est); cmRenderTabCom();
}
function cmMinModal(){
  const cfg=getComCfg(); const coms=cmComerciales();
  gs('modalBox').innerHTML=`<h3>Mínimo de visitas por semana</h3>
    <div style="font-size:12px;color:var(--gray-500)">Cuentan sólo las presenciales (no llamadas ni WhatsApp).</div>
    <label class="fl">Exigir agenda y seguimientos desde</label><input type="date" id="mnDesde" value="${cfg.exigir_desde||CM_EXIGIR_DESDE}">
    <div style="font-size:11px;color:var(--gray-500)">Desde esa fecha, un comercial con seguimientos vencidos o sin la agenda de la semana cargada no puede usar el resto de la app.</div>
    <label class="fl">Para todos</label><input type="number" id="mnDef" inputmode="numeric" value="${Number(cfg.min_semana)||CM_MIN_DEFAULT}">
    <div style="font-size:12px;font-weight:700;margin-top:8px">Distinto para alguno <span style="font-weight:400;color:var(--gray-400)">(vacío = el de todos)</span></div>
    ${coms.map((n,i)=>{ let v=''; Object.keys(cfg.por||{}).forEach(k=>{ if(cmMismo(k,n)) v=cfg.por[k]; }); return `<div style="display:flex;gap:8px;align-items:center;margin-top:5px"><span style="flex:1;font-size:13px">${esc(n)}</span><input type="number" inputmode="numeric" id="mn_${i}" value="${v}" style="width:80px"></div>`; }).join('')}
    <div class="row2" style="margin-top:12px"><button class="btn btn-sec" onclick="cerrarModal()">Cancelar</button><button class="btn btn-primary" onclick="cmMinGuardar()">Guardar</button></div>`;
  gs('modal').classList.add('show');
}
function cmMinGuardar(){
  const coms=cmComerciales(); const por={};
  coms.forEach((n,i)=>{ const v=Number(gs('mn_'+i).value); if(v>0) por[n]=v; });
  setComCfg({ min_semana:Number(gs('mnDef').value)||CM_MIN_DEFAULT, por, exigir_desde:gs('mnDesde').value||CM_EXIGIR_DESDE, ts:new Date().toISOString() });
  pushComCfg(); cerrarModal(); showToast('✓ Mínimos guardados'); cmRenderTabCom();
}

// ══════════════════════════════════════════════════════════
//  ENGANCHES
// ══════════════════════════════════════════════════════════
(function cmEnganchar(){
  if(typeof showScreen!=='function') return;
  cmInyectar();
  const _show=showScreen;
  // Pendientes primero: un comercial con seguimientos vencidos sólo puede ver esas dos pantallas.
  showScreen=function(id,titulo,sub,back){
    const bq=cmBloqueo();
    if(bq && id!=='sPendientes' && id!=='sVisitaRapida' && id!=='sPlanSemana'){
      if(bq==='plan'){ _show('sPlanSemana','Mi semana','Planificá a quién vas a ver',false); cmRenderPlan(); }
      else { _show('sPendientes','Seguimientos vencidos','Resolvelos para seguir',false); cmRenderPendientes(); }
      return; }
    return _show(id,titulo,sub,back);
  };
  const _apply=applyRoleUI;
  applyRoleUI=function(){ _apply();
    const sh=(id,v)=>{ const el=gs(id); if(el) el.style.display=v?'':'none'; };
    sh('tileMiTab', puedeVer('visita') && !esGerente());
    sh('tileTabCom', esGerente() && puedeVer('tablerocom'));
    if(typeof grupoVisible==='function') grupoVisible('hdrComercial','grpComercial');
    cmHomeTop();
  };
  const _refresh=refreshVista;
  refreshVista=function(){ const act=document.querySelector('.screen.active');
    if(act && act.id==='sPendientes') return cmRenderPendientes();
    if(act && act.id==='sPlanSemana') return cmRenderPlan();
    if(act && act.id==='sMiTablero') return cmRenderMiTablero();
    if(act && act.id==='sTabCom') return cmRenderTabCom();
    if(act && act.id==='sHome') cmHomeTop();
    if(act && act.id==='sVisitaRapida') return;   // no pisar lo que se está escribiendo
    return _refresh(); };
  const _reopen=reopenScreen;
  reopenScreen=function(id){ if(id==='sMiTablero') return openMiTablero(); if(id==='sTabCom') return openTabCom(); if(id==='sPendientes') return openPendientes(); if(id==='sPlanSemana') return openPlanSemana(); if(id==='sVisitaRapida') return goHome(); return _reopen(id); };
})();
