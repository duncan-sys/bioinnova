// ══════════════════════════════════════════════════════════════════════════
//  CONTEO FÍSICO MENSUAL (toma de inventario)
//  Un conteo es de INSUMOS (kg / u) o de PRODUCTO TERMINADO (bolsas). Congela
//  el stock sistema y el costo de cada ítem a la fecha del recuento. Se imprime
//  la planilla, se cuenta, se carga lo encontrado y cada diferencia se explica
//  y documenta. El stock sólo cambia cuando el autorizador aprueba: ahí se
//  generan movimientos "ajuste" por la diferencia, así lo cargado después del
//  conteo no se pisa.  Estados: abierto → enviado → aprobado.
// ══════════════════════════════════════════════════════════════════════════
function getConteos(){ return getArr('bio:conteos'); }
function saveConteos(a){ setArr('bio:conteos',a); }
function conteoRow(c){ return { id:c.id, tipo:c.tipo||'insumos', fecha:c.fecha||null, estado:c.estado||'abierto', lineas:c.lineas||[], creado_por:c.creado_por||'', enviado_por:c.enviado_por||'', aprobado_por:c.aprobado_por||'', aprobado_ts:c.aprobado_ts||null, obs:c.obs||'', ts:c.ts||null }; }
function rowConteo(r){ let l=r.lineas; if(typeof l==='string'){ try{ l=JSON.parse(l); }catch{ l=[]; } }
  return { id:r.id, tipo:r.tipo||'insumos', fecha:r.fecha||'', estado:r.estado||'abierto', lineas:Array.isArray(l)?l:[], creado_por:r.creado_por||'', enviado_por:r.enviado_por||'', aprobado_por:r.aprobado_por||'', aprobado_ts:r.aprobado_ts||null, obs:r.obs||'', ts:r.ts, pending:false }; }
SYNC_DEFS.conteo={ get:getConteos, save:saveConteos, table:'bio_conteos', toRow:conteoRow, fromRow:rowConteo };

// ── autorizador (bio_config id='conteo'): sólo esa persona ajusta el stock ──
function getCnCfg(){ try{ return JSON.parse(localStorage.getItem('bio:cncfg'))||{}; }catch{ return {}; } }
function setCnCfg(o){ try{ localStorage.setItem('bio:cncfg',JSON.stringify(o||{})); }catch{} }
async function pullCnCfg(){ if(typeof AUTH_ON==='undefined'||!AUTH_ON) return; try{ const rows=await sb.query('bio_config',{id:'conteo'}); if(rows&&rows[0]&&rows[0].data){ const d=(typeof rows[0].data==='string')?JSON.parse(rows[0].data):rows[0].data; setCnCfg(d); } }catch(e){} }
async function pushCnCfg(){ if(typeof AUTH_ON==='undefined'||!AUTH_ON) return; try{ await sb.upsert('bio_config',{id:'conteo',data:getCnCfg(),ts:new Date().toISOString()},'id'); }catch(e){} }
function cnMiEmail(){ const s=getSession(); return String((s&&s.user&&s.user.email)||'').toLowerCase(); }
function cnAutorizador(){ return String(getCnCfg().autorizador||'').trim().toLowerCase(); }
// Si está fijado, sólo esa persona; si todavía no, cualquier gerente.
function cnPuedeAutorizar(){ if(!esGerente()) return false; const a=cnAutorizador(); return !a || a===cnMiEmail(); }
function cnPuedeContar(){ return puedeVer('inventario'); }

