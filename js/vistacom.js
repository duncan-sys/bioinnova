// ══════════════════════════════════════════════════════════════════════════
//  VER COMO COMERCIAL — vista previa para gerencia
//  El gerente arma la herramienta de los comerciales pero con su usuario nunca
//  la ve como ellos. Acá elige un comercial y la app se comporta como si fuera
//  él: rol "tecnico", su nombre, sus pendientes, su agenda y sus bloqueos.
//  Mientras dura NO se guarda nada (ni en el equipo ni en la nube), para no
//  cargarle datos a su nombre. Recargar la página también sale de la vista.
// ══════════════════════════════════════════════════════════════════════════
let _vc=null;   // { nombre, rol, accesos, libre } mientras se mira como un comercial
// libre=true: se recorre la app sin los bloqueos (agenda, vencidos, cierre) para poder ver todo;
// con el botón de la franja se ven los bloqueos tal como le aparecen a él.
function vcActivo(){ return !!_vc; }
function vcElegir(){
  if(!esGerente()){ showToast('Sólo gerencia'); return; }
  const coms=(typeof cmComerciales==='function'?cmComerciales():[]);
  if(!coms.length){ showToast('No hay comerciales cargados'); return; }
  gs('modalBox').innerHTML=`<h3>👁 Ver la app como un comercial</h3>
    <div style="font-size:12px;color:var(--gray-600);margin-bottom:8px">Vas a ver exactamente lo que ve el comercial: su inicio, su semana, sus pendientes y los bloqueos. <b>Mientras estés en esta vista no se guarda nada.</b></div>
    <label class="fl">Comercial</label><select id="vcCom">${coms.map(n=>`<option>${esc(n)}</option>`).join('')}</select>
    <div class="row2" style="margin-top:12px"><button class="btn btn-sec" onclick="cerrarModal()">Cancelar</button><button class="btn btn-primary" onclick="vcEntrar(gs('vcCom').value)">👁 Ver como él</button></div>`;
  gs('modal').classList.add('show');
}
function vcEntrar(nombre){
  if(!nombre) return;
  _vc={ nombre, rol:currentRol, accesos:currentAccesos, libre:true };
  currentRol='tecnico'; currentAccesos=null;
  cerrarModal(); vcBanner(); goHome(); if(typeof openGestion==='function') openGestion('tablero');
  showToast('👁 Viendo la app como '+nombre+' · no se guarda nada', 3500);
}
function vcSalir(){
  if(!_vc) return;
  currentRol=_vc.rol; currentAccesos=_vc.accesos; _vc=null;
  vcBanner(); goHome(); showToast('Volviste a tu usuario');
}
function vcBanner(){
  let b=document.getElementById('vcBanner');
  if(!_vc){ if(b) b.remove(); return; }
  if(!b){ b=document.createElement('div'); b.id='vcBanner'; document.body.appendChild(b); }
  b.style.cssText='position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:100000;background:#7a2e0e;color:#fff;border-radius:22px;padding:8px 8px 8px 14px;display:flex;align-items:center;gap:10px;font-size:12.5px;box-shadow:0 4px 14px rgba(0,0,0,.3);max-width:94vw';
  const bq=(typeof _vcBloqueoReal==='function')?_vcBloqueoReal():''; const bqTxt={pendientes:'seguimientos vencidos',cierre:'cierre de la semana',plan:'agenda de la semana'}[bq]||'';
  b.innerHTML=`<span>👁 Viendo como <b>${esc(_vc.nombre)}</b> · no se guarda nada</span>${bq?`<button onclick="vcBloqueos()" title="A él la app le pide primero: ${bqTxt}" style="background:#fde68a;color:#7a2e0e;border:none;border-radius:16px;padding:5px 10px;font-weight:700;cursor:pointer">${_vc.libre?'🚧 Ver su bloqueo':'🏁 Ver su tablero'}</button>`:''}<button onclick="vcSalir()" style="background:#fff;color:#7a2e0e;border:none;border-radius:16px;padding:5px 12px;font-weight:700;cursor:pointer">Salir</button>`;
}
function vcBloqueos(){ if(!_vc) return; _vc.libre=!_vc.libre; vcBanner(); if(_vc.libre){ openGestion('tablero'); } else { if(typeof cmIrBloqueo==='function') cmIrBloqueo(); } }
let _vcAvisado=0;
function vcAviso(){ const t=Date.now(); if(t-_vcAvisado>2500){ _vcAvisado=t; showToast('👁 Vista de comercial: no se guarda nada. Salí de la vista para cargar datos.', 3500); } }
(function(){
  // El comercial se identifica por su nombre de sesión: en la vista, el elegido.
  // En modo libre no hay bloqueos; _vcBloqueoReal dice cuál le aparecería a él.
  const _bq=cmBloqueo; window._vcBloqueoReal=function(){ return _bq(); }; cmBloqueo=function(){ if(_vc && _vc.libre) return ''; return _bq.apply(this,arguments); };
  const _mn=miNombre; miNombre=function(){ return _vc ? _vc.nombre : _mn.apply(this,arguments); };
  // Nada se escribe mientras se mira: ni en el equipo ni en la nube.
  const _sa=setArr; setArr=function(k,a){ if(_vc){ vcAviso(); return; } return _sa.apply(this,arguments); };
  const _cp=cloudPush; cloudPush=async function(){ if(_vc) return; return _cp.apply(this,arguments); };
  const _cd=cloudDelete; cloudDelete=async function(){ if(_vc) return; return _cd.apply(this,arguments); };
})();
