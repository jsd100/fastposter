package storage

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestPauseWritersWaitsForInFlightWrites(t *testing.T) {
	dir := t.TempDir()
	gate := NewWriterGate(dir)
	lease, e := gate.TryAcquire()
	if e != nil {
		t.Fatal(e)
	}
	maintenance, e := BeginMaintenance(dir)
	if e != nil {
		t.Fatal(e)
	}
	defer maintenance.Close()
	paused := make(chan error, 1)
	go func() { paused <- maintenance.PauseWriters(context.Background(), 5*time.Second) }()
	select {
	case e := <-paused:
		t.Fatalf("maintenance did not wait for the in-flight write: %v", e)
	case <-time.After(150 * time.Millisecond):
	}
	lease.Release()
	if e = <-paused; e != nil {
		t.Fatal(e)
	}
	if _, e = gate.TryAcquire(); !errors.Is(e, ErrWritersPaused) {
		t.Fatalf("new write was not blocked after the drain: %v", e)
	}
}

func TestPauseWritersTimesOut(t *testing.T) {
	dir := t.TempDir()
	gate := NewWriterGate(dir)
	lease, e := gate.TryAcquire()
	if e != nil {
		t.Fatal(e)
	}
	defer lease.Release()
	maintenance, e := BeginMaintenance(dir)
	if e != nil {
		t.Fatal(e)
	}
	defer maintenance.Close()
	if e = maintenance.PauseWriters(context.Background(), 50*time.Millisecond); e == nil {
		t.Fatal("expected a timeout while a write is still in flight")
	}
}
