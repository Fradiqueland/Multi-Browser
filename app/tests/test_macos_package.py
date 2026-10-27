import importlib.util, tempfile, unittest, zipfile, stat
from pathlib import Path
spec=importlib.util.spec_from_file_location('mac_package',Path(__file__).resolve().parents[1]/'scripts/build-macos.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class PackageTests(unittest.TestCase):
 def test_paths(self):
  for name in ['/absolute','../outside','App/../../outside','C:/bad','App\\bad']:
   with self.assertRaises(ValueError):m.safe_name(name)
  self.assertEqual(m.safe_name('Chromium.app/Contents/Resources/a'),'Chromium.app/Contents/Resources/a')
 def test_escaping_symlink(self):
  with tempfile.TemporaryDirectory() as directory:
   for i,target in enumerate(['../../outside','/etc/passwd','../Other.app/file']):
    path=Path(directory)/(str(i)+'.zip')
    with zipfile.ZipFile(path,'w') as z:m.add_bytes(z,'App.app/link',target.encode(),0o120777)
    with self.assertRaises(ValueError):m.checked_archive(path)
 def test_modes_links_and_contents_survive(self):
  with tempfile.TemporaryDirectory() as directory:
   source=Path(directory)/'source.zip';dest=Path(directory)/'dest.zip'
   with zipfile.ZipFile(source,'w') as z:
    m.add_bytes(z,'App.app/Contents/executable',b'executable-data',0o100755)
    m.add_bytes(z,'App.app/Contents/current',b'executable',0o120777)
   with m.checked_archive(source) as z,zipfile.ZipFile(dest,'w') as out:
    for info in z.infolist():m.copy_entry(z,info,out,'Portable/'+info.filename)
   with zipfile.ZipFile(dest) as z:
    self.assertEqual(z.read('Portable/App.app/Contents/executable'),b'executable-data')
    self.assertTrue((z.getinfo('Portable/App.app/Contents/executable').external_attr>>16)&0o111)
    self.assertTrue(stat.S_ISLNK(z.getinfo('Portable/App.app/Contents/current').external_attr>>16))
    self.assertEqual(z.read('Portable/App.app/Contents/current'),b'executable')
if __name__=='__main__':unittest.main()
