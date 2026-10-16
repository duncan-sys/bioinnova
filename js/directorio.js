// ══════════════════════════════════════════════════════════
//  TABLERO DEL DIRECTORIO (Finanzas → 🏛 Directorio, sólo gerencia)
//  Presupuesto del modelo del Directorio (embebido: se actualiza con cada
//  versión del presupuesto), venta del mes en vivo desde la app (anticipo,
//  neto de IVA) y el real contable que carga gerencia desde el P&G.
// ══════════════════════════════════════════════════════════
// Generado desde el modelo del Directorio (margen jun-sep 2026, contrataciones oct-26/nov-26/ene-27).
// [venta neta, margen bruto, EBITDA, resultado, venta de equilibrio, costos fijos] por mes.
const DIR_PPTO = {
  '2026-10':[914702929,302392439,-7036202,-41692803,951770974,180663772],
  '2026-11':[548832678,181439074,-92549618,-127206219,1031601312,197764106],
  '2026-12':[863249137,285382285,-29817373,-64473974,1016510954,197764106],
  '2027-01':[1058660310,349983435,-15648260,-50304861,1138377992,223459016],
  '2027-02':[1209809306,399951914,15968267,-18688334,1129122770,223459015],
  '2027-03':[1064979566,352072524,-11565069,-46221670,1123105635,223459016],
  '2027-04':[1175189667,388506977,11002918,-23653683,1120039923,223459015],
  '2027-05':[1479935833,489253278,72052446,37395845,1119093664,223459015],
  '2027-06':[1363232420,450672195,48971263,14314662,1118181782,223459015],
  '2027-07':[1308559442,432597807,38045337,3388736,1118181788,223459015],
  '2027-08':[1868193830,617607828,149883458,115226857,1118181784,223459014],
  '2027-09':[1609872883,532209281,98260238,63603637,1118181784,223459014],
  '2027-10':[1909882647,631389770,158214606,123558005,1118181800,223459017],
  '2027-11':[1033508584,341668504,-16921213,-51577814,1118181795,223459016],
  '2027-12':[1358908095,449242613,48107082,13450481,1118181791,223459016],
};
// Real contable enero-septiembre 2026 (P&G del contador): [venta neta, margen bruto, EBITDA, resultado].
const DIR_REAL_BASE = {
  '2026-01':[384589390,114834807,-55348306,-123297994],
  '2026-02':[628050133,176995965,-98784426,-28320114],
  '2026-03':[466229582,152835686,-43946150,-102783811],
  '2026-04':[384626738,113548084,-63205523,126624300],
  '2026-05':[734114971,201605986,18251742,-25478039],
  '2026-06':[592443372,204902721,-128704340,-186451454],
  '2026-07':[665027888,210861586,-80255719,-56851345],
  '2026-08':[861820928,287194305,-20205979,-30059914],
  '2026-09':[699555567,228926726,-10016530,-1051371],
};

// Equilibrio de referencia (estructura actual, sin vendedores nuevos) y resultados anuales del plan.
const DIR_EQ_BASE = 861683178;
const DIR_PLAN = { fy2026_res:-661042738, fy2027_venta:16440732583, fy2027_ebitda:596371073, fy2027_res:180491861, sinHacer2027_res:-886933891, regimen_res:354313386, punto_mc:164407326 };
const DIR_HITOS = [
  ['2026-10','Primera vendedora nueva en la calle (Nathalia Samudio)','manual_ok'],
  ['2026-11','Segundo vendedor nuevo en la calle','manual'],
  ['2027-01','Tercer vendedor nuevo en la calle','manual'],
  ['2027-02','Primer mes con EBITDA positivo','ebitda'],
  ['2027-05','Primer mes con ganancia','resultado'],
  ['2027-12','2027 cierra con ganancia (+Gs. 180 M)','anual']
];

