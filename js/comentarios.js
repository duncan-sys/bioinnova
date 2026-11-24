// ══════════════════════════════════════════════════════════════════════════
//  COMENTARIOS DEL GERENTE AL COMERCIAL
//  El gerente deja un reconocimiento, una sugerencia o un llamado de atención,
//  opcionalmente sobre un cliente. El comercial lo ve arriba de su tablero
//  hasta que lo marca leído o responde; el gerente ve el estado y la respuesta.
// ══════════════════════════════════════════════════════════════════════════
const CMT_TIPOS={ reconocimiento:{ico:'👏',lbl:'Reconocimiento',col:'#067647',bg:'#ecfdf3'}, sugerencia:{ico:'💡',lbl:'Sugerencia',col:'#175cd3',bg:'#eff8ff'}, atencion:{ico:'⚠️',lbl:'Atención',col:'#b42318',bg:'#fef3f2'} };
function getComentarios(){ return getArr('bio:comentarios'); }
function saveComentarios(a){ setArr('bio:comentarios',a); }
function cmtRow(c){ return { id:c.id, comercial:c.comercial||'', de:c.de||'', tipo:c.tipo||'sugerencia', texto:c.texto||'', cliente_id:c.cliente_id||'', cliente_nom:c.cliente_nom||'', fecha:c.fecha||null, leido_ts:c.leido_ts||null, respuesta:c.respuesta||'', respuesta_ts:c.respuesta_ts||null, ts:c.ts||null }; }
function rowCmt(r){ return { id:r.id, comercial:r.comercial||'', de:r.de||'', tipo:r.tipo||'sugerencia', texto:r.texto||'', cliente_id:r.cliente_id||'', cliente_nom:r.cliente_nom||'', fecha:r.fecha||'', leido_ts:r.leido_ts||null, respuesta:r.respuesta||'', respuesta_ts:r.respuesta_ts||null, ts:r.ts, pending:false }; }
SYNC_DEFS.comentario={ get:getComentarios, save:saveComentarios, table:'bio_comentarios', toRow:cmtRow, fromRow:rowCmt };

function cmtDe(nombre){ return getComentarios().filter(c=>cmMismo(c.comercial,nombre)).sort((a,b)=>String(b.ts||'').localeCompare(String(a.ts||''))); }
function cmtNoLeidos(nombre){ return cmtDe(nombre).filter(c=>!c.leido_ts); }
function cmtGuardar(c){ c.ts=new Date().toISOString(); c.pending=true; saveComentarios([c, ...getComentarios().filter(x=>x.id!==c.id)]); cloudPush('comentario',c); }
function cmtEstado(c){ if(c.respuesta) return '<span style="color:#067647;font-weight:700">↩ respondió</span>'; if(c.leido_ts) return '<span style="color:var(--gray-500)">✓ leído</span>'; return '<span style="color:#b54708;font-weight:700">● sin leer</span>'; }
function cmtTarjeta(c, propio){
  const t=CMT_TIPOS[c.tipo]||CMT_TIPOS.sugerencia, nuevo=propio&&!c.leido_ts;
  return `<div style="border:1px solid ${nuevo?t.col:'var(--gray-200)'};background:${nuevo?t.bg:'#fff'};border-radius:10px;padding:9px 11px;margin-bottom:7px">
    <div style="display:flex;justify-content:space-between;gap:6px;font-size:11px;color:var(--gray-500)"><span style="color:${t.col};font-weight:700">${t.ico} ${t.lbl}</span><span>${fmtFecha(c.fecha)}${propio?(c.de?' · '+esc(c.de):''):' · '+cmtEstado(c)}</span></div>
    ${c.cliente_id?`<div style="font-size:11px;margin-top:2px"><span style="color:var(--green-d);cursor:pointer;font-weight:600" onclick="openFicha('${c.cliente_id}')">🏡 ${esc(c.cliente_nom||'cliente')}</span></div>`:''}
    <div style="font-size:13.5px;margin-top:4px;white-space:pre-wrap">${esc(c.texto)}</div>
    ${c.respuesta?`<div style="margin-top:6px;padding:6px 9px;background:var(--gray-100);border-radius:8px;font-size:12.5px"><b>↩ ${propio?'Tu respuesta':esc(c.comercial)}:</b> ${esc(c.respuesta)}</div>`:''}
    ${propio&&!c.respuesta?`<div style="display:flex;gap:8px;margin-top:7px">${!c.leido_ts?`<button class="btn btn-primary" style="flex:1;padding:7px;font-size:12.5px" onclick="cmtLeido('${c.id}')">Leído ✓</button>`:''}<button class="btn btn-sec" style="flex:1;padding:7px;font-size:12.5px" onclick="cmtResponder('${c.id}')">↩ Responder</button></div>`:''}
  </div>`;
}

