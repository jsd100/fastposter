package storage

import (
	"context"
	"io"
)

type Key string
type FileInfo struct {
	Key    Key    `json:"key"`
	Size   int64  `json:"size"`
	SHA256 string `json:"sha256"`
}
type FileStore interface {
	Put(context.Context, Key, io.Reader) (FileInfo, error)
	Open(context.Context, Key) (io.ReadCloser, error)
	Stat(context.Context, Key) (FileInfo, error)
	Delete(context.Context, Key) error
	Close() error
}
