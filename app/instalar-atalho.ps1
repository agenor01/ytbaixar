# Cria atalhos "ytbaixar" na Área de Trabalho e no Menu Iniciar que abrem o app de PC.
$root = Split-Path -Parent $PSScriptRoot
$ws = New-Object -ComObject WScript.Shell
$targets = @(
  [Environment]::GetFolderPath('Desktop'),
  [Environment]::GetFolderPath('Programs')
)
foreach ($dir in $targets) {
  $lnk = $ws.CreateShortcut((Join-Path $dir 'ytbaixar.lnk'))
  $lnk.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
  $lnk.Arguments = '"' + (Join-Path $PSScriptRoot 'ytbaixar.vbs') + '"'
  $lnk.WorkingDirectory = $root
  $lnk.IconLocation = Join-Path $PSScriptRoot 'ytbaixar.ico'
  $lnk.Description = 'Baixar videos do YouTube e YouTube Music'
  $lnk.Save()
  Write-Output "Atalho criado em $dir"
}