// ── gerente: escribir ──
function cmtNuevo(comercial, clienteId){
  if(!esGerente()){ showToast('Sólo gerencia'); return; }
  const cli=clienteId?clienteById(clienteId):null;
  gs('modalBox').innerHTML=`<h3>💬 Comentario para ${esc(comercial)}</h3>
    ${cli?`<div style="font-size:12px;color:var(--gray-600);margin-bottom:6px">Sobre el cliente <b>${esc(cli.nombre)}</b></div>`:''}
    <label class="fl">Tipo</label><div style="display:flex;gap:6px;flex-wrap:wrap">${Object.entries(CMT_TIPOS).map(([k,t],i)=>`<label style="flex:1;min-width:100px;border:1.5px solid ${t.col};border-radius:8px;padding:7px;font-size:12.5px;cursor:pointer;color:${t.col};font-weight:600"><input type="radio" name="cmtTipo" value="${k}" ${i===1?'checked':''} style="width:auto"> ${t.ico} ${t.lbl}</label>`).join('')}</div>
    <label class="fl">Comentario</label><textarea id="cmtTxt" rows="4" placeholder="${cli?'Ej: buena visita, ofrecele…':'Ej: excelente semana; o: te faltan las llamadas…'}"></textarea>
    <div class="row2" style="margin-top:12px"><button class="btn btn-sec" onclick="cerrarModal()">Cancelar</button><button class="btn btn-primary" onclick="cmtEnviar('${esc(comercial).replace(/'/g,"\\'")}','${cli?cli.id:''}')">Enviar</button></div>`;
  gs('modal').classList.add('show'); setTimeout(()=>{ const t=gs('cmtTxt'); if(t) t.focus(); },50);
}
function cmtEnviar(comercial, clienteId){
  const txt=(gs('cmtTxt').value||'').trim(); if(!txt){ showToast('Escribí el comentario'); return; }
  const tipo=(document.querySelector('input[name="cmtTipo"]:checked')||{}).value||'sugerencia';
  const cli=clienteId?clienteById(clienteId):null; const s=getSession();
  cmtGuardar({ id:'CMT-'+Date.now(), comercial, de:(s&&s.nombre)||'Gerencia', tipo, texto:txt, cliente_id:cli?cli.id:'', cliente_nom:cli?cli.nombre:'', fecha:hoy(), leido_ts:null, respuesta:'', respuesta_ts:null });
  cerrarModal(); showToast('✓ Comentario enviado a '+comercial); if(typeof refreshVista==='function') refreshVista();
}
// ── comercial: leer y responder ──
function cmtLeido(id){ const c=getComentarios().find(x=>x.id===id); if(!c) return; c.leido_ts=new Date().toISOString(); cmtGuardar(c); if(typeof refreshVista==='function') refreshVista(); }
function cmtResponder(id){ const c=getComentarios().find(x=>x.id===id); if(!c) return;
  gs('modalBox').innerHTML=`<h3>↩ Responder</h3><div style="font-size:12.5px;color:var(--gray-600);margin-bottom:6px;white-space:pre-wrap">${esc(c.texto)}</div>
    <textarea id="cmtResp" rows="3" placeholder="Tu respuesta…"></textarea>
    <div class="row2" style="margin-top:12px"><button class="btn btn-sec" onclick="cerrarModal()">Cancelar</button><button class="btn btn-primary" onclick="cmtGuardarResp('${id}')">Enviar</button></div>`;
  gs('modal').classList.add('show'); }
function cmtGuardarResp(id){ const c=getComentarios().find(x=>x.id===id); if(!c) return; const r=(gs('cmtResp').value||'').trim(); if(!r){ showToast('Escribí la respuesta'); return; }
  c.respuesta=r; c.respuesta_ts=new Date().toISOString(); if(!c.leido_ts) c.leido_ts=c.respuesta_ts; cmtGuardar(c); cerrarModal(); showToast('✓ Respuesta enviada'); if(typeof refreshVista==='function') refreshVista(); }