// ── funciones puras ──
function dirYm(iso){ return String(iso||'').slice(0,7); }
function dirYmSuma(ym,n){ const a=Number(ym.slice(0,4)), m=Number(ym.slice(5,7))-1+n; const y=a+Math.floor(m/12), mm=((m%12)+12)%12+1; return y+'-'+String(mm).padStart(2,'0'); }
// Días hábiles (lunes a sábado, igual que Metas) del mes: total y transcurridos hasta la fecha inclusive.
function dirDiasHabiles(ym, hoyIso){
  const a=Number(ym.slice(0,4)), m=Number(ym.slice(5,7)); const fin=new Date(a,m,0).getDate(); let tot=0, pas=0;
  for(let d=1; d<=fin; d++){ const dt=new Date(a,m-1,d); if(dt.getDay()===0) continue; tot++; const iso=ym+'-'+String(d).padStart(2,'0'); if(iso<=hoyIso) pas++; }
  return { tot, pas };
}
// Proyección lineal al cierre del mes por días hábiles transcurridos.
function dirProyeccion(facturado, dh){ if(!dh || dh.pas<=0) return null; return Math.round(facturado/dh.pas*dh.tot); }
// Real del mes: lo cargado por gerencia manda sobre la base embebida.
function dirReal(ym, cargado){ const c=cargado&&cargado[ym]; if(c) return [Number(c.venta)||0,Number(c.mb)||0,Number(c.ebitda)||0,Number(c.res)||0]; return DIR_REAL_BASE[ym]||null; }
// Acumulado del año, mes a mes: real donde lo hay y presupuesto donde no.
function dirAcumAnio(anio, cargado){
  const out=[]; let ar=0, ap=0, mix=0, hayReal=false;
  for(let m=1;m<=12;m++){ const ym=anio+'-'+String(m).padStart(2,'0'); const r=dirReal(ym,cargado), p=DIR_PPTO[ym];
    const pr = p?p[3]:(r?r[3]:null);   // antes de octubre-26 no hay presupuesto: el plan es lo real
    if(r){ ar+=r[3]; hayReal=true; }
    if(pr!=null) ap+=pr;
    mix += r?r[3]:(pr||0);
    out.push({ ym, real:r?ar:null, ppto:pr!=null?ap:null, proyectado:mix, esReal:!!r }); }
  return out;
}
function dirPrimerMes(cargado, idx, desde){ // primer mes real con el indicador > 0 desde una fecha
  const ks=Object.keys(Object.assign({},DIR_REAL_BASE,cargado||{})).filter(k=>k>=desde).sort();
  for(const k of ks){ const r=dirReal(k,cargado); if(r && r[idx]>0) return k; } return '';
}

// ── estado: real cargado por gerencia (bio_config id='dirreal') ──
function getDirReal(){ try{ return JSON.parse(localStorage.getItem('bio:dirreal'))||{}; }catch{ return {}; } }
function setDirReal(d){ localStorage.setItem('bio:dirreal', JSON.stringify(d||{})); }
async function pullDirReal(){ if(typeof AUTH_ON==='undefined'||!AUTH_ON) return; try{ const rows=await sb.query('bio_config',{id:'dirreal'}); if(rows&&rows[0]&&rows[0].data){ const d=(typeof rows[0].data==='string')?JSON.parse(rows[0].data):rows[0].data; if(d) setDirReal(d); } }catch(e){} }
async function pushDirReal(){ if(typeof AUTH_ON==='undefined'||!AUTH_ON) return; try{ await sb.upsert('bio_config',{id:'dirreal',data:getDirReal()||{},ts:new Date().toISOString()},'id'); }catch(e){} }

// ── UI ──
const dirM=v=>v==null?'—':(Math.round(v/1e5)/10).toLocaleString('es-PY',{minimumFractionDigits:1,maximumFractionDigits:1});   // millones con 1 decimal
const dirCol=v=>v==null?'var(--gray-400)':(v<0?'var(--red)':'var(--green)');
function dirCard(lbl,val,sub,col,bg){ return `<div style="flex:1;min-width:150px;background:${bg||'#fff'};border:1px solid var(--gray-200);border-radius:12px;padding:10px 12px"><div style="font-size:10px;color:var(--gray-500);font-weight:700;letter-spacing:.3px">${lbl}</div><div style="font-size:22px;font-weight:800;color:${col||'var(--gray-800)'};line-height:1.15;margin-top:2px">${val}</div>${sub?`<div style="font-size:11px;color:var(--gray-500);margin-top:2px">${sub}</div>`:''}</div>`; }
function dirSemaforo(pct){ if(pct==null) return ['var(--gray-400)','—']; if(pct>=1) return ['var(--green)','🟢']; if(pct>=0.9) return ['#b54708','🟡']; return ['var(--red)','🔴']; }

