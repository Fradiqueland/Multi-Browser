$ErrorActionPreference='Stop'
$appRoot=Split-Path -Parent $PSScriptRoot
. (Join-Path $appRoot 'scripts/runtime-checks.ps1')
$run=Join-Path $appRoot ('test-results/runtime-'+[guid]::NewGuid().ToString('N'));New-Item -ItemType Directory -Path $run | Out-Null
$checks=@();function Pass([string]$Name,[bool]$Value){if(-not $Value){throw $Name};$script:checks+=@{name=$Name;ok=$true}}
$name='electron-v44.9.3-win32-x64.zip';$hash='a'*64
Pass 'Formato binario com asterisco' ((Get-RuntimeChecksum ($hash+' *'+$name) $name) -eq $hash)
Pass 'Formato textual com espacos e BOM' ((Get-RuntimeChecksum ([string][char]0xFEFF+$hash+'  '+$name+[Environment]::NewLine) $name) -eq $hash)
foreach($bad in @(($hash+' *other.zip'),($hash+' *'+$name+[Environment]::NewLine+$hash+'  '+$name))){$rejected=$false;try{Get-RuntimeChecksum $bad $name | Out-Null}catch{$rejected=$true};Pass 'Checksum ausente ou duplicado recusado' $rejected}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$cache=Join-Path $run 'local/electron/Cache';New-Item -ItemType Directory -Path $cache -Force | Out-Null
$archive=Join-Path $cache $name;$zip=[IO.Compression.ZipFile]::Open($archive,'Create');try{$entry=$zip.CreateEntry('electron.exe');$writer=[IO.StreamWriter]::new($entry.Open());$writer.Write('inert-runtime-fixture-never-executed');$writer.Dispose()}finally{$zip.Dispose()}
$expected=(Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash
Assert-RuntimeArchive $archive $expected;Pass 'Cache valido conferido antes de extrair' $true
$rejected=$false;try{Assert-RuntimeArchive $archive $hash}catch{$rejected=$true};Pass 'Cache adulterado recusado' $rejected
$unsafe=Join-Path $run 'unsafe.zip';$zip=[IO.Compression.ZipFile]::Open($unsafe,'Create');try{[void]$zip.CreateEntry('../outside.exe')}finally{$zip.Dispose()}
$rejected=$false;try{Assert-RuntimeArchive $unsafe (Get-FileHash -LiteralPath $unsafe -Algorithm SHA256).Hash}catch{$rejected=$true};Pass 'Caminhos fora da extracao recusados' $rejected
$fixture=Join-Path $run 'app/scripts';New-Item -ItemType Directory -Path $fixture -Force | Out-Null
foreach($file in @('runtime.ps1','runtime-checks.ps1')){Copy-Item -LiteralPath (Join-Path $appRoot ('scripts/'+$file)) -Destination $fixture}
$previousLocal=$env:LOCALAPPDATA
function Invoke-WebRequest {param($Uri,[switch]$UseBasicParsing,$TimeoutSec) if(-not $Uri.EndsWith('/SHASUMS256.txt')){throw 'Unexpected fixture download'};$fixtureName='electron-v44.9.3-win32-x64.zip';$fixtureHash=(Get-FileHash -LiteralPath (Join-Path $env:LOCALAPPDATA ('electron/Cache/'+$fixtureName)) -Algorithm SHA256).Hash;return @{Content=[Text.Encoding]::UTF8.GetBytes($fixtureHash+' *'+$fixtureName)}}
try{$env:LOCALAPPDATA=Join-Path $run 'local';$result=& (Join-Path $fixture 'runtime.ps1');Pass 'Preparacao limpa usa cache verificado e publica executavel completo' ((Test-Path -LiteralPath $result) -and (Get-Content -LiteralPath $result -Raw) -eq 'inert-runtime-fixture-never-executed')}
finally{$env:LOCALAPPDATA=$previousLocal;Remove-Item Function:/Invoke-WebRequest}
@{ok=$true;tests=$checks;directory=$run} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $run 'runtime-result.json') -Encoding UTF8
Write-Output (Join-Path $run 'runtime-result.json')