// ── bloques para las pantallas ──
function cmtComercialHtml(nombre){
  const todos=cmtDe(nombre); if(!todos.length) return '';
  const nuevos=todos.filter(c=>!c.leido_ts), viejos=todos.filter(c=>c.leido_ts).slice(0,5);
  return `<div class="card"><div class="card-h"><span>💬 Mensajes de gerencia</span>${nuevos.length?`<span style="color:#b54708;font-weight:700">${nuevos.length} nuevo${nuevos.length>1?'s':''}</span>`:''}</div><div class="card-b">
    ${nuevos.map(c=>cmtTarjeta(c,true)).join('')}
    ${viejos.length?`<details><summary style="font-size:12px;color:var(--gray-500);cursor:pointer">Anteriores (${viejos.length})</summary><div style="margin-top:6px">${viejos.map(c=>cmtTarjeta(c,true)).join('')}</div></details>`:''}
  </div></div>`;
}
function cmtGerenteHtml(nombre){
  const todos=cmtDe(nombre).slice(0,8); const sin=todos.filter(c=>!c.leido_ts).length;
  return `<div class="card"><div class="card-h"><span>💬 Comentarios a ${esc(nombre)}</span>${sin?`<span style="color:#b54708;font-weight:700">${sin} sin leer</span>`:''}</div><div class="card-b">
    <button class="btn btn-primary btn-block" style="margin-bottom:8px" onclick="cmtNuevo('${esc(nombre).replace(/'/g,"\\'")}')">💬 Dejarle un comentario</button>
    ${todos.map(c=>cmtTarjeta(c,false)).join('')||'<div style="font-size:12px;color:var(--gray-400)">Todavía no le dejaste comentarios.</div>'}
  </div></div>`;
}

// ── enganches ──
(function(){
  const _cpa=cloudPullAll; cloudPullAll=async function(){ const r=await _cpa.apply(this,arguments); try{ await cloudPull('comentario'); }catch(e){} return r; };
  // Tablero: el comercial ve los mensajes arriba de todo; el gerente, el historial y el botón.
  if(typeof mtbHtml==='function'){ const _m=mtbHtml; mtbHtml=function(nombre,propio){ const h=_m.apply(this,arguments); return (propio?cmtComercialHtml(nombre):cmtGerenteHtml(nombre))+h; }; }
  // Pantallas de bloqueo: aviso de mensajes nuevos dentro del resumen.
  if(typeof mtbResumenHtml==='function'){ const _r=mtbResumenHtml; mtbResumenHtml=function(nombre){ const h=_r.apply(this,arguments); const n=cmtNoLeidos(nombre).length; if(!n||!h) return h;
    return h.replace('Resolvé esto primero',`<b style="color:#b54708">💬 Tenés ${n} mensaje${n>1?'s':''} nuevo${n>1?'s':''} de gerencia en tu tablero.</b><br>Resolvé esto primero`); }; }
  // Ficha del cliente: el gerente comenta al comercial sobre ese cliente.
  if(typeof gsRenderFicha==='function'){ const _f=gsRenderFicha; gsRenderFicha=function(){ const r=_f.apply(this,arguments); try{ const c=clienteById(_gsFicha); const el=gs('sFichaBody');
      if(c && el && esGerente() && c.comercial) el.insertAdjacentHTML('afterbegin',`<button class="btn btn-sec btn-block" style="margin-bottom:8px" onclick="cmtNuevo('${esc(c.comercial).replace(/'/g,"\\'")}','${c.id}')">💬 Comentar a ${esc(c.comercial)} sobre este cliente</button>`); }catch(e){} return r; }; }
  // Equipo: quién tiene comentarios sin leer.
  if(typeof gsRenderGestCom==='function'){ const _g=gsRenderGestCom; gsRenderGestCom=function(){ const r=_g.apply(this,arguments); try{ if(_gst.gtab==='equipo'){ const el=gs('sGestComBody'); const coms=cmComerciales().map(n=>[n,cmtNoLeidos(n).length]).filter(x=>x[1]);
      if(el && coms.length) el.insertAdjacentHTML('afterbegin',`<div style="font-size:12px;color:#b54708;margin-bottom:6px">💬 Sin leer: ${coms.map(x=>esc(x[0])+' '+x[1]).join(' · ')}</div>`); } }catch(e){} return r; }; }
})();
