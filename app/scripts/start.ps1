$ErrorActionPreference='Stop'
$appRoot=Split-Path -Parent $PSScriptRoot
$runtime=& (Join-Path $PSScriptRoot 'runtime.ps1')
Start-Process -FilePath $runtime -ArgumentList ('"'+$appRoot+'"') -WorkingDirectory $appRoot -WindowStyle Hidden | Out-Null

