"""Rebuild portable releases from verified prior artifacts without reinstalling runtimes."""
import argparse,copy,hashlib,importlib.util,json,os,plistlib,shutil,stat,struct,subprocess,tempfile,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
VERSION=json.loads((ROOT/'package.json').read_text(encoding='utf-8'))['version']

def digest(path):
 h=hashlib.sha256()
 with Path(path).open('rb') as source:
  for chunk in iter(lambda:source.read(8*1024*1024),b''):h.update(chunk)
 return h.hexdigest()

def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);result=importlib.util.module_from_spec(spec);spec.loader.exec_module(result);return result

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--resume',action='store_true');parser.add_argument('--windows',type=Path);parser.add_argument('--mac',required=True,type=Path);args=parser.parse_args()
 config=json.loads((ROOT/'.cache/portable-go.json').read_text());tools=Path(config['work']);go=Path(config['goRoot'])
 if args.windows and not (go/'bin/go.exe').is_file():raise FileNotFoundError('Windows launcher rebuild requires the configured Go toolchain')
 tools.mkdir(parents=True,exist_ok=True)
 work=Path(tempfile.mkdtemp(prefix='source-update-',dir=tools))
 env=dict(os.environ,GOROOT=str(go),GOCACHE=str(tools/'go-build'),GOPATH=str(tools/'gopath'),GOTOOLCHAIN='local',CGO_ENABLED='0')
 tool=None
 if (go/'bin/go.exe').is_file():
  tool=work/'zip-overlay.exe';subprocess.run([str(go/'bin/go.exe'),'build','-trimpath','-o',str(tool),str(ROOT/'scripts/mac-artwork-zip.go')],env=env,check=True)
 overlay_dir=work/'overlays';overlay_dir.mkdir(exist_ok=True)
 sources=[p for folder in ['src','ui'] for p in (ROOT/folder).rglob('*') if p.is_file() and not p.is_symlink()]+[ROOT/'package.json']
 def packed_overlay(source,output,overlays):
  if tool:
   mapping=overlay_dir/(output.stem+'.json');mapping.write_text(json.dumps(overlays),encoding='utf-8')
   subprocess.run([str(tool),str(source),str(output),str(mapping)],check=True)
   return
  # Source-only Mac updates need no compiler. Preserve Unix modes and link
  # payloads directly in the ZIP, without extracting them on Windows.
  with zipfile.ZipFile(source) as previous,zipfile.ZipFile(output,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as result:
   seen=set()
   for original in previous.infolist():
    info=copy.copy(original);seen.add(info.filename)
    if info.filename in overlays:
     replacement=overlays[info.filename];info.create_system=3;info.external_attr=replacement['Mode']<<16
     result.writestr(info,Path(replacement['File']).read_bytes())
    else:
     with previous.open(original) as incoming,result.open(info,'w') as outgoing:shutil.copyfileobj(incoming,outgoing,1024*1024)
   for name in sorted(set(overlays)-seen):
    replacement=overlays[name];info=zipfile.ZipInfo(name);info.create_system=3;info.external_attr=replacement['Mode']<<16;info.compress_type=zipfile.ZIP_DEFLATED
    result.writestr(info,Path(replacement['File']).read_bytes())
 def temporary(name,data):
  path=overlay_dir/name;path.write_bytes(data);return path
 def overlay(path,mode=0o100644):return {'File':str(path),'Mode':mode}
 output=ROOT/'dist'/f'Multi-Browser-{VERSION}-Windows-Portable.exe'
 if args.windows is None:pass
 elif output.exists():
  if not args.resume:raise FileExistsError('Existing Windows release preserved')
  report=json.loads((ROOT/'reference'/f'windows-single-file-{VERSION}.json').read_text())
  if digest(output)!=report['sha256']:raise ValueError('Existing Windows release checksum mismatch')
 else:
  with zipfile.ZipFile(args.windows) as previous:
   manifest=json.loads(previous.read('single-file-manifest.json'));old_version=manifest['Version']
  proof=json.loads((ROOT/'reference'/f'windows-single-file-{old_version}.json').read_text())
  if digest(args.windows)!=proof['sha256']:raise ValueError('Windows base checksum mismatch')
  print('Updating Windows sources with verified runtime bytes unchanged...',flush=True)
  entries={entry['Path']:entry for entry in manifest['Files']};overlays={}
  for source in sources:
   relative='resources/app/'+source.relative_to(ROOT).as_posix();data=source.read_bytes();sha=hashlib.sha256(data).hexdigest()
   if entries.get(relative,{}).get('SHA256')!=sha:overlays[relative]=overlay(source)
   entries[relative]={'Path':relative,'Size':len(data),'SHA256':sha}
  manifest={'Version':VERSION,'Files':sorted(entries.values(),key=lambda entry:entry['Path'])}
  raw=json.dumps(manifest,ensure_ascii=False,separators=(',',':')).encode();manifest_sha=hashlib.sha256(raw).hexdigest()
  overlays['single-file-manifest.json']=overlay(temporary('single-file-manifest.json',raw))
  payload=work/'payload.zip';packed_overlay(args.windows,payload,overlays);payload_sha=digest(payload)
  builder=module('windows_builder',ROOT/'scripts/build-windows-single-file.py');builder.write_resources(args.windows)
  flags=f'-s -w -H=windowsgui -X main.payloadSHA={payload_sha} -X main.manifestSHA={manifest_sha}'
  stub=work/'launcher.exe';subprocess.run([str(go/'bin/go.exe'),'build','-trimpath','-ldflags',flags,'-o',str(stub),'.'],cwd=ROOT/'scripts/windows-single-file',env=dict(env,GOOS='windows',GOARCH='amd64'),check=True)
  with output.open('xb') as dest:
   with stub.open('rb') as source:shutil.copyfileobj(source,dest)
   offset=dest.tell()
   with payload.open('rb') as source:shutil.copyfileobj(source,dest)
   dest.write(b'MULTIBROWSER-SF1'+struct.pack('<QQ',offset,payload.stat().st_size))
  report=dict(version=VERSION,file=str(output),size=output.stat().st_size,sha256=digest(output),payloadSHA256=payload_sha,manifestSHA256=manifest_sha,files=len(entries),unpackedBytes=sum(e['Size'] for e in entries.values()),sourceVersion=old_version,sourceSHA256=proof['sha256'],runtimeTestsPending=True,nativeRuntimeBytesUnchanged=True)
  (ROOT/'reference'/f'windows-single-file-{VERSION}.json').write_text(json.dumps(report,indent=2))
  print('Windows portable rebuilt.',flush=True)
 output=ROOT/'dist'/f'Multi-Browser-{VERSION}-Mac-Portable.zip'
 if output.exists() and not args.resume:raise FileExistsError('Existing Mac release preserved')
 with zipfile.ZipFile(args.mac) as previous:
  metadata=json.loads(previous.read('Mac-Portable/mac-portable-metadata.json'));old_version=metadata['version']
  proof=json.loads((ROOT/'reference'/f'mac-portable-{old_version}.json').read_text())
  if digest(args.mac)!=proof['zipSHA256']:raise ValueError('Mac base checksum mismatch')
  entries={entry['path']:entry for entry in metadata['entries']};overlays={}
  def replace(relative,data,mode=0o100644):
   file=temporary('mac-'+str(len(overlays)),data);overlays['Mac-Portable/'+relative]=overlay(file,mode)
   entries[relative]=dict(path=relative,mode=mode,kind='file',bytes=len(data),sha256=hashlib.sha256(data).hexdigest())
  outer='Multi-Browser.app/Contents/'
  roots=[outer]+[outer+'Resources/runtimes/'+arch+'/Multi-Browser.app/Contents/' for arch in ['x64','arm64']]
  for app in roots:
   name=app+'Info.plist';settings=plistlib.loads(previous.read('Mac-Portable/'+name));settings.update(CFBundleVersion=VERSION,CFBundleShortVersionString=VERSION);replace(name,plistlib.dumps(settings))
  for app in roots[1:]:
   for source in sources:
    relative=app+'Resources/app/'+source.relative_to(ROOT).as_posix();data=source.read_bytes()
    if entries.get(relative,{}).get('sha256')!=hashlib.sha256(data).hexdigest():replace(relative,data)
  records=sorted(entries.values(),key=lambda entry:entry['path'])
  metadata.update(version=VERSION,entries=records,sourceZipSHA256=proof['zipSHA256'],sharedSourcesUpdated=True,macExecutionTest='not executed: no Mac available')
  overlays['Mac-Portable/mac-portable-metadata.json']=overlay(temporary('mac-metadata.json',(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n').encode()))
  readme=previous.read('Mac-Portable/LEIA-ME.txt').decode().replace(old_version,VERSION)
  overlays['Mac-Portable/LEIA-ME.txt']=overlay(temporary('mac-readme.txt',readme.encode()))
  portable=module('mac_portable',ROOT/'scripts/build-macos-portable.py')
  overlays['Mac-Portable/Restaurar-permissoes-Mac.command']=overlay(temporary('restore-mac.command',portable.restore_script(records).encode()),0o100755)
 print('Updating both Mac architectures, retaining native binaries and symbolic links...',flush=True)
 if not output.exists():packed_overlay(args.mac,output,overlays)
 with zipfile.ZipFile(output) as result:
  links=0
  for entry in records:
   info=result.getinfo('Mac-Portable/'+entry['path']+('/' if entry['kind']=='directory' else ''))
   if info.external_attr>>16!=entry['mode']:raise ValueError('Mac mode changed: '+entry['path'])
   if entry['kind']=='file':
    if hashlib.sha256(result.read(info)).hexdigest()!=entry['sha256']:raise ValueError('Mac hash mismatch: '+entry['path'])
   elif entry['kind']=='symlink':
    links+=1
    if result.read(info).decode()!=entry['target']:raise ValueError('Mac symbolic link changed')
  if links!=38:raise ValueError('Unexpected Mac symlink count')
  launcher=result.read('Mac-Portable/Multi-Browser.app/Contents/MacOS/Multi-Browser')
  if launcher[:4]!=b'\xca\xfe\xba\xbe' or struct.unpack_from('>I',launcher,4)[0]!=2:raise ValueError('Mac launcher must remain universal')
  for app in roots[1:]:
   if json.loads(result.read('Mac-Portable/'+app+'Resources/app/package.json'))['version']!=VERSION:raise ValueError('Mac source version mismatch')
 report=dict(ok=True,version=VERSION,zip=str(output),zipBytes=output.stat().st_size,zipSHA256=digest(output),sourceZipSHA256=proof['zipSHA256'],entriesVerified=len(records),symlinksPreserved=links,launcher='universal-mach-o',architectures=['x64','arm64'],executionVerified=False,signed=False,notarized=False,nativeRuntimeBytesUnchanged=True,sharedSourcesUpdated=True)
 (ROOT/'reference'/f'mac-portable-{VERSION}.json').write_text(json.dumps(report,indent=2))
 print('PORTABLE_SOURCES_UPDATED '+VERSION,flush=True)
if __name__=='__main__':main()
