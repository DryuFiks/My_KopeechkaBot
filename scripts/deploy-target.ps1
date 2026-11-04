# Общее для deploy.ps1 и rollback.ps1 (MKB-046): адрес сервера и SSH-ключ.
# Берутся из параметров, иначе из локального DEPLOY.local.md (в git его нет — репозиторий публичный).

function Get-DeployTarget([string]$Server, [string]$Key) {
  $local = Join-Path (Split-Path $PSScriptRoot -Parent) "DEPLOY.local.md"
  if ((-not $Server -or -not $Key) -and (Test-Path $local)) {
    $text = Get-Content $local -Raw -Encoding UTF8
    if (-not $Server -and $text -match '\|\s*`<SERVER_IP>`\s*\|\s*`([^`]+)`') { $Server = $Matches[1] }
    if (-not $Key -and $text -match '\|\s*`<SSH_KEY>`\s*\|\s*`([^`]+)`') { $Key = $Matches[1] }
  }
  if (-not $Server -or -not $Key) {
    throw "Не заданы сервер и ключ: передайте -Server и -Key или заполните DEPLOY.local.md"
  }
  if (-not (Test-Path $Key)) { throw "SSH-ключ не найден: $Key" }
  return @{ Host = "ubuntu@$Server"; Key = $Key }
}

# Нативные команды не останавливают скрипт сами по себе ($ErrorActionPreference их не касается).
function Invoke-Native([string]$Exe, [string[]]$Arguments) {
  & $Exe @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Exe $($Arguments -join ' ') — код выхода $LASTEXITCODE" }
}