// ── ítems y valorización ──
// Insumos: precio promedio ponderado (el mismo que usa la cotización).
// Terminados: costo de producción por kg × kg de la bolsa.
function cnCostoPT(key, kg){ try{ const f=formulaDeKey(key); if(!f) return 0; const c=costoProduccionKg(f); return Math.round(((c&&c.costo_kg)||0)*(kg||0)); }catch(e){ return 0; } }
function cnSnapshot(tipo){
  if(tipo==='pt'){
    const conMov=new Set(getPtMovs().map(m=>m.prod_key));
    return precioList().map(p=>{ const key=precioKey(p); const st=ptStock(key); if(!st && !conMov.has(key)) return null; const kg=p.kg||prodKgBolsa(p);
      return { key, cod:p.c||'', nombre:p.n||'', cat:p.l||'Producto terminado', um:'bolsas', kg, sist:st, costo:cnCostoPT(key,kg), fis:null, expl:'', fotos:[], aprobar:true }; }).filter(Boolean)
      .sort((a,b)=>String(a.cat).localeCompare(String(b.cat))||String(a.nombre).localeCompare(String(b.nombre)));
  }
  return invCatalogo().map(i=>({ key:i.c, cod:i.c, nombre:i.n||i.c, cat:i.cat||'Otro', um:i.u||'kg', sist:invStock(i.c), costo:Math.round(insPrecio(i.c)||0), fis:null, expl:'', fotos:[], aprobar:true }))
    .sort((a,b)=>{ const o=['Materia prima','Envase','Etiqueta','Otro']; const ia=o.indexOf(a.cat), ib=o.indexOf(b.cat); return ((ia<0?9:ia)-(ib<0?9:ib))||String(a.nombre).localeCompare(String(b.nombre)); });
}
function cnDif(l){ return (l.fis==null||l.fis==='')?null:Math.round((Number(l.fis)-Number(l.sist||0))*100)/100; }
function cnTot(c){ let falt=0, sobr=0, nDif=0, sin=0;
  (c.lineas||[]).forEach(l=>{ const d=cnDif(l); if(d==null){ sin++; return; } if(d!==0){ nDif++; const v=d*(l.costo||0); if(v<0) falt+=v; else sobr+=v; } });
  return { falt, sobr, neto:falt+sobr, nDif, sin, n:(c.lineas||[]).length }; }
function cnNf(x){ return Math.round(Number(x)||0).toLocaleString('es-PY'); }
function cnQ(x){ return (Number(x)||0).toLocaleString('es-PY',{maximumFractionDigits:2}); }
const CN_TIPO={ insumos:'Insumos', pt:'Producto terminado' };

// ── pantalla ──
let _cnId=null, _cnSoloDif=false;
function openConteo(){ if(!cnPuedeContar()){ showToast('Sin permiso'); return; } _cnId=null; showScreen('sConteo','Conteo físico','Toma de inventario mensual',true); cnRender(); pullCnCfg().then(()=>{ if(!cnTipeando()) cnRender(); }); }
function cnAct(){ return getConteos().find(x=>x.id===_cnId)||null; }
function cnTipeando(){ const a=document.activeElement; return !!(a&&(a.tagName==='INPUT'||a.tagName==='TEXTAREA')&&gs('cnBody')&&gs('cnBody').contains(a)); }
function cnGuardar(c){ c.ts=new Date().toISOString(); c.pending=true; saveConteos([c, ...getConteos().filter(x=>x.id!==c.id)]); cloudPush('conteo',c); }
function cnMod(fn){ const c=cnAct(); if(!c) return; fn(c); cnGuardar(c); }
function cnRender(){ const b=gs('cnBody'); if(!b) return; const c=cnAct(); if(c) cnRenderConteo(b,c); else cnRenderLista(b); }

