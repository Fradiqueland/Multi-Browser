//go:build !darwin
package main
import "fmt"
func execNative(file string,args,env []string)error{return fmt.Errorf("Mac launcher can run only on macOS")}
func showError(){}
