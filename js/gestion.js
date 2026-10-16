// ══════════════════════════════════════════════════════════
//  GESTIÓN COMERCIAL CONSOLIDADA
//  Un solo módulo con dos entradas:
//   · comercial → "Mi gestión": Mi semana · Mis clientes · Mi desempeño
//   · gerencia  → "Gestión comercial": Bandeja · Equipo → comercial → cliente → visita
//  El centro es la FICHA DEL CLIENTE con la línea de tiempo de todo lo que pasó.
//  Reemplaza los botones sueltos de Clientes, Visitas, CRM, Agenda y Mi tablero.
//  Se carga después de comercial.js (usa sus funciones) y antes de directorio.js.
// ══════════════════════════════════════════════════════════

// ── funciones puras ──
// Línea de tiempo de un cliente: visitas, contactos del CRM, cotizaciones y ventas, lo más nuevo arriba.
function gsTimeline(cliId, d){
  const ev=[]; const cli=(d.clientes||[]).find(c=>c.id===cliId)||{};
  (d.visitas||[]).filter(v=>v.cliente_id===cliId).forEach(v=>{ const com=v.comercial||{};
    if(v.tipo==='rapida'){
      ev.push({ fecha:v.fecha, tipo:'visita', icono:com.medio==='Llamada'?'📞':(com.medio==='WhatsApp'?'💬':'🤝'), titulo:(com.medio||'Visita')+' · '+(typeof cmResLbl==='function'?cmResLbl(com.resultado):com.resultado||''),
        detalle:com.nota||'', por:v.tecnico, ref:v.id, informe:!!com.informe });
      if(com.cotiz) ev.push({ fecha:v.fecha, tipo:'cotiz', icono:'📨', titulo:'Pidió cotización · '+(com.cotiz.estado||''), detalle:(com.cotiz.items||[]).map(i=>i.producto+(i.kg?' '+Number(i.kg).toLocaleString('es-PY')+' kg':'')).join(', '), por:v.tecnico, ref:v.id });
    } else if(v.tipo==='comercial'){
      ev.push({ fecha:v.fecha, tipo:'visita', icono:'🤝', titulo:'Visita comercial'+(com.interes?' · interés '+com.interes:''), detalle:com.proximo_paso||com.observaciones||'', por:v.tecnico, ref:v.id });
    } else {
      const cats=[...new Set((v.evaluaciones||[]).map(x=>x.categoria).filter(Boolean))];
      ev.push({ fecha:v.fecha, tipo:'visita', icono:'📋', titulo:'Visita técnica'+(cats.length?' · '+cats.join(', '):''), detalle:v.diagnostico||'', por:v.tecnico, ref:v.id });
    } });
  (cli.seguimientos||[]).filter(s=>!s.visita_id).forEach(s=>ev.push({ fecha:s.fecha, tipo:s.reprog?'nota':'contacto', icono:s.reprog?'⏰':'📝', titulo:s.reprog?'Reprogramado':(s.tipo||'Nota'), detalle:s.nota||'', por:s.por }));
  (d.cotiz||[]).filter(c=>c.cliente_id===cliId).forEach(c=>ev.push({ fecha:c.fecha, tipo:'cotizf', icono:'🧮', titulo:'Cotización N° '+(c.num||'—')+' enviada', detalle:'', por:c.vendedor||'' }));
  (d.ventas||[]).filter(v=>v.cliente_id===cliId).forEach(v=>ev.push({ fecha:v.fecha, tipo:'venta', icono:'💰', titulo:'Venta'+(v.factura?' · Fact. '+v.factura:''), detalle:'', monto:v, por:v.comercial||'' }));
  return ev.filter(e=>e.fecha).sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha)));
}
// Urgencia de un cliente para ordenar la cartera: 0 = vencido … 5 = nada pendiente.
function gsUrgencia(c, d, hoyIso){
  if(c.prox_fecha && c.prox_fecha<=hoyIso) return 0;
  const cotPend=(d.visitas||[]).some(v=>v.cliente_id===c.id && v.tipo==='rapida' && v.comercial && v.comercial.cotiz && v.comercial.cotiz.estado==='pendiente');
  if(cotPend) return 1;
  const ult=(typeof cmUltimoContacto==='function')?cmUltimoContacto(c,d.visitas):'';
  if(c.estado!=='Perdido' && c.estado!=='Inactivo' && (!ult || ult<cmAddDias(hoyIso,-30))) return 2;
  if(c.prox_fecha && c.prox_fecha<=cmAddDias(hoyIso,7)) return 3;
  if(c.estado==='Prospecto') return 4;
  return 5;
}
const GS_URG_LBL=['Seguimiento vencido','Cotización esperando','Sin contacto +30 días','Próximo esta semana','Prospecto','Al día'];
const GS_URG_COL=['var(--red)','#b54708','#b54708','var(--blue)','#7c3aed','var(--green)'];
// Clientes que más compraron en los últimos N días y no tienen contacto hace 30: los que no se pueden descuidar.
function gsGrandesSinContacto(d, hoyIso, dias){
  const desde=cmAddDias(hoyIso,-(dias||180)); const tot={};
  (d.ventas||[]).filter(v=>v.cliente_id && v.fecha>=desde).forEach(v=>{ tot[v.cliente_id]=(tot[v.cliente_id]||0)+(typeof finGs==='function'?finGs(v,v.monto):Number(v.monto)||0); });
  return (d.clientes||[]).filter(c=>tot[c.id]).map(c=>({ c, compra:tot[c.id], ult:cmUltimoContacto(c,d.visitas) }))
    .filter(x=>!x.ult || x.ult<cmAddDias(hoyIso,-30)).sort((a,b)=>b.compra-a.compra);
}

