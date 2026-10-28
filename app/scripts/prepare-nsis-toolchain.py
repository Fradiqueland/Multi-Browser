"""Prepare build-only NSIS. Compile an x64 host tool if the environment cannot run x86 tools."""
import hashlib,json,os,shutil,subprocess,sys,tarfile,urllib.request,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'.cache/electron-installer'
PINNED={
 'nsis-3.13.zip':('https://downloads.sourceforge.net/project/nsis/NSIS%203/3.13/nsis-3.13.zip','ba63dffc4410ee89193e1cb5a41989991bd77c61068da17e3156d136b7b0b3d8'),
 'nsis-3.13-src.tar.bz2':('https://downloads.sourceforge.net/project/nsis/NSIS%203/3.13/nsis-3.13-src.tar.bz2','a8ffe024602d46b6d766f9e1ce30c324ad2a24daeacd3efc2642d436a0c157ac'),
 'zlib.tar.gz':('https://zlib.net/zlib-1.3.2.tar.gz','bb329a0a2cd0274d05519d61c667c062e06990d72e125ee2dfa8de64f0119d16'),
}

def fetch(name):
 url,expected=PINNED[name];file=WORK/name
 if not file.exists():urllib.request.urlretrieve(url,file)
 if hashlib.sha256(file.read_bytes()).hexdigest()!=expected:raise ValueError('Build tool checksum mismatch: '+name)
 return file
def extract_zip(file,destination):
 with zipfile.ZipFile(file) as archive:
  for item in archive.infolist():
   if item.filename.startswith('/') or '..' in item.filename.split('/') or ':' in item.filename or '\\' in item.filename:raise ValueError('Unsafe build tool path')
  archive.extractall(destination)

def main():
 WORK.mkdir(parents=True,exist_ok=True);sdk=WORK/'nsis-3.13';compiler=sdk/'Bin/makensis.exe'
 if not compiler.exists():extract_zip(fetch('nsis-3.13.zip'),WORK)
 try:
  probe=subprocess.run([str(compiler),'/VERSION'],capture_output=True,text=True,timeout=10)
  if probe.returncode==0 and probe.stdout.strip()=='v3.13':print('NSIS_TOOLCHAIN_READY '+str(compiler));return
 except OSError:pass
 print('Preparing native x64 build-only compiler; installed application is unchanged.',flush=True)
 for name in ['nsis-3.13-src.tar.bz2','zlib.tar.gz']:
  with tarfile.open(fetch(name)) as archive:archive.extractall(WORK,filter='data')
 with urllib.request.urlopen('https://pypi.org/pypi/scons/4.10.1/json',timeout=30) as response:metadata=json.load(response)
 wheel=next(item for item in metadata['urls'] if item['filename'].endswith('.whl'));file=WORK/wheel['filename']
 if not file.exists():urllib.request.urlretrieve(wheel['url'],file)
 if hashlib.sha256(file.read_bytes()).hexdigest()!='bd9d1c52f908d874eba92a8c0c0a8dcf2ed9f3b88ab956d0fce1da479c4e7126':raise ValueError('SCons checksum mismatch')
 extract_zip(file,WORK/'python-tools')
 vs=Path(os.environ.get('ProgramFiles','C:/Program Files'))/'Microsoft Visual Studio'
 candidates=[p for p in vs.glob('*/*/VC/Tools/MSVC/*') if (p/'bin/Hostx64/x64/cl.exe').is_file()]
 if not candidates:raise FileNotFoundError('Native build fallback requires Visual C++ x64 Build Tools')
 vc=max(candidates,key=lambda p:tuple(int(value) for value in p.name.split('.')))
 sdk_root=Path(os.environ.get('ProgramFiles(x86)','C:/Program Files (x86)'))/'Windows Kits/10'
 versions=[p.name for p in (sdk_root/'Lib').iterdir() if (p/'um/x64/kernel32.lib').is_file()];version=max(versions,key=lambda p:tuple(int(v) for v in p.split('.')))
 binary=vc/'bin/Hostx64/x64';env=dict(os.environ)
 env['PATH']=str(binary)+';'+str(sdk_root/'bin'/version/'x64')+';'+env['PATH']
 env['INCLUDE']=';'.join(str(p) for p in [vc/'include',sdk_root/'Include'/version/'ucrt',sdk_root/'Include'/version/'shared',sdk_root/'Include'/version/'um',sdk_root/'Include'/version/'winrt'])
 env['LIB']=';'.join(str(p) for p in [vc/'lib/x64',sdk_root/'Lib'/version/'ucrt/x64',sdk_root/'Lib'/version/'um/x64']);env['PYTHONPATH']=str(WORK/'python-tools')
 subprocess.run([str(binary/'nmake.exe'),'/nologo','/f','win32/Makefile.msc'],cwd=WORK/'zlib-1.3.2',env=env,check=True,timeout=120)
 source=WORK/'nsis-3.13-src';config=source/'SConstruct';text=config.read_text()
 # Host compiler is x64; its default output uses the official x86-Unicode
 # installer stubs. This changes host build configuration, not installer code.
 original="sconf_h.write('#define NSIS_DEFAULT_TARGET_ARCH \"%s\"\\n' % defenv['TARGET_ARCH'])"
 if original not in text:raise ValueError('Unexpected NSIS build configuration')
 config.write_text(text.replace(original,"sconf_h.write('#define NSIS_DEFAULT_TARGET_ARCH \"x86\"\\n')"))
 args=[sys.executable,'-m','SCons','-j4','TOOLSET=zip','MSTOOLKIT=yes','MSVC_USE_SCRIPT=None','MSVS_VERSION=10.0','VERSION=3.13','VER_MAJOR=3','VER_MINOR=13','TARGET_ARCH=amd64','ZLIB_W32='+str(WORK/'zlib-1.3.2'),'SKIPSTUBS=all','SKIPPLUGINS=all','SKIPUTILS=all','SKIPMISC=all','NSIS_CONFIG_CONST_DATA_PATH=no','PREFIX='+str(sdk),'install-compiler']
 subprocess.run(args,cwd=source,env=env,check=True,timeout=240);shutil.copy2(WORK/'zlib-1.3.2/zlib1.dll',sdk/'Bin/zlib1.dll')
 result=subprocess.run([str(compiler),'/VERSION'],capture_output=True,text=True,check=True,timeout=10)
 if result.stdout.strip()!='v3.13':raise ValueError('Unexpected compiler version')
 print('NSIS_TOOLCHAIN_READY '+str(compiler),flush=True)
if __name__=='__main__':main()