function cnRenderLista(b){
  const cs=getConteos().slice().sort((a,x)=>String(x.fecha||'').localeCompare(String(a.fecha||''))||String(x.ts||'').localeCompare(String(a.ts||'')));
  const est={abierto:['Abierto','var(--green-d)'],enviado:['Espera autorización','#b54708'],aprobado:['Aprobado','var(--green)']};
  const a=cnAutorizador();
  b.innerHTML=`<div class="card"><div class="card-h"><span>🧮 Nuevo conteo físico</span></div><div class="card-b">
      <div style="font-size:12px;color:var(--gray-600);margin-bottom:8px">Congela el stock sistema de cada ítem a la fecha del recuento. Después se imprime la planilla, se cuenta y se carga lo encontrado.</div>
      <div class="row2"><div><label class="fl">Qué se cuenta</label><select id="cnTipo"><option value="insumos">Insumos y materia prima</option><option value="pt">Producto terminado (bolsas)</option></select></div>
      <div><label class="fl">Fecha del conteo</label><input type="date" id="cnFecha" value="${hoy()}"></div></div>
      <button class="btn btn-primary btn-block" style="margin-top:10px" onclick="cnNuevo()">＋ Crear conteo</button>
      <div style="font-size:11px;color:var(--gray-500);margin-top:8px">Autoriza los ajustes: <b>${a?esc(a):'cualquier gerente (todavía no se fijó)'}</b>${esGerente()&&cnPuedeAutorizar()&&cnMiEmail()&&a!==cnMiEmail()?` · <span style="color:var(--green-d);cursor:pointer;font-weight:600" onclick="cnFijarAutorizador()">Fijarme a mí como único autorizador</span>`:''}</div>
    </div></div>
    <div class="card"><div class="card-h"><span>Conteos anteriores</span><span style="color:var(--gray-400);font-weight:500">${cs.length}</span></div><div>
    ${cs.length?cs.map(x=>{ const t=cnTot(x); const e=est[x.estado]||[x.estado,'var(--gray-500)'];
      return `<div class="li" onclick="cnAbrir('${x.id}')"><div style="min-width:0"><div class="li-t">${CN_TIPO[x.tipo]||x.tipo} · ${fmtFecha(x.fecha)}</div>
        <div class="li-s">${t.n} ítems · ${t.nDif} con diferencia${t.sin?' · '+t.sin+' sin contar':''} · neto ₲ ${cnNf(t.neto)}</div></div>
        <div style="font-size:10px;font-weight:700;color:${e[1]};text-transform:uppercase;flex-shrink:0">${e[0]}</div></div>`; }).join('')
      :'<div style="padding:12px;font-size:12px;color:var(--gray-400);text-align:center">Todavía no hay conteos.</div>'}</div></div>`;
}
function cnFijarAutorizador(){ const e=cnMiEmail(); if(!e) return; if(!confirm('Desde ahora sólo '+e+' podrá autorizar los ajustes de inventario. ¿Confirmás?')) return;
  const o=getCnCfg(); o.autorizador=e; setCnCfg(o); pushCnCfg(); showToast('✓ Autorizador fijado'); cnRender(); }
function cnNuevo(){
  const tipo=gs('cnTipo').value, fecha=gs('cnFecha').value||hoy();
  const ab=getConteos().find(x=>x.tipo===tipo && x.estado!=='aprobado');
  if(ab && !confirm('Ya hay un conteo de '+CN_TIPO[tipo]+' sin aprobar ('+fmtFecha(ab.fecha)+'). ¿Crear otro igual?')) return;
  const lineas=cnSnapshot(tipo); if(!lineas.length){ showToast('No hay ítems para contar'); return; }
  const s=getSession(); const c={ id:'CN-'+Date.now(), tipo, fecha, estado:'abierto', lineas, creado_por:(s&&s.nombre)||cnMiEmail(), obs:'' };
  cnGuardar(c); _cnId=c.id; _cnSoloDif=false; cnRender(); showToast('✓ Conteo creado: '+lineas.length+' ítems');
}
function cnAbrir(id){ _cnId=id; _cnSoloDif=false; cnRender(); window.scrollTo(0,0); }
function cnVolver(){ _cnId=null; cnRender(); }