// ── datos y estado ──
function gsDatos(){ return { clientes:getClientes(), visitas:getVisitas(), ventas:getVentas(), agenda:getAgenda(), cotiz:(typeof getCotiz==='function'?getCotiz():[]) }; }
let _gst={ tab:'semana', q:'', filtro:'todos', nombre:'', gtab:'bandeja', ctab:'semana', cq:'', cfiltro:'todos', ccom:'' };

function gsInyectar(){
  const home=gs('sHome'); if(!home || gs('sGestion')) return; const cont=home.parentNode;
  const mk=(id)=>{ const d=document.createElement('div'); d.className='screen'; d.id=id; d.innerHTML='<div id="'+id+'Body"></div>'; cont.appendChild(d); };
  ['sGestion','sGestCom','sGestComDet','sFicha'].forEach(mk);
  const grp=gs('grpComercial');
  if(grp) grp.insertAdjacentHTML('afterbegin',
    '<div class="tile" id="tileGestion" onclick="openGestion()" style="display:none"><div class="ico">🧭</div><div class="tlab">Mi gestión</div><div class="tsub">semana, clientes y desempeño</div></div>'
   +'<div class="tile" id="tileGestCom" onclick="openGestCom()" style="display:none"><div class="ico">🧭</div><div class="tlab">Gestión comercial</div><div class="tsub" id="tileGestComSub">equipo, clientes y pendientes</div></div>');
}
function gsTabs(sel, tabs, fn){ return `<div style="display:flex;gap:5px;margin-bottom:10px;overflow-x:auto;padding-bottom:2px">${tabs.map(t=>`<button class="fintab${sel===t[0]?' on':''}" onclick="${fn}('${t[0]}')">${t[1]}</button>`).join('')}</div>`; }
function gsKpis(nombre){
  const d=gsDatos(), h=hoy(), min=cmMinimo(getComCfg(),nombre); const sem=cmVisitasSemana(d.visitas,nombre,h);
  const pl=cmPlanSemana(d.agenda,nombre,h).length, pend=cmPendientes(d.clientes,nombre,h).length;
  let meta='—', mcol='var(--gray-400)'; try{ const ym=h.slice(0,7); const f=rankingMes(d.ventas,getMetas(),ym,_finComDe,finGs).find(x=>cmMismo(x.comercial,nombre)); if(f&&f.meta>0){ meta=Math.round((f.pct||0)*100)+'%'; mcol=_mtColor(f.pct); } }catch(e){}
  const c=(ok,mid)=>ok?'var(--green)':(mid?'#b54708':'var(--red)');
  const k=(l,v,col)=>`<div class="findet" style="flex:1;min-width:70px;padding:7px 9px;margin:0"><div style="font-size:9.5px;color:var(--gray-500);font-weight:700">${l}</div><div style="font-size:17px;font-weight:800;color:${col}">${v}</div></div>`;
  return `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">${k('VISITAS SEM.',sem+'/'+min,c(sem>=min,sem>=Math.ceil(min*0.6)))}${k('AGENDA',pl+'/'+min,c(pl>=min,pl>0))}${k('VENCIDOS',pend,pend?'var(--red)':'var(--green)')}${k('META MES',meta,mcol)}</div>`;
}

// ── lista de clientes (la usan el comercial y gerencia) ──
function gsCliLista(nombre, q, filtro, fnFiltro, fnBuscar, mostrarCom){
  const d=gsDatos(), h=hoy(); const ql=cmNorm(q);
  let cl=d.clientes.filter(c=>!nombre || cmMismo(c.comercial,nombre));
  const urg={}; cl.forEach(c=>urg[c.id]=gsUrgencia(c,d,h));
  const cnt=[0,0,0,0,0,0]; cl.forEach(c=>cnt[urg[c.id]]++);
  if(ql) cl=cl.filter(c=>cmNorm(c.nombre).includes(ql));
  const filtros=[['todos','Todos',cl.length],['0','Vencidos',cnt[0]],['1','Cotización',cnt[1]],['2','Sin contacto',cnt[2]],['4','Prospectos',cnt[4]]];
  if(filtro!=='todos') cl=cl.filter(c=>String(urg[c.id])===filtro);
  cl.sort((a,b)=>(urg[a.id]-urg[b.id]) || String(a.prox_fecha||'9').localeCompare(String(b.prox_fecha||'9')) || String(a.nombre).localeCompare(String(b.nombre)));
  return `
    <input type="search" placeholder="🔎 Buscar cliente…" value="${esc(q)}" oninput="${fnBuscar}(this.value)" style="margin-bottom:8px">
    <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px">${filtros.map(f=>`<button class="finchip${filtro===f[0]?' on':''}" onclick="${fnFiltro}('${f[0]}')">${f[1]}${f[2]?' · '+f[2]:''}</button>`).join('')}</div>
    <div class="card"><div>${cl.slice(0,150).map(c=>{ const u=urg[c.id]; const ult=cmUltimoContacto(c,d.visitas);
      return `<div class="li" onclick="openFicha('${c.id}')"><div style="min-width:0">
        <div class="li-t" style="font-size:13.5px">${esc(c.nombre)} ${c.estado?`<span class="chip" style="background:${crmColor(c.estado)}22;color:${crmColor(c.estado)}">${esc(c.estado)}</span>`:''}</div>
        <div class="li-s"><span style="color:${GS_URG_COL[u]};font-weight:600">${GS_URG_LBL[u]}</span>${c.prox_fecha?' · próximo '+fmtFecha(c.prox_fecha):''}${ult?' · último '+fmtFecha(ult):''}${mostrarCom&&c.comercial?' · '+esc(c.comercial):''}</div></div><div class="li-chev">›</div></div>`; }).join('')||'<div style="padding:12px;font-size:12px;color:var(--gray-400)">Sin clientes.</div>'}</div></div>`;
}

