# Откат прода на предыдущий релиз (MKB-046), из корня репозитория:  .\scripts\rollback.ps1
# Хранится одна предыдущая версия; миграции БД не откатываются (они только добавляют).
param([string]$Server, [string]$Key)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
. "$PSScriptRoot\deploy-target.ps1"
$target = Get-DeployTarget $Server $Key

Invoke-Native scp @("-i", $target.Key, "deploy/release/rollback-release.sh", "$($target.Host):/tmp/")
Invoke-Native ssh @("-i", $target.Key, $target.Host,
  "bash /tmp/rollback-release.sh; s=`$?; rm -f /tmp/rollback-release.sh; exit `$s")
