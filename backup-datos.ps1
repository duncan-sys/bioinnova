# ═══════════════════════════════════════════════════════════
#  BioInnova — Backup de DATOS (exporta las tablas de Supabase a CSV)
#  Uso: doble clic en backup-datos.bat  (o correr este .ps1)
#  Guarda los CSV en:  Escritorio\bioinnova-backups\datos-AAAA-MM-DD\
# ═══════════════════════════════════════════════════════════
$ErrorActionPreference = 'Stop'
$URL = 'https://mnuldrgynighabwtulkf.supabase.co'
$KEY = 'sb_publishable_uAH-nT2MczSB8m9F4THmdw_T6u77exI'   # clave publica (solo lectura via RLS) — segura
$TABLAS = @('clientes','estancias','visitas','perfiles','bio_ot','bio_mov','bio_caja','bio_viat','bio_insumos')

$fecha = Get-Date -Format 'yyyy-MM-dd'
$base  = if ($PSScriptRoot) { Split-Path $PSScriptRoot -Parent } else { [Environment]::GetFolderPath('Desktop') }
$destino = Join-Path $base "bioinnova-backups\datos-$fecha"
New-Item -ItemType Directory -Force -Path $destino | Out-Null

function Get-Tabla($tabla) {
  $todo = @(); $off = 0; $pag = 1000
  $h = @{ apikey = $KEY; Authorization = "Bearer $KEY" }
  while ($true) {
    $u = "$URL/rest/v1/$tabla`?select=*&limit=$pag&offset=$off"
    $resp = Invoke-WebRequest $u -Headers $h -UseBasicParsing -TimeoutSec 60
    $json = [System.Text.Encoding]::UTF8.GetString($resp.RawContentStream.ToArray())
    $arr = @($json | ConvertFrom-Json)
    $todo += $arr
    if ($arr.Count -lt $pag) { break }
    $off += $pag
  }
  return $todo
}

function Aplanar($filas) {
  # convierte los campos anidados (jsonb: listas/objetos) a texto JSON para que entren en el CSV
  $filas | ForEach-Object {
    $o = [ordered]@{}
    foreach ($p in $_.PSObject.Properties) {
      $v = $p.Value
      if ($null -ne $v -and ($v -is [array] -or $v -is [System.Management.Automation.PSCustomObject])) {
        $o[$p.Name] = ($v | ConvertTo-Json -Compress -Depth 15)
      } else { $o[$p.Name] = $v }
    }
    [PSCustomObject]$o
  }
}

Write-Host ""
Write-Host "Respaldando datos de BioInnova -> $destino" -ForegroundColor Cyan
Write-Host ""
$total = 0
foreach ($t in $TABLAS) {
  try {
    $filas = Get-Tabla $t
    $archivo = Join-Path $destino "$t.csv"
    if ($filas.Count -gt 0) {
      Aplanar $filas | Export-Csv -Path $archivo -NoTypeInformation -Encoding UTF8
    } else {
      # tabla vacia: dejar un CSV vacio para constancia
      "" | Out-File $archivo -Encoding UTF8
    }
    Write-Host ("  OK  {0,-14} {1,5} filas" -f $t, $filas.Count) -ForegroundColor Green
    $total += $filas.Count
  } catch {
    Write-Host ("  --  {0,-14} no se pudo (tabla inexistente o sin conexion)" -f $t) -ForegroundColor Yellow
  }
}
Write-Host ""
Write-Host "Listo. $total registros exportados a:" -ForegroundColor Cyan
Write-Host "  $destino"
Write-Host ""
try { Start-Process explorer.exe $destino } catch {}
Write-Host "Podes cerrar esta ventana."
Read-Host "Enter para salir"