// ══════════════════════════════════════════════════════════
//  MI GESTIÓN (comercial)
// ══════════════════════════════════════════════════════════
function openGestion(tab){ if(!puedeVer('visita')){ showToast('Sin permiso'); return; } if(tab) _gst.tab=tab; showScreen('sGestion','Mi gestión',cmYo()||'',true); gsRenderGestion(); }
function gsSetTab(t){ _gst.tab=t; gsRenderGestion(); }
function gsSetFiltro(f){ _gst.filtro=f; gsRenderGestion(); }
function gsBuscar(q){ _gst.q=q; clearTimeout(gsBuscar._t); gsBuscar._t=setTimeout(()=>{ gsRenderGestion(); const i=document.querySelector('#sGestionBody input[type=search]'); if(i){ i.focus(); i.setSelectionRange(i.value.length,i.value.length); } },250); }
function gsRenderGestion(){
  const yo=cmYo(); const el=gs('sGestionBody'); if(!el) return;
  let cuerpo='';
  if(_gst.tab==='clientes'){
    cuerpo=`<button class="btn btn-sec btn-block" style="margin-bottom:8px" onclick="cmNuevoClienteFicha()">＋ Cliente nuevo</button>`+gsCliLista(yo,_gst.q,_gst.filtro,'gsSetFiltro','gsBuscar',false);
  } else if(_gst.tab==='desempeno'){
    let meta=''; try{ const ym=hoy().slice(0,7); const f=rankingMes(getVentas(),getMetas(),ym,_finComDe,finGs).find(x=>cmMismo(x.comercial,yo)); if(f){ const pv=_mtVista; _mtVista='mes'; meta=_mtMiCardHtml(f,ym,ymParse(ym),''); _mtVista=pv; } }catch(e){}
    cuerpo=(meta||'<div class="card"><div class="card-b" style="font-size:12px;color:var(--gray-500)">Todavía no tenés meta cargada para este mes.</div></div>')+'<div id="gsPerf"></div>';
  } else {
    cuerpo=gsSemanaHtml(yo,true);
  }
  el.innerHTML=`<button class="btn btn-primary btn-block" style="font-size:16px;padding:13px;margin-bottom:10px" onclick="openVisitaRapida()">⚡ Registrar visita o contacto</button>
    ${gsKpis(yo)}${gsTabs(_gst.tab,[['semana','📅 Mi semana'],['clientes','🏡 Mis clientes'],['desempeno','📈 Mi desempeño']],'gsSetTab')}${cuerpo}`;
  if(_gst.tab==='desempeno'){ _cmPf={ nombre:yo, desde:cmSemana(hoy()).desde, dest:'gsPerf' }; cmPerfPintar(); }
}
// Semana de un comercial: vencidos + agenda (con lo hecho) + pedidos de cotización.
function gsSemanaHtml(nombre, propio){
  const d=gsDatos(), h=hoy(); const pend=cmPendientes(d.clientes,nombre,h);
  const perf=cmDesempeno({agenda:d.agenda,visitas:d.visitas,clientes:d.clientes,ventas:d.ventas},nombre,cmSemana(h).desde);
  const sol=cmSolicitudes(d.visitas).filter(v=>cmMismo(v.tecnico,nombre)).slice(0,8);
  const fila=(cid,tit,sub,col,acc)=>`<div class="li" ${cid?`onclick="openFicha('${cid}')"`:''} style="${cid?'':'cursor:default'}"><div style="min-width:0"><div class="li-t" style="font-size:13px">${tit}</div><div class="li-s" style="color:${col||''}">${sub}</div></div>${acc||'<div class="li-chev">›</div>'}</div>`;
  return `
    <div class="card"><div class="card-h"><span>⏰ Seguimientos vencidos</span><span style="color:${pend.length?'var(--red)':'var(--green)'};font-weight:700">${pend.length}</span></div><div>
      ${pend.map(c=>fila(c.id,esc(c.nombre),esc(c.prox_nota||'Contactar')+' · desde '+fmtFecha(c.prox_fecha),'var(--red)',propio?`<button class="btn btn-primary" style="flex:0 0 auto;padding:6px 10px;font-size:12px" onclick="event.stopPropagation();openVisitaRapida('${c.id}')">Registrar</button>`:'')).join('')||'<div style="padding:10px 12px;font-size:12px;color:var(--green)">✔ Nada vencido.</div>'}
    </div></div>
    <div class="card"><div class="card-h"><span>📅 Agenda de la semana</span>${propio?'<span style="color:var(--green);cursor:pointer;font-size:12px;font-weight:600" onclick="openPlanSemana()">editar ›</span>':`<span style="font-size:12px;color:var(--gray-500)">${perf.t.agendaContactados}/${perf.t.agendados}</span>`}</div><div>
      ${perf.filas.map(f=>fila(f.cliente_id,(f.contactado?'✅ ':'')+esc(f.nombre),esc(cmDiaLbl(f.agenda))+(f.contactado?' · '+[f.visitas?f.visitas+' visita'+(f.visitas>1?'s':''):'',f.remotos?f.remotos+' llam./WA':'',f.cotiz?'cotiz. '+f.cotiz:'',f.venta?finGsFmt(f.venta):''].filter(Boolean).join(' · '):' · pendiente'),f.contactado?'var(--green)':'')).join('')||`<div style="padding:10px 12px;font-size:12px;color:var(--gray-400)">Sin agenda cargada.${propio?' <span style="color:var(--green);cursor:pointer;font-weight:600" onclick="openPlanSemana()">Cargar ›</span>':''}</div>`}
    </div></div>
    <div class="card"><div class="card-h"><span>📨 Pedidos de cotización</span></div><div>
      ${sol.map(v=>{ const c=clienteById(v.cliente_id), ct=v.comercial.cotiz; return fila(v.cliente_id,esc(c?c.nombre:'—'),fmtFecha(v.fecha)+' · '+(ct.items||[]).map(i=>esc(i.producto)).join(', '),'',`<span class="chip" style="background:${ct.estado==='pendiente'?'#fef3c7':'#dcfce7'};color:${ct.estado==='pendiente'?'#92400e':'#166534'}">${esc(ct.estado)}</span>`); }).join('')||'<div style="padding:10px 12px;font-size:12px;color:var(--gray-400)">Ninguno.</div>'}
    </div></div>
    ${propio?`<div style="text-align:center;font-size:12px;margin:4px 0 12px"><span style="color:var(--green);cursor:pointer;font-weight:600" onclick="openAgenda()">Ver agenda por día ›</span> · <span style="color:var(--green);cursor:pointer;font-weight:600" onclick="nuevaVisita()">Visita técnica completa ›</span></div>`:''}`;
}
function cmNuevoClienteFicha(){ if(!canEdit()) return; clienteModal(); _cmNuevoCli={ origen:'ficha', antes:new Set(getClientes().map(c=>c.id)) }; }

