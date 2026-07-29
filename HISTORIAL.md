# BioInnova — App del sistema · Documentación e historial

App de gestión para **BioInnova SA** (nutrición de ganado de corte): visitas técnicas + informes, CRM, planta (OT, formulaciones, inventario), caja chica y rendición de viáticos. Es una **web app de un solo archivo** (`index.html`) que funciona como PWA (se instala en el celular) y sincroniza en la nube (Supabase), con funcionamiento offline.

_Última actualización de este documento: 2026-07-29._

---

## 1. Dónde está todo (para respaldar)

### Archivos del sistema (el "programa")
Carpeta: **`C:\Users\HP\Desktop\bioinnova-repo\`**

| Archivo | Qué es |
|---|---|
| `index.html` | **Toda la app** (interfaz + lógica). Es el archivo principal. |
| `sw.js` | Service worker (hace que la app funcione offline y se actualice sola). |
| `manifest.webmanifest` | Config para instalar como app en el celular. |
| `logo.jpg` | Logo oficial de BioInnova. |
| `icon.svg`, `logo.svg` | Íconos. |
| `HISTORIAL.md` | Este documento. |
| `sql/` | Los scripts SQL de las tablas de la base (por si hay que recrear la base). |

### En la nube
- **Código (GitHub):** repositorio `duncan-sys/bioinnova` — https://github.com/duncan-sys/bioinnova
- **App en vivo (para el equipo):** https://duncan-sys.github.io/bioinnova/
- **Base de datos (Supabase):** proyecto `mnuldrgynighabwtulkf` — https://mnuldrgynighabwtulkf.supabase.co

### ⚠️ Importante: los DATOS no están en estos archivos
Los archivos de arriba son el **programa**. Los **datos** (clientes, órdenes de trabajo, inventario, caja, viáticos, etc.) viven en **Supabase (la nube)**. Un backup de la carpeta respalda el **programa**; para respaldar los **datos** hay que exportarlos desde Supabase (ver punto 3).

---

## 2. Cómo respaldar el PROGRAMA

Tres formas (cualquiera sirve):

1. **Copiar la carpeta** `C:\Users\HP\Desktop\bioinnova-repo\` a un pendrive / disco externo / OneDrive.
2. **ZIP con fecha:** ya se generó uno en `C:\Users\HP\Desktop\bioinnova-backups\`. Para hacer otro cuando quieras, en PowerShell:
   ```powershell
   $f = 'C:\Users\HP\Desktop\bioinnova-backups\bioinnova-' + (Get-Date -Format 'yyyy-MM-dd') + '.zip'
   Compress-Archive -Path 'C:\Users\HP\Desktop\bioinnova-repo\*' -DestinationPath $f -Force
   ```
3. **GitHub** ya es un respaldo permanente: cada cambio quedó guardado ahí con su fecha (ver historial abajo).

---

## 3. Cómo respaldar los DATOS (Supabase)

Entrar a https://supabase.com → proyecto BioInnova → **Table Editor** → cada tabla → botón **Export** (CSV), o desde **SQL Editor** con `select * from <tabla>`.

Tablas con datos:
`clientes`, `estancias`, `visitas`, `perfiles`, `bio_ot`, `bio_mov`, `bio_caja`, `bio_viat`, `bio_insumos`.

---

## 4. Módulos del sistema (estado actual)

- **📋 Visitas técnicas** — carga de KPIs por categoría/lote e **informe ejecutivo PDF**; costo/beneficio en Terminación.
- **🏡 Clientes** — fichas (RUC, código SAP, contacto, dirección) + estancias + hato/lotes. **351 clientes** cargados.
- **🗂️ Historial** — todas las visitas, separadas por técnico.
- **🤝 CRM** — etapa (Prospecto→…→Perdido), próximo contacto, seguimientos; tablero con pendientes.
- **🏭 Órdenes de Trabajo** — elegís producto → calcula insumos y bolsas → imprime OT; secuestrante Zeolítica opcional.
- **🧪 Formulaciones** — recetas de los productos.
- **📦 Inventario** — stock de insumos por movimientos; el gerente puede cargar insumos nuevos; se descuenta al producir una OT.
- **💵 Caja chica** — ingresos/egresos de planta con comprobante y resumen.
- **🧾 Viáticos** — el gerente carga el anticipo; cada comercial ve solo el suyo, agrega gastos e imprime.
- **👥 Usuarios** — alta, roles y **accesos manuales** por usuario.

### Roles y accesos
| Módulo | Gerente | Comercial | Supervisor | Planta | Lectura |
|---|---|---|---|---|---|
| Visitas / Clientes / Historial / CRM | ✅ | ✅ | — | — | 👁 (menos Visitas) |
| Viáticos | ✅ | ✅ (solo el suyo) | — | — | — |
| OT / Formulaciones | ✅ | — | ✅ | — | — |
| Inventario / Caja chica | ✅ | — | ✅ | ✅ | — |
| Usuarios | ✅ | — | — | — | — |

El gerente puede además dar/quitar módulos puntuales a cada usuario en **Usuarios → ⚙ Accesos manuales**.

---

## 5. SQL de las tablas (en `sql/`)

Si hubiera que recrear la base, correr estos scripts en Supabase → SQL Editor. **Pendientes de correr** (marcados): 
- `bioinnova_bio_insumos.sql` — ⚠ pendiente
- `bioinnova_perfiles_accesos.sql` — ⚠ pendiente
- El resto ya están creadas.

---

## 6. Historial de versiones

| Fecha | Cambio |
|---|---|
| 2026-07-29 | Confi 4 SL y CL (25kg) como productos en la OT; Terminación 4 pasa a 40kg |
| 2026-07-28 | Viáticos: el gerente carga el anticipo, el comercial ve solo el suyo |
| 2026-07-28 | Accesos manuales por usuario (override del rol) |
| 2026-07-28 | Inventario: alta de insumos por el gerente (sincronizada) |
| 2026-07-28 | Matriz de permisos por rol + rol Supervisor de planta |
| 2026-07-28 | OT: secuestrante opcional (Zeolítica) por encima de la fórmula |
| 2026-07-28 | Cambiar contraseña desde la app |
| 2026-07-28 | Campo Código SAP en clientes + importación de 351 clientes |
| 2026-07-28 | CRM integrado con Clientes/Visitas |
| 2026-07-28 | Caja: Ferretería + categorías personalizadas que se recuerdan |
| 2026-07-28 | Módulo Rendición de viáticos (comerciales) |
| 2026-07-28 | Módulo Caja chica (efectivo de planta) |
| 2026-07-27 | Módulo Inventario (insumos y materia prima) |
| 2026-07-27 | Módulo Planta (Formulaciones + Órdenes de Trabajo) |
| 2026-07-27 | Costo/beneficio diario en Terminación (+ margen sobre costo del producto) |
| 2026-07-27 | Mejoras de visita y cliente (KPIs, productos, consumo, precio carne, RUC, historial) |
| 2026-07-27 | Fixes de sincronización (borrados no reaparecen; token se renueva solo; auto-actualización) |
| 2026-07-27 | Cargar estancias desde el formulario del cliente |
| 2026-07-27 | Logo oficial + visita multi-categoría/lote + sincronización en la nube |
| 2026-07-25 | Login (email+contraseña) y roles + Supabase conectado |
| 2026-07-25 | Marca (wordmark), lotes por categoría, flujo guiado + PWA offline |
| 2026-07-25 | **v1** — visitas técnicas: clientes/estancias, visita con KPIs e informe PDF |

> El historial completo y exacto (con códigos de cada cambio) está en GitHub:
> https://github.com/duncan-sys/bioinnova/commits/main
