function Get-RuntimeChecksum([string]$Text,[string]$ArchiveName){
 $escaped=[regex]::Escape($ArchiveName)
 $matchesFound=@($Text.TrimStart([char]0xFEFF) -split '\r?\n' | Where-Object {$_ -match ('^([a-fA-F0-9]{64})\s+\*?'+$escaped+'\s*$')})
 if($matchesFound.Count -ne 1){throw 'Checksum oficial do Electron ausente ou repetido.'}
 return ([regex]::Match($matchesFound[0],'^([a-fA-F0-9]{64})')).Groups[1].Value
}
function Assert-RuntimeArchive([string]$Archive,[string]$Expected){
 if((Get-FileHash -LiteralPath $Archive -Algorithm SHA256).Hash -ne $Expected){throw 'Checksum Electron incorreto. O arquivo foi preservado.'}
 Add-Type -AssemblyName System.IO.Compression.FileSystem
 $zip=[IO.Compression.ZipFile]::OpenRead($Archive)
 try{foreach($entry in $zip.Entries){$name=$entry.FullName.Replace('\','/');if($name.StartsWith('/') -or $name -match '(^|/)\.\.(/|$)|:|[\x00-\x1f]'){throw 'Caminho inesperado no arquivo Electron.'}}}finally{$zip.Dispose()}
}