// ══════════════════════════════════════════════════════════
//  FICHA DEL CLIENTE (la misma para el comercial y para gerencia)
// ══════════════════════════════════════════════════════════
let _gsFicha='';
function openFicha(id){ const c=clienteById(id); if(!c){ showToast('Cliente no encontrado'); return; } _gsFicha=id; showScreen('sFicha',c.nombre,'Ficha del cliente',true); gsRenderFicha(); }
function gsRenderFicha(){
  const c=clienteById(_gsFicha); const el=gs('sFichaBody'); if(!c||!el) return;
  const d=gsDatos(), h=hoy(); const tl=gsTimeline(c.id,d); const u=gsUrgencia(c,d,h);
  const ventas12=d.ventas.filter(v=>v.cliente_id===c.id && v.fecha>=cmAddDias(h,-365)).reduce((a,v)=>a+finGs(v,v.monto),0);
  const ed=canEdit(); const puedeVisita=puedeVer('visita')&&ed;
  const ests=(typeof estanciasDe==='function'?estanciasDe(c.id):[]);
  el.innerHTML=`
    <div class="card"><div class="card-b">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
        <div style="min-width:0"><div style="font-size:17px;font-weight:800">${esc(c.nombre)}</div>
          <div style="font-size:12px;color:var(--gray-500);margin-top:2px">${c.estado?`<span class="chip" style="background:${crmColor(c.estado)}22;color:${crmColor(c.estado)}">${esc(c.estado)}</span> `:''}${c.comercial?'· '+esc(c.comercial):'· sin comercial asignado'}${c.prioridad?' · prioridad '+esc(c.prioridad):''}</div></div>
        ${ed?`<span style="color:var(--green);cursor:pointer;font-size:13px;font-weight:600;white-space:nowrap" onclick="crmModal('${c.id}')">✎ Etapa</span>`:''}
      </div>
      <div style="margin-top:8px;padding:8px 10px;border-radius:8px;background:${u===0?'#fef2f2':'var(--gray-100)'};font-size:13px">
        <b style="color:${GS_URG_COL[u]}">${GS_URG_LBL[u]}</b>${c.prox_fecha?` · próximo contacto <b>${fmtFecha(c.prox_fecha)}</b>${c.prox_nota?' — '+esc(c.prox_nota):''}`:' · sin próximo paso'}
      </div>
      <div style="display:flex;gap:10px;font-size:12px;color:var(--gray-600);margin-top:8px;flex-wrap:wrap">
        <span>Compras 12 meses: <b>${finGsFmt(ventas12)}</b></span>
        ${c.contacto?`<span>Contacto: <b>${esc(c.contacto)}</b></span>`:''}
        ${c.tel?`<a href="tel:${esc(c.tel)}" style="color:var(--green);font-weight:600">📞 ${esc(c.tel)}</a> <a href="https://wa.me/${esc(String(c.tel).replace(/\D/g,''))}" target="_blank" rel="noopener" style="color:var(--green);font-weight:600">💬 WhatsApp</a>`:''}
      </div>
      ${puedeVisita?`<button class="btn btn-primary btn-block" style="margin-top:10px" onclick="openVisitaRapida('${c.id}')">⚡ Registrar visita o contacto</button>`:''}
    </div></div>
    <div class="card"><div class="card-h"><span>Historia con el cliente</span><span style="color:var(--gray-400);font-weight:500">${tl.length}</span></div><div>
      ${tl.map(e=>`<div style="display:flex;gap:10px;padding:9px 12px;border-top:1px solid var(--gray-100);${e.ref?'cursor:pointer':''}" ${e.ref?`onclick="verVisita('${e.ref}')"`:''}>
        <div style="flex:0 0 22px;font-size:16px;text-align:center">${e.icono}</div>
        <div style="flex:1;min-width:0"><div style="display:flex;justify-content:space-between;gap:6px"><b style="font-size:13px">${esc(e.titulo)}</b><span style="font-size:11px;color:var(--gray-500);white-space:nowrap">${fmtFecha(e.fecha)}</span></div>
          ${e.monto?`<div style="font-size:12.5px;font-weight:700;color:var(--green)">${finGsFmt(finGs(e.monto,e.monto.monto))}</div>`:''}
          ${e.detalle?`<div style="font-size:12px;color:var(--gray-600);white-space:pre-wrap">${esc(String(e.detalle).slice(0,220))}</div>`:''}
          <div style="font-size:10.5px;color:var(--gray-400)">${esc(e.por||'')}${e.informe?' · 📄 con informe al cliente':''}</div></div></div>`).join('')||'<div style="padding:12px;font-size:12px;color:var(--gray-400)">Todavía no hay nada registrado con este cliente.</div>'}
    </div></div>
    <div class="card"><div class="card-h"><span>Datos y estancias</span>${ed?`<span style="color:var(--green);cursor:pointer;font-size:13px;font-weight:600" onclick="clienteModal('${c.id}')">✎ Editar</span>`:''}</div><div class="card-b" style="font-size:12.5px;line-height:1.6">
      ${[['RUC',c.ruc],['Código',c.codigo],['Email',c.email],['Dirección',c.direccion],['Zona',c.ubicacion],['Obs.',c.obs]].filter(x=>x[1]).map(x=>`<div><span style="color:var(--gray-500)">${x[0]}:</span> ${esc(x[1])}</div>`).join('')||'<div style="color:var(--gray-400)">Sin datos cargados.</div>'}
      ${ests.length?`<div style="margin-top:6px"><span style="color:var(--gray-500)">Estancias:</span> ${ests.map(e=>esc(e.nombre)).join(' · ')}</div>`:''}
      <div style="margin-top:8px"><span style="color:var(--green);cursor:pointer;font-weight:600" onclick="abrirCliente('${c.id}')">Ver hato, lotes y visitas técnicas ›</span></div>
    </div></div>`;
}