function cnRenderConteo(b,c){
  const t=cnTot(c), ab=c.estado==='abierto', env=c.estado==='enviado', apr=c.estado==='aprobado';
  const ed=ab&&cnPuedeContar(), aut=env&&cnPuedeAutorizar();
  let ls=c.lineas.map((l,i)=>({l,i})); if(_cnSoloDif) ls=ls.filter(({l})=>{ const d=cnDif(l); return d!=null&&d!==0; });
  let cat=null;
  const filas=ls.map(({l,i})=>{ const d=cnDif(l), hay=d!=null&&d!==0; let h='';
    if(l.cat!==cat){ cat=l.cat; h+=`<div style="padding:8px 12px 3px;font-size:10px;font-weight:700;color:var(--green);text-transform:uppercase">${esc(cat)}</div>`; }
    h+=`<div style="padding:8px 12px;border-top:1px solid var(--gray-100)">
      <div style="display:flex;gap:8px;align-items:center">
        ${aut&&hay?`<input type="checkbox" ${l.aprobar!==false?'checked':''} onchange="cnSetAprobar(${i},this.checked)" title="Ajustar esta línea" style="width:18px;height:18px;flex-shrink:0">`:''}
        <div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600">${esc(l.nombre)}</div>
          <div style="font-size:11px;color:var(--gray-500)">${esc(l.cod)} · sistema <b>${cnQ(l.sist)} ${esc(l.um)}</b> · ₲ ${cnNf(l.costo)}/${l.um==='bolsas'?'bolsa':esc(l.um)}</div></div>
        ${ed?`<input type="number" inputmode="decimal" step="any" value="${l.fis==null?'':l.fis}" placeholder="Físico" onchange="cnSetFis(${i},this.value)" style="width:84px;text-align:right;flex-shrink:0">`
            :`<div style="width:70px;text-align:right;font-weight:700;flex-shrink:0">${l.fis==null?'<span style="color:var(--gray-400)">—</span>':cnQ(l.fis)}</div>`}
        <div style="width:92px;text-align:right;font-size:11px;font-weight:700;flex-shrink:0;color:${d==null?'var(--gray-400)':d<0?'var(--red)':d>0?'var(--green)':'var(--gray-500)'}">${d==null?'sin contar':d===0?'OK':(d>0?'+':'')+cnQ(d)+'<div style="font-weight:400;font-size:10px">₲ '+cnNf(d*(l.costo||0))+'</div>'}</div>
      </div>
      ${hay?`<div style="margin-top:6px">
        ${ed?`<input value="${esc(l.expl)}" placeholder="Explicación de la diferencia (obligatoria para enviar)" onchange="cnSetExpl(${i},this.value)" style="font-size:12px;${l.expl?'':'border-color:#f79009'}">`
            :`<div style="font-size:12px;color:var(--gray-600)">📝 ${esc(l.expl)||'<i>sin explicación</i>'}</div>`}
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:5px;align-items:center">${(l.fotos||[]).map((f,k)=>`<div style="position:relative;width:54px;height:54px;border-radius:6px;overflow:hidden;border:1px solid var(--gray-200)"><img src="${f}" onclick="cnVerFoto(${i},${k})" style="width:100%;height:100%;object-fit:cover;cursor:pointer">${ed?`<div onclick="cnDelFoto(${i},${k})" style="position:absolute;top:1px;right:1px;background:rgba(0,0,0,.6);color:#fff;border-radius:50%;width:16px;height:16px;line-height:15px;text-align:center;font-size:11px;cursor:pointer">×</div>`:''}</div>`).join('')}
          ${ed&&(l.fotos||[]).length<3?`<label style="font-size:12px;color:var(--green-d);font-weight:600;cursor:pointer">📎 Comprobante<input type="file" accept="image/*" capture="environment" style="display:none" onchange="cnAddFoto(${i},this)"></label>`:''}</div>
      </div>`:''}
    </div>`; return h; }).join('');
  const est={abierto:'ABIERTO · cargando el físico',enviado:'ESPERA AUTORIZACIÓN',aprobado:'APROBADO · stock ajustado'}[c.estado]||c.estado;
  const kpi=(l,v,col)=>`<div style="background:var(--gray-50,#f7f8fa);border:1px solid var(--gray-100);border-radius:8px;padding:6px;text-align:center"><div style="font-size:10px;color:var(--gray-500)">${l}</div><div style="font-size:13px;font-weight:700;color:${col}">₲ ${cnNf(v)}</div></div>`;
  b.innerHTML=`<div class="card"><div class="card-h"><span>🧮 ${CN_TIPO[c.tipo]||c.tipo} · ${fmtFecha(c.fecha)}</span><span onclick="cnVolver()" style="cursor:pointer;color:var(--green-d);font-weight:600">← Volver</span></div><div class="card-b">
      <div style="font-size:12px;margin-bottom:8px"><b style="color:${apr?'var(--green)':env?'#b54708':'var(--green-d)'}">${est}</b>${c.aprobado_por?' · aprobó '+esc(c.aprobado_por)+' el '+fmtFecha(String(c.aprobado_ts||'').slice(0,10)):''}${c.obs?'<div style="color:#b54708;margin-top:4px">↩ '+esc(c.obs)+'</div>':''}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">${kpi('Faltante',t.falt,'var(--red)')}${kpi('Sobrante',t.sobr,'var(--green)')}${kpi('Neto',t.neto,'var(--gray-800)')}</div>
      <div style="font-size:11px;color:var(--gray-500);margin:8px 0">${t.n} ítems · ${t.nDif} con diferencia · ${t.sin} sin contar (no se ajustan)</div>
      <div class="row2"><button class="btn btn-sec" style="font-size:12px" onclick="cnPlanilla(false)">🖨 Planilla</button><button class="btn btn-sec" style="font-size:12px" onclick="cnPlanilla(true)">🖨 Planilla a ciegas</button></div>
      <button class="btn btn-sec btn-block" style="font-size:12px;margin-top:6px" onclick="cnInforme()">📄 Informe de diferencias</button>
      <label style="font-size:12px;display:block;margin-top:8px"><input type="checkbox" ${_cnSoloDif?'checked':''} onchange="_cnSoloDif=this.checked;cnRender()" style="width:auto"> Ver sólo las diferencias</label>
      ${ab&&ed?`<div style="font-size:12px;color:var(--green-d);cursor:pointer;margin-top:4px" onclick="cnRefrescar()">↻ Actualizar stock sistema</div>`:''}
    </div></div>
    <div class="card">${filas||'<div style="padding:12px;font-size:12px;color:var(--gray-400);text-align:center">Sin líneas para mostrar.</div>'}</div>
    ${ab&&ed?`<button class="btn btn-primary btn-block" onclick="cnEnviar()">📤 Enviar para autorizar</button><button class="btn btn-ghost btn-block" style="margin-top:6px;color:var(--red)" onclick="cnBorrar()">Borrar conteo</button>`:''}
    ${aut?`<button class="btn btn-primary btn-block" onclick="cnAprobar()">✅ Autorizar y ajustar stock</button><button class="btn btn-sec btn-block" style="margin-top:6px" onclick="cnDevolver()">↩ Devolver para recuento</button>`:''}
    ${env&&!aut?`<div style="font-size:12px;color:var(--gray-500);text-align:center">Enviado. Lo tiene que autorizar ${esc(cnAutorizador()||'el gerente')}.</div>`:''}`;
}
function cnSetFis(i,v){ cnMod(c=>{ const s=String(v).trim().replace(',','.'); c.lineas[i].fis = s===''?null:Number(s); }); cnRender(); }
function cnSetExpl(i,v){ cnMod(c=>{ c.lineas[i].expl=String(v||'').trim(); }); }
function cnSetAprobar(i,on){ cnMod(c=>{ c.lineas[i].aprobar=!!on; }); }
function cnAddFoto(i,input){ const f=input.files&&input.files[0]; input.value=''; if(!f||!f.type.startsWith('image/')) return;
  const rd=new FileReader(); rd.onload=e=>{ const img=new Image(); img.onload=()=>{ const max=1000; let w=img.width,h=img.height; if(w>=h&&w>max){ h=Math.round(h*max/w); w=max; } else if(h>w&&h>max){ w=Math.round(w*max/h); h=max; }
    const cv=document.createElement('canvas'); cv.width=w; cv.height=h; cv.getContext('2d').drawImage(img,0,0,w,h); let d; try{ d=cv.toDataURL('image/jpeg',0.55); }catch(err){ d=e.target.result; }
    cnMod(c=>{ const l=c.lineas[i]; l.fotos=(l.fotos||[]).concat([d]).slice(0,3); }); cnRender(); }; img.src=e.target.result; }; rd.readAsDataURL(f); }
