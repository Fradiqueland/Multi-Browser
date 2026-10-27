"""Refresh Mac artwork and shared sources without changing native runtime binaries."""
from pathlib import Path
import hashlib,importlib.util,json,os,plistlib,shutil,stat,subprocess,zipfile
ROOT=Path(__file__).resolve().parents[1]
VERSION=json.loads((ROOT/'package.json').read_text())['version']
SOURCE_VERSION='0.21.1'
SOURCE=ROOT/'dist'/f'Multi-Browser-{SOURCE_VERSION}-Mac-Portable.zip'
OLD=ROOT/'.cache'/f'mac-refresh-base-{SOURCE_VERSION}'/'Mac-Portable'
DEST=ROOT/'dist'/VERSION/'Mac-Portable'
OUTPUT=ROOT/'dist'/f'Multi-Browser-{VERSION}-Mac-Portable.zip'
spec=importlib.util.spec_from_file_location('portable',ROOT/'scripts/build-macos-portable.py')
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
def main():
    if base.base.digest(SOURCE)!='28a0e8121e457127add9f354a83c7edfdc5b35177d616e8e86c84fbb9a37067d':
        raise ValueError('Original Mac package changed')
    if DEST.exists() or OUTPUT.exists():raise FileExistsError('Existing Mac delivery preserved')
    if not OLD.exists():
        print('Restoring verified Mac base with native symbolic links...',flush=True)
        subprocess.run(['powershell.exe','-NoProfile','-File',str(ROOT/'scripts/extract-macos-portable.ps1'),'-ArchivePath',str(SOURCE),'-Destination',str(OLD)],check=True)
    print('Copying Mac bundle, preserving symlinks...',flush=True)
    shutil.copytree(OLD,DEST,symlinks=True)
    overlay={}
    entries=json.loads((OLD/'mac-portable-metadata.json').read_text(encoding='utf-8'))['entries']
    by_path={e['path']:e for e in entries}
    def replace(relative,data,mode=0o100644):
        target=DEST/relative;target.parent.mkdir(parents=True,exist_ok=True)
        target.write_bytes(data)
        by_path[relative]=dict(path=relative,mode=mode,kind='file',bytes=len(data),sha256=hashlib.sha256(data).hexdigest())
        overlay['Mac-Portable/'+relative]={'File':str(target),'Mode':mode}
    outer='Multi-Browser.app/Contents/'
    app_roots=[outer]+[outer+'Resources/runtimes/'+arch+'/Multi-Browser.app/Contents/' for arch in ('x64','arm64')]
    for app in app_roots:
        settings=plistlib.loads((DEST/(app+'Info.plist')).read_bytes())
        settings.update(CFBundleIconFile='app-icon.icns',CFBundleVersion=VERSION,CFBundleShortVersionString=VERSION)
        replace(app+'Info.plist',plistlib.dumps(settings))
        replace(app+'Resources/app-icon.icns',(ROOT/'ui/assets/app-icon.icns').read_bytes())
    sources=sorted(p for folder in ('src','ui') for p in (ROOT/folder).rglob('*') if p.is_file())+[ROOT/'package.json']
    for app in app_roots[1:]:
        for file in sources:
            replace(app+'Resources/app/'+file.relative_to(ROOT).as_posix(),file.read_bytes())
    entries=sorted(by_path.values(),key=lambda item:item['path'])
    metadata=json.loads((OLD/'mac-portable-metadata.json').read_text(encoding='utf-8'))
    metadata.update(version=VERSION,entries=entries,sourceZipSHA256=base.base.digest(SOURCE),
                    artwork='app-icon.icns',sharedSourcesUpdated=True)
    for name,data,mode in [
        ('mac-portable-metadata.json',(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n').encode(),0o100644),
        ('LEIA-ME.txt',(OLD/'LEIA-ME.txt').read_text(encoding='utf-8').replace(SOURCE_VERSION,VERSION).encode(),0o100644),
        ('Restaurar-permissoes-Mac.command',base.restore_script(entries).encode(),0o100755)]:
        file=DEST/name;file.write_bytes(data);overlay['Mac-Portable/'+name]={'File':str(file),'Mode':mode}
    cache=ROOT/'.cache/windows-single-file'
    mapping=cache/'mac-artwork-overlay.json';mapping.write_text(json.dumps(overlay),encoding='utf-8')
    go_root=ROOT/'.cache/dmg-toolchain/go'
    env=dict(os.environ,GOROOT=str(go_root),GOCACHE=str(ROOT/'.cache/dmg-toolchain/go-build'),GOPATH=str(ROOT/'.cache/dmg-toolchain/gopath'),GOTOOLCHAIN='local',CGO_ENABLED='0')
    tool=cache/'mac-artwork-zip.exe'
    subprocess.run([str(go_root/'bin/go.exe'),'build','-trimpath','-o',str(tool),str(ROOT/'scripts/mac-artwork-zip.go')],env=env,check=True)
    print('Updating ZIP while retaining original compressed runtime files...',flush=True)
    subprocess.run([str(tool),str(SOURCE),str(OUTPUT),str(mapping)],check=True)
    report=base.verify_delivery(DEST,OUTPUT,ROOT/'.cache/mac-launcher-universal',entries,{'sha256':base.base.digest(SOURCE)},VERSION)
    report.update(iconSource='ui/assets/app-icon.png',nativeRuntimeBytesUnchanged=True,sharedSourcesUpdated=True)
    (ROOT/'reference'/f'mac-portable-{VERSION}.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print('MAC_ARTWORK_OK',flush=True)
if __name__=='__main__':main()