// ══════════════════════════════════════════════════════════
//  GESTIÓN COMERCIAL (gerencia)
// ══════════════════════════════════════════════════════════
function openGestCom(tab){ if(!esGerente()){ showToast('Sólo gerencia'); return; } if(tab) _gst.gtab=tab; showScreen('sGestCom','Gestión comercial','Equipo, clientes y pendientes',true); gsRenderGestCom(); }
function gsSetGTab(t){ _gst.gtab=t; gsRenderGestCom(); }
function gsSetCFiltro(f){ _gst.cfiltro=f; gsRenderGestCom(); }
function gsCBuscar(q){ _gst.cq=q; clearTimeout(gsCBuscar._t); gsCBuscar._t=setTimeout(()=>{ gsRenderGestCom(); const i=document.querySelector('#sGestComBody input[type=search]'); if(i){ i.focus(); i.setSelectionRange(i.value.length,i.value.length); } },250); }
function gsSetCCom(n){ _gst.ccom=n; gsRenderGestCom(); }
function gsBandeja(){
  const d=gsDatos(), h=hoy();
  const sol=cmSolicitudes(d.visitas).filter(v=>v.comercial.cotiz.estado==='pendiente');
  const ped=d.visitas.filter(v=>v.tipo==='rapida' && (v.comercial||{}).resultado==='pedido' && v.fecha>=cmAddDias(h,-14));
  const svv=cmVentasSinVisita(d.ventas,d.visitas,d.clientes,cmAddDias(h,-60));
  const rep=cmComerciales().map(n=>({ n, r:cmReprogramaciones(d.clientes,n,cmAddDias(h,-30)) })).filter(x=>x.r>3);
  const gsc=gsGrandesSinContacto(d,h,180).slice(0,10);
  return { sol, ped, svv, rep, gsc, total: sol.length+rep.length+gsc.length };
}
function gsRenderGestCom(){
  const el=gs('sGestComBody'); if(!el) return; const b=gsBandeja();
  let cuerpo='';
  if(_gst.gtab==='equipo'){
    const d=gsDatos(), h=hoy(), lun=cmSemana(h).desde, cfg=getComCfg(); const coms=cmComerciales();
    let fm=[]; try{ fm=rankingMes(d.ventas,getMetas(),h.slice(0,7),_finComDe,finGs); }catch(e){}
    const sc=(ok,mid)=>ok?'var(--green)':(mid?'#b54708':'var(--red)');
    cuerpo=`<div style="text-align:right;margin:-4px 0 6px"><span style="color:var(--green);cursor:pointer;font-size:12px;font-weight:600" onclick="cmMinModal()">⚙ Mínimos y fecha de exigencia</span></div>`+coms.map(n=>{
      const min=cmMinimo(cfg,n), sem=cmVisitasSemana(d.visitas,n,h), pend=cmPendientes(d.clientes,n,h).length;
      const pa=cmDesempeno(d,n,cmAddDias(lun,-7)).t, ps=cmDesempeno(d,n,lun).t, p8=cmDesempeno(d,n,cmAddDias(lun,-49),cmAddDias(lun,6)).t;
      const f=fm.find(x=>cmMismo(x.comercial,n)); const k=(l,v,col)=>`<div style="flex:1;min-width:64px"><div style="font-size:9.5px;color:var(--gray-500);font-weight:700">${l}</div><div style="font-size:15px;font-weight:800;color:${col||'var(--gray-800)'}">${v}</div></div>`;
      return `<div class="card" style="cursor:pointer" onclick="openGestComercial('${esc(n).replace(/'/g,"\\'")}')"><div class="card-b">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><b style="font-size:14.5px">${esc(n)}</b><span style="color:var(--green);font-weight:700">›</span></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${k('VISITAS SEM.',sem+'/'+min,sc(sem>=min,sem>=Math.ceil(min*0.6)))}${k('AGENDA SEM. PASADA',pa.agendados?cmPct(pa.pctAgenda):'—',cmPctCol(pa.pctAgenda,0.8,0.5))}${k('AGENDA ESTA SEM.',ps.agendados+'/'+min,ps.agendados>=min?'var(--gray-700)':'var(--red)')}
          ${k('VENCIDOS',pend,pend?'var(--red)':'var(--green)')}${k('META MES',f&&f.meta>0?Math.round((f.pct||0)*100)+'%':'—',f&&f.meta>0?_mtColor(f.pct):'')}
        </div>
        <div style="font-size:11.5px;color:var(--gray-600);margin-top:6px">8 semanas: ${p8.contactados} contactados › ${p8.cotSol} cotiz. pedidas / ${p8.cotPres} presentadas › <b>${p8.ventasClientes} con venta</b> (${cmPct(p8.pctVenta)})</div>
      </div></div>`; }).join('')||'<div class="card"><div class="card-b" style="font-size:12px;color:var(--gray-400)">Sin comerciales.</div></div>';
  } else if(_gst.gtab==='clientes'){
    const coms=cmComerciales();
    cuerpo=`<div style="display:flex;gap:6px;margin-bottom:8px"><select onchange="gsSetCCom(this.value)" style="flex:1"><option value="">Todos los comerciales</option>${coms.map(n=>`<option ${_gst.ccom===n?'selected':''}>${esc(n)}</option>`).join('')}</select><button class="btn btn-sec" style="flex:0 0 auto" onclick="cmNuevoClienteFicha()">＋ Nuevo</button></div>`
      +gsCliLista(_gst.ccom,_gst.cq,_gst.cfiltro,'gsSetCFiltro','gsCBuscar',true);
  } else if(_gst.gtab==='mas'){
    const l=(t,s,fn)=>`<div class="li" onclick="${fn}"><div style="min-width:0"><div class="li-t">${t}</div><div class="li-s">${s}</div></div><div class="li-chev">›</div></div>`;
    cuerpo=`<div class="card"><div>${l('📅 Agenda del equipo','vista por día de todos los comerciales','openAgenda()')}${l('📋 Historial de visitas','todas las visitas, con filtros','openHistorial()')}${l('🤝 Tablero CRM','clientes por etapa','openCrm()')}${l('🎯 Metas de venta','cargar y ver las metas','openMetas()')}${l('⚙ Mínimos y exigencias','visitas por semana y fecha de arranque','cmMinModal()')}</div></div>`;
  } else {
    const sec=(t,n,html)=>`<div class="card"><div class="card-h"><span>${t}</span><span style="color:${n?'var(--red)':'var(--green)'};font-weight:700">${n}</span></div><div>${html}</div></div>`;
    const vacio=t=>`<div style="padding:10px 12px;font-size:12px;color:var(--green)">✔ ${t}</div>`;
    const h=hoy();
    cuerpo=
      sec('📨 Cotizaciones por armar',b.sol.length,b.sol.map(v=>{ const c=clienteById(v.cliente_id), ct=v.comercial.cotiz; const dd=cmDiffDias(v.fecha,h);
        return `<div style="padding:9px 12px;border-top:1px solid var(--gray-100)"><div style="display:flex;justify-content:space-between;gap:6px"><b style="font-size:13px;cursor:pointer" onclick="openFicha('${v.cliente_id}')">${esc(c?c.nombre:'—')} ›</b><span style="font-size:11px;color:${dd>2?'var(--red)':'var(--gray-500)'}">${dd===0?'hoy':'hace '+dd+' d'}</span></div>
          <div style="font-size:12px;color:var(--gray-600)">${esc(v.tecnico)} · ${(ct.items||[]).map(i=>esc(i.producto)+(i.kg?' '+Number(i.kg).toLocaleString('es-PY')+' kg':'')).join(' · ')}${ct.cond?' · '+esc(ct.cond):''}</div>
          <div style="display:flex;gap:6px;margin-top:6px"><button class="btn btn-primary" style="flex:1;padding:7px;font-size:12px" onclick="gsSol('${v.id}','cotizada')">✓ Cotizada</button><button class="btn btn-sec" style="flex:1;padding:7px;font-size:12px" onclick="gsSol('${v.id}','enviada')">📤 Enviada</button><button class="btn btn-sec" style="flex:0 0 auto;padding:7px 10px;font-size:12px;color:var(--red)" onclick="gsSol('${v.id}','descartada')">✕</button></div></div>`; }).join('')||vacio('Ninguna pendiente.'))
     +sec('💎 Clientes que compran y nadie visita (30 días)',b.gsc.length,b.gsc.map(x=>`<div class="li" onclick="openFicha('${x.c.id}')"><div style="min-width:0"><div class="li-t" style="font-size:13px">${esc(x.c.nombre)}</div><div class="li-s">${esc(x.c.comercial||'sin comercial')} · compró ${finGsFmt(x.compra)} en 6 meses · ${x.ult?'último contacto '+fmtFecha(x.ult):'nunca contactado'}</div></div><div class="li-chev">›</div></div>`).join('')||vacio('Todos los que compran tienen contacto reciente.'))
     +sec('⏰ Muchas reprogramaciones (más de 3 en 30 días)',b.rep.length,b.rep.map(x=>`<div class="li" onclick="openGestComercial('${esc(x.n).replace(/'/g,"\\'")}')"><div class="li-t" style="font-size:13px">${esc(x.n)}</div><span style="color:#b54708;font-weight:700">${x.r}</span></div>`).join('')||vacio('Nadie está pateando seguimientos.'))
     +sec('✅ Pedidos informados (14 días)',0,b.ped.map(v=>{ const c=clienteById(v.cliente_id); return `<div class="li" onclick="verVisita('${v.id}')"><div style="min-width:0"><div class="li-t" style="font-size:13px">${esc(c?c.nombre:'—')}</div><div class="li-s">${fmtFecha(v.fecha)} · ${esc(v.tecnico)}${v.comercial.pedido&&v.comercial.pedido.monto?' · aprox. '+finGsFmt(v.comercial.pedido.monto):''}</div></div><div class="li-chev">›</div></div>`; }).join('')||'<div style="padding:10px 12px;font-size:12px;color:var(--gray-400)">Ninguno.</div>')
     +sec('⚠️ Ventas sin visita previa (60 días)',b.svv.length,`<div style="padding:6px 12px;font-size:11px;color:var(--gray-500)">Facturas de clientes que su comercial no visitó ni contactó en los 30 días anteriores.</div>`+b.svv.slice(0,20).map(v=>`<div class="li" ${v.cliente_id?`onclick="openFicha('${v.cliente_id}')"`:''}><div style="min-width:0"><div class="li-t" style="font-size:13px">${esc(v.cliente||((clienteById(v.cliente_id)||{}).nombre)||'—')}</div><div class="li-s">${fmtFecha(v.fecha)} · ${esc(v.comercial)}</div></div><b style="font-size:12px">${finGsFmt(finGs(v,v.monto))}</b></div>`).join(''));
  }
  el.innerHTML=gsTabs(_gst.gtab,[['bandeja','📥 Bandeja'+(b.total?' · '+b.total:'')],['equipo','👥 Equipo'],['clientes','🏡 Clientes'],['mas','⋯ Más']],'gsSetGTab')+cuerpo;
  const sub=gs('tileGestComSub'); if(sub) sub.textContent=b.total?(b.total+' cosa'+(b.total!==1?'s':'')+' esperando'):'equipo, clientes y pendientes';
}
function gsSol(id,est){ cmSolEstado(id,est); if(gs('sGestCom').classList.contains('active')) gsRenderGestCom(); }

