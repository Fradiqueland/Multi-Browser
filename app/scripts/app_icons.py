"""Application icon conversion and Windows PE resources (build-time only)."""
from pathlib import Path
import ctypes
from ctypes import wintypes
import io
import struct
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'ui/assets'
def prepare(source):
    source=Path(source)
    with Image.open(source) as image:
        image.load()
        if image.width!=image.height or image.width<256:
            raise ValueError('Application icon must be square and at least 256px')
        rgba=image.convert('RGBA')
        ASSETS.mkdir(parents=True,exist_ok=True)
        (ASSETS/'app-icon.png').write_bytes(source.read_bytes())
        rgba.save(ASSETS/'app-icon.ico',format='ICO',sizes=[(n,n) for n in (16,20,24,32,48,64,128,256)])
        rgba.save(ASSETS/'app-icon.icns',format='ICNS')
    return ASSETS/'app-icon.ico'

def ico_resources(path=None):
    data=Path(path or ASSETS/'app-icon.ico').read_bytes()
    reserved,kind,count=struct.unpack_from('<HHH',data)
    if reserved or kind!=1 or not 1<=count<=32:raise ValueError('Invalid ICO header')
    group=bytearray(struct.pack('<HHH',0,1,count));images=[]
    for index in range(count):
        w,h,colors,zero,planes,bits,size,offset=struct.unpack_from('<BBBBHHII',data,6+16*index)
        if offset<6+16*count or offset+size>len(data):raise ValueError('Invalid ICO bounds')
        image=data[offset:offset+size]
        with Image.open(io.BytesIO(image)) as decoded:
            if decoded.size!=(w or 256,h or 256):raise ValueError('Invalid ICO image dimensions')
        group.extend(struct.pack('<BBBBHHIH',w,h,colors,zero,planes,bits,size,index+1))
        images.append(image)
    return bytes(group),images

def apply_windows(executable):
    executable=Path(executable).resolve()
    group,images=ico_resources()
    kernel=ctypes.WinDLL('kernel32',use_last_error=True)
    kernel.BeginUpdateResourceW.argtypes=[wintypes.LPCWSTR,wintypes.BOOL];kernel.BeginUpdateResourceW.restype=wintypes.HANDLE
    kernel.UpdateResourceW.argtypes=[wintypes.HANDLE,ctypes.c_void_p,ctypes.c_void_p,wintypes.WORD,ctypes.c_void_p,wintypes.DWORD];kernel.UpdateResourceW.restype=wintypes.BOOL
    kernel.EndUpdateResourceW.argtypes=[wintypes.HANDLE,wintypes.BOOL];kernel.EndUpdateResourceW.restype=wintypes.BOOL
    # Preserve all non-icon resources, including the existing execution manifest.
    import importlib.util
    spec=importlib.util.spec_from_file_location('singlefile',ROOT/'scripts/build-windows-single-file.py')
    pe=importlib.util.module_from_spec(spec);spec.loader.exec_module(pe)
    resources=pe.pe_resources(executable)
    handle=kernel.BeginUpdateResourceW(str(executable),False)
    if not handle:raise ctypes.WinError(ctypes.get_last_error())
    success=False
    try:
        for kind in (3,14):
            for name,languages in resources.get(kind,{}).items():
                for language in languages:
                    if not kernel.UpdateResourceW(handle,kind,name,language,None,0):raise ctypes.WinError(ctypes.get_last_error())
        for kind,name,data in [(14,1,group)]+[(3,index+1,image) for index,image in enumerate(images)]:
            buffer=ctypes.create_string_buffer(data)
            if not kernel.UpdateResourceW(handle,kind,name,1033,buffer,len(data)):raise ctypes.WinError(ctypes.get_last_error())
        success=True
    finally:
        if not kernel.EndUpdateResourceW(handle,not success) and success:raise ctypes.WinError(ctypes.get_last_error())
    result=pe.pe_resources(executable)
    if result[14][1][1033]!=group:raise ValueError('Windows icon group verification failed')
    for index,image in enumerate(images):
        if result[3][index+1][1033]!=image:raise ValueError('Windows icon image verification failed')

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser()
    parser.add_argument('--source')
    parser.add_argument('--windows')
    args=parser.parse_args()
    if args.source:prepare(args.source)
    if args.windows:apply_windows(args.windows)
