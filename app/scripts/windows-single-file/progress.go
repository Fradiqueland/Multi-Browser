package main

import (
	"io"
)

var progressCallback = func(int, string) {}

type countedReader struct {
	reader      io.Reader
	done, total int64
	start, span int
	stage       string
}

func (r *countedReader) Read(p []byte) (int, error) {
	n, e := r.reader.Read(p)
	r.done += int64(n)
	if r.total > 0 {
		progressCallback(r.start+int(r.done*int64(r.span)/r.total), r.stage)
	}
	return n, e
}
func progressRead(reader io.Reader, total int64, start, span int, stage string) io.Reader {
	return &countedReader{reader: reader, total: total, start: start, span: span, stage: stage}
}