// Gerencia mira a un comercial: su semana, su cartera y su desempeño.
function openGestComercial(nombre){ if(!esGerente()) return; _gst.nombre=nombre; _gst.ctab=_gst.ctab||'semana'; showScreen('sGestComDet',nombre,'Gestión del comercial',true); gsRenderGestComDet(); }
function gsSetCTab(t){ _gst.ctab=t; gsRenderGestComDet(); }
function gsDetFiltro(f){ _gst.dfiltro=f; gsRenderGestComDet(); }
function gsDetBuscar(q){ _gst.dq=q; clearTimeout(gsDetBuscar._t); gsDetBuscar._t=setTimeout(()=>{ gsRenderGestComDet(); const i=document.querySelector('#sGestComDetBody input[type=search]'); if(i){ i.focus(); i.setSelectionRange(i.value.length,i.value.length); } },250); }
function gsRenderGestComDet(){
  const el=gs('sGestComDetBody'); if(!el) return; const n=_gst.nombre;
  let cuerpo='';
  if(_gst.ctab==='clientes') cuerpo=gsCliLista(n,_gst.dq||'',_gst.dfiltro||'todos','gsDetFiltro','gsDetBuscar',false);
  else if(_gst.ctab==='desempeno') cuerpo='<div id="gsDetPerf"></div>';
  else cuerpo=gsSemanaHtml(n,false);
  el.innerHTML=gsKpis(n)+gsTabs(_gst.ctab,[['semana','📅 Su semana'],['clientes','🏡 Sus clientes'],['desempeno','📈 Desempeño']],'gsSetCTab')+cuerpo;
  if(_gst.ctab==='desempeno'){ _cmPf={ nombre:n, desde:cmSemana(hoy()).desde, dest:'gsDetPerf' }; cmPerfPintar(); }
}

