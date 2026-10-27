$ErrorActionPreference='Stop'
$appRoot=Split-Path -Parent $PSScriptRoot
$runtime=& (Join-Path $PSScriptRoot 'runtime.ps1')
. (Join-Path $PSScriptRoot 'desktop-check.ps1')
$previousData=$env:MULTIBROWSER_DATA
Push-Location -LiteralPath $appRoot
try {
 $fixture=Join-Path $appRoot 'tests\rea-ui'
 $interface=Invoke-DesktopCheck ('"'+$fixture+'" --context-suite --ui-test-exit --native-ui-tests') 'ui-checks\ui-result.json' 'Menus de contexto, edicao e ligacoes'
 Write-Host "MULTIBROWSER_CONTEXT_OK: $($interface.tests.Count) verificacoes." -ForegroundColor Green
} finally {$env:MULTIBROWSER_DATA=$previousData;Pop-Location}
