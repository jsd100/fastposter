package domain

import (
	"crypto/rand"
	"encoding/hex"
)

type Error struct {
	Code    string
	Message string
}

func (e *Error) Error() string     { return e.Message }
func E(code, message string) error { return &Error{code, message} }
func ID() string {
	var b [16]byte
	if _, e := rand.Read(b[:]); e != nil {
		panic(e)
	}
	return hex.EncodeToString(b[:])
}