function dirRender(){
  const el=gs('finW_dir'); if(!el) return;
  if(!esGerente()){ el.innerHTML='<div class="card"><div class="card-b">Sólo gerencia.</div></div>'; return; }
  const h=hoy(), ym=dirYm(h), cargado=getDirReal(), p=DIR_PPTO[ym];
  // Mes en curso: venta de la app (con IVA) pasada a neto
  const vm=getVentas().filter(v=>dirYm(v.fecha)===ym); const conIva=vm.reduce((a,v)=>a+finGs(v,v.monto),0); const neto=mtNeto(conIva);
  const dh=dirDiasHabiles(ym,h), proy=dirProyeccion(neto,dh);
  const pctPpto=p?neto/p[0]:null, pctProy=(p&&proy!=null)?proy/p[0]:null, be=p?p[4]:DIR_EQ_BASE;
  const [colP]=dirSemaforo(pctProy);
  const colEq=proy==null?'var(--gray-400)':(proy>=be?'var(--green)':(proy>=be*0.9?'#b54708':'var(--red)'));
  // Año
  const anio=Number(ym.slice(0,4)); const ac=dirAcumAnio(anio,cargado); const ultReal=[...ac].reverse().find(x=>x.esReal);
  const fyProy=ac[11].proyectado, fyPpto=ac[11].ppto;
  // Tabla mensual (desde oct-26 hasta dic-27)
  const meses=Object.keys(DIR_PPTO).sort();
  const filas=meses.map(k=>{ const pp=DIR_PPTO[k], r=dirReal(k,cargado); const dV=r?(r[0]/pp[0]-1):null; const fut=k>ym; const actual=k===ym;
    return `<tr style="border-top:1px solid var(--gray-100);${actual?'background:#f0f7ff;':''}">
      <td style="padding:6px 8px;font-weight:600;white-space:nowrap">${esc(finMesLbl(k))}${actual?' <span style="font-size:9px;color:var(--blue)">● en curso</span>':''}</td>
      <td class="n">${dirM(pp[0])}</td><td class="n" style="font-weight:700">${r?dirM(r[0]):(actual?'<span style="color:var(--gray-400)" title="anticipo: venta de la app, neto">('+dirM(neto)+')</span>':'')}</td>
      <td class="n" style="color:${dV==null?'var(--gray-400)':(dV>=0?'var(--green)':'var(--red)')}">${dV==null?'':(dV>=0?'+':'')+Math.round(dV*100)+'%'}</td>
      <td class="n" style="color:${dirCol(pp[2])}">${dirM(pp[2])}</td><td class="n" style="font-weight:700;color:${r?dirCol(r[2]):''}">${r?dirM(r[2]):''}</td>
      <td class="n" style="color:${dirCol(pp[3])}">${dirM(pp[3])}</td><td class="n" style="font-weight:700;color:${r?dirCol(r[3]):''}">${r?dirM(r[3]):''}</td>
      <td style="text-align:center">${fut?'':`<span style="color:var(--green);cursor:pointer;font-size:12px;font-weight:600" onclick="dirCargarModal('${k}')">${(cargado&&cargado[k])?'✎':'＋ real'}</span>`}</td></tr>`; }).join('');
  // Equipo comercial del mes
  let eq=''; try{ const fil=rankingMes(getVentas(),getMetas(),ym,_finComDe,finGs);
    eq=fil.map(f=>`<div style="display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-top:1px solid var(--gray-100);font-size:12.5px"><span>${esc(_finComLbl(f.comercial))}</span><span>${finGsFmt(f.facturado)}${f.meta>0?` de ${finGsFmt(f.meta)} · <b style="color:${_mtColor(f.pct)}">${Math.round((f.pct||0)*100)}%</b>`:''}</span></div>`).join(''); }catch(e){}
  // Hitos
  const pe=dirPrimerMes(cargado,2,'2026-10'), pr=dirPrimerMes(cargado,3,'2026-10');
  const hit=DIR_HITOS.map(x=>{ let ok=null, txt='';
    if(x[2]==='manual_ok'){ ok=true; txt='cumplido'; }
    else if(x[2]==='manual'){ ok = ym>x[0]?null:null; txt=ym>=x[0]?'confirmar contratación':'pendiente'; }
    else if(x[2]==='ebitda'){ ok=pe?true:(ym>x[0]?false:null); txt=pe?('logrado en '+finMesLbl(pe)):(ym>x[0]?'atrasado':'pendiente'); }
    else if(x[2]==='resultado'){ ok=pr?true:(ym>x[0]?false:null); txt=pr?('logrado en '+finMesLbl(pr)):(ym>x[0]?'atrasado':'pendiente'); }
    else { txt='al cierre de 2027'; }
    const c=ok===true?'var(--green)':(ok===false?'var(--red)':'var(--gray-500)');
    return `<div style="display:flex;gap:10px;align-items:center;padding:6px 0;border-top:1px solid var(--gray-100);font-size:12.5px"><span style="flex:0 0 62px;font-weight:700;color:var(--gray-600)">${esc(finMesLbl(x[0]))}</span><span style="flex:1">${esc(x[1])}</span><span style="font-size:11px;font-weight:700;color:${c}">${ok===true?'✔ ':''}${esc(txt)}</span></div>`; }).join('');

  el.innerHTML=`
  <style>#finW_dir td.n{text-align:right;padding:6px 6px;white-space:nowrap} #finW_dir th{padding:6px 6px;font-size:10px;color:var(--gray-500);text-align:right;white-space:nowrap}</style>
  <div style="font-size:12px;color:var(--gray-500);margin-bottom:8px">Cifras netas de IVA. Lo <b>real</b> es el P&G del contador; la venta del mes en curso es un <b>anticipo</b> con lo facturado en la app.</div>
  <div class="sect-t" style="margin-top:0">Mes en curso · ${esc(finMesLbl(ym))}</div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px">
    ${dirCard('FACTURADO A LA FECHA', 'Gs. '+dirM(neto)+' M', (p?Math.round(pctPpto*100)+'% del presupuesto del mes':'')+' · '+dh.pas+' de '+dh.tot+' días hábiles')}
    ${dirCard('PROYECCIÓN AL CIERRE', proy==null?'—':'Gs. '+dirM(proy)+' M', p?('presupuesto Gs. '+dirM(p[0])+' M · '+(pctProy==null?'':Math.round(pctProy*100)+'%')):'', colP)}
    ${dirCard('EQUILIBRIO DEL MES', 'Gs. '+dirM(be)+' M', proy==null?'':(proy>=be?'la proyección lo supera':'faltan Gs. '+dirM(be-proy)+' M para no perder'), colEq)}
  </div>
  <div class="sect-t">Año ${anio}</div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px">
    ${dirCard('RESULTADO ACUMULADO REAL', ultReal?'Gs. '+dirM(ultReal.real)+' M':'—', ultReal?'a '+finMesLbl(ultReal.ym):'', dirCol(ultReal&&ultReal.real))}
    ${dirCard('CIERRE '+anio+' PROYECTADO', 'Gs. '+dirM(fyProy)+' M', 'real + presupuesto de lo que falta · plan: Gs. '+dirM(fyPpto)+' M', dirCol(fyProy))}
    ${anio===2026?dirCard('PRESUPUESTO 2027','Gs. '+dirM(DIR_PLAN.fy2027_res)+' M','venta Gs. '+dirM(DIR_PLAN.fy2027_venta)+' M · sin hacer nada: Gs. '+dirM(DIR_PLAN.sinHacer2027_res)+' M',dirCol(DIR_PLAN.fy2027_res)):''}
  </div>
  <div class="card"><div class="card-h"><span>Resultado acumulado del año</span><span style="font-size:11px;color:var(--gray-400)">millones Gs.</span></div><div class="card-b">${dirGrafico(ac)}</div></div>
  <div class="card"><div class="card-h"><span>Presupuesto vs real, mes a mes</span><span style="font-size:11px;color:var(--gray-400)">millones Gs.</span></div><div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--gray-100)"><th style="text-align:left;padding-left:8px">Mes</th><th>Venta ppto</th><th>Venta real</th><th>Desvío</th><th>EBITDA ppto</th><th>EBITDA real</th><th>Result. ppto</th><th>Result. real</th><th></th></tr></thead>
    <tbody>${filas}</tbody></table></div>
    <div style="padding:6px 12px 9px;font-size:10.5px;color:var(--gray-400)">Entre paréntesis: anticipo del mes en curso con la venta de la app. "＋ real" carga las cifras del P&G del contador cuando llega.</div></div>
  <div class="card"><div class="card-h"><span>Equipo comercial · ${esc(finMesLbl(ym))}</span><span style="color:var(--green);cursor:pointer;font-size:12px;font-weight:600" onclick="openTabCom()">Tablero comercial ›</span></div><div class="card-b" style="padding-top:2px">${eq||'<div style="font-size:12px;color:var(--gray-400)">Sin metas ni ventas este mes.</div>'}</div></div>
  <div class="card"><div class="card-h"><span>Hitos del plan</span></div><div class="card-b" style="padding-top:2px">${hit}</div></div>
  <div class="card"><div class="card-b" style="font-size:11.5px;color:var(--gray-500);line-height:1.5">
    <b>Supuestos del presupuesto:</b> margen real de junio-septiembre 2026 (bruto 33,1%, contribución 19,0%); costos fijos promedio enero-agosto; 3 vendedores nuevos a Gs. 250 M/mes (oct-26, nov-26, ene-27) con rampa de 6 meses; alquiler sin cambios; sin diferencia de cambio.
    Equilibrio con la estructura actual: Gs. ${dirM(DIR_EQ_BASE)} M/mes; con los 3 vendedores incorporados sube a Gs. 1.118 M/mes. Cada punto de margen de contribución vale Gs. ${dirM(DIR_PLAN.punto_mc)} M en 2027.
  </div></div>`;
}

