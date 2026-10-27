import os, subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1]
go=root/'.cache/dmg-toolchain/go'
tmp=root/'.cache/windows-single-file/unit-tmp'
tmp.mkdir(parents=True,exist_ok=True)
env=dict(os.environ,GOROOT=str(go),GOCACHE=str(root/'.cache/dmg-toolchain/go-build'),GOPATH=str(root/'.cache/dmg-toolchain/gopath'),GOTOOLCHAIN='local',CGO_ENABLED='0',TEMP=str(tmp),TMP=str(tmp))
raise SystemExit(subprocess.run([str(go/'bin/go.exe'),'test','-count=1','-v','./...'],cwd=root/'scripts/windows-single-file',env=env).returncode)