function cnDelFoto(i,k){ cnMod(c=>{ (c.lineas[i].fotos||[]).splice(k,1); }); cnRender(); }
function cnVerFoto(i,k){ const c=cnAct(); const f=c&&c.lineas[i]&&(c.lineas[i].fotos||[])[k]; if(!f) return; const w=window.open(''); if(w){ w.document.write('<title>Comprobante</title><img src="'+f+'" style="max-width:100%">'); w.document.close(); } }
function cnRefrescar(){ const c=cnAct(); if(!c||c.estado!=='abierto') return;
  if(!confirm('Vuelve a tomar el stock sistema de hoy para todos los ítems (lo ya contado se conserva). Usalo si se cargaron movimientos después de crear el conteo y antes de contar. ¿Seguir?')) return;
  const prev={}; c.lineas.forEach(l=>prev[l.key]=l);
  c.lineas=cnSnapshot(c.tipo).map(n=>{ const p=prev[n.key]; return p?{...n, fis:p.fis, expl:p.expl, fotos:p.fotos||[], aprobar:p.aprobar!==false}:n; });
  cnGuardar(c); cnRender(); showToast('✓ Stock sistema actualizado'); }
function cnEnviar(){ const c=cnAct(); if(!c) return; const t=cnTot(c);
  if(t.sin===t.n){ showToast('Cargá el físico de al menos un ítem'); return; }
  const falta=c.lineas.filter(l=>{ const d=cnDif(l); return d!=null&&d!==0&&!String(l.expl||'').trim(); });
  if(falta.length){ showToast('Falta la explicación en '+falta.length+' diferencia'+(falta.length>1?'s':'')); _cnSoloDif=true; cnRender(); return; }
  if(!confirm('Enviar para autorizar: '+t.nDif+' diferencias, neto ₲ '+cnNf(t.neto)+(t.sin?(' ('+t.sin+' ítems sin contar no se ajustan)'):'')+'. ¿Seguir?')) return;
  const s=getSession(); c.estado='enviado'; c.enviado_por=(s&&s.nombre)||cnMiEmail(); c.obs=''; cnGuardar(c); cnRender(); showToast('✓ Enviado para autorizar'); }