// ══════════════════════════════════════════════════════════
//  ENGANCHES
// ══════════════════════════════════════════════════════════
(function gsEnganchar(){
  if(typeof showScreen!=='function' || typeof cmDesempeno!=='function') return;
  gsInyectar();
  const _apply=applyRoleUI;
  applyRoleUI=function(){ _apply();
    const sh=(id,v)=>{ const el=gs(id); if(el) el.style.display=v?'':'none'; };
    // Los botones sueltos se reemplazan por el módulo consolidado (sus pantallas siguen, adentro).
    ['tileClientes','tileHistorial','tileCrm','tileAgenda','tileMiTab','tileTabCom'].forEach(id=>sh(id,false));
    sh('tileMetas', esGerente() && puedeVer('metas'));
    sh('tileGestion', puedeVer('visita') && !esGerente());
    sh('tileGestCom', esGerente());
    if(typeof grupoVisible==='function') grupoVisible('hdrComercial','grpComercial');
  };
  // El cliente nuevo cargado desde una lista vuelve a su ficha.
  if(typeof cmTrasNuevoCliente==='function'){ const _tras=cmTrasNuevoCliente; cmTrasNuevoCliente=function(p){ if(p && p.origen==='ficha'){ const nuevo=getClientes().find(c=>!p.antes.has(c.id)); if(nuevo){ const cl=getClientes(); const c=cl.find(x=>x.id===nuevo.id); if(!String(c.comercial||'').trim() && !esGerente()) c.comercial=cmYo(); if(!c.estado) c.estado='Prospecto'; c.ts=new Date().toISOString(); c.pending=true; saveClientes(cl); cloudPush('clientes',c); openFicha(c.id); } return; } return _tras(p); }; }
  // Inicio del comercial: sólo sus clientes y sus visitas (no las del equipo).
  if(typeof renderHome==='function'){ const _home=renderHome; renderHome=function(){ _home();
    if(!(typeof cmEsComercial==='function' && cmEsComercial())) return; const yo=cmYo(); if(!yo) return;
    const vi=getVisitas().filter(v=>cmMismo(v.tecnico,yo)); const mes=hoy().slice(0,7);
    if(gs('stClientes')) gs('stClientes').textContent=getClientes().filter(c=>cmMismo(c.comercial,yo)).length;
    if(gs('stVisitas')) gs('stVisitas').textContent=vi.length;
    if(gs('stMes')) gs('stMes').textContent=vi.filter(v=>String(v.fecha||'').startsWith(mes)).length;
    const ult=vi.slice().sort((a,b)=>String(b.ts||'').localeCompare(String(a.ts||''))).slice(0,5);
    if(gs('homeUltimas')) gs('homeUltimas').innerHTML=ult.length?ult.map(v=>visitaLi(v)).join(''):'<div class="empty">Todavía no cargaste visitas.<br>Tocá <b>⚡ Registrar visita</b>.</div>';
  }; }
  // Editar datos o etapa desde la ficha: volver a la ficha (no a la pantalla vieja de cliente).
  const enFicha=()=>gs('sFicha')&&gs('sFicha').classList.contains('active');
  const _gc2=guardarCliente; guardarCliente=function(id){ const f=id&&enFicha(); const r=_gc2(id); if(f) openFicha(id); return r; };
  if(typeof crmGuardar==='function'){ const _crm=crmGuardar; crmGuardar=function(id){ const r=_crm(id); if(enFicha()) gsRenderFicha(); return r; }; }
  const _refresh=refreshVista;
  refreshVista=function(){ const act=document.querySelector('.screen.active');
    if(act && act.id==='sGestion') return gsRenderGestion();
    if(act && act.id==='sGestCom') return gsRenderGestCom();
    if(act && act.id==='sGestComDet') return gsRenderGestComDet();
    if(act && act.id==='sFicha') return gsRenderFicha();
    return _refresh(); };
  const _reopen=reopenScreen;
  reopenScreen=function(id){ if(id==='sGestion') return openGestion(); if(id==='sGestCom') return openGestCom(); if(id==='sGestComDet') return openGestComercial(_gst.nombre); if(id==='sFicha') return openFicha(_gsFicha); return _reopen(id); };
  // Mi tablero / Tablero comercial / detalle viejo → llevan al módulo nuevo.
  openMiTablero=function(){ openGestion('desempeno'); };
  openTabCom=function(){ openGestCom('equipo'); };
  openComDet=function(n){ openGestComercial(n); };
})();
