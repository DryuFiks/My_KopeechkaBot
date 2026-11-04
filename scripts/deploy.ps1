# Выкладка на прод (MKB-046), из корня репозитория:  .\scripts\deploy.ps1
# Сборка webapp и бота, npm run check, архив, загрузка, установка с сохранением предыдущей версии
# (откат — .\scripts\rollback.ps1). Миграции и бэкап перед ними — сами, если sql/ изменился.
param(
  [string]$Server,
  [string]$Key,
  # Выложить с незакоммиченными изменениями (по умолчанию нельзя: сервер и git должны совпадать).
  [switch]$AllowDirty
)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
. "$PSScriptRoot\deploy-target.ps1"
$target = Get-DeployTarget $Server $Key

if (-not $AllowDirty -and (git status --porcelain)) {
  throw "Есть незакоммиченные изменения. Закоммитьте их (на сервер уходит рабочая копия) или запустите с -AllowDirty."
}

if (-not (Test-Path "webapp\node_modules")) { Invoke-Native npm @("--prefix", "webapp", "ci") }
Invoke-Native npm @("--prefix", "webapp", "run", "build")
Invoke-Native npm @("run", "check")
Invoke-Native npm @("run", "build")

$release = "$(git rev-parse --short HEAD) $(git branch --show-current) $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
if (git status --porcelain) { $release += " (с незакоммиченными изменениями)" }
[IO.File]::WriteAllText((Join-Path (Get-Location) "RELEASE"), $release)

$archive = Join-Path $env:TEMP "kopeechka-app.tgz"
try {
  # Именно tar.exe из Windows: tar из Git Bash принимает «C:» в пути за адрес удалённого хоста.
  Invoke-Native "$env:SystemRoot\System32\tar.exe" @("-czf", $archive, "dist", "webapp/dist", "package.json", "package-lock.json", "sql", "RELEASE")
} finally {
  Remove-Item RELEASE -ErrorAction SilentlyContinue
}

Invoke-Native scp @("-i", $target.Key, $archive, "deploy/release/install-release.sh", "$($target.Host):/tmp/")
Remove-Item $archive
Invoke-Native ssh @("-i", $target.Key, $target.Host,
  "bash /tmp/install-release.sh /tmp/kopeechka-app.tgz; s=`$?; rm -f /tmp/kopeechka-app.tgz /tmp/install-release.sh; exit `$s")
Write-Host "Готово: $release"