function cnDevolver(){ if(!cnPuedeAutorizar()) return; const c=cnAct(); if(!c) return; const m=prompt('¿Qué hay que recontar o explicar mejor?', c.obs||''); if(m===null) return;
  c.estado='abierto'; c.obs=m.trim(); cnGuardar(c); cnRender(); showToast('Devuelto para recuento'); }
function cnBorrar(){ const c=cnAct(); if(!c||c.estado!=='abierto') return; if(!confirm('¿Borrar este conteo? No toca el stock.')) return;
  saveConteos(getConteos().filter(x=>x.id!==c.id)); cloudDelete('conteo',c.id); _cnId=null; cnRender(); }
function cnAprobar(){
  if(!cnPuedeAutorizar()){ showToast('Sólo el autorizador puede ajustar el stock'); return; }
  const c=cnAct(); if(!c||c.estado!=='enviado') return;
  const aj=c.lineas.filter(l=>{ const d=cnDif(l); return d!=null&&d!==0&&l.aprobar!==false; });
  const val=aj.reduce((a,l)=>a+cnDif(l)*(l.costo||0),0);
  if(!confirm('Se van a generar '+aj.length+' ajustes de stock por un neto de ₲ '+cnNf(val)+'. Las líneas destildadas no se ajustan. ¿Autorizar?')) return;
  const s=getSession(), quien=(s&&s.nombre)||cnMiEmail(), ts=new Date().toISOString(); let n=0;
  if(c.tipo==='pt'){
    const movs=getPtMovs(); const ya=new Set(movs.map(m=>m.id)); const nuevos=[];
    c.lineas.forEach((l,i)=>{ const d=cnDif(l); if(d==null||d===0||l.aprobar===false) return; const id='PT-CN-'+c.id+'-'+i; if(ya.has(id)) return;
      nuevos.push({ id, prod_key:l.key, prod_cod:l.cod||'', prod_nom:l.nombre, kg_bolsa:l.kg||0, tipo:'ajuste', bolsas:d, motivo:'Conteo físico '+fmtFecha(c.fecha)+' · '+(l.expl||''), cliente:'', ot_id:'', ot_num:'', fecha:c.fecha, usuario:quien, ts, pending:true }); });
    savePtMovs([...nuevos, ...movs]); nuevos.forEach(m=>cloudPush('ptmov',m)); n=nuevos.length;
  } else {
    const movs=getMovs(); const ya=new Set(movs.map(m=>m.id)); const nuevos=[];
    c.lineas.forEach((l,i)=>{ const d=cnDif(l); if(d==null||d===0||l.aprobar===false) return; const id='MV-CN-'+c.id+'-'+i; if(ya.has(id)) return;
      nuevos.push({ id, insumo_c:l.key, insumo_n:l.nombre, u:l.um, tipo:'ajuste', cant:d, motivo:'Conteo físico '+fmtFecha(c.fecha)+' · '+(l.expl||''), proveedor:'', costo:null, moneda:'PYG', costo_orig:null, tc:null, ot_id:'', fecha:c.fecha, usuario:quien, ts, pending:true }); });
    saveMovs([...nuevos, ...movs]); nuevos.forEach(m=>cloudPush('mov',m)); n=nuevos.length;
  }
  c.estado='aprobado'; c.aprobado_por=quien; c.aprobado_ts=ts; cnGuardar(c); cnRender();
  showToast('✓ Stock ajustado: '+n+' movimientos', 3000); }

