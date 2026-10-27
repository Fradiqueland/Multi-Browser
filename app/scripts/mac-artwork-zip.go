package main
import("archive/zip";"encoding/json";"fmt";"io";"os";"sort";"time")
type replacement struct {File string; Mode uint32}
func run()error{
 if len(os.Args)!=4{return fmt.Errorf("usage: INPUT.zip OUTPUT.zip OVERLAY.json")}
 data,e:=os.ReadFile(os.Args[3]);if e!=nil{return e};replacements:=map[string]replacement{};if e=json.Unmarshal(data,&replacements);e!=nil{return e}
 source,e:=zip.OpenReader(os.Args[1]);if e!=nil{return e};defer source.Close()
 file,e:=os.OpenFile(os.Args[2],os.O_WRONLY|os.O_CREATE|os.O_EXCL,0644);if e!=nil{return e};defer file.Close()
 out:=zip.NewWriter(file);seen:=map[string]bool{}
 add:=func(name string,r replacement,old *zip.File)error{
  h:=zip.FileHeader{Name:name,Method:zip.Deflate,Modified:time.Date(2026,10,27,0,0,0,0,time.UTC)}
  if old!=nil{h=old.FileHeader;h.Method=zip.Deflate}
  h.SetMode(os.FileMode(r.Mode));w,e:=out.CreateHeader(&h);if e!=nil{return e}
  f,e:=os.Open(r.File);if e!=nil{return e};_,e=io.Copy(w,f);f.Close();return e
 }
 for _,entry:=range source.File{
  seen[entry.Name]=true
  if r,ok:=replacements[entry.Name];ok{if e=add(entry.Name,r,entry);e!=nil{return e}}else if entry.FileInfo().IsDir(){h:=entry.FileHeader;if _,e=out.CreateHeader(&h);e!=nil{return e}}else if e=out.Copy(entry);e!=nil{return e}
 }
 names:=[]string{};for n:=range replacements{if !seen[n]{names=append(names,n)}};sort.Strings(names)
 for _,name:=range names{if e=add(name,replacements[name],nil);e!=nil{return e}}
 if e=out.Close();e!=nil{return e};return file.Sync()
}
func main(){if e:=run();e!=nil{fmt.Fprintln(os.Stderr,e);os.Exit(1)}}
