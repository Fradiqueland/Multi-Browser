"""Download the pinned build-only Go toolchain into an isolated temp directory."""
import hashlib,json,os,subprocess,tempfile,urllib.request,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
config=json.loads((ROOT/'scripts/mac-dmg-toolchain.json').read_text())['go']
cache=ROOT/'.cache';cache.mkdir(exist_ok=True)
work=Path(tempfile.mkdtemp(prefix='portable-build-',dir=cache))
archive=work/config['filename']
print('Preparing pinned build toolchain...',flush=True)
urllib.request.urlretrieve('https://go.dev/dl/'+config['filename'],archive)
if archive.stat().st_size!=config['size'] or hashlib.sha256(archive.read_bytes()).hexdigest()!=config['sha256']:
 raise RuntimeError('Build toolchain checksum mismatch')
with zipfile.ZipFile(archive) as source:source.extractall(work)
(cache/'portable-go.json').write_text(json.dumps({'work':str(work),'goRoot':str(work/'go')}))
print('GO_TOOLCHAIN_READY',flush=True)
