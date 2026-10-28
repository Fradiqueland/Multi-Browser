"""Prepare pinned build-only WiX packages; end users only need Windows Installer."""
import hashlib,json,urllib.request,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PACKAGES={
 'wix':'13caed0aa86898c9952eb8ba82c6ac6b43d1575bb731ac848e5edf5490a10428',
 'wixtoolset.ui.wixext':'5a9b12517290ca6fe8ba4280845291e31964dd2a2dd671aacebd2faa10c04a95',
}
VERSION='6.0.2'

def main():
 root=ROOT/'.cache/windows-installer/wix';root.mkdir(parents=True,exist_ok=True)
 for package,sha in PACKAGES.items():
  archive=root/(package+'.'+VERSION+'.nupkg')
  if not archive.exists():
   print('Downloading build-only '+package+' '+VERSION,flush=True)
   urllib.request.urlretrieve('https://api.nuget.org/v3-flatcontainer/'+package+'/'+VERSION+'/'+archive.name,archive)
  if hashlib.sha256(archive.read_bytes()).hexdigest()!=sha:raise ValueError('Build dependency checksum mismatch: '+package)
  dest=root/(package+'-'+VERSION)
  if not dest.exists():
   with zipfile.ZipFile(archive) as source:
    for info in source.infolist():
     if info.filename.startswith('/') or '\\' in info.filename or '..' in info.filename.split('/') or ':' in info.filename:raise ValueError('Unsafe build dependency path')
    source.extractall(dest)
 print('WINDOWS_INSTALLER_TOOLS_READY',flush=True)
if __name__=='__main__':main()