// Gráfico SVG: acumulado real (línea llena) contra presupuesto (punteada).
function dirGrafico(ac){
  const W=640,H=200,pl=58,pr=10,pt=12,pb=26; const vals=[]; ac.forEach(x=>{ if(x.real!=null) vals.push(x.real); if(x.ppto!=null) vals.push(x.ppto); });
  if(!vals.length) return '<div style="font-size:12px;color:var(--gray-400)">Sin datos.</div>';
  let mn=Math.min(0,...vals), mx=Math.max(0,...vals);
  const raw=(mx-mn)/4||1, p10=Math.pow(10,Math.floor(Math.log10(raw))), step=[1,2,2.5,5,10].map(k=>k*p10).find(s=>s>=raw);
  mn=Math.floor(mn/step)*step; mx=Math.ceil(mx/step)*step;
  const X=i=>pl+(W-pl-pr)*i/11, Y=v=>pt+(H-pt-pb)*(1-(v-mn)/(mx-mn));
  const linea=(k,col,dash)=>{ const pts=ac.map((x,i)=>x[k]!=null?X(i).toFixed(1)+','+Y(x[k]).toFixed(1):null).filter(Boolean); return pts.length>1?`<polyline points="${pts.join(' ')}" fill="none" stroke="${col}" stroke-width="2.6" ${dash?'stroke-dasharray="6 4"':''}/>`:''; };
  const dots=ac.map((x,i)=>x.real!=null?`<circle cx="${X(i).toFixed(1)}" cy="${Y(x.real).toFixed(1)}" r="3" fill="#0a6640"/>`:'').join('');
  let grid=''; for(let v=mn; v<=mx+1; v+=step){ grid+=`<line x1="${pl}" x2="${W-pr}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="#e5e7eb"/><text x="${pl-5}" y="${(Y(v)+3).toFixed(1)}" font-size="9" text-anchor="end" fill="#6b7280">${Math.round(v/1e6).toLocaleString('es-PY')}</text>`; }
  const cero=`<line x1="${pl}" x2="${W-pr}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}" stroke="#9ca3af" stroke-width="1"/>`;
  const lbl=ac.map((x,i)=>`<text x="${X(i).toFixed(1)}" y="${H-8}" font-size="9" text-anchor="middle" fill="#6b7280">${MESES_AB[i]}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">${grid}${cero}${linea('ppto','#94a3b8',true)}${linea('real','#0a6640',false)}${dots}${lbl}</svg>
    <div style="display:flex;gap:14px;font-size:11px;color:var(--gray-600);margin-top:2px"><span><span style="display:inline-block;width:18px;border-top:3px solid #0a6640;vertical-align:middle"></span> Real</span><span><span style="display:inline-block;width:18px;border-top:3px dashed #94a3b8;vertical-align:middle"></span> Presupuesto</span></div>`;
}

function dirCargarModal(ym){
  if(!esGerente()) return; const c=(getDirReal()||{})[ym]||{}; const pp=DIR_PPTO[ym]||[];
  gs('modalBox').innerHTML=`<h3>Real de ${esc(finMesLbl(ym))}</h3>
    <div style="font-size:12px;color:var(--gray-500);margin-bottom:6px">Del P&G del contador, en guaraníes y netos de IVA. Presupuesto del mes entre paréntesis.</div>
    <label class="fl">Venta neta <span style="color:var(--gray-400);font-weight:400">(${finGsFmt(pp[0])})</span></label><input type="number" inputmode="numeric" id="drV" value="${c.venta??''}">
    <label class="fl">Margen bruto <span style="color:var(--gray-400);font-weight:400">(${finGsFmt(pp[1])})</span></label><input type="number" inputmode="numeric" id="drMB" value="${c.mb??''}">
    <label class="fl">EBITDA <span style="color:var(--gray-400);font-weight:400">(${finGsFmt(pp[2])})</span></label><input type="number" inputmode="numeric" id="drE" value="${c.ebitda??''}">
    <label class="fl">Resultado del ejercicio <span style="color:var(--gray-400);font-weight:400">(${finGsFmt(pp[3])})</span></label><input type="number" inputmode="numeric" id="drR" value="${c.res??''}">
    <div class="row2" style="margin-top:12px">${c.venta!=null?`<button class="btn btn-sec" style="color:var(--red)" onclick="dirBorrarReal('${ym}')">Borrar</button>`:'<button class="btn btn-sec" onclick="cerrarModal()">Cancelar</button>'}<button class="btn btn-primary" onclick="dirGuardarReal('${ym}')">Guardar</button></div>`;
  gs('modal').classList.add('show');
}
function dirGuardarReal(ym){
  const n=id=>{ const s=String(gs(id).value||'').trim(); return s===''?null:Number(s); };
  const r={ venta:n('drV'), mb:n('drMB'), ebitda:n('drE'), res:n('drR'), ts:new Date().toISOString(), por:(typeof cmYo==='function'?cmYo():'') };
  if(r.venta==null || r.res==null){ showToast('Cargá al menos la venta y el resultado'); return; }
  const d=getDirReal(); d[ym]=r; setDirReal(d); pushDirReal(); cerrarModal(); showToast('✓ Real de '+finMesLbl(ym)+' guardado'); dirRender();
}
function dirBorrarReal(ym){ if(!confirm('¿Borrar el real cargado de '+finMesLbl(ym)+'?')) return; const d=getDirReal(); delete d[ym]; setDirReal(d); pushDirReal(); cerrarModal(); dirRender(); }

// ── enganche en Finanzas: pestaña sólo para gerencia ──
(function dirEnganchar(){
  if(typeof finSetTab!=='function') return;
  const tabs=document.querySelector('#sFinanzas .fintab') && document.querySelector('#sFinanzas .fintab').parentNode;
  if(tabs && !gs('finT_dir')){
    tabs.insertAdjacentHTML('afterbegin','<button class="fintab" id="finT_dir" onclick="finSetTab(\'dir\')" style="display:none">🏛 Directorio</button>');
    const ver=gs('finVer'); const cont=ver?ver.parentNode:null;
    if(cont) cont.insertAdjacentHTML('afterend','<div id="finW_dir" style="display:none"></div>');
  }
  const _set=finSetTab;
  finSetTab=function(t){
    const bt=gs('finT_dir'); if(bt) bt.style.display=esGerente()?'':'none';
    if(t==='dir' && esGerente()){
      _finTab='dir';
      ['ventas','cobrar','gastos','pagar','sueldos','cheques','banco','flujo'].forEach(x=>{ const w=gs('finW_'+x); if(w) w.style.display='none'; const b=gs('finT_'+x); if(b) b.className='fintab'; });
      gs('finW_dir').style.display=''; if(bt) bt.className='fintab on';
      dirRender(); return;
    }
    const w=gs('finW_dir'); if(w) w.style.display='none'; if(bt) bt.className='fintab';
    return _set(t==='dir'?'ventas':t);
  };
})();