// ── impresos ──
function cnPlanilla(ciega){ const c=cnAct(); if(!c) return; const w=window.open('','_blank'); if(!w){ showToast('Permití las ventanas emergentes'); return; }
  let cat=null, n=0; const filas=c.lineas.map(l=>{ let h=''; if(l.cat!==cat){ cat=l.cat; h+=`<tr class="cat"><td colspan="${ciega?6:7}">${esc(cat)}</td></tr>`; } n++;
    return h+`<tr><td class="c">${n}</td><td class="c">${esc(l.cod)}</td><td>${esc(l.nombre)}</td><td class="c">${esc(l.um)}</td>${ciega?'':`<td class="r">${cnQ(l.sist)}</td>`}<td class="box"></td><td class="obs"></td></tr>`; }).join('');
  w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Planilla de conteo ${CN_TIPO[c.tipo]} ${c.fecha}</title><style>
    @page{size:A4 portrait;margin:10mm}body{font-family:Arial,sans-serif;font-size:10.5px;color:#1b2430}h1{font-size:15px;margin:0 0 2px;color:#0a6640}.sub{color:#555;margin-bottom:8px}
    table{width:100%;border-collapse:collapse}th{background:#eaf5ef;text-align:left;padding:4px 5px;border:1px solid #9bbfaa;font-size:10px}td{padding:5px;border:1px solid #c6d6cc;height:15px}
    .c{text-align:center;width:26px}.r{text-align:right;width:70px}.box{width:80px}.obs{width:130px}tr.cat td{background:#f4f8f5;font-weight:700;text-transform:uppercase;font-size:9.5px;border-color:#9bbfaa}
    tr{page-break-inside:avoid}.firmas{display:flex;gap:30px;margin-top:22px}.firmas div{flex:1;border-top:1px solid #333;padding-top:4px;text-align:center}</style></head><body>
    <h1>BioInnova S.A. · Toma de inventario físico · ${CN_TIPO[c.tipo]}</h1>
    <div class="sub">Fecha del conteo: <b>${fmtFecha(c.fecha)}</b> · ${c.lineas.length} ítems${ciega?' · conteo a ciegas (sin stock sistema)':' · stock sistema congelado a la fecha del conteo'} · Anotar lo encontrado en "Físico"${c.tipo==='pt'?' (en bolsas)':''}; si no hay, poner 0.</div>
    <table><thead><tr><th class="c">N°</th><th class="c">Código</th><th>Ítem</th><th class="c">Unidad</th>${ciega?'':'<th class="r">Stock sistema</th>'}<th class="box">Físico</th><th class="obs">Observaciones</th></tr></thead><tbody>${filas}</tbody></table>
    <div class="firmas"><div>Contó (nombre y firma)</div><div>Verificó (nombre y firma)</div><div>Hora inicio / fin</div></div>
    <script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`); w.document.close(); }
function cnInforme(){ const c=cnAct(); if(!c) return; const t=cnTot(c); const w=window.open('','_blank'); if(!w){ showToast('Permití las ventanas emergentes'); return; }
  const dif=c.lineas.filter(l=>{ const d=cnDif(l); return d!=null&&d!==0; }).sort((a,b)=>(cnDif(a)*(a.costo||0))-(cnDif(b)*(b.costo||0)));
  const filas=dif.map(l=>{ const d=cnDif(l), v=d*(l.costo||0); return `<tr><td>${esc(l.nombre)}<div class="cat">${esc(l.cod)} · ${esc(l.cat)}</div></td><td class="c">${esc(l.um)}</td><td class="r">${cnQ(l.sist)}</td><td class="r">${cnQ(l.fis)}</td><td class="r ${d<0?'neg':'pos'}">${d>0?'+':''}${cnQ(d)}</td><td class="r">${cnNf(l.costo)}</td><td class="r ${v<0?'neg':'pos'}">${cnNf(v)}</td><td>${esc(l.expl)}${(l.fotos||[]).length?`<div class="fotos">${l.fotos.map(f=>`<img src="${f}">`).join('')}</div>`:''}${c.estado!=='abierto'&&l.aprobar===false?'<div class="neg">No se ajustó</div>':''}</td></tr>`; }).join('');
  const est={abierto:'Borrador (falta enviar)',enviado:'Pendiente de autorización',aprobado:'Autorizado por '+esc(c.aprobado_por)+' el '+fmtFecha(String(c.aprobado_ts||'').slice(0,10))}[c.estado]||c.estado;
  w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Diferencias de inventario ${CN_TIPO[c.tipo]} ${c.fecha}</title><style>
    @page{size:A4 landscape;margin:10mm}body{font-family:Arial,sans-serif;font-size:10.5px;color:#1b2430}h1{font-size:15px;margin:0 0 2px;color:#0a6640}.sub{color:#555;margin-bottom:8px}
    .kp{display:flex;gap:10px;margin-bottom:10px}.kp div{border:1px solid #c6d6cc;border-radius:6px;padding:6px 10px}.kp b{display:block;font-size:13px}
    table{width:100%;border-collapse:collapse}th{background:#eaf5ef;text-align:left;padding:4px 5px;border-bottom:1px solid #9bbfaa;font-size:10px}td{padding:5px;border-bottom:1px solid #e1e8e3;vertical-align:top}
    .r{text-align:right;white-space:nowrap}.c{text-align:center}.neg{color:#b42318}.pos{color:#067647}.cat{font-size:9px;color:#888}.fotos img{height:60px;margin:3px 3px 0 0;border:1px solid #ccc}
    .firmas{display:flex;gap:30px;margin-top:26px}.firmas div{flex:1;border-top:1px solid #333;padding-top:4px;text-align:center}</style></head><body>
    <h1>BioInnova S.A. · Informe de diferencias de inventario · ${CN_TIPO[c.tipo]}</h1>
    <div class="sub">Conteo del <b>${fmtFecha(c.fecha)}</b> · Estado: <b>${est}</b>${c.obs?' · Obs.: '+esc(c.obs):''}</div>
    <div class="kp"><div>Ítems contados<b>${t.n-t.sin} de ${t.n}</b></div><div>Con diferencia<b>${t.nDif}</b></div><div>Faltante<b class="neg">₲ ${cnNf(t.falt)}</b></div><div>Sobrante<b class="pos">₲ ${cnNf(t.sobr)}</b></div><div>Neto<b>₲ ${cnNf(t.neto)}</b></div></div>
    <table><thead><tr><th>Ítem</th><th class="c">Unidad</th><th class="r">Sistema</th><th class="r">Físico</th><th class="r">Diferencia</th><th class="r">Costo ₲</th><th class="r">Valor ₲</th><th>Explicación y comprobantes</th></tr></thead><tbody>${filas||'<tr><td colspan="8">Sin diferencias.</td></tr>'}</tbody></table>
    <div style="font-size:9.5px;color:#666;margin-top:6px">${c.tipo==='pt'?'Valor = diferencia en bolsas × costo de producción de la bolsa a la fecha del conteo.':'Valor = diferencia × precio promedio ponderado del insumo a la fecha del conteo.'} Los ítems sin contar no se ajustan.</div>
    <div class="firmas"><div>Responsable del depósito</div><div>Autorizó</div></div>
    <script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script></body></html>`); w.document.close(); }

// ── integración: sincronización y refresco de pantalla ──
(function(){
  const _cpa=cloudPullAll;
  cloudPullAll=async function(){ const r=await _cpa.apply(this,arguments); try{ await cloudPull('conteo'); await pullCnCfg(); }catch(e){} return r; };
  const _rv=refreshVista;
  refreshVista=function(){ const act=document.querySelector('.screen.active'); if(act&&act.id==='sConteo'){ if(!cnTipeando()) cnRender(); return; } return _rv.apply(this,arguments); };
  const _ro=reopenScreen;
  reopenScreen=function(id){ if(id==='sConteo') return openConteo(); return _ro.apply(this,arguments); };
})();
