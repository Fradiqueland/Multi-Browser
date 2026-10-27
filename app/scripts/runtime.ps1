$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'runtime-checks.ps1')
$appRoot=Split-Path -Parent $PSScriptRoot
$runtime=Join-Path $appRoot '.runtime\electron'
$electron=Join-Path $runtime 'electron.exe'
if (-not (Test-Path -LiteralPath $electron)) {
 if(Test-Path -LiteralPath $runtime){throw 'A pasta Electron existente esta incompleta e foi preservada.'}
 $version='44.9.3'
 $archiveName="electron-v$version-win32-x64.zip"
 $cache=Join-Path $env:LOCALAPPDATA 'electron\Cache'
 $cached=Get-ChildItem -LiteralPath $cache -Filter $archiveName -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
 if (-not $cached) { $cache=Join-Path $env:USERPROFILE 'AppData\Local\electron\Cache'; $cached=Get-ChildItem -LiteralPath $cache -Filter $archiveName -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 }
 $base="https://github.com/electron/electron/releases/download/v$version"
 $sums=(Invoke-WebRequest -Uri "$base/SHASUMS256.txt" -UseBasicParsing -TimeoutSec 120).Content
 if($sums -is [byte[]]){$sums=[Text.Encoding]::UTF8.GetString($sums)}
 $expected=Get-RuntimeChecksum $sums $archiveName
 if ($cached) { $zip=$cached.FullName }
 else {
  $download=Join-Path $appRoot '.runtime\downloads'
  New-Item -ItemType Directory -Path $download -Force | Out-Null
  $zip=Join-Path $download $archiveName
  if(-not(Test-Path -LiteralPath $zip)){Invoke-WebRequest -Uri "$base/$archiveName" -OutFile $zip -UseBasicParsing -TimeoutSec 900}
 }
 Assert-RuntimeArchive $zip $expected
 $stage=Join-Path $appRoot ('.runtime\electron-stage-'+[guid]::NewGuid().ToString('N'))
 New-Item -ItemType Directory -Path $stage -Force | Out-Null
 Expand-Archive -LiteralPath $zip -DestinationPath $stage
 if(-not(Test-Path -LiteralPath (Join-Path $stage 'electron.exe'))){throw 'Executavel Electron ausente. A extracao foi preservada para diagnostico.'}
 $allowed=[IO.Path]::GetFullPath((Join-Path $appRoot '.runtime'))+[IO.Path]::DirectorySeparatorChar
 foreach($target in @($stage,$runtime)){if(-not([IO.Path]::GetFullPath($target).StartsWith($allowed,[StringComparison]::OrdinalIgnoreCase))){throw 'Destino Electron fora da pasta de motores.'}}
 Move-Item -LiteralPath $stage -Destination $runtime
}
Write-Output $electron

