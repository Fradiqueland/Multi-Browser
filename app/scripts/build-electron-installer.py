"""Build a genuine NSIS Setup.exe containing the complete Electron/Chromium app."""
import argparse,hashlib,json,subprocess,uuid,zipfile
from pathlib import Path,PurePosixPath
ROOT=Path(__file__).resolve().parents[1]
VERSION=json.loads((ROOT/'package.json').read_text())['version']
WORK=ROOT/'.cache/electron-installer'

def digest(path):
 h=hashlib.sha256()
 with Path(path).open('rb') as stream:
  for chunk in iter(lambda:stream.read(8*1024*1024),b''):h.update(chunk)
 return h.hexdigest()

def quoted(value):
 value=str(value)
 if any(char in value for char in ['\n','\r','"']):raise ValueError('Invalid installer path')
 return '"'+value.replace('$','$$')+'"'

def payload_include(entries,stage,output):
 lines=['!macro MB_INSTALL_FILES'];previous=None
 for item in entries:
  relative=item['Path'];folder=str(PurePosixPath(relative).parent)
  if folder!=previous:
   suffix='' if folder=='.' else '\\'+folder.replace('/','\\')
   lines.append('SetOutPath "$INSTDIR'+suffix+'"');previous=folder
  lines.append('File '+quoted(stage.joinpath(*PurePosixPath(relative).parts)))
 lines+=['!macroend','!macro MB_REMOVE_FILES']
 lines+=['Delete "$INSTDIR\\'+item['Path'].replace('/','\\')+'"' for item in entries]
 lines+=['!macroend','!macro MB_REMOVE_EMPTY_DIRECTORIES']
 folders=set()
 for item in entries:
  parent=PurePosixPath(item['Path']).parent
  while str(parent)!='.':folders.add(str(parent));parent=parent.parent
 lines+=['RMDir "$INSTDIR\\'+folder.replace('/','\\')+'"' for folder in sorted(folders,key=lambda p:len(p.split('/')),reverse=True)]
 lines+=['!macroend'];output.write_text('\n'.join(lines)+'\n',encoding='utf-8-sig')

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--compiler',type=Path);args=parser.parse_args()
 compiler=args.compiler or WORK/'nsis-3.13/Bin/makensis.exe'
 source=ROOT/'dist'/f'Multi-Browser-{VERSION}-Windows-Portable.exe'
 report=ROOT/'reference'/f'windows-single-file-{VERSION}.json'
 proof=json.loads(report.read_text()) if report.exists() else json.loads((ROOT/'scripts/windows-installer-base.json').read_text())[VERSION]
 if digest(source)!=proof['sha256']:raise ValueError('Original application checksum mismatch')
 output=ROOT/'dist'/f'Multi-Browser-{VERSION}-Windows-Setup.exe'
 if output.exists():raise FileExistsError('Existing EXE installer preserved')
 stage=WORK/'payload';stage.mkdir(parents=True,exist_ok=True)
 print('Preparing complete Electron and Chromium installation files...',flush=True)
 with zipfile.ZipFile(source) as archive:
  manifest=json.loads(archive.read('single-file-manifest.json'))
  if manifest['Version']!=VERSION:raise ValueError('Application version mismatch')
  for item in manifest['Files']:
   name=item['Path'];parts=PurePosixPath(name).parts
   if name.startswith('/') or '..' in parts or '\\' in name or ':' in name or parts[0].lower()=='data':raise ValueError('Unsafe application payload')
   file=stage.joinpath(*parts);file.parent.mkdir(parents=True,exist_ok=True)
   if not file.exists():
    with archive.open(name) as incoming,file.open('xb') as outgoing:
     while chunk:=incoming.read(1024*1024):outgoing.write(chunk)
   if file.stat().st_size!=item['Size'] or digest(file)!=item['SHA256']:raise ValueError('Application file changed: '+name)
 entries=manifest['Files'];include=WORK/'payload.nsh';payload_include(entries,stage,include)
 base=[str(compiler),'/V3','/INPUTCHARSET','UTF8','/DMB_VERSION='+VERSION,'/DMB_ICON='+str(ROOT/'ui/assets/app-icon.ico'),'/DMB_SIZE_KB='+str(sum(item['Size'] for item in entries)//1024)]
 print('Building branded NSIS Setup.exe...',flush=True)
 subprocess.run(base+['/DMB_PAYLOAD_INCLUDE='+str(include),'/DMB_OUTPUT='+str(output),str(ROOT/'scripts/windows-installer-nsis.nsi')],check=True,timeout=300)
 # Same installer/uninstaller instructions, with a tiny payload and isolated
 # shortcuts/registry, so native testing cannot affect the user's real app.
 fixture=WORK/'test-payload';fixture.mkdir(exist_ok=True);(fixture/'Multi-Browser.exe').write_bytes(b'controlled installer fixture; never launched')
 fake=[{'Path':'Multi-Browser.exe'}];test_include=WORK/'test-payload.nsh';payload_include(fake,fixture,test_include)
 test_exe=WORK/'Test-Setup.exe';test_id=uuid.uuid4().hex
 subprocess.run(base+['/DMB_TEST=1','/DMB_TEST_ID='+test_id,'/DMB_PAYLOAD_INCLUDE='+str(test_include),'/DMB_OUTPUT='+str(test_exe),str(ROOT/'scripts/windows-installer-nsis.nsi')],check=True,timeout=30)
 result=dict(version=VERSION,file=str(output),bytes=output.stat().st_size,sha256=digest(output),format='NSIS Setup.exe',application='Electron with bundled full Chromium',applicationArchitecture='x64',installerArchitecture='x86-unicode',frameworkVersion='3.13',scope='current-user',defaultDirectory=r'%LOCALAPPDATA%\Programs\Multi-Browser',desktopShortcut=True,startMenuShortcut=True,uninstallEntry=True,externalRuntimesRequired=False,requiresWindowsInstallerService=False,payloadFiles=len(entries),dataPreservedOnUpdate=True,dataPreservedOnUninstall=True,uninstallUsesRecursiveDelete=False,sourcePortableSHA256=proof['sha256'],signed=False,nativeExecutionTestPending=True,testSetup=str(test_exe),testId=test_id)
 (ROOT/'reference').mkdir(exist_ok=True);(ROOT/'reference'/f'electron-installer-{VERSION}.json').write_text(json.dumps(result,indent=2))
 print('ELECTRON_NSIS_SETUP_BUILT '+str(output),flush=True)
if __name__=='__main__':main()
