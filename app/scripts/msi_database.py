"""Small Unicode Windows Installer database reader/editor (no external runtime)."""
import ctypes
from ctypes import wintypes
from pathlib import Path

msi=ctypes.WinDLL('msi',use_last_error=True)
HANDLE=wintypes.UINT
msi.MsiOpenDatabaseW.argtypes=[wintypes.LPCWSTR,ctypes.c_void_p,ctypes.POINTER(HANDLE)]
msi.MsiDatabaseOpenViewW.argtypes=[HANDLE,wintypes.LPCWSTR,ctypes.POINTER(HANDLE)]
msi.MsiViewExecute.argtypes=[HANDLE,HANDLE]
msi.MsiViewFetch.argtypes=[HANDLE,ctypes.POINTER(HANDLE)]
msi.MsiRecordGetFieldCount.argtypes=[HANDLE]
msi.MsiRecordGetStringW.argtypes=[HANDLE,wintypes.UINT,wintypes.LPWSTR,ctypes.POINTER(wintypes.DWORD)]
msi.MsiDatabaseCommit.argtypes=[HANDLE]
msi.MsiCloseHandle.argtypes=[HANDLE]
msi.MsiViewClose.argtypes=[HANDLE]
msi.MsiRecordReadStream.argtypes=[HANDLE,wintypes.UINT,ctypes.c_void_p,ctypes.POINTER(wintypes.DWORD)]
msi.MsiGetSummaryInformationW.argtypes=[HANDLE,wintypes.LPCWSTR,wintypes.UINT,ctypes.POINTER(HANDLE)]
msi.MsiSummaryInfoSetPropertyW.argtypes=[HANDLE,wintypes.UINT,wintypes.UINT,ctypes.c_int,ctypes.c_void_p,wintypes.LPCWSTR]
msi.MsiSummaryInfoGetPropertyW.argtypes=[HANDLE,wintypes.UINT,ctypes.POINTER(wintypes.UINT),ctypes.POINTER(ctypes.c_int),ctypes.POINTER(wintypes.FILETIME),wintypes.LPWSTR,ctypes.POINTER(wintypes.DWORD)]
msi.MsiSummaryInfoPersist.argtypes=[HANDLE]

def checked(code,label):
 if code:raise OSError(code,'Windows Installer database: '+label)

class Database:
 def __init__(self,path,write=False):
  self.handle=HANDLE();checked(msi.MsiOpenDatabaseW(str(Path(path).resolve()),ctypes.c_void_p(1 if write else 0),ctypes.byref(self.handle)),'open')
 def query(self,sql):
  view=HANDLE();checked(msi.MsiDatabaseOpenViewW(self.handle,sql,ctypes.byref(view)),sql)
  rows=[]
  try:
   checked(msi.MsiViewExecute(view,0),'execute')
   while True:
    record=HANDLE();code=msi.MsiViewFetch(view,ctypes.byref(record))
    if code==259:break
    checked(code,'fetch')
    try:
     row=[]
     for field in range(1,msi.MsiRecordGetFieldCount(record)+1):
      size=wintypes.DWORD(0);code=msi.MsiRecordGetStringW(record,field,None,ctypes.byref(size))
      if code not in (0,234):checked(code,'measure string')
      buffer=ctypes.create_unicode_buffer(size.value+1);size.value+=1
      checked(msi.MsiRecordGetStringW(record,field,buffer,ctypes.byref(size)),'read string');row.append(buffer.value)
     rows.append(row)
    finally:msi.MsiCloseHandle(record)
  finally:msi.MsiViewClose(view);msi.MsiCloseHandle(view)
  return rows
 def commit(self):checked(msi.MsiDatabaseCommit(self.handle),'commit')
 def execute(self,sql):
  view=HANDLE();checked(msi.MsiDatabaseOpenViewW(self.handle,sql,ctypes.byref(view)),sql)
  try:checked(msi.MsiViewExecute(view,0),'execute')
  finally:msi.MsiViewClose(view);msi.MsiCloseHandle(view)
 def summary(self,property_id):
  handle=HANDLE();checked(msi.MsiGetSummaryInformationW(self.handle,None,0,ctypes.byref(handle)),'open summary')
  try:
   kind=wintypes.UINT();number=ctypes.c_int();time=wintypes.FILETIME();size=wintypes.DWORD(4096);text=ctypes.create_unicode_buffer(size.value)
   checked(msi.MsiSummaryInfoGetPropertyW(handle,property_id,ctypes.byref(kind),ctypes.byref(number),ctypes.byref(time),text,ctypes.byref(size)),'read summary')
   return number.value if kind.value in (2,3) else text.value
  finally:msi.MsiCloseHandle(handle)
 def export_stream(self,name,destination):
  view=HANDLE();record=HANDLE();sql="SELECT `Data` FROM `_Streams` WHERE `Name`='"+name.replace("'","''")+"'"
  checked(msi.MsiDatabaseOpenViewW(self.handle,sql,ctypes.byref(view)),sql)
  try:
   checked(msi.MsiViewExecute(view,0),'open embedded stream');checked(msi.MsiViewFetch(view,ctypes.byref(record)),'fetch embedded stream')
   with Path(destination).open('xb') as output:
    buffer=ctypes.create_string_buffer(1024*1024)
    while True:
     size=wintypes.DWORD(len(buffer));checked(msi.MsiRecordReadStream(record,1,buffer,ctypes.byref(size)),'read embedded stream')
     if not size.value:break
     output.write(buffer.raw[:size.value])
  finally:
   if record:msi.MsiCloseHandle(record)
   msi.MsiViewClose(view);msi.MsiCloseHandle(view)
 def set_package_code(self,guid):
  handle=HANDLE();checked(msi.MsiGetSummaryInformationW(self.handle,None,1,ctypes.byref(handle)),'open writable summary')
  try:
   checked(msi.MsiSummaryInfoSetPropertyW(handle,9,30,0,None,guid),'set package code');checked(msi.MsiSummaryInfoPersist(handle),'save package code')
  finally:msi.MsiCloseHandle(handle)
 def close(self):msi.MsiCloseHandle(self.handle)
 def __enter__(self):return self
 def __exit__(self,*_args):self.close()
